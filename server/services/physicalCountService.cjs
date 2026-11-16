const sql = require('mssql');

/**
 * Service for Warehouse Physical Inventory Counts and Stock Adjustments
 */
class PhysicalCountService {
    /**
     * Create a new Physical Inventory Count session
     * Snapshots the current live inventory baseline.
     */
    static async createCountSession(pool, data, userId = 1) {
        const { CountDate, LocationID, Remarks, items } = data;
        const datePrefix = (CountDate || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
        
        // Generate unique CountNumber: PIC-YYYYMMDD-XXXX
        const countRes = await pool.request().query("SELECT COUNT(*) as cnt FROM Warehouse_PhysicalInventoryCounts");
        const countNumber = `PIC-${datePrefix}-${String(countRes.recordset[0].cnt + 1).padStart(4, '0')}`;

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // 1. Insert header
            const headerReq = new sql.Request(transaction);
            headerReq.input('CountNumber', sql.NVarChar, countNumber);
            headerReq.input('CountDate', sql.Date, CountDate || new Date());
            headerReq.input('LocationID', sql.Int, LocationID || null);
            headerReq.input('Remarks', sql.NVarChar, Remarks || null);
            headerReq.input('CreatedBy', sql.Int, userId);

            const insertHeaderRes = await headerReq.query(`
                INSERT INTO Warehouse_PhysicalInventoryCounts (
                    CountNumber, CountDate, LocationID, Status, Remarks,
                    BaselineDate, CreatedBy, CreatedDate,
                    TotalItemsCounted, TotalDiscrepancies, TotalSystemQuantity,
                    TotalPhysicalQuantity, TotalVarianceQuantity
                )
                OUTPUT INSERTED.CountID
                VALUES (
                    @CountNumber, @CountDate, @LocationID, 'Draft', @Remarks,
                    SYSUTCDATETIME(), @CreatedBy, SYSUTCDATETIME(),
                    0, 0, 0, 0, 0
                )
            `);
            const countId = insertHeaderRes.recordset[0].CountID;

            // 2. Determine batches to include
            let batchesToCount = [];
            if (items && Array.isArray(items) && items.length > 0) {
                // Specific items provided
                for (const item of items) {
                    const bReq = new sql.Request(transaction);
                    bReq.input('InventoryID', sql.BigInt, item.InventoryID);
                    const bRes = await bReq.query(`
                        SELECT InventoryID, MedicineID, QuantityAvailable, UnitCost
                        FROM Warehouse_Inventory
                        WHERE InventoryID = @InventoryID AND IsDeleted = 0
                    `);
                    if (bRes.recordset.length > 0) {
                        const b = bRes.recordset[0];
                        batchesToCount.push({
                            InventoryID: b.InventoryID,
                            MedicineID: b.MedicineID,
                            SystemQuantity: Number(b.QuantityAvailable || 0),
                            PhysicalQuantity: item.PhysicalQuantity !== undefined ? Number(item.PhysicalQuantity) : Number(b.QuantityAvailable || 0),
                            UnitCostAtBaseline: Number(b.UnitCost || 0),
                            DiscrepancyReason: item.DiscrepancyReason || null,
                            Notes: item.Notes || null
                        });
                    }
                }
            } else {
                // Default: Snapshot all active batches in the selected location (or all warehouse)
                const allBatchesReq = new sql.Request(transaction);
                let query = `
                    SELECT InventoryID, MedicineID, QuantityAvailable, UnitCost
                    FROM Warehouse_Inventory
                    WHERE IsDeleted = 0 AND Status = 'Active'
                `;
                if (LocationID) {
                    allBatchesReq.input('LocID', sql.Int, LocationID);
                    query += ` AND LocationID = @LocID`;
                }
                const allBatchesRes = await allBatchesReq.query(query);
                batchesToCount = allBatchesRes.recordset.map(b => ({
                    InventoryID: b.InventoryID,
                    MedicineID: b.MedicineID,
                    SystemQuantity: Number(b.QuantityAvailable || 0),
                    PhysicalQuantity: Number(b.QuantityAvailable || 0), // Initialized to system count
                    UnitCostAtBaseline: Number(b.UnitCost || 0),
                    DiscrepancyReason: null,
                    Notes: null
                }));
            }

            // 3. Insert count line items
            let totalSysQty = 0;
            let totalPhysQty = 0;
            let totalVariance = 0;
            let totalDiscrepancies = 0;

            for (const item of batchesToCount) {
                const variance = item.PhysicalQuantity - item.SystemQuantity;
                const varianceVal = variance * item.UnitCostAtBaseline;
                if (variance !== 0) totalDiscrepancies++;
                totalSysQty += item.SystemQuantity;
                totalPhysQty += item.PhysicalQuantity;
                totalVariance += variance;

                const itemReq = new sql.Request(transaction);
                itemReq.input('CountID', sql.BigInt, countId);
                itemReq.input('InventoryID', sql.BigInt, item.InventoryID);
                itemReq.input('MedicineID', sql.Int, item.MedicineID);
                itemReq.input('SystemQuantity', sql.Int, item.SystemQuantity);
                itemReq.input('PhysicalQuantity', sql.Int, item.PhysicalQuantity);
                itemReq.input('VarianceQuantity', sql.Int, variance);
                itemReq.input('UnitCostAtBaseline', sql.Decimal(18, 2), item.UnitCostAtBaseline);
                itemReq.input('VarianceValue', sql.Decimal(18, 2), varianceVal);
                itemReq.input('DiscrepancyReason', sql.NVarChar, item.DiscrepancyReason);
                itemReq.input('Notes', sql.NVarChar, item.Notes);

                await itemReq.query(`
                    INSERT INTO Warehouse_PhysicalInventoryCountItems (
                        CountID, InventoryID, MedicineID, SystemQuantity,
                        PhysicalQuantity, VarianceQuantity, UnitCostAtBaseline,
                        VarianceValue, DiscrepancyReason, Notes,
                        InterveningMovementsDetected, IsAdjusted, CreatedDate, IsDeleted
                    ) VALUES (
                        @CountID, @InventoryID, @MedicineID, @SystemQuantity,
                        @PhysicalQuantity, @VarianceQuantity, @UnitCostAtBaseline,
                        @VarianceValue, @DiscrepancyReason, @Notes,
                        0, 0, SYSUTCDATETIME(), 0
                    )
                `);
            }

            // 4. Update header totals
            const updateHReq = new sql.Request(transaction);
            updateHReq.input('CountID', sql.BigInt, countId);
            updateHReq.input('ItemsCounted', sql.Int, batchesToCount.length);
            updateHReq.input('Discrepancies', sql.Int, totalDiscrepancies);
            updateHReq.input('TotalSys', sql.Int, totalSysQty);
            updateHReq.input('TotalPhys', sql.Int, totalPhysQty);
            updateHReq.input('TotalVar', sql.Int, totalVariance);

            await updateHReq.query(`
                UPDATE Warehouse_PhysicalInventoryCounts
                SET TotalItemsCounted = @ItemsCounted,
                    TotalDiscrepancies = @Discrepancies,
                    TotalSystemQuantity = @TotalSys,
                    TotalPhysicalQuantity = @TotalPhys,
                    TotalVarianceQuantity = @TotalVar
                WHERE CountID = @CountID
            `);

            await transaction.commit();
            return { success: true, id: countId, countNumber: countNumber, totalItems: batchesToCount.length };
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    }

    /**
     * Retrieve count sessions with filtering
     */
    static async getCountSessions(pool, filters = {}) {
        const { status, search, limit = 50, offset = 0 } = filters;
        const req = pool.request();
        let query = `
            SELECT 
                C.CountID,
                C.CountNumber,
                C.CountDate,
                C.LocationID,
                COALESCE(L.LocationName, 'Main Warehouse') as LocationName,
                C.Status,
                C.Remarks,
                C.BaselineDate,
                C.CreatedBy,
                COALESCE(UC.FullName, UC.Username, 'System') as CreatedByName,
                C.CreatedDate,
                C.SubmittedBy,
                COALESCE(US.FullName, US.Username) as SubmittedByName,
                C.SubmittedDate,
                C.ReviewedBy,
                COALESCE(UR.FullName, UR.Username) as ReviewedByName,
                C.ReviewedDate,
                C.ReviewNotes,
                C.RejectionReason,
                C.PostedBy,
                COALESCE(UP.FullName, UP.Username) as PostedByName,
                C.PostedDate,
                C.TotalItemsCounted,
                C.TotalDiscrepancies,
                C.TotalSystemQuantity,
                C.TotalPhysicalQuantity,
                C.TotalVarianceQuantity
            FROM Warehouse_PhysicalInventoryCounts C
            LEFT JOIN Warehouse_Locations L ON C.LocationID = L.LocationID
            LEFT JOIN Users UC ON C.CreatedBy = UC.UserID
            LEFT JOIN Users US ON C.SubmittedBy = US.UserID
            LEFT JOIN Users UR ON C.ReviewedBy = UR.UserID
            LEFT JOIN Users UP ON C.PostedBy = UP.UserID
            WHERE C.IsDeleted = 0
        `;

        if (status && status !== 'All') {
            req.input('Status', sql.NVarChar, status);
            query += ` AND C.Status = @Status`;
        }
        if (search) {
            req.input('Search', sql.NVarChar, `%${search}%`);
            query += ` AND (C.CountNumber LIKE @Search OR C.Remarks LIKE @Search)`;
        }

        query += ` ORDER BY C.CreatedDate DESC OFFSET ${Number(offset)} ROWS FETCH NEXT ${Number(limit)} ROWS ONLY`;
        const result = await req.query(query);
        return result.recordset;
    }

    /**
     * Retrieve single count session with line items and intervening movement analysis
     */
    static async getCountDetails(pool, countId) {
        const hReq = pool.request();
        hReq.input('CountID', sql.BigInt, countId);
        const hRes = await hReq.query(`
            SELECT 
                C.*,
                COALESCE(L.LocationName, 'Main Warehouse') as LocationName,
                COALESCE(UC.FullName, UC.Username, 'System') as CreatedByName,
                COALESCE(US.FullName, US.Username) as SubmittedByName,
                COALESCE(UR.FullName, UR.Username) as ReviewedByName,
                COALESCE(UP.FullName, UP.Username) as PostedByName
            FROM Warehouse_PhysicalInventoryCounts C
            LEFT JOIN Warehouse_Locations L ON C.LocationID = L.LocationID
            LEFT JOIN Users UC ON C.CreatedBy = UC.UserID
            LEFT JOIN Users US ON C.SubmittedBy = US.UserID
            LEFT JOIN Users UR ON C.ReviewedBy = UR.UserID
            LEFT JOIN Users UP ON C.PostedBy = UP.UserID
            WHERE C.CountID = @CountID AND C.IsDeleted = 0
        `);
        if (hRes.recordset.length === 0) return null;
        const header = hRes.recordset[0];

        // Line items with live batch details and intervening movements
        const itemsReq = pool.request();
        itemsReq.input('CountID', sql.BigInt, countId);
        itemsReq.input('BaselineDate', sql.DateTime2, header.BaselineDate);
        const itemsRes = await itemsReq.query(`
            SELECT 
                CI.CountItemID,
                CI.CountID,
                CI.InventoryID,
                CI.MedicineID,
                M.ProductName,
                M.GenericName,
                M.MedicineCode,
                I.BatchNumber,
                I.LotNumber,
                I.ExpiryDate,
                I.QuantityAvailable as CurrentLiveQuantity,
                CI.SystemQuantity,
                CI.PhysicalQuantity,
                CI.VarianceQuantity,
                CI.UnitCostAtBaseline,
                CI.VarianceValue,
                CI.DiscrepancyReason,
                CI.Notes,
                CI.IsAdjusted,
                CI.AdjustmentTransactionID,
                (
                    SELECT COUNT(*)
                    FROM Warehouse_InventoryTransactions TX
                    WHERE TX.InventoryID = CI.InventoryID AND TX.CreatedDate > @BaselineDate
                ) as InterveningMovementsCount
            FROM Warehouse_PhysicalInventoryCountItems CI
            JOIN Warehouse_Medicines M ON CI.MedicineID = M.MedicineID
            JOIN Warehouse_Inventory I ON CI.InventoryID = I.InventoryID
            WHERE CI.CountID = @CountID AND CI.IsDeleted = 0
            ORDER BY M.ProductName ASC, I.ExpiryDate ASC
        `);

        return {
            ...header,
            items: itemsRes.recordset
        };
    }

    /**
     * Update count items while in Draft or In Progress
     */
    static async updateCountItems(pool, countId, items, remarks = null, userId = 1) {
        // 1. Verify current status
        const chkReq = pool.request();
        chkReq.input('CountID', sql.BigInt, countId);
        const chkRes = await chkReq.query("SELECT Status FROM Warehouse_PhysicalInventoryCounts WHERE CountID = @CountID AND IsDeleted = 0");
        if (chkRes.recordset.length === 0) throw new Error("Count session not found.");
        const currentStatus = chkRes.recordset[0].Status;
        if (!['Draft', 'In Progress', 'Rejected'].includes(currentStatus)) {
            throw new Error(`Count session is in status "${currentStatus}" and cannot be modified.`);
        }

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            let totalSys = 0;
            let totalPhys = 0;
            let totalVar = 0;
            let totalDisc = 0;

            for (const item of items) {
                const uReq = new sql.Request(transaction);
                uReq.input('CountItemID', sql.BigInt, item.CountItemID);
                uReq.input('PhysicalQuantity', sql.Int, item.PhysicalQuantity);
                uReq.input('DiscrepancyReason', sql.NVarChar, item.DiscrepancyReason || null);
                uReq.input('Notes', sql.NVarChar, item.Notes || null);

                const itemRowRes = await uReq.query(`
                    UPDATE Warehouse_PhysicalInventoryCountItems
                    SET PhysicalQuantity = @PhysicalQuantity,
                        VarianceQuantity = @PhysicalQuantity - SystemQuantity,
                        VarianceValue = (@PhysicalQuantity - SystemQuantity) * UnitCostAtBaseline,
                        DiscrepancyReason = @DiscrepancyReason,
                        Notes = @Notes,
                        ModifiedDate = SYSUTCDATETIME()
                    OUTPUT INSERTED.SystemQuantity, INSERTED.PhysicalQuantity, INSERTED.VarianceQuantity
                    WHERE CountItemID = @CountItemID
                `);

                if (itemRowRes.recordset.length > 0) {
                    const row = itemRowRes.recordset[0];
                    totalSys += row.SystemQuantity;
                    totalPhys += row.PhysicalQuantity;
                    totalVar += row.VarianceQuantity;
                    if (row.VarianceQuantity !== 0) totalDisc++;
                }
            }

            // Update header to In Progress
            const hReq = new sql.Request(transaction);
            hReq.input('CountID', sql.BigInt, countId);
            hReq.input('TotalDisc', sql.Int, totalDisc);
            hReq.input('TotalPhys', sql.Int, totalPhys);
            hReq.input('TotalVar', sql.Int, totalVar);
            hReq.input('Remarks', sql.NVarChar, remarks);

            await hReq.query(`
                UPDATE Warehouse_PhysicalInventoryCounts
                SET Status = CASE WHEN Status = 'Draft' THEN 'In Progress' ELSE Status END,
                    TotalDiscrepancies = @TotalDisc,
                    TotalPhysicalQuantity = @TotalPhys,
                    TotalVarianceQuantity = @TotalVar,
                    Remarks = COALESCE(@Remarks, Remarks)
                WHERE CountID = @CountID
            `);

            await transaction.commit();
            return { success: true, countId };
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    }

    /**
     * Submit count for review
     */
    static async submitCount(pool, countId, userId = 1) {
        const details = await this.getCountDetails(pool, countId);
        if (!details) throw new Error("Count session not found.");
        if (!['Draft', 'In Progress', 'Rejected'].includes(details.Status)) {
            throw new Error(`Only Draft, In Progress, or Rejected counts can be submitted. Current status: ${details.Status}`);
        }

        // Validate that all items with discrepancies have a documented reason
        const unreasonedItems = (details.items || []).filter(item => item.VarianceQuantity !== 0 && (!item.DiscrepancyReason || item.DiscrepancyReason.trim() === ''));
        if (unreasonedItems.length > 0) {
            throw new Error(`Cannot submit: ${unreasonedItems.length} line item(s) have discrepancies without a documented reason.`);
        }

        const req = pool.request();
        req.input('CountID', sql.BigInt, countId);
        req.input('UserID', sql.Int, userId);
        await req.query(`
            UPDATE Warehouse_PhysicalInventoryCounts
            SET Status = 'Submitted',
                SubmittedBy = @UserID,
                SubmittedDate = SYSUTCDATETIME()
            WHERE CountID = @CountID
        `);

        return { success: true, status: 'Submitted' };
    }

    /**
     * Approve count
     * Enforces separation of duties (creator cannot approve their own count).
     */
    static async approveCount(pool, countId, userId = 1, reviewNotes = '') {
        const details = await this.getCountDetails(pool, countId);
        if (!details) throw new Error("Count session not found.");
        if (details.Status !== 'Submitted') {
            throw new Error(`Only Submitted counts can be approved. Current status: ${details.Status}`);
        }

        // Separation of duties: Prevent user from approving their own count
        if (Number(details.CreatedBy) === Number(userId)) {
            throw new Error("Separation of duties violation: You cannot approve a physical count you initiated.");
        }

        // Validate that all discrepancy items have documented reasons
        const unreasonedItems = (details.items || []).filter(item => item.VarianceQuantity !== 0 && (!item.DiscrepancyReason || item.DiscrepancyReason.trim() === ''));
        if (unreasonedItems.length > 0) {
            throw new Error(`Cannot approve: ${unreasonedItems.length} line item(s) have unexplained variances.`);
        }

        const req = pool.request();
        req.input('CountID', sql.BigInt, countId);
        req.input('UserID', sql.Int, userId);
        req.input('ReviewNotes', sql.NVarChar, reviewNotes || 'Count approved for stock adjustment');
        await req.query(`
            UPDATE Warehouse_PhysicalInventoryCounts
            SET Status = 'Approved',
                ReviewedBy = @UserID,
                ReviewedDate = SYSUTCDATETIME(),
                ReviewNotes = @ReviewNotes
            WHERE CountID = @CountID
        `);

        return { success: true, status: 'Approved' };
    }

    /**
     * Reject count with mandatory rejection reason
     */
    static async rejectCount(pool, countId, userId = 1, rejectionReason) {
        if (!rejectionReason || rejectionReason.trim() === '') {
            throw new Error("A clear rejection reason is required to reject a submitted count.");
        }

        const details = await this.getCountDetails(pool, countId);
        if (!details) throw new Error("Count session not found.");
        if (details.Status !== 'Submitted') {
            throw new Error(`Only Submitted counts can be rejected. Current status: ${details.Status}`);
        }

        const req = pool.request();
        req.input('CountID', sql.BigInt, countId);
        req.input('UserID', sql.Int, userId);
        req.input('RejectionReason', sql.NVarChar, rejectionReason.trim());
        await req.query(`
            UPDATE Warehouse_PhysicalInventoryCounts
            SET Status = 'In Progress',
                RejectionReason = @RejectionReason,
                ReviewedBy = @UserID,
                ReviewedDate = SYSUTCDATETIME()
            WHERE CountID = @CountID
        `);

        return { success: true, status: 'In Progress', rejectionReason };
    }

    /**
     * Transactional Posting of Stock Adjustments (ACID, Pessimistic Row Lock, Ledger Logging)
     */
    static async postAdjustment(pool, countId, userId = 1) {
        const details = await this.getCountDetails(pool, countId);
        if (!details) throw new Error("Count session not found.");
        if (details.Status === 'Posted') {
            throw new Error("Count is already Posted. Repeated posting is strictly prohibited.");
        }
        if (details.Status !== 'Approved') {
            throw new Error(`Only Approved counts can be posted. Current status: ${details.Status}`);
        }

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // 1. Lock Count Header in Approved status
            const lockHReq = new sql.Request(transaction);
            lockHReq.input('CountID', sql.BigInt, countId);
            const lockHRes = await lockHReq.query(`
                SELECT CountID, CountNumber, Status, BaselineDate
                FROM Warehouse_PhysicalInventoryCounts WITH (UPDLOCK, HOLDLOCK)
                WHERE CountID = @CountID
            `);
            if (lockHRes.recordset.length === 0 || lockHRes.recordset[0].Status !== 'Approved') {
                throw new Error("Count session is no longer in Approved status.");
            }
            const countHeader = lockHRes.recordset[0];

            // 2. Fetch line items
            const itemsReq = new sql.Request(transaction);
            itemsReq.input('CountID', sql.BigInt, countId);
            const itemsRes = await itemsReq.query(`
                SELECT 
                    CI.CountItemID,
                    CI.InventoryID,
                    CI.MedicineID,
                    CI.SystemQuantity,
                    CI.PhysicalQuantity,
                    CI.VarianceQuantity,
                    CI.UnitCostAtBaseline,
                    CI.DiscrepancyReason,
                    CI.Notes,
                    CI.IsAdjusted
                FROM Warehouse_PhysicalInventoryCountItems CI
                WHERE CI.CountID = @CountID AND CI.IsDeleted = 0
            `);
            const items = itemsRes.recordset;

            let adjustedCount = 0;

            // 3. Process each line item
            for (const item of items) {
                const variance = item.VarianceQuantity;
                if (variance === 0) {
                    // Match: no inventory change needed, mark adjusted
                    const matchReq = new sql.Request(transaction);
                    matchReq.input('CountItemID', sql.BigInt, item.CountItemID);
                    await matchReq.query(`
                        UPDATE Warehouse_PhysicalInventoryCountItems
                        SET IsAdjusted = 1
                        WHERE CountItemID = @CountItemID
                    `);
                    continue;
                }

                // Discrepancy exists: apply stock adjustment
                // Lock inventory batch with (UPDLOCK, HOLDLOCK)
                const lockInvReq = new sql.Request(transaction);
                lockInvReq.input('InventoryID', sql.BigInt, item.InventoryID);
                const lockInvRes = await lockInvReq.query(`
                    SELECT 
                        InventoryID,
                        LocationID,
                        MedicineID,
                        QuantityAvailable,
                        UnitCost,
                        BatchNumber,
                        LotNumber,
                        Status
                    FROM Warehouse_Inventory WITH (UPDLOCK, HOLDLOCK)
                    WHERE InventoryID = @InventoryID AND IsDeleted = 0
                `);
                if (lockInvRes.recordset.length === 0) {
                    throw new Error(`Inventory batch #${item.InventoryID} no longer exists.`);
                }
                const batch = lockInvRes.recordset[0];

                // Detect intervening movements after BaselineDate
                const mvtReq = new sql.Request(transaction);
                mvtReq.input('InventoryID', sql.BigInt, item.InventoryID);
                mvtReq.input('BaselineDate', sql.DateTime2, countHeader.BaselineDate);
                const mvtRes = await mvtReq.query(`
                    SELECT COUNT(*) as mvtCount
                    FROM Warehouse_InventoryTransactions
                    WHERE InventoryID = @InventoryID AND CreatedDate > @BaselineDate
                `);
                const interveningMovements = mvtRes.recordset[0].mvtCount;

                // Safety guard: New balance cannot be negative
                const expectedNewBalance = batch.QuantityAvailable + variance;
                if (expectedNewBalance < 0) {
                    throw new Error(
                        `Adjustment rejected for batch ${batch.BatchNumber || batch.LotNumber}: ` +
                        `Current stock (${batch.QuantityAvailable}) + variance (${variance}) would result in negative stock (${expectedNewBalance}). ` +
                        `${interveningMovements > 0 ? interveningMovements + ' stock movements occurred after count baseline.' : ''}`
                    );
                }

                // Apply adjustment variance atomically
                const updateInvReq = new sql.Request(transaction);
                updateInvReq.input('InventoryID', sql.BigInt, item.InventoryID);
                updateInvReq.input('Variance', sql.Int, variance);
                updateInvReq.input('UserID', sql.Int, userId);
                const updateInvRes = await updateInvReq.query(`
                    UPDATE Warehouse_Inventory
                    SET QuantityAvailable = QuantityAvailable + @Variance,
                        QuantityReceived = CASE 
                            WHEN @Variance > 0 THEN QuantityReceived + @Variance 
                            ELSE QuantityReceived 
                        END,
                        ModifiedBy = @UserID,
                        ModifiedDate = SYSUTCDATETIME()
                    WHERE InventoryID = @InventoryID AND (QuantityAvailable + @Variance) >= 0
                `);
                if (updateInvRes.rowsAffected[0] === 0) {
                    throw new Error(`Failed to update batch #${item.InventoryID}. Stock cannot become negative.`);
                }

                // Write immutable transaction ledger record with signed quantity
                const txReq = new sql.Request(transaction);
                txReq.input('InventoryID', sql.BigInt, item.InventoryID);
                txReq.input('LocationID', sql.Int, batch.LocationID);
                txReq.input('MedicineID', sql.Int, item.MedicineID);
                txReq.input('TransactionType', sql.NVarChar, 'ADJUSTMENT');
                txReq.input('RefDoc', sql.NVarChar, `Physical Count ${countHeader.CountNumber}`);
                txReq.input('RefID', sql.BigInt, countId);
                txReq.input('Quantity', sql.Int, variance); // Signed: + for gain, - for loss
                txReq.input('UnitCost', sql.Decimal(18, 2), item.UnitCostAtBaseline || batch.UnitCost || 0);
                txReq.input('TotalCost', sql.Decimal(18, 2), Math.abs(variance) * (item.UnitCostAtBaseline || batch.UnitCost || 0));
                txReq.input('Remarks', sql.NVarChar, `[${item.DiscrepancyReason || 'Physical Count Adjustment'}] ${item.Notes || ''}`.trim());
                txReq.input('CreatedBy', sql.Int, userId);

                const txInsertRes = await txReq.query(`
                    INSERT INTO Warehouse_InventoryTransactions (
                        InventoryID, LocationID, MedicineID, TransactionType,
                        ReferenceDocument, ReferenceID, Quantity, UnitCost, TotalCost,
                        Remarks, CreatedBy, CreatedDate
                    )
                    OUTPUT INSERTED.TransactionID
                    VALUES (
                        @InventoryID, @LocationID, @MedicineID, @TransactionType,
                        @RefDoc, @RefID, @Quantity, @UnitCost, @TotalCost,
                        @Remarks, @CreatedBy, SYSUTCDATETIME()
                    )
                `);
                const txId = txInsertRes.recordset[0].TransactionID;

                // Mark count item as adjusted with transaction link
                const markItemReq = new sql.Request(transaction);
                markItemReq.input('CountItemID', sql.BigInt, item.CountItemID);
                markItemReq.input('TxID', sql.BigInt, txId);
                markItemReq.input('InterveningMvts', sql.Int, interveningMovements);
                await markItemReq.query(`
                    UPDATE Warehouse_PhysicalInventoryCountItems
                    SET IsAdjusted = 1,
                        AdjustmentTransactionID = @TxID,
                        InterveningMovementsDetected = @InterveningMvts
                    WHERE CountItemID = @CountItemID
                `);

                adjustedCount++;
            }

            // 4. Update Header status to Posted
            const postHReq = new sql.Request(transaction);
            postHReq.input('CountID', sql.BigInt, countId);
            postHReq.input('UserID', sql.Int, userId);
            await postHReq.query(`
                UPDATE Warehouse_PhysicalInventoryCounts
                SET Status = 'Posted',
                    PostedBy = @UserID,
                    PostedDate = SYSUTCDATETIME()
                WHERE CountID = @CountID
            `);

            await transaction.commit();
            return {
                success: true,
                countNumber: countHeader.CountNumber,
                status: 'Posted',
                itemsAdjusted: adjustedCount
            };
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    }
}

module.exports = PhysicalCountService;
