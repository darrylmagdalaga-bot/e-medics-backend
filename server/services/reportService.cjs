const sql = require('mssql');

class ReportService {

    /**
     * 1. Central Warehouse Distribution Report
     */
    static async getWarehouseDistributionReport(pool, filters = {}) {
        const { startDate, endDate, locationId, status, search } = filters;
        let query = `
            SELECT 
                d.DistributionID,
                d.DistributionNumber,
                d.ReferenceStockRequestID,
                sr.RequestNumber AS StockRequestNumber,
                d.SourceLocationID,
                srcLoc.LocationName AS SourceLocationName,
                d.DestinationLocationID,
                destLoc.LocationName AS DestinationLocationName,
                destLoc.LocationType AS DestinationType,
                d.Status,
                d.HasDiscrepancy,
                d.DiscrepancyRemarks,
                d.ReleasedDate,
                d.ReceivedDate,
                relUser.FullName AS ReleasedByName,
                recUser.FullName AS ReceivedByName,
                ISNULL((SELECT SUM(Quantity) FROM Warehouse_DistributionItems WHERE DistributionID = d.DistributionID AND IsDeleted = 0), 0) AS TotalQuantityIssued,
                ISNULL((SELECT SUM(ISNULL(ReceivedQuantity, Quantity)) FROM Warehouse_DistributionItems WHERE DistributionID = d.DistributionID AND IsDeleted = 0), 0) AS TotalQuantityReceived,
                ISNULL((SELECT COUNT(*) FROM Warehouse_DistributionItems WHERE DistributionID = d.DistributionID AND IsDeleted = 0), 0) AS ItemCount
            FROM Warehouse_Distributions d
            LEFT JOIN Warehouse_StockRequests sr ON d.ReferenceStockRequestID = sr.StockRequestID
            LEFT JOIN Warehouse_Locations srcLoc ON d.SourceLocationID = srcLoc.LocationID
            LEFT JOIN Warehouse_Locations destLoc ON d.DestinationLocationID = destLoc.LocationID
            LEFT JOIN Users relUser ON d.ReleasedByUserID = relUser.UserID
            LEFT JOIN Users recUser ON d.ReceivedByUserID = recUser.UserID
            WHERE d.IsDeleted = 0
        `;

        const req = pool.request();

        if (startDate) {
            query += ' AND d.ReleasedDate >= @startDate';
            req.input('startDate', sql.DateTime2, new Date(startDate));
        }

        if (endDate) {
            query += ' AND d.ReleasedDate <= @endDate';
            req.input('endDate', sql.DateTime2, new Date(endDate));
        }

        if (locationId) {
            query += ' AND d.DestinationLocationID = @locationId';
            req.input('locationId', sql.Int, Number(locationId));
        }

        if (status) {
            query += ' AND d.Status = @status';
            req.input('status', sql.NVarChar, status);
        }

        if (search) {
            query += ' AND (d.DistributionNumber LIKE @search OR sr.RequestNumber LIKE @search OR destLoc.LocationName LIKE @search)';
            req.input('search', sql.NVarChar, `%${search}%`);
        }

        query += ' ORDER BY d.ReleasedDate DESC';

        const res = await req.query(query);
        const records = res.recordset;

        const totalIssued = records.reduce((acc, r) => acc + (r.TotalQuantityIssued || 0), 0);
        const totalReceived = records.reduce((acc, r) => acc + (r.TotalQuantityReceived || 0), 0);
        const discrepancyCount = records.filter(r => r.HasDiscrepancy).length;

        return {
            reportTitle: 'Central Warehouse Distribution Report',
            generatedDate: new Date().toISOString(),
            summary: {
                totalDistributions: records.length,
                totalIssuedUnits: totalIssued,
                totalReceivedUnits: totalReceived,
                discrepancyCount
            },
            data: records
        };
    }

