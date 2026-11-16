const sql = require('mssql');

/**
 * Service for Pharmacy Management & Medicine Dispensing (Phase 7)
 * Implements FEFO allocation, atomic transactions, immutable inventory ledger,
 * warehouse distribution receiving, dispensing, and reversible cancellations.
 */
class PharmacyService {
    /**
     * Get Real-time KPI summary for Pharmacy Dashboard
     */
    static async getDashboardStats(pool) {
        // 1. Stock units, batches & distinct medicines with available stock
        const stockRes = await pool.request().query(`
            SELECT 
                COUNT(*) AS totalBatches,
                COUNT(CASE WHEN ExpiryDate > CAST(GETDATE() AS DATE) THEN 1 END) AS activeAvailableBatches,
                COUNT(DISTINCT CASE WHEN ExpiryDate > CAST(GETDATE() AS DATE) THEN MedicineID END) AS totalMedicines,
                COALESCE(SUM(CASE WHEN ExpiryDate > CAST(GETDATE() AS DATE) THEN Quantity ELSE 0 END), 0) AS totalAvailableStock,
                COALESCE(SUM(CASE WHEN ExpiryDate <= CAST(GETDATE() AS DATE) THEN Quantity ELSE 0 END), 0) AS totalExpiredUnits,
                COUNT(CASE WHEN ExpiryDate > CAST(GETDATE() AS DATE) AND DATEDIFF(day, CAST(GETDATE() AS DATE), ExpiryDate) <= 90 THEN 1 END) AS nearExpiryBatches,
                COUNT(CASE WHEN ExpiryDate <= CAST(GETDATE() AS DATE) THEN 1 END) AS expiredBatches
            FROM Pharmacy_Stocks
            WHERE IsActive = 1 AND Quantity > 0
        `);

        // 1b. Total active catalog medicines
        const catalogRes = await pool.request().query(`
            SELECT COUNT(*) AS totalCatalogMedicines
            FROM Warehouse_Medicines
            WHERE IsDeleted = 0
        `);

        // 2. Low-stock medicines count & alert list (total active non-expired stock <= 50)
        const lowStockRes = await pool.request().query(`
            SELECT 
                m.MedicineID,
                m.ProductName,
                m.GenericName,
                m.Dosage,
                m.Form,
                SUM(s.Quantity) AS TotalAvailableStock,
                COUNT(s.StockID) AS BatchCount
            FROM Pharmacy_Stocks s
            INNER JOIN Warehouse_Medicines m ON s.MedicineID = m.MedicineID
            WHERE s.IsActive = 1 AND s.Quantity > 0 AND s.ExpiryDate > CAST(GETDATE() AS DATE)
            GROUP BY m.MedicineID, m.ProductName, m.GenericName, m.Dosage, m.Form
            HAVING SUM(s.Quantity) <= 50
            ORDER BY SUM(s.Quantity) ASC
        `);

        // 2b. Expiring & Expired batch alerts (top 8)
        const expiryAlertsRes = await pool.request().query(`
            SELECT TOP 8
                s.StockID,
                s.MedicineID,
                m.ProductName,
                m.GenericName,
                s.LotNumber,
                s.ExpiryDate,
                s.Quantity,
                DATEDIFF(day, CAST(GETDATE() AS DATE), s.ExpiryDate) AS DaysToExpiry,
                CASE
                    WHEN s.ExpiryDate <= CAST(GETDATE() AS DATE) THEN 'Expired'
                    ELSE 'Near Expiry'
                END AS AlertStatus
            FROM Pharmacy_Stocks s
            INNER JOIN Warehouse_Medicines m ON s.MedicineID = m.MedicineID
            WHERE s.IsActive = 1 AND s.Quantity > 0
              AND DATEDIFF(day, CAST(GETDATE() AS DATE), s.ExpiryDate) <= 90
            ORDER BY s.ExpiryDate ASC
        `);

        // 3. Today's dispensing activity
        const todayDispRes = await pool.request().query(`
            SELECT 
                COUNT(DISTINCT s.SaleID) AS todayDispenseTransactions,
                COALESCE(SUM(d.Quantity), 0) AS todayDispensedUnits
            FROM Pharmacy_Sales s
            LEFT JOIN Pharmacy_Sales_Details d ON s.SaleID = d.SaleID
            WHERE CAST(s.SaleDate AS DATE) = CAST(GETDATE() AS DATE)
              AND s.Status = 'Completed'
        `);

        // 4. Warehouse integration metrics for City Pharmacy (LocationID = 2)
        const whIntegrationRes = await pool.request().query(`
            SELECT
                (SELECT COUNT(*) FROM Warehouse_Distributions WHERE Status = 'Issued' AND IsDeleted = 0 AND (DestinationLocationID = 2 OR DestinationLocationID IS NULL)) AS pendingDistributions,
                (SELECT COUNT(*) FROM Warehouse_StockRequests WHERE IsDeleted = 0 AND RequestingLocationID = 2 AND Status IN ('Pending', 'Submitted', 'SUBMITTED', 'Under Review', 'UNDER_REVIEW')) AS pendingStockRequests,
                (SELECT COUNT(*) FROM Warehouse_StockRequests WHERE IsDeleted = 0 AND RequestingLocationID = 2 AND Status IN ('Approved', 'APPROVED', 'STOCK_UNAVAILABLE', 'READY_FOR_FULFILLMENT', 'Partially Fulfilled', 'PARTIALLY_FULFILLED')) AS approvedStockRequests,
                (SELECT COUNT(*) FROM Warehouse_Distributions WHERE IsDeleted = 0 AND DestinationLocationID = 2 AND HasDiscrepancy = 1) AS discrepancyCount
        `);

        // 5. Recent dispensing activity (latest 6 records)
        const recentDispRes = await pool.request().query(`
            SELECT TOP 6
                s.SaleID,
                s.DispenseNumber,
                s.SaleDate,
                s.Status,
                s.PrescriptionNumber,
                s.PhysicianName,
                p.FullName AS PatientName,
                p.Barangay,
                u.FullName AS PharmacistName,
                COUNT(d.DetailID) AS ItemCount,
                COALESCE(SUM(d.Quantity), 0) AS TotalUnits,
                COALESCE(SUM(d.Quantity), 0) AS TotalQuantity
            FROM Pharmacy_Sales s
            INNER JOIN Patients p ON s.PatientID = p.PatientID
            LEFT JOIN Users u ON s.SoldBy = u.UserID
            LEFT JOIN Pharmacy_Sales_Details d ON s.SaleID = d.SaleID
            GROUP BY s.SaleID, s.DispenseNumber, s.SaleDate, s.Status, s.PrescriptionNumber, s.PhysicianName, p.FullName, p.Barangay, u.FullName
            ORDER BY s.SaleDate DESC, s.SaleID DESC
        `);

        // 6. Recent stock receipts (latest 5 RECEIPT entries)
        const recentReceiptsRes = await pool.request().query(`
            SELECT TOP 5
                t.TransactionID,
                t.ReferenceNumber,
                t.MedicineID,
                m.ProductName,
                m.GenericName,
                t.BatchNumber,
                t.Quantity,
                t.ExpiryDate,
                t.CreatedDate,
                u.FullName AS CreatedByName,
                t.Remarks
            FROM Pharmacy_InventoryTransactions t
            INNER JOIN Warehouse_Medicines m ON t.MedicineID = m.MedicineID
            LEFT JOIN Users u ON t.CreatedBy = u.UserID
            WHERE t.TransactionType = 'RECEIPT'
            ORDER BY t.CreatedDate DESC, t.TransactionID DESC
        `);

        // 7. Top dispensed medicines (last 30 days)
        const topMedsRes = await pool.request().query(`
            SELECT TOP 5
                m.MedicineID,
                m.ProductName,
                m.GenericName,
                COALESCE(SUM(d.Quantity), 0) AS TotalDispensed
            FROM Pharmacy_Sales_Details d
            INNER JOIN Pharmacy_Sales s ON d.SaleID = s.SaleID
            INNER JOIN Warehouse_Medicines m ON d.MedicineID = m.MedicineID
            WHERE s.Status = 'Completed'
              AND s.SaleDate >= DATEADD(day, -30, GETDATE())
            GROUP BY m.MedicineID, m.ProductName, m.GenericName
            ORDER BY TotalDispensed DESC
        `);

        const stats = stockRes.recordset[0] || {};
        const whStats = whIntegrationRes.recordset[0] || {};
        const todayTx = Number(todayDispRes.recordset[0]?.todayDispenseTransactions || 0);
        const todayUnits = Number(todayDispRes.recordset[0]?.todayDispensedUnits || 0);

        return {
            totalMedicines: Number(stats.totalMedicines || 0),
            totalCatalogMedicines: Number(catalogRes.recordset[0]?.totalCatalogMedicines || 0),
            totalBatches: Number(stats.totalBatches || 0),
            activeAvailableBatches: Number(stats.activeAvailableBatches || 0),
            totalAvailableStock: Number(stats.totalAvailableStock || 0),
            totalExpiredUnits: Number(stats.totalExpiredUnits || 0),
            nearExpiryBatches: Number(stats.nearExpiryBatches || 0),
            expiredBatches: Number(stats.expiredBatches || 0),
            lowStockCount: lowStockRes.recordset.length,
            pendingStockRequests: Number(whStats.pendingStockRequests || 0),
            approvedStockRequests: Number(whStats.approvedStockRequests || 0),
            pendingDistributions: Number(whStats.pendingDistributions || 0),
            discrepancyCount: Number(whStats.discrepancyCount || 0),
            todayDispenseTransactions: todayTx,
            todayDispensedUnits: todayUnits,
            dispensedTodayCount: todayTx,
            dispensedTodayUnits: todayUnits,
            lowStockAlerts: lowStockRes.recordset || [],
            expiryAlerts: expiryAlertsRes.recordset || [],
            recentDispensing: recentDispRes.recordset || [],
            recentReceipts: recentReceiptsRes.recordset || [],
            topDispensedMedicines: topMedsRes.recordset || []
        };
    }

