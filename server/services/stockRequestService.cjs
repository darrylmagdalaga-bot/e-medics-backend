const sql = require('mssql');

/**
 * StockRequestService — Central Warehouse & Pharmacy Inventory Control & Fulfillment Workflow
 *
 * Separates administrative Request Approval from physical Stock Release:
 *  - Pharmacy may submit replenishment requests regardless of Warehouse stock availability (even 0).
 *  - Warehouse Admin may approve valid requests even at 0 available stock without deducting/reserving inventory.
 *  - Stock Release is an independent operation restricted to Approved requests and strictly validated
 *    against live unreserved non-expired Warehouse inventory using FEFO batch allocation inside SQL transactions.
 *  - Every state transition and stock release writes immutable audit trail records.
 */
class StockRequestService {
    static STATUS = {
        SUBMITTED: 'SUBMITTED',
        UNDER_REVIEW: 'UNDER_REVIEW',
        APPROVED: 'APPROVED',
        STOCK_UNAVAILABLE: 'STOCK_UNAVAILABLE',
        PARTIALLY_FULFILLED: 'PARTIALLY_FULFILLED',
        READY_FOR_FULFILLMENT: 'READY_FOR_FULFILLMENT',
        FULFILLED: 'FULFILLED',
        REJECTED: 'REJECTED',
        CANCELLED: 'CANCELLED',
    };

    static normalizeStatus(status) {
        return String(status || '').trim().toUpperCase().replace(/\s+/g, '_');
    }

    static isPendingReviewStatus(status) {
        return ['SUBMITTED', 'PENDING', 'UNDER_REVIEW'].includes(this.normalizeStatus(status));
    }

    static isApprovedReleasableStatus(status) {
        return [
            'APPROVED',
            'PARTIALLY_APPROVED',
            'STOCK_UNAVAILABLE',
            'READY_FOR_FULFILLMENT',
            'READY_FOR_ISSUANCE',
            'PARTIALLY_FULFILLED',
            'PARTIALLY_RECEIVED',
            'RESERVED',
        ].includes(this.normalizeStatus(status));
    }

    static isTerminalStatus(status) {
        return ['REJECTED', 'CANCELLED', 'FULFILLED', 'COMPLETED', 'RECEIVED'].includes(this.normalizeStatus(status));
    }

    static httpError(message, statusCode = 400) {
        const err = new Error(message);
        err.statusCode = statusCode;
        return err;
    }

    /**
     * Resolve user identity and optionally assert Warehouse/Admin privileges.
     */
    static async resolveActor(poolOrTx, userId, { requireWarehouseAdmin = false, requireActive = true } = {}) {
        const uid = Number(userId);
        if (!Number.isInteger(uid) || uid <= 0) {
            throw this.httpError('Unauthorized: Valid authenticated user ID is required.', 401);
        }

        const req = new sql.Request(poolOrTx);
        req.input('UserID', sql.Int, uid);
        const res = await req.query(`
            SELECT UserID, Username, FullName, Role, IsActive, LocationID
            FROM Users
            WHERE UserID = @UserID
        `);

        if (res.recordset.length === 0) {
            throw this.httpError(`Unauthorized: User ID ${uid} does not exist.`, 401);
        }

        const user = res.recordset[0];
        if (requireActive && !user.IsActive) {
            throw this.httpError('Unauthorized: User account is inactive.', 401);
        }

        const rawRole = String(user.Role || '').toLowerCase().trim();
        const isWarehouseOrAdmin =
            rawRole === 'admin' ||
            rawRole.includes('warehouse') ||
            rawRole.includes('management');

        if (requireWarehouseAdmin && !isWarehouseOrAdmin) {
            throw this.httpError(
                'Access Denied: Only Central Warehouse Administrator or System Administrator personnel may perform this action.',
                403
            );
        }

        return {
            userId: Number(user.UserID),
            username: user.Username,
            fullName: user.FullName,
            role: user.Role,
            locationId: user.LocationID ? Number(user.LocationID) : null,
            isWarehouseOrAdmin,
        };
    }

    /**
     * Write an immutable workflow audit entry inside the active transaction or pool.
     */
    static async logAudit(poolOrTx, {
        stockRequestId,
        distributionId = null,
        action,
        previousStatus = null,
        newStatus = null,
        actorUserId,
        actorRole = null,
        notes = null,
        metadata = null,
    }) {
        const req = new sql.Request(poolOrTx);
        req.input('StockRequestID', sql.BigInt, stockRequestId);
        req.input('DistributionID', sql.BigInt, distributionId || null);
        req.input('Action', sql.NVarChar(60), action);
        req.input('PreviousStatus', sql.NVarChar(50), previousStatus || null);
        req.input('NewStatus', sql.NVarChar(50), newStatus || null);
        req.input('ActorUserID', sql.Int, actorUserId);
        req.input('ActorRole', sql.NVarChar(50), actorRole || null);
        req.input('Notes', sql.NVarChar(sql.MAX), notes || null);
        req.input('MetadataJson', sql.NVarChar(sql.MAX), metadata ? JSON.stringify(metadata) : null);

        await req.query(`
            INSERT INTO Warehouse_StockRequestAudit (
                StockRequestID, DistributionID, Action, PreviousStatus, NewStatus,
                ActorUserID, ActorRole, Notes, MetadataJson, CreatedDate
            ) VALUES (
                @StockRequestID, @DistributionID, @Action, @PreviousStatus, @NewStatus,
                @ActorUserID, @ActorRole, @Notes, @MetadataJson, SYSUTCDATETIME()
            )
        `);
    }

    /**
     * Authoritative Warehouse stock calculation across all non-deleted batches at LocationID (default 1).
     * Separates eligible active non-expired stock from reserved, expired, and damaged/quarantined stock.
     */
    static async calculateAvailableStock(poolOrTx, medicineId, locationId = 1) {
        const req = new sql.Request(poolOrTx);
        req.input('MedicineID', sql.Int, medicineId);
        req.input('LocationID', sql.Int, locationId);

        const result = await req.query(`
            SELECT
                ISNULL(SUM(
                    CASE
                        WHEN Status = 'Active' AND (ExpiryDate IS NULL OR ExpiryDate > CAST(GETUTCDATE() AS DATE))
                        THEN QuantityAvailable
                        ELSE 0
                    END
                ), 0) AS AvailableUnreservedQuantity,
                ISNULL(SUM(
                    CASE
                        WHEN Status = 'Active' AND (ExpiryDate IS NULL OR ExpiryDate > CAST(GETUTCDATE() AS DATE))
                        THEN ReservedQuantity
                        ELSE 0
                    END
                ), 0) AS ReservedQuantity,
                ISNULL(SUM(
                    CASE
                        WHEN ExpiryDate IS NOT NULL AND ExpiryDate <= CAST(GETUTCDATE() AS DATE)
                        THEN (QuantityAvailable + ReservedQuantity + ExpiredQuantity)
                        ELSE ExpiredQuantity
                    END
                ), 0) AS ExpiredQuantity,
                ISNULL(SUM(
                    CASE
                        WHEN Status IN ('Quarantine', 'Damaged', 'Blocked')
                        THEN (QuantityAvailable + ReservedQuantity + DamagedQuantity)
                        ELSE DamagedQuantity
                    END
                ), 0) AS DamagedQuantity
            FROM Warehouse_Inventory
            WHERE MedicineID = @MedicineID
              AND LocationID = @LocationID
              AND IsDeleted = 0
        `);

        const row = result.recordset[0] || {};
        const availableUnreservedQuantity = Number(row.AvailableUnreservedQuantity || 0);
        const reservedQuantity = Number(row.ReservedQuantity || 0);
        const expiredQuantity = Number(row.ExpiredQuantity || 0);
        const damagedQuantity = Number(row.DamagedQuantity || 0);
        const unavailableQuantity = expiredQuantity + damagedQuantity;
        const physicalStock = availableUnreservedQuantity + reservedQuantity + unavailableQuantity;

        return {
            physicalStock,
            totalStock: physicalStock,
            reservedQuantity,
            availableUnreservedQuantity,
            expiredQuantity,
            damagedQuantity,
            unavailableQuantity,
        };
    }