    /**
     * 2. City Pharmacy Medicine Release Report
     */
    static async getPharmacyReleaseReport(pool, filters = {}) {
        const { startDate, endDate, medicineId, search } = filters;
        let query = `
            SELECT 
                s.SaleID,
                s.DispenseNumber,
                s.SaleDate,
                s.PatientID,
                p.FullName AS PatientName,
                p.Barangay AS PatientBarangay,
                p.PhilHealthNumber,
                s.Status,
                s.PrescriptionNumber,
                u.FullName AS DispensedByName,
                sd.DetailID,
                sd.MedicineID,
                m.ProductName,
                m.GenericName,
                m.Dosage,
                m.Form,
                sd.LotNumber,
                sd.ExpiryDate,
                sd.Quantity,
                sd.Price,
                (sd.Quantity * sd.Price) AS TotalAmount
            FROM Pharmacy_Sales s
            INNER JOIN Pharmacy_Sales_Details sd ON s.SaleID = sd.SaleID
            INNER JOIN Medicines m ON sd.MedicineID = m.MedicineID
            LEFT JOIN Patients p ON s.PatientID = p.PatientID
            LEFT JOIN Users u ON s.SoldBy = u.UserID
            WHERE s.Status != 'Cancelled'
        `;

        const req = pool.request();

        if (startDate) {
            query += ' AND s.SaleDate >= @startDate';
            req.input('startDate', sql.DateTime2, new Date(startDate));
        }

        if (endDate) {
            query += ' AND s.SaleDate <= @endDate';
            req.input('endDate', sql.DateTime2, new Date(endDate));
        }

        if (medicineId) {
            query += ' AND sd.MedicineID = @medicineId';
            req.input('medicineId', sql.Int, Number(medicineId));
        }

        if (search) {
            query += ' AND (s.DispenseNumber LIKE @search OR p.FullName LIKE @search OR m.ProductName LIKE @search OR sd.LotNumber LIKE @search)';
            req.input('search', sql.NVarChar, `%${search}%`);
        }

        query += ' ORDER BY s.SaleDate DESC';

        const res = await req.query(query);
        const records = res.recordset;
        const totalUnits = records.reduce((acc, r) => acc + (r.Quantity || 0), 0);

        return {
            reportTitle: 'City Pharmacy Medicine Release Report',
            generatedDate: new Date().toISOString(),
            summary: {
                totalDispensingEvents: records.length,
                totalUnitsDispensed: totalUnits
            },
            data: records
        };
    }

    /**
     * 3. Barangay Medicine Receiving Report
     */
    static async getBarangayReceivingReport(pool, filters = {}) {
        const { startDate, endDate, locationId, hasDiscrepancy, search } = filters;
        let query = `
            SELECT 
                d.DistributionID,
                d.DistributionNumber,
                d.DestinationLocationID,
                destLoc.LocationName AS BarangayHealthStation,
                destLoc.LocationName AS BarangayName,
                d.ReleasedDate,
                d.ReceivedDate,
                recUser.FullName AS ReceivedByName,
                relUser.FullName AS ReleasedByName,
                d.HasDiscrepancy,
                d.DiscrepancyRemarks,
                di.DistributionItemID,
                di.Quantity AS QuantityIssued,
                ISNULL(di.ReceivedQuantity, di.Quantity) AS QuantityReceived,
                (di.Quantity - ISNULL(di.ReceivedQuantity, di.Quantity)) AS Variance,
                m.ProductName,
                m.GenericName,
                m.Dosage,
                m.Form,
                wi.LotNumber,
                wi.ExpiryDate
            FROM Warehouse_Distributions d
            INNER JOIN Warehouse_DistributionItems di ON d.DistributionID = di.DistributionID
            INNER JOIN Warehouse_Inventory wi ON di.InventoryID = wi.InventoryID
            INNER JOIN Medicines m ON wi.MedicineID = m.MedicineID
            LEFT JOIN Warehouse_Locations destLoc ON d.DestinationLocationID = destLoc.LocationID
            LEFT JOIN Users recUser ON d.ReceivedByUserID = recUser.UserID
            LEFT JOIN Users relUser ON d.ReleasedByUserID = relUser.UserID
            WHERE d.Status = 'Received' AND di.IsDeleted = 0
                  AND destLoc.LocationType = 'Barangay'
        `;

        const req = pool.request();

        if (startDate) {
            query += ' AND d.ReceivedDate >= @startDate';
            req.input('startDate', sql.DateTime2, new Date(startDate));
        }

        if (endDate) {
            query += ' AND d.ReceivedDate <= @endDate';
            req.input('endDate', sql.DateTime2, new Date(endDate));
        }

        if (locationId) {
            query += ' AND d.DestinationLocationID = @locationId';
            req.input('locationId', sql.Int, Number(locationId));
        }

        if (hasDiscrepancy === true || hasDiscrepancy === 'true' || hasDiscrepancy === '1') {
            query += ' AND d.HasDiscrepancy = 1';
        }

        if (search) {
            query += ' AND (d.DistributionNumber LIKE @search OR destLoc.LocationName LIKE @search OR m.ProductName LIKE @search OR wi.LotNumber LIKE @search)';
            req.input('search', sql.NVarChar, `%${search}%`);
        }

        query += ' ORDER BY d.ReceivedDate DESC';

        const res = await req.query(query);
        const records = res.recordset;

        const totalIssued = records.reduce((acc, r) => acc + r.QuantityIssued, 0);
        const totalReceived = records.reduce((acc, r) => acc + r.QuantityReceived, 0);
        const totalVariance = totalIssued - totalReceived;

        return {
            reportTitle: 'Barangay Medicine Receiving Report',
            generatedDate: new Date().toISOString(),
            summary: {
                totalReceiptLines: records.length,
                totalIssuedUnits: totalIssued,
                totalReceivedUnits: totalReceived,
                totalVarianceUnits: totalVariance
            },
            data: records
        };
    }