    /**
     * Get Pharmacy Inventory Batches with status calculation and FEFO sorting
     */
    static async getPharmacyInventory(pool, filters = {}) {
        const { search, status, medicineId } = filters;
        let query = `
            SELECT 
                s.StockID,
                s.MedicineID,
                m.ProductName,
                m.GenericName,
                m.BrandName,
                m.Dosage,
                m.Form,
                COALESCE(mu.UnitName, m.Form, 'Unit') AS UnitName,
                m.Classification,
                s.Quantity,
                s.InitialQuantity,
                s.LotNumber,
                s.ExpiryDate,
                s.Price,
                s.DateReceived,
                s.WarehouseInventoryID,
                s.DistributionItemID,
                dist.DistributionNumber AS SourceDistributionNumber,
                s.IsActive,
                DATEDIFF(day, CAST(GETDATE() AS DATE), s.ExpiryDate) AS DaysToExpiry,
                CASE 
                    WHEN s.ExpiryDate <= CAST(GETDATE() AS DATE) THEN 'Expired'
                    WHEN DATEDIFF(day, CAST(GETDATE() AS DATE), s.ExpiryDate) <= 90 THEN 'Near Expiry'
                    WHEN s.Quantity <= 50 THEN 'Low Stock'
                    ELSE 'Good'
                END AS StockStatus
            FROM Pharmacy_Stocks s
            INNER JOIN Warehouse_Medicines m ON s.MedicineID = m.MedicineID
            LEFT JOIN Medicines legM ON s.MedicineID = legM.MedicineID
            LEFT JOIN Medicine_Unit mu ON legM.UnitID = mu.UnitID
            LEFT JOIN Warehouse_DistributionItems di ON s.DistributionItemID = di.DistributionItemID
            LEFT JOIN Warehouse_Distributions dist ON di.DistributionID = dist.DistributionID
            WHERE s.IsActive = 1
        `;

        const req = pool.request();

        if (medicineId) {
            query += ' AND s.MedicineID = @MedicineID';
            req.input('MedicineID', sql.Int, Number(medicineId));
        }

        if (search) {
            query += ` AND (
                m.ProductName LIKE @Search OR 
                m.GenericName LIKE @Search OR 
                s.LotNumber LIKE @Search OR
                dist.DistributionNumber LIKE @Search
            )`;
            req.input('Search', sql.NVarChar, '%' + search + '%');
        }

        if (status && status !== 'all') {
            if (status === 'expired') {
                query += ' AND s.ExpiryDate <= CAST(GETDATE() AS DATE)';
            } else if (status === 'near-expiry') {
                query += ' AND s.ExpiryDate > CAST(GETDATE() AS DATE) AND DATEDIFF(day, CAST(GETDATE() AS DATE), s.ExpiryDate) <= 90';
            } else if (status === 'low-stock') {
                query += ' AND s.ExpiryDate > CAST(GETDATE() AS DATE) AND s.Quantity <= 50 AND s.Quantity > 0';
            } else if (status === 'available') {
                query += ' AND s.ExpiryDate > CAST(GETDATE() AS DATE) AND s.Quantity > 0';
            }
        }

        query += ' ORDER BY s.ExpiryDate ASC, s.DateReceived ASC, s.StockID ASC';

        const result = await req.query(query);
        return result.recordset;
    }

    /**
     * Get Issued Warehouse Distributions awaiting receipt in Pharmacy
     * Scoped strictly to City Pharmacy (DestinationLocationID = 2)
     */
    static async getIssuedDistributions(pool) {
        const query = `
            SELECT 
                d.DistributionID,
                d.DistributionNumber,
                d.ReferenceStockRequestID,
                sr.RequestNumber AS StockRequestNumber,
                d.SourceLocationID,
                d.DestinationLocationID,
                d.ReleasedDate,
                d.Status,
                d.Remarks,
                relUser.FullName AS ReleasedByName,
                COUNT(di.DistributionItemID) AS TotalLineItems,
                COALESCE(SUM(di.Quantity), 0) AS TotalQuantity
            FROM Warehouse_Distributions d
            LEFT JOIN Warehouse_StockRequests sr ON d.ReferenceStockRequestID = sr.StockRequestID
            LEFT JOIN Users relUser ON d.ReleasedByUserID = relUser.UserID
            LEFT JOIN Warehouse_DistributionItems di ON d.DistributionID = di.DistributionID AND di.IsDeleted = 0
            WHERE d.Status = 'Issued' AND d.IsDeleted = 0
              AND (d.DestinationLocationID = 2 OR d.DestinationLocationID IS NULL)
            GROUP BY 
                d.DistributionID, d.DistributionNumber, d.ReferenceStockRequestID, sr.RequestNumber,
                d.SourceLocationID, d.DestinationLocationID, d.ReleasedDate, d.Status, d.Remarks, relUser.FullName
            ORDER BY d.ReleasedDate DESC, d.DistributionID DESC
        `;
        const res = await pool.request().query(query);
        return res.recordset;
    }

    /**
     * Create a Pharmacy Stock Request to the Central Warehouse (RequestingLocationID = 2)
     */
        /**
     * Get authoritative active medicines for Pharmacy Stock Requests
     * with live calculated Pharmacy usable stock and Central Warehouse available stock.
     */
    static async getMedicinesForRequest(pool, search = '') {
        const req = pool.request();
        let query = `
            SELECT 
                m.MedicineID as id,
                m.MedicineID,
                m.MedicineCode as medicineCode,
                m.MedicineCode,
                m.ProductName as productName,
                m.ProductName,
                m.GenericName as genericName,
                m.GenericName,
                m.BrandName as brandName,
                m.BrandName,
                m.Dosage as strength,
                m.Form as dosageForm,
                COALESCE(u.UnitName, m.Form, 'Unit') as unitName,
                COALESCE(u.UnitName, m.Form, 'Unit') as UnitName,
                COALESCE(c.CategoryName, 'General') as categoryName,
                COALESCE(c.CategoryName, 'General') as CategoryName,
                m.Status as status,
                ISNULL((
                    SELECT SUM(ps.Quantity)
                    FROM Pharmacy_Stocks ps
                    WHERE ps.MedicineID = m.MedicineID 
                      AND ps.IsActive = 1
                      AND (ps.ExpiryDate IS NULL OR ps.ExpiryDate > CAST(GETDATE() AS DATE))
                ), 0) AS pharmacyStock,
                ISNULL((
                    SELECT SUM(wi.QuantityAvailable)
                    FROM Warehouse_Inventory wi
                    WHERE wi.MedicineID = m.MedicineID
                      AND wi.Status = 'Active'
                      AND wi.QuantityAvailable > 0
                      AND (wi.ExpiryDate IS NULL OR wi.ExpiryDate > CAST(GETDATE() AS DATE))
                      AND wi.LocationID = 1
                ), 0) AS warehouseStock
            FROM Warehouse_Medicines m
            LEFT JOIN Warehouse_MedicineCategories c ON m.CategoryID = c.CategoryID
            LEFT JOIN Medicine_Unit u ON m.BaseUnitID = u.UnitID
            WHERE m.IsDeleted = 0 AND m.Status = 'Active'
        `;

        if (search && search.trim() !== '') {
            query += ` AND (
                m.ProductName LIKE @search OR
                m.GenericName LIKE @search OR
                m.BrandName LIKE @search OR
                m.MedicineCode LIKE @search OR
                m.Dosage LIKE @search OR
                m.Form LIKE @search
            )`;
            req.input('search', sql.NVarChar, `%${search.trim()}%`);
        }

        query += ` ORDER BY m.ProductName ASC;`;

        const res = await req.query(query);
        return res.recordset.map(row => ({
            ...row,
            id: Number(row.id),
            MedicineID: Number(row.MedicineID),
            pharmacyStock: Number(row.pharmacyStock || 0),
            warehouseStock: Number(row.warehouseStock || 0),
        }));
    }

