const sql = require('mssql');

/**
 * Service for Patient Management & Clinical Consultation (Phase 8)
 * Implements patient registry with duplicate prevention, clinical encounters,
 * vital signs tracking, audit amendments, and unified medical history.
 */
class ClinicalService {
    /**
     * Get Clinical Dashboard KPIs and Recent Encounters
     */
    static async getClinicalDashboardStats(pool) {
        // 1. Patient and encounter count metrics
        const statsRes = await pool.request().query(`
            SELECT 
                (SELECT COUNT(*) FROM Patients WHERE IsActive = 1) AS totalPatients,
                (SELECT COUNT(*) FROM Clinical_Encounters WHERE CAST(EncounterDate AS DATE) = CAST(GETDATE() AS DATE)) AS encountersToday,
                (SELECT COUNT(*) FROM Clinical_Encounters WHERE CAST(EncounterDate AS DATE) = CAST(GETDATE() AS DATE) AND Status = 'Finalized') AS finalizedToday,
                (SELECT COUNT(*) FROM Clinical_Encounters WHERE Status = 'In Progress') AS inProgressEncounters,
                (SELECT COUNT(*) FROM Clinical_Encounters) AS totalLifetimeEncounters
        `);

        // 2. Recent encounters (latest 6)
        const recentRes = await pool.request().query(`
            SELECT TOP 6
                e.EncounterID,
                e.EncounterNumber,
                e.EncounterDate,
                e.EncounterType,
                e.ChiefComplaint,
                e.Diagnosis,
                e.Status,
                e.AttendingProviderName,
                p.PatientID,
                p.FullName AS PatientName,
                p.Barangay
            FROM Clinical_Encounters e
            INNER JOIN Patients p ON e.PatientID = p.PatientID
            ORDER BY e.EncounterDate DESC, e.EncounterID DESC
        `);

        // 3. Top Diagnoses (last 60 days)
        const topDiagRes = await pool.request().query(`
            SELECT TOP 5
                Diagnosis,
                COUNT(*) AS OccurrenceCount
            FROM Clinical_Encounters
            WHERE Diagnosis IS NOT NULL AND LTRIM(RTRIM(Diagnosis)) <> ''
              AND EncounterDate >= DATEADD(day, -60, GETDATE())
            GROUP BY Diagnosis
            ORDER BY OccurrenceCount DESC
        `);

        const stats = statsRes.recordset[0] || {};
        return {
            totalPatients: Number(stats.totalPatients || 0),
            encountersToday: Number(stats.encountersToday || 0),
            finalizedToday: Number(stats.finalizedToday || 0),
            inProgressEncounters: Number(stats.inProgressEncounters || 0),
            totalLifetimeEncounters: Number(stats.totalLifetimeEncounters || 0),
            recentEncounters: recentRes.recordset || [],
            topDiagnoses: topDiagRes.recordset || []
        };
    }

    /**
     * Get searchable and filterable patient list with encounter and dispensing counts
     */
    static async getPatients(pool, filters = {}) {
        const { search, barangay, gender } = filters;
        let query = `
            SELECT 
                p.PatientID,
                p.FirstName,
                p.MiddleName,
                p.Surname,
                p.FullName,
                p.BirthDate,
                p.Gender,
                p.CivilStatus,
                p.Barangay,
                p.DetailedAddress,
                p.ContactNumber,
                p.Email,
                p.PhilHealthNumber,
                p.EmergencyContactName,
                p.EmergencyContactNumber,
                p.BloodType,
                p.IsActive,
                p.DateRegistered,
                DATEDIFF(year, p.BirthDate, GETDATE()) - 
                CASE 
                    WHEN DATEADD(year, DATEDIFF(year, p.BirthDate, GETDATE()), p.BirthDate) > GETDATE() THEN 1 
                    ELSE 0 
                END AS Age,
                COUNT(DISTINCT e.EncounterID) AS TotalEncounters,
                MAX(e.EncounterDate) AS LastEncounterDate,
                COUNT(DISTINCT s.SaleID) AS TotalPrescriptionsDispensed,
                MAX(s.SaleDate) AS LastDispenseDate
            FROM Patients p
            LEFT JOIN Clinical_Encounters e ON p.PatientID = e.PatientID
            LEFT JOIN Pharmacy_Sales s ON p.PatientID = s.PatientID AND s.Status = 'Completed'
            WHERE p.IsActive = 1
        `;

        const req = pool.request();

        if (search) {
            query += ` AND (
                p.FullName LIKE @Search OR 
                p.FirstName LIKE @Search OR 
                p.Surname LIKE @Search OR 
                p.ContactNumber LIKE @Search OR 
                p.PhilHealthNumber LIKE @Search
            )`;
            req.input('Search', sql.NVarChar, '%' + search + '%');
        }

        if (barangay) {
            query += ' AND p.Barangay = @Barangay';
            req.input('Barangay', sql.NVarChar, barangay);
        }

        if (gender) {
            query += ' AND p.Gender = @Gender';
            req.input('Gender', sql.NVarChar, gender);
        }

        query += `
            GROUP BY 
                p.PatientID, p.FirstName, p.MiddleName, p.Surname, p.FullName,
                p.BirthDate, p.Gender, p.CivilStatus, p.Barangay, p.DetailedAddress,
                p.ContactNumber, p.Email, p.PhilHealthNumber, p.EmergencyContactName,
                p.EmergencyContactNumber, p.BloodType, p.IsActive, p.DateRegistered
            ORDER BY p.Surname ASC, p.FirstName ASC
        `;

        const res = await req.query(query);
        return res.recordset;
    }

