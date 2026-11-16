const sql = require('mssql');

/**
 * Service for Clinical Workflow Integration (Phase 9)
 * Connects Treatment Plans to Pharmacy Dispensing with:
 * - Prescription creation linked to PatientID and EncounterID
 * - Pre-dispensing checks without stock deduction
 * - Pharmacy prescriptions queue and fulfillment
 * - Full & partial dispensing with FEFO batch deduction
 * - Immutability & duplicate fulfillment safeguards
 */
class PrescriptionService {

    /**
     * Create a prescription associated with a clinical encounter.
     * Crucial: Does NOT deduct stock. Sets status to 'Pending'.
     */
    static async createPrescription(poolOrTx, data, userId = 1) {
        const {
            encounterId,
            patientId,
            prescribingProviderId,
            prescribingProviderName,
            clinicalDiagnosis,
            notes,
            items
        } = data;

        if (!encounterId) {
            throw new Error('Encounter ID is required to create a prescription.');
        }
        if (!patientId) {
            throw new Error('Patient ID is required to create a prescription.');
        }
        if (!prescribingProviderName || !prescribingProviderName.trim()) {
            throw new Error('Prescribing healthcare provider name is required.');
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
            throw new Error('At least one medicine must be prescribed.');
        }

        for (const item of items) {
            if (!item.medicineId) {
                throw new Error('Medicine ID is required for each prescribed item.');
            }
            if (!item.quantityPrescribed || Number(item.quantityPrescribed) <= 0) {
                throw new Error('Prescribed quantity must be greater than zero.');
            }
        }

        const isTx = poolOrTx instanceof sql.Transaction;
        let transaction = isTx ? poolOrTx : new sql.Transaction(poolOrTx);
        if (!isTx) {
            await transaction.begin();
        }

        try {
            const encReq = new sql.Request(transaction);
            encReq.input('EncounterID', sql.BigInt, Number(encounterId));
            encReq.input('PatientID', sql.Int, Number(patientId));
            const encRes = await encReq.query(`
                SELECT e.EncounterID, e.EncounterNumber, e.PatientID, e.Diagnosis, e.Status
                FROM Clinical_Encounters e
                WHERE e.EncounterID = @EncounterID AND e.PatientID = @PatientID
            `);
            if (!encRes.recordset.length) {
                throw new Error(`Encounter ID ${encounterId} not found or does not belong to Patient ID ${patientId}.`);
            }
            const encounter = encRes.recordset[0];

            const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const countReq = new sql.Request(transaction);
            countReq.input('Prefix', sql.NVarChar, `RX-${todayStr}%`);
            const countRes = await countReq.query('SELECT COUNT(*) AS cnt FROM Clinical_Prescriptions WHERE PrescriptionNumber LIKE @Prefix');
            const seq = String((countRes.recordset[0]?.cnt || 0) + 1).padStart(4, '0');
            const prescriptionNumber = `RX-${todayStr}-${seq}`;

            const rxReq = new sql.Request(transaction);
            rxReq.input('PrescriptionNumber', sql.NVarChar, prescriptionNumber);
            rxReq.input('EncounterID', sql.BigInt, Number(encounterId));
            rxReq.input('PatientID', sql.Int, Number(patientId));
            rxReq.input('PrescribingProviderID', sql.Int, prescribingProviderId ? Number(prescribingProviderId) : null);
            rxReq.input('PrescribingProviderName', sql.NVarChar, prescribingProviderName.trim());
            rxReq.input('ClinicalDiagnosis', sql.NVarChar, clinicalDiagnosis || encounter.Diagnosis || null);
            rxReq.input('Notes', sql.NVarChar, notes || null);
            rxReq.input('CreatedBy', sql.Int, userId);

            const rxRes = await rxReq.query(`
                INSERT INTO Clinical_Prescriptions (
                    PrescriptionNumber, EncounterID, PatientID, PrescribingProviderID,
                    PrescribingProviderName, PrescriptionDate, ClinicalDiagnosis,
                    Notes, Status, CreatedBy, CreatedDate
                )
                OUTPUT INSERTED.PrescriptionID
                VALUES (
                    @PrescriptionNumber, @EncounterID, @PatientID, @PrescribingProviderID,
                    @PrescribingProviderName, GETDATE(), @ClinicalDiagnosis,
                    @Notes, 'Pending', @CreatedBy, GETDATE()
                )
            `);
            const prescriptionId = rxRes.recordset[0].PrescriptionID;

            const createdItems = [];
            for (const item of items) {
                const medReq = new sql.Request(transaction);
                medReq.input('MedicineID', sql.Int, Number(item.medicineId));
                const medRes = await medReq.query('SELECT MedicineID, ProductName, GenericName, Dosage, Form FROM Warehouse_Medicines WHERE MedicineID = @MedicineID');
                if (!medRes.recordset.length) {
                    throw new Error(`Medicine ID ${item.medicineId} not found in catalog.`);
                }
                const med = medRes.recordset[0];

                const itemReq = new sql.Request(transaction);
                itemReq.input('PrescriptionID', sql.BigInt, prescriptionId);
                itemReq.input('MedicineID', sql.Int, med.MedicineID);
                itemReq.input('MedicineName', sql.NVarChar, med.ProductName);
                itemReq.input('GenericName', sql.NVarChar, med.GenericName || null);
                itemReq.input('QuantityPrescribed', sql.Int, Number(item.quantityPrescribed));
                itemReq.input('Dosage', sql.NVarChar, item.dosage || med.Dosage || null);
                itemReq.input('Frequency', sql.NVarChar, item.frequency || null);
                itemReq.input('Duration', sql.NVarChar, item.duration || null);
                itemReq.input('DosageInstructions', sql.NVarChar, item.dosageInstructions || null);

                const itemRes = await itemReq.query(`
                    INSERT INTO Clinical_PrescriptionItems (
                        PrescriptionID, MedicineID, MedicineName, GenericName,
                        QuantityPrescribed, QuantityDispensed, Dosage, Frequency,
                        Duration, DosageInstructions, ItemStatus, CreatedDate
                    )
                    OUTPUT INSERTED.PrescriptionItemID
                    VALUES (
                        @PrescriptionID, @MedicineID, @MedicineName, @GenericName,
                        @QuantityPrescribed, 0, @Dosage, @Frequency,
                        @Duration, @DosageInstructions, 'Pending', GETDATE()
                    )
                `);

                createdItems.push({
                    prescriptionItemId: itemRes.recordset[0].PrescriptionItemID,
                    medicineId: med.MedicineID,
                    medicineName: med.ProductName,
                    genericName: med.GenericName,
                    quantityPrescribed: Number(item.quantityPrescribed),
                    quantityDispensed: 0,
                    dosage: item.dosage || med.Dosage,
                    frequency: item.frequency,
                    duration: item.duration,
                    dosageInstructions: item.dosageInstructions,
                    status: 'Pending'
                });
            }

            if (!isTx) {
                await transaction.commit();
            }

            return {
                prescriptionId,
                prescriptionNumber,
                encounterId: Number(encounterId),
                patientId: Number(patientId),
                prescribingProviderName,
                clinicalDiagnosis: clinicalDiagnosis || encounter.Diagnosis,
                status: 'Pending',
                items: createdItems
            };
        } catch (err) {
            if (!isTx) {
                await transaction.rollback();
            }
            throw err;
        }
    }

