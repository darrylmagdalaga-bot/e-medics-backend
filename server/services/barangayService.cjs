const sql = require('mssql');

class BarangayService {

    /**
     * Derive user's trusted server-side assignment and barangay scope.
     */
    static async getUserScope(pool, userId) {
        const req = pool.request();
        req.input('userId', sql.Int, userId);
        const res = await req.query(`
            SELECT u.UserID, u.Username, u.FullName, u.Role, u.Barangay, u.LocationID,
                   loc.LocationName
            FROM Users u
            LEFT JOIN Warehouse_Locations loc ON u.LocationID = loc.LocationID
            WHERE u.UserID = @userId AND u.IsActive = 1
        `);

        if (res.recordset.length === 0) {
            throw new Error('User not found or account is inactive.');
        }

        const user = res.recordset[0];
        const roleLower = (user.Role || '').toLowerCase().trim();
        const isElevated = roleLower === 'admin' || roleLower.includes('warehouse');

        return {
            userId: user.UserID,
            username: user.Username,
            fullName: user.FullName,
            role: user.Role,
            barangay: user.Barangay,
            locationId: user.LocationID,
            locationName: user.LocationName,
            isElevated
        };
    }

    /**
     * Submit a stock request from an authorized Barangay to the Central Warehouse.
     */
    static async createStockRequest(pool, userId, requestData) {
        const scope = await this.getUserScope(pool, userId);
        if (!scope.isElevated && requestData.locationId && Number(requestData.locationId) !== scope.locationId) {
            throw new Error('Access Denied: You cannot create stock requests for another Barangay station.');
        }
        
        let targetLocationId = scope.locationId;
        let targetBarangay = scope.barangay;

        // If elevated user creating on behalf of a barangay, allow specifying locationId
        if (scope.isElevated && requestData.locationId) {
            targetLocationId = Number(requestData.locationId);
            const locRes = await pool.request()
                .input('locId', sql.Int, targetLocationId)
                .query('SELECT LocationName FROM Warehouse_Locations WHERE LocationID = @locId');
            targetBarangay = locRes.recordset[0]?.LocationName?.replace(/^BHS\s+/, '') || targetBarangay;
        }

        if (!targetLocationId) {
            throw new Error('User has no assigned Barangay location.');
        }

        const { priority = 'Routine', purpose = 'Barangay Health Center Restock', items = [] } = requestData;

        if (!Array.isArray(items) || items.length === 0) {
            throw new Error('Stock request must contain at least one item.');
        }

        for (const item of items) {
            if (!item.medicineId || !item.quantity || Number(item.quantity) <= 0) {
                throw new Error('Each line item must have a valid MedicineID and Quantity greater than 0.');
            }
        }

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // Generate unique request number
            const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const countReq = new sql.Request(transaction);
            const countRes = await countReq.query(`
                SELECT COUNT(*) as count 
                FROM Warehouse_StockRequests 
                WHERE RequestNumber LIKE 'SR-BGY-${datePrefix}%'
            `);
            const seq = countRes.recordset[0].count + 1;
            const requestNumber = `SR-BGY-${datePrefix}-${String(seq).padStart(4, '0')}`;

            // Insert Request Header
            const headerReq = new sql.Request(transaction);
            headerReq.input('RequestNumber', sql.NVarChar, requestNumber);
            headerReq.input('RequestingLocationID', sql.Int, targetLocationId);
            headerReq.input('RequestedByUserID', sql.Int, userId);
            headerReq.input('Priority', sql.NVarChar, priority);
            headerReq.input('Purpose', sql.NVarChar, `[${targetBarangay}] ${purpose}`);
            headerReq.input('CreatedBy', sql.Int, userId);

            const headerRes = await headerReq.query(`
                INSERT INTO Warehouse_StockRequests (
                    RequestNumber, RequestingLocationID, RequestedByUserID, Priority,
                    Purpose, Status, CreatedBy, CreatedDate, IsDeleted
                )
                OUTPUT INSERTED.StockRequestID
                VALUES (
                    @RequestNumber, @RequestingLocationID, @RequestedByUserID, @Priority,
                    @Purpose, 'Submitted', @CreatedBy, SYSUTCDATETIME(), 0
                )
            `);

            const stockRequestId = headerRes.recordset[0].StockRequestID;

            // Insert Line Items
            for (const item of items) {
                const itemReq = new sql.Request(transaction);
                itemReq.input('StockRequestID', sql.BigInt, stockRequestId);
                itemReq.input('MedicineID', sql.Int, item.medicineId);
                itemReq.input('QuantityRequested', sql.Int, Number(item.quantity));
                itemReq.input('CreatedBy', sql.Int, userId);

                await itemReq.query(`
                    INSERT INTO Warehouse_StockRequestItems (
                        StockRequestID, MedicineID, QuantityRequested, QuantityApproved, QuantityReleased,
                        CreatedBy, CreatedDate, IsDeleted
                    )
                    VALUES (
                        @StockRequestID, @MedicineID, @QuantityRequested, @QuantityRequested, 0,
                        @CreatedBy, SYSUTCDATETIME(), 0
                    )
                `);
            }

            await transaction.commit();

            return {
                success: true,
                stockRequestId,
                requestNumber,
                locationId: targetLocationId,
                barangay: targetBarangay,
                status: 'Submitted',
                itemCount: items.length
            };
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    }

    /**
     * Retrieve stock requests scoped to user's assigned Barangay (or all if elevated).
     */
    static async getStockRequests(pool, userId, filters = {}) {
        const scope = await this.getUserScope(pool, userId);
        if (!scope.isElevated && filters.locationId && Number(filters.locationId) !== scope.locationId) {
            throw new Error('Access Denied: You cannot view stock requests for another Barangay station.');
        }
        const req = pool.request();

        let query = `
            SELECT 
                sr.StockRequestID,
                sr.RequestNumber,
                sr.RequestingLocationID,
                loc.LocationName AS FacilityName,
                sr.RequestedByUserID,
                u.FullName AS RequestedByName,
                sr.Priority,
                sr.Purpose,
                sr.Status,
                sr.CreatedDate,
                (SELECT COUNT(*) FROM Warehouse_StockRequestItems sri WHERE sri.StockRequestID = sr.StockRequestID AND sri.IsDeleted = 0) AS TotalItems,
                (SELECT SUM(QuantityRequested) FROM Warehouse_StockRequestItems sri WHERE sri.StockRequestID = sr.StockRequestID AND sri.IsDeleted = 0) AS TotalUnits
            FROM Warehouse_StockRequests sr
            LEFT JOIN Warehouse_Locations loc ON sr.RequestingLocationID = loc.LocationID
            LEFT JOIN Users u ON sr.RequestedByUserID = u.UserID
            WHERE sr.IsDeleted = 0
        `;

        // Strict isolation: non-elevated user can only access their assigned location
        if (!scope.isElevated) {
            query += ' AND sr.RequestingLocationID = @userLocId';
            req.input('userLocId', sql.Int, scope.locationId);
        } else if (filters.locationId) {
            query += ' AND sr.RequestingLocationID = @filterLocId';
            req.input('filterLocId', sql.Int, Number(filters.locationId));
        }

        if (filters.status) {
            query += ' AND sr.Status = @status';
            req.input('status', sql.NVarChar, filters.status);
        }

        query += ' ORDER BY sr.CreatedDate DESC';

        const res = await req.query(query);
        return res.recordset;
    }