    /**
     * 4. Barangay Patient Disbursement Report
     */
    static async getBarangayDisbursementReport(pool, filters = {}) {
        const { startDate, endDate, locationId, status, search } = filters;
        let query = `
            SELECT 
                d.DisbursementID,
                d.DisbursementNumber,
                d.BarangayName,
                d.LocationID,
                loc.LocationName AS HealthStationName,
                d.RecipientName,
                d.DisbursementDate,
                d.Status,
                d.Remarks,
                d.ReversalReason,
                d.ReversedDate,
                bhwUser.FullName AS DisbursedByName,
                revUser.FullName AS ReversedByName,
                di.DetailID AS DisbursementItemID,
                di.MedicineID,
                m.ProductName,
                m.GenericName,
                m.Dosage,
                m.Form,
                di.LotNumber,
                bs.ExpiryDate,
                di.Quantity,
                di.DosageInstructions
            FROM Barangay_Disbursements d
            INNER JOIN Barangay_DisbursementItems di ON d.DisbursementID = di.DisbursementID
            INNER JOIN Medicines m ON di.MedicineID = m.MedicineID
            LEFT JOIN Barangay_Stocks bs ON di.StockID = bs.StockID
            LEFT JOIN Warehouse_Locations loc ON d.LocationID = loc.LocationID
            LEFT JOIN Users bhwUser ON d.DisbursedByUserID = bhwUser.UserID
            LEFT JOIN Users revUser ON d.ReversedByUserID = revUser.UserID
            WHERE 1=1
        `;

        const req = pool.request();

        if (startDate) {
            query += ' AND d.DisbursementDate >= @startDate';
            req.input('startDate', sql.DateTime2, new Date(startDate));
        }

        if (endDate) {
            query += ' AND d.DisbursementDate <= @endDate';
            req.input('endDate', sql.DateTime2, new Date(endDate));
        }

        if (locationId) {
            query += ' AND d.LocationID = @locationId';
            req.input('locationId', sql.Int, Number(locationId));
        }

        if (status) {
            query += ' AND d.Status = @status';
            req.input('status', sql.NVarChar, status);
        }

        if (search) {
            query += ' AND (d.DisbursementNumber LIKE @search OR d.RecipientName LIKE @search OR d.BarangayName LIKE @search OR m.ProductName LIKE @search)';
            req.input('search', sql.NVarChar, `%${search}%`);
        }

        query += ' ORDER BY d.DisbursementDate DESC';

        const res = await req.query(query);
        const records = res.recordset;

        const totalActiveUnits = records.filter(r => r.Status !== 'Reversed').reduce((acc, r) => acc + r.Quantity, 0);
        const totalReversedUnits = records.filter(r => r.Status === 'Reversed').reduce((acc, r) => acc + r.Quantity, 0);

        return {
            reportTitle: 'Barangay Patient Disbursement Report',
            generatedDate: new Date().toISOString(),
            summary: {
                totalDisbursementRecords: records.length,
                totalActiveUnitsDisbursed: totalActiveUnits,
                totalReversedUnits: totalReversedUnits
            },
            data: records
        };
    }