    /**
     * Get single patient demographic and profile details
     */
    static async getPatientById(pool, patientId) {
        const req = pool.request();
        req.input('PatientID', sql.Int, Number(patientId));
        const res = await req.query(`
            SELECT 
                p.*,
                DATEDIFF(year, p.BirthDate, GETDATE()) - 
                CASE 
                    WHEN DATEADD(year, DATEDIFF(year, p.BirthDate, GETDATE()), p.BirthDate) > GETDATE() THEN 1 
                    ELSE 0 
                END AS Age,
                (SELECT COUNT(*) FROM Clinical_Encounters WHERE PatientID = p.PatientID) AS TotalEncounters,
                (SELECT COUNT(*) FROM Clinical_Encounters WHERE PatientID = p.PatientID AND Status = 'Finalized') AS FinalizedEncounters,
                (SELECT COUNT(*) FROM Pharmacy_Sales WHERE PatientID = p.PatientID AND Status = 'Completed') AS TotalDispensedRecords
            FROM Patients p
            WHERE p.PatientID = @PatientID
        `);

        if (!res.recordset.length) {
            throw new Error(`Patient ID ${patientId} not found.`);
        }
        return res.recordset[0];
    }

    /**
     * Create new patient with strict duplicate prevention
     */
    static async createPatient(pool, data, userId = 1) {
        const {
            firstName,
            middleName,
            surname,
            birthDate,
            gender,
            civilStatus,
            barangay,
            detailedAddress,
            contactNumber,
            email,
            philHealthNumber,
            emergencyContactName,
            emergencyContactNumber,
            bloodType
        } = data;

        if (!firstName || !firstName.trim()) {
            throw new Error('Patient First Name is required.');
        }
        if (!surname || !surname.trim()) {
            throw new Error('Patient Surname is required.');
        }
        if (!barangay || !barangay.trim()) {
            throw new Error('Barangay is required for City Health Office patient registration.');
        }

        const trimmedFirst = firstName.trim();
        const trimmedMiddle = middleName ? middleName.trim() : null;
        const trimmedSurname = surname.trim();
        const fullName = `${trimmedSurname}, ${trimmedFirst}${trimmedMiddle ? ' ' + trimmedMiddle : ''}`;

        // 1. Duplicate check: Name + BirthDate or Name + ContactNumber or PhilHealth
        const dupReq = pool.request();
        dupReq.input('First', sql.NVarChar, trimmedFirst);
        dupReq.input('Surname', sql.NVarChar, trimmedSurname);
        dupReq.input('BirthDate', sql.Date, birthDate || null);
        dupReq.input('Phone', sql.NVarChar, contactNumber ? contactNumber.trim() : '');
        dupReq.input('PhilHealth', sql.NVarChar, philHealthNumber ? philHealthNumber.trim() : '');

        let dupQuery = `
            SELECT PatientID, FullName, BirthDate, ContactNumber, PhilHealthNumber
            FROM Patients
            WHERE IsActive = 1 AND (
                (
                    LOWER(LTRIM(RTRIM(FirstName))) = LOWER(LTRIM(RTRIM(@First))) AND 
                    LOWER(LTRIM(RTRIM(Surname))) = LOWER(LTRIM(RTRIM(@Surname))) AND
                    (
                        (@BirthDate IS NOT NULL AND BirthDate = @BirthDate) OR
                        (@Phone <> '' AND ContactNumber = @Phone)
                    )
                )
                OR (@PhilHealth <> '' AND PhilHealthNumber = @PhilHealth)
            )
        `;

        const dupRes = await dupReq.query(dupQuery);
        if (dupRes.recordset.length > 0) {
            const existing = dupRes.recordset[0];
            throw new Error(`Duplicate patient record detected. Patient '${existing.FullName}' is already registered with matching identifiers (Patient ID: ${existing.PatientID}).`);
        }

        // 2. Insert new patient record
        const insertReq = pool.request();
        insertReq.input('FirstName', sql.NVarChar, trimmedFirst);
        insertReq.input('MiddleName', sql.NVarChar, trimmedMiddle);
        insertReq.input('Surname', sql.NVarChar, trimmedSurname);
        insertReq.input('FullName', sql.NVarChar, fullName);
        insertReq.input('BirthDate', sql.Date, birthDate || null);
        insertReq.input('Gender', sql.NVarChar, gender || null);
        insertReq.input('CivilStatus', sql.NVarChar, civilStatus || null);
        insertReq.input('Barangay', sql.NVarChar, barangay.trim());
        insertReq.input('DetailedAddress', sql.NVarChar, detailedAddress ? detailedAddress.trim() : null);
        insertReq.input('ContactNumber', sql.NVarChar, contactNumber ? contactNumber.trim() : null);
        insertReq.input('Email', sql.NVarChar, email ? email.trim() : null);
        insertReq.input('PhilHealthNumber', sql.NVarChar, philHealthNumber ? philHealthNumber.trim() : null);
        insertReq.input('EmergencyContactName', sql.NVarChar, emergencyContactName ? emergencyContactName.trim() : null);
        insertReq.input('EmergencyContactNumber', sql.NVarChar, emergencyContactNumber ? emergencyContactNumber.trim() : null);
        insertReq.input('BloodType', sql.NVarChar, bloodType || null);

        const insertRes = await insertReq.query(`
            INSERT INTO Patients (
                FirstName, MiddleName, Surname, FullName, BirthDate,
                Gender, CivilStatus, Barangay, DetailedAddress, ContactNumber,
                Email, PhilHealthNumber, EmergencyContactName, EmergencyContactNumber,
                BloodType, IsActive, DateRegistered
            )
            OUTPUT INSERTED.PatientID
            VALUES (
                @FirstName, @MiddleName, @Surname, @FullName, @BirthDate,
                @Gender, @CivilStatus, @Barangay, @DetailedAddress, @ContactNumber,
                @Email, @PhilHealthNumber, @EmergencyContactName, @EmergencyContactNumber,
                @BloodType, 1, GETDATE()
            )
        `);

        const newId = insertRes.recordset[0].PatientID;
        return {
            success: true,
            patientId: newId,
            fullName,
            message: `Patient ${fullName} successfully registered.`
        };
    }