    /**
     * FEFO Batch Allocation Planner (Preview/Release Helper).
     * Computes eligible batches for the OUTSTANDING (approved/requested - released) quantity per line item.
     */
    static async getFefoAllocation(poolOrTx, stockRequestId, releaseOverrides = null) {
        const req = new sql.Request(poolOrTx);
        req.input('StockRequestID', sql.BigInt, stockRequestId);

        const itemsResult = await req.query(`
            SELECT 
                sri.StockRequestItemID,
                sri.StockRequestID,
                sri.MedicineID,
                sri.QuantityRequested,
                sri.QuantityApproved,
                sri.QuantityReleased,
                wm.ProductName,
                wm.GenericName,
                COALESCE(mu.UnitName, wm.Form, 'Unit') AS UnitName
            FROM Warehouse_StockRequestItems sri
            JOIN Warehouse_Medicines wm ON sri.MedicineID = wm.MedicineID
            LEFT JOIN Warehouse_MedicineUnits mu ON wm.BaseUnitID = mu.UnitID
            WHERE sri.StockRequestID = @StockRequestID
              AND sri.IsDeleted = 0
            ORDER BY sri.StockRequestItemID ASC
        `);

        const requestedItems = itemsResult.recordset;
        const allocations = [];

        for (const item of requestedItems) {
            const approvedOrReq = Number(
                item.QuantityApproved !== null && item.QuantityApproved !== undefined
                    ? item.QuantityApproved
                    : item.QuantityRequested
            );
            const alreadyReleased = Number(item.QuantityReleased || 0);
            const outstanding = Math.max(0, approvedOrReq - alreadyReleased);

            let targetQty = outstanding;
            if (releaseOverrides && releaseOverrides.has(Number(item.StockRequestItemID))) {
                targetQty = Math.min(outstanding, Math.max(0, Number(releaseOverrides.get(Number(item.StockRequestItemID)))));
            } else if (releaseOverrides && releaseOverrides.has(`med:${item.MedicineID}`)) {
                targetQty = Math.min(outstanding, Math.max(0, Number(releaseOverrides.get(`med:${item.MedicineID}`))));
            }

            if (targetQty <= 0) continue;

            let remainingToFulfill = targetQty;
            const invReq = new sql.Request(poolOrTx);
            invReq.input('MedicineID', sql.Int, item.MedicineID);
            invReq.input('LocationID', sql.Int, 1);

            const invResult = await invReq.query(`
                SELECT 
                    InventoryID,
                    BatchNumber,
                    LotNumber,
                    ExpiryDate,
                    QuantityAvailable,
                    ReservedQuantity,
                    UnitCost,
                    LocationID,
                    CreatedDate
                FROM Warehouse_Inventory
                WHERE MedicineID = @MedicineID
                  AND LocationID = @LocationID
                  AND QuantityAvailable > 0
                  AND Status = 'Active'
                  AND IsDeleted = 0
                  AND (ExpiryDate IS NULL OR ExpiryDate > CAST(GETUTCDATE() AS DATE))
                ORDER BY 
                  CASE WHEN ExpiryDate IS NULL THEN 1 ELSE 0 END,
                  ExpiryDate ASC,
                  CreatedDate ASC,
                  InventoryID ASC
            `);

            for (const batch of invResult.recordset) {
                if (remainingToFulfill <= 0) break;
                const allocQty = Math.min(remainingToFulfill, Number(batch.QuantityAvailable));
                allocations.push({
                    stockRequestItemId: Number(item.StockRequestItemID),
                    medicineId: Number(item.MedicineID),
                    productName: item.ProductName,
                    genericName: item.GenericName,
                    unitName: item.UnitName || 'Unit',
                    requestedQuantity: Number(item.QuantityRequested),
                    outstandingQuantity: outstanding,
                    inventoryId: Number(batch.InventoryID),
                    batchNumber: batch.BatchNumber || batch.LotNumber || 'BATCH-DEFAULT',
                    lotNumber: batch.LotNumber,
                    expiryDate: batch.ExpiryDate ? new Date(batch.ExpiryDate).toISOString().slice(0, 10) : null,
                    batchAvailableQuantity: Number(batch.QuantityAvailable),
                    allocatedQuantity: allocQty,
                    unitCost: Number(batch.UnitCost || 0),
                    shortageQuantity: 0,
                });
                remainingToFulfill -= allocQty;
            }

            if (remainingToFulfill > 0) {
                allocations.push({
                    stockRequestItemId: Number(item.StockRequestItemID),
                    medicineId: Number(item.MedicineID),
                    productName: item.ProductName,
                    genericName: item.GenericName,
                    unitName: item.UnitName || 'Unit',
                    requestedQuantity: Number(item.QuantityRequested),
                    outstandingQuantity: outstanding,
                    inventoryId: null,
                    batchNumber: 'INSUFFICIENT ELIGIBLE STOCK',
                    lotNumber: 'N/A',
                    expiryDate: null,
                    batchAvailableQuantity: 0,
                    allocatedQuantity: 0,
                    unitCost: 0,
                    shortageQuantity: remainingToFulfill,
                });
            }
        }

        return allocations;
    }

    /**
     * Submit a new Pharmacy Stock Request.
     * Permissive on Warehouse inventory: ZERO-stock items MUST be allowed to submit cleanly.
     */
    static async createStockRequest(pool, authUser, payload) {
        const rawUserId = Number(authUser.userId || authUser.UserID || payload.userId || 1);
        const actor = await this.resolveActor(pool, rawUserId, { requireWarehouseAdmin: false });
        const userLocationId = Number(authUser.locationId || authUser.LocationID || actor.locationId || 2);

        const {
            priority = 'Routine',
            purpose = 'City Pharmacy Replenishment',
            remarks = '',
            requiredDate = null,
            items = [],
        } = payload;

        const normalizedPriority = ['Routine', 'Urgent', 'Emergency'].includes(priority) ? priority : 'Routine';

        if (!purpose || !String(purpose).trim()) {
            throw this.httpError('Purpose is required for submission.');
        }

        if (!Array.isArray(items) || items.length === 0) {
            throw this.httpError('At least one medicine item must be included in the request.');
        }

        let parsedRequiredDate = null;
        if (requiredDate) {
            const d = new Date(requiredDate);
            if (isNaN(d.getTime())) {
                throw this.httpError('Invalid Required Date supplied.');
            }
            parsedRequiredDate = d;
        }

        const seenMedicines = new Set();
        const sanitizedItems = [];
        for (const it of items) {
            const mid = Number(it.medicineId || it.MedicineID);
            const qty = Number(it.quantity || it.QuantityRequested || it.RequestedQuantity);
            if (!Number.isInteger(mid) || mid <= 0) {
                throw this.httpError('Each line item must specify a valid Medicine ID.');
            }
            if (!Number.isInteger(qty) || qty <= 0) {
                throw this.httpError('Each line item must have a positive whole-number quantity.');
            }
            if (seenMedicines.has(mid)) {
                throw this.httpError(`Duplicate Medicine ID ${mid} in the same stock request. Combine quantities onto one line item.`);
            }
            seenMedicines.add(mid);
            sanitizedItems.push({ medicineId: mid, quantity: qty, unitId: Number(it.unitId || 1) });
        }

        // Prevent rapid accidental double-submission (identical user + purpose within last 3 seconds)
        const dupReq = pool.request();
        dupReq.input('UserID', sql.Int, actor.userId);
        dupReq.input('Purpose', sql.NVarChar, String(purpose).trim());
        const recentRes = await dupReq.query(`
            SELECT TOP 1 sr.StockRequestID, sr.RequestNumber
            FROM Warehouse_StockRequests sr
            WHERE sr.RequestedByUserID = @UserID
              AND sr.Purpose = @Purpose
              AND sr.IsDeleted = 0
              AND DATEDIFF(SECOND, sr.CreatedDate, SYSUTCDATETIME()) <= 3
            ORDER BY sr.StockRequestID DESC
        `);
        if (recentRes.recordset.length > 0) {
            throw this.httpError(`Duplicate rapid submission blocked. Request ${recentRes.recordset[0].RequestNumber} was just submitted.`);
        }

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const countReq = new sql.Request(transaction);
            const countRes = await countReq.query(
                `SELECT COUNT(*) AS cnt FROM Warehouse_StockRequests WHERE RequestNumber LIKE 'SR-PHM-${datePrefix}%'`
            );
            const seq = (countRes.recordset[0].cnt || 0) + 1;
            const requestNumber = `SR-PHM-${datePrefix}-${String(seq).padStart(4, '0')}`;

            const srReq = new sql.Request(transaction);
            srReq.input('RequestNumber', sql.NVarChar, requestNumber);
            srReq.input('RequestingLocationID', sql.Int, userLocationId);
            srReq.input('RequestedByUserID', sql.Int, actor.userId);
            srReq.input('Priority', sql.NVarChar, normalizedPriority);
            srReq.input('Purpose', sql.NVarChar, String(purpose).trim());
            srReq.input('Remarks', sql.NVarChar(sql.MAX), remarks ? String(remarks).trim() : null);
            srReq.input('RequiredDate', sql.DateTime2, parsedRequiredDate);
            srReq.input('Status', sql.NVarChar(50), this.STATUS.SUBMITTED);
            srReq.input('CreatedBy', sql.Int, actor.userId);

            const srRes = await srReq.query(`
                INSERT INTO Warehouse_StockRequests (
                    RequestNumber, RequestingLocationID, RequestedByUserID, Priority, Purpose,
                    Remarks, RequiredDate, Status, CreatedBy, CreatedDate, IsDeleted
                )
                OUTPUT INSERTED.StockRequestID
                VALUES (
                    @RequestNumber, @RequestingLocationID, @RequestedByUserID, @Priority, @Purpose,
                    @Remarks, @RequiredDate, @Status, @CreatedBy, SYSUTCDATETIME(), 0
                )
            `);
            const stockRequestId = Number(srRes.recordset[0].StockRequestID);

            const legacyReq = new sql.Request(transaction);
            legacyReq.input('userId', sql.Int, actor.userId);
            legacyReq.input('remarks', sql.NVarChar, String(purpose).trim());
            const legacyRes = await legacyReq.query(`
                INSERT INTO Stock_Request (RequestedBy, Remarks, Status, RequestDate)
                OUTPUT INSERTED.RequestID
                VALUES (@userId, @remarks, 'Pending', SYSUTCDATETIME())
            `);
            const legacyRequestId = Number(legacyRes.recordset[0].RequestID);

            const stockSnapshots = [];
            for (const it of sanitizedItems) {
                const medCheckReq = new sql.Request(transaction);
                medCheckReq.input('MedicineID', sql.Int, it.medicineId);
                const medRes = await medCheckReq.query(`
                    SELECT MedicineID, ProductName, BaseUnitID, Status
                    FROM Warehouse_Medicines
                    WHERE MedicineID = @MedicineID AND IsDeleted = 0
                `);
                if (medRes.recordset.length === 0) {
                    throw this.httpError(`Medicine ID ${it.medicineId} does not exist or is inactive.`);
                }
                const med = medRes.recordset[0];
                if (String(med.Status || '').toLowerCase() !== 'active') {
                    throw this.httpError(`Medicine '${med.ProductName}' is inactive and cannot be requested.`);
                }

                const stock = await this.calculateAvailableStock(transaction, it.medicineId, 1);
                stockSnapshots.push({
                    medicineId: it.medicineId,
                    productName: med.ProductName,
                    requestedQuantity: it.quantity,
                    warehouseAvailableAtSubmission: stock.availableUnreservedQuantity,
                    estimatedShortageAtSubmission: Math.max(0, it.quantity - stock.availableUnreservedQuantity),
                });

                const itemReq = new sql.Request(transaction);
                itemReq.input('StockRequestID', sql.BigInt, stockRequestId);
                itemReq.input('MedicineID', sql.Int, it.medicineId);
                itemReq.input('QuantityRequested', sql.Int, it.quantity);
                itemReq.input('CreatedBy', sql.Int, actor.userId);

                await itemReq.query(`
                    INSERT INTO Warehouse_StockRequestItems (
                        StockRequestID, MedicineID, QuantityRequested, QuantityApproved,
                        QuantityReleased, QuantityUnfulfilled, CreatedBy, CreatedDate, IsDeleted
                    ) VALUES (
                        @StockRequestID, @MedicineID, @QuantityRequested, NULL,
                        0, 0, @CreatedBy, SYSUTCDATETIME(), 0
                    )
                `);

                const legacyItemReq = new sql.Request(transaction);
                legacyItemReq.input('requestId', sql.Int, legacyRequestId);
                legacyItemReq.input('medicineId', sql.Int, it.medicineId);
                legacyItemReq.input('quantity', sql.Int, it.quantity);
                legacyItemReq.input('unitId', sql.Int, med.BaseUnitID || it.unitId || 1);
                await legacyItemReq.query(`
                    INSERT INTO Stock_Request_Details (RequestID, MedicineID, QuantityRequested, UnitID)
                    VALUES (@requestId, @medicineId, @quantity, @unitId)
                `);
            }

            await this.logAudit(transaction, {
                stockRequestId,
                action: 'CREATED',
                previousStatus: null,
                newStatus: this.STATUS.SUBMITTED,
                actorUserId: actor.userId,
                actorRole: actor.role,
                notes: remarks ? `Submitted by Pharmacy: ${String(remarks).trim()}` : `Submitted for ${purpose.trim()}`,
                metadata: { priority: normalizedPriority, requiredDate: parsedRequiredDate, items: stockSnapshots },
            });

            await transaction.commit();
            return {
                success: true,
                stockRequestId,
                requestNumber,
                legacyRequestId,
                status: this.STATUS.SUBMITTED,
                itemCount: sanitizedItems.length,
                itemsSnapshot: stockSnapshots,
            };
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    }