    /**
     * Get details of a single stock request with its items, verifying scope.
     */
    static async getStockRequestDetails(pool, requestId, userId) {
        const scope = await this.getUserScope(pool, userId);

        const checkReq = pool.request();
        checkReq.input('requestId', sql.BigInt, requestId);
        const checkRes = await checkReq.query(`
            SELECT RequestingLocationID FROM Warehouse_StockRequests WHERE StockRequestID = @requestId AND IsDeleted = 0
        `);

        if (checkRes.recordset.length === 0) {
            throw new Error('Stock Request not found.');
        }

        if (!scope.isElevated && checkRes.recordset[0].RequestingLocationID !== scope.locationId) {
            throw new Error('Access Denied: You cannot view stock requests for another Barangay.');
        }

        const req = pool.request();
        req.input('requestId', sql.BigInt, requestId);

        const query = `
            SELECT 
                sr.*,
                loc.LocationName AS FacilityName,
                u.FullName AS RequestedByName,
                appUser.FullName AS ApprovedByName
            FROM Warehouse_StockRequests sr
            LEFT JOIN Warehouse_Locations loc ON sr.RequestingLocationID = loc.LocationID
            LEFT JOIN Users u ON sr.RequestedByUserID = u.UserID
            LEFT JOIN Users appUser ON sr.ApprovedByUserID = appUser.UserID
            WHERE sr.StockRequestID = @requestId AND sr.IsDeleted = 0
        `;

        const res = await req.query(query);

        const header = res.recordset[0];

        // Fetch line items
        const itemsReq = pool.request();
        itemsReq.input('requestId', sql.BigInt, requestId);
        const itemsRes = await itemsReq.query(`
            SELECT 
                sri.StockRequestItemID,
                sri.StockRequestID,
                sri.MedicineID,
                sri.QuantityRequested,
                sri.QuantityApproved,
                sri.QuantityReleased,
                m.ProductName,
                m.GenericName,
                m.Dosage,
                m.Form,
                u.UnitName
            FROM Warehouse_StockRequestItems sri
            INNER JOIN Medicines m ON sri.MedicineID = m.MedicineID
            LEFT JOIN Medicine_Unit u ON m.UnitID = u.UnitID
            WHERE sri.StockRequestID = @requestId AND sri.IsDeleted = 0
        `);

        return {
            request: header,
            items: itemsRes.recordset
        };
    }

    /**
     * Retrieve incoming 'Issued' distributions awaiting confirmation at the Barangay.
     */
    static async getIncomingDistributions(pool, userId, filters = {}) {
        const scope = await this.getUserScope(pool, userId);
        if (!scope.isElevated && filters && filters.locationId && Number(filters.locationId) !== scope.locationId) {
            throw new Error('Access Denied: You cannot view incoming distributions for another Barangay station.');
        }
        const req = pool.request();

        let query = `
            SELECT 
                d.DistributionID,
                d.DistributionNumber,
                d.ReferenceStockRequestID,
                d.SourceLocationID,
                srcLoc.LocationName AS SourceLocationName,
                d.DestinationLocationID,
                destLoc.LocationName AS DestinationLocationName,
                d.ReleasedDate,
                d.ReceivedDate,
                d.Status,
                d.Remarks,
                d.HasDiscrepancy,
                d.DiscrepancyRemarks,
                relUser.FullName AS ReleasedByName,
                (SELECT COUNT(*) FROM Warehouse_DistributionItems di WHERE di.DistributionID = d.DistributionID AND di.IsDeleted = 0) AS TotalLineItems,
                (SELECT COALESCE(SUM(Quantity), 0) FROM Warehouse_DistributionItems di WHERE di.DistributionID = d.DistributionID AND di.IsDeleted = 0) AS TotalQuantityIssued
            FROM Warehouse_Distributions d
            LEFT JOIN Warehouse_Locations srcLoc ON d.SourceLocationID = srcLoc.LocationID
            LEFT JOIN Warehouse_Locations destLoc ON d.DestinationLocationID = destLoc.LocationID
            LEFT JOIN Users relUser ON d.ReleasedByUserID = relUser.UserID
            WHERE d.IsDeleted = 0
        `;

        if (filters && filters.hasDiscrepancy) {
            query += ' AND d.HasDiscrepancy = 1';
        } else if (filters && filters.status) {
            query += ' AND d.Status = @status';
            req.input('status', sql.NVarChar, filters.status);
        } else {
            query += " AND d.Status = 'Issued'";
        }

        // Strict isolation: non-elevated user only receives distributions for their assigned location
        if (!scope.isElevated) {
            query += ' AND d.DestinationLocationID = @userLocId';
            req.input('userLocId', sql.Int, scope.locationId);
        }

        query += ' ORDER BY d.ReleasedDate DESC';

        const res = await req.query(query);
        return res.recordset;
    }

    /**
     * Retrieve full distribution line items and batch details for confirmation.
     */
    static async getDistributionForReceipt(pool, distributionId, userId) {
        const scope = await this.getUserScope(pool, userId);

        const checkReq = pool.request();
        checkReq.input('distId', sql.BigInt, distributionId);
        const checkRes = await checkReq.query(`
            SELECT DestinationLocationID FROM Warehouse_Distributions WHERE DistributionID = @distId AND IsDeleted = 0
        `);

        if (checkRes.recordset.length === 0) {
            throw new Error('Distribution not found.');
        }

        if (!scope.isElevated && checkRes.recordset[0].DestinationLocationID !== scope.locationId) {
            throw new Error('Access Denied: You cannot view distributions destined for another Barangay.');
        }

        const req = pool.request();
        req.input('distId', sql.BigInt, distributionId);

        const query = `
            SELECT 
                d.*,
                srcLoc.LocationName AS SourceLocationName,
                destLoc.LocationName AS DestinationLocationName,
                relUser.FullName AS ReleasedByName,
                recUser.FullName AS ReceivedByName
            FROM Warehouse_Distributions d
            LEFT JOIN Warehouse_Locations srcLoc ON d.SourceLocationID = srcLoc.LocationID
            LEFT JOIN Warehouse_Locations destLoc ON d.DestinationLocationID = destLoc.LocationID
            LEFT JOIN Users relUser ON d.ReleasedByUserID = relUser.UserID
            LEFT JOIN Users recUser ON d.ReceivedByUserID = recUser.UserID
            WHERE d.DistributionID = @distId AND d.IsDeleted = 0
        `;

        const res = await req.query(query);

        const dist = res.recordset[0];

        const itemsReq = pool.request();
        itemsReq.input('distId', sql.BigInt, distributionId);
        const itemsRes = await itemsReq.query(`
            SELECT 
                di.DistributionItemID,
                di.DistributionID,
                di.InventoryID,
                di.Quantity AS QuantityIssued,
                di.ReceivedQuantity,
                di.UnitCostAtTimeOfRelease,
                wi.MedicineID,
                wi.LotNumber,
                wi.ExpiryDate,
                m.ProductName,
                m.GenericName,
                m.Dosage,
                m.Form
            FROM Warehouse_DistributionItems di
            INNER JOIN Warehouse_Inventory wi ON di.InventoryID = wi.InventoryID
            INNER JOIN Medicines m ON wi.MedicineID = m.MedicineID
            WHERE di.DistributionID = @distId AND di.IsDeleted = 0
        `);

        return {
            distribution: dist,
            items: itemsRes.recordset
        };
    }