    /**
     * Update existing patient information with duplicate validation
     */
    static async updatePatient(pool, patientId, data, userId = 1) {
        const {
            firstName,
            middleName,
            surname,
            birthDate,
            gender,
            civilStatus,
            barangay,
            detailedAddress,
            contactNumber,
            email,
            philHealthNumber,
            emergencyContactName,
            emergencyContactNumber,
            bloodType
        } = data;

        if (!firstName || !firstName.trim() || !surname || !surname.trim() || !barangay || !barangay.trim()) {
            throw new Error('First Name, Surname, and Barangay are required fields.');
        }

        const trimmedFirst = firstName.trim();
        const trimmedMiddle = middleName ? middleName.trim() : null;
        const trimmedSurname = surname.trim();
        const fullName = `${trimmedSurname}, ${trimmedFirst}${trimmedMiddle ? ' ' + trimmedMiddle : ''}`;

        // Duplicate check excluding current patient
        const dupReq = pool.request();
        dupReq.input('PatientID', sql.Int, Number(patientId));
        dupReq.input('First', sql.NVarChar, trimmedFirst);
        dupReq.input('Surname', sql.NVarChar, trimmedSurname);
        dupReq.input('BirthDate', sql.Date, birthDate || null);
        dupReq.input('Phone', sql.NVarChar, contactNumber ? contactNumber.trim() : '');
        dupReq.input('PhilHealth', sql.NVarChar, philHealthNumber ? philHealthNumber.trim() : '');

        const dupRes = await dupReq.query(`
            SELECT PatientID, FullName FROM Patients
            WHERE IsActive = 1 AND PatientID <> @PatientID AND (
                (
                    LOWER(LTRIM(RTRIM(FirstName))) = LOWER(LTRIM(RTRIM(@First))) AND 
                    LOWER(LTRIM(RTRIM(Surname))) = LOWER(LTRIM(RTRIM(@Surname))) AND
                    (
                        (@BirthDate IS NOT NULL AND BirthDate = @BirthDate) OR
                        (@Phone <> '' AND ContactNumber = @Phone)
                    )
                )
                OR (@PhilHealth <> '' AND PhilHealthNumber = @PhilHealth)
            )
        `);

        if (dupRes.recordset.length > 0) {
            throw new Error(`Another patient is already registered with these identifiers (Patient ID: ${dupRes.recordset[0].PatientID}).`);
        }

        const updateReq = pool.request();
        updateReq.input('PatientID', sql.Int, Number(patientId));
        updateReq.input('FirstName', sql.NVarChar, trimmedFirst);
        updateReq.input('MiddleName', sql.NVarChar, trimmedMiddle);
        updateReq.input('Surname', sql.NVarChar, trimmedSurname);
        updateReq.input('FullName', sql.NVarChar, fullName);
        updateReq.input('BirthDate', sql.Date, birthDate || null);
        updateReq.input('Gender', sql.NVarChar, gender || null);
        updateReq.input('CivilStatus', sql.NVarChar, civilStatus || null);
        updateReq.input('Barangay', sql.NVarChar, barangay.trim());
        updateReq.input('DetailedAddress', sql.NVarChar, detailedAddress ? detailedAddress.trim() : null);
        updateReq.input('ContactNumber', sql.NVarChar, contactNumber ? contactNumber.trim() : null);
        updateReq.input('Email', sql.NVarChar, email ? email.trim() : null);
        updateReq.input('PhilHealthNumber', sql.NVarChar, philHealthNumber ? philHealthNumber.trim() : null);
        updateReq.input('EmergencyContactName', sql.NVarChar, emergencyContactName ? emergencyContactName.trim() : null);
        updateReq.input('EmergencyContactNumber', sql.NVarChar, emergencyContactNumber ? emergencyContactNumber.trim() : null);
        updateReq.input('BloodType', sql.NVarChar, bloodType || null);
        updateReq.input('ModifiedBy', sql.Int, userId);

        await updateReq.query(`
            UPDATE Patients
            SET FirstName = @FirstName,
                MiddleName = @MiddleName,
                Surname = @Surname,
                FullName = @FullName,
                BirthDate = @BirthDate,
                Gender = @Gender,
                CivilStatus = @CivilStatus,
                Barangay = @Barangay,
                DetailedAddress = @DetailedAddress,
                ContactNumber = @ContactNumber,
                Email = @Email,
                PhilHealthNumber = @PhilHealthNumber,
                EmergencyContactName = @EmergencyContactName,
                EmergencyContactNumber = @EmergencyContactNumber,
                BloodType = @BloodType,
                ModifiedDate = GETDATE(),
                ModifiedBy = @ModifiedBy
            WHERE PatientID = @PatientID
        `);

        return {
            success: true,
            patientId: Number(patientId),
            fullName,
            message: `Patient ${fullName} updated successfully.`
        };
    }