    /**
     * 5. Barangay Inventory Balance Report
     */
    static async getBarangayInventoryBalanceReport(pool, filters = {}) {
        const { locationId, search, expiryStatus } = filters;
        let query = `
            SELECT 
                s.StockID,
                s.BarangayName,
                s.LocationID,
                loc.LocationName AS HealthStationName,
                s.MedicineID,
                m.ProductName,
                m.GenericName,
                m.Dosage,
                m.Form,
                s.LotNumber,
                s.ExpiryDate,
                s.Quantity AS CurrentAvailableQuantity,
                s.InitialQuantity,
                s.UnitCost,
                (s.Quantity * s.UnitCost) AS TotalLotValue,
                s.DateReceived,
                DATEDIFF(day, GETDATE(), s.ExpiryDate) AS DaysUntilExpiry,
                CASE 
                    WHEN s.ExpiryDate <= GETDATE() THEN 'Expired'
                    WHEN DATEDIFF(day, GETDATE(), s.ExpiryDate) <= 30 THEN 'Critical'
                    WHEN DATEDIFF(day, GETDATE(), s.ExpiryDate) <= 90 THEN 'Warning'
                    ELSE 'Good'
                END AS ExpiryStatus
            FROM Barangay_Stocks s
            INNER JOIN Medicines m ON s.MedicineID = m.MedicineID
            LEFT JOIN Warehouse_Locations loc ON s.LocationID = loc.LocationID
            WHERE s.IsActive = 1
        `;

        const req = pool.request();

        if (locationId) {
            query += ' AND s.LocationID = @locationId';
            req.input('locationId', sql.Int, Number(locationId));
        }

        if (search) {
            query += ' AND (m.ProductName LIKE @search OR m.GenericName LIKE @search OR s.LotNumber LIKE @search OR s.BarangayName LIKE @search)';
            req.input('search', sql.NVarChar, `%${search}%`);
        }

        query += ' ORDER BY s.BarangayName ASC, s.ExpiryDate ASC';

        const res = await req.query(query);
        let records = res.recordset;

        if (expiryStatus && expiryStatus !== 'ALL') {
            records = records.filter(r => r.ExpiryStatus === expiryStatus);
        }

        const totalStockUnits = records.reduce((acc, r) => acc + r.CurrentAvailableQuantity, 0);
        const totalValue = records.reduce((acc, r) => acc + r.TotalLotValue, 0);
        const expiredUnits = records.filter(r => r.ExpiryStatus === 'Expired').reduce((acc, r) => acc + r.CurrentAvailableQuantity, 0);

        return {
            reportTitle: 'Barangay Inventory Balance Report',
            generatedDate: new Date().toISOString(),
            summary: {
                totalLotsAudited: records.length,
                totalAvailableUnits: totalStockUnits,
                totalInventoryValue: totalValue,
                expiredStockUnits: expiredUnits
            },
            data: records
        };
    }