    /**
     * Get comprehensive review & fulfillment details for Warehouse Admin and Pharmacy.
     * Exposes Requested, Total Warehouse Stock, Reserved, Unavailable (Expired/Damaged),
     * Available-to-Release, Released, Remaining, Shortage, FEFO proposals, Distributions, and Audit Trail.
     */
    static async getStockRequestReviewDetails(pool, stockRequestId) {
        const srReq = pool.request();
        srReq.input('StockRequestID', sql.BigInt, stockRequestId);

        const srRes = await srReq.query(`
            SELECT 
                sr.*,
                COALESCE(wl.LocationName, 'City Health Pharmacy') AS RequestingFacility,
                uReq.FullName AS RequesterName,
                uRev.FullName AS UnderReviewByName,
                uApp.FullName AS ApprovedByName,
                uRej.FullName AS RejectedByName,
                uSh.FullName AS ShortageUpdatedByName
            FROM Warehouse_StockRequests sr
            LEFT JOIN Warehouse_Locations wl ON sr.RequestingLocationID = wl.LocationID
            LEFT JOIN Users uReq ON sr.RequestedByUserID = uReq.UserID
            LEFT JOIN Users uRev ON sr.UnderReviewByUserID = uRev.UserID
            LEFT JOIN Users uApp ON sr.ApprovedByUserID = uApp.UserID
            LEFT JOIN Users uRej ON sr.RejectedByUserID = uRej.UserID
            LEFT JOIN Users uSh ON sr.ShortageUpdatedByUserID = uSh.UserID
            WHERE sr.StockRequestID = @StockRequestID AND sr.IsDeleted = 0
        `);

        if (srRes.recordset.length === 0) {
            throw this.httpError(`Stock Request ${stockRequestId} not found.`, 404);
        }

        const header = srRes.recordset[0];
        const normStatus = this.normalizeStatus(header.Status);

        const itemsReq = pool.request();
        itemsReq.input('StockRequestID', sql.BigInt, stockRequestId);
        const itemsRes = await itemsReq.query(`
            SELECT 
                sri.*,
                wm.ProductName,
                wm.GenericName,
                wm.Dosage,
                wm.Form,
                COALESCE(mu.UnitName, wm.Form, 'Unit') AS UnitName
            FROM Warehouse_StockRequestItems sri
            JOIN Warehouse_Medicines wm ON sri.MedicineID = wm.MedicineID
            LEFT JOIN Warehouse_MedicineUnits mu ON wm.BaseUnitID = mu.UnitID
            WHERE sri.StockRequestID = @StockRequestID AND sri.IsDeleted = 0
            ORDER BY sri.StockRequestItemID ASC
        `);

        const fefoAll = await this.getFefoAllocation(pool, stockRequestId);

        let totalRequested = 0;
        let totalApproved = 0;
        let totalReleased = 0;
        let totalRemaining = 0;
        let totalPhysicalStock = 0;
        let totalReservedStock = 0;
        let totalUnavailableStock = 0;
        let totalAvailable = 0;
        let totalReleasable = 0;
        let totalShortage = 0;

        const items = [];
        for (const it of itemsRes.recordset) {
            const stock = await this.calculateAvailableStock(pool, it.MedicineID, 1);
            const reqQty = Number(it.QuantityRequested || 0);
            const appQty = it.QuantityApproved !== null && it.QuantityApproved !== undefined ? Number(it.QuantityApproved) : null;
            const relQty = Number(it.QuantityReleased || 0);
            const effectiveTarget = appQty !== null ? appQty : reqQty;
            const remainingQty = ['REJECTED', 'CANCELLED'].includes(normStatus) ? 0 : Math.max(0, effectiveTarget - relQty);
            const availQty = stock.availableUnreservedQuantity;
            const releasableQty = Math.min(remainingQty, availQty);
            const shortageQty = Math.max(0, remainingQty - availQty);

            let stockCondition = 'SUFFICIENT';
            if (remainingQty === 0) stockCondition = 'FULFILLED';
            else if (availQty <= 0) stockCondition = 'OUT_OF_STOCK';
            else if (availQty < remainingQty) stockCondition = 'PARTIAL';

            const itemFefo = fefoAll.filter(f => Number(f.stockRequestItemId) === Number(it.StockRequestItemID) && f.inventoryId);

            totalRequested += reqQty;
            totalApproved += appQty !== null ? appQty : 0;
            totalReleased += relQty;
            totalRemaining += remainingQty;
            totalPhysicalStock += stock.physicalStock;
            totalReservedStock += stock.reservedQuantity;
            totalUnavailableStock += stock.unavailableQuantity;
            totalAvailable += availQty;
            totalReleasable += releasableQty;
            totalShortage += shortageQty;

            items.push({
                StockRequestItemID: Number(it.StockRequestItemID),
                StockRequestID: Number(it.StockRequestID),
                MedicineID: Number(it.MedicineID),
                ProductName: it.ProductName,
                GenericName: it.GenericName,
                Dosage: it.Dosage,
                Form: it.Form,
                UnitName: it.UnitName || 'Unit',
                QuantityRequested: reqQty,
                RequestedQuantity: reqQty,
                QuantityApproved: appQty,
                QuantityReleased: relQty,
                QuantityUnfulfilled: Number(it.QuantityUnfulfilled || 0),
                RemainingQuantity: remainingQty,
                PhysicalStock: stock.physicalStock,
                TotalStock: stock.physicalStock,
                ReservedStock: stock.reservedQuantity,
                ReservedQuantity: stock.reservedQuantity,
                ExpiredQuantity: stock.expiredQuantity,
                DamagedQuantity: stock.damagedQuantity,
                UnavailableQuantity: stock.unavailableQuantity,
                AvailableStock: availQty,
                AvailableUnreservedQuantity: availQty,
                ReleasableQuantity: releasableQty,
                ShortageQuantity: shortageQty,
                HasShortage: shortageQty > 0,
                StockCondition: stockCondition,
                FEFOProposals: itemFefo,
                fefoAllocations: itemFefo,
            });
        }

        const isPendingReview = this.isPendingReviewStatus(header.Status);
        const isReleasableState = this.isApprovedReleasableStatus(header.Status);
        const allOutOfStock = items.filter(i => i.RemainingQuantity > 0).length > 0 && totalReleasable === 0;
        const hasAnyEligibleStock = totalReleasable > 0;
        const allSufficient = items.filter(i => i.RemainingQuantity > 0).every(i => i.AvailableStock >= i.RemainingQuantity);

        let fulfillmentReadiness = normStatus;
        if (isReleasableState) {
            if (totalRemaining <= 0) fulfillmentReadiness = this.STATUS.FULFILLED;
            else if (allOutOfStock) fulfillmentReadiness = this.STATUS.STOCK_UNAVAILABLE;
            else if (allSufficient && totalReleased === 0) fulfillmentReadiness = this.STATUS.READY_FOR_FULFILLMENT;
            else if (totalReleased > 0) fulfillmentReadiness = this.STATUS.PARTIALLY_FULFILLED;
            else fulfillmentReadiness = 'PARTIAL_STOCK';
        }

        const resvReq = pool.request();
        resvReq.input('StockRequestID', sql.BigInt, stockRequestId);
        const resvRes = await resvReq.query(`
            SELECT r.*, wm.ProductName, wi.BatchNumber, wi.LotNumber, wi.ExpiryDate
            FROM Warehouse_StockReservations r
            JOIN Warehouse_Medicines wm ON r.MedicineID = wm.MedicineID
            JOIN Warehouse_Inventory wi ON r.InventoryID = wi.InventoryID
            WHERE r.StockRequestID = @StockRequestID AND r.IsDeleted = 0 AND r.Status = 'Active'
        `);

        const distReq = pool.request();
        distReq.input('StockRequestID', sql.BigInt, stockRequestId);
        const distRes = await distReq.query(`
            SELECT 
                d.DistributionID, d.DistributionNumber, d.Status,
                d.ReleasedDate, uRel.FullName AS ReleasedByName,
                d.ReceivedDate, uRec.FullName AS ReceivedByName,
                d.HasDiscrepancy, d.DiscrepancyRemarks, d.Remarks,
                ISNULL((SELECT SUM(Quantity) FROM Warehouse_DistributionItems di WHERE di.DistributionID = d.DistributionID AND di.IsDeleted = 0), 0) AS TotalQuantity,
                ISNULL((SELECT SUM(ReceivedQuantity) FROM Warehouse_DistributionItems di WHERE di.DistributionID = d.DistributionID AND di.IsDeleted = 0), 0) AS TotalReceivedQuantity
            FROM Warehouse_Distributions d
            LEFT JOIN Users uRel ON d.ReleasedByUserID = uRel.UserID
            LEFT JOIN Users uRec ON d.ReceivedByUserID = uRec.UserID
            WHERE d.ReferenceStockRequestID = @StockRequestID AND d.IsDeleted = 0
            ORDER BY d.DistributionID DESC
        `);

        const auditReq = pool.request();
        auditReq.input('StockRequestID', sql.BigInt, stockRequestId);
        const auditRes = await auditReq.query(`
            SELECT 
                a.AuditID, a.StockRequestID, a.DistributionID, a.Action,
                a.PreviousStatus, a.NewStatus, a.ActorUserID, u.FullName AS ActorName,
                COALESCE(a.ActorRole, u.Role) AS ActorRole, a.Notes, a.MetadataJson, a.CreatedDate
            FROM Warehouse_StockRequestAudit a
            LEFT JOIN Users u ON a.ActorUserID = u.UserID
            WHERE a.StockRequestID = @StockRequestID
            ORDER BY a.CreatedDate DESC, a.AuditID DESC
        `);

        return {
            ...header,
            StockRequestID: Number(header.StockRequestID),
            RequestedByName: header.RequesterName,
            RequestDate: header.CreatedDate,
            fulfillmentReadiness,
            summary: {
                itemCount: items.length,
                totalRequested,
                totalApproved,
                totalReleased,
                totalRemaining,
                totalPhysicalStock,
                totalReservedStock,
                totalUnavailableStock,
                totalAvailable,
                totalReleasable,
                totalShortage,
                canApprove: isPendingReview,
                canReject: isPendingReview,
                canCancel: isPendingReview || (isReleasableState && totalReleased === 0),
                canRelease: isReleasableState && totalRemaining > 0 && hasAnyEligibleStock,
                canRecordShortage: isReleasableState && totalRemaining > 0 && totalShortage > 0,
                hasAnyEligibleStock,
                allOutOfStock,
                allSufficient,
            },
            items,
            activeReservations: resvRes.recordset,
            distributions: distRes.recordset,
            auditLogs: auditRes.recordset,
        };
    }

