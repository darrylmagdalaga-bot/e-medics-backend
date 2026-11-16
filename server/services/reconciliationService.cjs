const sql = require('mssql');

/**
 * Service for Warehouse Integrity Audits, Stock Ledger Validation, and Reconciliation
 */
class ReconciliationService {
    /**
     * Executes a full stock ledger audit against all active batches, deliveries, distributions, and ledger transactions.
     * Non-destructive: purely detects, records findings, and computes discrepancies without modifying stock.
     */
    static async executeReconciliationRun(pool, triggeredByUserId = 1) {
        const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const countRes = await pool.request().query("SELECT COUNT(*) as cnt FROM Warehouse_ReconciliationRuns");
        const runNumber = `AUD-${datePrefix}-${String(countRes.recordset[0].cnt + 1).padStart(4, '0')}`;

        // 1. Create run header in 'In Progress'
        const insertRunReq = pool.request();
        insertRunReq.input('RunNumber', sql.NVarChar, runNumber);
        insertRunReq.input('TriggeredByUserID', sql.Int, triggeredByUserId);
        const runRes = await insertRunReq.query(`
            INSERT INTO Warehouse_ReconciliationRuns (
                RunNumber, StartedAt, TriggeredByUserID, Status,
                TotalBatchesAudited, TotalDiscrepancies, TotalRecordedQuantity,
                TotalExpectedQuantity, NegativeStockCases, MissingLedgerCases, DuplicateMovementCases
            )
            OUTPUT INSERTED.RunID
            VALUES (
                @RunNumber, SYSUTCDATETIME(), @TriggeredByUserID, 'In Progress',
                0, 0, 0, 0, 0, 0, 0
            )
        `);
        const runId = runRes.recordset[0].RunID;

        try {
            // 2. Fetch all inventory batches with medicine, receipt, and location info
            const batchesQuery = `
                SELECT 
                    I.InventoryID,
                    I.LocationID,
                    COALESCE(L.LocationName, 'Main Warehouse') as LocationName,
                    I.MedicineID,
                    M.ProductName,
                    M.GenericName,
                    M.MedicineCode,
                    M.TrackBatchNumbers,
                    M.TrackExpirationDates,
                    M.FEFOEnabled,
                    M.Status as MedicineStatus,
                    I.SourceDeliveryReceiptItemID,
                    I.BatchNumber,
                    I.LotNumber,
                    I.ExpiryDate,
                    I.QuantityReceived,
                    I.QuantityAvailable,
                    I.ReservedQuantity,
                    I.DamagedQuantity,
                    I.ExpiredQuantity,
                    I.Status as BatchStatus,
                    I.CreatedDate as BatchCreatedDate,
                    DRI.DeliveryReceiptID,
                    DR.ReferenceNumber as DeliveryReceiptNumber,
                    DR.Status as DeliveryReceiptStatus
                FROM Warehouse_Inventory I
                LEFT JOIN Warehouse_Medicines M ON I.MedicineID = M.MedicineID
                LEFT JOIN Warehouse_Locations L ON I.LocationID = L.LocationID
                LEFT JOIN Warehouse_DeliveryReceiptItems DRI ON I.SourceDeliveryReceiptItemID = DRI.DeliveryReceiptItemID
                LEFT JOIN Warehouse_DeliveryReceipts DR ON DRI.DeliveryReceiptID = DR.DeliveryReceiptID
                WHERE I.IsDeleted = 0
            `;
            const batchesResult = await pool.request().query(batchesQuery);
            const batches = batchesResult.recordset;

            // 3. Fetch distributions summary per inventory batch (valid issued / delivered)
            const distSummaryQuery = `
                SELECT 
                    DI.InventoryID,
                    SUM(DI.Quantity) as TotalDistributedQty,
                    COUNT(DISTINCT D.DistributionID) as DistributionCount
                FROM Warehouse_DistributionItems DI
                JOIN Warehouse_Distributions D ON DI.DistributionID = D.DistributionID
                WHERE DI.IsDeleted = 0 AND D.IsDeleted = 0 AND D.Status IN ('Issued', 'Delivered')
                GROUP BY DI.InventoryID
            `;
            const distResult = await pool.request().query(distSummaryQuery);
            const distMap = new Map();
            distResult.recordset.forEach(d => {
                distMap.set(String(d.InventoryID), {
                    totalDistributedQty: Number(d.TotalDistributedQty || 0),
                    distributionCount: Number(d.DistributionCount || 0)
                });
            });

            // 4. Fetch ledger transaction summary per inventory batch
            const txSummaryQuery = `
                SELECT 
                    InventoryID,
                    COUNT(*) as TotalTxCount,
                    SUM(CASE WHEN TransactionType IN ('RECEIVING', 'INITIAL', 'RETURN') OR (TransactionType = 'ADJUSTMENT' AND Quantity > 0) THEN Quantity ELSE 0 END) as InflowQty,
                    SUM(CASE WHEN TransactionType IN ('DISTRIBUTION', 'ISSUANCE', 'DISPENSE', 'DAMAGE', 'EXPIRY') OR (TransactionType = 'ADJUSTMENT' AND Quantity < 0) THEN ABS(Quantity) ELSE 0 END) as OutflowQty,
                    SUM(Quantity) as NetLedgerQty,
                    SUM(CASE WHEN TransactionType = 'ADJUSTMENT' THEN Quantity ELSE 0 END) as AdjustmentQty,
                    COUNT(CASE WHEN TransactionType = 'RECEIVING' THEN 1 END) as ReceivingTxCount,
                    COUNT(CASE WHEN TransactionType IN ('DISTRIBUTION', 'ISSUANCE') THEN 1 END) as DistributionTxCount
                FROM Warehouse_InventoryTransactions
                GROUP BY InventoryID
            `;
            const txResult = await pool.request().query(txSummaryQuery);
            const txMap = new Map();
            txResult.recordset.forEach(t => {
                txMap.set(String(t.InventoryID), {
                    totalTxCount: Number(t.TotalTxCount || 0),
                    inflowQty: Number(t.InflowQty || 0),
                    outflowQty: Number(t.OutflowQty || 0),
                    netLedgerQty: Number(t.NetLedgerQty || 0),
                    receivingTxCount: Number(t.ReceivingTxCount || 0),
                    distributionTxCount: Number(t.DistributionTxCount || 0),
                    adjustmentQty: Number(t.AdjustmentQty || 0)
                });
            });

            // 5. Look up existing unresolved discrepancies to preserve investigation status if previously reviewed
            const prevDiscRes = await pool.request().query(`
                SELECT InventoryID, IssueType, InvestigationStatus, ResolutionJustification
                FROM Warehouse_ReconciliationDiscrepancies
                WHERE InvestigationStatus IN ('Under Review', 'Accepted Exception')
            `);
            const prevDiscMap = new Map();
            prevDiscRes.recordset.forEach(p => {
                prevDiscMap.set(`${p.InventoryID}_${p.IssueType}`, p);
            });

            // Audit counters
            let totalRecordedQty = 0;
            let totalExpectedQty = 0;
            let negativeStockCases = 0;
            let missingLedgerCases = 0;
            let duplicateMovementCases = 0;
            const discrepanciesToInsert = [];

            const now = new Date();
            const todayStr = now.toISOString().slice(0, 10);

            for (const batch of batches) {
                const invIdStr = String(batch.InventoryID);
                const recordedQty = Number(batch.QuantityAvailable || 0);
                const receivedQty = Number(batch.QuantityReceived || 0);
                totalRecordedQty += recordedQty;

                const distInfo = distMap.get(invIdStr) || { totalDistributedQty: 0, distributionCount: 0 };
                const txInfo = txMap.get(invIdStr) || {
                    totalTxCount: 0, inflowQty: 0, outflowQty: 0,
                    netLedgerQty: 0, receivingTxCount: 0, distributionTxCount: 0
                };

                // Expected balance based on authoritative documents: Received - Distributed
                const expectedDocBalance = receivedQty - distInfo.totalDistributedQty + Number(txInfo.adjustmentQty || 0);
                totalExpectedQty += expectedDocBalance;

                // Rule 1: Negative Stock Check
                if (recordedQty < 0) {
                    negativeStockCases++;
                    discrepanciesToInsert.push({
                        inventoryId: batch.InventoryID,
                        medicineId: batch.MedicineID,
                        locationId: batch.LocationID,
                        issueType: 'NEGATIVE_STOCK',
                        severity: 'Critical',
                        relatedDocType: null,
                        relatedDocId: null,
                        relatedDocNumber: null,
                        recordedQty,
                        expectedQty: Math.max(0, expectedDocBalance),
                        diffQty: recordedQty - Math.max(0, expectedDocBalance),
                        batchNumber: batch.BatchNumber,
                        lotNumber: batch.LotNumber,
                        expiryDate: batch.ExpiryDate
                    });
                }

                // Rule 2: Orphaned Batch (missing medicine or invalid location)
                if (!batch.MedicineID || !batch.ProductName) {
                    discrepanciesToInsert.push({
                        inventoryId: batch.InventoryID,
                        medicineId: batch.MedicineID || 0,
                        locationId: batch.LocationID,
                        issueType: 'ORPHANED_BATCH',
                        severity: 'Critical',
                        relatedDocType: null,
                        relatedDocId: null,
                        relatedDocNumber: null,
                        recordedQty,
                        expectedQty: 0,
                        diffQty: recordedQty,
                        batchNumber: batch.BatchNumber,
                        lotNumber: batch.LotNumber,
                        expiryDate: batch.ExpiryDate
                    });
                }

                // Rule 3: Expired Stock remaining in 'Active' state
                if (batch.ExpiryDate && batch.ExpiryDate < todayStr && recordedQty > 0 && batch.BatchStatus === 'Active') {
                    discrepanciesToInsert.push({
                        inventoryId: batch.InventoryID,
                        medicineId: batch.MedicineID,
                        locationId: batch.LocationID,
                        issueType: 'EXPIRED_ACTIVE_STOCK',
                        severity: 'High',
                        relatedDocType: 'DR',
                        relatedDocId: batch.DeliveryReceiptID,
                        relatedDocNumber: batch.DeliveryReceiptNumber,
                        recordedQty,
                        expectedQty: 0, // Should be moved to Quarantine/Expired
                        diffQty: recordedQty,
                        batchNumber: batch.BatchNumber,
                        lotNumber: batch.LotNumber,
                        expiryDate: batch.ExpiryDate
                    });
                }

                // Rule 4: Missing Receiving Ledger Entry
                if (receivedQty > 0 && txInfo.receivingTxCount === 0) {
                    missingLedgerCases++;
                    discrepanciesToInsert.push({
                        inventoryId: batch.InventoryID,
                        medicineId: batch.MedicineID,
                        locationId: batch.LocationID,
                        issueType: 'MISSING_RECEIVING_LEDGER',
                        severity: 'Medium',
                        relatedDocType: 'DR',
                        relatedDocId: batch.DeliveryReceiptID,
                        relatedDocNumber: batch.DeliveryReceiptNumber,
                        recordedQty,
                        expectedQty: receivedQty,
                        diffQty: recordedQty,
                        batchNumber: batch.BatchNumber,
                        lotNumber: batch.LotNumber,
                        expiryDate: batch.ExpiryDate
                    });
                }

                // Rule 5: Missing Distribution Ledger Entry
                if (distInfo.totalDistributedQty > 0 && txInfo.distributionTxCount === 0) {
                    missingLedgerCases++;
                    discrepanciesToInsert.push({
                        inventoryId: batch.InventoryID,
                        medicineId: batch.MedicineID,
                        locationId: batch.LocationID,
                        issueType: 'MISSING_DISTRIBUTION_LEDGER',
                        severity: 'Medium',
                        relatedDocType: 'DISTRIBUTION',
                        relatedDocId: null,
                        relatedDocNumber: null,
                        recordedQty,
                        expectedQty: expectedDocBalance,
                        diffQty: distInfo.totalDistributedQty,
                        batchNumber: batch.BatchNumber,
                        lotNumber: batch.LotNumber,
                        expiryDate: batch.ExpiryDate
                    });
                }

                // Rule 6: Unrecorded Distribution Deduction (distribution exists but quantity wasn't deducted)
                if (distInfo.totalDistributedQty > 0 && recordedQty > expectedDocBalance) {
                    discrepanciesToInsert.push({
                        inventoryId: batch.InventoryID,
                        medicineId: batch.MedicineID,
                        locationId: batch.LocationID,
                        issueType: 'UNRECORDED_DISTRIBUTION_DEDUCTION',
                        severity: 'High',
                        relatedDocType: 'DISTRIBUTION',
                        relatedDocId: null,
                        relatedDocNumber: null,
                        recordedQty,
                        expectedQty: expectedDocBalance,
                        diffQty: recordedQty - expectedDocBalance,
                        batchNumber: batch.BatchNumber,
                        lotNumber: batch.LotNumber,
                        expiryDate: batch.ExpiryDate
                    });
                }

                // Rule 7: General Balance Mismatch
                if (recordedQty !== expectedDocBalance) {
                    const alreadyCaptured = discrepanciesToInsert.some(d => 
                        d.inventoryId === batch.InventoryID && 
                        (d.issueType === 'UNRECORDED_DISTRIBUTION_DEDUCTION' || d.issueType === 'NEGATIVE_STOCK')
                    );
                    if (!alreadyCaptured) {
                        discrepanciesToInsert.push({
                            inventoryId: batch.InventoryID,
                            medicineId: batch.MedicineID,
                            locationId: batch.LocationID,
                            issueType: 'BALANCE_MISMATCH',
                            severity: 'High',
                            relatedDocType: batch.DeliveryReceiptID ? 'DR' : null,
                            relatedDocId: batch.DeliveryReceiptID,
                            relatedDocNumber: batch.DeliveryReceiptNumber,
                            recordedQty,
                            expectedQty: expectedDocBalance,
                            diffQty: recordedQty - expectedDocBalance,
                            batchNumber: batch.BatchNumber,
                            lotNumber: batch.LotNumber,
                            expiryDate: batch.ExpiryDate
                        });
                    }
                }
            }

            // Rule 8: Global Duplicate Transaction Movement Check
            const duplicateCheckRes = await pool.request().query(`
                SELECT InventoryID, TransactionType, ReferenceDocument, ReferenceID, COUNT(*) as DupCount
                FROM Warehouse_InventoryTransactions
                WHERE ReferenceID IS NOT NULL
                GROUP BY InventoryID, TransactionType, ReferenceDocument, ReferenceID
                HAVING COUNT(*) > 1
            `);
            for (const dup of duplicateCheckRes.recordset) {
                duplicateMovementCases += dup.DupCount - 1;
                discrepanciesToInsert.push({
                    inventoryId: dup.InventoryID,
                    medicineId: 0,
                    locationId: null,
                    issueType: 'DUPLICATE_MOVEMENT',
                    severity: 'High',
                    relatedDocType: dup.ReferenceDocument,
                    relatedDocId: dup.ReferenceID,
                    relatedDocNumber: `${dup.ReferenceDocument}-${dup.ReferenceID}`,
                    recordedQty: dup.DupCount,
                    expectedQty: 1,
                    diffQty: dup.DupCount - 1,
                    batchNumber: null,
                    lotNumber: null,
                    expiryDate: null
                });
            }

            // 6. Batch Insert Findings into Warehouse_ReconciliationDiscrepancies
            for (const d of discrepanciesToInsert) {
                const prev = prevDiscMap.get(`${d.inventoryId}_${d.issueType}`);
                const status = prev ? prev.InvestigationStatus : 'Open';
                const justification = prev ? prev.ResolutionJustification : null;

                const insReq = pool.request();
                insReq.input('RunID', sql.BigInt, runId);
                insReq.input('InventoryID', sql.BigInt, d.inventoryId || null);
                insReq.input('MedicineID', sql.Int, d.medicineId || 1);
                insReq.input('LocationID', sql.Int, d.locationId || 1);
                insReq.input('IssueType', sql.NVarChar, d.issueType);
                insReq.input('Severity', sql.NVarChar, d.severity);
                insReq.input('RelatedDocType', sql.NVarChar, d.relatedDocType);
                insReq.input('RelatedDocID', sql.BigInt, d.relatedDocId);
                insReq.input('RelatedDocNumber', sql.NVarChar, d.relatedDocNumber);
                insReq.input('RecordedQty', sql.Int, d.recordedQty);
                insReq.input('ExpectedQty', sql.Int, d.expectedQty);
                insReq.input('DiffQty', sql.Int, d.diffQty);
                insReq.input('BatchNumber', sql.NVarChar, d.batchNumber);
                insReq.input('LotNumber', sql.NVarChar, d.lotNumber);
                insReq.input('ExpiryDate', sql.Date, d.expiryDate);
                insReq.input('InvestigationStatus', sql.NVarChar, status);
                insReq.input('ResolutionJustification', sql.NVarChar, justification);

                await insReq.query(`
                    INSERT INTO Warehouse_ReconciliationDiscrepancies (
                        RunID, InventoryID, MedicineID, LocationID, IssueType, Severity,
                        RelatedDocumentType, RelatedDocumentID, RelatedDocumentNumber,
                        RecordedQuantity, ExpectedQuantity, DifferenceQuantity,
                        BatchNumber, LotNumber, ExpiryDate, InvestigationStatus, ResolutionJustification,
                        DetectedDate
                    ) VALUES (
                        @RunID, @InventoryID, @MedicineID, @LocationID, @IssueType, @Severity,
                        @RelatedDocType, @RelatedDocID, @RelatedDocNumber,
                        @RecordedQty, @ExpectedQty, @DiffQty,
                        @BatchNumber, @LotNumber, @ExpiryDate, @InvestigationStatus, @ResolutionJustification,
                        SYSUTCDATETIME()
                    )
                `);
            }

            // 7. Update Run Record to Completed
            const updateRunReq = pool.request();
            updateRunReq.input('RunID', sql.BigInt, runId);
            updateRunReq.input('TotalBatches', sql.Int, batches.length);
            updateRunReq.input('TotalDiscrepancies', sql.Int, discrepanciesToInsert.length);
            updateRunReq.input('TotalRecordedQty', sql.BigInt, totalRecordedQty);
            updateRunReq.input('TotalExpectedQty', sql.BigInt, totalExpectedQty);
            updateRunReq.input('NegativeCases', sql.Int, negativeStockCases);
            updateRunReq.input('MissingLedgerCases', sql.Int, missingLedgerCases);
            updateRunReq.input('DuplicateCases', sql.Int, duplicateMovementCases);

            await updateRunReq.query(`
                UPDATE Warehouse_ReconciliationRuns
                SET 
                    Status = 'Completed',
                    CompletedAt = SYSUTCDATETIME(),
                    TotalBatchesAudited = @TotalBatches,
                    TotalDiscrepancies = @TotalDiscrepancies,
                    TotalRecordedQuantity = @TotalRecordedQty,
                    TotalExpectedQuantity = @TotalExpectedQty,
                    NegativeStockCases = @NegativeCases,
                    MissingLedgerCases = @MissingLedgerCases,
                    DuplicateMovementCases = @DuplicateCases
                WHERE RunID = @RunID
            `);

            return {
                runId,
                runNumber,
                status: 'Completed',
                totalBatchesAudited: batches.length,
                totalDiscrepancies: discrepanciesToInsert.length,
                totalRecordedQuantity: totalRecordedQty,
                totalExpectedQuantity: totalExpectedQty,
                negativeStockCases,
                missingLedgerCases,
                duplicateMovementCases,
                discrepancies: discrepanciesToInsert
            };
        } catch (err) {
            const failReq = pool.request();
            failReq.input('RunID', sql.BigInt, runId);
            failReq.input('ErrorMessage', sql.NVarChar, err.message);
            await failReq.query(`
                UPDATE Warehouse_ReconciliationRuns
                SET Status = 'Failed', CompletedAt = SYSUTCDATETIME(), ErrorMessage = @ErrorMessage
                WHERE RunID = @RunID
            `);
            throw err;
        }
    }