    /**
     * Get prescription details by PrescriptionID
     */
    static async getPrescriptionById(pool, prescriptionId) {
        const req = pool.request();
        req.input('PrescriptionID', sql.BigInt, Number(prescriptionId));
        const res = await req.query(`
            SELECT 
                p.PrescriptionID,
                p.PrescriptionNumber,
                p.EncounterID,
                e.EncounterNumber,
                p.PatientID,
                pat.FullName AS PatientName,
                pat.BirthDate AS PatientBirthDate,
                pat.Gender AS PatientGender,
                pat.Barangay AS PatientBarangay,
                pat.ContactNumber AS PatientContact,
                pat.PhilHealthNumber AS PatientPhilHealth,
                p.PrescribingProviderID,
                p.PrescribingProviderName,
                p.PrescriptionDate,
                p.ClinicalDiagnosis,
                p.Notes,
                p.Status,
                p.CreatedDate
            FROM Clinical_Prescriptions p
            JOIN Patients pat ON p.PatientID = pat.PatientID
            JOIN Clinical_Encounters e ON p.EncounterID = e.EncounterID
            WHERE p.PrescriptionID = @PrescriptionID
        `);
        if (!res.recordset.length) {
            throw new Error(`Prescription ID ${prescriptionId} not found.`);
        }
        const prescription = res.recordset[0];

        const itemReq = pool.request();
        itemReq.input('PrescriptionID', sql.BigInt, Number(prescriptionId));
        const itemRes = await itemReq.query(`
            SELECT 
                i.PrescriptionItemID,
                i.PrescriptionID,
                i.MedicineID,
                i.MedicineName,
                i.GenericName,
                i.QuantityPrescribed,
                i.QuantityDispensed,
                (i.QuantityPrescribed - i.QuantityDispensed) AS RemainingQuantity,
                i.Dosage,
                i.Frequency,
                i.Duration,
                i.DosageInstructions,
                i.ItemStatus
            FROM Clinical_PrescriptionItems i
            WHERE i.PrescriptionID = @PrescriptionID
            ORDER BY i.PrescriptionItemID ASC
        `);

        const salesReq = pool.request();
        salesReq.input('PrescriptionID', sql.BigInt, Number(prescriptionId));
        const salesRes = await salesReq.query(`
            SELECT 
                s.SaleID,
                s.DispenseNumber,
                s.SaleDate,
                s.Status AS DispenseStatus,
                s.Remarks,
                u.FullName AS DispensedBy
            FROM Pharmacy_Sales s
            LEFT JOIN Users u ON s.SoldBy = u.UserID
            WHERE s.PrescriptionID = @PrescriptionID
            ORDER BY s.SaleDate DESC
        `);

        return {
            ...prescription,
            items: itemRes.recordset,
            dispenses: salesRes.recordset
        };
    }