    /**
     * Transition a SUBMITTED request into UNDER_REVIEW (Administrative review only, no stock change).
     */
    static async markUnderReview(pool, stockRequestId, adminUserId) {
        const actor = await this.resolveActor(pool, adminUserId, { requireWarehouseAdmin: true });
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const lockReq = new sql.Request(transaction);
            lockReq.input('StockRequestID', sql.BigInt, stockRequestId);
            const lockRes = await lockReq.query(`
                SELECT StockRequestID, RequestNumber, Status
                FROM Warehouse_StockRequests WITH (UPDLOCK, HOLDLOCK)
                WHERE StockRequestID = @StockRequestID AND IsDeleted = 0
            `);

            if (lockRes.recordset.length === 0) {
                throw this.httpError(`Stock request ${stockRequestId} not found.`, 404);
            }

            const sr = lockRes.recordset[0];
            if (!['SUBMITTED', 'PENDING'].includes(this.normalizeStatus(sr.Status))) {
                throw this.httpError(`Request ${sr.RequestNumber} cannot be marked under review from status '${sr.Status}'.`);
            }

            const updReq = new sql.Request(transaction);
            updReq.input('StockRequestID', sql.BigInt, stockRequestId);
            updReq.input('Status', sql.NVarChar(50), this.STATUS.UNDER_REVIEW);
            updReq.input('UserID', sql.Int, actor.userId);
            await updReq.query(`
                UPDATE Warehouse_StockRequests
                SET Status = @Status,
                    UnderReviewByUserID = @UserID,
                    UnderReviewDate = SYSUTCDATETIME(),
                    ModifiedBy = @UserID,
                    ModifiedDate = SYSUTCDATETIME()
                WHERE StockRequestID = @StockRequestID
            `);

            await this.logAudit(transaction, {
                stockRequestId,
                action: 'MARKED_UNDER_REVIEW',
                previousStatus: sr.Status,
                newStatus: this.STATUS.UNDER_REVIEW,
                actorUserId: actor.userId,
                actorRole: actor.role,
                notes: 'Marked under review by Central Warehouse administrator.',
            });

            await transaction.commit();
            return { success: true, stockRequestId: Number(stockRequestId), requestNumber: sr.RequestNumber, status: this.STATUS.UNDER_REVIEW };
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    }