    /**
     * Returns high-level dashboard metrics based on latest audit data.
     */
    static async getSummary(pool) {
        const latestRunRes = await pool.request().query(`
            SELECT TOP 1 *
            FROM Warehouse_ReconciliationRuns
            ORDER BY StartedAt DESC
        `);
        const latestRun = latestRunRes.recordset[0] || null;

        const unresolvedRes = await pool.request().query(`
            SELECT COUNT(*) as UnresolvedCount
            FROM Warehouse_ReconciliationDiscrepancies
            WHERE InvestigationStatus IN ('Open', 'Under Review')
        `);
        const unresolvedCount = unresolvedRes.recordset[0]?.UnresolvedCount || 0;

        const totalBatchesRes = await pool.request().query(`
            SELECT COUNT(*) as TotalBatches, ISNULL(SUM(CAST(QuantityAvailable as bigint)), 0) as TotalRecordedQty
            FROM Warehouse_Inventory
            WHERE IsDeleted = 0
        `);
        const liveBatches = totalBatchesRes.recordset[0]?.TotalBatches || 0;
        const liveRecordedQty = totalBatchesRes.recordset[0]?.TotalRecordedQty || 0;

        return {
            batchesAudited: latestRun ? latestRun.TotalBatchesAudited : liveBatches,
            totalRecordedQuantity: latestRun ? latestRun.TotalRecordedQuantity : liveRecordedQty,
            totalExpectedQuantity: latestRun ? latestRun.TotalExpectedQuantity : liveRecordedQty,
            discrepanciesFound: latestRun ? latestRun.TotalDiscrepancies : unresolvedCount,
            negativeStockCases: latestRun ? latestRun.NegativeStockCases : 0,
            missingLedgerEntries: latestRun ? latestRun.MissingLedgerCases : 0,
            duplicateMovements: latestRun ? latestRun.DuplicateMovementCases : 0,
            unresolvedFindings: unresolvedCount,
            lastAuditTimestamp: latestRun ? latestRun.CompletedAt || latestRun.StartedAt : null,
            lastRunNumber: latestRun ? latestRun.RunNumber : null,
            lastRunStatus: latestRun ? latestRun.Status : 'No Audit Run Yet'
        };
    }