    /**
     * Atomically receive a warehouse distribution into Barangay inventory.
     * Records actual received quantities, flags and records any discrepancies,
     * updates Barangay_Stocks, and writes immutable RECEIPT ledger transactions.
     */
    static async receiveDistribution(pool, distributionId, userId, payload = {}) {
        const scope = await this.getUserScope(pool, userId);

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // 1. Lock and verify distribution header
            const distReq = new sql.Request(transaction);
            distReq.input('distId', sql.BigInt, distributionId);
            const distRes = await distReq.query(`
                SELECT d.*, destLoc.LocationName AS DestinationLocationName
                FROM Warehouse_Distributions d WITH (UPDLOCK, ROWLOCK)
                LEFT JOIN Warehouse_Locations destLoc ON d.DestinationLocationID = destLoc.LocationID
                WHERE d.DistributionID = @distId AND d.IsDeleted = 0
            `);

            if (distRes.recordset.length === 0) {
                throw new Error(`Distribution ID ${distributionId} does not exist.`);
            }

            const dist = distRes.recordset[0];

            if (dist.Status === 'Received') {
                throw new Error(`Distribution ${dist.DistributionNumber} has already been received.`);
            }

            if (dist.Status !== 'Issued') {
                throw new Error(`Distribution ${dist.DistributionNumber} cannot be received. Current status is '${dist.Status}', must be 'Issued'.`);
            }

            // Check location authorization
            if (!scope.isElevated && dist.DestinationLocationID !== scope.locationId) {
                throw new Error('Access Denied: You cannot receive a distribution destined for another Barangay.');
            }

            // Target barangay name
            const barangayName = scope.barangay || dist.DestinationLocationName?.replace(/^BHS\s+/, '') || 'Barangay Health Center';
            const locationId = dist.DestinationLocationID;

            // 2. Double-check idempotency in inventory ledger
            const dupLedgerReq = new sql.Request(transaction);
            dupLedgerReq.input('distId', sql.BigInt, distributionId);
            const dupLedgerRes = await dupLedgerReq.query(`
                SELECT COUNT(*) AS cnt 
                FROM Barangay_InventoryTransactions 
                WHERE ReferenceID = @distId AND TransactionType = 'RECEIPT'
            `);
            if (dupLedgerRes.recordset[0]?.cnt > 0) {
                throw new Error(`Distribution ${dist.DistributionNumber} already has recorded stock receipt transactions.`);
            }

            // 3. Retrieve distribution line items
            const itemsReq = new sql.Request(transaction);
            itemsReq.input('distId', sql.BigInt, distributionId);
            const itemsRes = await itemsReq.query(`
                SELECT 
                    di.DistributionItemID,
                    di.DistributionID,
                    di.InventoryID,
                    di.StockRequestItemID,
                    di.Quantity AS QuantityIssued,
                    di.UnitCostAtTimeOfRelease,
                    wi.MedicineID,
                    wi.LotNumber,
                    wi.ExpiryDate
                FROM Warehouse_DistributionItems di
                INNER JOIN Warehouse_Inventory wi ON di.InventoryID = wi.InventoryID
                WHERE di.DistributionID = @distId AND di.IsDeleted = 0
            `);

            if (itemsRes.recordset.length === 0) {
                throw new Error(`No line items found for distribution ${dist.DistributionNumber}.`);
            }

            // Map user-submitted line item confirmations if provided
            const itemConfirmMap = new Map();
            const itemsArray = Array.isArray(payload.items) ? payload.items : (Array.isArray(payload.receivedItems) ? payload.receivedItems : []);
            if (itemsArray.length > 0) {
                itemsArray.forEach(it => {
                    const key = it.distributionItemId !== undefined ? Number(it.distributionItemId) : (it.inventoryId !== undefined ? Number(it.inventoryId) : null);
                    if (key !== null) {
                        itemConfirmMap.set(key, {
                            receivedQuantity: it.receivedQuantity !== undefined ? Number(it.receivedQuantity) : (it.acceptedQuantity !== undefined ? Number(it.acceptedQuantity) : undefined),
                            damagedQuantity: Number(it.damagedQuantity || 0),
                            shortageQuantity: Number(it.shortageQuantity || 0),
                            discrepancyReason: it.discrepancyReason || payload.discrepancyRemarks || ''
                        });
                    }
                });
            }

            let hasDiscrepancy = Boolean(payload.discrepancyRemarks && payload.discrepancyRemarks.trim());
            const discrepancyNotes = [];
            if (payload.discrepancyRemarks && payload.discrepancyRemarks.trim()) {
                discrepancyNotes.push(payload.discrepancyRemarks.trim());
            }
            const receivedStocks = [];
            let totalIssuedUnits = 0;
            let totalAcceptedUnits = 0;

            // 4. Ingest each item into Barangay_Stocks and log to immutable ledger
            for (const item of itemsRes.recordset) {
                const issuedQty = Number(item.QuantityIssued);
                totalIssuedUnits += issuedQty;

                const conf = itemConfirmMap.get(Number(item.DistributionItemID)) || itemConfirmMap.get(Number(item.InventoryID));
                const receivedQty = (conf !== undefined && conf.receivedQuantity !== undefined && !Number.isNaN(conf.receivedQuantity))
                    ? conf.receivedQuantity
                    : issuedQty;
                const damagedQty = conf ? Math.max(0, conf.damagedQuantity || 0) : 0;

                if (receivedQty < 0) {
                    throw new Error('Received quantity cannot be negative.');
                }

                if (receivedQty > issuedQty) {
                    throw new Error(`Received quantity (${receivedQty}) cannot exceed issued quantity (${issuedQty}) for batch ${item.LotNumber}.`);
                }

                if (receivedQty + damagedQty > issuedQty) {
                    throw new Error(`Accepted (${receivedQty}) + Damaged (${damagedQty}) cannot exceed issued quantity (${issuedQty}) for batch ${item.LotNumber}.`);
                }

                const shortageQty = Math.max(0, issuedQty - receivedQty - damagedQty);
                totalAcceptedUnits += receivedQty;

                // Check discrepancy
                if (receivedQty !== issuedQty || damagedQty > 0) {
                    hasDiscrepancy = true;
                    const reason = conf?.discrepancyReason || 'Quantity discrepancy upon receipt confirmation';
                    const details = [
                        `issued ${issuedQty}`,
                        `received ${receivedQty}`,
                        damagedQty > 0 ? `damaged ${damagedQty}` : null,
                        shortageQty > 0 ? `shortage ${shortageQty}` : null
                    ].filter(Boolean).join(', ');
                    discrepancyNotes.push(`Batch ${item.LotNumber}: ${details}. (${reason})`);
                }

                // Update line item ReceivedQuantity
                const updateItemReq = new sql.Request(transaction);
                updateItemReq.input('diId', sql.BigInt, item.DistributionItemID);
                updateItemReq.input('recQty', sql.Int, receivedQty);
                await updateItemReq.query(`
                    UPDATE Warehouse_DistributionItems
                    SET ReceivedQuantity = @recQty, ModifiedDate = SYSUTCDATETIME()
                    WHERE DistributionItemID = @diId
                `);

                // Update StockRequestItem QuantityReleased if linked
                if (item.StockRequestItemID) {
                    const updateSriReq = new sql.Request(transaction);
                    updateSriReq.input('sriId', sql.BigInt, item.StockRequestItemID);
                    updateSriReq.input('recQty', sql.Int, receivedQty);
                    await updateSriReq.query(`
                        UPDATE Warehouse_StockRequestItems
                        SET QuantityApproved = CASE WHEN ISNULL(QuantityApproved, 0) < @recQty THEN @recQty ELSE QuantityApproved END,
                            QuantityReleased = @recQty
                        WHERE StockRequestItemID = @sriId
                    `);
                }

                // Only add to stock if receivedQty > 0
                if (receivedQty > 0) {
                    const stockReq = new sql.Request(transaction);
                    stockReq.input('bgy', sql.NVarChar, barangayName);
                    stockReq.input('locId', sql.Int, locationId);
                    stockReq.input('medId', sql.Int, item.MedicineID);
                    stockReq.input('qty', sql.Int, receivedQty);
                    stockReq.input('initQty', sql.Int, receivedQty);
                    stockReq.input('lot', sql.NVarChar, item.LotNumber);
                    stockReq.input('exp', sql.Date, item.ExpiryDate);
                    stockReq.input('cost', sql.Decimal(18, 2), item.UnitCostAtTimeOfRelease || 0);
                    stockReq.input('invId', sql.BigInt, item.InventoryID);
                    stockReq.input('diId', sql.BigInt, item.DistributionItemID);

                    const stockRes = await stockReq.query(`
                        INSERT INTO Barangay_Stocks (
                            BarangayName, LocationID, MedicineID, Quantity, InitialQuantity,
                            LotNumber, ExpiryDate, UnitCost, WarehouseInventoryID,
                            DistributionItemID, DateReceived, IsActive, CreatedDate
                        )
                        OUTPUT INSERTED.StockID
                        VALUES (
                            @bgy, @locId, @medId, @qty, @initQty,
                            @lot, @exp, @cost, @invId,
                            @diId, SYSUTCDATETIME(), 1, SYSUTCDATETIME()
                        )
                    `);

                    const stockId = stockRes.recordset[0].StockID;
                    receivedStocks.push({ stockId, medicineId: item.MedicineID, quantity: receivedQty, lotNumber: item.LotNumber });

                    // Write immutable ledger entry
                    const ledgerReq = new sql.Request(transaction);
                    ledgerReq.input('bgy', sql.NVarChar, barangayName);
                    ledgerReq.input('locId', sql.Int, locationId);
                    ledgerReq.input('stockId', sql.Int, stockId);
                    ledgerReq.input('medId', sql.Int, item.MedicineID);
                    ledgerReq.input('type', sql.NVarChar, 'RECEIPT');
                    ledgerReq.input('refNum', sql.NVarChar, dist.DistributionNumber);
                    ledgerReq.input('refId', sql.BigInt, distributionId);
                    ledgerReq.input('qty', sql.Int, receivedQty);
                    ledgerReq.input('batch', sql.NVarChar, item.LotNumber);
                    ledgerReq.input('exp', sql.Date, item.ExpiryDate);
                    ledgerReq.input('remarks', sql.NVarChar, `Received from Warehouse Distribution ${dist.DistributionNumber}${conf?.discrepancyReason ? ' | Discrepancy: ' + conf.discrepancyReason : ''}`);
                    ledgerReq.input('userId', sql.Int, userId);

                    await ledgerReq.query(`
                        INSERT INTO Barangay_InventoryTransactions (
                            BarangayName, LocationID, StockID, MedicineID, TransactionType,
                            ReferenceNumber, ReferenceID, Quantity, BatchNumber, ExpiryDate,
                            Remarks, CreatedBy, CreatedDate
                        )
                        VALUES (
                            @bgy, @locId, @stockId, @medId, @type,
                            @refNum, @refId, @qty, @batch, @exp,
                            @remarks, @userId, SYSUTCDATETIME()
                        )
                    `);
                }
            }

            // 5. Update Warehouse_Distributions status to Received
            const discRemarks = discrepancyNotes.join('; ');
            const finalRemarks = [dist.Remarks, payload.remarks, discRemarks].filter(Boolean).join(' | ');

            const updateDistReq = new sql.Request(transaction);
            updateDistReq.input('distId', sql.BigInt, distributionId);
            updateDistReq.input('userId', sql.Int, userId);
            updateDistReq.input('hasDisc', sql.Bit, hasDiscrepancy ? 1 : 0);
            updateDistReq.input('discRem', sql.NVarChar, discRemarks || null);
            updateDistReq.input('remarks', sql.NVarChar, finalRemarks || null);

            await updateDistReq.query(`
                UPDATE Warehouse_Distributions
                SET Status = 'Received',
                    ReceivedByUserID = @userId,
                    ReceivedDate = SYSUTCDATETIME(),
                    HasDiscrepancy = @hasDisc,
                    DiscrepancyRemarks = @discRem,
                    Remarks = @remarks,
                    ModifiedBy = @userId,
                    ModifiedDate = SYSUTCDATETIME()
                WHERE DistributionID = @distId
            `);

            // 6. Synchronize linked Warehouse_StockRequests status
            if (dist.ReferenceStockRequestID) {
                const srStatus = (hasDiscrepancy && totalAcceptedUnits < totalIssuedUnits) ? 'Partially Fulfilled' : 'Fulfilled';
                const updateSrReq = new sql.Request(transaction);
                updateSrReq.input('srId', sql.BigInt, dist.ReferenceStockRequestID);
                updateSrReq.input('srStatus', sql.NVarChar, srStatus);
                await updateSrReq.query(`
                    UPDATE Warehouse_StockRequests
                    SET Status = @srStatus, ModifiedDate = SYSUTCDATETIME()
                    WHERE StockRequestID = @srId
                `);
            }

            await transaction.commit();

            return {
                success: true,
                distributionId,
                distributionNumber: dist.DistributionNumber,
                status: 'Received',
                barangayName,
                locationId,
                hasDiscrepancy,
                discrepancyRemarks: discRemarks || null,
                itemsReceived: receivedStocks.length,
                receivedStocks
            };
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    }