    static async createStockRequest(pool, userId = 1, requestData = {}) {
        const { priority = 'Routine', purpose = 'City Pharmacy Restock', items = [] } = requestData;

        if (!Array.isArray(items) || items.length === 0) {
            throw new Error('Stock request must contain at least one medicine item.');
        }

        for (const item of items) {
            const medId = Number(item.medicineId);
            const qty = Number(item.quantity || item.requestedQuantity);
            if (!medId || !qty || qty <= 0) {
                throw new Error('Each line item must have a valid MedicineID and Quantity greater than 0.');
            }
        }

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const countReq = new sql.Request(transaction);
            const countRes = await countReq.query(`
                SELECT COUNT(*) AS count 
                FROM Warehouse_StockRequests 
                WHERE RequestNumber LIKE 'SR-PHM-${datePrefix}%'
            `);
            const seq = (countRes.recordset[0]?.count || 0) + 1;
            const requestNumber = `SR-PHM-${datePrefix}-${String(seq).padStart(4, '0')}`;

            const headerReq = new sql.Request(transaction);
            headerReq.input('RequestNumber', sql.NVarChar, requestNumber);
            headerReq.input('RequestingLocationID', sql.Int, 2); // City Pharmacy
            headerReq.input('RequestedByUserID', sql.Int, userId || 1);
            headerReq.input('Priority', sql.NVarChar, priority);
            headerReq.input('Purpose', sql.NVarChar, purpose);
            headerReq.input('CreatedBy', sql.Int, userId || 1);

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

            for (const item of items) {
                const medId = Number(item.medicineId);
                const qty = Number(item.quantity || item.requestedQuantity);
                const itemReq = new sql.Request(transaction);
                itemReq.input('StockRequestID', sql.BigInt, stockRequestId);
                itemReq.input('MedicineID', sql.Int, medId);
                itemReq.input('QuantityRequested', sql.Int, qty);
                itemReq.input('CreatedBy', sql.Int, userId || 1);

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
                locationId: 2,
                facility: 'City Pharmacy',
                status: 'Submitted',
                itemCount: items.length
            };
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    }

    /**
     * Get Pharmacy Stock Requests (RequestingLocationID = 2)
     */
    static async getStockRequests(pool, filters = {}) {
        const req = pool.request();
        let query = `
            SELECT 
                sr.StockRequestID,
                sr.RequestNumber,
                sr.RequestingLocationID,
                COALESCE(loc.LocationName, 'City Pharmacy') AS FacilityName,
                sr.RequestedByUserID,
                u.FullName AS RequestedByName,
                sr.Priority,
                sr.Purpose,
                sr.Status,
                sr.CreatedDate,
                sr.ApprovedDate,
                (SELECT COUNT(*) FROM Warehouse_StockRequestItems sri WHERE sri.StockRequestID = sr.StockRequestID AND sri.IsDeleted = 0) AS ItemCount,
                (SELECT ISNULL(SUM(QuantityRequested), 0) FROM Warehouse_StockRequestItems sri WHERE sri.StockRequestID = sr.StockRequestID AND sri.IsDeleted = 0) AS TotalQuantityRequested,
                (SELECT ISNULL(SUM(QuantityApproved), 0) FROM Warehouse_StockRequestItems sri WHERE sri.StockRequestID = sr.StockRequestID AND sri.IsDeleted = 0) AS TotalQuantityApproved,
                (SELECT ISNULL(SUM(QuantityReleased), 0) FROM Warehouse_StockRequestItems sri WHERE sri.StockRequestID = sr.StockRequestID AND sri.IsDeleted = 0) AS TotalQuantityReleased,
                (SELECT TOP 1 d.DistributionNumber FROM Warehouse_Distributions d WHERE d.ReferenceStockRequestID = sr.StockRequestID AND d.IsDeleted = 0 ORDER BY d.DistributionID DESC) AS DistributionNumber,
                (SELECT TOP 1 d.Status FROM Warehouse_Distributions d WHERE d.ReferenceStockRequestID = sr.StockRequestID AND d.IsDeleted = 0 ORDER BY d.DistributionID DESC) AS DistributionStatus
            FROM Warehouse_StockRequests sr
            LEFT JOIN Warehouse_Locations loc ON sr.RequestingLocationID = loc.LocationID
            LEFT JOIN Users u ON sr.RequestedByUserID = u.UserID
            WHERE sr.IsDeleted = 0 AND sr.RequestingLocationID = 2
        `;

        if (filters.status && filters.status !== 'ALL') {
            query += ' AND sr.Status = @status';
            req.input('status', sql.NVarChar, filters.status);
        }

        query += ' ORDER BY sr.CreatedDate DESC, sr.StockRequestID DESC';
        const res = await req.query(query);
        return res.recordset;
    }