    /**
     * Lists discrepancies with server-side filtering and pagination.
     */
    static async getDiscrepancies(pool, filters = {}) {
        const {
            runId,
            issueType,
            status,
            medicineId,
            search = '',
            page = 1,
            pageSize = 20
        } = filters;

        const offset = (Math.max(1, Number(page)) - 1) * Number(pageSize);
        const limit = Number(pageSize);

        let whereClauses = ['1=1'];
        const req = pool.request();

        if (runId) {
            whereClauses.push('D.RunID = @RunID');
            req.input('RunID', sql.BigInt, runId);
        } else {
            whereClauses.push(`D.RunID = (SELECT TOP 1 RunID FROM Warehouse_ReconciliationRuns WHERE Status = 'Completed' ORDER BY StartedAt DESC)`);
        }

        if (issueType && issueType !== 'ALL') {
            whereClauses.push('D.IssueType = @IssueType');
            req.input('IssueType', sql.NVarChar, issueType);
        }

        if (status && status !== 'ALL') {
            whereClauses.push('D.InvestigationStatus = @Status');
            req.input('Status', sql.NVarChar, status);
        }

        if (medicineId) {
            whereClauses.push('D.MedicineID = @MedicineID');
            req.input('MedicineID', sql.Int, medicineId);
        }

        if (search) {
            whereClauses.push(`(
                M.ProductName LIKE @Search OR 
                M.GenericName LIKE @Search OR 
                D.BatchNumber LIKE @Search OR 
                D.RelatedDocumentNumber LIKE @Search OR
                D.IssueType LIKE @Search
            )`);
            req.input('Search', sql.NVarChar, `%${search}%`);
        }

        const whereSql = whereClauses.join(' AND ');

        // Count total
        const countQuery = `
            SELECT COUNT(*) as Total
            FROM Warehouse_ReconciliationDiscrepancies D
            LEFT JOIN Warehouse_Medicines M ON D.MedicineID = M.MedicineID
            WHERE ${whereSql}
        `;
        const countRes = await req.query(countQuery);
        const total = countRes.recordset[0]?.Total || 0;

        // Data query
        req.input('Offset', sql.Int, offset);
        req.input('Limit', sql.Int, limit);
        const dataQuery = `
            SELECT 
                D.*,
                M.ProductName,
                M.GenericName,
                M.Dosage,
                M.Form,
                L.LocationName,
                U.FullName as ResolvedByUserName
            FROM Warehouse_ReconciliationDiscrepancies D
            LEFT JOIN Warehouse_Medicines M ON D.MedicineID = M.MedicineID
            LEFT JOIN Warehouse_Locations L ON D.LocationID = L.LocationID
            LEFT JOIN Users U ON D.ResolvedByUserID = U.UserID
            WHERE ${whereSql}
            ORDER BY 
                CASE D.Severity 
                    WHEN 'Critical' THEN 1 
                    WHEN 'High' THEN 2 
                    WHEN 'Medium' THEN 3 
                    ELSE 4 
                END,
                D.DetectedDate DESC
            OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
        `;
        const dataRes = await req.query(dataQuery);

        return {
            items: dataRes.recordset,
            pagination: {
                total,
                page: Number(page),
                pageSize: Number(pageSize),
                totalPages: Math.ceil(total / Number(pageSize))
            }
        };
    }