    /**
     * Warehouse Admin Decision: ADMINISTRATIVE REQUEST APPROVAL ONLY.
     *
     * Strictly separated from Stock Release:
     *  - Succeeds even when Warehouse inventory is ZERO.
     *  - Preserves original QuantityRequested.
     *  - Records ApprovedByUserID, ApprovedDate, and AdminRemarks.
     *  - NEVER deducts Warehouse inventory, NEVER creates distributions, NEVER increases Pharmacy stock.
     */
    static async approveStockRequest(pool, stockRequestId, adminUserId, payload = {}) {
        const actor = await this.resolveActor(pool, adminUserId, { requireWarehouseAdmin: true });
        const { adminRemarks = '', itemApprovals = [] } = payload;

        const approvalOverrideMap = new Map();
        if (Array.isArray(itemApprovals)) {
            for (const row of itemApprovals) {
                const itemId = Number(row.stockRequestItemId || row.StockRequestItemID);
                const qty = Number(row.approvedQuantity ?? row.QuantityApproved);
                if (itemId && !isNaN(qty)) {
                    approvalOverrideMap.set(itemId, qty);
                }
            }
        }

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const lockReq = new sql.Request(transaction);
            lockReq.input('StockRequestID', sql.BigInt, stockRequestId);
            const lockRes = await lockReq.query(`
                SELECT StockRequestID, RequestNumber, RequestingLocationID, Status
                FROM Warehouse_StockRequests WITH (UPDLOCK, HOLDLOCK)
                WHERE StockRequestID = @StockRequestID AND IsDeleted = 0
            `);

            if (lockRes.recordset.length === 0) {
                throw this.httpError(`Stock request ${stockRequestId} not found.`, 404);
            }

            const sr = lockRes.recordset[0];
            if (!this.isPendingReviewStatus(sr.Status)) {
                throw this.httpError(
                    `Request ${sr.RequestNumber} cannot be approved because its current status is '${sr.Status}'.`
                );
            }

            const itemsReq = new sql.Request(transaction);
            itemsReq.input('StockRequestID', sql.BigInt, stockRequestId);
            const itemsRes = await itemsReq.query(`
                SELECT sri.*, wm.ProductName
                FROM Warehouse_StockRequestItems sri
                JOIN Warehouse_Medicines wm ON sri.MedicineID = wm.MedicineID
                WHERE sri.StockRequestID = @StockRequestID AND sri.IsDeleted = 0
            `);

            if (itemsRes.recordset.length === 0) {
                throw this.httpError('Cannot approve a stock request with zero line items.');
            }

            let totalApprovedUnits = 0;
            const itemSnapshots = [];

            for (const item of itemsRes.recordset) {
                const itemId = Number(item.StockRequestItemID);
                const reqQty = Number(item.QuantityRequested);
                let approvedQty = reqQty;

                if (approvalOverrideMap.has(itemId)) {
                    approvedQty = Number(approvalOverrideMap.get(itemId));
                    if (!Number.isInteger(approvedQty) || approvedQty <= 0 || approvedQty > reqQty) {
                        throw this.httpError(
                            `Invalid approved quantity (${approvedQty}) for ${item.ProductName}. Must be between 1 and ${reqQty}.`
                        );
                    }
                }

                const liveStock = await this.calculateAvailableStock(transaction, item.MedicineID, 1);

                const updItemReq = new sql.Request(transaction);
                updItemReq.input('StockRequestItemID', sql.BigInt, itemId);
                updItemReq.input('QuantityApproved', sql.Int, approvedQty);
                updItemReq.input('QuantityUnfulfilled', sql.Int, approvedQty);
                updItemReq.input('ModifiedBy', sql.Int, actor.userId);

                await updItemReq.query(`
                    UPDATE Warehouse_StockRequestItems
                    SET QuantityApproved = @QuantityApproved,
                        QuantityUnfulfilled = @QuantityUnfulfilled,
                        ModifiedBy = @ModifiedBy,
                        ModifiedDate = SYSUTCDATETIME()
                    WHERE StockRequestItemID = @StockRequestItemID
                `);

                totalApprovedUnits += approvedQty;
                itemSnapshots.push({
                    medicineId: Number(item.MedicineID),
                    productName: item.ProductName,
                    quantityRequested: reqQty,
                    quantityApproved: approvedQty,
                    warehouseAvailableAtApproval: liveStock.availableUnreservedQuantity,
                    shortageAtApproval: Math.max(0, approvedQty - liveStock.availableUnreservedQuantity),
                });
            }

            const updSrReq = new sql.Request(transaction);
            updSrReq.input('StockRequestID', sql.BigInt, stockRequestId);
            updSrReq.input('Status', sql.NVarChar(50), this.STATUS.APPROVED);
            updSrReq.input('ApprovedByUserID', sql.Int, actor.userId);
            updSrReq.input('AdminRemarks', sql.NVarChar(sql.MAX), adminRemarks ? String(adminRemarks).trim() : null);
            updSrReq.input('ModifiedBy', sql.Int, actor.userId);

            await updSrReq.query(`
                UPDATE Warehouse_StockRequests
                SET Status = @Status,
                    ApprovedByUserID = @ApprovedByUserID,
                    ApprovedDate = SYSUTCDATETIME(),
                    AdminRemarks = @AdminRemarks,
                    ModifiedBy = @ModifiedBy,
                    ModifiedDate = SYSUTCDATETIME()
                WHERE StockRequestID = @StockRequestID
            `);

            await this.logAudit(transaction, {
                stockRequestId,
                action: 'APPROVED',
                previousStatus: sr.Status,
                newStatus: this.STATUS.APPROVED,
                actorUserId: actor.userId,
                actorRole: actor.role,
                notes: adminRemarks
                    ? `Request approved (${totalApprovedUnits} units): ${String(adminRemarks).trim()}`
                    : `Request approved (${totalApprovedUnits} units). No inventory deducted pending controlled release.`,
                metadata: { totalApprovedUnits, items: itemSnapshots },
            });

            await transaction.commit();
            return {
                success: true,
                stockRequestId: Number(stockRequestId),
                requestNumber: sr.RequestNumber,
                status: this.STATUS.APPROVED,
                totalApprovedUnits,
                itemsSnapshot: itemSnapshots,
            };
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    }

    /**
     * Warehouse Admin Decision: REJECTION WITH MANDATORY REASON.
     */
    static async rejectStockRequest(pool, stockRequestId, adminUserId, rejectionReason) {
        const actor = await this.resolveActor(pool, adminUserId, { requireWarehouseAdmin: true });
        if (!rejectionReason || !String(rejectionReason).trim()) {
            throw this.httpError('A mandatory rejection reason must be provided.');
        }

        const reason = String(rejectionReason).trim();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const lockReq = new sql.Request(transaction);
            lockReq.input('StockRequestID', sql.BigInt, stockRequestId);
            const lockRes = await lockReq.query(`
                SELECT StockRequestID, RequestNumber, Status
                FROM Warehouse_StockRequests WITH (UPDLOCK, HOLDLOCK)
                WHERE StockRequestID = @StockRequestID AND IsDeleted = 0
            `);

            if (lockRes.recordset.length === 0) {
                throw this.httpError(`Stock request ${stockRequestId} not found.`, 404);
            }

            const sr = lockRes.recordset[0];
            if (!this.isPendingReviewStatus(sr.Status)) {
                throw this.httpError(`Cannot reject request ${sr.RequestNumber} in status '${sr.Status}'.`);
            }

            const updateItemsReq = new sql.Request(transaction);
            updateItemsReq.input('StockRequestID', sql.BigInt, stockRequestId);
            updateItemsReq.input('ModifiedBy', sql.Int, actor.userId);
            await updateItemsReq.query(`
                UPDATE Warehouse_StockRequestItems
                SET QuantityApproved = 0,
                    QuantityUnfulfilled = QuantityRequested,
                    ModifiedBy = @ModifiedBy,
                    ModifiedDate = SYSUTCDATETIME()
                WHERE StockRequestID = @StockRequestID AND IsDeleted = 0
            `);

            const updateSrReq = new sql.Request(transaction);
            updateSrReq.input('StockRequestID', sql.BigInt, stockRequestId);
            updateSrReq.input('Status', sql.NVarChar(50), this.STATUS.REJECTED);
            updateSrReq.input('RejectionReason', sql.NVarChar(sql.MAX), reason);
            updateSrReq.input('RejectedByUserID', sql.Int, actor.userId);
            updateSrReq.input('ModifiedBy', sql.Int, actor.userId);

            await updateSrReq.query(`
                UPDATE Warehouse_StockRequests
                SET Status = @Status,
                    RejectionReason = @RejectionReason,
                    RejectedByUserID = @RejectedByUserID,
                    RejectedDate = SYSUTCDATETIME(),
                    ModifiedBy = @ModifiedBy,
                    ModifiedDate = SYSUTCDATETIME()
                WHERE StockRequestID = @StockRequestID
            `);

            await this.logAudit(transaction, {
                stockRequestId,
                action: 'REJECTED',
                previousStatus: sr.Status,
                newStatus: this.STATUS.REJECTED,
                actorUserId: actor.userId,
                actorRole: actor.role,
                notes: reason,
            });

            await transaction.commit();
            return {
                success: true,
                stockRequestId: Number(stockRequestId),
                requestNumber: sr.RequestNumber,
                status: this.STATUS.REJECTED,
                rejectionReason: reason,
            };
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    }