    /**
     * Create a new Clinical Consultation / Encounter with optional Vital Signs
     */
    static async createEncounter(pool, data, userId = 1) {
        const {
            patientId,
            attendingProviderName,
            attendingProviderId,
            encounterType,
            chiefComplaint,
            historyOfPresentIllness,
            clinicalNotes,
            assessment,
            diagnosis,
            icd10Code,
            treatmentPlan,
            status,
            vitalSigns
        } = data;

        if (!patientId) {
            throw new Error('A registered patient is required to open a clinical encounter.');
        }
        if (!attendingProviderName || !attendingProviderName.trim()) {
            throw new Error('Attending Healthcare Provider name is required.');
        }
        if (!chiefComplaint || !chiefComplaint.trim()) {
            throw new Error('Chief Complaint is required for clinical consultations.');
        }
        if (!assessment || !assessment.trim()) {
            throw new Error('Clinical Assessment is required.');
        }
        if (!diagnosis || !diagnosis.trim()) {
            throw new Error('Clinical Diagnosis is required.');
        }

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // 1. Verify Patient exists and is active
            const patCheckReq = new sql.Request(transaction);
            patCheckReq.input('PatientID', sql.Int, Number(patientId));
            const patRes = await patCheckReq.query('SELECT PatientID, FullName FROM Patients WHERE PatientID = @PatientID AND IsActive = 1');
            if (!patRes.recordset.length) {
                throw new Error(`Patient ID ${patientId} is invalid or inactive.`);
            }
            const patient = patRes.recordset[0];

            // 2. Generate unique EncounterNumber: ENC-YYYYMMDD-XXXX
            const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const countReq = new sql.Request(transaction);
            countReq.input('Prefix', sql.NVarChar, `ENC-${todayStr}%`);
            const countRes = await countReq.query('SELECT COUNT(*) AS cnt FROM Clinical_Encounters WHERE EncounterNumber LIKE @Prefix');
            const seq = String((countRes.recordset[0]?.cnt || 0) + 1).padStart(4, '0');
            const encounterNumber = `ENC-${todayStr}-${seq}`;

            const encounterStatus = status === 'Finalized' ? 'Finalized' : 'In Progress';

            // 3. Insert into Clinical_Encounters
            const encReq = new sql.Request(transaction);
            encReq.input('EncounterNumber', sql.NVarChar, encounterNumber);
            encReq.input('PatientID', sql.Int, Number(patientId));
            encReq.input('AttendingProviderID', sql.Int, attendingProviderId ? Number(attendingProviderId) : null);
            encReq.input('AttendingProviderName', sql.NVarChar, attendingProviderName.trim());
            encReq.input('EncounterType', sql.NVarChar, encounterType || 'Consultation');
            encReq.input('ChiefComplaint', sql.NVarChar, chiefComplaint.trim());
            encReq.input('HistoryOfPresentIllness', sql.NVarChar, historyOfPresentIllness ? historyOfPresentIllness.trim() : null);
            encReq.input('ClinicalNotes', sql.NVarChar, clinicalNotes ? clinicalNotes.trim() : null);
            encReq.input('Assessment', sql.NVarChar, assessment.trim());
            encReq.input('Diagnosis', sql.NVarChar, diagnosis.trim());
            encReq.input('ICD10Code', sql.NVarChar, icd10Code ? icd10Code.trim() : null);
            encReq.input('TreatmentPlan', sql.NVarChar, treatmentPlan ? treatmentPlan.trim() : null);
            encReq.input('Status', sql.NVarChar, encounterStatus);
            encReq.input('FinalizedBy', sql.Int, encounterStatus === 'Finalized' ? userId : null);
            encReq.input('CreatedBy', sql.Int, userId);

            const encRes = await encReq.query(`
                INSERT INTO Clinical_Encounters (
                    EncounterNumber, PatientID, AttendingProviderID, AttendingProviderName,
                    EncounterDate, EncounterType, ChiefComplaint, HistoryOfPresentIllness,
                    ClinicalNotes, Assessment, Diagnosis, ICD10Code, TreatmentPlan,
                    Status, FinalizedDate, FinalizedBy, CreatedBy, CreatedDate
                )
                OUTPUT INSERTED.EncounterID
                VALUES (
                    @EncounterNumber, @PatientID, @AttendingProviderID, @AttendingProviderName,
                    GETDATE(), @EncounterType, @ChiefComplaint, @HistoryOfPresentIllness,
                    @ClinicalNotes, @Assessment, @Diagnosis, @ICD10Code, @TreatmentPlan,
                    @Status, CASE WHEN @Status = 'Finalized' THEN GETDATE() ELSE NULL END,
                    @FinalizedBy, @CreatedBy, GETDATE()
                )
            `);

            const encounterId = encRes.recordset[0].EncounterID;

            // 4. Insert Vital Signs if provided
            if (vitalSigns && typeof vitalSigns === 'object') {
                const {
                    bloodPressureSystolic,
                    bloodPressureDiastolic,
                    temperature,
                    pulseRate,
                    respiratoryRate,
                    oxygenSaturation,
                    height,
                    weight
                } = vitalSigns;

                // Calculate BMI if height and weight exist
                let bmi = null;
                let bmiClassification = null;
                if (height && weight && Number(height) > 0 && Number(weight) > 0) {
                    const hMeters = Number(height) / 100;
                    bmi = Number((Number(weight) / (hMeters * hMeters)).toFixed(2));
                    if (bmi < 18.5) bmiClassification = 'Underweight';
                    else if (bmi < 25.0) bmiClassification = 'Normal weight';
                    else if (bmi < 30.0) bmiClassification = 'Overweight';
                    else bmiClassification = 'Obese';
                }

                const vitReq = new sql.Request(transaction);
                vitReq.input('EncounterID', sql.BigInt, encounterId);
                vitReq.input('PatientID', sql.Int, Number(patientId));
                vitReq.input('BPSystolic', sql.Int, bloodPressureSystolic ? Number(bloodPressureSystolic) : null);
                vitReq.input('BPDiastolic', sql.Int, bloodPressureDiastolic ? Number(bloodPressureDiastolic) : null);
                vitReq.input('Temp', sql.Decimal(4, 1), temperature ? Number(temperature) : null);
                vitReq.input('Pulse', sql.Int, pulseRate ? Number(pulseRate) : null);
                vitReq.input('Resp', sql.Int, respiratoryRate ? Number(respiratoryRate) : null);
                vitReq.input('SpO2', sql.Decimal(4, 1), oxygenSaturation ? Number(oxygenSaturation) : null);
                vitReq.input('Height', sql.Decimal(5, 2), height ? Number(height) : null);
                vitReq.input('Weight', sql.Decimal(5, 2), weight ? Number(weight) : null);
                vitReq.input('BMI', sql.Decimal(5, 2), bmi);
                vitReq.input('BMIClass', sql.NVarChar, bmiClassification);
                vitReq.input('RecordedBy', sql.Int, userId);

                await vitReq.query(`
                    INSERT INTO Clinical_VitalSigns (
                        EncounterID, PatientID, BloodPressureSystolic, BloodPressureDiastolic,
                        Temperature, PulseRate, RespiratoryRate, OxygenSaturation,
                        Height, Weight, BMI, BMIClassification, RecordedBy, RecordedDate
                    )
                    VALUES (
                        @EncounterID, @PatientID, @BPSystolic, @BPDiastolic,
                        @Temp, @Pulse, @Resp, @SpO2,
                        @Height, @Weight, @BMI, @BMIClass, @RecordedBy, GETDATE()
                    )
                `);
            }

            // 5. Optional Prescriptions creation in same transaction
            let prescriptionResult = null;
            if (data.prescriptionItems && Array.isArray(data.prescriptionItems) && data.prescriptionItems.length > 0) {
                const PrescriptionService = require('./prescriptionService.cjs');
                prescriptionResult = await PrescriptionService.createPrescription(transaction, {
                    encounterId,
                    patientId,
                    prescribingProviderId: attendingProviderId,
                    prescribingProviderName: attendingProviderName,
                    clinicalDiagnosis: diagnosis,
                    notes: treatmentPlan,
                    items: data.prescriptionItems
                }, userId);
            }

            await transaction.commit();

            return {
                success: true,
                encounterId,
                prescription: prescriptionResult,
                encounterNumber,
                patientId: Number(patientId),
                patientName: patient.FullName,
                status: encounterStatus,
                message: `Clinical Encounter ${encounterNumber} for ${patient.FullName} successfully created.`
            };
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    }