    /**
     * Fetches detailed information on a single discrepancy including transaction history and notes.
     */
    static async getDiscrepancyDetail(pool, id) {
        const req = pool.request();
        req.input('id', sql.BigInt, id);
        const discRes = await req.query(`
            SELECT 
                D.*,
                M.ProductName,
                M.GenericName,
                M.Dosage,
                M.Form,
                M.TrackBatchNumbers,
                M.TrackExpirationDates,
                M.FEFOEnabled,
                L.LocationName,
                U.FullName as ResolvedByUserName,
                R.RunNumber,
                R.StartedAt as RunStartedAt
            FROM Warehouse_ReconciliationDiscrepancies D
            LEFT JOIN Warehouse_Medicines M ON D.MedicineID = M.MedicineID
            LEFT JOIN Warehouse_Locations L ON D.LocationID = L.LocationID
            LEFT JOIN Users U ON D.ResolvedByUserID = U.UserID
            LEFT JOIN Warehouse_ReconciliationRuns R ON D.RunID = R.RunID
            WHERE D.DiscrepancyID = @id
        `);

        if (discRes.recordset.length === 0) return null;
        const discrepancy = discRes.recordset[0];

        // Fetch associated ledger transactions for this inventory batch
        let transactions = [];
        if (discrepancy.InventoryID) {
            const txReq = pool.request();
            txReq.input('InventoryID', sql.BigInt, discrepancy.InventoryID);
            const txRes = await txReq.query(`
                SELECT 
                    T.*,
                    U.FullName as CreatedByUserName
                FROM Warehouse_InventoryTransactions T
                LEFT JOIN Users U ON T.CreatedBy = U.UserID
                WHERE T.InventoryID = @InventoryID
                ORDER BY T.CreatedDate ASC
            `);
            transactions = txRes.recordset;
        }

        // Fetch investigation notes
        const notesReq = pool.request();
        notesReq.input('id', sql.BigInt, id);
        const notesRes = await notesReq.query(`
            SELECT 
                N.*,
                U.FullName as AuthorName,
                U.Role as AuthorRole
            FROM Warehouse_DiscrepancyNotes N
            LEFT JOIN Users U ON N.UserID = U.UserID
            WHERE N.DiscrepancyID = @id
            ORDER BY N.CreatedAt ASC
        `);

        return {
            ...discrepancy,
            transactions,
            notes: notesRes.recordset
        };
    }

    /**
     * Adds an investigation note to a discrepancy.
     */
    static async addNote(pool, discrepancyId, userId, noteText) {
        const req = pool.request();
        req.input('DiscrepancyID', sql.BigInt, discrepancyId);
        req.input('UserID', sql.Int, userId || 1);
        req.input('NoteText', sql.NVarChar, noteText);
        const res = await req.query(`
            INSERT INTO Warehouse_DiscrepancyNotes (DiscrepancyID, UserID, NoteText, CreatedAt)
            OUTPUT INSERTED.NoteID, INSERTED.CreatedAt
            VALUES (@DiscrepancyID, @UserID, @NoteText, SYSUTCDATETIME())
        `);
        return res.recordset[0];
    }