    /**
     * 6. Unreceived Distribution Report (In-Transit Shipments)
     */
    static async getUnreceivedDistributionReport(pool, filters = {}) {
        const { locationId, search } = filters;
        let query = `
            SELECT 
                d.DistributionID,
                d.DistributionNumber,
                d.ReferenceStockRequestID,
                sr.RequestNumber AS StockRequestNumber,
                d.DestinationLocationID,
                destLoc.LocationName AS DestinationLocationName,
                destLoc.LocationType AS DestinationType,
                d.ReleasedDate,
                DATEDIFF(day, d.ReleasedDate, GETDATE()) AS DaysPending,
                relUser.FullName AS ReleasedByName,
                d.Remarks,
                ISNULL((SELECT SUM(Quantity) FROM Warehouse_DistributionItems WHERE DistributionID = d.DistributionID AND IsDeleted = 0), 0) AS TotalQuantityIssued,
                ISNULL((SELECT COUNT(*) FROM Warehouse_DistributionItems WHERE DistributionID = d.DistributionID AND IsDeleted = 0), 0) AS ItemCount
            FROM Warehouse_Distributions d
            LEFT JOIN Warehouse_StockRequests sr ON d.ReferenceStockRequestID = sr.StockRequestID
            LEFT JOIN Warehouse_Locations destLoc ON d.DestinationLocationID = destLoc.LocationID
            LEFT JOIN Users relUser ON d.ReleasedByUserID = relUser.UserID
            WHERE d.Status = 'Issued' AND d.IsDeleted = 0
        `;

        const req = pool.request();

        if (locationId) {
            query += ' AND d.DestinationLocationID = @locationId';
            req.input('locationId', sql.Int, Number(locationId));
        }

        if (search) {
            query += ' AND (d.DistributionNumber LIKE @search OR destLoc.LocationName LIKE @search OR sr.RequestNumber LIKE @search)';
            req.input('search', sql.NVarChar, `%${search}%`);
        }

        query += ' ORDER BY d.ReleasedDate ASC';

        const res = await req.query(query);
        const records = res.recordset;
        const totalPendingUnits = records.reduce((acc, r) => acc + r.TotalQuantityIssued, 0);

        return {
            reportTitle: 'Unreceived In-Transit Distribution Report',
            generatedDate: new Date().toISOString(),
            summary: {
                totalPendingDistributions: records.length,
                totalPendingUnitsInTransit: totalPendingUnits
            },
            data: records
        };
    }

    /**
     * 7. Distribution Discrepancy Report
     */
    static async getDistributionDiscrepancyReport(pool, filters = {}) {
        const { startDate, endDate, locationId, search } = filters;
        let query = `
            SELECT 
                d.DistributionID,
                d.DistributionNumber,
                d.DestinationLocationID,
                destLoc.LocationName AS DestinationName,
                destLoc.LocationType AS DestinationType,
                d.ReleasedDate,
                d.ReceivedDate,
                relUser.FullName AS ReleasedByName,
                recUser.FullName AS ReceivedByName,
                d.DiscrepancyRemarks AS HeaderDiscrepancyRemarks,
                di.DistributionItemID,
                di.Quantity AS QuantityIssued,
                ISNULL(di.ReceivedQuantity, di.Quantity) AS QuantityReceived,
                (di.Quantity - ISNULL(di.ReceivedQuantity, di.Quantity)) AS ShortageQuantity,
                m.ProductName,
                m.GenericName,
                wi.LotNumber,
                wi.ExpiryDate
            FROM Warehouse_Distributions d
            INNER JOIN Warehouse_DistributionItems di ON d.DistributionID = di.DistributionID
            INNER JOIN Warehouse_Inventory wi ON di.InventoryID = wi.InventoryID
            INNER JOIN Medicines m ON wi.MedicineID = m.MedicineID
            LEFT JOIN Warehouse_Locations destLoc ON d.DestinationLocationID = destLoc.LocationID
            LEFT JOIN Users relUser ON d.ReleasedByUserID = relUser.UserID
            LEFT JOIN Users recUser ON d.ReceivedByUserID = recUser.UserID
            WHERE d.HasDiscrepancy = 1 AND di.IsDeleted = 0
        `;

        const req = pool.request();

        if (startDate) {
            query += ' AND d.ReceivedDate >= @startDate';
            req.input('startDate', sql.DateTime2, new Date(startDate));
        }

        if (endDate) {
            query += ' AND d.ReceivedDate <= @endDate';
            req.input('endDate', sql.DateTime2, new Date(endDate));
        }

        if (locationId) {
            query += ' AND d.DestinationLocationID = @locationId';
            req.input('locationId', sql.Int, Number(locationId));
        }

        if (search) {
            query += ' AND (d.DistributionNumber LIKE @search OR destLoc.LocationName LIKE @search OR m.ProductName LIKE @search OR wi.LotNumber LIKE @search)';
            req.input('search', sql.NVarChar, `%${search}%`);
        }

        query += ' ORDER BY d.ReceivedDate DESC';

        const res = await req.query(query);
        const records = res.recordset;

        const totalIssued = records.reduce((acc, r) => acc + r.QuantityIssued, 0);
        const totalReceived = records.reduce((acc, r) => acc + r.QuantityReceived, 0);
        const totalShortage = records.reduce((acc, r) => acc + r.ShortageQuantity, 0);

        return {
            reportTitle: 'Distribution Discrepancy & Transit Variance Report',
            generatedDate: new Date().toISOString(),
            summary: {
                totalDiscrepancyEvents: records.length,
                totalIssuedUnits: totalIssued,
                totalReceivedUnits: totalReceived,
                netMissingUnits: totalShortage
            },
            data: records
        };
    }