    /**
     * Get Pharmacy Stock Request Details with line items
     */
    static async getStockRequestDetails(pool, requestId) {
        const req = pool.request();
        req.input('requestId', sql.BigInt, requestId);

        const headerRes = await req.query(`
            SELECT 
                sr.*,
                COALESCE(loc.LocationName, 'City Pharmacy') AS FacilityName,
                u.FullName AS RequestedByName
            FROM Warehouse_StockRequests sr
            LEFT JOIN Warehouse_Locations loc ON sr.RequestingLocationID = loc.LocationID
            LEFT JOIN Users u ON sr.RequestedByUserID = u.UserID
            WHERE sr.StockRequestID = @requestId AND sr.IsDeleted = 0
        `);

        if (headerRes.recordset.length === 0) {
            throw new Error('Stock Request not found.');
        }

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
            request: headerRes.recordset[0],
            items: itemsRes.recordset
        };
    }

    /**
     * Get details of a warehouse distribution including line items and batches
     */
    static async getDistributionDetails(pool, distributionId) {
        const headerReq = pool.request();
        headerReq.input('DistributionID', sql.BigInt, distributionId);
        const headerRes = await headerReq.query(`
            SELECT 
                d.*,
                relUser.FullName AS ReleasedByName,
                recUser.FullName AS ReceivedByName
            FROM Warehouse_Distributions d
            LEFT JOIN Users relUser ON d.ReleasedByUserID = relUser.UserID
            LEFT JOIN Users recUser ON d.ReceivedByUserID = recUser.UserID
            WHERE d.DistributionID = @DistributionID
        `);

        if (!headerRes.recordset.length) {
            throw new Error('Distribution not found');
        }

        const itemsReq = pool.request();
        itemsReq.input('DistributionID', sql.BigInt, distributionId);
        const itemsRes = await itemsReq.query(`
            SELECT 
                di.DistributionItemID,
                di.DistributionID,
                di.InventoryID,
                di.Quantity,
                di.UnitCostAtTimeOfRelease,
                wi.MedicineID,
                wi.LotNumber,
                wi.ExpiryDate,
                wi.LocationID,
                m.ProductName,
                m.GenericName,
                m.Dosage,
                m.Form
            FROM Warehouse_DistributionItems di
            INNER JOIN Warehouse_Inventory wi ON di.InventoryID = wi.InventoryID
            INNER JOIN Warehouse_Medicines m ON wi.MedicineID = m.MedicineID
            WHERE di.DistributionID = @DistributionID
        `);

        return {
            distribution: headerRes.recordset[0],
            items: itemsRes.recordset
        };
    }

    /**
     * Atomically receive a warehouse distribution into Pharmacy inventory.
     * Supports per-item physical count verification (accepted/received quantities, damaged quantities, shortages),
     * prevents duplicate receipts, writes only accepted quantities to Pharmacy_Stocks, updates distribution status
     * and discrepancy audit metadata, updates linked Warehouse_StockRequests status, and logs RECEIPT transactions.
     */
    static async receiveWarehouseDistribution(pool, distributionId, userId = 1, payloadOrRemarks = '') {
        const payload = typeof payloadOrRemarks === 'object' && payloadOrRemarks !== null
            ? payloadOrRemarks
            : { remarks: payloadOrRemarks || '' };
        const remarks = payload.remarks || '';
        const itemsArray = Array.isArray(payload.items) ? payload.items : (Array.isArray(payload.receivedItems) ? payload.receivedItems : []);

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // 1. Verify distribution exists with UPDLOCK and is currently 'Issued'
            const checkReq = new sql.Request(transaction);
            checkReq.input('DistributionID', sql.BigInt, distributionId);
            const distRes = await checkReq.query(`
                SELECT * FROM Warehouse_Distributions WITH (UPDLOCK, ROWLOCK)
                WHERE DistributionID = @DistributionID
            `);

            if (!distRes.recordset.length) {
                throw new Error(`Distribution ID ${distributionId} does not exist.`);
            }

            const dist = distRes.recordset[0];
            if (dist.Status === 'Received') {
                throw new Error(`Distribution ${dist.DistributionNumber} has already been received into Pharmacy.`);
            }
            if (dist.Status !== 'Issued') {
                throw new Error(`Distribution ${dist.DistributionNumber} cannot be received. Current status is '${dist.Status}', must be 'Issued'.`);
            }
            if (dist.DestinationLocationID && Number(dist.DestinationLocationID) !== 2) {
                throw new Error(`Access Denied: Distribution ${dist.DistributionNumber} is destined for Location ID ${dist.DestinationLocationID}, not City Pharmacy.`);
            }

            // 2. Double-check idempotency in inventory ledger
            const dupLedgerReq = new sql.Request(transaction);
            dupLedgerReq.input('DistributionID', sql.BigInt, distributionId);
            const dupLedgerRes = await dupLedgerReq.query(`
                SELECT COUNT(*) AS cnt FROM Pharmacy_InventoryTransactions
                WHERE ReferenceID = @DistributionID AND TransactionType = 'RECEIPT'
            `);
            if (dupLedgerRes.recordset[0]?.cnt > 0) {
                throw new Error(`Distribution ${dist.DistributionNumber} already has recorded stock receipt transactions.`);
            }

            // 3. Retrieve distribution line items
            const itemsReq = new sql.Request(transaction);
            itemsReq.input('DistributionID', sql.BigInt, distributionId);
            const itemsRes = await itemsReq.query(`
                SELECT 
                    di.DistributionItemID,
                    di.DistributionID,
                    di.InventoryID,
                    di.StockRequestItemID,
                    di.Quantity,
                    di.UnitCostAtTimeOfRelease,
                    wi.MedicineID,
                    wi.LotNumber,
                    wi.ExpiryDate,
                    wi.LocationID
                FROM Warehouse_DistributionItems di
                INNER JOIN Warehouse_Inventory wi ON di.InventoryID = wi.InventoryID
                WHERE di.DistributionID = @DistributionID AND di.IsDeleted = 0
            `);

            if (!itemsRes.recordset.length) {
                throw new Error(`No line items found for distribution ${dist.DistributionNumber}.`);
            }

            // Build confirmation map if per-item physical counts were submitted
            const itemConfirmMap = new Map();
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

            let hasDiscrepancy = Boolean(payload.discrepancyRemarks && String(payload.discrepancyRemarks).trim());
            const discrepancyNotes = [];
            if (payload.discrepancyRemarks && String(payload.discrepancyRemarks).trim()) {
                discrepancyNotes.push(String(payload.discrepancyRemarks).trim());
            }

            const receivedStocks = [];
            let totalIssuedUnits = 0;
            let totalAcceptedUnits = 0;

            // 4. Ingest each item into Pharmacy_Stocks & write immutable ledger
            for (const item of itemsRes.recordset) {
                const issuedQty = Number(item.Quantity);
                totalIssuedUnits += issuedQty;

                const conf = itemConfirmMap.get(Number(item.DistributionItemID)) || itemConfirmMap.get(Number(item.InventoryID));
                const receivedQty = (conf && conf.receivedQuantity !== undefined && !Number.isNaN(conf.receivedQuantity))
                    ? conf.receivedQuantity
                    : issuedQty;
                const damagedQty = conf ? Math.max(0, conf.damagedQuantity || 0) : 0;

                if (receivedQty < 0) {
                    throw new Error(`Accepted quantity cannot be negative for batch ${item.LotNumber}.`);
                }
                if (receivedQty > issuedQty) {
                    throw new Error(`Accepted quantity (${receivedQty}) cannot exceed issued quantity (${issuedQty}) for batch ${item.LotNumber}.`);
                }
                if (receivedQty + damagedQty > issuedQty) {
                    throw new Error(`Accepted (${receivedQty}) + Damaged (${damagedQty}) cannot exceed issued quantity (${issuedQty}) for batch ${item.LotNumber}.`);
                }

                const shortageQty = Math.max(0, issuedQty - receivedQty - damagedQty);
                totalAcceptedUnits += receivedQty;

                if (receivedQty !== issuedQty || damagedQty > 0) {
                    hasDiscrepancy = true;
                    const reason = conf?.discrepancyReason || 'Physical count variance upon Pharmacy receipt';
                    const details = [
                        `Issued: ${issuedQty}`,
                        `Accepted: ${receivedQty}`,
                        damagedQty > 0 ? `Damaged: ${damagedQty}` : null,
                        shortageQty > 0 ? `Shortage: ${shortageQty}` : null
                    ].filter(Boolean).join(', ');
                    discrepancyNotes.push(`Batch ${item.LotNumber} (${details} — ${reason})`);
                }

                // Update Warehouse_DistributionItems.ReceivedQuantity
                const updateItemReq = new sql.Request(transaction);
                updateItemReq.input('diId', sql.BigInt, item.DistributionItemID);
                updateItemReq.input('recQty', sql.Int, receivedQty);
                await updateItemReq.query(`
                    UPDATE Warehouse_DistributionItems
                    SET ReceivedQuantity = @recQty, ModifiedDate = SYSUTCDATETIME()
                    WHERE DistributionItemID = @diId
                `);

                // Preserve cumulative QuantityReleased recorded during Warehouse issuance; do not overwrite multi-batch/partial releases with single line receivedQty.

                // Only add positive accepted quantities to active Pharmacy_Stocks (update existing active batch if present)
                if (receivedQty > 0) {
                    const lotNum = item.LotNumber || item.BatchNumber || 'UNKNOWN';
                    const existingCheckReq = new sql.Request(transaction);
                    existingCheckReq.input('MedicineID', sql.Int, item.MedicineID);
                    existingCheckReq.input('LotNumber', sql.NVarChar, lotNum);
                    existingCheckReq.input('ExpiryDate', sql.Date, item.ExpiryDate);
                    existingCheckReq.input('LocationID', sql.Int, 2);

                    const existingCheckRes = await existingCheckReq.query(`
                        SELECT TOP 1 StockID 
                        FROM Pharmacy_Stocks WITH (UPDLOCK, ROWLOCK)
                        WHERE MedicineID = @MedicineID
                          AND LotNumber = @LotNumber
                          AND ExpiryDate = @ExpiryDate
                          AND LocationID = @LocationID
                          AND IsActive = 1
                    `);

                    let stockIdToUse;
                    if (existingCheckRes.recordset.length > 0) {
                        stockIdToUse = existingCheckRes.recordset[0].StockID;
                        const stockUpdateReq = new sql.Request(transaction);
                        stockUpdateReq.input('StockID', sql.Int, stockIdToUse);
                        stockUpdateReq.input('Quantity', sql.Int, receivedQty);
                        await stockUpdateReq.query(`
                            UPDATE Pharmacy_Stocks
                            SET Quantity = Quantity + @Quantity,
                                InitialQuantity = InitialQuantity + @Quantity,
                                ModifiedDate = GETDATE()
                            WHERE StockID = @StockID
                        `);
                    } else {
                        const stockInsertReq = new sql.Request(transaction);
                        stockInsertReq.input('MedicineID', sql.Int, item.MedicineID);
                        stockInsertReq.input('Quantity', sql.Int, receivedQty);
                        stockInsertReq.input('InitialQuantity', sql.Int, receivedQty);
                        stockInsertReq.input('UnitID', sql.Int, 1);
                        stockInsertReq.input('LotNumber', sql.NVarChar, lotNum);
                        stockInsertReq.input('ExpiryDate', sql.Date, item.ExpiryDate);
                        stockInsertReq.input('Price', sql.Decimal(18, 2), item.UnitCostAtTimeOfRelease || 0);
                        stockInsertReq.input('WarehouseInventoryID', sql.BigInt, item.InventoryID);
                        stockInsertReq.input('DistributionItemID', sql.BigInt, item.DistributionItemID);
                        stockInsertReq.input('LocationID', sql.Int, 2); // City Pharmacy

                        const stockRes = await stockInsertReq.query(`
                            INSERT INTO Pharmacy_Stocks (
                                MedicineID, Quantity, InitialQuantity, UnitID, LotNumber,
                                ExpiryDate, Price, DateReceived, WarehouseInventoryID,
                                DistributionItemID, LocationID, IsActive, CreatedDate
                            )
                            OUTPUT INSERTED.StockID
                            VALUES (
                                @MedicineID, @Quantity, @InitialQuantity, @UnitID, @LotNumber,
                                @ExpiryDate, @Price, GETDATE(), @WarehouseInventoryID,
                                @DistributionItemID, @LocationID, 1, GETDATE()
                            )
                        `);
                        stockIdToUse = stockRes.recordset[0].StockID;
                    }

                    // Log ledger transaction for accepted quantity
                    const ledgerReq = new sql.Request(transaction);
                    ledgerReq.input('StockID', sql.Int, stockIdToUse);
                    ledgerReq.input('MedicineID', sql.Int, item.MedicineID);
                    ledgerReq.input('TransactionType', sql.NVarChar, 'RECEIPT');
                    ledgerReq.input('ReferenceNumber', sql.NVarChar, dist.DistributionNumber);
                    ledgerReq.input('ReferenceID', sql.BigInt, distributionId);
                    ledgerReq.input('Quantity', sql.Int, receivedQty);
                    ledgerReq.input('BatchNumber', sql.NVarChar, item.LotNumber || 'UNKNOWN');
                    ledgerReq.input('ExpiryDate', sql.Date, item.ExpiryDate);
                    ledgerReq.input('Remarks', sql.NVarChar, `Received from Warehouse Distribution ${dist.DistributionNumber}${receivedQty !== issuedQty ? ` (Issued: ${issuedQty}, Accepted: ${receivedQty}, Damaged: ${damagedQty}, Shortage: ${shortageQty})` : ''}`);
                    ledgerReq.input('CreatedBy', sql.Int, userId);

                    await ledgerReq.query(`
                        INSERT INTO Pharmacy_InventoryTransactions (
                            StockID, MedicineID, TransactionType, ReferenceNumber, ReferenceID,
                            Quantity, BatchNumber, ExpiryDate, Remarks, CreatedBy, CreatedDate
                        )
                        VALUES (
                            @StockID, @MedicineID, @TransactionType, @ReferenceNumber, @ReferenceID,
                            @Quantity, @BatchNumber, @ExpiryDate, @Remarks, @CreatedBy, GETDATE()
                        )
                    `);

                    receivedStocks.push({
                        stockId: stockIdToUse,
                        medicineId: item.MedicineID,
                        lotNumber: item.LotNumber,
                        quantity: receivedQty,
                        issuedQuantity: issuedQty,
                        damagedQuantity: damagedQty,
                        shortageQuantity: shortageQty
                    });
                }
            }

            // 5. Update Warehouse_Distributions status to 'Received' with discrepancy tracking
            const discRemarks = discrepancyNotes.join('; ');
            const finalRemarks = [
                remarks ? `Pharmacy Receipt: ${remarks}` : 'Received by Pharmacy',
                discRemarks
            ].filter(Boolean).join(' | ');

            const updateDistReq = new sql.Request(transaction);
            updateDistReq.input('DistributionID', sql.BigInt, distributionId);
            updateDistReq.input('ReceivedByUserID', sql.Int, userId);
            updateDistReq.input('HasDiscrepancy', sql.Bit, hasDiscrepancy ? 1 : 0);
            updateDistReq.input('DiscrepancyRemarks', sql.NVarChar, discRemarks || null);
            updateDistReq.input('Remarks', sql.NVarChar, finalRemarks);

            const updateRes = await updateDistReq.query(`
                UPDATE Warehouse_Distributions
                SET Status = 'Received',
                    ReceivedByUserID = @ReceivedByUserID,
                    ReceivedDate = GETDATE(),
                    HasDiscrepancy = @HasDiscrepancy,
                    DiscrepancyRemarks = @DiscrepancyRemarks,
                    Remarks = CASE 
                        WHEN Remarks IS NULL OR Remarks = '' THEN @Remarks
                        ELSE Remarks + ' | ' + @Remarks
                    END,
                    ModifiedBy = @ReceivedByUserID,
                    ModifiedDate = GETDATE()
                WHERE DistributionID = @DistributionID AND Status = 'Issued'
            `);

            if (updateRes.rowsAffected[0] === 0) {
                throw new Error(`Concurrent modification detected: Distribution ${dist.DistributionNumber} was not in 'Issued' status during update.`);
            }

            // 6. Synchronize linked Warehouse_StockRequests status without erasing remaining unfulfilled items
            if (dist.ReferenceStockRequestID) {
                const checkRemReq = new sql.Request(transaction);
                checkRemReq.input('srId', sql.BigInt, dist.ReferenceStockRequestID);
                checkRemReq.input('curDistId', sql.BigInt, distributionId);
                const remRes = await checkRemReq.query(`
                    SELECT
                        ISNULL((
                            SELECT SUM(
                                CASE WHEN ISNULL(QuantityApproved, QuantityRequested) > ISNULL(QuantityReleased, 0)
                                     THEN ISNULL(QuantityApproved, QuantityRequested) - ISNULL(QuantityReleased, 0)
                                     ELSE 0 END
                            )
                            FROM Warehouse_StockRequestItems
                            WHERE StockRequestID = @srId AND IsDeleted = 0
                        ), 0) AS remainingUnfulfilled,
                        ISNULL((
                            SELECT COUNT(*)
                            FROM Warehouse_Distributions
                            WHERE ReferenceStockRequestID = @srId
                              AND DistributionID <> @curDistId
                              AND Status = 'Issued'
                              AND IsDeleted = 0
                        ), 0) AS pendingSiblingDistributions,
                        (SELECT TOP 1 Status FROM Warehouse_StockRequests WHERE StockRequestID = @srId) AS prevStatus
                `);

                const remInfo = remRes.recordset[0] || {};
                const remainingUnfulfilled = Number(remInfo.remainingUnfulfilled || 0);
                const pendingSiblings = Number(remInfo.pendingSiblingDistributions || 0);
                const prevStatus = remInfo.prevStatus || null;

                let srStatus = 'FULFILLED';
                if (remainingUnfulfilled > 0 || pendingSiblings > 0) {
                    srStatus = 'PARTIALLY_FULFILLED';
                } else if (hasDiscrepancy && totalAcceptedUnits < totalIssuedUnits) {
                    srStatus = 'Partially Received';
                }

                const updateSrReq = new sql.Request(transaction);
                updateSrReq.input('srId', sql.BigInt, dist.ReferenceStockRequestID);
                updateSrReq.input('srStatus', sql.NVarChar(50), srStatus);
                await updateSrReq.query(`
                    UPDATE Warehouse_StockRequests
                    SET Status = @srStatus, ModifiedDate = SYSUTCDATETIME()
                    WHERE StockRequestID = @srId
                `);

                // Record immutable Pharmacy receipt confirmation audit entry
                const auditReq = new sql.Request(transaction);
                auditReq.input('StockRequestID', sql.BigInt, dist.ReferenceStockRequestID);
                auditReq.input('DistributionID', sql.BigInt, distributionId);
                auditReq.input('Action', sql.NVarChar(60), hasDiscrepancy ? 'DISCREPANCY_LOGGED' : 'PHARMACY_RECEIVED');
                auditReq.input('PreviousStatus', sql.NVarChar(50), prevStatus);
                auditReq.input('NewStatus', sql.NVarChar(50), srStatus);
                auditReq.input('ActorUserID', sql.Int, userId);
                auditReq.input('Notes', sql.NVarChar(sql.MAX), finalRemarks);
                await auditReq.query(`
                    INSERT INTO Warehouse_StockRequestAudit (
                        StockRequestID, DistributionID, Action, PreviousStatus, NewStatus,
                        ActorUserID, ActorRole, Notes, CreatedDate
                    ) VALUES (
                        @StockRequestID, @DistributionID, @Action, @PreviousStatus, @NewStatus,
                        @ActorUserID, 'Pharmacy Staff', @Notes, SYSUTCDATETIME()
                    )
                `);
            }

            await transaction.commit();

            return {
                success: true,
                distributionId,
                distributionNumber: dist.DistributionNumber,
                status: 'Received',
                hasDiscrepancy,
                discrepancyRemarks: discRemarks || null,
                totalIssuedUnits,
                totalAcceptedUnits,
                itemsReceived: receivedStocks.length,
                stocks: receivedStocks
            };
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    }

    /**
     * Search Registered Patients
     */
    static async searchPatients(pool, search = '') {
        const req = pool.request();
        let query = `
            SELECT TOP 25
                PatientID,
                FirstName,
                MiddleName,
                Surname,
                FullName,
                BirthDate,
                Barangay,
                DetailedAddress,
                ContactNumber,
                Email,
                DateRegistered
            FROM Patients
        `;
        if (search) {
            query += `
                WHERE FullName LIKE @Search
                   OR FirstName LIKE @Search
                   OR Surname LIKE @Search
                   OR ContactNumber LIKE @Search
            `;
            req.input('Search', sql.NVarChar, '%' + search + '%');
        }
        query += ' ORDER BY FullName ASC';
        const res = await req.query(query);
        return res.recordset;
    }

    /**
     * Get eligible non-expired batches for a medicine sorted by FEFO
     */
    static async getEligibleBatchesForMedicine(pool, medicineId) {
        const req = pool.request();
        req.input('MedicineID', sql.Int, Number(medicineId));
        const res = await req.query(`
            SELECT 
                MIN(s.StockID) AS StockID,
                s.MedicineID,
                m.ProductName,
                m.GenericName,
                s.LotNumber,
                s.ExpiryDate,
                SUM(s.Quantity) AS Quantity,
                AVG(s.Price) AS Price,
                MIN(s.DateReceived) AS DateReceived,
                DATEDIFF(day, CAST(GETDATE() AS DATE), s.ExpiryDate) AS DaysToExpiry
            FROM Pharmacy_Stocks s
            INNER JOIN Warehouse_Medicines m ON s.MedicineID = m.MedicineID
            WHERE s.MedicineID = @MedicineID
              AND s.IsActive = 1
              AND s.Quantity > 0
              AND s.ExpiryDate > CAST(GETDATE() AS DATE)
            GROUP BY s.MedicineID, m.ProductName, m.GenericName, s.LotNumber, s.ExpiryDate
            ORDER BY s.ExpiryDate ASC, MIN(s.DateReceived) ASC, MIN(s.StockID) ASC
        `);
        return res.recordset;
    }

    /**
     * Preview FEFO batch allocation for requested dispensing items
     * Guarantees non-duplicate batches, earliest expiry ordering,
     * accurate allocation calculation per batch, and explicit shortage detection.
     */
    static async calculateFefoAllocationForItems(pool, items = []) {
        const results = [];
        for (const item of items) {
            const medId = Number(item.medicineId);
            const reqQty = Number(item.quantity) || 0;
            if (!medId || reqQty <= 0) continue;

            const batches = await PharmacyService.getEligibleBatchesForMedicine(pool, medId);
            const totalAvailable = batches.reduce((sum, b) => sum + (Number(b.Quantity) || 0), 0);
            const canFulfill = totalAvailable >= reqQty;
            const shortageQuantity = Math.max(0, reqQty - totalAvailable);
            const fulfillableQuantity = Math.min(reqQty, totalAvailable);

            let remainingToAllocate = fulfillableQuantity;
            const batchAllocations = [];

            for (const batch of batches) {
                if (remainingToAllocate <= 0) break;
                const batchAvail = Number(batch.Quantity) || 0;
                if (batchAvail <= 0) continue;

                const take = Math.min(remainingToAllocate, batchAvail);
                batchAllocations.push({
                    stockId: batch.StockID,
                    lotNumber: batch.LotNumber,
                    expiryDate: batch.ExpiryDate,
                    availableInBatch: batchAvail,
                    allocatedQuantity: take,
                    daysToExpiry: batch.DaysToExpiry
                });
                remainingToAllocate -= take;
            }

            results.push({
                medicineId: medId,
                productName: batches[0]?.ProductName || item.productName || 'Medicine',
                genericName: batches[0]?.GenericName || item.genericName || '',
                requestedQuantity: reqQty,
                availableStock: totalAvailable,
                fulfillableQuantity,
                shortageQuantity,
                canFulfill,
                allocations: batchAllocations
            });
        }
        return results;
    }

    /**
     * Dispense medicines to a patient.
     * Enforces FEFO batch allocation, checks against expired & insufficient stock,
     * atomically updates inventory with concurrency protection, logs sales & details,
     * and records signed negative entries in Pharmacy_InventoryTransactions.
     */
    static async dispenseMedicines(pool, data, userId = 1) {
        const { patientId, prescriptionNumber, physicianName, remarks, items } = data;

        if (!patientId) {
            throw new Error('Patient is required for dispensing.');
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
            throw new Error('At least one medicine item must be selected for dispensing.');
        }

        // Validate items structure
        for (const item of items) {
            if (!item.medicineId || !item.quantity || Number(item.quantity) <= 0) {
                throw new Error('Invalid medicine item or quantity specified.');
            }
        }

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // 1. Validate Patient
            const patReq = new sql.Request(transaction);
            patReq.input('PatientID', sql.Int, Number(patientId));
            const patRes = await patReq.query('SELECT PatientID, FullName FROM Patients WHERE PatientID = @PatientID');
            if (!patRes.recordset.length) {
                throw new Error(`Patient ID ${patientId} was not found in the registry.`);
            }
            const patient = patRes.recordset[0];

            // 2. Validate total non-expired stock availability for all requested medicines
            for (const item of items) {
                const stockCheckReq = new sql.Request(transaction);
                stockCheckReq.input('MedicineID', sql.Int, Number(item.medicineId));
                const stockCheckRes = await stockCheckReq.query(`
                    SELECT 
                        m.ProductName,
                        COALESCE(SUM(s.Quantity), 0) AS AvailableQuantity
                    FROM Warehouse_Medicines m
                    LEFT JOIN Pharmacy_Stocks s 
                           ON m.MedicineID = s.MedicineID 
                          AND s.IsActive = 1 
                          AND s.Quantity > 0 
                          AND s.ExpiryDate > CAST(GETDATE() AS DATE)
                    WHERE m.MedicineID = @MedicineID
                    GROUP BY m.ProductName
                `);

                if (!stockCheckRes.recordset.length) {
                    throw new Error(`Medicine ID ${item.medicineId} does not exist.`);
                }

                const medInfo = stockCheckRes.recordset[0];
                const available = Number(medInfo.AvailableQuantity || 0);
                const requested = Number(item.quantity);

                if (available < requested) {
                    throw new Error(`Insufficient non-expired stock for ${medInfo.ProductName}. Requested: ${requested}, Available: ${available}`);
                }
            }

            // 3. Generate sequential DispenseNumber: DSP-YYYYMMDD-XXXX
            const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const countReq = new sql.Request(transaction);
            countReq.input('TodayPrefix', sql.NVarChar, `DSP-${todayStr}%`);
            const countRes = await countReq.query(`
                SELECT COUNT(*) AS cnt FROM Pharmacy_Sales
                WHERE DispenseNumber LIKE @TodayPrefix
            `);
            const nextSeq = String((countRes.recordset[0]?.cnt || 0) + 1).padStart(4, '0');
            const dispenseNumber = `DSP-${todayStr}-${nextSeq}`;

            // 4. Insert into Pharmacy_Sales
            const saleReq = new sql.Request(transaction);
            saleReq.input('SoldBy', sql.Int, userId);
            saleReq.input('PatientID', sql.Int, Number(patientId));
            saleReq.input('DispenseNumber', sql.NVarChar, dispenseNumber);
            saleReq.input('Remarks', sql.NVarChar, remarks || null);
            saleReq.input('PrescriptionNumber', sql.NVarChar, prescriptionNumber || null);
            saleReq.input('PhysicianName', sql.NVarChar, physicianName || null);

            const saleRes = await saleReq.query(`
                INSERT INTO Pharmacy_Sales (
                    SoldBy, PatientID, SaleDate, DispenseNumber, Status,
                    Remarks, PrescriptionNumber, PhysicianName
                )
                OUTPUT INSERTED.SaleID
                VALUES (
                    @SoldBy, @PatientID, GETDATE(), @DispenseNumber, 'Completed',
                    @Remarks, @PrescriptionNumber, @PhysicianName
                )
            `);

            const saleId = saleRes.recordset[0].SaleID;
            const dispensedBatches = [];

            // 5. FEFO Allocation and atomic deduction for each medicine
            for (const item of items) {
                let qtyToAllocate = Number(item.quantity);

                // Fetch batches ordered by FEFO with UPDLOCK
                const batchReq = new sql.Request(transaction);
                batchReq.input('MedicineID', sql.Int, Number(item.medicineId));
                const batchesRes = await batchReq.query(`
                    SELECT 
                        s.StockID,
                        s.Quantity,
                        s.LotNumber,
                        s.ExpiryDate,
                        s.Price,
                        s.UnitID,
                        m.ProductName,
                        m.GenericName
                    FROM Pharmacy_Stocks s WITH (UPDLOCK, ROWLOCK)
                    JOIN Medicines m ON s.MedicineID = m.MedicineID
                    WHERE s.MedicineID = @MedicineID
                      AND s.IsActive = 1
                      AND s.Quantity > 0
                      AND s.ExpiryDate > CAST(GETDATE() AS DATE)
                    ORDER BY s.ExpiryDate ASC, s.DateReceived ASC, s.StockID ASC
                `);

                const batches = batchesRes.recordset;

                for (const batch of batches) {
                    if (qtyToAllocate <= 0) break;

                    const allocateFromBatch = Math.min(qtyToAllocate, batch.Quantity);

                    // Concurrency-guarded deduction
                    const deductReq = new sql.Request(transaction);
                    deductReq.input('StockID', sql.Int, batch.StockID);
                    deductReq.input('AllocatedQty', sql.Int, allocateFromBatch);

                    const deductRes = await deductReq.query(`
                        UPDATE Pharmacy_Stocks
                        SET Quantity = Quantity - @AllocatedQty,
                            ModifiedDate = GETDATE()
                        WHERE StockID = @StockID AND Quantity >= @AllocatedQty
                    `);

                    if (deductRes.rowsAffected[0] === 0) {
                        throw new Error(`Concurrency conflict: Insufficient stock available in batch ${batch.LotNumber} during deduction.`);
                    }

                    // Insert detail line
                    const detailReq = new sql.Request(transaction);
                    detailReq.input('SaleID', sql.Int, saleId);
                    detailReq.input('MedicineID', sql.Int, Number(item.medicineId));
                    detailReq.input('StockID', sql.Int, batch.StockID);
                    detailReq.input('LotNumber', sql.NVarChar, batch.LotNumber);
                    detailReq.input('ExpiryDate', sql.Date, batch.ExpiryDate);
                    detailReq.input('Quantity', sql.Int, allocateFromBatch);
                    detailReq.input('Price', sql.Decimal(18, 2), batch.Price || 0);
                    detailReq.input('UnitID', sql.Int, batch.UnitID || 1);
                    detailReq.input('DosageInstructions', sql.NVarChar, item.dosageInstructions || null);

                    const detailRes = await detailReq.query(`
                        INSERT INTO Pharmacy_Sales_Details (
                            SaleID, MedicineID, Quantity, Price, UnitID,
                            StockID, LotNumber, ExpiryDate, DosageInstructions
                        )
                        OUTPUT INSERTED.DetailID
                        VALUES (
                            @SaleID, @MedicineID, @Quantity, @Price, @UnitID,
                            @StockID, @LotNumber, @ExpiryDate, @DosageInstructions
                        )
                    `);

                    // Record signed negative quantity in immutable ledger
                    const ledgerReq = new sql.Request(transaction);
                    ledgerReq.input('StockID', sql.Int, batch.StockID);
                    ledgerReq.input('MedicineID', sql.Int, Number(item.medicineId));
                    ledgerReq.input('TransactionType', sql.NVarChar, 'DISPENSE');
                    ledgerReq.input('ReferenceNumber', sql.NVarChar, dispenseNumber);
                    ledgerReq.input('ReferenceID', sql.BigInt, saleId);
                    ledgerReq.input('Quantity', sql.Int, -allocateFromBatch);
                    ledgerReq.input('BatchNumber', sql.NVarChar, batch.LotNumber);
                    ledgerReq.input('ExpiryDate', sql.Date, batch.ExpiryDate);
                    ledgerReq.input('Remarks', sql.NVarChar, `Dispensed to ${patient.FullName} (${dispenseNumber})`);
                    ledgerReq.input('CreatedBy', sql.Int, userId);

                    await ledgerReq.query(`
                        INSERT INTO Pharmacy_InventoryTransactions (
                            StockID, MedicineID, TransactionType, ReferenceNumber, ReferenceID,
                            Quantity, BatchNumber, ExpiryDate, Remarks, CreatedBy, CreatedDate
                        )
                        VALUES (
                            @StockID, @MedicineID, @TransactionType, @ReferenceNumber, @ReferenceID,
                            @Quantity, @BatchNumber, @ExpiryDate, @Remarks, @CreatedBy, GETDATE()
                        )
                    `);

                    dispensedBatches.push({
                        detailId: detailRes.recordset[0].DetailID,
                        stockId: batch.StockID,
                        medicineId: Number(item.medicineId),
                        productName: batch.ProductName || 'Medicine',
                        lotNumber: batch.LotNumber,
                        expiryDate: batch.ExpiryDate,
                        quantity: allocateFromBatch
                    });

                    qtyToAllocate -= allocateFromBatch;
                }

                if (qtyToAllocate > 0) {
                    throw new Error(`Could not fulfill entire quantity for medicine ID ${item.medicineId}. Remaining unallocated: ${qtyToAllocate}`);
                }
            }

            await transaction.commit();

            return {
                success: true,
                saleId,
                dispenseNumber,
                referenceNumber: dispenseNumber,
                patientId: Number(patientId),
                patientName: patient.FullName,
                dispensedItems: dispensedBatches
            };
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    }

    /**
     * Get Dispensing History with filters and aggregated quantities
     */
    static async getDispensingHistory(pool, filters = {}) {
        const { search, status, startDate, endDate } = filters;
        let query = `
            SELECT 
                s.SaleID,
                s.DispenseNumber,
                s.SaleDate,
                s.Status,
                s.PrescriptionNumber,
                s.PhysicianName,
                s.Remarks,
                s.CancelledDate,
                s.CancellationReason,
                p.PatientID,
                p.FullName AS PatientName,
                p.Barangay,
                p.ContactNumber,
                u.FullName AS PharmacistName,
                cu.FullName AS CancelledByName,
                COUNT(d.DetailID) AS TotalLineItems,
                COALESCE(SUM(d.Quantity), 0) AS TotalUnits
            FROM Pharmacy_Sales s
            INNER JOIN Patients p ON s.PatientID = p.PatientID
            LEFT JOIN Users u ON s.SoldBy = u.UserID
            LEFT JOIN Users cu ON s.CancelledBy = cu.UserID
            LEFT JOIN Pharmacy_Sales_Details d ON s.SaleID = d.SaleID
            WHERE 1=1
        `;

        const req = pool.request();

        if (search) {
            query += ` AND (
                s.DispenseNumber LIKE @Search OR 
                p.FullName LIKE @Search OR 
                s.PrescriptionNumber LIKE @Search OR 
                s.PhysicianName LIKE @Search
            )`;
            req.input('Search', sql.NVarChar, '%' + search + '%');
        }

        if (status && status !== 'all') {
            query += ' AND s.Status = @Status';
            req.input('Status', sql.NVarChar, status);
        }

        if (startDate) {
            query += ' AND CAST(s.SaleDate AS DATE) >= @StartDate';
            req.input('StartDate', sql.Date, startDate);
        }

        if (endDate) {
            query += ' AND CAST(s.SaleDate AS DATE) <= @EndDate';
            req.input('EndDate', sql.Date, endDate);
        }

        query += `
            GROUP BY 
                s.SaleID, s.DispenseNumber, s.SaleDate, s.Status,
                s.PrescriptionNumber, s.PhysicianName, s.Remarks,
                s.CancelledDate, s.CancellationReason,
                p.PatientID, p.FullName, p.Barangay, p.ContactNumber,
                u.FullName, cu.FullName
            ORDER BY s.SaleDate DESC, s.SaleID DESC
        `;

        const res = await req.query(query);
        return res.recordset;
    }

    /**
     * Get Dispensing Details voucher for viewing and printable record
     */
    static async getDispensingDetails(pool, saleId) {
        const headerReq = pool.request();
        headerReq.input('SaleID', sql.Int, Number(saleId));
        const headerRes = await headerReq.query(`
            SELECT 
                s.*,
                p.FullName AS PatientName,
                p.BirthDate AS PatientBirthDate,
                p.Barangay AS PatientBarangay,
                p.DetailedAddress AS PatientAddress,
                p.ContactNumber AS PatientContact,
                u.FullName AS PharmacistName,
                cu.FullName AS CancelledByName
            FROM Pharmacy_Sales s
            INNER JOIN Patients p ON s.PatientID = p.PatientID
            LEFT JOIN Users u ON s.SoldBy = u.UserID
            LEFT JOIN Users cu ON s.CancelledBy = cu.UserID
            WHERE s.SaleID = @SaleID
        `);

        if (!headerRes.recordset.length) {
            throw new Error(`Dispensing record ${saleId} not found.`);
        }

        const itemsReq = pool.request();
        itemsReq.input('SaleID', sql.Int, Number(saleId));
        const itemsRes = await itemsReq.query(`
            SELECT 
                d.DetailID,
                d.SaleID,
                d.MedicineID,
                d.StockID,
                d.LotNumber,
                d.ExpiryDate,
                d.Quantity,
                d.Price,
                d.DosageInstructions,
                m.ProductName,
                m.GenericName,
                m.BrandName,
                m.Dosage,
                m.Form
            FROM Pharmacy_Sales_Details d
            INNER JOIN Warehouse_Medicines m ON d.MedicineID = m.MedicineID
            WHERE d.SaleID = @SaleID
            ORDER BY d.DetailID ASC
        `);

        return {
            dispensing: headerRes.recordset[0],
            items: itemsRes.recordset
        };
    }

    /**
     * Cancel / Reverse a dispensing transaction.
     * Preserves audit history, restores stock into Pharmacy_Stocks,
     * logs positive REVERSAL entries in Pharmacy_InventoryTransactions,
     * and sets status to 'Cancelled' with reason and authorized user.
     */
    static async reverseDispensing(pool, saleId, data, userId = 1) {
        const { reason } = data;
        if (!reason || !reason.trim()) {
            throw new Error('A valid cancellation reason is required for audit compliance.');
        }

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // 1. Fetch sale with UPDLOCK
            const saleReq = new sql.Request(transaction);
            saleReq.input('SaleID', sql.Int, Number(saleId));
            const saleRes = await saleReq.query(`
                SELECT * FROM Pharmacy_Sales WITH (UPDLOCK, ROWLOCK)
                WHERE SaleID = @SaleID
            `);

            if (!saleRes.recordset.length) {
                throw new Error(`Dispensing record ${saleId} does not exist.`);
            }

            const sale = saleRes.recordset[0];
            if (sale.Status === 'Cancelled') {
                throw new Error(`Dispensing record ${sale.DispenseNumber} has already been cancelled.`);
            }
            if (sale.Status !== 'Completed') {
                throw new Error(`Cannot reverse transaction with status '${sale.Status}'.`);
            }

            // 2. Fetch line items
            const itemsReq = new sql.Request(transaction);
            itemsReq.input('SaleID', sql.Int, Number(saleId));
            const itemsRes = await itemsReq.query(`
                SELECT * FROM Pharmacy_Sales_Details WHERE SaleID = @SaleID
            `);

            if (!itemsRes.recordset.length) {
                throw new Error(`No line items found for dispensing record ${sale.DispenseNumber}.`);
            }

            // 3. Compensating stock restoration for each item
            for (const item of itemsRes.recordset) {
                if (item.StockID) {
                    const restoreReq = new sql.Request(transaction);
                    restoreReq.input('StockID', sql.Int, item.StockID);
                    restoreReq.input('Qty', sql.Int, item.Quantity);
                    await restoreReq.query(`
                        UPDATE Pharmacy_Stocks
                        SET Quantity = Quantity + @Qty,
                            ModifiedDate = GETDATE()
                        WHERE StockID = @StockID
                    `);
                }

                // Log positive REVERSAL in immutable ledger
                const ledgerReq = new sql.Request(transaction);
                ledgerReq.input('StockID', sql.Int, item.StockID || null);
                ledgerReq.input('MedicineID', sql.Int, item.MedicineID);
                ledgerReq.input('TransactionType', sql.NVarChar, 'REVERSAL');
                ledgerReq.input('ReferenceNumber', sql.NVarChar, sale.DispenseNumber);
                ledgerReq.input('ReferenceID', sql.BigInt, Number(saleId));
                ledgerReq.input('Quantity', sql.Int, item.Quantity);
                ledgerReq.input('BatchNumber', sql.NVarChar, item.LotNumber || 'UNKNOWN');
                ledgerReq.input('ExpiryDate', sql.Date, item.ExpiryDate);
                ledgerReq.input('Remarks', sql.NVarChar, `Reversal: ${reason.trim()}`);
                ledgerReq.input('CreatedBy', sql.Int, userId);

                await ledgerReq.query(`
                    INSERT INTO Pharmacy_InventoryTransactions (
                        StockID, MedicineID, TransactionType, ReferenceNumber, ReferenceID,
                        Quantity, BatchNumber, ExpiryDate, Remarks, CreatedBy, CreatedDate
                    )
                    VALUES (
                        @StockID, @MedicineID, @TransactionType, @ReferenceNumber, @ReferenceID,
                        @Quantity, @BatchNumber, @ExpiryDate, @Remarks, @CreatedBy, GETDATE()
                    )
                `);
            }

            // 4. Update header to 'Cancelled'
            const updateReq = new sql.Request(transaction);
            updateReq.input('SaleID', sql.Int, Number(saleId));
            updateReq.input('CancelledBy', sql.Int, userId);
            updateReq.input('CancellationReason', sql.NVarChar, reason.trim());

            await updateReq.query(`
                UPDATE Pharmacy_Sales
                SET Status = 'Cancelled',
                    CancelledBy = @CancelledBy,
                    CancelledDate = GETDATE(),
                    CancellationReason = @CancellationReason
                WHERE SaleID = @SaleID AND Status = 'Completed'
            `);

            await transaction.commit();

            return {
                success: true,
                message: `Dispensing ${sale.DispenseNumber} reversed successfully. Stock has been restored.`,
                saleId,
                dispenseNumber: sale.DispenseNumber
            };
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    }

    /**
     * Get Stock Movement History (Audit Trail)
     */
    static async getStockMovementHistory(pool, filters = {}) {
        const { search, transactionType, medicineId, batch, reference, startDate, endDate } = filters;
        let query = `
            SELECT 
                t.TransactionID,
                t.TransactionID AS MovementID,
                t.StockID,
                t.MedicineID,
                t.TransactionType,
                CASE
                    WHEN t.TransactionType = 'RECEIPT' THEN 'Inventory Receipt'
                    WHEN t.TransactionType = 'DISPENSE' THEN 'Medicine Dispensing'
                    WHEN t.TransactionType = 'REVERSAL' THEN 'Transaction Reversal'
                    ELSE 'Stock Adjustment'
                END AS MovementLabel,
                t.ReferenceNumber,
                t.ReferenceID,
                t.Quantity,
                CASE
                    WHEN t.TransactionType = 'DISPENSE' THEN -ABS(t.Quantity)
                    ELSE ABS(t.Quantity)
                END AS QuantityChange,
                t.BatchNumber,
                t.BatchNumber AS LotNumber,
                t.ExpiryDate,
                CASE
                    WHEN t.TransactionType = 'RECEIPT' THEN 'Central Warehouse'
                    WHEN t.TransactionType = 'DISPENSE' THEN 'City Pharmacy'
                    WHEN t.TransactionType = 'REVERSAL' THEN 'Patient Voucher Reversal'
                    ELSE 'Physical Inventory Count'
                END AS SourceFacility,
                CASE
                    WHEN t.TransactionType = 'RECEIPT' THEN 'City Pharmacy'
                    WHEN t.TransactionType = 'DISPENSE' THEN 'Outpatient / Patient'
                    WHEN t.TransactionType = 'REVERSAL' THEN 'City Pharmacy'
                    ELSE 'City Pharmacy'
                END AS DestinationFacility,
                t.Remarks,
                t.CreatedBy,
                t.CreatedDate,
                t.CreatedDate AS CreatedAt,
                m.ProductName,
                m.GenericName,
                m.Dosage,
                m.Form,
                u.FullName AS CreatedByName
            FROM Pharmacy_InventoryTransactions t
            INNER JOIN Warehouse_Medicines m ON t.MedicineID = m.MedicineID
            LEFT JOIN Users u ON t.CreatedBy = u.UserID
            WHERE 1=1
        `;

        const req = pool.request();

        if (medicineId) {
            query += ' AND t.MedicineID = @MedicineID';
            req.input('MedicineID', sql.Int, Number(medicineId));
        }

        if (transactionType && transactionType !== 'all' && transactionType !== 'ALL') {
            query += ' AND t.TransactionType = @TransactionType';
            req.input('TransactionType', sql.NVarChar, transactionType);
        }

        if (batch) {
            query += ' AND t.BatchNumber LIKE @Batch';
            req.input('Batch', sql.NVarChar, '%' + batch + '%');
        }

        if (reference) {
            query += ' AND t.ReferenceNumber LIKE @Reference';
            req.input('Reference', sql.NVarChar, '%' + reference + '%');
        }

        if (search) {
            query += ` AND (
                m.ProductName LIKE @Search OR 
                m.GenericName LIKE @Search OR 
                t.BatchNumber LIKE @Search OR 
                t.ReferenceNumber LIKE @Search OR
                t.Remarks LIKE @Search
            )`;
            req.input('Search', sql.NVarChar, '%' + search + '%');
        }

        if (startDate) {
            query += ' AND CAST(t.CreatedDate AS DATE) >= @StartDate';
            req.input('StartDate', sql.Date, startDate);
        }

        if (endDate) {
            query += ' AND CAST(t.CreatedDate AS DATE) <= @EndDate';
            req.input('EndDate', sql.Date, endDate);
        }

        query += ' ORDER BY t.CreatedDate DESC, t.TransactionID DESC';

        const res = await req.query(query);
        return res.recordset;
    }
}

module.exports = PharmacyService;