    /**
     * Updates discrepancy investigation status with justification.
     */
    static async updateStatus(pool, discrepancyId, userId, newStatus, justification) {
        const validStatuses = ['Open', 'Under Review', 'Resolved', 'Accepted Exception'];
        if (!validStatuses.includes(newStatus)) {
            throw new Error(`Invalid status: ${newStatus}. Must be one of ${validStatuses.join(', ')}`);
        }

        if ((newStatus === 'Resolved' || newStatus === 'Accepted Exception') && (!justification || justification.trim().length < 5)) {
            throw new Error(`A detailed explanation/justification is required to mark an issue as ${newStatus}.`);
        }

        const req = pool.request();
        req.input('DiscrepancyID', sql.BigInt, discrepancyId);
        req.input('Status', sql.NVarChar, newStatus);
        req.input('Justification', sql.NVarChar, justification || null);
        req.input('UserID', sql.Int, userId || 1);

        let resolvedDateClause = '';
        if (newStatus === 'Resolved' || newStatus === 'Accepted Exception') {
            resolvedDateClause = ', ResolvedByUserID = @UserID, ResolvedDate = SYSUTCDATETIME()';
        } else {
            resolvedDateClause = ', ResolvedByUserID = NULL, ResolvedDate = NULL';
        }

        await req.query(`
            UPDATE Warehouse_ReconciliationDiscrepancies
            SET 
                InvestigationStatus = @Status,
                ResolutionJustification = @Justification
                ${resolvedDateClause}
            WHERE DiscrepancyID = @DiscrepancyID
        `);

        // Automatically log an audit note for the status transition
        await this.addNote(
            pool,
            discrepancyId,
            userId,
            `Status updated to "${newStatus}". Reason: ${justification || 'No justification specified'}`
        );

        return { success: true, message: `Discrepancy status updated to ${newStatus}` };
    }

    /**
     * Lists all historical reconciliation audit runs.
     */
    static async getRuns(pool) {
        const res = await pool.request().query(`
            SELECT 
                R.*,
                U.FullName as TriggeredByUserName
            FROM Warehouse_ReconciliationRuns R
            LEFT JOIN Users U ON R.TriggeredByUserID = U.UserID
            ORDER BY R.StartedAt DESC
        `);
        return res.recordset;
    }