    /**
     * Get live stock inventory for a Barangay.
     */
    static async getInventory(pool, userId, filters = {}) {
        const scope = await this.getUserScope(pool, userId);
        if (!scope.isElevated && filters.locationId && Number(filters.locationId) !== scope.locationId) {
            throw new Error('Access Denied: You cannot view inventory for another Barangay station.');
        }
        const req = pool.request();

        let query = `
            SELECT 
                s.StockID,
                s.BarangayName,
                s.LocationID,
                s.MedicineID,
                m.ProductName,
                m.GenericName,
                m.Dosage,
                m.Form,
                mc.CategoryName,
                s.LotNumber,
                s.ExpiryDate,
                s.Quantity,
                s.InitialQuantity,
                s.UnitCost,
                s.DateReceived,
                s.WarehouseInventoryID,
                s.DistributionItemID,
                DATEDIFF(day, GETDATE(), s.ExpiryDate) AS DaysToExpiry,
                DATEDIFF(day, GETDATE(), s.ExpiryDate) AS DaysUntilExpiry,
                CASE 
                    WHEN s.ExpiryDate <= GETDATE() THEN 'Expired'
                    WHEN DATEDIFF(day, GETDATE(), s.ExpiryDate) <= 30 THEN 'Critical'
                    WHEN DATEDIFF(day, GETDATE(), s.ExpiryDate) <= 90 THEN 'Warning'
                    ELSE 'Good'
                END AS ExpiryStatus,
                CASE 
                    WHEN s.ExpiryDate <= GETDATE() THEN 'Expired'
                    WHEN DATEDIFF(day, GETDATE(), s.ExpiryDate) <= 30 THEN 'Near Expiry'
                    ELSE 'Healthy'
                END AS StockStatus
            FROM Barangay_Stocks s
            INNER JOIN Medicines m ON s.MedicineID = m.MedicineID
            LEFT JOIN Medicine_Category mc ON m.CategoryID = mc.CategoryID
            WHERE s.IsActive = 1
        `;

        if (!scope.isElevated) {
            query += ' AND s.LocationID = @userLocId';
            req.input('userLocId', sql.Int, scope.locationId);
        } else if (filters.locationId) {
            query += ' AND s.LocationID = @filterLocId';
            req.input('filterLocId', sql.Int, Number(filters.locationId));
        }

        if (filters.search) {
            query += ' AND (m.ProductName LIKE @search OR m.GenericName LIKE @search OR s.LotNumber LIKE @search)';
            req.input('search', sql.NVarChar, `%${filters.search.trim()}%`);
        }

        query += ' ORDER BY s.ExpiryDate ASC, s.DateReceived ASC';

        const res = await req.query(query);
        return res.recordset;
    }