    /**
     * Get prescriptions linked to a clinical encounter
     */
    static async getPrescriptionsByEncounter(pool, encounterId) {
        const req = pool.request();
        req.input('EncounterID', sql.BigInt, Number(encounterId));
        const res = await req.query(`
            SELECT 
                p.PrescriptionID,
                p.PrescriptionNumber,
                p.EncounterID,
                p.PatientID,
                p.PrescribingProviderName,
                p.PrescriptionDate,
                p.ClinicalDiagnosis,
                p.Notes,
                p.Status,
                p.CreatedDate,
                COUNT(i.PrescriptionItemID) AS TotalItems,
                SUM(CASE WHEN i.ItemStatus = 'Fully Dispensed' THEN 1 ELSE 0 END) AS FullyDispensedItems
            FROM Clinical_Prescriptions p
            LEFT JOIN Clinical_PrescriptionItems i ON p.PrescriptionID = i.PrescriptionID
            WHERE p.EncounterID = @EncounterID
            GROUP BY 
                p.PrescriptionID, p.PrescriptionNumber, p.EncounterID, p.PatientID,
                p.PrescribingProviderName, p.PrescriptionDate, p.ClinicalDiagnosis,
                p.Notes, p.Status, p.CreatedDate
            ORDER BY p.PrescriptionDate DESC
        `);

        const prescriptions = res.recordset;
        for (const rx of prescriptions) {
            const itemReq = pool.request();
            itemReq.input('PrescriptionID', sql.BigInt, rx.PrescriptionID);
            const itemRes = await itemReq.query(`
                SELECT 
                    PrescriptionItemID, MedicineID, MedicineName, GenericName,
                    QuantityPrescribed, QuantityDispensed, (QuantityPrescribed - QuantityDispensed) AS RemainingQuantity,
                    Dosage, Frequency, Duration, DosageInstructions, ItemStatus
                FROM Clinical_PrescriptionItems
                WHERE PrescriptionID = @PrescriptionID
            `);
            rx.items = itemRes.recordset;
        }

        return prescriptions;
    }