    /**
     * Get Clinical Encounter details with patient, vital signs, and amendments
     */
    static async getEncounterById(pool, encounterId) {
        const encReq = pool.request();
        encReq.input('EncounterID', sql.BigInt, encounterId);
        const encRes = await encReq.query(`
            SELECT 
                e.*,
                p.FullName AS PatientName,
                p.FirstName AS PatientFirstName,
                p.Surname AS PatientSurname,
                p.BirthDate AS PatientBirthDate,
                p.Gender AS PatientGender,
                p.Barangay AS PatientBarangay,
                p.ContactNumber AS PatientContact,
                p.PhilHealthNumber AS PatientPhilHealth,
                p.BloodType AS PatientBloodType,
                DATEDIFF(year, p.BirthDate, GETDATE()) - 
                CASE 
                    WHEN DATEADD(year, DATEDIFF(year, p.BirthDate, GETDATE()), p.BirthDate) > GETDATE() THEN 1 
                    ELSE 0 
                END AS PatientAge,
                u.FullName AS CreatedByName,
                fu.FullName AS FinalizedByName
            FROM Clinical_Encounters e
            INNER JOIN Patients p ON e.PatientID = p.PatientID
            LEFT JOIN Users u ON e.CreatedBy = u.UserID
            LEFT JOIN Users fu ON e.FinalizedBy = fu.UserID
            WHERE e.EncounterID = @EncounterID
        `);

        if (!encRes.recordset.length) {
            throw new Error(`Clinical encounter ID ${encounterId} not found.`);
        }

        const encounter = encRes.recordset[0];

        // Fetch Vital Signs
        const vitReq = pool.request();
        vitReq.input('EncounterID', sql.BigInt, encounterId);
        const vitRes = await vitReq.query('SELECT TOP 1 * FROM Clinical_VitalSigns WHERE EncounterID = @EncounterID');
        encounter.vitalSigns = vitRes.recordset[0] || null;

        // Fetch Prescriptions
        try {
            const PrescriptionService = require('./prescriptionService.cjs');
            encounter.prescriptions = await PrescriptionService.getPrescriptionsByEncounter(pool, encounterId);
        } catch (rxErr) {
            console.warn('Notice: Failed to load encounter prescriptions:', rxErr.message);
            encounter.prescriptions = [];
        }

        // Fetch Amendments
        const amendReq = pool.request();
        amendReq.input('EncounterID', sql.BigInt, encounterId);
        const amendRes = await amendReq.query(`
            SELECT a.*, u.FullName AS AmendedByName
            FROM Clinical_EncounterAmendments a
            LEFT JOIN Users u ON a.AmendedBy = u.UserID
            WHERE a.EncounterID = @EncounterID
            ORDER BY a.AmendedDate DESC
        `);
        encounter.amendments = amendRes.recordset;

        return encounter;
    }