    /**
     * Get immutable stock movement ledger transactions for a Barangay.
     */
    static async getMovementLedger(pool, userId, filters = {}) {
        const scope = await this.getUserScope(pool, userId);
        if (!scope.isElevated && filters.locationId && Number(filters.locationId) !== scope.locationId) {
            throw new Error('Access Denied: You cannot view movements for another Barangay station.');
        }
        const req = pool.request();

        let query = `
            SELECT 
                tx.TransactionID,
                tx.BarangayName,
                tx.LocationID,
                tx.StockID,
                tx.MedicineID,
                m.ProductName,
                m.GenericName,
                tx.TransactionType,
                tx.ReferenceNumber,
                tx.ReferenceID,
                tx.Quantity,
                tx.BatchNumber,
                tx.ExpiryDate,
                tx.Remarks,
                tx.CreatedDate,
                u.FullName AS ActorName
            FROM Barangay_InventoryTransactions tx
            INNER JOIN Medicines m ON tx.MedicineID = m.MedicineID
            LEFT JOIN Users u ON tx.CreatedBy = u.UserID
            WHERE 1=1
        `;

        if (!scope.isElevated) {
            query += ' AND tx.LocationID = @userLocId';
            req.input('userLocId', sql.Int, scope.locationId);
        } else if (filters.locationId) {
            query += ' AND tx.LocationID = @filterLocId';
            req.input('filterLocId', sql.Int, Number(filters.locationId));
        }

        if (filters.search) {
            query += ' AND (m.ProductName LIKE @search OR tx.ReferenceNumber LIKE @search OR tx.BatchNumber LIKE @search)';
            req.input('search', sql.NVarChar, `%${filters.search.trim()}%`);
        }

        query += ' ORDER BY tx.CreatedDate DESC, tx.TransactionID DESC';

        const res = await req.query(query);
        return res.recordset;
    }