    /**
     * Pharmacy Prescriptions Queue for fulfillment
     */
    static async getPrescriptionsQueue(pool, filters = {}) {
        const { status, search, startDate, endDate } = filters;
        const req = pool.request();

        let query = `
            SELECT 
                p.PrescriptionID,
                p.PrescriptionNumber,
                p.EncounterID,
                e.EncounterNumber,
                p.PatientID,
                pat.FullName AS PatientName,
                pat.Barangay AS PatientBarangay,
                pat.ContactNumber AS PatientContact,
                p.PrescribingProviderName,
                p.PrescriptionDate,
                p.ClinicalDiagnosis,
                p.Status,
                COUNT(i.PrescriptionItemID) AS TotalItems,
                SUM(CASE WHEN i.ItemStatus = 'Pending' THEN 1 ELSE 0 END) AS PendingItemsCount,
                SUM(CASE WHEN i.ItemStatus = 'Partially Dispensed' THEN 1 ELSE 0 END) AS PartialItemsCount,
                SUM(CASE WHEN i.ItemStatus = 'Fully Dispensed' THEN 1 ELSE 0 END) AS FullyDispensedItemsCount
            FROM Clinical_Prescriptions p
            JOIN Patients pat ON p.PatientID = pat.PatientID
            JOIN Clinical_Encounters e ON p.EncounterID = e.EncounterID
            LEFT JOIN Clinical_PrescriptionItems i ON p.PrescriptionID = i.PrescriptionID
            WHERE 1=1
        `;

        if (status && status !== 'ALL') {
            req.input('Status', sql.NVarChar, status);
            query += ' AND p.Status = @Status';
        }

        if (search && search.trim()) {
            req.input('Search', sql.NVarChar, `%${search.trim()}%`);
            query += ' AND (p.PrescriptionNumber LIKE @Search OR pat.FullName LIKE @Search OR p.PrescribingProviderName LIKE @Search OR p.ClinicalDiagnosis LIKE @Search)';
        }

        if (startDate) {
            req.input('StartDate', sql.Date, startDate);
            query += ' AND CAST(p.PrescriptionDate AS DATE) >= @StartDate';
        }

        if (endDate) {
            req.input('EndDate', sql.Date, endDate);
            query += ' AND CAST(p.PrescriptionDate AS DATE) <= @EndDate';
        }

        query += `
            GROUP BY 
                p.PrescriptionID, p.PrescriptionNumber, p.EncounterID, e.EncounterNumber,
                p.PatientID, pat.FullName, pat.Barangay, pat.ContactNumber,
                p.PrescribingProviderName, p.PrescriptionDate, p.ClinicalDiagnosis, p.Status
            ORDER BY 
                CASE p.Status 
                    WHEN 'Pending' THEN 1 
                    WHEN 'Partially Dispensed' THEN 2 
                    WHEN 'Fully Dispensed' THEN 3 
                    ELSE 4 
                END ASC,
                p.PrescriptionDate DESC
        `;

        const res = await req.query(query);
        return res.recordset;
    }