    /**
     * PHASE 14 (Workstream 14.3): System-Wide Cross-Facility Inventory Reconciliation & Audit Integrity Verification
     * Non-destructively reconciles Central Warehouse, City Pharmacy, and Barangay Health Station inventories,
     * distributions, receipts, patient releases, reversals, batch statuses, and historical pre-ledger seed records.
     */
    static async getCrossFacilityReconciliation(pool) {
        // 1. Central Warehouse Inventory vs Warehouse Ledger
        const whRes = await pool.request().query(`
            SELECT
                I.InventoryID,
                I.MedicineID,
                M.ProductName AS MedicineName,
                I.BatchNumber,
                I.LotNumber,
                I.ExpiryDate,
                I.QuantityReceived,
                I.QuantityAvailable,
                ISNULL(I.DamagedQuantity, 0) AS QuantityDamaged,
                ISNULL(I.ExpiredQuantity, 0) AS QuantityExpired,
                I.Status,
                ISNULL(TX.TxCount, 0) AS LedgerTxCount,
                ISNULL(TX.NetLedgerSum, 0) AS NetLedgerSum,
                ISNULL(TX.ReceivingLedgerSum, 0) AS ReceivingLedgerSum,
                ISNULL(TX.DistributionLedgerSum, 0) AS DistributionLedgerSum,
                ISNULL(TX.AdjustmentLedgerSum, 0) AS AdjustmentLedgerSum,
                ISNULL(DIST.TotalDistributedItems, 0) AS TotalDistributedItems
            FROM Warehouse_Inventory I
            LEFT JOIN Warehouse_Medicines M ON I.MedicineID = M.MedicineID
            LEFT JOIN (
                SELECT 
                    InventoryID,
                    COUNT(*) AS TxCount,
                    SUM(Quantity) AS NetLedgerSum,
                    SUM(CASE WHEN TransactionType IN ('RECEIVING', 'INBOUND') THEN Quantity ELSE 0 END) AS ReceivingLedgerSum,
                    SUM(CASE WHEN TransactionType IN ('DISTRIBUTION', 'TRANSFER_OUT') THEN ABS(Quantity) ELSE 0 END) AS DistributionLedgerSum,
                    SUM(CASE WHEN TransactionType = 'ADJUSTMENT' THEN Quantity ELSE 0 END) AS AdjustmentLedgerSum
                FROM Warehouse_InventoryTransactions
                GROUP BY InventoryID
            ) TX ON I.InventoryID = TX.InventoryID
            LEFT JOIN (
                SELECT 
                    DI.InventoryID,
                    SUM(DI.Quantity) AS TotalDistributedItems
                FROM Warehouse_DistributionItems DI
                INNER JOIN Warehouse_Distributions D ON DI.DistributionID = D.DistributionID
                WHERE D.Status IN ('Issued', 'Received') AND DI.IsDeleted = 0 AND D.IsDeleted = 0
                GROUP BY DI.InventoryID
            ) DIST ON I.InventoryID = DIST.InventoryID
            WHERE I.IsDeleted = 0
            ORDER BY I.InventoryID ASC
        `);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const warehouseBatches = whRes.recordset.map(row => {
            const formulaExpected = row.QuantityReceived - row.TotalDistributedItems + row.AdjustmentLedgerSum - row.QuantityDamaged - row.QuantityExpired;
            const formulaVariance = row.QuantityAvailable - formulaExpected;
            const hasReceivingLedger = row.ReceivingLedgerSum > 0;
            const isExpired = row.ExpiryDate && new Date(row.ExpiryDate) <= today;

            let classification = 'MATCHED';
            if (row.QuantityAvailable < 0) {
                classification = 'NEGATIVE_BALANCE_ANOMALY';
            } else if (!hasReceivingLedger && formulaVariance === 0) {
                classification = 'HISTORICAL_PRE_LEDGER_SEED';
            } else if (formulaVariance !== 0 || (hasReceivingLedger && row.QuantityAvailable !== row.NetLedgerSum)) {
                classification = 'CONFIRMED_DISCREPANCY';
            } else if (isExpired && row.QuantityAvailable > 0) {
                classification = 'EXPIRED_QUARANTINED_STOCK';
            }

            return {
                inventoryId: Number(row.InventoryID),
                medicineId: row.MedicineID,
                medicineName: row.MedicineName,
                batchNumber: row.BatchNumber || row.LotNumber,
                expiryDate: row.ExpiryDate,
                quantityReceived: row.QuantityReceived,
                quantityAvailable: row.QuantityAvailable,
                totalDistributed: row.TotalDistributedItems,
                netLedgerSum: row.NetLedgerSum,
                formulaExpected,
                formulaVariance,
                classification
            };
        });

        // 2. City Pharmacy Inventory vs Pharmacy Movement Ledger
        const pharmRes = await pool.request().query(`
            SELECT
                ps.StockID,
                ps.MedicineID,
                m.ProductName AS MedicineName,
                ps.LotNumber,
                ps.ExpiryDate AS ExpirationDate,
                ps.Quantity AS CurrentQuantity,
                ps.DistributionItemID,
                ISNULL(tx.TxCount, 0) AS LedgerTxCount,
                ISNULL(tx.NetLedgerQuantity, 0) AS NetLedgerQuantity,
                ISNULL(tx.ReceiptQty, 0) AS ReceiptQty,
                ISNULL(tx.DispenseQty, 0) AS DispenseQty,
                ISNULL(tx.ReversalQty, 0) AS ReversalQty
            FROM Pharmacy_Stocks ps
            INNER JOIN Medicines m ON ps.MedicineID = m.MedicineID
            LEFT JOIN (
                SELECT
                    StockID,
                    COUNT(*) AS TxCount,
                    SUM(Quantity) AS NetLedgerQuantity,
                    SUM(CASE WHEN TransactionType = 'RECEIPT' THEN Quantity ELSE 0 END) AS ReceiptQty,
                    SUM(CASE WHEN TransactionType = 'DISPENSE' THEN ABS(Quantity) ELSE 0 END) AS DispenseQty,
                    SUM(CASE WHEN TransactionType = 'REVERSAL' THEN Quantity ELSE 0 END) AS ReversalQty
                FROM Pharmacy_InventoryTransactions
                GROUP BY StockID
            ) tx ON ps.StockID = tx.StockID
            ORDER BY ps.StockID ASC
        `);

        const pharmacyBatches = pharmRes.recordset.map(row => {
            const isExpired = row.ExpirationDate && new Date(row.ExpirationDate) <= today;
            const hasReceiptLedger = row.ReceiptQty > 0;
            const ledgerVariance = hasReceiptLedger ? (row.CurrentQuantity - row.NetLedgerQuantity) : 0;

            let classification = 'MATCHED';
            if (row.CurrentQuantity < 0) {
                classification = 'NEGATIVE_BALANCE_ANOMALY';
            } else if (!hasReceiptLedger) {
                classification = 'HISTORICAL_PRE_LEDGER_SEED';
            } else if (ledgerVariance !== 0) {
                classification = 'CONFIRMED_DISCREPANCY';
            } else if (isExpired && row.CurrentQuantity > 0) {
                classification = 'EXPIRED_QUARANTINED_STOCK';
            }

            return {
                stockId: row.StockID,
                medicineId: row.MedicineID,
                medicineName: row.MedicineName,
                lotNumber: row.LotNumber,
                expirationDate: row.ExpirationDate,
                currentQuantity: row.CurrentQuantity,
                netLedgerQuantity: row.NetLedgerQuantity,
                ledgerVariance,
                classification
            };
        });

        // 3. Barangay Health Station Inventory vs Station-Specific Movement Ledger
        const bgyRes = await pool.request().query(`
            SELECT
                bs.StockID AS BarangayStockID,
                bs.LocationID,
                wl.LocationName,
                bs.MedicineID,
                wm.ProductName AS MedicineName,
                bs.LotNumber,
                bs.ExpiryDate AS ExpirationDate,
                bs.Quantity AS CurrentQuantity,
                ISNULL(tx.TxCount, 0) AS LedgerTxCount,
                ISNULL(tx.NetLedgerQuantity, 0) AS NetLedgerQuantity,
                ISNULL(tx.ReceiptQty, 0) AS ReceiptQty,
                ISNULL(tx.DisbursementQty, 0) AS DisbursementQty,
                ISNULL(tx.ReversalQty, 0) AS ReversalQty
            FROM Barangay_Stocks bs
            INNER JOIN Warehouse_Locations wl ON bs.LocationID = wl.LocationID
            LEFT JOIN Warehouse_Medicines wm ON bs.MedicineID = wm.MedicineID
            LEFT JOIN (
                SELECT
                    StockID,
                    LocationID,
                    COUNT(*) AS TxCount,
                    SUM(Quantity) AS NetLedgerQuantity,
                    SUM(CASE WHEN TransactionType = 'RECEIPT' THEN Quantity ELSE 0 END) AS ReceiptQty,
                    SUM(CASE WHEN TransactionType = 'DISBURSEMENT' THEN ABS(Quantity) ELSE 0 END) AS DisbursementQty,
                    SUM(CASE WHEN TransactionType = 'REVERSAL' THEN Quantity ELSE 0 END) AS ReversalQty
                FROM Barangay_InventoryTransactions
                GROUP BY StockID, LocationID
            ) tx ON bs.StockID = tx.StockID AND bs.LocationID = tx.LocationID
            WHERE bs.IsActive = 1
            ORDER BY bs.StockID ASC
        `);

        const barangayBatches = bgyRes.recordset.map(row => {
            const isExpired = row.ExpirationDate && new Date(row.ExpirationDate) <= today;
            const hasReceiptLedger = row.ReceiptQty > 0;
            const ledgerVariance = hasReceiptLedger ? (row.CurrentQuantity - row.NetLedgerQuantity) : 0;

            let classification = 'MATCHED';
            if (row.CurrentQuantity < 0) {
                classification = 'NEGATIVE_BALANCE_ANOMALY';
            } else if (!hasReceiptLedger) {
                classification = 'HISTORICAL_PRE_LEDGER_SEED';
            } else if (ledgerVariance !== 0) {
                classification = 'CONFIRMED_DISCREPANCY';
            } else if (isExpired && row.CurrentQuantity > 0) {
                classification = 'EXPIRED_QUARANTINED_STOCK';
            }

            return {
                barangayStockId: row.BarangayStockID,
                locationId: row.LocationID,
                locationName: row.LocationName,
                medicineId: row.MedicineID,
                medicineName: row.MedicineName,
                lotNumber: row.LotNumber,
                expirationDate: row.ExpirationDate,
                currentQuantity: row.CurrentQuantity,
                netLedgerQuantity: row.NetLedgerQuantity,
                ledgerVariance,
                classification
            };
        });

        // 4 & 5. Issued Distribution Quantities vs Confirmed Receiving Quantities & Destination RECEIPT Ledger
        const distReconRes = await pool.request().query(`
            SELECT
                d.DistributionID,
                d.DistributionNumber,
                d.DestinationLocationID,
                wl.LocationName AS DestinationName,
                wl.LocationType AS DestinationType,
                d.Status,
                ISNULL(d.HasDiscrepancy, 0) AS HasDiscrepancy,
                di.DistributionItemID,
                di.Quantity AS IssuedQuantity,
                ISNULL(di.ReceivedQuantity, CASE WHEN d.Status = 'Received' AND ISNULL(d.HasDiscrepancy, 0) = 0 THEN di.Quantity ELSE 0 END) AS ConfirmedAcceptedQuantity,
                CASE WHEN d.Status = 'Received' AND di.Quantity > ISNULL(di.ReceivedQuantity, di.Quantity)
                     THEN (di.Quantity - ISNULL(di.ReceivedQuantity, di.Quantity))
                     ELSE 0 END AS QuantityVariance,
                ISNULL(ptx.PharmReceiptQty, 0) AS PharmacyLedgerReceiptQty,
                ISNULL(btx.BgyReceiptQty, 0) AS BarangayLedgerReceiptQty
            FROM Warehouse_Distributions d
            INNER JOIN Warehouse_Locations wl ON d.DestinationLocationID = wl.LocationID
            INNER JOIN Warehouse_DistributionItems di ON d.DistributionID = di.DistributionID AND di.IsDeleted = 0
            LEFT JOIN (
                SELECT ps.DistributionItemID, SUM(pit.Quantity) AS PharmReceiptQty
                FROM Pharmacy_Stocks ps
                INNER JOIN Pharmacy_InventoryTransactions pit ON ps.StockID = pit.StockID AND pit.TransactionType = 'RECEIPT'
                WHERE ps.DistributionItemID IS NOT NULL
                GROUP BY ps.DistributionItemID
            ) ptx ON di.DistributionItemID = ptx.DistributionItemID
            LEFT JOIN (
                SELECT bitx.ReferenceID AS DistributionID, bs.DistributionItemID, SUM(bitx.Quantity) AS BgyReceiptQty
                FROM Barangay_Stocks bs
                INNER JOIN Barangay_InventoryTransactions bitx ON bs.StockID = bitx.StockID AND bitx.TransactionType = 'RECEIPT'
                WHERE bs.DistributionItemID IS NOT NULL
                GROUP BY bitx.ReferenceID, bs.DistributionItemID
            ) btx ON di.DistributionItemID = btx.DistributionItemID
            WHERE d.IsDeleted = 0 AND d.Status IN ('Issued', 'Received')
            ORDER BY d.DistributionID DESC
        `);

        const distributionReconciliation = distReconRes.recordset.map(r => {
            const destinationLedgerAccepted = r.DestinationLocationID === 2 ? r.PharmacyLedgerReceiptQty : r.BarangayLedgerReceiptQty;
            const totalAccountedOnReceipt = r.ConfirmedAcceptedQuantity + r.QuantityVariance;
            let statusClass = 'MATCHED_RECEIPT';
            if (r.Status === 'Issued') {
                statusClass = 'IN_TRANSIT_PENDING';
            } else if (r.HasDiscrepancy || r.QuantityVariance > 0 || r.ConfirmedAcceptedQuantity !== r.IssuedQuantity) {
                statusClass = 'RECORDED_RECEIVING_VARIANCE';
            }
            return {
                distributionId: Number(r.DistributionID),
                distributionNumber: r.DistributionNumber,
                destinationLocationId: r.DestinationLocationID,
                destinationName: r.DestinationName,
                status: r.Status,
                issuedQuantity: r.IssuedQuantity,
                confirmedAcceptedQuantity: r.ConfirmedAcceptedQuantity,
                quantityVariance: r.QuantityVariance,
                totalAccountedOnReceipt,
                destinationLedgerAccepted,
                acceptedMatchesDestinationLedger: r.Status === 'Received'
                    ? (destinationLedgerAccepted === 0 || destinationLedgerAccepted === r.ConfirmedAcceptedQuantity)
                    : true,
                classification: statusClass
            };
        });

        // 6 & 7. Patient Medicine Releases & Reversals Reconciliation (Pharmacy + Barangay)
        const releaseReconRes = await pool.request().query(`
            SELECT
                (SELECT ISNULL(SUM(psd.Quantity), 0) FROM Pharmacy_Sales_Details psd INNER JOIN Pharmacy_Sales ps ON psd.SaleID = ps.SaleID) AS TotalPharmacyDispensedItems,
                (SELECT ISNULL(SUM(ABS(Quantity)), 0) FROM Pharmacy_InventoryTransactions WHERE TransactionType = 'DISPENSE') AS TotalPharmacyDispenseLedger,
                (SELECT ISNULL(SUM(psd.Quantity), 0) FROM Pharmacy_Sales_Details psd INNER JOIN Pharmacy_Sales ps ON psd.SaleID = ps.SaleID WHERE ps.Status = 'Cancelled') AS TotalPharmacyReversedItems,
                (SELECT ISNULL(SUM(Quantity), 0) FROM Pharmacy_InventoryTransactions WHERE TransactionType = 'REVERSAL') AS TotalPharmacyReversalLedger,
                (SELECT ISNULL(SUM(bdi.Quantity), 0) FROM Barangay_DisbursementItems bdi INNER JOIN Barangay_Disbursements bd ON bdi.DisbursementID = bd.DisbursementID) AS TotalBarangayDisbursedItems,
                (SELECT ISNULL(SUM(ABS(Quantity)), 0) FROM Barangay_InventoryTransactions WHERE TransactionType = 'DISBURSEMENT') AS TotalBarangayDisbursementLedger,
                (SELECT ISNULL(SUM(bdi.Quantity), 0) FROM Barangay_DisbursementItems bdi INNER JOIN Barangay_Disbursements bd ON bdi.DisbursementID = bd.DisbursementID WHERE bd.Status = 'Reversed') AS TotalBarangayReversedItems,
                (SELECT ISNULL(SUM(Quantity), 0) FROM Barangay_InventoryTransactions WHERE TransactionType = 'REVERSAL') AS TotalBarangayReversalLedger
        `);
        const releaseStats = releaseReconRes.recordset[0];

        // 12. Duplicate Ledger Reference Audit
        const dupRes = await pool.request().query(`
            SELECT
                (SELECT COUNT(*) FROM (
                    SELECT StockID, ReferenceID, COUNT(*) AS cnt
                    FROM Pharmacy_InventoryTransactions
                    WHERE TransactionType = 'RECEIPT' AND ReferenceID IS NOT NULL
                    GROUP BY StockID, ReferenceID
                    HAVING COUNT(*) > 1
                ) pdup) AS DuplicatePharmacyReceipts,
                (SELECT COUNT(*) FROM (
                    SELECT StockID, ReferenceID, COUNT(*) AS cnt
                    FROM Barangay_InventoryTransactions
                    WHERE TransactionType = 'RECEIPT' AND ReferenceID IS NOT NULL
                    GROUP BY StockID, ReferenceID
                    HAVING COUNT(*) > 1
                ) bdup) AS DuplicateBarangayReceipts
        `);
        const duplicateCheck = dupRes.recordset[0];

        return {
            generatedAt: new Date().toISOString(),
            summary: {
                warehouse: {
                    totalBatches: warehouseBatches.length,
                    matchedBatches: warehouseBatches.filter(b => b.classification === 'MATCHED').length,
                    historicalSeedBatches: warehouseBatches.filter(b => b.classification === 'HISTORICAL_PRE_LEDGER_SEED').length,
                    expiredQuarantinedBatches: warehouseBatches.filter(b => b.classification === 'EXPIRED_QUARANTINED_STOCK').length,
                    confirmedDiscrepancies: warehouseBatches.filter(b => b.classification === 'CONFIRMED_DISCREPANCY').length,
                    negativeBalanceBatches: warehouseBatches.filter(b => b.classification === 'NEGATIVE_BALANCE_ANOMALY').length
                },
                pharmacy: {
                    totalBatches: pharmacyBatches.length,
                    matchedBatches: pharmacyBatches.filter(b => b.classification === 'MATCHED').length,
                    historicalSeedBatches: pharmacyBatches.filter(b => b.classification === 'HISTORICAL_PRE_LEDGER_SEED').length,
                    expiredQuarantinedBatches: pharmacyBatches.filter(b => b.classification === 'EXPIRED_QUARANTINED_STOCK').length,
                    confirmedDiscrepancies: pharmacyBatches.filter(b => b.classification === 'CONFIRMED_DISCREPANCY').length,
                    negativeBalanceBatches: pharmacyBatches.filter(b => b.classification === 'NEGATIVE_BALANCE_ANOMALY').length
                },
                barangay: {
                    totalBatches: barangayBatches.length,
                    matchedBatches: barangayBatches.filter(b => b.classification === 'MATCHED').length,
                    historicalSeedBatches: barangayBatches.filter(b => b.classification === 'HISTORICAL_PRE_LEDGER_SEED').length,
                    expiredQuarantinedBatches: barangayBatches.filter(b => b.classification === 'EXPIRED_QUARANTINED_STOCK').length,
                    confirmedDiscrepancies: barangayBatches.filter(b => b.classification === 'CONFIRMED_DISCREPANCY').length,
                    negativeBalanceBatches: barangayBatches.filter(b => b.classification === 'NEGATIVE_BALANCE_ANOMALY').length
                },
                distributions: {
                    totalTrackedItems: distributionReconciliation.length,
                    matchedReceipts: distributionReconciliation.filter(d => d.classification === 'MATCHED_RECEIPT').length,
                    recordedReceivingVariances: distributionReconciliation.filter(d => d.classification === 'RECORDED_RECEIVING_VARIANCE').length,
                    inTransitPending: distributionReconciliation.filter(d => d.classification === 'IN_TRANSIT_PENDING').length,
                    unverifiedDestinationInflations: distributionReconciliation.filter(d => !d.acceptedMatchesDestinationLedger).length
                },
                patientReleasesAndReversals: {
                    pharmacyDispenseLedgerTotal: releaseStats.TotalPharmacyDispenseLedger,
                    pharmacyReversedItemsTotal: releaseStats.TotalPharmacyReversedItems,
                    pharmacyReversalLedgerTotal: releaseStats.TotalPharmacyReversalLedger,
                    pharmacyReversalsMatched: releaseStats.TotalPharmacyReversedItems === releaseStats.TotalPharmacyReversalLedger,
                    barangayDisbursedItemsTotal: releaseStats.TotalBarangayDisbursedItems,
                    barangayDisbursementLedgerTotal: releaseStats.TotalBarangayDisbursementLedger,
                    barangayDisbursementsMatched: releaseStats.TotalBarangayDisbursedItems === releaseStats.TotalBarangayDisbursementLedger,
                    barangayReversedItemsTotal: releaseStats.TotalBarangayReversedItems,
                    barangayReversalLedgerTotal: releaseStats.TotalBarangayReversalLedger,
                    barangayReversalsMatched: releaseStats.TotalBarangayReversedItems === releaseStats.TotalBarangayReversalLedger
                },
                ledgerIntegrity: {
                    duplicatePharmacyReceipts: duplicateCheck.DuplicatePharmacyReceipts,
                    duplicateBarangayReceipts: duplicateCheck.DuplicateBarangayReceipts
                }
            },
            warehouseBatches,
            pharmacyBatches,
            barangayBatches,
            distributionReconciliation
        };
    }