    /**
     * Atomically disburse medicine from Barangay inventory to a local patient.
     * Enforces FEFO batch allocation within the barangay's non-expired stock.
     */
    static async disburseMedicines(pool, userId, disbursementData) {
        const scope = await this.getUserScope(pool, userId);
        if (!scope.isElevated && disbursementData.locationId && Number(disbursementData.locationId) !== scope.locationId) {
            throw new Error('Access Denied: You cannot disburse stock for another Barangay station.');
        }
        const { patientId, recipientName, remarks, items = [] } = disbursementData;

        if (!recipientName || !recipientName.trim()) {
            throw new Error('Recipient / Patient name is required.');
        }

        if (!Array.isArray(items) || items.length === 0) {
            throw new Error('Disbursement must contain at least one medicine item.');
        }

        const locationId = scope.locationId;
        const barangayName = scope.barangay;

        if (!locationId) {
            throw new Error('User has no assigned Barangay location for disbursement.');
        }

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // Generate unique disbursement voucher number
            const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const countReq = new sql.Request(transaction);
            const countRes = await countReq.query(`
                SELECT COUNT(*) as count 
                FROM Barangay_Disbursements 
                WHERE DisbursementNumber LIKE 'BDS-${datePrefix}%'
            `);
            const seq = countRes.recordset[0].count + 1;
            const disbursementNumber = `BDS-${datePrefix}-${String(seq).padStart(4, '0')}`;

            // Insert Voucher Header
            const disbReq = new sql.Request(transaction);
            disbReq.input('num', sql.NVarChar, disbursementNumber);
            disbReq.input('bgy', sql.NVarChar, barangayName);
            disbReq.input('locId', sql.Int, locationId);
            disbReq.input('patId', sql.Int, patientId || null);
            disbReq.input('name', sql.NVarChar, recipientName.trim());
            disbReq.input('userId', sql.Int, userId);
            disbReq.input('remarks', sql.NVarChar, remarks || null);

            const disbRes = await disbReq.query(`
                INSERT INTO Barangay_Disbursements (
                    DisbursementNumber, BarangayName, LocationID, PatientID,
                    RecipientName, DisbursedByUserID, DisbursementDate, Status,
                    Remarks, CreatedDate
                )
                OUTPUT INSERTED.DisbursementID
                VALUES (
                    @num, @bgy, @locId, @patId,
                    @name, @userId, SYSUTCDATETIME(), 'Completed',
                    @remarks, SYSUTCDATETIME()
                )
            `);

            const disbursementId = disbRes.recordset[0].DisbursementID;
            const disbursedItems = [];

            // Process each item with FEFO allocation
            for (const item of items) {
                const medicineId = Number(item.medicineId);
                let neededQty = Number(item.quantity);

                if (neededQty <= 0) {
                    throw new Error('Disbursement quantity must be greater than 0.');
                }

                // Lock available non-expired stock for this medicine in this Barangay
                const stockReq = new sql.Request(transaction);
                stockReq.input('locId', sql.Int, locationId);
                stockReq.input('medId', sql.Int, medicineId);

                const stockRes = await stockReq.query(`
                    SELECT StockID, Quantity, LotNumber, ExpiryDate
                    FROM Barangay_Stocks WITH (UPDLOCK, ROWLOCK)
                    WHERE LocationID = @locId AND MedicineID = @medId AND Quantity > 0 AND IsActive = 1
                          AND ExpiryDate > GETDATE()
                    ORDER BY ExpiryDate ASC, DateReceived ASC, StockID ASC
                `);

                const availableBatches = stockRes.recordset;
                const totalAvailable = availableBatches.reduce((acc, b) => acc + b.Quantity, 0);

                if (totalAvailable < neededQty) {
                    throw new Error(`Insufficient non-expired stock in ${barangayName} for Medicine ID ${medicineId}. Available: ${totalAvailable}, Requested: ${neededQty}.`);
                }

                for (const batch of availableBatches) {
                    if (neededQty <= 0) break;

                    const deductQty = Math.min(batch.Quantity, neededQty);
                    neededQty -= deductQty;

                    // Deduct from Barangay_Stocks
                    const updateStockReq = new sql.Request(transaction);
                    updateStockReq.input('stockId', sql.Int, batch.StockID);
                    updateStockReq.input('deduct', sql.Int, deductQty);
                    await updateStockReq.query(`
                        UPDATE Barangay_Stocks
                        SET Quantity = Quantity - @deduct,
                            ModifiedDate = SYSUTCDATETIME()
                        WHERE StockID = @stockId
                    `);

                    // Record Disbursement Item
                    const itemReq = new sql.Request(transaction);
                    itemReq.input('disbId', sql.BigInt, disbursementId);
                    itemReq.input('stockId', sql.Int, batch.StockID);
                    itemReq.input('medId', sql.Int, medicineId);
                    itemReq.input('qty', sql.Int, deductQty);
                    itemReq.input('lot', sql.NVarChar, batch.LotNumber);
                    itemReq.input('dosage', sql.NVarChar, item.dosageInstructions || null);

                    await itemReq.query(`
                        INSERT INTO Barangay_DisbursementItems (
                            DisbursementID, StockID, MedicineID, Quantity, LotNumber, DosageInstructions
                        )
                        VALUES (
                            @disbId, @stockId, @medId, @qty, @lot, @dosage
                        )
                    `);

                    // Record negative transaction in immutable ledger
                    const ledgerReq = new sql.Request(transaction);
                    ledgerReq.input('bgy', sql.NVarChar, barangayName);
                    ledgerReq.input('locId', sql.Int, locationId);
                    ledgerReq.input('stockId', sql.Int, batch.StockID);
                    ledgerReq.input('medId', sql.Int, medicineId);
                    ledgerReq.input('type', sql.NVarChar, 'DISBURSEMENT');
                    ledgerReq.input('refNum', sql.NVarChar, disbursementNumber);
                    ledgerReq.input('refId', sql.BigInt, disbursementId);
                    ledgerReq.input('qty', sql.Int, -deductQty);
                    ledgerReq.input('batch', sql.NVarChar, batch.LotNumber);
                    ledgerReq.input('exp', sql.Date, batch.ExpiryDate);
                    ledgerReq.input('remarks', sql.NVarChar, `Disbursed to ${recipientName.trim()} (${disbursementNumber})`);
                    ledgerReq.input('userId', sql.Int, userId);

                    await ledgerReq.query(`
                        INSERT INTO Barangay_InventoryTransactions (
                            BarangayName, LocationID, StockID, MedicineID, TransactionType,
                            ReferenceNumber, ReferenceID, Quantity, BatchNumber, ExpiryDate,
                            Remarks, CreatedBy, CreatedDate
                        )
                        VALUES (
                            @bgy, @locId, @stockId, @medId, @type,
                            @refNum, @refId, @qty, @batch, @exp,
                            @remarks, @userId, SYSUTCDATETIME()
                        )
                    `);

                    disbursedItems.push({
                        stockId: batch.StockID,
                        medicineId,
                        quantity: deductQty,
                        lotNumber: batch.LotNumber
                    });
                }
            }

            await transaction.commit();

            return {
                success: true,
                disbursementId,
                disbursementNumber,
                barangayName,
                recipientName: recipientName.trim(),
                disbursedItems
            };
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    }

    /**
     * Get disbursements history for a Barangay.
     */
    static async getDisbursements(pool, userId, filters = {}) {
        const scope = await this.getUserScope(pool, userId);
        if (!scope.isElevated && filters.locationId && Number(filters.locationId) !== scope.locationId) {
            throw new Error('Access Denied: You cannot view disbursements for another Barangay station.');
        }
        const req = pool.request();

        let query = `
            SELECT 
                d.DisbursementID,
                d.DisbursementNumber,
                d.BarangayName,
                d.LocationID,
                d.PatientID,
                d.RecipientName,
                d.DisbursementDate,
                d.Status,
                d.Remarks,
                u.FullName AS DisbursedByName,
                (SELECT COUNT(*) FROM Barangay_DisbursementItems di WHERE di.DisbursementID = d.DisbursementID) AS TotalLineItems,
                (SELECT COALESCE(SUM(Quantity), 0) FROM Barangay_DisbursementItems di WHERE di.DisbursementID = d.DisbursementID) AS TotalQuantity
            FROM Barangay_Disbursements d
            LEFT JOIN Users u ON d.DisbursedByUserID = u.UserID
            WHERE 1=1
        `;

        if (!scope.isElevated) {
            query += ' AND d.LocationID = @userLocId';
            req.input('userLocId', sql.Int, scope.locationId);
        } else if (filters.locationId) {
            query += ' AND d.LocationID = @filterLocId';
            req.input('filterLocId', sql.Int, Number(filters.locationId));
        }

        if (filters.search) {
            query += ' AND (d.RecipientName LIKE @search OR d.DisbursementNumber LIKE @search)';
            req.input('search', sql.NVarChar, `%${filters.search.trim()}%`);
        }

        query += ' ORDER BY d.DisbursementDate DESC';

        const res = await req.query(query);
        return res.recordset;
    }