    /**
     * Get fulfillment details for a prescription (with live eligible FEFO stock check)
     */
    static async getPrescriptionFulfillmentDetails(pool, prescriptionId) {
        const rx = await this.getPrescriptionById(pool, prescriptionId);

        for (const item of rx.items) {
            const stockReq = pool.request();
            stockReq.input('MedicineID', sql.Int, item.MedicineID);
            const stockRes = await stockReq.query(`
                SELECT 
                    COALESCE(SUM(Quantity), 0) AS TotalAvailableStock,
                    COUNT(*) AS ActiveBatchesCount
                FROM Pharmacy_Stocks
                WHERE MedicineID = @MedicineID AND IsActive = 1 AND Quantity > 0 AND ExpiryDate > CAST(GETDATE() AS DATE)
            `);
            item.availableStock = Number(stockRes.recordset[0]?.TotalAvailableStock || 0);

            const batchReq = pool.request();
            batchReq.input('MedicineID', sql.Int, item.MedicineID);
            const batchRes = await batchReq.query(`
                SELECT StockID, LotNumber, ExpiryDate, Quantity, Price
                FROM Pharmacy_Stocks
                WHERE MedicineID = @MedicineID AND IsActive = 1 AND Quantity > 0 AND ExpiryDate > CAST(GETDATE() AS DATE)
                ORDER BY ExpiryDate ASC, StockID ASC
            `);
            item.eligibleBatches = batchRes.recordset;
        }

        return rx;
    }