    /**
     * Record or update a stock shortage note and optionally transition status to STOCK_UNAVAILABLE
     * for an approved request awaiting Warehouse replenishment.
     */
    static async recordShortage(pool, stockRequestId, adminUserId, payload = {}) {
        const actor = await this.resolveActor(pool, adminUserId, { requireWarehouseAdmin: true });
        const { shortageNotes = '', markUnavailable = true } = payload;

        if (!shortageNotes || !String(shortageNotes).trim()) {
            throw this.httpError('Shortage note text is required when logging stock unavailability.');
        }

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const lockReq = new sql.Request(transaction);
            lockReq.input('StockRequestID', sql.BigInt, stockRequestId);
            const lockRes = await lockReq.query(`
                SELECT StockRequestID, RequestNumber, Status
                FROM Warehouse_StockRequests WITH (UPDLOCK, HOLDLOCK)
                WHERE StockRequestID = @StockRequestID AND IsDeleted = 0
            `);

            if (lockRes.recordset.length === 0) {
                throw this.httpError(`Stock request ${stockRequestId} not found.`, 404);
            }

            const sr = lockRes.recordset[0];
            if (!this.isApprovedReleasableStatus(sr.Status)) {
                throw this.httpError(`Shortage tracking applies only to approved pending-fulfillment requests. Current status: '${sr.Status}'.`);
            }

            const itemsReq = new sql.Request(transaction);
            itemsReq.input('StockRequestID', sql.BigInt, stockRequestId);
            const itemsRes = await itemsReq.query(`
                SELECT StockRequestItemID, MedicineID, QuantityRequested, QuantityApproved, QuantityReleased
                FROM Warehouse_StockRequestItems
                WHERE StockRequestID = @StockRequestID AND IsDeleted = 0
            `);

            let totalRemaining = 0;
            let totalReleasable = 0;
            for (const item of itemsRes.recordset) {
                const target = Number(item.QuantityApproved ?? item.QuantityRequested);
                const rem = Math.max(0, target - Number(item.QuantityReleased || 0));
                if (rem <= 0) continue;
                const stock = await this.calculateAvailableStock(transaction, item.MedicineID, 1);
                totalRemaining += rem;
                totalReleasable += Math.min(rem, stock.availableUnreservedQuantity);
            }

            if (totalRemaining === 0) {
                throw this.httpError('Request has no remaining unfulfilled quantities.');
            }

            let nextStatus = sr.Status;
            if (markUnavailable && totalReleasable === 0) {
                nextStatus = this.STATUS.STOCK_UNAVAILABLE;
            } else if (!markUnavailable && totalReleasable > 0 && this.normalizeStatus(sr.Status) === 'STOCK_UNAVAILABLE') {
                nextStatus = this.STATUS.READY_FOR_FULFILLMENT;
            }

            const updReq = new sql.Request(transaction);
            updReq.input('StockRequestID', sql.BigInt, stockRequestId);
            updReq.input('Status', sql.NVarChar(50), nextStatus);
            updReq.input('ShortageNotes', sql.NVarChar(sql.MAX), String(shortageNotes).trim());
            updReq.input('UserID', sql.Int, actor.userId);

            await updReq.query(`
                UPDATE Warehouse_StockRequests
                SET Status = @Status,
                    ShortageNotes = @ShortageNotes,
                    ShortageUpdatedByUserID = @UserID,
                    ShortageUpdatedDate = SYSUTCDATETIME(),
                    ModifiedBy = @UserID,
                    ModifiedDate = SYSUTCDATETIME()
                WHERE StockRequestID = @StockRequestID
            `);

            await this.logAudit(transaction, {
                stockRequestId,
                action: 'SHORTAGE_RECORDED',
                previousStatus: sr.Status,
                newStatus: nextStatus,
                actorUserId: actor.userId,
                actorRole: actor.role,
                notes: String(shortageNotes).trim(),
                metadata: { totalRemaining, totalReleasable },
            });

            await transaction.commit();
            return {
                success: true,
                stockRequestId: Number(stockRequestId),
                requestNumber: sr.RequestNumber,
                status: nextStatus,
                shortageNotes: String(shortageNotes).trim(),
            };
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    }