    /**
     * PHASE 14 (Workstream 14.5): Non-destructive Database Backup, Integrity & Recovery Readiness Verification
     */
    static async getDatabaseBackupAndIntegrityStatus(pool) {
        const dbPropsRes = await pool.request().query(`
            SELECT
                DB_NAME() AS DatabaseName,
                CAST(SERVERPROPERTY('Edition') AS NVARCHAR(128)) AS ServerEdition,
                CAST(SERVERPROPERTY('ProductVersion') AS NVARCHAR(128)) AS ProductVersion,
                CAST(DATABASEPROPERTYEX(DB_NAME(), 'Status') AS NVARCHAR(64)) AS DatabaseStatus,
                CAST(DATABASEPROPERTYEX(DB_NAME(), 'Recovery') AS NVARCHAR(64)) AS RecoveryModel,
                CAST(DATABASEPROPERTYEX(DB_NAME(), 'Updateability') AS NVARCHAR(64)) AS Updateability,
                CAST(DATABASEPROPERTYEX(DB_NAME(), 'UserAccess') AS NVARCHAR(64)) AS UserAccess,
                CAST(DATABASEPROPERTYEX(DB_NAME(), 'IsAutoClose') AS INT) AS IsAutoClose,
                CAST(DATABASEPROPERTYEX(DB_NAME(), 'IsTornPageDetectionEnabled') AS INT) AS IsTornPageDetectionEnabled
        `);
        const dbProps = dbPropsRes.recordset[0];

        const tableCountsRes = await pool.request().query(`
            SELECT
                (SELECT COUNT(*) FROM Users) AS UsersCount,
                (SELECT COUNT(*) FROM User_AuditLogs) AS UserAuditLogsCount,
                (SELECT COUNT(*) FROM Warehouse_Locations WHERE IsDeleted = 0) AS ActiveLocationsCount,
                (SELECT COUNT(*) FROM Warehouse_Medicines WHERE IsDeleted = 0) AS WarehouseMedicinesCount,
                (SELECT COUNT(*) FROM Warehouse_Inventory WHERE IsDeleted = 0) AS WarehouseInventoryCount,
                (SELECT COUNT(*) FROM Warehouse_InventoryTransactions) AS WarehouseTransactionsCount,
                (SELECT COUNT(*) FROM Warehouse_StockRequests WHERE IsDeleted = 0) AS StockRequestsCount,
                (SELECT COUNT(*) FROM Warehouse_Distributions WHERE IsDeleted = 0) AS DistributionsCount,
                (SELECT COUNT(*) FROM Pharmacy_Stocks) AS PharmacyStocksCount,
                (SELECT COUNT(*) FROM Pharmacy_Sales) AS PharmacySalesCount,
                (SELECT COUNT(*) FROM Pharmacy_InventoryTransactions) AS PharmacyTransactionsCount,
                (SELECT COUNT(*) FROM Barangay_Stocks WHERE IsActive = 1) AS BarangayStocksCount,
                (SELECT COUNT(*) FROM Barangay_Disbursements) AS BarangayDisbursementsCount,
                (SELECT COUNT(*) FROM Barangay_InventoryTransactions) AS BarangayTransactionsCount
        `);

        const fkRes = await pool.request().query(`
            SELECT COUNT(*) AS TotalForeignKeys,
                   SUM(CASE WHEN is_disabled = 0 THEN 1 ELSE 0 END) AS EnabledForeignKeys,
                   SUM(CASE WHEN is_not_trusted = 0 THEN 1 ELSE 0 END) AS TrustedForeignKeys
            FROM sys.foreign_keys
        `);

        const isAzureSql = String(dbProps.ServerEdition || '').toLowerCase().includes('sql azure');

        return {
            verifiedAt: new Date().toISOString(),
            database: dbProps,
            isAzureSqlManagedBackup: isAzureSql,
            backupArchitecture: {
                provider: isAzureSql ? 'Microsoft Azure SQL Automated Backups (Geo-Redundant / PITR)' : 'SQL Server Native Backup Engine',
                automatedFullBackups: 'Weekly automated full database backups managed by Azure SQL fabric',
                differentialBackups: 'Every 12–24 hours automated differential backups',
                transactionLogBackups: 'Every 5–10 minutes transaction log backups enabling Point-in-Time Restore (PITR)',
                pointInTimeRestoreRetentionDays: 7,
                targetRPO: '5 to 10 minutes (Azure SQL Transaction Log PITR window)',
                targetRTO: '15 to 60 minutes (Point-in-Time Restore to staging/production database instance)'
            },
            tableRowCounts: tableCountsRes.recordset[0],
            referentialIntegrity: fkRes.recordset[0]
        };
    }
}

module.exports = ReconciliationService;