    /**
     * Update an in-progress clinical encounter
     */
    static async updateEncounter(pool, encounterId, data, userId = 1) {
        const {
            attendingProviderName,
            attendingProviderId,
            encounterType,
            chiefComplaint,
            historyOfPresentIllness,
            clinicalNotes,
            assessment,
            diagnosis,
            icd10Code,
            treatmentPlan,
            vitalSigns
        } = data;

        const checkReq = pool.request();
        checkReq.input('EncounterID', sql.BigInt, encounterId);
        const checkRes = await checkReq.query('SELECT Status, EncounterNumber FROM Clinical_Encounters WHERE EncounterID = @EncounterID');

        if (!checkRes.recordset.length) {
            throw new Error(`Encounter ID ${encounterId} does not exist.`);
        }

        const currentStatus = checkRes.recordset[0].Status;
        if (currentStatus === 'Finalized' || currentStatus === 'Amended') {
            throw new Error(`Encounter ${checkRes.recordset[0].EncounterNumber} is finalized. Direct edits are prohibited. Use the authorized clinical amendment workflow.`);
        }

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const updateReq = new sql.Request(transaction);
            updateReq.input('EncounterID', sql.BigInt, encounterId);
            updateReq.input('AttendingProviderID', sql.Int, attendingProviderId ? Number(attendingProviderId) : null);
            updateReq.input('AttendingProviderName', sql.NVarChar, attendingProviderName ? attendingProviderName.trim() : null);
            updateReq.input('EncounterType', sql.NVarChar, encounterType || 'Consultation');
            updateReq.input('ChiefComplaint', sql.NVarChar, chiefComplaint ? chiefComplaint.trim() : null);
            updateReq.input('HistoryOfPresentIllness', sql.NVarChar, historyOfPresentIllness ? historyOfPresentIllness.trim() : null);
            updateReq.input('ClinicalNotes', sql.NVarChar, clinicalNotes ? clinicalNotes.trim() : null);
            updateReq.input('Assessment', sql.NVarChar, assessment ? assessment.trim() : null);
            updateReq.input('Diagnosis', sql.NVarChar, diagnosis ? diagnosis.trim() : null);
            updateReq.input('ICD10Code', sql.NVarChar, icd10Code ? icd10Code.trim() : null);
            updateReq.input('TreatmentPlan', sql.NVarChar, treatmentPlan ? treatmentPlan.trim() : null);
            updateReq.input('ModifiedBy', sql.Int, userId);

            await updateReq.query(`
                UPDATE Clinical_Encounters
                SET AttendingProviderID = COALESCE(@AttendingProviderID, AttendingProviderID),
                    AttendingProviderName = COALESCE(@AttendingProviderName, AttendingProviderName),
                    EncounterType = COALESCE(@EncounterType, EncounterType),
                    ChiefComplaint = COALESCE(@ChiefComplaint, ChiefComplaint),
                    HistoryOfPresentIllness = @HistoryOfPresentIllness,
                    ClinicalNotes = @ClinicalNotes,
                    Assessment = COALESCE(@Assessment, Assessment),
                    Diagnosis = COALESCE(@Diagnosis, Diagnosis),
                    ICD10Code = @ICD10Code,
                    TreatmentPlan = @TreatmentPlan,
                    ModifiedDate = GETDATE(),
                    ModifiedBy = @ModifiedBy
                WHERE EncounterID = @EncounterID
            `);

            // Update or Insert Vital Signs
            if (vitalSigns && typeof vitalSigns === 'object') {
                const {
                    bloodPressureSystolic,
                    bloodPressureDiastolic,
                    temperature,
                    pulseRate,
                    respiratoryRate,
                    oxygenSaturation,
                    height,
                    weight
                } = vitalSigns;

                let bmi = null;
                let bmiClassification = null;
                if (height && weight && Number(height) > 0 && Number(weight) > 0) {
                    const hMeters = Number(height) / 100;
                    bmi = Number((Number(weight) / (hMeters * hMeters)).toFixed(2));
                    if (bmi < 18.5) bmiClassification = 'Underweight';
                    else if (bmi < 25.0) bmiClassification = 'Normal weight';
                    else if (bmi < 30.0) bmiClassification = 'Overweight';
                    else bmiClassification = 'Obese';
                }

                const vitReq = new sql.Request(transaction);
                vitReq.input('EncounterID', sql.BigInt, encounterId);
                vitReq.input('BPSystolic', sql.Int, bloodPressureSystolic ? Number(bloodPressureSystolic) : null);
                vitReq.input('BPDiastolic', sql.Int, bloodPressureDiastolic ? Number(bloodPressureDiastolic) : null);
                vitReq.input('Temp', sql.Decimal(4, 1), temperature ? Number(temperature) : null);
                vitReq.input('Pulse', sql.Int, pulseRate ? Number(pulseRate) : null);
                vitReq.input('Resp', sql.Int, respiratoryRate ? Number(respiratoryRate) : null);
                vitReq.input('SpO2', sql.Decimal(4, 1), oxygenSaturation ? Number(oxygenSaturation) : null);
                vitReq.input('Height', sql.Decimal(5, 2), height ? Number(height) : null);
                vitReq.input('Weight', sql.Decimal(5, 2), weight ? Number(weight) : null);
                vitReq.input('BMI', sql.Decimal(5, 2), bmi);
                vitReq.input('BMIClass', sql.NVarChar, bmiClassification);
                vitReq.input('RecordedBy', sql.Int, userId);

                const existingVit = await vitReq.query('SELECT VitalSignsID FROM Clinical_VitalSigns WHERE EncounterID = @EncounterID');
                if (existingVit.recordset.length > 0) {
                    await vitReq.query(`
                        UPDATE Clinical_VitalSigns
                        SET BloodPressureSystolic = @BPSystolic,
                            BloodPressureDiastolic = @BPDiastolic,
                            Temperature = @Temp,
                            PulseRate = @Pulse,
                            RespiratoryRate = @Resp,
                            OxygenSaturation = @SpO2,
                            Height = @Height,
                            Weight = @Weight,
                            BMI = @BMI,
                            BMIClassification = @BMIClass,
                            RecordedBy = @RecordedBy,
                            RecordedDate = GETDATE()
                        WHERE EncounterID = @EncounterID
                    `);
                } else {
                    const patIdRes = await vitReq.query('SELECT PatientID FROM Clinical_Encounters WHERE EncounterID = @EncounterID');
                    vitReq.input('PatientID', sql.Int, patIdRes.recordset[0].PatientID);
                    await vitReq.query(`
                        INSERT INTO Clinical_VitalSigns (
                            EncounterID, PatientID, BloodPressureSystolic, BloodPressureDiastolic,
                            Temperature, PulseRate, RespiratoryRate, OxygenSaturation,
                            Height, Weight, BMI, BMIClassification, RecordedBy, RecordedDate
                        )
                        VALUES (
                            @EncounterID, @PatientID, @BPSystolic, @BPDiastolic,
                            @Temp, @Pulse, @Resp, @SpO2,
                            @Height, @Weight, @BMI, @BMIClass, @RecordedBy, GETDATE()
                        )
                    `);
                }
            }

            await transaction.commit();
            return { success: true, message: 'Encounter updated successfully.' };
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    }