    /**
     * 8. Medicine Batch Traceability Report
     */
    static async getBatchTraceabilityReport(pool, lotNumber) {
        const BarangayService = require('./barangayService.cjs');
        const trace = await BarangayService.getTraceabilityByLot(pool, lotNumber);
        return {
            reportTitle: `Medicine Batch Traceability Report: Lot ${lotNumber}`,
            generatedDate: new Date().toISOString(),
            lotNumber,
            ...trace
        };
    }

    /**
     * 9. Personnel Accountability Report
     */
    static async getPersonnelAccountabilityReport(pool, filters = {}) {
        const { userId, startDate, endDate } = filters;
        let query = `
            SELECT 
                u.UserID,
                u.Username,
                u.FullName,
                u.Role,
                u.Barangay,
                loc.LocationName,
                (SELECT COUNT(*) FROM Warehouse_StockRequests WHERE RequestedByUserID = u.UserID) AS RequisitionsCreated,
                (SELECT COUNT(*) FROM Warehouse_StockRequests WHERE ApprovedByUserID = u.UserID) AS RequisitionsApproved,
                (SELECT COUNT(*) FROM Warehouse_Distributions WHERE ReleasedByUserID = u.UserID) AS DistributionsReleased,
                (SELECT COUNT(*) FROM Warehouse_Distributions WHERE ReceivedByUserID = u.UserID) AS DistributionsReceived,
                (SELECT COUNT(*) FROM Barangay_Disbursements WHERE DisbursedByUserID = u.UserID) AS BarangayDisbursementsIssued,
                (SELECT COUNT(*) FROM Barangay_Disbursements WHERE ReversedByUserID = u.UserID) AS BarangayDisbursementsReversed,
                (SELECT COUNT(*) FROM Pharmacy_Sales WHERE SoldBy = u.UserID) AS PharmacyPrescriptionsDispensed,
                (SELECT COUNT(*) FROM User_AuditLogs WHERE PerformedByUserID = u.UserID) AS AdministrativeChangesMade
            FROM Users u
            LEFT JOIN Warehouse_Locations loc ON u.LocationID = loc.LocationID
            WHERE u.IsActive = 1
        `;

        const req = pool.request();

        if (userId) {
            query += ' AND u.UserID = @userId';
            req.input('userId', sql.Int, Number(userId));
        }

        query += ' ORDER BY u.Role ASC, u.FullName ASC';

        const res = await req.query(query);
        return {
            reportTitle: 'Personnel Supply Chain Accountability Report',
            generatedDate: new Date().toISOString(),
            data: res.recordset
        };
    }