    /**
     * Get single disbursement details with line items for voucher rendering.
     */
    static async getDisbursementDetails(pool, disbursementId, userId) {
        const scope = await this.getUserScope(pool, userId);
        const req = pool.request();
        req.input('disbId', sql.BigInt, disbursementId);

        const res = await req.query(`
            SELECT 
                d.DisbursementID,
                d.DisbursementNumber,
                d.BarangayName,
                d.LocationID,
                d.PatientID,
                d.RecipientName,
                d.DisbursementDate,
                d.Status,
                d.Remarks,
                d.ReversalReason,
                d.ReversedDate,
                u.FullName AS DisbursedByName,
                revU.FullName AS ReversedByName
            FROM Barangay_Disbursements d
            LEFT JOIN Users u ON d.DisbursedByUserID = u.UserID
            LEFT JOIN Users revU ON d.ReversedByUserID = revU.UserID
            WHERE d.DisbursementID = @disbId
        `);

        if (res.recordset.length === 0) {
            throw new Error('Disbursement record not found.');
        }

        const disbursement = res.recordset[0];
        if (!scope.isElevated && disbursement.LocationID !== scope.locationId) {
            throw new Error('Access Denied: You cannot view disbursement vouchers for another Barangay station.');
        }

        const itemsReq = pool.request();
        itemsReq.input('disbId', sql.BigInt, disbursementId);
        const itemsRes = await itemsReq.query(`
            SELECT 
                di.DetailID AS DisbursementItemID,
                di.DetailID,
                di.DisbursementID,
                di.StockID,
                di.MedicineID,
                di.Quantity,
                di.LotNumber,
                di.DosageInstructions,
                m.ProductName,
                m.GenericName,
                m.Dosage,
                m.Form,
                s.ExpiryDate
            FROM Barangay_DisbursementItems di
            LEFT JOIN Medicines m ON di.MedicineID = m.MedicineID
            LEFT JOIN Barangay_Stocks s ON di.StockID = s.StockID
            WHERE di.DisbursementID = @disbId
        `);

        return {
            disbursement,
            items: itemsRes.recordset
        };
    }

    /**
     * End-to-End Traceability Query:
     * Traces a specific Lot Number from Inbound DR -> Warehouse Lot -> Stock Request -> Distribution -> Pharmacy/Barangay Receipt -> Patient Dispensing/Disbursement!
     */
    static async getTraceabilityByLot(pool, lotNumber) {
        if (!lotNumber || !lotNumber.trim()) {
            throw new Error('Lot number is required for traceability lookup.');
        }

        const lot = lotNumber.trim();
        const req = pool.request();
        req.input('lot', sql.NVarChar, lot);

        // 1. Warehouse Inventory Lot
        const whRes = await req.query(`
            SELECT 
                wi.InventoryID,
                wi.LocationID,
                loc.LocationName,
                wi.MedicineID,
                m.ProductName,
                m.GenericName,
                m.Dosage,
                m.Form,
                wi.LotNumber,
                wi.ExpiryDate,
                wi.QuantityReceived,
                wi.QuantityAvailable,
                wi.ReservedQuantity,
                wi.Status AS LotStatus,
                wi.CreatedDate AS IngestedDate,
                dr.ReferenceNumber AS DRNumber,
                dr.DeliveryDate,
                supp.SupplierName
            FROM Warehouse_Inventory wi
            INNER JOIN Medicines m ON wi.MedicineID = m.MedicineID
            LEFT JOIN Warehouse_Locations loc ON wi.LocationID = loc.LocationID
            LEFT JOIN Warehouse_DeliveryReceiptItems dri ON wi.SourceDeliveryReceiptItemID = dri.DeliveryReceiptItemID
            LEFT JOIN Warehouse_DeliveryReceipts dr ON dri.DeliveryReceiptID = dr.DeliveryReceiptID
            LEFT JOIN Warehouse_Suppliers supp ON dr.SupplierID = supp.SupplierID
            WHERE wi.LotNumber = @lot
        `);

        // 2. Distributions of this lot
        const distReq = pool.request();
        distReq.input('lot', sql.NVarChar, lot);
        const distRes = await distReq.query(`
            SELECT 
                d.DistributionID,
                d.DistributionNumber,
                d.ReferenceStockRequestID,
                sr.RequestNumber AS StockRequestNumber,
                d.SourceLocationID,
                srcLoc.LocationName AS SourceLocationName,
                d.DestinationLocationID,
                destLoc.LocationName AS DestinationLocationName,
                d.ReleasedDate,
                d.ReceivedDate,
                d.Status AS DistributionStatus,
                d.HasDiscrepancy,
                d.DiscrepancyRemarks,
                relUser.FullName AS ReleasedByName,
                recUser.FullName AS ReceivedByName,
                di.Quantity AS QuantityIssued,
                di.ReceivedQuantity
            FROM Warehouse_DistributionItems di
            INNER JOIN Warehouse_Distributions d ON di.DistributionID = d.DistributionID
            INNER JOIN Warehouse_Inventory wi ON di.InventoryID = wi.InventoryID
            LEFT JOIN Warehouse_StockRequests sr ON d.ReferenceStockRequestID = sr.StockRequestID
            LEFT JOIN Warehouse_Locations srcLoc ON d.SourceLocationID = srcLoc.LocationID
            LEFT JOIN Warehouse_Locations destLoc ON d.DestinationLocationID = destLoc.LocationID
            LEFT JOIN Users relUser ON d.ReleasedByUserID = relUser.UserID
            LEFT JOIN Users recUser ON d.ReceivedByUserID = recUser.UserID
            WHERE wi.LotNumber = @lot AND di.IsDeleted = 0
            ORDER BY d.ReleasedDate DESC
        `);

        // 3. Pharmacy Stock & Dispensing
        const pharStockReq = pool.request();
        pharStockReq.input('lot', sql.NVarChar, lot);
        const pharStockRes = await pharStockReq.query(`
            SELECT 
                StockID, Quantity AS CurrentPharmacyQuantity, InitialQuantity, DateReceived, Price
            FROM Pharmacy_Stocks
            WHERE LotNumber = @lot AND IsActive = 1
        `);

        const pharSalesReq = pool.request();
        pharSalesReq.input('lot', sql.NVarChar, lot);
        const pharSalesRes = await pharSalesReq.query(`
            SELECT 
                s.SaleID, s.DispenseNumber, s.SaleDate, s.Status,
                p.FullName AS PatientName, p.Barangay AS PatientBarangay,
                sd.Quantity AS QuantityDispensed, sd.Price
            FROM Pharmacy_Sales_Details sd
            INNER JOIN Pharmacy_Sales s ON sd.SaleID = s.SaleID
            LEFT JOIN Patients p ON s.PatientID = p.PatientID
            WHERE sd.LotNumber = @lot
            ORDER BY s.SaleDate DESC
        `);

        // 4. Barangay Stock & Disbursements
        const bgyStockReq = pool.request();
        bgyStockReq.input('lot', sql.NVarChar, lot);
        const bgyStockRes = await bgyStockReq.query(`
            SELECT 
                StockID, BarangayName, LocationID, Quantity AS CurrentBarangayQuantity,
                InitialQuantity, DateReceived
            FROM Barangay_Stocks
            WHERE LotNumber = @lot AND IsActive = 1
        `);

        const bgyDisbReq = pool.request();
        bgyDisbReq.input('lot', sql.NVarChar, lot);
        const bgyDisbRes = await bgyDisbReq.query(`
            SELECT 
                d.DisbursementID, d.DisbursementNumber, d.BarangayName, d.RecipientName,
                d.DisbursementDate, d.Status, di.Quantity AS QuantityDisbursed, di.DosageInstructions
            FROM Barangay_DisbursementItems di
            INNER JOIN Barangay_Disbursements d ON di.DisbursementID = d.DisbursementID
            WHERE di.LotNumber = @lot
            ORDER BY d.DisbursementDate DESC
        `);

        // Calculate reconciled balances
        const whLots = whRes.recordset;
        const totalReceivedInWarehouse = whLots.reduce((acc, l) => acc + l.QuantityReceived, 0);
        const currentInWarehouse = whLots.reduce((acc, l) => acc + l.QuantityAvailable, 0);
        const currentInPharmacy = pharStockRes.recordset.reduce((acc, s) => acc + s.CurrentPharmacyQuantity, 0);
        const currentInBarangays = bgyStockRes.recordset.reduce((acc, s) => acc + s.CurrentBarangayQuantity, 0);
        const totalDispensedInPharmacy = pharSalesRes.recordset.reduce((acc, s) => acc + s.QuantityDispensed, 0);
        const totalDisbursedInBarangays = bgyDisbRes.recordset.reduce((acc, d) => acc + d.QuantityDisbursed, 0);

        return {
            lotNumber: lot,
            warehouseLots: whLots,
            distributions: distRes.recordset,
            pharmacyStock: pharStockRes.recordset,
            pharmacyDispensing: pharSalesRes.recordset,
            barangayStock: bgyStockRes.recordset,
            barangayDisbursements: bgyDisbRes.recordset,
            reconciliationSummary: {
                totalReceivedInWarehouse,
                currentInWarehouse,
                currentInPharmacy,
                currentInBarangays,
                totalDispensedInPharmacy,
                totalDisbursedInBarangays,
                totalAccounted: currentInWarehouse + currentInPharmacy + currentInBarangays + totalDispensedInPharmacy + totalDisbursedInBarangays
            }
        };
    }