    /**
     * CONTROLLED STOCK RELEASE OPERATION (Strictly separated from Request Approval).
     *
     * Rules:
     *  - Available ONLY for approved requests (APPROVED, STOCK_UNAVAILABLE, READY_FOR_FULFILLMENT, PARTIALLY_FULFILLED).
     *  - Re-validates eligible unreserved non-expired Warehouse stock inside SQL transaction immediately before commit.
     *  - Scenario A (0 available): Fails cleanly; never creates 0/negative release transactions.
     *  - Scenario B (partial): Releases up to live available balance, sets PARTIALLY_FULFILLED.
     *  - Scenario C (sufficient): Releases requested/remaining balance, sets FULFILLED.
     *  - Deducts Warehouse inventory & writes signed negative Warehouse_InventoryTransactions.
     *  - Creates & issues Warehouse_Distributions record ('Issued') for Pharmacy confirmation.
     *  - Does NOT credit Pharmacy_Stocks (Pharmacy confirms receipt via receiveWarehouseDistribution).
     */
    static async releaseApprovedStock(pool, stockRequestId, adminUserId, payload = {}) {
        const actor = await this.resolveActor(pool, adminUserId, { requireWarehouseAdmin: true });
        const { remarks = '', items: requestedReleases = null } = payload;

        const releaseOverrideMap = new Map();
        if (Array.isArray(requestedReleases)) {
            for (const row of requestedReleases) {
                const qty = Number(row.releaseQuantity ?? row.quantity ?? 0);
                if (!Number.isInteger(qty) || qty < 0) {
                    throw this.httpError('Release quantity must be a non-negative whole number.');
                }
                if (row.stockRequestItemId || row.StockRequestItemID) {
                    releaseOverrideMap.set(Number(row.stockRequestItemId || row.StockRequestItemID), qty);
                } else if (row.medicineId || row.MedicineID) {
                    releaseOverrideMap.set(`med:${Number(row.medicineId || row.MedicineID)}`, qty);
                }
            }
        }

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const lockReq = new sql.Request(transaction);
            lockReq.input('StockRequestID', sql.BigInt, stockRequestId);
            const lockRes = await lockReq.query(`
                SELECT StockRequestID, RequestNumber, RequestingLocationID, RequestedByUserID, ApprovedByUserID, Status
                FROM Warehouse_StockRequests WITH (UPDLOCK, HOLDLOCK)
                WHERE StockRequestID = @StockRequestID AND IsDeleted = 0
            `);

            if (lockRes.recordset.length === 0) {
                throw this.httpError(`Stock request ${stockRequestId} not found.`, 404);
            }

            const sr = lockRes.recordset[0];
            if (!this.isApprovedReleasableStatus(sr.Status)) {
                throw this.httpError(
                    `Stock release is blocked: Request ${sr.RequestNumber} has status '${sr.Status}' and must be Approved before stock can be released.`
                );
            }

            const itemsReq = new sql.Request(transaction);
            itemsReq.input('StockRequestID', sql.BigInt, stockRequestId);
            const itemsRes = await itemsReq.query(`
                SELECT sri.*, wm.ProductName
                FROM Warehouse_StockRequestItems sri
                JOIN Warehouse_Medicines wm ON sri.MedicineID = wm.MedicineID
                WHERE sri.StockRequestID = @StockRequestID AND sri.IsDeleted = 0
                ORDER BY sri.StockRequestItemID ASC
            `);

            if (itemsRes.recordset.length === 0) {
                throw this.httpError('Cannot release stock for a request with no active line items.');
            }

            const releasePlan = [];
            let liveTotalEligibleAcrossRemaining = 0;

            for (const item of itemsRes.recordset) {
                const itemId = Number(item.StockRequestItemID);
                const approvedQty = Number(item.QuantityApproved ?? item.QuantityRequested);
                const releasedSoFar = Number(item.QuantityReleased || 0);
                const remaining = Math.max(0, approvedQty - releasedSoFar);
                if (remaining === 0) continue;

                const batchReq = new sql.Request(transaction);
                batchReq.input('MedicineID', sql.Int, item.MedicineID);
                batchReq.input('LocationID', sql.Int, 1);
                const batchRes = await batchReq.query(`
                    SELECT InventoryID, BatchNumber, LotNumber, ExpiryDate, QuantityAvailable, UnitCost
                    FROM Warehouse_Inventory WITH (UPDLOCK, HOLDLOCK)
                    WHERE MedicineID = @MedicineID
                      AND LocationID = @LocationID
                      AND QuantityAvailable > 0
                      AND Status = 'Active'
                      AND IsDeleted = 0
                      AND (ExpiryDate IS NULL OR ExpiryDate > CAST(GETUTCDATE() AS DATE))
                    ORDER BY
                      CASE WHEN ExpiryDate IS NULL THEN 1 ELSE 0 END,
                      ExpiryDate ASC,
                      CreatedDate ASC,
                      InventoryID ASC
                `);

                const liveAvail = batchRes.recordset.reduce((sum, b) => sum + Number(b.QuantityAvailable || 0), 0);
                liveTotalEligibleAcrossRemaining += liveAvail;

                let desiredRelease;
                if (releaseOverrideMap.has(itemId)) {
                    desiredRelease = releaseOverrideMap.get(itemId);
                } else if (releaseOverrideMap.has(`med:${item.MedicineID}`)) {
                    desiredRelease = releaseOverrideMap.get(`med:${item.MedicineID}`);
                } else if (Array.isArray(requestedReleases)) {
                    desiredRelease = 0;
                } else {
                    desiredRelease = Math.min(remaining, liveAvail);
                }

                if (desiredRelease > remaining) {
                    throw this.httpError(
                        `Cannot release ${desiredRelease} units of ${item.ProductName}: only ${remaining} remaining unit(s) are unfulfilled.`
                    );
                }
                if (desiredRelease > liveAvail) {
                    throw this.httpError(
                        `Insufficient eligible Warehouse stock for ${item.ProductName}. Requested release: ${desiredRelease}, live eligible available: ${liveAvail}.`
                    );
                }

                if (desiredRelease > 0) {
                    releasePlan.push({
                        item,
                        desiredRelease,
                        remaining,
                        batches: batchRes.recordset,
                    });
                }
            }

            const totalReleasedNow = releasePlan.reduce((sum, p) => sum + p.desiredRelease, 0);
            if (liveTotalEligibleAcrossRemaining === 0) {
                throw this.httpError('Stock release is unavailable because there is no eligible Warehouse inventory.');
            }
            if (totalReleasedNow <= 0) {
                throw this.httpError('Select at least one positive release quantity (> 0) to issue stock.');
            }

            const datePrefix = new Date().toISOString().slice(0, 7).replace('-', '');
            const distCountReq = new sql.Request(transaction);
            const distCountRes = await distCountReq.query(
                `SELECT COUNT(*) AS count FROM Warehouse_Distributions WHERE DistributionNumber LIKE 'DST-${datePrefix}%'`
            );
            const seq = (distCountRes.recordset[0]?.count || 0) + 1;
            const distNumber = `DST-${datePrefix}${String(seq).padStart(4, '0')}`;

            const distReq = new sql.Request(transaction);
            distReq.input('DistributionNumber', sql.NVarChar, distNumber);
            distReq.input('ReferenceStockRequestID', sql.BigInt, stockRequestId);
            distReq.input('SourceLocationID', sql.Int, 1);
            distReq.input('DestinationLocationID', sql.Int, sr.RequestingLocationID || 2);
            distReq.input('RequestedByUserID', sql.Int, sr.RequestedByUserID);
            distReq.input('ApprovedByUserID', sql.Int, sr.ApprovedByUserID || actor.userId);
            distReq.input('ReleasedByUserID', sql.Int, actor.userId);
            distReq.input('Remarks', sql.NVarChar, remarks ? String(remarks).trim() : `Controlled release for ${sr.RequestNumber}`);
            distReq.input('CreatedBy', sql.Int, actor.userId);

            const distRes = await distReq.query(`
                INSERT INTO Warehouse_Distributions (
                    DistributionNumber, ReferenceStockRequestID, SourceLocationID, DestinationLocationID,
                    RequestedByUserID, ApprovedByUserID, ReleasedByUserID, ReleasedDate,
                    Status, Remarks, CreatedBy, CreatedDate, IsDeleted
                )
                OUTPUT INSERTED.DistributionID
                VALUES (
                    @DistributionNumber, @ReferenceStockRequestID, @SourceLocationID, @DestinationLocationID,
                    @RequestedByUserID, @ApprovedByUserID, @ReleasedByUserID, SYSUTCDATETIME(),
                    'Issued', @Remarks, @CreatedBy, SYSUTCDATETIME(), 0
                )
            `);
            const distributionId = Number(distRes.recordset[0].DistributionID);

            const batchDeductions = [];
            for (const plan of releasePlan) {
                const { item, desiredRelease, batches } = plan;
                let leftToDeduct = desiredRelease;

                for (const batch of batches) {
                    if (leftToDeduct <= 0) break;
                    const take = Math.min(leftToDeduct, Number(batch.QuantityAvailable));
                    if (take <= 0) continue;

                    const unitCost = Number(batch.UnitCost || 0);
                    const totalCost = unitCost * take;

                    const dedReq = new sql.Request(transaction);
                    dedReq.input('InventoryID', sql.BigInt, batch.InventoryID);
                    dedReq.input('Qty', sql.Int, take);
                    dedReq.input('ModifiedBy', sql.Int, actor.userId);
                    const dedRes = await dedReq.query(`
                        UPDATE Warehouse_Inventory
                        SET QuantityAvailable = QuantityAvailable - @Qty,
                            ModifiedBy = @ModifiedBy,
                            ModifiedDate = SYSUTCDATETIME()
                        WHERE InventoryID = @InventoryID
                          AND QuantityAvailable >= @Qty
                          AND Status = 'Active'
                          AND IsDeleted = 0
                    `);
                    if (dedRes.rowsAffected[0] === 0) {
                        throw this.httpError(`Concurrent modification detected on batch ${batch.LotNumber || batch.BatchNumber}. Please retry.`);
                    }

                    const diReq = new sql.Request(transaction);
                    diReq.input('DistributionID', sql.BigInt, distributionId);
                    diReq.input('InventoryID', sql.BigInt, batch.InventoryID);
                    diReq.input('StockRequestItemID', sql.BigInt, item.StockRequestItemID);
                    diReq.input('Quantity', sql.Int, take);
                    diReq.input('UnitCost', sql.Decimal(18, 4), unitCost);
                    diReq.input('CreatedBy', sql.Int, actor.userId);
                    await diReq.query(`
                        INSERT INTO Warehouse_DistributionItems (
                            DistributionID, InventoryID, StockRequestItemID, Quantity,
                            UnitCostAtTimeOfRelease, CreatedBy, CreatedDate, IsDeleted
                        ) VALUES (
                            @DistributionID, @InventoryID, @StockRequestItemID, @Quantity,
                            @UnitCost, @CreatedBy, SYSUTCDATETIME(), 0
                        )
                    `);

                    const txReq = new sql.Request(transaction);
                    txReq.input('InventoryID', sql.BigInt, batch.InventoryID);
                    txReq.input('LocationID', sql.Int, 1);
                    txReq.input('MedicineID', sql.Int, item.MedicineID);
                    txReq.input('TransactionType', sql.NVarChar(50), 'DISTRIBUTION');
                    txReq.input('ReferenceDocument', sql.NVarChar, 'DISTRIBUTION');
                    txReq.input('ReferenceID', sql.BigInt, distributionId);
                    txReq.input('Quantity', sql.Int, -Math.abs(take));
                    txReq.input('UnitCost', sql.Decimal(18, 4), unitCost);
                    txReq.input('TotalCost', sql.Decimal(18, 4), totalCost);
                    txReq.input('Remarks', sql.NVarChar, `Controlled release for ${sr.RequestNumber} via ${distNumber}`);
                    txReq.input('CreatedBy', sql.Int, actor.userId);
                    await txReq.query(`
                        INSERT INTO Warehouse_InventoryTransactions (
                            InventoryID, LocationID, MedicineID, TransactionType, ReferenceDocument, ReferenceID,
                            Quantity, UnitCost, TotalCost, Remarks, CreatedBy, CreatedDate
                        ) VALUES (
                            @InventoryID, @LocationID, @MedicineID, @TransactionType, @ReferenceDocument, @ReferenceID,
                            @Quantity, @UnitCost, @TotalCost, @Remarks, @CreatedBy, SYSUTCDATETIME()
                        )
                    `);

                    batchDeductions.push({
                        medicineId: Number(item.MedicineID),
                        productName: item.ProductName,
                        inventoryId: Number(batch.InventoryID),
                        lotNumber: batch.LotNumber,
                        batchNumber: batch.BatchNumber,
                        expiryDate: batch.ExpiryDate ? new Date(batch.ExpiryDate).toISOString().slice(0, 10) : null,
                        releasedQuantity: take,
                    });

                    leftToDeduct -= take;
                }

                const newReleased = Number(item.QuantityReleased || 0) + desiredRelease;
                const newUnfulfilled = Math.max(0, Number(item.QuantityApproved ?? item.QuantityRequested) - newReleased);
                const updItemReq = new sql.Request(transaction);
                updItemReq.input('StockRequestItemID', sql.BigInt, item.StockRequestItemID);
                updItemReq.input('QuantityReleased', sql.Int, newReleased);
                updItemReq.input('QuantityUnfulfilled', sql.Int, newUnfulfilled);
                updItemReq.input('ModifiedBy', sql.Int, actor.userId);
                await updItemReq.query(`
                    UPDATE Warehouse_StockRequestItems
                    SET QuantityReleased = @QuantityReleased,
                        QuantityUnfulfilled = @QuantityUnfulfilled,
                        ModifiedBy = @ModifiedBy,
                        ModifiedDate = SYSUTCDATETIME()
                    WHERE StockRequestItemID = @StockRequestItemID
                `);
            }

            const remCheckReq = new sql.Request(transaction);
            remCheckReq.input('StockRequestID', sql.BigInt, stockRequestId);
            const remCheckRes = await remCheckReq.query(`
                SELECT ISNULL(SUM(
                    CASE
                        WHEN ISNULL(QuantityApproved, QuantityRequested) > ISNULL(QuantityReleased, 0)
                        THEN ISNULL(QuantityApproved, QuantityRequested) - ISNULL(QuantityReleased, 0)
                        ELSE 0
                    END
                ), 0) AS TotalRemainingOverall
                FROM Warehouse_StockRequestItems
                WHERE StockRequestID = @StockRequestID AND IsDeleted = 0
            `);

            const totalRemainingOverall = Number(remCheckRes.recordset[0]?.TotalRemainingOverall || 0);
            const newStatus = totalRemainingOverall > 0 ? this.STATUS.PARTIALLY_FULFILLED : this.STATUS.FULFILLED;

            const updSrReq = new sql.Request(transaction);
            updSrReq.input('StockRequestID', sql.BigInt, stockRequestId);
            updSrReq.input('Status', sql.NVarChar(50), newStatus);
            updSrReq.input('ModifiedBy', sql.Int, actor.userId);
            await updSrReq.query(`
                UPDATE Warehouse_StockRequests
                SET Status = @Status,
                    ModifiedBy = @ModifiedBy,
                    ModifiedDate = SYSUTCDATETIME()
                WHERE StockRequestID = @StockRequestID
            `);

            await this.consumeReservationsForDistribution(transaction, distributionId, actor.userId);

            await this.logAudit(transaction, {
                stockRequestId,
                distributionId,
                action: totalRemainingOverall > 0 ? 'PARTIAL_RELEASE' : 'FULL_RELEASE',
                previousStatus: sr.Status,
                newStatus,
                actorUserId: actor.userId,
                actorRole: actor.role,
                notes: remarks
                    ? `Issued ${distNumber} (${totalReleasedNow} units): ${String(remarks).trim()}`
                    : `Issued ${distNumber} (${totalReleasedNow} units). Remaining unfulfilled: ${totalRemainingOverall}.`,
                metadata: { distributionId, distributionNumber: distNumber, totalReleasedNow, totalRemainingOverall, batches: batchDeductions },
            });

            await transaction.commit();
            return {
                success: true,
                stockRequestId: Number(stockRequestId),
                requestNumber: sr.RequestNumber,
                distributionId,
                distributionNumber: distNumber,
                status: newStatus,
                totalReleasedNow,
                totalRemainingOverall,
                batches: batchDeductions,
            };
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    }