    /**
     * 10. City-Wide Medicine Movement Report (Consolidated Immutable Ledger)
     */
    static async getCityWideMovementReport(pool, filters = {}) {
        const { startDate, endDate, transactionType, search } = filters;
        
        let query = `
            SELECT * FROM (
                -- 1. Warehouse Movements
                SELECT 
                    'Warehouse' AS FacilityType,
                    'Central Warehouse' AS FacilityName,
                    1 AS LocationID,
                    wit.TransactionID,
                    wit.TransactionType,
                    wit.ReferenceDocument AS ReferenceNumber,
                    wit.Quantity,
                    wi.LotNumber,
                    wit.Remarks,
                    wit.CreatedDate AS TransactionDate,
                    u.FullName AS ActorName,
                    m.ProductName
                FROM Warehouse_InventoryTransactions wit
                LEFT JOIN Warehouse_Inventory wi ON wit.InventoryID = wi.InventoryID
                LEFT JOIN Medicines m ON (wit.MedicineID = m.MedicineID OR wi.MedicineID = m.MedicineID)
                LEFT JOIN Users u ON wit.CreatedBy = u.UserID

                UNION ALL

                -- 2. Pharmacy Movements
                SELECT 
                    'Pharmacy' AS FacilityType,
                    'City Pharmacy' AS FacilityName,
                    2 AS LocationID,
                    pit.TransactionID,
                    pit.TransactionType,
                    pit.ReferenceNumber,
                    pit.Quantity,
                    pit.BatchNumber AS LotNumber,
                    pit.Remarks,
                    pit.CreatedDate AS TransactionDate,
                    u.FullName AS ActorName,
                    m.ProductName
                FROM Pharmacy_InventoryTransactions pit
                LEFT JOIN Medicines m ON pit.MedicineID = m.MedicineID
                LEFT JOIN Users u ON pit.CreatedBy = u.UserID

                UNION ALL

                -- 3. Barangay Movements
                SELECT 
                    'Barangay' AS FacilityType,
                    bit.BarangayName AS FacilityName,
                    bit.LocationID,
                    bit.TransactionID,
                    bit.TransactionType,
                    bit.ReferenceNumber,
                    bit.Quantity,
                    bit.BatchNumber AS LotNumber,
                    bit.Remarks,
                    bit.CreatedDate AS TransactionDate,
                    u.FullName AS ActorName,
                    m.ProductName
                FROM Barangay_InventoryTransactions bit
                LEFT JOIN Medicines m ON bit.MedicineID = m.MedicineID
                LEFT JOIN Users u ON bit.CreatedBy = u.UserID
            ) AS ConsolidatedLedger
            WHERE 1=1
        `;

        const req = pool.request();

        if (startDate) {
            query += ' AND TransactionDate >= @startDate';
            req.input('startDate', sql.DateTime2, new Date(startDate));
        }

        if (endDate) {
            query += ' AND TransactionDate <= @endDate';
            req.input('endDate', sql.DateTime2, new Date(endDate));
        }

        if (transactionType && transactionType !== 'ALL') {
            query += ' AND TransactionType = @type';
            req.input('type', sql.NVarChar, transactionType);
        }

        if (search) {
            query += ' AND (ReferenceNumber LIKE @search OR ProductName LIKE @search OR LotNumber LIKE @search OR FacilityName LIKE @search)';
            req.input('search', sql.NVarChar, `%${search}%`);
        }

        query += ' ORDER BY TransactionDate DESC';

        const res = await req.query(query);
        const records = res.recordset;

        return {
            reportTitle: 'City-Wide Consolidated Medicine Movement Report',
            generatedDate: new Date().toISOString(),
            summary: {
                totalLedgerTransactions: records.length,
                totalWarehouseRecords: records.filter(r => r.FacilityType === 'Warehouse').length,
                totalPharmacyRecords: records.filter(r => r.FacilityType === 'Pharmacy').length,
                totalBarangayRecords: records.filter(r => r.FacilityType === 'Barangay').length
            },
            data: records
        };
    }