    /**
     * Finalize an in-progress clinical encounter
     */
    static async finalizeEncounter(pool, encounterId, userId = 1) {
        const req = pool.request();
        req.input('EncounterID', sql.BigInt, encounterId);
        req.input('FinalizedBy', sql.Int, userId);

        const res = await req.query(`
            UPDATE Clinical_Encounters
            SET Status = 'Finalized',
                FinalizedDate = GETDATE(),
                FinalizedBy = @FinalizedBy,
                ModifiedDate = GETDATE(),
                ModifiedBy = @FinalizedBy
            WHERE EncounterID = @EncounterID AND Status = 'In Progress'
        `);

        if (res.rowsAffected[0] === 0) {
            throw new Error(`Encounter ${encounterId} could not be finalized. It may already be finalized or does not exist.`);
        }

        return { success: true, message: 'Clinical encounter finalized successfully.' };
    }

    /**
     * Amend a finalized encounter with mandatory audit justification
     */
    static async amendEncounter(pool, encounterId, data, userId = 1) {
        const {
            amendmentReason,
            clinicalNotes,
            assessment,
            diagnosis,
            treatmentPlan
        } = data;

        if (!amendmentReason || !amendmentReason.trim()) {
            throw new Error('A documented reason is required to amend a finalized clinical record.');
        }

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // 1. Fetch current encounter with UPDLOCK
            const fetchReq = new sql.Request(transaction);
            fetchReq.input('EncounterID', sql.BigInt, encounterId);
            const fetchRes = await fetchReq.query('SELECT * FROM Clinical_Encounters WITH (UPDLOCK, ROWLOCK) WHERE EncounterID = @EncounterID');

            if (!fetchRes.recordset.length) {
                throw new Error(`Encounter ID ${encounterId} does not exist.`);
            }

            const current = fetchRes.recordset[0];
            if (current.Status !== 'Finalized' && current.Status !== 'Amended') {
                throw new Error(`Only Finalized or previously Amended encounters can be amended. Current status: ${current.Status}`);
            }

            // 2. Insert into Clinical_EncounterAmendments
            const amendReq = new sql.Request(transaction);
            amendReq.input('EncounterID', sql.BigInt, encounterId);
            amendReq.input('AmendmentReason', sql.NVarChar, amendmentReason.trim());
            amendReq.input('PrevNotes', sql.NVarChar, current.ClinicalNotes || null);
            amendReq.input('PrevAssess', sql.NVarChar, current.Assessment);
            amendReq.input('PrevDiag', sql.NVarChar, current.Diagnosis);
            amendReq.input('PrevPlan', sql.NVarChar, current.TreatmentPlan || null);
            amendReq.input('AmendedBy', sql.Int, userId);

            await amendReq.query(`
                INSERT INTO Clinical_EncounterAmendments (
                    EncounterID, AmendmentReason, PreviousClinicalNotes, PreviousAssessment,
                    PreviousDiagnosis, PreviousTreatmentPlan, AmendedBy, AmendedDate
                )
                VALUES (
                    @EncounterID, @AmendmentReason, @PrevNotes, @PrevAssess,
                    @PrevDiag, @PrevPlan, @AmendedBy, GETDATE()
                )
            `);

            // 3. Update Clinical_Encounters with new values & set Status = 'Amended'
            const updateReq = new sql.Request(transaction);
            updateReq.input('EncounterID', sql.BigInt, encounterId);
            updateReq.input('Notes', sql.NVarChar, clinicalNotes !== undefined ? (clinicalNotes ? clinicalNotes.trim() : null) : current.ClinicalNotes);
            updateReq.input('Assess', sql.NVarChar, assessment ? assessment.trim() : current.Assessment);
            updateReq.input('Diag', sql.NVarChar, diagnosis ? diagnosis.trim() : current.Diagnosis);
            updateReq.input('Plan', sql.NVarChar, treatmentPlan !== undefined ? (treatmentPlan ? treatmentPlan.trim() : null) : current.TreatmentPlan);
            updateReq.input('ModifiedBy', sql.Int, userId);

            await updateReq.query(`
                UPDATE Clinical_Encounters
                SET ClinicalNotes = @Notes,
                    Assessment = @Assess,
                    Diagnosis = @Diag,
                    TreatmentPlan = @Plan,
                    Status = 'Amended',
                    ModifiedDate = GETDATE(),
                    ModifiedBy = @ModifiedBy
                WHERE EncounterID = @EncounterID
            `);

            await transaction.commit();

            return {
                success: true,
                encounterId,
                encounterNumber: current.EncounterNumber,
                message: `Encounter ${current.EncounterNumber} successfully amended and audit record logged.`
            };
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    }