    /**
     * Dispense a prescription (Full or Partial) with FEFO stock deduction
     */
    static async dispensePrescription(pool, data, userId = 1) {
        const { prescriptionId, items, remarks } = data;

        if (!prescriptionId) {
            throw new Error('Prescription ID is required.');
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
            throw new Error('At least one item must be specified for dispensing.');
        }

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // 1. Lock & fetch prescription
            const rxReq = new sql.Request(transaction);
            rxReq.input('PrescriptionID', sql.BigInt, Number(prescriptionId));
            const rxRes = await rxReq.query(`
                SELECT p.*, pat.FullName AS PatientName
                FROM Clinical_Prescriptions p WITH (UPDLOCK, ROWLOCK)
                JOIN Patients pat ON p.PatientID = pat.PatientID
                WHERE p.PrescriptionID = @PrescriptionID
            `);
            if (!rxRes.recordset.length) {
                throw new Error(`Prescription ID ${prescriptionId} was not found.`);
            }
            const prescription = rxRes.recordset[0];

            if (prescription.Status === 'Cancelled') {
                throw new Error('Cannot dispense a cancelled prescription.');
            }
            if (prescription.Status === 'Fully Dispensed') {
                throw new Error('This prescription is already fully dispensed.');
            }

            // 2. Lock & fetch existing items
            const itemReq = new sql.Request(transaction);
            itemReq.input('PrescriptionID', sql.BigInt, Number(prescriptionId));
            const itemRes = await itemReq.query(`
                SELECT * FROM Clinical_PrescriptionItems WITH (UPDLOCK, ROWLOCK)
                WHERE PrescriptionID = @PrescriptionID
            `);
            const existingItems = itemRes.recordset;

            // 3. Validate items & stock availability
            for (const reqItem of items) {
                const matched = existingItems.find(ei => Number(ei.PrescriptionItemID) === Number(reqItem.prescriptionItemId));
                if (!matched) {
                    throw new Error(`Item ID ${reqItem.prescriptionItemId} does not belong to prescription ${prescription.PrescriptionNumber}.`);
                }
                const qtyToDispense = Number(reqItem.quantityToDispense);
                if (isNaN(qtyToDispense) || qtyToDispense <= 0) {
                    throw new Error(`Invalid dispense quantity for ${matched.MedicineName}.`);
                }
                const remaining = Number(matched.QuantityPrescribed) - Number(matched.QuantityDispensed);
                if (qtyToDispense > remaining) {
                    throw new Error(`Cannot dispense ${qtyToDispense} units for ${matched.MedicineName}. Remaining prescribed quantity is ${remaining}.`);
                }

                const stockCheckReq = new sql.Request(transaction);
                stockCheckReq.input('MedicineID', sql.Int, matched.MedicineID);
                const stockCheckRes = await stockCheckReq.query(`
                    SELECT COALESCE(SUM(Quantity), 0) AS AvailableStock
                    FROM Pharmacy_Stocks
                    WHERE MedicineID = @MedicineID AND IsActive = 1 AND Quantity > 0 AND ExpiryDate > CAST(GETDATE() AS DATE)
                `);
                const available = Number(stockCheckRes.recordset[0]?.AvailableStock || 0);
                if (available < qtyToDispense) {
                    throw new Error(`Insufficient non-expired pharmacy stock for ${matched.MedicineName}. Available: ${available}, Requested: ${qtyToDispense}.`);
                }
            }

            // 4. Generate sequential Dispense Number: DSP-YYYYMMDD-XXXX
            const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const countReq = new sql.Request(transaction);
            countReq.input('Prefix', sql.NVarChar, `DSP-${todayStr}%`);
            const countRes = await countReq.query('SELECT COUNT(*) AS cnt FROM Pharmacy_Sales WHERE DispenseNumber LIKE @Prefix');
            const seq = String((countRes.recordset[0]?.cnt || 0) + 1).padStart(4, '0');
            const dispenseNumber = `DSP-${todayStr}-${seq}`;

            // 5. Insert into Pharmacy_Sales
            const saleReq = new sql.Request(transaction);
            saleReq.input('SoldBy', sql.Int, userId);
            saleReq.input('PatientID', sql.Int, prescription.PatientID);
            saleReq.input('DispenseNumber', sql.NVarChar, dispenseNumber);
            saleReq.input('Remarks', sql.NVarChar, remarks || `Prescription fulfillment for ${prescription.PrescriptionNumber}`);
            saleReq.input('PrescriptionNumber', sql.NVarChar, prescription.PrescriptionNumber);
            saleReq.input('PhysicianName', sql.NVarChar, prescription.PrescribingProviderName);
            saleReq.input('PrescriptionID', sql.BigInt, prescription.PrescriptionID);
            saleReq.input('EncounterID', sql.BigInt, prescription.EncounterID);

            const saleRes = await saleReq.query(`
                INSERT INTO Pharmacy_Sales (
                    SoldBy, PatientID, SaleDate, DispenseNumber, Status,
                    Remarks, PrescriptionNumber, PhysicianName, PrescriptionID, EncounterID
                )
                OUTPUT INSERTED.SaleID
                VALUES (
                    @SoldBy, @PatientID, GETDATE(), @DispenseNumber, 'Completed',
                    @Remarks, @PrescriptionNumber, @PhysicianName, @PrescriptionID, @EncounterID
                )
            `);
            const saleId = saleRes.recordset[0].SaleID;

            // 6. Deduct stock using FEFO and record details & ledger
            const dispensedLines = [];
            for (const reqItem of items) {
                const matched = existingItems.find(ei => Number(ei.PrescriptionItemID) === Number(reqItem.prescriptionItemId));
                let qtyRemainingToAllocate = Number(reqItem.quantityToDispense);

                const batchReq = new sql.Request(transaction);
                batchReq.input('MedicineID', sql.Int, matched.MedicineID);
                const batchesRes = await batchReq.query(`
                    SELECT StockID, Quantity, LotNumber, ExpiryDate, Price, UnitID
                    FROM Pharmacy_Stocks WITH (UPDLOCK, ROWLOCK)
                    WHERE MedicineID = @MedicineID AND IsActive = 1 AND Quantity > 0 AND ExpiryDate > CAST(GETDATE() AS DATE)
                    ORDER BY ExpiryDate ASC, StockID ASC
                `);

                for (const batch of batchesRes.recordset) {
                    if (qtyRemainingToAllocate <= 0) break;
                    const batchQty = Number(batch.Quantity);
                    const allocateFromBatch = Math.min(qtyRemainingToAllocate, batchQty);

                    const deductReq = new sql.Request(transaction);
                    deductReq.input('StockID', sql.Int, batch.StockID);
                    deductReq.input('AllocatedQty', sql.Int, allocateFromBatch);
                    await deductReq.query(`
                        UPDATE Pharmacy_Stocks
                        SET Quantity = Quantity - @AllocatedQty,
                            ModifiedDate = GETDATE()
                        WHERE StockID = @StockID AND Quantity >= @AllocatedQty
                    `);

                    const detailReq = new sql.Request(transaction);
                    detailReq.input('SaleID', sql.Int, saleId);
                    detailReq.input('MedicineID', sql.Int, matched.MedicineID);
                    detailReq.input('Quantity', sql.Int, allocateFromBatch);
                    detailReq.input('Price', sql.Decimal(18, 2), batch.Price || 0);
                    detailReq.input('UnitID', sql.Int, batch.UnitID || 1);
                    detailReq.input('StockID', sql.Int, batch.StockID);
                    detailReq.input('LotNumber', sql.NVarChar, batch.LotNumber);
                    detailReq.input('ExpiryDate', sql.Date, batch.ExpiryDate);
                    detailReq.input('DosageInstructions', sql.NVarChar, reqItem.dosageInstructions || matched.DosageInstructions || null);
                    detailReq.input('PrescriptionItemID', sql.BigInt, matched.PrescriptionItemID);

                    await detailReq.query(`
                        INSERT INTO Pharmacy_Sales_Details (
                            SaleID, MedicineID, Quantity, Price, UnitID,
                            StockID, LotNumber, ExpiryDate, DosageInstructions, PrescriptionItemID
                        )
                        VALUES (
                            @SaleID, @MedicineID, @Quantity, @Price, @UnitID,
                            @StockID, @LotNumber, @ExpiryDate, @DosageInstructions, @PrescriptionItemID
                        )
                    `);

                    const ledgerReq = new sql.Request(transaction);
                    ledgerReq.input('StockID', sql.Int, batch.StockID);
                    ledgerReq.input('MedicineID', sql.Int, matched.MedicineID);
                    ledgerReq.input('TransactionType', sql.NVarChar, 'DISPENSE');
                    ledgerReq.input('ReferenceNumber', sql.NVarChar, dispenseNumber);
                    ledgerReq.input('ReferenceID', sql.BigInt, saleId);
                    ledgerReq.input('Quantity', sql.Int, -allocateFromBatch);
                    ledgerReq.input('BatchNumber', sql.NVarChar, batch.LotNumber);
                    ledgerReq.input('ExpiryDate', sql.Date, batch.ExpiryDate);
                    ledgerReq.input('Remarks', sql.NVarChar, `Prescription ${prescription.PrescriptionNumber} dispensed to ${prescription.PatientName} (${dispenseNumber})`);
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

                    qtyRemainingToAllocate -= allocateFromBatch;
                }

                const newDispensedTotal = Number(matched.QuantityDispensed) + Number(reqItem.quantityToDispense);
                const newItemStatus = newDispensedTotal >= Number(matched.QuantityPrescribed) ? 'Fully Dispensed' : 'Partially Dispensed';

                const updateItemReq = new sql.Request(transaction);
                updateItemReq.input('PrescriptionItemID', sql.BigInt, matched.PrescriptionItemID);
                updateItemReq.input('QuantityDispensed', sql.Int, newDispensedTotal);
                updateItemReq.input('ItemStatus', sql.NVarChar, newItemStatus);
                await updateItemReq.query(`
                    UPDATE Clinical_PrescriptionItems
                    SET QuantityDispensed = @QuantityDispensed,
                        ItemStatus = @ItemStatus
                    WHERE PrescriptionItemID = @PrescriptionItemID
                `);

                dispensedLines.push({
                    prescriptionItemId: matched.PrescriptionItemID,
                    medicineName: matched.MedicineName,
                    quantityDispensed: Number(reqItem.quantityToDispense),
                    totalDispensed: newDispensedTotal,
                    quantityPrescribed: Number(matched.QuantityPrescribed),
                    itemStatus: newItemStatus
                });
            }

            // 7. Re-evaluate parent prescription status
            const checkAllReq = new sql.Request(transaction);
            checkAllReq.input('PrescriptionID', sql.BigInt, Number(prescriptionId));
            const checkAllRes = await checkAllReq.query(`
                SELECT 
                    COUNT(*) AS totalItems,
                    SUM(CASE WHEN ItemStatus = 'Fully Dispensed' THEN 1 ELSE 0 END) AS fullyDispensedItems,
                    SUM(CASE WHEN QuantityDispensed > 0 THEN 1 ELSE 0 END) AS anyDispensedItems
                FROM Clinical_PrescriptionItems
                WHERE PrescriptionID = @PrescriptionID
            `);
            const { totalItems, fullyDispensedItems, anyDispensedItems } = checkAllRes.recordset[0];
            let newRxStatus = 'Pending';
            if (fullyDispensedItems === totalItems) {
                newRxStatus = 'Fully Dispensed';
            } else if (anyDispensedItems > 0) {
                newRxStatus = 'Partially Dispensed';
            }

            const updateRxReq = new sql.Request(transaction);
            updateRxReq.input('PrescriptionID', sql.BigInt, Number(prescriptionId));
            updateRxReq.input('Status', sql.NVarChar, newRxStatus);
            updateRxReq.input('ModifiedBy', sql.Int, userId);
            await updateRxReq.query(`
                UPDATE Clinical_Prescriptions
                SET Status = @Status,
                    ModifiedDate = GETDATE(),
                    ModifiedBy = @ModifiedBy
                WHERE PrescriptionID = @PrescriptionID
            `);

            await transaction.commit();

            return {
                success: true,
                saleId,
                dispenseNumber,
                prescriptionNumber: prescription.PrescriptionNumber,
                prescriptionStatus: newRxStatus,
                lines: dispensedLines,
                message: `Successfully dispensed ${dispensedLines.length} item(s) for prescription ${prescription.PrescriptionNumber}. Dispense ref: ${dispenseNumber}.`
            };
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    }