    /**
     * 11. Complete Pharmacy-to-Warehouse Stock Request & Fulfillment Traceability Report
     */
    static async getStockRequestTraceabilityReport(pool, filters = {}) {
        const { startDate, endDate, status, search, facilityId } = filters;
        let query = `
            SELECT 
                sr.StockRequestID,
                sr.RequestNumber,
                sr.CreatedDate AS RequestDate,
                sr.Priority,
                sr.Status AS RequestStatus,
                sr.Purpose,
                sr.AdminRemarks,
                sr.RejectionReason,
                sr.ApprovedDate,
                uReq.FullName AS RequestedByName,
                uApp.FullName AS ApprovedByName,
                loc.LocationID AS RequestingLocationID,
                COALESCE(loc.LocationName, 'City Pharmacy') AS RequestingFacility,
                sri.StockRequestItemID,
                sri.MedicineID,
                wm.ProductName,
                wm.GenericName,
                sri.QuantityRequested,
                sri.QuantityApproved,
                sri.QuantityReleased,
                sri.QuantityUnfulfilled,
                ISNULL((SELECT SUM(ReservedQuantity) FROM Warehouse_StockReservations WHERE StockRequestItemID = sri.StockRequestItemID AND Status = 'Active' AND IsDeleted = 0), 0) AS ActiveReservedQuantity,
                d.DistributionID,
                d.DistributionNumber,
                d.Status AS DistributionStatus,
                d.ReleasedDate,
                d.ReceivedDate,
                di.Quantity AS DistributionItemQuantity,
                di.ReceivedQuantity AS AcceptedQuantity,
                CASE 
                    WHEN di.Quantity IS NOT NULL AND di.ReceivedQuantity IS NOT NULL 
                    THEN di.Quantity - di.ReceivedQuantity 
                    ELSE 0 
                END AS DiscrepancyQuantity,
                d.HasDiscrepancy,
                d.DiscrepancyRemarks
            FROM Warehouse_StockRequests sr
            LEFT JOIN Warehouse_StockRequestItems sri ON sr.StockRequestID = sri.StockRequestID AND sri.IsDeleted = 0
            LEFT JOIN Warehouse_Medicines wm ON sri.MedicineID = wm.MedicineID
            LEFT JOIN Warehouse_Locations loc ON sr.RequestingLocationID = loc.LocationID
            LEFT JOIN Users uReq ON sr.RequestedByUserID = uReq.UserID
            LEFT JOIN Users uApp ON sr.ApprovedByUserID = uApp.UserID
            LEFT JOIN Warehouse_Distributions d ON sr.StockRequestID = d.ReferenceStockRequestID AND d.IsDeleted = 0
            LEFT JOIN Warehouse_DistributionItems di ON d.DistributionID = di.DistributionID AND sri.StockRequestItemID = di.StockRequestItemID AND di.IsDeleted = 0
            WHERE sr.IsDeleted = 0
        `;

        const req = pool.request();

        if (startDate) {
            query += ' AND sr.CreatedDate >= @startDate';
            req.input('startDate', sql.DateTime2, new Date(startDate));
        }

        if (endDate) {
            query += ' AND sr.CreatedDate <= @endDate';
            req.input('endDate', sql.DateTime2, new Date(endDate));
        }

        if (status && status !== 'ALL') {
            query += ' AND sr.Status = @status';
            req.input('status', sql.NVarChar, status);
        }

        if (facilityId) {
            query += ' AND sr.RequestingLocationID = @facilityId';
            req.input('facilityId', sql.Int, Number(facilityId));
        }

        if (search) {
            query += ' AND (sr.RequestNumber LIKE @search OR wm.ProductName LIKE @search OR loc.LocationName LIKE @search OR d.DistributionNumber LIKE @search)';
            req.input('search', sql.NVarChar, `%${search}%`);
        }

        query += ' ORDER BY sr.CreatedDate DESC, sri.StockRequestItemID ASC';

        const res = await req.query(query);
        const records = res.recordset;

        const totalRequested = records.reduce((acc, r) => acc + (r.QuantityRequested || 0), 0);
        const totalApproved = records.reduce((acc, r) => acc + (r.QuantityApproved || 0), 0);
        const totalReleased = records.reduce((acc, r) => acc + (r.QuantityReleased || 0), 0);
        const totalAccepted = records.reduce((acc, r) => acc + (r.AcceptedQuantity || 0), 0);
        const totalUnfulfilled = records.reduce((acc, r) => acc + (r.QuantityUnfulfilled || 0), 0);

        return {
            reportTitle: 'Pharmacy-to-Central-Warehouse Stock Request & Fulfillment Traceability Report',
            generatedDate: new Date().toISOString(),
            summary: {
                totalRows: records.length,
                totalRequestedUnits: totalRequested,
                totalApprovedUnits: totalApproved,
                totalReleasedUnits: totalReleased,
                totalAcceptedUnits: totalAccepted,
                totalUnfulfilledUnits: totalUnfulfilled
            },
            data: records
        };
    }
}

module.exports = ReportService;