    /**
     * Get unified medical history for a patient: Clinical Encounters + Pharmacy Dispensing Records
     */
    static async getPatientMedicalHistory(pool, patientId) {
        // 1. Patient verification
        const patReq = pool.request();
        patReq.input('PatientID', sql.Int, Number(patientId));
        const patRes = await patReq.query('SELECT PatientID, FullName, BirthDate, Barangay FROM Patients WHERE PatientID = @PatientID');
        if (!patRes.recordset.length) {
            throw new Error(`Patient ID ${patientId} not found.`);
        }
        const patient = patRes.recordset[0];

        // 2. Clinical Encounters
        const encReq = pool.request();
        encReq.input('PatientID', sql.Int, Number(patientId));
        const encRes = await encReq.query(`
            SELECT 
                e.EncounterID,
                e.EncounterNumber,
                e.EncounterDate,
                e.EncounterType,
                e.ChiefComplaint,
                e.Diagnosis,
                e.Assessment,
                e.TreatmentPlan,
                e.Status,
                e.AttendingProviderName,
                v.BloodPressureSystolic,
                v.BloodPressureDiastolic,
                v.Temperature,
                v.PulseRate,
                v.RespiratoryRate,
                v.OxygenSaturation,
                v.Height,
                v.Weight,
                v.BMI,
                v.BMIClassification
            FROM Clinical_Encounters e
            LEFT JOIN Clinical_VitalSigns v ON e.EncounterID = v.EncounterID
            WHERE e.PatientID = @PatientID
            ORDER BY e.EncounterDate DESC, e.EncounterID DESC
        `);

        // 3. Pharmacy Dispensing Records
        const rxReq = pool.request();
        rxReq.input('PatientID', sql.Int, Number(patientId));
        const rxRes = await rxReq.query(`
            SELECT 
                s.SaleID,
                s.DispenseNumber,
                s.SaleDate,
                s.Status AS DispenseStatus,
                s.PrescriptionNumber,
                s.PhysicianName,
                u.FullName AS PharmacistName,
                d.DetailID,
                d.Quantity,
                d.LotNumber,
                d.DosageInstructions,
                m.ProductName,
                m.GenericName,
                m.Dosage,
                m.Form
            FROM Pharmacy_Sales s
            INNER JOIN Pharmacy_Sales_Details d ON s.SaleID = d.SaleID
            INNER JOIN Warehouse_Medicines m ON d.MedicineID = m.MedicineID
            LEFT JOIN Users u ON s.SoldBy = u.UserID
            WHERE s.PatientID = @PatientID
            ORDER BY s.SaleDate DESC, s.SaleID DESC
        `);

        // Group dispensing records by sale
        const dispensingMap = {};
        for (const r of rxRes.recordset) {
            if (!dispensingMap[r.SaleID]) {
                dispensingMap[r.SaleID] = {
                    saleId: r.SaleID,
                    dispenseNumber: r.DispenseNumber,
                    saleDate: r.SaleDate,
                    dispenseStatus: r.DispenseStatus,
                    prescriptionNumber: r.PrescriptionNumber,
                    physicianName: r.PhysicianName,
                    pharmacistName: r.PharmacistName,
                    items: []
                };
            }
            dispensingMap[r.SaleID].items.push({
                detailId: r.DetailID,
                productName: r.ProductName,
                genericName: r.GenericName,
                dosage: r.Dosage,
                form: r.Form,
                quantity: r.Quantity,
                lotNumber: r.LotNumber,
                dosageInstructions: r.DosageInstructions
            });
        }

        // 4. Prescriptions and Fulfillment Status
        const rxListReq = pool.request();
        rxListReq.input('PatientID', sql.Int, Number(patientId));
        const rxListRes = await rxListReq.query(`
            SELECT 
                p.PrescriptionID,
                p.PrescriptionNumber,
                p.EncounterID,
                e.EncounterNumber,
                p.PrescribingProviderName,
                p.PrescriptionDate,
                p.ClinicalDiagnosis,
                p.Notes,
                p.Status,
                p.CreatedDate
            FROM Clinical_Prescriptions p
            JOIN Clinical_Encounters e ON p.EncounterID = e.EncounterID
            WHERE p.PatientID = @PatientID
            ORDER BY p.PrescriptionDate DESC
        `);

        const patientPrescriptions = rxListRes.recordset;
        for (const pr of patientPrescriptions) {
            const itemReq = pool.request();
            itemReq.input('PrescriptionID', sql.BigInt, pr.PrescriptionID);
            const itemRes = await itemReq.query(`
                SELECT 
                    PrescriptionItemID, MedicineID, MedicineName, GenericName,
                    QuantityPrescribed, QuantityDispensed, (QuantityPrescribed - QuantityDispensed) AS RemainingQuantity,
                    Dosage, Frequency, Duration, DosageInstructions, ItemStatus
                FROM Clinical_PrescriptionItems
                WHERE PrescriptionID = @PrescriptionID
            `);
            pr.items = itemRes.recordset;
        }

        return {
            patient,
            encounters: encRes.recordset,
            dispensingRecords: Object.values(dispensingMap),
            prescriptions: patientPrescriptions
        };
    }

    /**
     * Search and filter all clinical encounters across the clinic
     */
    static async getEncountersList(pool, filters = {}) {
        const { search, status, encounterType, startDate, endDate } = filters;
        let query = `
            SELECT 
                e.EncounterID,
                e.EncounterNumber,
                e.EncounterDate,
                e.EncounterType,
                e.ChiefComplaint,
                e.Diagnosis,
                e.Assessment,
                e.Status,
                e.AttendingProviderName,
                p.PatientID,
                p.FullName AS PatientName,
                p.Barangay,
                p.ContactNumber,
                v.BloodPressureSystolic,
                v.BloodPressureDiastolic,
                v.Temperature,
                v.PulseRate
            FROM Clinical_Encounters e
            INNER JOIN Patients p ON e.PatientID = p.PatientID
            LEFT JOIN Clinical_VitalSigns v ON e.EncounterID = v.EncounterID
            WHERE 1=1
        `;

        const req = pool.request();

        if (search) {
            query += ` AND (
                e.EncounterNumber LIKE @Search OR 
                p.FullName LIKE @Search OR 
                e.ChiefComplaint LIKE @Search OR 
                e.Diagnosis LIKE @Search OR 
                e.AttendingProviderName LIKE @Search
            )`;
            req.input('Search', sql.NVarChar, '%' + search + '%');
        }

        if (status && status !== 'all') {
            query += ' AND e.Status = @Status';
            req.input('Status', sql.NVarChar, status);
        }

        if (encounterType && encounterType !== 'all') {
            query += ' AND e.EncounterType = @EncounterType';
            req.input('EncounterType', sql.NVarChar, encounterType);
        }

        if (startDate) {
            query += ' AND CAST(e.EncounterDate AS DATE) >= @StartDate';
            req.input('StartDate', sql.Date, startDate);
        }

        if (endDate) {
            query += ' AND CAST(e.EncounterDate AS DATE) <= @EndDate';
            req.input('EndDate', sql.Date, endDate);
        }

        query += ' ORDER BY e.EncounterDate DESC, e.EncounterID DESC';

        const res = await req.query(query);
        return res.recordset;
    }
}

module.exports = ClinicalService;