    /**
     * Cancel an existing request before any stock has been physically released.
     */
    static async cancelStockRequest(pool, stockRequestId, userId, cancellationReason = '') {
        const actor = await this.resolveActor(pool, userId, { requireWarehouseAdmin: false });
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const lockReq = new sql.Request(transaction);
            lockReq.input('StockRequestID', sql.BigInt, stockRequestId);
            const lockRes = await lockReq.query(`
                SELECT StockRequestID, RequestNumber, Status
                FROM Warehouse_StockRequests WITH (UPDLOCK, HOLDLOCK)
                WHERE StockRequestID = @StockRequestID AND IsDeleted = 0
            `);

            if (lockRes.recordset.length === 0) {
                throw this.httpError(`Stock request ${stockRequestId} not found.`, 404);
            }

            const sr = lockRes.recordset[0];
            if (this.isTerminalStatus(sr.Status)) {
                throw this.httpError(`Cannot cancel request ${sr.RequestNumber} in terminal status '${sr.Status}'.`);
            }

            const relCheckReq = new sql.Request(transaction);
            relCheckReq.input('StockRequestID', sql.BigInt, stockRequestId);
            const relCheckRes = await relCheckReq.query(`
                SELECT ISNULL(SUM(QuantityReleased), 0) AS ReleasedSum
                FROM Warehouse_StockRequestItems
                WHERE StockRequestID = @StockRequestID AND IsDeleted = 0
            `);
            if (Number(relCheckRes.recordset[0]?.ReleasedSum || 0) > 0) {
                throw this.httpError(
                    `Cannot cancel request ${sr.RequestNumber}: stock has already been partially released (${relCheckRes.recordset[0].ReleasedSum} units).`
                );
            }

            const resvReq = new sql.Request(transaction);
            resvReq.input('StockRequestID', sql.BigInt, stockRequestId);
            const resvRes = await resvReq.query(`
                SELECT ReservationID, InventoryID, ReservedQuantity
                FROM Warehouse_StockReservations WITH (UPDLOCK, HOLDLOCK)
                WHERE StockRequestID = @StockRequestID AND Status = 'Active' AND IsDeleted = 0
            `);

            for (const r of resvRes.recordset) {
                const updInvReq = new sql.Request(transaction);
                updInvReq.input('InventoryID', sql.BigInt, r.InventoryID);
                updInvReq.input('Qty', sql.Int, r.ReservedQuantity);
                await updInvReq.query(`
                    UPDATE Warehouse_Inventory
                    SET QuantityAvailable = QuantityAvailable + @Qty,
                        ReservedQuantity = CASE WHEN ReservedQuantity >= @Qty THEN ReservedQuantity - @Qty ELSE 0 END,
                        ModifiedDate = SYSUTCDATETIME()
                    WHERE InventoryID = @InventoryID
                `);

                const updRReq = new sql.Request(transaction);
                updRReq.input('ReservationID', sql.BigInt, r.ReservationID);
                updRReq.input('ModifiedBy', sql.Int, actor.userId);
                await updRReq.query(`
                    UPDATE Warehouse_StockReservations
                    SET Status = 'Released',
                        ReleasedDate = SYSUTCDATETIME(),
                        ModifiedBy = @ModifiedBy,
                        ModifiedDate = SYSUTCDATETIME()
                    WHERE ReservationID = @ReservationID
                `);
            }

            const updItemsReq = new sql.Request(transaction);
            updItemsReq.input('StockRequestID', sql.BigInt, stockRequestId);
            updItemsReq.input('ModifiedBy', sql.Int, actor.userId);
            await updItemsReq.query(`
                UPDATE Warehouse_StockRequestItems
                SET QuantityUnfulfilled = QuantityRequested,
                    ModifiedBy = @ModifiedBy,
                    ModifiedDate = SYSUTCDATETIME()
                WHERE StockRequestID = @StockRequestID AND IsDeleted = 0
            `);

            const reasonText = cancellationReason && String(cancellationReason).trim()
                ? String(cancellationReason).trim()
                : 'Cancelled prior to release';

            const updSrReq = new sql.Request(transaction);
            updSrReq.input('StockRequestID', sql.BigInt, stockRequestId);
            updSrReq.input('Status', sql.NVarChar(50), this.STATUS.CANCELLED);
            updSrReq.input('Reason', sql.NVarChar(sql.MAX), reasonText);
            updSrReq.input('ModifiedBy', sql.Int, actor.userId);

            await updSrReq.query(`
                UPDATE Warehouse_StockRequests
                SET Status = @Status,
                    RejectionReason = CASE WHEN RejectionReason IS NULL THEN @Reason ELSE RejectionReason END,
                    ModifiedBy = @ModifiedBy,
                    ModifiedDate = SYSUTCDATETIME()
                WHERE StockRequestID = @StockRequestID
            `);

            await this.logAudit(transaction, {
                stockRequestId,
                action: 'CANCELLED',
                previousStatus: sr.Status,
                newStatus: this.STATUS.CANCELLED,
                actorUserId: actor.userId,
                actorRole: actor.role,
                notes: reasonText,
            });

            await transaction.commit();
            return {
                success: true,
                stockRequestId: Number(stockRequestId),
                requestNumber: sr.RequestNumber,
                status: this.STATUS.CANCELLED,
            };
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    }

    /**
     * Consume active reservations (for any legacy reserved requests when distributing).
     */
    static async consumeReservationsForDistribution(transaction, distributionId, adminUserId) {
        const distReq = new sql.Request(transaction);
        distReq.input('DistributionID', sql.BigInt, distributionId);
        const distRes = await distReq.query(`
            SELECT DistributionID, ReferenceStockRequestID, DistributionNumber
            FROM Warehouse_Distributions WITH (UPDLOCK, HOLDLOCK)
            WHERE DistributionID = @DistributionID
        `);

        if (distRes.recordset.length === 0) return;
        const dist = distRes.recordset[0];
        if (!dist.ReferenceStockRequestID) return;

        const itemsReq = new sql.Request(transaction);
        itemsReq.input('DistributionID', sql.BigInt, distributionId);
        const itemsRes = await itemsReq.query(`
            SELECT InventoryID, Quantity
            FROM Warehouse_DistributionItems WITH (UPDLOCK, HOLDLOCK)
            WHERE DistributionID = @DistributionID AND IsDeleted = 0
        `);

        for (const item of itemsRes.recordset) {
            const resvReq = new sql.Request(transaction);
            resvReq.input('StockRequestID', sql.BigInt, dist.ReferenceStockRequestID);
            resvReq.input('InventoryID', sql.BigInt, item.InventoryID);
            const resvRes = await resvReq.query(`
                SELECT TOP 1 ReservationID, ReservedQuantity
                FROM Warehouse_StockReservations WITH (UPDLOCK, HOLDLOCK)
                WHERE StockRequestID = @StockRequestID
                  AND InventoryID = @InventoryID
                  AND Status = 'Active'
                  AND IsDeleted = 0
                ORDER BY ReservationID ASC
            `);

            if (resvRes.recordset.length > 0) {
                const r = resvRes.recordset[0];
                const updateResvReq = new sql.Request(transaction);
                updateResvReq.input('ReservationID', sql.BigInt, r.ReservationID);
                updateResvReq.input('ModifiedBy', sql.Int, adminUserId);
                await updateResvReq.query(`
                    UPDATE Warehouse_StockReservations
                    SET Status = 'Consumed',
                        ConsumedDate = SYSUTCDATETIME(),
                        ModifiedBy = @ModifiedBy,
                        ModifiedDate = SYSUTCDATETIME()
                    WHERE ReservationID = @ReservationID
                `);

                const invReq = new sql.Request(transaction);
                invReq.input('InventoryID', sql.BigInt, item.InventoryID);
                invReq.input('Qty', sql.Int, item.Quantity);
                await invReq.query(`
                    UPDATE Warehouse_Inventory
                    SET ReservedQuantity = CASE WHEN ReservedQuantity >= @Qty THEN ReservedQuantity - @Qty ELSE 0 END,
                        ModifiedDate = SYSUTCDATETIME()
                    WHERE InventoryID = @InventoryID
                `);
            }
        }
    }
}

module.exports = StockRequestService;