    /**
     * Cancel a prescription (if not yet dispensed)
     */
    static async cancelPrescription(pool, prescriptionId, reason = 'Clinical order discontinued', userId = 1) {
        const req = pool.request();
        req.input('PrescriptionID', sql.BigInt, Number(prescriptionId));
        const res = await req.query(`
            SELECT p.*, 
                   (SELECT COUNT(*) FROM Clinical_PrescriptionItems WHERE PrescriptionID = p.PrescriptionID AND QuantityDispensed > 0) AS DispensedItemsCount
            FROM Clinical_Prescriptions p
            WHERE p.PrescriptionID = @PrescriptionID
        `);
        if (!res.recordset.length) {
            throw new Error(`Prescription ID ${prescriptionId} not found.`);
        }
        const prescription = res.recordset[0];
        if (prescription.Status === 'Cancelled') {
            throw new Error('Prescription is already cancelled.');
        }
        if (prescription.DispensedItemsCount > 0 || prescription.Status === 'Fully Dispensed' || prescription.Status === 'Partially Dispensed') {
            throw new Error('Cannot cancel a prescription that has already been partially or fully dispensed by pharmacy.');
        }

        const cancelReq = pool.request();
        cancelReq.input('PrescriptionID', sql.BigInt, Number(prescriptionId));
        cancelReq.input('Notes', sql.NVarChar, prescription.Notes ? `${prescription.Notes} | CANCELLED: ${reason}` : `CANCELLED: ${reason}`);
        cancelReq.input('ModifiedBy', sql.Int, userId);
        await cancelReq.query(`
            UPDATE Clinical_Prescriptions
            SET Status = 'Cancelled',
                Notes = @Notes,
                ModifiedDate = GETDATE(),
                ModifiedBy = @ModifiedBy
            WHERE PrescriptionID = @PrescriptionID;

            UPDATE Clinical_PrescriptionItems
            SET ItemStatus = 'Cancelled'
            WHERE PrescriptionID = @PrescriptionID;
        `);

        return {
            success: true,
            prescriptionId: Number(prescriptionId),
            prescriptionNumber: prescription.PrescriptionNumber,
            status: 'Cancelled',
            message: `Prescription ${prescription.PrescriptionNumber} has been cancelled.`
        };
    }
}

module.exports = PrescriptionService;