    /**
     * Atomically reverse a completed Barangay Disbursement.
     * Restores stock quantities to Barangay_Stocks and writes immutable REVERSAL ledger transactions.
     * Prevents duplicate reversals and requires an audit reason.
     */
    static async reverseDisbursement(pool, disbursementId, userId, reason) {
        if (!reason || !reason.trim()) {
            throw new Error('A documented reason is mandatory to reverse a patient disbursement.');
        }

        const scope = await this.getUserScope(pool, userId);
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // Lock and fetch disbursement header
            const disbReq = new sql.Request(transaction);
            disbReq.input('disbId', sql.BigInt, disbursementId);
            const disbRes = await disbReq.query(`
                SELECT * FROM Barangay_Disbursements WITH (UPDLOCK, ROWLOCK)
                WHERE DisbursementID = @disbId
            `);

            if (disbRes.recordset.length === 0) {
                throw new Error(`Disbursement record ID ${disbursementId} not found.`);
            }

            const disb = disbRes.recordset[0];

            if (disb.Status === 'Reversed' || disb.Status === 'Cancelled') {
                throw new Error(`Disbursement ${disb.DisbursementNumber} has already been reversed.`);
            }

            // Enforce location authorization
            if (!scope.isElevated && disb.LocationID !== scope.locationId) {
                throw new Error('Access Denied: You cannot reverse disbursements from another Barangay.');
            }

            // Fetch disbursement line items
            const itemsReq = new sql.Request(transaction);
            itemsReq.input('disbId', sql.BigInt, disbursementId);
            const itemsRes = await itemsReq.query(`
                SELECT di.*, s.MedicineID AS OriginalMedicineID
                FROM Barangay_DisbursementItems di
                LEFT JOIN Barangay_Stocks s ON di.StockID = s.StockID
                WHERE di.DisbursementID = @disbId
            `);

            if (itemsRes.recordset.length === 0) {
                throw new Error(`No line items found for disbursement ${disb.DisbursementNumber}.`);
            }

            // Atomically restore stock and write REVERSAL ledger for each item
            for (const item of itemsRes.recordset) {
                // Restore stock in Barangay_Stocks
                const restoreStockReq = new sql.Request(transaction);
                restoreStockReq.input('stockId', sql.Int, item.StockID);
                restoreStockReq.input('qty', sql.Int, item.Quantity);
                await restoreStockReq.query(`
                    UPDATE Barangay_Stocks
                    SET Quantity = Quantity + @qty,
                        ModifiedDate = SYSUTCDATETIME()
                    WHERE StockID = @stockId
                `);

                // Write immutable ledger entry
                const ledgerReq = new sql.Request(transaction);
                ledgerReq.input('bgy', sql.NVarChar, disb.BarangayName);
                ledgerReq.input('locId', sql.Int, disb.LocationID);
                ledgerReq.input('stockId', sql.Int, item.StockID);
                ledgerReq.input('medId', sql.Int, item.MedicineID);
                ledgerReq.input('type', sql.NVarChar, 'REVERSAL');
                ledgerReq.input('refNum', sql.NVarChar, disb.DisbursementNumber);
                ledgerReq.input('refId', sql.BigInt, disbursementId);
                ledgerReq.input('qty', sql.Int, item.Quantity); // Positive restoration
                ledgerReq.input('batch', sql.NVarChar, item.LotNumber);
                ledgerReq.input('exp', sql.Date, item.ExpiryDate);
                ledgerReq.input('remarks', sql.NVarChar, `Reversal of disbursement ${disb.DisbursementNumber}. Reason: ${reason.trim()}`);
                ledgerReq.input('userId', sql.Int, userId);

                await ledgerReq.query(`
                    INSERT INTO Barangay_InventoryTransactions (
                        BarangayName, LocationID, StockID, MedicineID, TransactionType,
                        ReferenceNumber, ReferenceID, Quantity, BatchNumber, ExpiryDate,
                        Remarks, CreatedBy, CreatedDate
                    )
                    VALUES (
                        @bgy, @locId, @stockId, @medId, @type,
                        @refNum, @refId, @qty, @batch, @exp,
                        @remarks, @userId, SYSUTCDATETIME()
                    )
                `);
            }

            // Update Disbursement Header to Reversed
            const updateDisbReq = new sql.Request(transaction);
            updateDisbReq.input('disbId', sql.BigInt, disbursementId);
            updateDisbReq.input('userId', sql.Int, userId);
            updateDisbReq.input('reason', sql.NVarChar, reason.trim());

            await updateDisbReq.query(`
                UPDATE Barangay_Disbursements
                SET Status = 'Reversed',
                    ReversedByUserID = @userId,
                    ReversedDate = SYSUTCDATETIME(),
                    ReversalReason = @reason
                WHERE DisbursementID = @disbId
            `);

            await transaction.commit();

            return {
                success: true,
                disbursementId,
                disbursementNumber: disb.DisbursementNumber,
                status: 'Reversed',
                itemsReversed: itemsRes.recordset.length,
                reason: reason.trim()
            };
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    }
}

module.exports = BarangayService;
