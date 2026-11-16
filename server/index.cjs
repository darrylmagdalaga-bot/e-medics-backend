const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const ReconciliationService = require('./services/reconciliationService.cjs');
const PhysicalCountService = require('./services/physicalCountService.cjs');
const PharmacyService = require('./services/pharmacy/pharmacyService.cjs');
const ClinicalService = require('./services/clinicalService.cjs');
const PrescriptionService = require('./services/prescriptionService.cjs');
const BarangayService = require('./services/barangayService.cjs');
const AccountService = require('./services/accountService.cjs');
const ReportService = require('./services/reportService.cjs');
const StockRequestService = require('./services/stockRequestService.cjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Bypass-Tunnel-Reminder, Authorization, x-user-id, X-User-Id');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Bypass-Tunnel-Reminder', 'Authorization', 'x-user-id', 'X-User-Id'] }));
app.use(express.json());

sql.on("error", err => { console.warn("SQL Pool Notice/Error:", err.message); });
process.on("uncaughtException", err => { console.error("Global Uncaught Exception:", err.message); });
process.on("unhandledRejection", reason => { console.error("Global Unhandled Rejection:", reason); });

const config = { 
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    port: 1433,
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};


async function checkConnection() {
    try {
        await sql.connect(config);
        console.log("âœ… Connected to Database successfully");
        return { success: true, message: "Connected to Database" };
    } catch (err) {
        console.error("âŒ Database Connection Error:", err.message);
        return { success: false, message: err.message };
    }
}

app.get('/api/check-db', async (req, res) => {
    const status = await checkConnection();
    if (status.success) {
        res.json(status);
    } else {
        res.status(500).json(status);
    }
});

app.get('/', (req, res) => {
    res.send('ðŸš€ API is running successfully!');
});

app.get('/healthz', (req, res) => {
    res.status(200).json({ ok: true, service: 'emedics-api' });
});

// --- USER MANAGEMENT ---

app.get('/api/users', async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query('SELECT UserID, Username, FullName, Role, IsActive FROM Users');
        res.json(result.recordset);
    } catch (err) {
        console.error('âŒ ERROR:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

app.post('/api/users', async (req, res) => {
    const { username, password, fullName, role, isActive } = req.body;
    try {
        await sql.connect(config);
        const request = new sql.Request();
        request.input('username', sql.NVarChar, username);
        request.input('password', sql.NVarChar, password);
        request.input('fullName', sql.NVarChar, fullName);
        request.input('role', sql.NVarChar, role);
        request.input('isActive', sql.Bit, isActive ? 1 : 0);
        await request.query('INSERT INTO Users (Username, Password, FullName, Role, IsActive) VALUES (@username, @password, @fullName, @role, @isActive)');
        res.json({ success: true, message: 'User successfully created' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { username, fullName, password } = req.body;
    try {
        if (!password) return res.status(400).json({ success: false, message: 'Password is required' });
        await sql.connect(config);
        const request = new sql.Request();
        request.input('id', sql.Int, id);
        request.input('username', sql.NVarChar, username);
        const checkResult = await request.query('SELECT UserID FROM Users WHERE Username = @username AND UserID != @id');
        if (checkResult.recordset.length > 0) return res.status(400).json({ success: false, message: 'Username is already taken' });

        request.input('fullName', sql.NVarChar, fullName);
        request.input('password', sql.NVarChar, password);
        await request.query('UPDATE Users SET Username = @username, FullName = @fullName, Password = @password WHERE UserID = @id');
        res.json({ success: true, message: 'User updated successfully' });
    } catch (err) {
        console.error('âŒ ERROR:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

app.patch('/api/users/:id/role', async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    try {
        await sql.connect(config);
        const request = new sql.Request();
        request.input('id', sql.Int, id);
        request.input('role', sql.NVarChar, role);
        await request.query('UPDATE Users SET Role = @role WHERE UserID = @id');
        res.json({ success: true, message: 'User role updated successfully' });
    } catch (err) {
        console.error('âŒ ERROR:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        await sql.connect(config);
        const request = new sql.Request();
        request.input('username', sql.NVarChar, username);
        request.input('password', sql.NVarChar, password);
        const result = await request.query('SELECT UserID, Role, IsActive, Barangay, LocationID, FullName, Username, MustChangePassword FROM Users WHERE Username = @username AND Password = @password');
        if (result.recordset.length > 0) {
            const user = result.recordset[0];
            if (user.IsActive) {
                let internalRole = user.Role.toLowerCase().trim();
                if (internalRole === 'admin') internalRole = 'admin';
                else if (internalRole === 'warehouse staff' || internalRole === 'warehouse') internalRole = 'warehouse';
                else if (internalRole === 'pharmacy staff' || internalRole === 'pharmacy') internalRole = 'pharmacy';
                else if (internalRole === 'inventory staff' || internalRole === 'inventory') internalRole = 'inventory';
                else if (internalRole === 'clinical staff' || internalRole === 'clinical' || internalRole === 'doctor' || internalRole === 'nurse') internalRole = 'clinical';
                else if (internalRole.includes('barangay') || internalRole === 'bhw') internalRole = 'barangay';
                res.json({ 
                    success: true, 
                    userId: user.UserID, 
                    role: internalRole,
                    rawRole: user.Role,
                    barangay: user.Barangay || null,
                    locationId: user.LocationID || null,
                    fullName: user.FullName,
                    username: user.Username,
                    mustChangePassword: Boolean(user.MustChangePassword)
                });
            } else {
                res.status(401).json({ success: false, message: 'Account is inactive' });
            }
        } else {
            res.status(401).json({ success: false, message: 'Invalid username or password' });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: 'Database error' });
    }
});


// Phase 13: Role & Session Authorization Verification
async function verifyAdminAuth(req, pool) {
    const userId = getAuthUserId(req);
    if (!userId) {
        const err = new Error('Unauthorized: Authentication required.');
        err.statusCode = 401;
        throw err;
    }
    const userReq = pool.request();
    userReq.input('id', sql.Int, userId);
    const userRes = await userReq.query('SELECT UserID, Role, IsActive FROM Users WHERE UserID = @id');
    if (userRes.recordset.length === 0 || !userRes.recordset[0].IsActive) {
        const err = new Error('Unauthorized: Account is inactive or does not exist.');
        err.statusCode = 401;
        throw err;
    }
    const role = (userRes.recordset[0].Role || '').toLowerCase().trim();
    if (role !== 'admin') {
        const err = new Error('Access Denied: Administrative privileges required.');
        err.statusCode = 403;
        throw err;
    }
    return userRes.recordset[0];
}

async function verifyElevatedAuth(req, pool) {
    const userId = getAuthUserId(req);
    if (!userId) {
        const err = new Error('Unauthorized: Authentication required.');
        err.statusCode = 401;
        throw err;
    }
    const userReq = pool.request();
    userReq.input('id', sql.Int, userId);
    const userRes = await userReq.query('SELECT UserID, Role, IsActive FROM Users WHERE UserID = @id');
    if (userRes.recordset.length === 0 || !userRes.recordset[0].IsActive) {
        const err = new Error('Unauthorized: Account is inactive or does not exist.');
        err.statusCode = 401;
        throw err;
    }
    const role = (userRes.recordset[0].Role || '').toLowerCase().trim();
    if (role !== 'admin' && !role.includes('warehouse')) {
        const err = new Error('Access Denied: Elevated privileges required to access city-wide audit reports.');
        err.statusCode = 403;
        throw err;
    }
    return userRes.recordset[0];
}

// Phase 14 (Workstream 14.4): Role-Based Access Control Middleware for Warehouse & Pharmacy APIs
app.use('/api/warehouse', async (req, res, next) => {
    try {
        const headerUserId = req.headers['x-user-id'];
        if (!headerUserId) return next(); // Preserve legacy unheadered compatibility while enforcing strict RBAC on authenticated requests
        const userId = parseInt(headerUserId, 10);
        if (isNaN(userId)) return res.status(401).json({ error: 'Unauthorized: Invalid User ID header.' });

        const pool = await sql.connect(config);
        const userReq = pool.request();
        userReq.input('id', sql.Int, userId);
        const userRes = await userReq.query('SELECT UserID, Role, IsActive FROM Users WHERE UserID = @id');
        if (userRes.recordset.length === 0 || !userRes.recordset[0].IsActive) {
            return res.status(401).json({ error: 'Unauthorized: Account is inactive or does not exist.' });
        }
        const rawRole = (userRes.recordset[0].Role || '').toLowerCase().trim();
        const isWarehouseOrAdmin = rawRole === 'admin' || rawRole.includes('warehouse') || rawRole.includes('management');

        // Allow authenticated Pharmacy/BHW to read master medicine catalog & locations for restock request forms
        const isCatalogRead = req.method === 'GET' && (req.path.startsWith('/medicines') || req.path.startsWith('/locations'));
        if (!isWarehouseOrAdmin && !isCatalogRead) {
            return res.status(403).json({
                error: 'Access Denied: Only Central Warehouse or System Administrator personnel may access Warehouse operational or approval endpoints.'
            });
        }
        next();
    } catch (err) {
        console.error('Warehouse RBAC middleware error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.use('/api/pharmacy', async (req, res, next) => {
    try {
        const headerUserId = req.headers['x-user-id'];
        if (!headerUserId) return next();
        const userId = parseInt(headerUserId, 10);
        if (isNaN(userId)) return res.status(401).json({ error: 'Unauthorized: Invalid User ID header.' });

        const pool = await sql.connect(config);
        const userReq = pool.request();
        userReq.input('id', sql.Int, userId);
        const userRes = await userReq.query('SELECT UserID, Role, IsActive FROM Users WHERE UserID = @id');
        if (userRes.recordset.length === 0 || !userRes.recordset[0].IsActive) {
            return res.status(401).json({ error: 'Unauthorized: Account is inactive or does not exist.' });
        }
        const rawRole = (userRes.recordset[0].Role || '').toLowerCase().trim();
        const isBarangayRole = rawRole.includes('bhw') || rawRole.includes('barangay') || rawRole.includes('health worker');
        if (isBarangayRole) {
            return res.status(403).json({
                error: 'Access Denied: Barangay Health Worker accounts cannot access City Pharmacy operations.'
            });
        }
        const isPharmacyOrAdmin = rawRole === 'admin' || rawRole.includes('pharmac') || rawRole === 'staff';
        if (!isPharmacyOrAdmin && req.method !== 'GET') {
            return res.status(403).json({
                error: 'Access Denied: Only City Pharmacy or System Administrator personnel may perform Pharmacy dispensing, receiving, or reversal operations.'
            });
        }
        next();
    } catch (err) {
        console.error('Pharmacy RBAC middleware error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Phase 13: Password Change Endpoint
app.post('/api/auth/change-password', async (req, res) => {
    try {
        const userId = getAuthUserId(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized: User ID required.' });
        const { oldPassword, newPassword } = req.body;
        if (!oldPassword || !newPassword) {
            return res.status(400).json({ error: 'Current password and new password are required.' });
        }
        if (newPassword.trim().length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
        }
        if (newPassword.trim() === 'bhw123' || newPassword.trim() === 'password' || newPassword.trim() === '12345678') {
            return res.status(400).json({ error: 'Default or common passwords are not permitted.' });
        }
        if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
            return res.status(400).json({ error: 'Password must contain both letters and numbers for production security.' });
        }
        const pool = await sql.connect(config);
        const userReq = pool.request();
        userReq.input('id', sql.Int, userId);
        const userRes = await userReq.query('SELECT UserID, Username, Password, Role, Barangay, LocationID, IsActive FROM Users WHERE UserID = @id');
        if (userRes.recordset.length === 0 || !userRes.recordset[0].IsActive) {
            return res.status(401).json({ error: 'User account not found or is inactive.' });
        }
        const currentUser = userRes.recordset[0];
        if (currentUser.Password !== oldPassword.trim()) {
            return res.status(400).json({ error: 'Current password does not match.' });
        }
        if (currentUser.Password === newPassword.trim()) {
            return res.status(400).json({ error: 'New password must be different from current password.' });
        }
        const updateReq = pool.request();
        updateReq.input('id', sql.Int, userId);
        updateReq.input('pw', sql.NVarChar, newPassword.trim());
        await updateReq.query('UPDATE Users SET Password = @pw, MustChangePassword = 0 WHERE UserID = @id');

        const auditReq = pool.request();
        auditReq.input('targetId', sql.Int, userId);
        auditReq.input('locId', sql.Int, currentUser.LocationID);
        auditReq.input('bgy', sql.NVarChar, currentUser.Barangay);
        auditReq.input('status', sql.Bit, currentUser.IsActive ? 1 : 0);
        await auditReq.query(
            "INSERT INTO User_AuditLogs (" +
            "    TargetUserID, Action, PreviousLocationID, NewLocationID," +
            "    PreviousBarangay, NewBarangay, PreviousStatus, NewStatus," +
            "    Reason, PerformedByUserID, PerformedDate" +
            ") VALUES (" +
            "    @targetId, 'PASSWORD_CHANGED_BY_USER', @locId, @locId," +
            "    @bgy, @bgy, @status, @status," +
            "    'User self-service password hardening', @targetId, SYSUTCDATETIME()" +
            ")"
        );

        res.json({ success: true, message: 'Password successfully changed and account secured.' });
    } catch (err) {
        console.error('Change password error:', err);
        res.status(500).json({ error: 'Failed to update password.' });
    }
});

// --- MEDICINE & STOCK REQUESTS ---


// --- PHARMACY & WAREHOUSE UNIFIED STOCK REQUESTS ---

app.post(['/api/pharmacy/stock-requests', '/api/stock-request'], async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const headerUserId = req.headers['x-user-id'] || req.headers['X-User-Id'];
        const userId = Number(headerUserId || req.body.userId || 1);

        // Lookup user location
        const userReq = pool.request();
        userReq.input('uid', sql.Int, userId);
        const userRes = await userReq.query('SELECT LocationID FROM Users WHERE UserID = @uid');
        const userLocationId = userRes.recordset[0]?.LocationID || 2; // Default 2 = City Pharmacy

        const result = await StockRequestService.createStockRequest(pool, { userId, locationId: userLocationId }, req.body);
        res.status(201).json(result);
    } catch (err) {
        console.error('Stock Request creation error:', err);
        res.status(err.statusCode || 400).json({ success: false, error: err.message, message: err.message });
    }
});

app.get('/api/pharmacy/stock-requests', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const status = req.query.status;
        let query = `
            SELECT 
                SR.StockRequestID AS id,
                SR.StockRequestID,
                SR.RequestNumber,
                SR.RequestingLocationID,
                SR.RequestedByUserID,
                COALESCE(WL.LocationName, 'City Health Pharmacy') AS FacilityName,
                COALESCE(WL.LocationName, 'City Health Pharmacy') AS RequestingFacility,
                U.FullName AS RequestedByName,
                U.FullName AS RequesterName,
                SR.CreatedDate AS RequestDate,
                SR.RequiredDate,
                SR.Priority,
                SR.Purpose,
                SR.Remarks,
                SR.Status,
                SR.AdminRemarks,
                SR.ShortageNotes,
                SR.RejectionReason,
                SR.ApprovedDate,
                SR.RejectedDate,
                SR.CreatedDate,
                (SELECT COUNT(*) FROM Warehouse_StockRequestItems SRI WHERE SRI.StockRequestID = SR.StockRequestID AND SRI.IsDeleted = 0) AS ItemCount,
                (SELECT ISNULL(SUM(QuantityRequested), 0) FROM Warehouse_StockRequestItems SRI WHERE SRI.StockRequestID = SR.StockRequestID AND SRI.IsDeleted = 0) AS TotalQuantityRequested,
                (SELECT ISNULL(SUM(QuantityApproved), 0) FROM Warehouse_StockRequestItems SRI WHERE SRI.StockRequestID = SR.StockRequestID AND SRI.IsDeleted = 0) AS TotalQuantityApproved,
                (SELECT ISNULL(SUM(QuantityReleased), 0) FROM Warehouse_StockRequestItems SRI WHERE SRI.StockRequestID = SR.StockRequestID AND SRI.IsDeleted = 0) AS TotalQuantityReleased,
                (SELECT ISNULL(SUM(QuantityUnfulfilled), 0) FROM Warehouse_StockRequestItems SRI WHERE SRI.StockRequestID = SR.StockRequestID AND SRI.IsDeleted = 0) AS TotalQuantityUnfulfilled,
                (SELECT TOP 1 d.DistributionID FROM Warehouse_Distributions d WHERE d.ReferenceStockRequestID = SR.StockRequestID AND d.IsDeleted = 0 ORDER BY d.DistributionID DESC) AS DistributionID,
                (SELECT TOP 1 d.DistributionNumber FROM Warehouse_Distributions d WHERE d.ReferenceStockRequestID = SR.StockRequestID AND d.IsDeleted = 0 ORDER BY d.DistributionID DESC) AS DistributionNumber,
                (SELECT TOP 1 d.Status FROM Warehouse_Distributions d WHERE d.ReferenceStockRequestID = SR.StockRequestID AND d.IsDeleted = 0 ORDER BY d.DistributionID DESC) AS DistributionStatus
            FROM Warehouse_StockRequests SR
            LEFT JOIN Warehouse_Locations WL ON SR.RequestingLocationID = WL.LocationID
            LEFT JOIN Users U ON SR.RequestedByUserID = U.UserID
            WHERE SR.IsDeleted = 0 AND (SR.RequestingLocationID = 2 OR SR.RequestingLocationID IS NULL)
        `;

        const request = pool.request();
        if (status && status !== 'ALL') {
            query += ' AND UPPER(REPLACE(SR.Status, \' \', \'_\')) = @StatusNorm';
            request.input('StatusNorm', sql.NVarChar, String(status).trim().toUpperCase().replace(/\s+/g, '_'));
        }

        query += ' ORDER BY SR.CreatedDate DESC, SR.StockRequestID DESC';
        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/pharmacy/stock-requests/:id', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const details = await StockRequestService.getStockRequestReviewDetails(pool, req.params.id);
        res.json({
            request: details,
            items: details.items || []
        });
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

app.get('/api/medicines', async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query(`
            SELECT m.MedicineID, m.ProductName, m.GenericName, m.BrandName, m.Dosage, m.Form, m.Description,
                   m.UnitID, mu.UnitName, m.CategoryID, mc.CategoryName,
                   ISNULL((SELECT TOP 1 Price FROM Pharmacy_Stocks WHERE MedicineID = m.MedicineID AND Quantity > 0 ORDER BY ExpiryDate ASC), 0) as Price,
                   ISNULL((SELECT SUM(Quantity) FROM Pharmacy_Stocks WHERE MedicineID = m.MedicineID), 0) as TotalStock
            FROM Medicines m
            JOIN Medicine_Unit mu ON m.UnitID = mu.UnitID
            LEFT JOIN Medicine_Category mc ON m.CategoryID = mc.CategoryID
            WHERE m.IsActive = 1
        `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

app.get('/api/medicine-categories', async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query('SELECT CategoryID, CategoryName FROM Medicine_Category ORDER BY CategoryName');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

app.get('/api/medicine-units', async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query('SELECT UnitID, UnitName FROM Medicine_Unit WHERE IsActive = 1');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

app.post('/api/stock-request', async (req, res) => {
    const { userId, remarks, items, priority } = req.body;
    try {
        const pool = await sql.connect(config);
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        try {
            // 1. Insert into legacy Stock_Request table for Pharmacy POS tracking
            const request = new sql.Request(transaction);
            request.input('userId', sql.Int, userId);
            request.input('remarks', sql.NVarChar, remarks || 'Pharmacy Dispensary Restock');
            const srResult = await request.query(`
                INSERT INTO Stock_Request (RequestedBy, Remarks, Status, RequestDate) 
                OUTPUT INSERTED.RequestID 
                VALUES (@userId, @remarks, 'Pending', SYSUTCDATETIME())
            `);
            const requestId = srResult.recordset[0].RequestID;

            // 2. Insert into Warehouse_StockRequests so it immediately appears in Warehouse
            const reqNumber = `SR-${requestId}`;
            const reqPriority = priority || 'Routine';

            const whRequest = new sql.Request(transaction);
            whRequest.input('RequestNumber', sql.NVarChar, reqNumber);
            whRequest.input('RequestingLocationID', sql.Int, 2); // LocationID 2 = Pharmacy / External
            whRequest.input('RequestedByUserID', sql.Int, userId);
            whRequest.input('Priority', sql.NVarChar, reqPriority);
            whRequest.input('Purpose', sql.NVarChar, remarks || 'Pharmacy Dispensary Restock');
            whRequest.input('CreatedBy', sql.Int, userId);

            const whResult = await whRequest.query(`
                INSERT INTO Warehouse_StockRequests (
                    RequestNumber, RequestingLocationID, RequestedByUserID, Priority, Purpose, Status, CreatedBy, CreatedDate, IsDeleted
                )
                OUTPUT INSERTED.StockRequestID
                VALUES (
                    @RequestNumber, @RequestingLocationID, @RequestedByUserID, @Priority, @Purpose, 'Pending', @CreatedBy, SYSUTCDATETIME(), 0
                )
            `);
            const whStockRequestId = whResult.recordset[0].StockRequestID;

            // 3. Insert line items into both Stock_Request_Details and Warehouse_StockRequestItems
            for (const item of items) {
                const detRequest = new sql.Request(transaction);
                detRequest.input('requestId', sql.Int, requestId);
                detRequest.input('medicineId', sql.Int, item.medicineId);
                detRequest.input('quantity', sql.Int, item.quantity);
                detRequest.input('unitId', sql.Int, item.unitId || 1);
                await detRequest.query(`
                    INSERT INTO Stock_Request_Details (RequestID, MedicineID, QuantityRequested, UnitID) 
                    VALUES (@requestId, @medicineId, @quantity, @unitId)
                `);

                const whItemReq = new sql.Request(transaction);
                whItemReq.input('StockRequestID', sql.BigInt, whStockRequestId);
                whItemReq.input('MedicineID', sql.Int, item.medicineId);
                whItemReq.input('QuantityRequested', sql.Int, item.quantity);
                whItemReq.input('CreatedBy', sql.Int, userId);
                await whItemReq.query(`
                    INSERT INTO Warehouse_StockRequestItems (
                        StockRequestID, MedicineID, QuantityRequested, QuantityApproved, QuantityReleased, CreatedBy, CreatedDate, IsDeleted
                    ) VALUES (
                        @StockRequestID, @MedicineID, @QuantityRequested, @QuantityRequested, 0, @CreatedBy, SYSUTCDATETIME(), 0
                    )
                `);
            }

            await transaction.commit();
            res.json({ success: true, requestId, warehouseStockRequestId: whStockRequestId, requestNumber: reqNumber });
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (err) {
        console.error('❌ ERROR in /api/stock-request:', err);
        res.status(500).json({ success: false, message: 'Database error: ' + err.message });
    }
});

app.get('/api/stock-requests', async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query(`
            SELECT sr.*, u.FullName as RequesterName 
            FROM Stock_Request sr 
            JOIN Users u ON sr.RequestedBy = u.UserID 
            ORDER BY sr.RequestDate DESC
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error('❌ ERROR:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

app.get('/api/stock-request/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await sql.connect(config);
        const request = new sql.Request();
        request.input('id', sql.Int, id);
        const mainResult = await request.query('SELECT sr.*, u.FullName as RequesterName FROM Stock_Request sr JOIN Users u ON sr.RequestedBy = u.UserID WHERE sr.RequestID = @id');
        if (mainResult.recordset.length === 0) return res.status(404).json({ message: 'Request not found' });
        const detailsResult = await request.query('SELECT srd.*, m.ProductName, m.GenericName, mu.UnitName, mc.CategoryName FROM Stock_Request_Details srd JOIN Medicines m ON srd.MedicineID = m.MedicineID JOIN Medicine_Unit mu ON srd.UnitID = mu.UnitID LEFT JOIN Medicine_Category mc ON m.CategoryID = mc.CategoryID WHERE srd.RequestID = @id');
        res.json({ ...mainResult.recordset[0], details: detailsResult.recordset });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

app.patch('/api/stock-request/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const pool = await sql.connect(config);
        const request = new sql.Request(pool);
        request.input('id', sql.Int, id);
        request.input('status', sql.NVarChar, status);
        await request.query(`
            UPDATE Stock_Request SET Status = @status WHERE RequestID = @id;
            UPDATE Warehouse_StockRequests SET Status = @status WHERE RequestNumber = 'SR-' + CAST(@id as nvarchar);
        `);
        res.json({ success: true, message: `Request status updated to ${status}` });
    } catch (err) {
        console.error('❌ ERROR:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// --- WAREHOUSE ENDPOINTS ---

app.get('/api/warehouse/pending-requests', async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query(`
            SELECT 
                sr.RequestID, 
                srd.MedicineID,
                u.FullName as RequesterName, 
                m.ProductName as ItemName, 
                srd.QuantityRequested, 
                sr.RequestDate, 
                sr.Status,
                'Medium' as Priority
            FROM Stock_Request sr
            JOIN Users u ON sr.RequestedBy = u.UserID
            JOIN Stock_Request_Details srd ON sr.RequestID = srd.RequestID
            JOIN Medicines m ON srd.MedicineID = m.MedicineID
            WHERE sr.Status = 'Pending'
            ORDER BY sr.RequestDate DESC
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error('âŒ ERROR:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

app.get('/api/warehouse/medicine/:id/lots', async (req, res) => {
    const { id } = req.params;
    try {
        await sql.connect(config);
        const request = new sql.Request();
        request.input('id', sql.Int, id);
        const result = await request.query(`
            SELECT ws.*, mu.UnitName 
            FROM Warehouse_Stocks ws 
            JOIN Medicine_Unit mu ON ws.UnitID = mu.UnitID 
            WHERE ws.MedicineID = @id AND ws.Quantity > 0
            ORDER BY ws.ExpiryDate ASC
        `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

app.post('/api/warehouse/approve-request-item', async (req, res) => {
    const { requestId, medicineId, quantity, lotNumber, userId } = req.body;
    try {
        await sql.connect(config);
        const transaction = new sql.Transaction();
        await transaction.begin();
        try {
            // 1. Get stock info
            const reqStock = new sql.Request(transaction);
            reqStock.input('mid', sql.Int, medicineId);
            reqStock.input('lot', sql.NVarChar, lotNumber);
            const stockRes = await reqStock.query('SELECT * FROM Warehouse_Stocks WHERE MedicineID=@mid AND LotNumber=@lot');
            const stock = stockRes.recordset[0];
            
            if (!stock || stock.Quantity < quantity) {
                throw new Error('Insufficient stock in selected lot');
            }

            // 2. Deduct from Warehouse_Stocks
            const reqDeduct = new sql.Request(transaction);
            reqDeduct.input('mid', sql.Int, medicineId);
            reqDeduct.input('lot', sql.NVarChar, lotNumber);
            reqDeduct.input('qty', sql.Int, quantity);
            await reqDeduct.query('UPDATE Warehouse_Stocks SET Quantity = Quantity - @qty WHERE MedicineID=@mid AND LotNumber=@lot');

            // 3. Add to Pharmacy_Stocks
            const reqPharmacy = new sql.Request(transaction);
            reqPharmacy.input('mid', sql.Int, medicineId);
            reqPharmacy.input('lot', sql.NVarChar, lotNumber);
            reqPharmacy.input('qty', sql.Int, quantity);
            reqPharmacy.input('unitId', sql.Int, stock.UnitID);
            reqPharmacy.input('expiry', sql.Date, stock.ExpiryDate);
            
            await reqPharmacy.query(`
                IF EXISTS (SELECT * FROM Pharmacy_Stocks WHERE MedicineID=@mid AND LotNumber=@lot)
                    UPDATE Pharmacy_Stocks SET Quantity = Quantity + @qty WHERE MedicineID=@mid AND LotNumber=@lot
                ELSE
                    INSERT INTO Pharmacy_Stocks (MedicineID, Quantity, UnitID, LotNumber, ExpiryDate, DateReceived) 
                    VALUES (@mid, @qty, @unitId, @lot, @expiry, GETDATE())
            `);

            // 4. Update Stock_Request status to 'Approved'
            const reqStatus = new sql.Request(transaction);
            reqStatus.input('rid', sql.Int, requestId);
            await reqStatus.query('UPDATE Stock_Request SET Status = \'Approved\' WHERE RequestID = @rid');

            await transaction.commit();
            res.json({ success: true, message: 'Request approved and stock moved successfully' });
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (err) {
        console.error('âŒ ERROR:', err);
        res.status(500).json({ success: false, message: err.message || 'Database error' });
    }
});

/*
app.get('/api/warehouse/inventory', async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query('SELECT ws.*, m.ProductName, mu.UnitName as Unit FROM Warehouse_Stocks ws JOIN Medicines m ON ws.MedicineID = m.MedicineID JOIN Medicine_Unit mu ON ws.UnitID = mu.UnitID ORDER BY m.ProductName');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ success: false, message: 'Database error' });
    }
});
*/

app.post('/api/warehouse/receive', async (req, res) => {
    const { drNumber, supplierName, dateDelivered, remarks, receivedBy, items } = req.body;
    try {
        await sql.connect(config);
        const transaction = new sql.Transaction();
        await transaction.begin();
        try {
            const req1 = new sql.Request(transaction);
            req1.input('drNumber', sql.NVarChar, drNumber);
            req1.input('drDate', sql.Date, dateDelivered);
            req1.input('supplierName', sql.NVarChar, supplierName || '');
            req1.input('receivedBy', sql.NVarChar, receivedBy || '');
            req1.input('remarks', sql.NVarChar, remarks || '');
            const recResult = await req1.query('INSERT INTO DR_Header (DR_Number, DR_Date, SupplierName, ReceivedBy, Remarks) OUTPUT INSERTED.DR_ID VALUES (@drNumber, @drDate, @supplierName, @receivedBy, @remarks)');
            const drId = recResult.recordset[0].DR_ID;
            for (const item of items) {
                if (!item.medicineId) continue;
                const req2 = new sql.Request(transaction);
                req2.input('drId', sql.Int, drId);
                req2.input('medicineId', sql.Int, item.medicineId);
                req2.input('quantity', sql.Int, item.quantity || 0);
                req2.input('lotNumber', sql.NVarChar, item.lotNumber || '');
                req2.input('expiryDate', sql.Date, item.expiryDate || null);
                req2.input('price', sql.Decimal(18, 2), item.price || 0);
                await req2.query('INSERT INTO DR_Items (DR_ID, MedicineID, QuantityReceived, LotNumber, ExpiryDate, Price) VALUES (@drId, @medicineId, @quantity, @lotNumber, @expiryDate, @price)');
                const req3 = new sql.Request(transaction);
                req3.input('medicineId', sql.Int, item.medicineId);
                req3.input('unitId', sql.Int, item.unitId || null);
                req3.input('quantity', sql.Int, item.quantity || 0);
                req3.input('lotNumber', sql.NVarChar, item.lotNumber || '');
                req3.input('expiryDate', sql.Date, item.expiryDate || null);
                req3.input('price', sql.Decimal(18, 2), item.price || 0);
                await req3.query('IF EXISTS (SELECT * FROM Warehouse_Stocks WHERE MedicineID=@medicineId AND LotNumber=@lotNumber) UPDATE Warehouse_Stocks SET Quantity=Quantity+@quantity, Price=@price WHERE MedicineID=@medicineId AND LotNumber=@lotNumber ELSE INSERT INTO Warehouse_Stocks (MedicineID, UnitID, Quantity, LotNumber, ExpiryDate, Price) VALUES (@medicineId, @unitId, @quantity, @lotNumber, @expiryDate, @price)');
            }
            await transaction.commit();
            res.json({ success: true, drId });
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (err) {
        console.error('âŒ ERR:', err);
        res.status(500).json({ success: false, message: err.message || 'Database error' });
    }
});

app.post('/api/warehouse/issue', async (req, res) => {
    const { releaseType, name, userId, items } = req.body;
    try {
        await sql.connect(config);
        const transaction = new sql.Transaction();
        await transaction.begin();
        try {
            const req1 = new sql.Request(transaction);
            req1.input('releasedTo', sql.NVarChar, name || releaseType || 'Unknown');
            req1.input('userId', sql.Int, userId);
            const relResult = await req1.query('INSERT INTO Warehouse_Bulk_Release (ReleasedTo,ReleasedBy) OUTPUT INSERTED.ReleaseID VALUES (@releasedTo,@userId)');
            const releaseId = relResult.recordset[0].ReleaseID;

            for (const item of items) {
                if (!item.medicineId) continue;
                
                // If the frontend sent specific lot allocations, use them. 
                // Otherwise, use FIFO auto-allocation.
                const allocations = item.allocations || []; 
                let remainingToIssue = item.quantity || 0;

                if (allocations.length > 0) {
                    // Manual/Specified Allocation Path
                    for (const alloc of allocations) {
                        if (alloc.quantity <= 0) continue;
                        
                        const lotInfoRes = await new sql.Request(transaction).input('mid', sql.Int, item.medicineId).input('lot', sql.NVarChar, alloc.lotNumber).query('SELECT Price, UnitID, ExpiryDate FROM Warehouse_Stocks WHERE MedicineID=@mid AND LotNumber=@lot');
                        const lotInfo = lotInfoRes.recordset[0];

                        const req2 = new sql.Request(transaction);
                        req2.input('releaseId', sql.Int, releaseId);
                        req2.input('medicineId', sql.Int, item.medicineId);
                        req2.input('quantity', sql.Int, alloc.quantity);
                        req2.input('unitId', sql.Int, lotInfo?.UnitID || null);
                        req2.input('price', sql.Decimal(18, 2), lotInfo?.Price || 0);
                        await req2.query('INSERT INTO Warehouse_Bulk_Release_Details (ReleaseID, MedicineID, Quantity, UnitID, Price) VALUES (@releaseId, @medicineId, @quantity, @unitId, @price)');

                        const req3 = new sql.Request(transaction);
                        req3.input('mid', sql.Int, item.medicineId);
                        req3.input('lot', sql.NVarChar, alloc.lotNumber);
                        req3.input('qty', sql.Int, alloc.quantity);
                        await req3.query('UPDATE Warehouse_Stocks SET Quantity = Quantity - @qty WHERE MedicineID = @mid AND LotNumber = @lot');

                        // If Pharmacy Request, update Pharmacy Stocks with the specific lot's price/expiry
                        if (releaseType === 'Pharmacy Request') {
                            const req4 = new sql.Request(transaction);
                            req4.input('medicineId', sql.Int, item.medicineId);
                            req4.input('quantity', sql.Int, alloc.quantity);
                            req4.input('unitId', sql.Int, lotInfo?.UnitID || null);
                            req4.input('lotNumber', sql.NVarChar, alloc.lotNumber);
                            req4.input('expiryDate', sql.Date, lotInfo?.ExpiryDate || null);
                            req4.input('price', sql.Decimal(18, 2), lotInfo?.Price || 0);
                            await req4.query('IF EXISTS (SELECT * FROM Pharmacy_Stocks WHERE MedicineID=@medicineId AND LotNumber=@lotNumber) UPDATE Pharmacy_Stocks SET Quantity=Quantity+@quantity, Price=@price WHERE MedicineID=@medicineId AND LotNumber=@lotNumber ELSE INSERT INTO Pharmacy_Stocks (MedicineID, Quantity, UnitID, LotNumber, ExpiryDate, DateReceived, Price) VALUES (@medicineId, @quantity, @unitId, @lotNumber, @expiryDate, GETDATE(), @price)');
                        }
                    }
                } else {
                    // Fallback to simple FIFO if no allocations provided
                    const stockReq = new sql.Request(transaction);
                    stockReq.input('mid', sql.Int, item.medicineId);
                    const lotsRes = await stockReq.query('SELECT StockID, Quantity, Price, UnitID, LotNumber, ExpiryDate FROM Warehouse_Stocks WHERE MedicineID=@mid AND Quantity > 0 ORDER BY ExpiryDate ASC');
                    
                    for (const lot of lotsRes.recordset) {
                        if (remainingToIssue <= 0) break;
                        const deductQty = Math.min(remainingToIssue, lot.Quantity);
                        
                        await new sql.Request(transaction).input('rid', sql.Int, releaseId).input('mid', sql.Int, item.medicineId).input('q', sql.Int, deductQty).input('uid', sql.Int, lot.UnitID || null).input('pr', sql.Decimal(18, 2), lot.Price || 0).query('INSERT INTO Warehouse_Bulk_Release_Details (ReleaseID, MedicineID, Quantity, UnitID, Price) VALUES (@rid, @mid, @q, @uid, @pr)');
                        await new sql.Request(transaction).input('sid', sql.Int, lot.StockID).input('q', sql.Int, deductQty).query('UPDATE Warehouse_Stocks SET Quantity = Quantity - @q WHERE StockID = @sid');

                        if (releaseType === 'Pharmacy Request') {
                            const reqP = new sql.Request(transaction);
                            reqP.input('mid', sql.Int, item.medicineId);
                            reqP.input('q', sql.Int, deductQty);
                            reqP.input('uid', sql.Int, lot.UnitID);
                            reqP.input('lot', sql.NVarChar, lot.LotNumber);
                            reqP.input('exp', sql.Date, lot.ExpiryDate);
                            reqP.input('pr', sql.Decimal(18, 2), lot.Price);
                            await reqP.query('IF EXISTS (SELECT * FROM Pharmacy_Stocks WHERE MedicineID=@mid AND LotNumber=@lot) UPDATE Pharmacy_Stocks SET Quantity=Quantity+@q, Price=@pr WHERE MedicineID=@mid AND LotNumber=@lot ELSE INSERT INTO Pharmacy_Stocks (MedicineID, Quantity, UnitID, LotNumber, ExpiryDate, DateReceived, Price) VALUES (@mid, @q, @uid, @lot, @exp, GETDATE(), @pr)');
                        }
                        remainingToIssue -= deductQty;
                    }
                    if (remainingToIssue > 0) throw new Error('Insufficient stock for ' + item.productName);
                }
            }
            await transaction.commit();
            res.json({ success: true, releaseId });
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (err) {
        console.error('âŒ ERR:', err);
        res.status(500).json({ success: false, message: err.message || 'Database error' });
    }
});

// --- MEDICINE CRUD ---

app.get('/api/warehouse/medicine/:id/lots', async (req, res) => {
    const { id } = req.params;
    try {
        await sql.connect(config);
        const result = await sql.query(`SELECT LotNumber, ExpiryDate, Quantity, Price, UnitID FROM Warehouse_Stocks WHERE MedicineID = ${id} AND Quantity > 0`);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ success: false, message: 'Database error' }); }
});

app.get('/api/pharmacy/medicine/:id/lots', async (req, res) => {
    const { id } = req.params;
    try {
        await sql.connect(config);
        const request = new sql.Request();
        request.input('id', sql.Int, id);
        const result = await request.query(`
            SELECT LotNumber, ExpiryDate, Quantity, Price, UnitID, StockID
            FROM Pharmacy_Stocks 
            WHERE MedicineID = @id AND Quantity > 0
            ORDER BY ExpiryDate ASC
        `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ success: false, message: 'Database error' }); }
});

app.get('/api/medicine-categories', async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query('SELECT CategoryID, CategoryName FROM Medicine_Category ORDER BY CategoryName');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ success: false, message: 'Database error' }); }
});

app.get('/api/warehouse/medicines-full', async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query('SELECT m.MedicineID, m.ProductName, m.GenericName, m.BrandName, m.Dosage, m.Form, m.Description, m.UnitID, mu.UnitName, m.CategoryID, mc.CategoryName, ISNULL(ws.TotalStock, 0) as TotalStock FROM Medicines m JOIN Medicine_Unit mu ON m.UnitID = mu.UnitID LEFT JOIN Medicine_Category mc ON m.CategoryID = mc.CategoryID LEFT JOIN (SELECT MedicineID, SUM(Quantity) as TotalStock FROM Warehouse_Stocks GROUP BY MedicineID) ws ON m.MedicineID = ws.MedicineID WHERE m.IsActive = 1 ORDER BY m.ProductName');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ success: false, message: 'Database error' }); }
});

app.post('/api/medicines/add', async (req, res) => {
    const { productName, genericName, brandName, dosage, form, description, unitId, categoryId } = req.body;
    try {
        await sql.connect(config);
        const request = new sql.Request();
        request.input('productName', sql.NVarChar, productName);
        request.input('genericName', sql.NVarChar, genericName || '');
        request.input('brandName', sql.NVarChar, brandName || '');
        request.input('dosage', sql.NVarChar, dosage || '');
        request.input('form', sql.NVarChar, form || '');
        request.input('description', sql.NVarChar, description || '');
        request.input('unitId', sql.Int, unitId);
        request.input('categoryId', sql.Int, categoryId || null);
        const result = await request.query('INSERT INTO Medicines (ProductName,GenericName,BrandName,Dosage,Form,Description,UnitID,CategoryID,IsActive) OUTPUT INSERTED.MedicineID VALUES (@productName,@genericName,@brandName,@dosage,@form,@description,@unitId,@categoryId,1)');
        res.json({ success: true, medicineId: result.recordset[0].MedicineID });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.put('/api/medicines/update/:id', async (req, res) => {
    const { id } = req.params;
    const { productName, genericName, brandName, dosage, form, description, unitId, categoryId } = req.body;
    try {
        await sql.connect(config);
        const request = new sql.Request();
        request.input('id', sql.Int, id);
        request.input('productName', sql.NVarChar, productName);
        request.input('genericName', sql.NVarChar, genericName || '');
        request.input('brandName', sql.NVarChar, brandName || '');
        request.input('dosage', sql.NVarChar, dosage || '');
        request.input('form', sql.NVarChar, form || '');
        request.input('description', sql.NVarChar, description || '');
        request.input('unitId', sql.Int, unitId || null);
        request.input('categoryId', sql.Int, categoryId || null);
        await request.query('UPDATE Medicines SET ProductName=@productName,GenericName=@genericName,BrandName=@brandName,Dosage=@dosage,Form=@form,Description=@description,UnitID=@unitId,CategoryID=@categoryId WHERE MedicineID=@id');
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// --- PHARMACY ANALYTICS ---

app.get('/api/pharmacy/dashboard/stats', async (req, res) => {
    try {
        await sql.connect(config);
        
        // Daily Sales
        const salesRes = await sql.query(`
            SELECT ISNULL(SUM(psd.Quantity * psd.Price), 0) as DailySales
            FROM Pharmacy_Sales ps
            JOIN Pharmacy_Sales_Details psd ON ps.SaleID = psd.SaleID
            WHERE CAST(ps.SaleDate AS DATE) = CAST(GETDATE() AS DATE)
        `);
        
        // Total Transactions Today
        const transRes = await sql.query(`
            SELECT COUNT(*) as TotalTransactions
            FROM Pharmacy_Sales
            WHERE CAST(SaleDate AS DATE) = CAST(GETDATE() AS DATE)
        `);
        
        // Top Selling Medicine
        const topRes = await sql.query(`
            SELECT TOP 1 m.ProductName, SUM(psd.Quantity) as TotalQty
            FROM Pharmacy_Sales_Details psd
            JOIN Medicines m ON psd.MedicineID = m.MedicineID
            GROUP BY m.ProductName
            ORDER BY TotalQty DESC
        `);
        
        // Low Stock Count (threshold 10)
        const lowRes = await sql.query(`
            SELECT COUNT(*) as LowStockCount
            FROM (
                SELECT MedicineID, SUM(Quantity) as TotalStock
                FROM Pharmacy_Stocks
                GROUP BY MedicineID
            ) s
            WHERE s.TotalStock < 10
        `);

        res.json({
            dailySales: salesRes.recordset[0].DailySales,
            totalTransactions: transRes.recordset[0].TotalTransactions,
            topSelling: topRes.recordset[0]?.ProductName || 'None',
            lowStockCount: lowRes.recordset[0].LowStockCount
        });
    } catch (err) {
        console.error('âŒ ERROR:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

app.get('/api/pharmacy/dashboard/sales-trend', async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query(`
            SELECT 
                FORMAT(SaleDate, 'ddd') as name,
                SUM(psd.Quantity * psd.Price) as value
            FROM Pharmacy_Sales ps
            JOIN Pharmacy_Sales_Details psd ON ps.SaleID = psd.SaleID
            WHERE SaleDate >= DATEADD(day, -7, GETDATE())
            GROUP BY FORMAT(SaleDate, 'ddd'), DATEPART(dw, SaleDate)
            ORDER BY DATEPART(dw, SaleDate)
        `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

app.get('/api/pharmacy/dashboard/top-medicines', async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query(`
            SELECT TOP 5 m.ProductName as name, SUM(psd.Quantity) as sales
            FROM Pharmacy_Sales_Details psd
            JOIN Medicines m ON psd.MedicineID = m.MedicineID
            GROUP BY m.ProductName
            ORDER BY sales DESC
        `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

app.get('/api/pharmacy/dashboard/recent-transactions', async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query(`
            SELECT TOP 5 
                ps.SaleID as id,
                ps.SaleDate as date,
                u.FullName as cashier,
                (SELECT SUM(Quantity * Price) FROM Pharmacy_Sales_Details WHERE SaleID = ps.SaleID) as total
            FROM Pharmacy_Sales ps
            JOIN Users u ON ps.SoldBy = u.UserID
            ORDER BY ps.SaleDate DESC
        `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// --- WAREHOUSE ANALYTICS ---

app.get('/api/warehouse/dashboard/stats', async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query(`
            SELECT 
                (SELECT COUNT(*) FROM Medicines WHERE IsActive = 1) as totalProducts,
                (SELECT ISNULL(SUM(Quantity), 0) FROM Warehouse_Stocks) as totalStockQty,
                (SELECT COUNT(*) FROM (SELECT MedicineID, SUM(Quantity) as qty FROM Warehouse_Stocks GROUP BY MedicineID) s WHERE s.qty < 50) as lowStockItems,
                (SELECT COUNT(*) FROM Medicines m WHERE NOT EXISTS (SELECT 1 FROM Warehouse_Stocks ws WHERE ws.MedicineID = m.MedicineID AND ws.Quantity > 0)) as outOfStock
        `);
        res.json(result.recordset[0]);
    } catch (err) { res.status(500).json({ success: false, message: 'Database error' }); }
});

app.get('/api/warehouse/dashboard/category-distribution', async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query(`
            SELECT mc.CategoryName as name, COUNT(m.MedicineID) as value
            FROM Medicine_Category mc
            JOIN Medicines m ON mc.CategoryID = m.CategoryID
            GROUP BY mc.CategoryName
        `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ success: false, message: 'Database error' }); }
});

app.delete('/api/medicines/remove/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await sql.connect(config);
        const request = new sql.Request();
        request.input('id', sql.Int, id);
        await request.query('UPDATE Medicines SET IsActive=0 WHERE MedicineID=@id');
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.get('/api/patients', async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query(`
            SELECT 
                p.*,
                (SELECT COUNT(*) FROM Pharmacy_Sales WHERE PatientID = p.PatientID) as Visits,
                (SELECT MAX(SaleDate) FROM Pharmacy_Sales WHERE PatientID = p.PatientID) as LastVisit
            FROM Patients p
            ORDER BY p.Surname, p.FirstName
        `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ success: false, message: 'Database error' }); }
});

app.post('/api/patients', async (req, res) => {
    const { firstName, middleName, surname, birthDate, brgy, detailedAddress, contactNo, email } = req.body;
    try {
        await sql.connect(config);
        const request = new sql.Request();
        request.input('f', sql.NVarChar, firstName);
        request.input('m', sql.NVarChar, middleName || '');
        request.input('s', sql.NVarChar, surname);
        request.input('full', sql.NVarChar, `${surname}, ${firstName} ${middleName || ''}`.trim());
        request.input('bd', sql.Date, birthDate || null);
        request.input('brgy', sql.NVarChar, brgy);
        request.input('addr', sql.NVarChar, detailedAddress || '');
        request.input('phone', sql.NVarChar, contactNo);
        request.input('email', sql.NVarChar, email || '');

        const result = await request.query(`
            INSERT INTO Patients (FirstName, MiddleName, Surname, FullName, BirthDate, Barangay, DetailedAddress, ContactNumber, Email, DateRegistered)
            OUTPUT INSERTED.PatientID
            VALUES (@f, @m, @s, @full, @bd, @brgy, @addr, @phone, @email, GETDATE())
        `);
        
        res.json({ success: true, patientId: result.recordset[0].PatientID });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.post('/api/pharmacy/sales', async (req, res) => {
    const { userId, patientId, items } = req.body;
    try {
        await sql.connect(config);
        const transaction = new sql.Transaction();
        await transaction.begin();
        try {
            const request = new sql.Request(transaction);
            request.input('userId', sql.Int, userId);
            request.input('patientId', sql.Int, patientId || null);
            
            // 1. Insert into Pharmacy_Sales
            const saleResult = await request.query('INSERT INTO Pharmacy_Sales (SoldBy, PatientID, SaleDate) OUTPUT INSERTED.SaleID VALUES (@userId, @patientId, GETDATE())');
            const saleId = saleResult.recordset[0].SaleID;

            for (const item of items) {
                const medId = item.medicineId;
                let remainingToDeduct = item.quantity;

                // 2. Deduct from Pharmacy_Stocks
                const allocations = item.allocations || [];

                if (allocations.length > 0) {
                    for (const alloc of allocations) {
                        if (alloc.quantity <= 0) continue;

                        const stockReq = new sql.Request(transaction);
                        stockReq.input('mid', sql.Int, medId);
                        stockReq.input('lot', sql.NVarChar, alloc.lotNumber);
                        const stockRes = await stockReq.query('SELECT StockID, Quantity, Price, UnitID FROM Pharmacy_Stocks WHERE MedicineID = @mid AND LotNumber = @lot');
                        const stock = stockRes.recordset[0];

                        if (!stock || stock.Quantity < alloc.quantity) {
                            throw new Error(`Insufficient stock for lot ${alloc.lotNumber}`);
                        }

                        const updateReq = new sql.Request(transaction);
                        updateReq.input('sid', sql.Int, stock.StockID);
                        updateReq.input('deduct', sql.Int, alloc.quantity);
                        await updateReq.query('UPDATE Pharmacy_Stocks SET Quantity = Quantity - @deduct WHERE StockID = @sid');

                        const detailReq = new sql.Request(transaction);
                        detailReq.input('saleId', sql.Int, saleId);
                        detailReq.input('mid', sql.Int, medId);
                        detailReq.input('qty', sql.Int, alloc.quantity);
                        detailReq.input('price', sql.Decimal(18, 2), stock.Price || 0);
                        detailReq.input('unitId', sql.Int, stock.UnitID || null);
                        await detailReq.query('INSERT INTO Pharmacy_Sales_Details (SaleID, MedicineID, Quantity, Price, UnitID) VALUES (@saleId, @mid, @qty, @price, @unitId)');
                    }
                } else {
                    // Fallback FIFO (if no allocations provided)
                    const stockReq = new sql.Request(transaction);
                    stockReq.input('mid', sql.Int, medId);
                    const stocks = await stockReq.query('SELECT StockID, Quantity, Price, UnitID FROM Pharmacy_Stocks WHERE MedicineID = @mid AND Quantity > 0 ORDER BY ExpiryDate ASC');
                    
                    for (const stock of stocks.recordset) {
                        if (remainingToDeduct <= 0) break;
                        const deduct = Math.min(remainingToDeduct, stock.Quantity);
                        const updateReq = new sql.Request(transaction);
                        updateReq.input('sid', sql.Int, stock.StockID);
                        updateReq.input('deduct', sql.Int, deduct);
                        await updateReq.query('UPDATE Pharmacy_Stocks SET Quantity = Quantity - @deduct WHERE StockID = @sid');
                        
                        const detailReq = new sql.Request(transaction);
                        detailReq.input('saleId', sql.Int, saleId);
                        detailReq.input('mid', sql.Int, medId);
                        detailReq.input('qty', sql.Int, deduct);
                        detailReq.input('price', sql.Decimal(18, 2), stock.Price || 0);
                        detailReq.input('unitId', sql.Int, stock.UnitID || null);
                        await detailReq.query('INSERT INTO Pharmacy_Sales_Details (SaleID, MedicineID, Quantity, Price, UnitID) VALUES (@saleId, @mid, @qty, @price, @unitId)');

                        remainingToDeduct -= deduct;
                    }

                    if (remainingToDeduct > 0) {
                        throw new Error(`Insufficient stock for medicine ID ${medId}`);
                    }
                }
            }

            await transaction.commit();
            res.json({ success: true, saleId });
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (err) {
        console.error('âŒ ERROR:', err);
        res.status(500).json({ success: false, message: err.message || 'Database error' });
    }
});

app.get('/api/pharmacy/inventory-full', async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query(`
            SELECT 
                ps.StockID as id, 
                ps.MedicineID as medicineId,
                m.ProductName as productName, 
                m.GenericName as genericName, 
                ps.LotNumber as batchNumber, 
                ps.ExpiryDate as expiryDate, 
                ps.Quantity as quantity, 
                ps.Price as price,
                mu.UnitName as unit,
                ps.DateReceived as dateReceived,
                'N/A' as supplier
            FROM Pharmacy_Stocks ps
            JOIN Medicines m ON ps.MedicineID = m.MedicineID
            JOIN Medicine_Unit mu ON ps.UnitID = mu.UnitID
            LEFT JOIN Medicine_Category mc ON m.CategoryID = mc.CategoryID
            ORDER BY m.ProductName
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error('âŒ ERROR:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

app.get('/api/pharmacy/sales-history', async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query(`
            SELECT 
                ps.SaleID,
                ps.SaleDate,
                p.FullName as PatientName,
                ISNULL((SELECT SUM(Quantity * Price) FROM Pharmacy_Sales_Details WHERE SaleID = ps.SaleID), 0) as TotalValue,
                ISNULL((SELECT SUM(Quantity) FROM Pharmacy_Sales_Details WHERE SaleID = ps.SaleID), 0) as TotalItems
            FROM Pharmacy_Sales ps
            LEFT JOIN Patients p ON ps.PatientID = p.PatientID
            ORDER BY ps.SaleDate DESC
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error('âŒ ERROR:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

app.get('/api/pharmacy/reports/inventory-log', async (req, res) => {
    const { month, year } = req.query;
    try {
        await sql.connect(config);
        const request = new sql.Request();
        request.input('month', sql.Int, parseInt(month));
        request.input('year', sql.Int, parseInt(year));
        
        const result = await request.query(`
            SELECT 
                mu.UnitName as measure,
                m.ProductName as description,
                ISNULL((SELECT SUM(Quantity) FROM Pharmacy_Stocks WHERE MedicineID = m.MedicineID AND MONTH(DateReceived) = @month AND YEAR(DateReceived) = @year), 0) as received,
                ISNULL((SELECT SUM(Quantity) FROM Pharmacy_Stocks WHERE MedicineID = m.MedicineID), 0) as inventory,
                ISNULL((SELECT SUM(psd.Quantity) FROM Pharmacy_Sales_Details psd JOIN Pharmacy_Sales ps ON psd.SaleID = ps.SaleID WHERE psd.MedicineID = m.MedicineID AND MONTH(ps.SaleDate) = @month AND YEAR(ps.SaleDate) = @year), 0) as issued,
                ISNULL((SELECT TOP 1 Price FROM Pharmacy_Stocks WHERE MedicineID = m.MedicineID ORDER BY DateReceived DESC), 0) as price
            FROM Medicines m
            JOIN Medicine_Unit mu ON m.UnitID = mu.UnitID
            WHERE m.IsActive = 1
              AND (
                  EXISTS(SELECT 1 FROM Pharmacy_Stocks WHERE MedicineID = m.MedicineID) OR
                  EXISTS(SELECT 1 FROM Pharmacy_Sales_Details psd JOIN Pharmacy_Sales ps ON psd.SaleID = ps.SaleID WHERE psd.MedicineID = m.MedicineID AND MONTH(ps.SaleDate) = @month AND YEAR(ps.SaleDate) = @year)
              )
            ORDER BY m.ProductName
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error('âŒ ERROR:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});
// ==========================================
// WAREHOUSE MASTER DATA ENDPOINTS
// ==========================================

app.get('/api/warehouse/medicine-categories', async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query(`
            SELECT 
                c.CategoryID as id, 
                c.CategoryName as name, 
                c.CreatedDate as createdAt,
                u.Username as createdBy,
                c.ModifiedDate as modifiedAt,
                um.Username as modifiedBy,
                c.IsDeleted
            FROM Warehouse_MedicineCategories c
            LEFT JOIN Users u ON c.CreatedBy = u.UserID
            LEFT JOIN Users um ON c.ModifiedBy = um.UserID
            WHERE c.IsDeleted = 0
            ORDER BY c.CategoryName
        `);
        const categories = result.recordset.map(r => ({
            id: String(r.id),
            name: r.name,
            createdAt: r.createdAt,
            createdBy: r.createdBy || 'System',
            modifiedAt: r.modifiedAt,
            modifiedBy: r.modifiedBy,
            status: 'Active'
        }));
        res.json(categories);
    } catch (err) {
        console.error('ERROR:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

app.post('/api/warehouse/medicine-categories', async (req, res) => {
    const { name } = req.body;
    try {
        await sql.connect(config);
        
        const check = await sql.query(`SELECT * FROM Warehouse_MedicineCategories WHERE CategoryName = '${name.replace(/'/g, "''")}'`);
        if (check.recordset.length > 0) {
            return res.status(400).json({ success: false, message: 'Category already exists' });
        }

        const request = new sql.Request();
        request.input('name', sql.NVARCHAR, name);
        request.input('createdBy', sql.INT, 1);

        const result = await request.query(`
            INSERT INTO Warehouse_MedicineCategories (CategoryName, CreatedBy, CreatedDate)
            OUTPUT 
                INSERTED.CategoryID as id, 
                INSERTED.CategoryName as name,
                INSERTED.CreatedDate as createdAt
            VALUES (@name, @createdBy, SYSUTCDATETIME())
        `);
        
        const newCat = result.recordset[0];
        res.json({
            ...newCat,
            id: String(newCat.id),
            createdBy: 'System',
            status: 'Active'
        });
    } catch (err) {
        console.error('ERROR:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

app.put('/api/warehouse/medicine-categories/:id', async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    try {
        await sql.connect(config);
        const request = new sql.Request();
        request.input('id', sql.INT, id);
        request.input('name', sql.NVARCHAR, name);
        request.input('modifiedBy', sql.INT, 1);

        const result = await request.query(`
            UPDATE Warehouse_MedicineCategories
            SET 
                CategoryName = @name,
                ModifiedBy = @modifiedBy,
                ModifiedDate = SYSUTCDATETIME()
            OUTPUT 
                INSERTED.CategoryID as id, 
                INSERTED.CategoryName as name,
                INSERTED.ModifiedDate as modifiedAt
            WHERE CategoryID = @id AND IsDeleted = 0
        `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        const updated = result.recordset[0];
        res.json({
            ...updated,
            id: String(updated.id),
            status: 'Active'
        });
    } catch (err) {
        console.error('ERROR:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

app.delete('/api/warehouse/medicine-categories/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await sql.connect(config);
        const request = new sql.Request();
        request.input('id', sql.INT, id);
        request.input('deletedBy', sql.INT, 1);

        await request.query(`
            UPDATE Warehouse_MedicineCategories
            SET 
                IsDeleted = 1,
                DeletedBy = @deletedBy,
                DeletedDate = SYSUTCDATETIME()
            WHERE CategoryID = @id
        `);

        res.json({ success: true, message: 'Category deleted successfully' });
    } catch (err) {
        console.error('ERROR:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

app.get('/api/warehouse/medicine-units', async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query(`
            SELECT 
                u.UnitID as id, 
                u.UnitName as name, 
                u.Abbreviation as abbreviation,
                u.CreatedDate as createdAt,
                usr.Username as createdBy,
                u.ModifiedDate as modifiedAt,
                usrm.Username as modifiedBy,
                u.IsDeleted
            FROM Warehouse_MedicineUnits u
            LEFT JOIN Users usr ON u.CreatedBy = usr.UserID
            LEFT JOIN Users usrm ON u.ModifiedBy = usrm.UserID
            WHERE u.IsDeleted = 0
            ORDER BY u.UnitName
        `);
        const units = result.recordset.map(r => ({
            id: String(r.id),
            name: r.name,
            abbreviation: r.abbreviation || '',
            createdAt: r.createdAt,
            createdBy: r.createdBy || 'System',
            modifiedAt: r.modifiedAt,
            modifiedBy: r.modifiedBy,
            status: 'Active'
        }));
        res.json(units);
    } catch (err) {
        console.error('ERROR:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

app.post('/api/warehouse/medicine-units', async (req, res) => {
    const { name, abbreviation } = req.body;
    try {
        await sql.connect(config);
        
        const check = await sql.query(`
            SELECT * FROM Warehouse_MedicineUnits 
            WHERE (UnitName = '${name.replace(/'/g, "''")}' 
            OR (Abbreviation IS NOT NULL AND Abbreviation = '${(abbreviation || '').replace(/'/g, "''")}'))
            AND IsDeleted = 0
        `);
        if (check.recordset.length > 0) {
            return res.status(400).json({ success: false, message: 'Unit Name or Abbreviation already exists' });
        }

        const request = new sql.Request();
        request.input('name', sql.NVARCHAR, name);
        request.input('abbreviation', sql.NVARCHAR, abbreviation || null);
        request.input('createdBy', sql.INT, 1);

        const result = await request.query(`
            INSERT INTO Warehouse_MedicineUnits (UnitName, Abbreviation, CreatedBy, CreatedDate)
            OUTPUT 
                INSERTED.UnitID as id, 
                INSERTED.UnitName as name,
                INSERTED.Abbreviation as abbreviation,
                INSERTED.CreatedDate as createdAt
            VALUES (@name, @abbreviation, @createdBy, SYSUTCDATETIME())
        `);
        
        const newUnit = result.recordset[0];
        res.json({
            ...newUnit,
            id: String(newUnit.id),
            createdBy: 'System',
            status: 'Active'
        });
    } catch (err) {
        console.error('ERROR:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

app.put('/api/warehouse/medicine-units/:id', async (req, res) => {
    const { id } = req.params;
    const { name, abbreviation } = req.body;
    try {
        await sql.connect(config);
        
        const check = await sql.query(`
            SELECT * FROM Warehouse_MedicineUnits 
            WHERE (UnitName = '${name.replace(/'/g, "''")}' 
            OR (Abbreviation IS NOT NULL AND Abbreviation = '${(abbreviation || '').replace(/'/g, "''")}'))
            AND UnitID != ${id} AND IsDeleted = 0
        `);
        if (check.recordset.length > 0) {
            return res.status(400).json({ success: false, message: 'Unit Name or Abbreviation already exists' });
        }

        const request = new sql.Request();
        request.input('id', sql.INT, id);
        request.input('name', sql.NVARCHAR, name);
        request.input('abbreviation', sql.NVARCHAR, abbreviation || null);
        request.input('modifiedBy', sql.INT, 1);

        const result = await request.query(`
            UPDATE Warehouse_MedicineUnits
            SET 
                UnitName = @name,
                Abbreviation = @abbreviation,
                ModifiedBy = @modifiedBy,
                ModifiedDate = SYSUTCDATETIME()
            OUTPUT 
                INSERTED.UnitID as id, 
                INSERTED.UnitName as name,
                INSERTED.Abbreviation as abbreviation,
                INSERTED.ModifiedDate as modifiedAt
            WHERE UnitID = @id AND IsDeleted = 0
        `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Unit not found' });
        }

        const updated = result.recordset[0];
        res.json({
            ...updated,
            id: String(updated.id),
            status: 'Active'
        });
    } catch (err) {
        console.error('ERROR:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

app.delete('/api/warehouse/medicine-units/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await sql.connect(config);
        const request = new sql.Request();
        request.input('id', sql.INT, id);
        request.input('deletedBy', sql.INT, 1);

        await request.query(`
            UPDATE Warehouse_MedicineUnits
            SET 
                IsDeleted = 1,
                DeletedBy = @deletedBy,
                DeletedDate = SYSUTCDATETIME()
            WHERE UnitID = @id
        `);

        res.json({ success: true, message: 'Unit deleted successfully' });
    } catch (err) {
        console.error('ERROR:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});


app.get('/api/warehouse/suppliers', async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query(`
            SELECT 
                s.SupplierID as id, 
                s.SupplierCode as supplierCode,
                s.SupplierName as supplierName,
                s.BusinessName as businessName,
                s.SupplierType as supplierType,
                s.Status as status,
                s.ContactPerson as contactPerson,
                s.Position as position,
                s.Email as email,
                s.Telephone as telephone,
                s.MobileNumber as mobileNumber,
                s.Website as website,
                s.Street as street,
                s.Barangay as barangay,
                s.MunicipalityCity as municipalityCity,
                s.Province as province,
                s.Region as region,
                s.PostalCode as postalCode,
                s.Country as country,
                s.BusinessPermitNumber as businessPermitNumber,
                s.TaxIdNumber as tin,
                s.FDALicenseNumber as fdaLicenseNumber,
                s.LicenseExpirationDate as licenseExpirationDate,
                s.VATRegistered as vatRegistered,
                s.SupplierCategory as supplierCategory,
                s.CreatedDate as createdAt,
                usr.Username as createdBy,
                s.ModifiedDate as modifiedAt,
                usrm.Username as modifiedBy,
                s.IsDeleted
            FROM Warehouse_Suppliers s
            LEFT JOIN Users usr ON s.CreatedBy = usr.UserID
            LEFT JOIN Users usrm ON s.ModifiedBy = usrm.UserID
            WHERE s.IsDeleted = 0
            ORDER BY s.SupplierName
        `);
        
        const suppliers = result.recordset.map(r => ({
            ...r,
            id: String(r.id),
            createdBy: r.createdBy || 'System',
            vatRegistered: Boolean(r.vatRegistered)
        }));
        res.json(suppliers);
    } catch (err) {
        console.error('ERROR:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

app.post('/api/warehouse/suppliers', async (req, res) => {
    const data = req.body;
    try {
        await sql.connect(config);
        
        const check = await sql.query(`SELECT * FROM Warehouse_Suppliers WHERE SupplierName = '${data.supplierName.replace(/'/g, "''")}' AND IsDeleted = 0`);
        if (check.recordset.length > 0) {
            return res.status(400).json({ success: false, message: 'Supplier Name already exists' });
        }

        const request = new sql.Request();
        request.input('supplierCode', sql.NVARCHAR, data.supplierCode ? data.supplierCode.toUpperCase() : null);
        request.input('supplierName', sql.NVARCHAR, data.supplierName);
        request.input('businessName', sql.NVARCHAR, data.businessName || null);
        request.input('supplierType', sql.NVARCHAR, data.supplierType || null);
        request.input('status', sql.NVARCHAR, data.status || 'Active');
        request.input('contactPerson', sql.NVARCHAR, data.contactPerson || null);
        request.input('position', sql.NVARCHAR, data.position || null);
        request.input('email', sql.NVARCHAR, data.email || null);
        request.input('telephone', sql.NVARCHAR, data.telephone || null);
        request.input('mobileNumber', sql.NVARCHAR, data.mobileNumber || null);
        request.input('website', sql.NVARCHAR, data.website || null);
        request.input('street', sql.NVARCHAR, data.street || null);
        request.input('barangay', sql.NVARCHAR, data.barangay || null);
        request.input('municipalityCity', sql.NVARCHAR, data.municipalityCity || null);
        request.input('province', sql.NVARCHAR, data.province || null);
        request.input('region', sql.NVARCHAR, data.region || null);
        request.input('postalCode', sql.NVARCHAR, data.postalCode || null);
        request.input('country', sql.NVARCHAR, data.country || null);
        request.input('businessPermitNumber', sql.NVARCHAR, data.businessPermitNumber || null);
        request.input('tin', sql.NVARCHAR, data.tin || null);
        request.input('fdaLicenseNumber', sql.NVARCHAR, data.fdaLicenseNumber || null);
        request.input('licenseExpirationDate', sql.DATE, data.licenseExpirationDate || null);
        request.input('vatRegistered', sql.BIT, data.vatRegistered ? 1 : 0);
        request.input('supplierCategory', sql.NVARCHAR, data.supplierCategory || null);
        request.input('createdBy', sql.INT, 1); // Mock user

        const result = await request.query(`
            INSERT INTO Warehouse_Suppliers (
                SupplierCode, SupplierName, BusinessName, SupplierType, Status, 
                ContactPerson, Position, Email, Telephone, MobileNumber, Website,
                Street, Barangay, MunicipalityCity, Province, Region, PostalCode, Country,
                BusinessPermitNumber, TaxIdNumber, FDALicenseNumber, LicenseExpirationDate,
                VATRegistered, SupplierCategory, CreatedBy, CreatedDate
            )
            OUTPUT INSERTED.SupplierID as id
            VALUES (
                @supplierCode, @supplierName, @businessName, @supplierType, @status,
                @contactPerson, @position, @email, @telephone, @mobileNumber, @website,
                @street, @barangay, @municipalityCity, @province, @region, @postalCode, @country,
                @businessPermitNumber, @tin, @fdaLicenseNumber, @licenseExpirationDate,
                @vatRegistered, @supplierCategory, @createdBy, SYSUTCDATETIME()
            )
        `);
        
        const newRecord = result.recordset[0];
        res.json({ ...data, id: String(newRecord.id), createdBy: 'System' });
    } catch (err) {
        console.error('ERROR:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

app.put('/api/warehouse/suppliers/:id', async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    try {
        await sql.connect(config);
        
        const check = await sql.query(`SELECT * FROM Warehouse_Suppliers WHERE SupplierName = '${data.supplierName.replace(/'/g, "''")}' AND SupplierID != ${id} AND IsDeleted = 0`);
        if (check.recordset.length > 0) {
            return res.status(400).json({ success: false, message: 'Supplier Name already exists' });
        }

        const request = new sql.Request();
        request.input('id', sql.INT, id);
        request.input('supplierCode', sql.NVARCHAR, data.supplierCode ? data.supplierCode.toUpperCase() : null);
        request.input('supplierName', sql.NVARCHAR, data.supplierName);
        request.input('businessName', sql.NVARCHAR, data.businessName || null);
        request.input('supplierType', sql.NVARCHAR, data.supplierType || null);
        request.input('status', sql.NVARCHAR, data.status || 'Active');
        request.input('contactPerson', sql.NVARCHAR, data.contactPerson || null);
        request.input('position', sql.NVARCHAR, data.position || null);
        request.input('email', sql.NVARCHAR, data.email || null);
        request.input('telephone', sql.NVARCHAR, data.telephone || null);
        request.input('mobileNumber', sql.NVARCHAR, data.mobileNumber || null);
        request.input('website', sql.NVARCHAR, data.website || null);
        request.input('street', sql.NVARCHAR, data.street || null);
        request.input('barangay', sql.NVARCHAR, data.barangay || null);
        request.input('municipalityCity', sql.NVARCHAR, data.municipalityCity || null);
        request.input('province', sql.NVARCHAR, data.province || null);
        request.input('region', sql.NVARCHAR, data.region || null);
        request.input('postalCode', sql.NVARCHAR, data.postalCode || null);
        request.input('country', sql.NVARCHAR, data.country || null);
        request.input('businessPermitNumber', sql.NVARCHAR, data.businessPermitNumber || null);
        request.input('tin', sql.NVARCHAR, data.tin || null);
        request.input('fdaLicenseNumber', sql.NVARCHAR, data.fdaLicenseNumber || null);
        request.input('licenseExpirationDate', sql.DATE, data.licenseExpirationDate || null);
        request.input('vatRegistered', sql.BIT, data.vatRegistered ? 1 : 0);
        request.input('supplierCategory', sql.NVARCHAR, data.supplierCategory || null);
        request.input('modifiedBy', sql.INT, 1);

        const result = await request.query(`
            UPDATE Warehouse_Suppliers
            SET 
                SupplierCode = @supplierCode, SupplierName = @supplierName, BusinessName = @businessName,
                SupplierType = @supplierType, Status = @status, ContactPerson = @contactPerson,
                Position = @position, Email = @email, Telephone = @telephone, MobileNumber = @mobileNumber,
                Website = @website, Street = @street, Barangay = @barangay, MunicipalityCity = @municipalityCity,
                Province = @province, Region = @region, PostalCode = @postalCode, Country = @country,
                BusinessPermitNumber = @businessPermitNumber, TaxIdNumber = @tin, FDALicenseNumber = @fdaLicenseNumber,
                LicenseExpirationDate = @licenseExpirationDate, VATRegistered = @vatRegistered,
                SupplierCategory = @supplierCategory, ModifiedBy = @modifiedBy, ModifiedDate = SYSUTCDATETIME()
            OUTPUT INSERTED.SupplierID as id
            WHERE SupplierID = @id AND IsDeleted = 0
        `);

        if (result.recordset.length === 0) return res.status(404).json({ success: false, message: 'Supplier not found' });
        res.json({ ...data, id });
    } catch (err) {
        console.error('ERROR:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

app.delete('/api/warehouse/suppliers/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await sql.connect(config);
        const request = new sql.Request();
        request.input('id', sql.INT, id);
        request.input('deletedBy', sql.INT, 1);

        await request.query(`
            UPDATE Warehouse_Suppliers
            SET IsDeleted = 1, DeletedBy = @deletedBy, DeletedDate = SYSUTCDATETIME()
            WHERE SupplierID = @id
        `);
        res.json({ success: true, message: 'Supplier deleted successfully' });
    } catch (err) {
        console.error('ERROR:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});


app.get('/api/warehouse/medicines', async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query(`
            SELECT 
                m.MedicineID as id,
                m.MedicineCode as medicineCode,
                m.ProductName as productName,
                m.GenericName as genericName,
                m.BrandName as brandName,
                m.ScientificName as scientificName,
                m.MedicineDescription as medicineDescription,
                m.Dosage as strength,
                m.StrengthUnit as strengthUnit,
                m.Form as dosageForm,
                m.RouteOfAdministration as routeOfAdministration,
                m.Classification as classification,
                m.PrescriptionRequired as prescriptionRequired,
                m.ControlledDrug as controlledDrug,
                m.HighAlertMedication as highAlertMedication,
                m.LASA as lasa,
                m.EssentialMedicine as essentialMedicine,
                m.CategoryID as categoryId,
                c.CategoryName as categoryName,
                m.BaseUnitID as unitId,
                u.UnitName as unitName,
                m.SupplierID as supplierId,
                s.SupplierName as supplierName,
                m.Manufacturer as manufacturer,
                m.CountryOfOrigin as countryOfOrigin,
                m.Barcode as barcode,
                m.QRCode as qrCode,
                m.MedicineImage as medicineImage,
                m.InternalReferenceNumber as internalReferenceNumber,
                m.Status as status,
                m.MinimumStock as minimumStock,
                m.MaximumStock as maximumStock,
                m.ReorderLevel as reorderLevel,
                m.ReorderQuantity as reorderQuantity,
                m.ShelfLifeMonths as shelfLifeMonths,
                m.FEFOEnabled as fefoEnabled,
                m.AllowNegativeStock as allowNegativeStock,
                m.TrackBatchNumbers as trackBatchNumbers,
                m.TrackExpirationDates as trackExpirationDates,
                m.CreatedDate as createdAt,
                usr.Username as createdBy,
                m.ModifiedDate as modifiedAt,
                usrm.Username as modifiedBy,
                m.IsDeleted
            FROM Warehouse_Medicines m
            LEFT JOIN Warehouse_MedicineCategories c ON m.CategoryID = c.CategoryID
            LEFT JOIN Warehouse_MedicineUnits u ON m.BaseUnitID = u.UnitID
            LEFT JOIN Warehouse_Suppliers s ON m.SupplierID = s.SupplierID
            LEFT JOIN Users usr ON m.CreatedBy = usr.UserID
            LEFT JOIN Users usrm ON m.ModifiedBy = usrm.UserID
            WHERE m.IsDeleted = 0
            ORDER BY m.GenericName, m.BrandName
        `);
        
        const medicines = result.recordset.map(r => ({
            ...r,
            id: String(r.id),
            categoryId: r.categoryId ? String(r.categoryId) : undefined,
            unitId: r.unitId ? String(r.unitId) : undefined,
            supplierId: r.supplierId ? String(r.supplierId) : undefined,
            createdBy: r.createdBy || 'System',
            prescriptionRequired: Boolean(r.prescriptionRequired),
            controlledDrug: Boolean(r.controlledDrug),
            highAlertMedication: Boolean(r.highAlertMedication),
            lasa: Boolean(r.lasa),
            essentialMedicine: Boolean(r.essentialMedicine),
            fefoEnabled: Boolean(r.fefoEnabled),
            allowNegativeStock: Boolean(r.allowNegativeStock),
            trackBatchNumbers: Boolean(r.trackBatchNumbers),
            trackExpirationDates: Boolean(r.trackExpirationDates)
        }));
        res.json(medicines);
    } catch (err) {
        console.error('ERROR:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

app.post('/api/warehouse/medicines', async (req, res) => {
    const data = req.body;
    try {
        await sql.connect(config);
        
        const productName = `${data.genericName} ${data.brandName || ''} ${data.strength || ''} ${data.dosageForm || ''}`.trim().replace(/\s+/g, ' ');
        const check = await sql.query(`SELECT * FROM Warehouse_Medicines WHERE ProductName = '${productName.replace(/'/g, "''")}' AND IsDeleted = 0`);
        if (check.recordset.length > 0) {
            return res.status(400).json({ success: false, message: 'This Medicine combination already exists' });
        }

        const request = new sql.Request();
        request.input('productName', sql.NVARCHAR, productName);
        request.input('medicineCode', sql.NVARCHAR, data.medicineCode ? data.medicineCode.toUpperCase() : null);
        request.input('genericName', sql.NVARCHAR, data.genericName);
        request.input('brandName', sql.NVARCHAR, data.brandName || null);
        request.input('scientificName', sql.NVARCHAR, data.scientificName || null);
        request.input('medicineDescription', sql.NVARCHAR, data.medicineDescription || null);
        request.input('strength', sql.NVARCHAR, data.strength || null);
        request.input('strengthUnit', sql.NVARCHAR, data.strengthUnit || null);
        request.input('dosageForm', sql.NVARCHAR, data.dosageForm || null);
        request.input('routeOfAdministration', sql.NVARCHAR, data.routeOfAdministration || null);
        request.input('classification', sql.NVARCHAR, data.classification || null);
        request.input('prescriptionRequired', sql.BIT, data.prescriptionRequired ? 1 : 0);
        request.input('controlledDrug', sql.BIT, data.controlledDrug ? 1 : 0);
        request.input('highAlertMedication', sql.BIT, data.highAlertMedication ? 1 : 0);
        request.input('lasa', sql.BIT, data.lasa ? 1 : 0);
        request.input('essentialMedicine', sql.BIT, data.essentialMedicine ? 1 : 0);
        
        request.input('categoryId', sql.INT, data.categoryId || null);
        request.input('unitId', sql.INT, data.unitId);
        request.input('supplierId', sql.INT, data.supplierId || null);
        
        request.input('manufacturer', sql.NVARCHAR, data.manufacturer || null);
        request.input('countryOfOrigin', sql.NVARCHAR, data.countryOfOrigin || null);
        request.input('barcode', sql.NVARCHAR, data.barcode || null);
        request.input('qrCode', sql.NVARCHAR, data.qrCode || null);
        request.input('internalReferenceNumber', sql.NVARCHAR, data.internalReferenceNumber || null);
        request.input('status', sql.NVARCHAR, data.status || 'Active');
        
        request.input('minimumStock', sql.INT, data.minimumStock || 0);
        request.input('maximumStock', sql.INT, data.maximumStock || null);
        request.input('reorderLevel', sql.INT, data.reorderLevel || 0);
        request.input('reorderQuantity', sql.INT, data.reorderQuantity || null);
        request.input('shelfLifeMonths', sql.INT, data.shelfLifeMonths || null);
        request.input('fefoEnabled', sql.BIT, data.fefoEnabled ? 1 : 0);
        request.input('allowNegativeStock', sql.BIT, data.allowNegativeStock ? 1 : 0);
        request.input('trackBatchNumbers', sql.BIT, data.trackBatchNumbers ? 1 : 0);
        request.input('trackExpirationDates', sql.BIT, data.trackExpirationDates ? 1 : 0);
        
        request.input('createdBy', sql.INT, 1);

        const result = await request.query(`
            INSERT INTO Warehouse_Medicines (
                ProductName, MedicineCode, GenericName, BrandName, ScientificName, MedicineDescription,
                Dosage, StrengthUnit, Form, RouteOfAdministration, Classification,
                PrescriptionRequired, ControlledDrug, HighAlertMedication, LASA, EssentialMedicine,
                CategoryID, BaseUnitID, SupplierID, Manufacturer, CountryOfOrigin,
                Barcode, QRCode, InternalReferenceNumber, Status,
                MinimumStock, MaximumStock, ReorderLevel, ReorderQuantity, ShelfLifeMonths,
                FEFOEnabled, AllowNegativeStock, TrackBatchNumbers, TrackExpirationDates,
                CreatedBy, CreatedDate
            )
            OUTPUT INSERTED.MedicineID as id
            VALUES (
                @productName, @medicineCode, @genericName, @brandName, @scientificName, @medicineDescription,
                @strength, @strengthUnit, @dosageForm, @routeOfAdministration, @classification,
                @prescriptionRequired, @controlledDrug, @highAlertMedication, @lasa, @essentialMedicine,
                @categoryId, @unitId, @supplierId, @manufacturer, @countryOfOrigin,
                @barcode, @qrCode, @internalReferenceNumber, @status,
                @minimumStock, @maximumStock, @reorderLevel, @reorderQuantity, @shelfLifeMonths,
                @fefoEnabled, @allowNegativeStock, @trackBatchNumbers, @trackExpirationDates,
                @createdBy, SYSUTCDATETIME()
            )
        `);
        
        const newRecord = result.recordset[0];
        res.json({ ...data, id: String(newRecord.id), productName, createdBy: 'System' });
    } catch (err) {
        console.error('ERROR:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

app.put('/api/warehouse/medicines/:id', async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    try {
        await sql.connect(config);
        
        const productName = `${data.genericName} ${data.brandName || ''} ${data.strength || ''} ${data.dosageForm || ''}`.trim().replace(/\s+/g, ' ');
        const check = await sql.query(`SELECT * FROM Warehouse_Medicines WHERE ProductName = '${productName.replace(/'/g, "''")}' AND MedicineID != ${id} AND IsDeleted = 0`);
        if (check.recordset.length > 0) {
            return res.status(400).json({ success: false, message: 'This Medicine combination already exists' });
        }

        const request = new sql.Request();
        request.input('id', sql.INT, id);
        request.input('productName', sql.NVARCHAR, productName);
        request.input('medicineCode', sql.NVARCHAR, data.medicineCode ? data.medicineCode.toUpperCase() : null);
        request.input('genericName', sql.NVARCHAR, data.genericName);
        request.input('brandName', sql.NVARCHAR, data.brandName || null);
        request.input('scientificName', sql.NVARCHAR, data.scientificName || null);
        request.input('medicineDescription', sql.NVARCHAR, data.medicineDescription || null);
        request.input('strength', sql.NVARCHAR, data.strength || null);
        request.input('strengthUnit', sql.NVARCHAR, data.strengthUnit || null);
        request.input('dosageForm', sql.NVARCHAR, data.dosageForm || null);
        request.input('routeOfAdministration', sql.NVARCHAR, data.routeOfAdministration || null);
        request.input('classification', sql.NVARCHAR, data.classification || null);
        request.input('prescriptionRequired', sql.BIT, data.prescriptionRequired ? 1 : 0);
        request.input('controlledDrug', sql.BIT, data.controlledDrug ? 1 : 0);
        request.input('highAlertMedication', sql.BIT, data.highAlertMedication ? 1 : 0);
        request.input('lasa', sql.BIT, data.lasa ? 1 : 0);
        request.input('essentialMedicine', sql.BIT, data.essentialMedicine ? 1 : 0);
        
        request.input('categoryId', sql.INT, data.categoryId || null);
        request.input('unitId', sql.INT, data.unitId);
        request.input('supplierId', sql.INT, data.supplierId || null);
        
        request.input('manufacturer', sql.NVARCHAR, data.manufacturer || null);
        request.input('countryOfOrigin', sql.NVARCHAR, data.countryOfOrigin || null);
        request.input('barcode', sql.NVARCHAR, data.barcode || null);
        request.input('qrCode', sql.NVARCHAR, data.qrCode || null);
        request.input('internalReferenceNumber', sql.NVARCHAR, data.internalReferenceNumber || null);
        request.input('status', sql.NVARCHAR, data.status || 'Active');
        
        request.input('minimumStock', sql.INT, data.minimumStock || 0);
        request.input('maximumStock', sql.INT, data.maximumStock || null);
        request.input('reorderLevel', sql.INT, data.reorderLevel || 0);
        request.input('reorderQuantity', sql.INT, data.reorderQuantity || null);
        request.input('shelfLifeMonths', sql.INT, data.shelfLifeMonths || null);
        request.input('fefoEnabled', sql.BIT, data.fefoEnabled ? 1 : 0);
        request.input('allowNegativeStock', sql.BIT, data.allowNegativeStock ? 1 : 0);
        request.input('trackBatchNumbers', sql.BIT, data.trackBatchNumbers ? 1 : 0);
        request.input('trackExpirationDates', sql.BIT, data.trackExpirationDates ? 1 : 0);
        
        request.input('modifiedBy', sql.INT, 1);

        const result = await request.query(`
            UPDATE Warehouse_Medicines
            SET 
                ProductName = @productName, MedicineCode = @medicineCode, GenericName = @genericName,
                BrandName = @brandName, ScientificName = @scientificName, MedicineDescription = @medicineDescription,
                Dosage = @strength, StrengthUnit = @strengthUnit, Form = @dosageForm,
                RouteOfAdministration = @routeOfAdministration, Classification = @classification,
                PrescriptionRequired = @prescriptionRequired, ControlledDrug = @controlledDrug,
                HighAlertMedication = @highAlertMedication, LASA = @lasa, EssentialMedicine = @essentialMedicine,
                CategoryID = @categoryId, BaseUnitID = @unitId, SupplierID = @supplierId,
                Manufacturer = @manufacturer, CountryOfOrigin = @countryOfOrigin,
                Barcode = @barcode, QRCode = @qrCode, InternalReferenceNumber = @internalReferenceNumber, Status = @status,
                MinimumStock = @minimumStock, MaximumStock = @maximumStock, ReorderLevel = @reorderLevel,
                ReorderQuantity = @reorderQuantity, ShelfLifeMonths = @shelfLifeMonths,
                FEFOEnabled = @fefoEnabled, AllowNegativeStock = @allowNegativeStock,
                TrackBatchNumbers = @trackBatchNumbers, TrackExpirationDates = @trackExpirationDates,
                ModifiedBy = @modifiedBy, ModifiedDate = SYSUTCDATETIME()
            OUTPUT INSERTED.MedicineID as id
            WHERE MedicineID = @id AND IsDeleted = 0
        `);

        if (result.recordset.length === 0) return res.status(404).json({ success: false, message: 'Medicine not found' });
        res.json({ ...data, id, productName });
    } catch (err) {
        console.error('ERROR:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

app.delete('/api/warehouse/medicines/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await sql.connect(config);
        const request = new sql.Request();
        request.input('id', sql.INT, id);
        request.input('deletedBy', sql.INT, 1);

        await request.query(`
            UPDATE Warehouse_Medicines
            SET IsDeleted = 1, DeletedBy = @deletedBy, DeletedDate = SYSUTCDATETIME()
            WHERE MedicineID = @id
        `);
        res.json({ success: true, message: 'Medicine deleted successfully' });
    } catch (err) {
        console.error('ERROR:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});


app.get('/api/warehouse/delivery-receipts', async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query(`
            SELECT 
                dr.DeliveryReceiptID as id,
                dr.ReferenceNumber as referenceNumber,
                dr.SupplierID as supplierId,
                s.SupplierName as supplierName,
                dr.PurchaseOrderNumber as purchaseOrderNumber,
                dr.InvoiceNumber as invoiceNumber,
                dr.DeliveryDate as deliveryDate,
                dr.Status as status,
                dr.Remarks as remarks,
                dr.CreatedDate as createdAt,
                dr.ReceivedDate as receivedDate,
                usr.Username as createdBy,
                (SELECT COUNT(*) FROM Warehouse_DeliveryReceiptItems WHERE DeliveryReceiptID = dr.DeliveryReceiptID AND IsDeleted = 0) as itemCount,
                (SELECT SUM(QuantityReceived * UnitCost) FROM Warehouse_DeliveryReceiptItems WHERE DeliveryReceiptID = dr.DeliveryReceiptID AND IsDeleted = 0) as grandTotal
            FROM Warehouse_DeliveryReceipts dr
            LEFT JOIN Warehouse_Suppliers s ON dr.SupplierID = s.SupplierID
            LEFT JOIN Users usr ON dr.CreatedBy = usr.UserID
            WHERE dr.IsDeleted = 0
            ORDER BY dr.DeliveryDate DESC, dr.CreatedDate DESC
        `);
        
        const itemsAllRes = await sql.query(`
            SELECT 
                i.DeliveryReceiptID as deliveryReceiptId,
                i.DeliveryReceiptItemID as itemId,
                i.MedicineID as medicineId,
                m.ProductName as medicineName,
                m.TrackBatchNumbers as trackBatchNumbers,
                m.TrackExpirationDates as trackExpirationDates,
                m.FEFOEnabled as fefoEnabled,
                i.BatchNumber as batchNumber,
                i.LotNumber as lotNumber,
                i.ExpiryDate as expiryDate,
                i.UnitCost as unitCost,
                i.QuantityReceived as quantityReceived
            FROM Warehouse_DeliveryReceiptItems i
            LEFT JOIN Warehouse_Medicines m ON i.MedicineID = m.MedicineID
            WHERE i.IsDeleted = 0
        `);

        const itemsByDrId = {};
        for (const item of itemsAllRes.recordset) {
            const key = String(item.deliveryReceiptId);
            if (!itemsByDrId[key]) itemsByDrId[key] = [];
            const expStr = item.expiryDate ? new Date(item.expiryDate).toISOString().split('T')[0] : '';
            itemsByDrId[key].push({
                ...item,
                itemId: String(item.itemId),
                medicineId: String(item.medicineId),
                batchNumber: item.batchNumber || '',
                lotNumber: item.lotNumber || '',
                expiryDate: expStr && expStr !== '2099-12-31' ? expStr : ''
            });
        }

        const receipts = result.recordset.map(r => ({
            ...r,
            id: String(r.id),
            supplierId: String(r.supplierId),
            purchaseOrderNumber: r.purchaseOrderNumber || '',
            invoiceNumber: r.invoiceNumber || '',
            remarks: r.remarks || '',
            deliveryDate: r.deliveryDate ? new Date(r.deliveryDate).toISOString().split('T')[0] : '',
            createdBy: r.createdBy || 'System',
            items: itemsByDrId[String(r.id)] || []
        }));
        res.json(receipts);
    } catch (err) {
        console.error('ERROR:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

app.get('/api/warehouse/delivery-receipts/:id', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const { id } = req.params;
        const hdrReq = pool.request();
        hdrReq.input('id', sql.BigInt, id);
        const result = await hdrReq.query(`
            SELECT 
                dr.DeliveryReceiptID as id,
                dr.ReferenceNumber as referenceNumber,
                dr.SupplierID as supplierId,
                s.SupplierName as supplierName,
                dr.PurchaseOrderNumber as purchaseOrderNumber,
                dr.InvoiceNumber as invoiceNumber,
                dr.DeliveryDate as deliveryDate,
                dr.Status as status,
                dr.Remarks as remarks
            FROM Warehouse_DeliveryReceipts dr
            LEFT JOIN Warehouse_Suppliers s ON dr.SupplierID = s.SupplierID
            WHERE dr.DeliveryReceiptID = @id AND dr.IsDeleted = 0
        `);
        
        if (result.recordset.length === 0) return res.status(404).json({ success: false, message: 'Not found' });
        
        const dr = result.recordset[0];
        
        const itmReq = pool.request();
        itmReq.input('id', sql.BigInt, id);
        const itemsResult = await itmReq.query(`
            SELECT 
                i.DeliveryReceiptItemID as itemId,
                i.MedicineID as medicineId,
                m.ProductName as medicineName,
                m.TrackBatchNumbers as trackBatchNumbers,
                m.TrackExpirationDates as trackExpirationDates,
                m.FEFOEnabled as fefoEnabled,
                i.BatchNumber as batchNumber,
                i.LotNumber as lotNumber,
                i.ExpiryDate as expiryDate,
                i.UnitCost as unitCost,
                i.QuantityReceived as quantityReceived
            FROM Warehouse_DeliveryReceiptItems i
            LEFT JOIN Warehouse_Medicines m ON i.MedicineID = m.MedicineID
            WHERE i.DeliveryReceiptID = @id AND i.IsDeleted = 0
        `);
        
        dr.items = itemsResult.recordset.map(i => {
            const expStr = i.expiryDate ? new Date(i.expiryDate).toISOString().split('T')[0] : '';
            return {
                ...i,
                itemId: String(i.itemId),
                medicineId: String(i.medicineId),
                batchNumber: i.batchNumber || '',
                lotNumber: i.lotNumber || '',
                expiryDate: expStr && expStr !== '2099-12-31' ? expStr : '',
            };
        });
        
        res.json({
            ...dr,
            id: String(dr.id),
            supplierId: String(dr.supplierId),
            purchaseOrderNumber: dr.purchaseOrderNumber || '',
            invoiceNumber: dr.invoiceNumber || '',
            remarks: dr.remarks || '',
            deliveryDate: dr.deliveryDate ? new Date(dr.deliveryDate).toISOString().split('T')[0] : '',
        });
    } catch (err) {
        console.error('ERROR:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

app.post('/api/warehouse/delivery-receipts', async (req, res) => {
    const data = req.body;
    let transaction;
    try {
        const pool = await sql.connect(config);
        transaction = new sql.Transaction(pool);
        await transaction.begin();
        
        const request = new sql.Request(transaction);
        request.input('supplierId', sql.INT, data.supplierId);
        request.input('purchaseOrderNumber', sql.NVARCHAR, data.purchaseOrderNumber || null);
        request.input('invoiceNumber', sql.NVARCHAR, data.invoiceNumber || null);
        
        // Initial creation is Draft unless explicitly posted
        const initialStatus = data.status === 'Received' ? 'Received' : 'Draft';
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);

        request.input('receivingLocationId', sql.INT, 1); // Main Warehouse
        request.input('deliveryDate', sql.DATE, data.deliveryDate ? String(data.deliveryDate).slice(0, 10) : todayStr);
        request.input('status', sql.NVARCHAR, initialStatus);
        request.input('remarks', sql.NVARCHAR, data.remarks || null);
        request.input('createdBy', sql.INT, 1);
        request.input('receivedBy', sql.INT, initialStatus === 'Received' ? 1 : null);

        // Lock table to prevent concurrent duplicate submissions & reference number collisions
        const dupCheckRes = await request.query(`
            SELECT TOP 1 DeliveryReceiptID as id, ReferenceNumber as referenceNumber
            FROM Warehouse_DeliveryReceipts WITH (UPDLOCK, HOLDLOCK)
            WHERE SupplierID = @supplierId
              AND DeliveryDate = @deliveryDate
              AND Status = @status
              AND ISNULL(InvoiceNumber, '') = ISNULL(@invoiceNumber, '')
              AND ISNULL(PurchaseOrderNumber, '') = ISNULL(@purchaseOrderNumber, '')
              AND IsDeleted = 0
              AND DATEDIFF(SECOND, CreatedDate, SYSUTCDATETIME()) <= 30
            ORDER BY DeliveryReceiptID DESC
        `);
        if (dupCheckRes.recordset.length > 0) {
            await transaction.commit();
            const existing = dupCheckRes.recordset[0];
            return res.json({ ...data, id: String(existing.id), referenceNumber: existing.referenceNumber, createdBy: 'System', deduplicated: true });
        }

        // Generate Reference Number safely using MAX(DeliveryReceiptID) + COUNT(*)
        const countRes = await request.query(`
            SELECT ISNULL(MAX(DeliveryReceiptID), 0) as maxId, COUNT(*) as cnt
            FROM Warehouse_DeliveryReceipts WITH (UPDLOCK, HOLDLOCK)
        `);
        const nextSeq = Math.max(Number(countRes.recordset[0].maxId || 0), Number(countRes.recordset[0].cnt || 0)) + 1;
        const refNum = 'DR-' + new Date().getFullYear() + '-' + String(nextSeq).padStart(5, '0');
        request.input('referenceNumber', sql.NVARCHAR, refNum);

        const drResult = await request.query(`
            INSERT INTO Warehouse_DeliveryReceipts (
                SupplierID, PurchaseOrderNumber, InvoiceNumber, ReferenceNumber,
                ReceivingLocationID, DeliveryDate, Status, Remarks, CreatedBy, CreatedDate,
                ReceivedBy, ReceivedDate
            )
            OUTPUT INSERTED.DeliveryReceiptID as id
            VALUES (
                @supplierId, @purchaseOrderNumber, @invoiceNumber, @referenceNumber,
                @receivingLocationId, @deliveryDate, @status, @remarks, @createdBy, SYSUTCDATETIME(),
                @receivedBy, ${initialStatus === 'Received' ? 'SYSUTCDATETIME()' : 'NULL'}
            )
        `);
        
        const drId = drResult.recordset[0].id;
        
        if (data.items && data.items.length > 0) {
            for (const item of data.items) {
                if (Number(item.quantityReceived) <= 0) {
                    throw new Error("Quantity received must be greater than zero.");
                }

                // Medicine validation
                const medReq = new sql.Request(transaction);
                medReq.input('medId', sql.INT, item.medicineId);
                const medRes = await medReq.query('SELECT TrackBatchNumbers, TrackExpirationDates, Status FROM Warehouse_Medicines WHERE MedicineID = @medId');
                if (medRes.recordset.length === 0) {
                    throw new Error(`Medicine ID ${item.medicineId} does not exist.`);
                }
                const medConfig = medRes.recordset[0];
                if (medConfig.TrackBatchNumbers && (!item.batchNumber || item.batchNumber.trim() === '')) {
                    throw new Error(`Batch/Lot Number is mandatory for this medicine.`);
                }
                const normalizedExpiry = item.expiryDate ? String(item.expiryDate).slice(0, 10) : '';
                if (medConfig.TrackExpirationDates) {
                    if (!normalizedExpiry) {
                        throw new Error(`Expiration Date is mandatory for this medicine.`);
                    }
                    if (normalizedExpiry < todayStr) {
                        throw new Error(`Cannot receive already expired stock (Expiry: ${normalizedExpiry}).`);
                    }
                }

                const itemReq = new sql.Request(transaction);
                itemReq.input('drId', sql.BIGINT, drId);
                itemReq.input('medicineId', sql.INT, item.medicineId);
                itemReq.input('batchNumber', sql.NVARCHAR, item.batchNumber || null);
                itemReq.input('lotNumber', sql.NVARCHAR, item.batchNumber || item.lotNumber || 'N/A');
                itemReq.input('expiryDate', sql.DATE, normalizedExpiry || '2099-12-31');
                itemReq.input('unitCost', sql.DECIMAL(18,4), item.unitCost || 0);
                itemReq.input('quantityReceived', sql.INT, item.quantityReceived);
                itemReq.input('createdBy', sql.INT, 1);
                
                const itemInsert = await itemReq.query(`
                    INSERT INTO Warehouse_DeliveryReceiptItems (
                        DeliveryReceiptID, MedicineID, BatchNumber, LotNumber, ExpiryDate,
                        UnitCost, QuantityReceived, QuantityAccepted, QuantityRejected,
                        CreatedBy, CreatedDate
                    )
                    OUTPUT INSERTED.DeliveryReceiptItemID as drItemId
                    VALUES (
                        @drId, @medicineId, @batchNumber, @lotNumber, @expiryDate,
                        @unitCost, @quantityReceived, @quantityReceived, 0,
                        @createdBy, SYSUTCDATETIME()
                    )
                `);

                // If posted as Received directly, create inventory batch & ledger entry
                if (initialStatus === 'Received') {
                    const drItemId = itemInsert.recordset[0].drItemId;
                    const invReq = new sql.Request(transaction);
                    invReq.input('locationId', sql.INT, 1);
                    invReq.input('medicineId', sql.INT, item.medicineId);
                    invReq.input('sourceDrItemId', sql.BIGINT, drItemId);
                    invReq.input('batchNumber', sql.NVARCHAR, item.batchNumber || null);
                    invReq.input('lotNumber', sql.NVARCHAR, item.batchNumber || item.lotNumber || 'N/A');
                    invReq.input('expiryDate', sql.DATE, normalizedExpiry || '2099-12-31');
                    invReq.input('unitCost', sql.DECIMAL(18,4), item.unitCost || 0);
                    invReq.input('qty', sql.INT, item.quantityReceived);
                    invReq.input('createdBy', sql.INT, 1);
                    
                    const invInsert = await invReq.query(`
                        INSERT INTO Warehouse_Inventory (
                            LocationID, MedicineID, SourceDeliveryReceiptItemID,
                            BatchNumber, LotNumber, ExpiryDate, UnitCost,
                            QuantityReceived, QuantityAvailable, Status,
                            CreatedBy, CreatedDate
                        )
                        OUTPUT INSERTED.InventoryID as invId
                        VALUES (
                            @locationId, @medicineId, @sourceDrItemId,
                            @batchNumber, @lotNumber, @expiryDate, @unitCost,
                            @qty, @qty, 'Active',
                            @createdBy, SYSUTCDATETIME()
                        )
                    `);
                    const invId = invInsert.recordset[0].invId;

                    // Transaction Log
                    const txReq = new sql.Request(transaction);
                    txReq.input('invId', sql.BIGINT, invId);
                    txReq.input('locationId', sql.INT, 1);
                    txReq.input('medicineId', sql.INT, item.medicineId);
                    txReq.input('refId', sql.BIGINT, drId);
                    txReq.input('qty', sql.INT, item.quantityReceived);
                    txReq.input('unitCost', sql.DECIMAL(18,4), item.unitCost || 0);
                    txReq.input('totalCost', sql.DECIMAL(18,4), (item.unitCost || 0) * item.quantityReceived);
                    txReq.input('createdBy', sql.INT, 1);
                    
                    await txReq.query(`
                        INSERT INTO Warehouse_InventoryTransactions (
                            InventoryID, LocationID, MedicineID, TransactionType, ReferenceDocument, ReferenceID,
                            Quantity, UnitCost, TotalCost, CreatedBy, CreatedDate
                        ) VALUES (
                            @invId, @locationId, @medicineId, 'RECEIVING', 'DR', @refId,
                            @qty, @unitCost, @totalCost, @createdBy, SYSUTCDATETIME()
                        )
                    `);
                }
            }
        }
        
        await transaction.commit();
        res.json({ ...data, id: String(drId), referenceNumber: refNum, createdBy: 'System' });
    } catch (err) {
        if (transaction) await transaction.rollback();
        console.error('ERROR:', err);
        res.status(500).json({ success: false, message: err.message || 'Database error' });
    }
});

app.put('/api/warehouse/delivery-receipts/:id', async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    let transaction;
    try {
        const pool = await sql.connect(config);
        
        // Idempotency: Lock header row
        transaction = new sql.Transaction(pool);
        await transaction.begin();

        const checkReq = new sql.Request(transaction);
        checkReq.input('id', sql.BIGINT, id);
        const drCheck = await checkReq.query(`
            SELECT Status FROM Warehouse_DeliveryReceipts WITH (UPDLOCK, HOLDLOCK)
            WHERE DeliveryReceiptID = @id AND IsDeleted = 0
        `);
        if (drCheck.recordset.length === 0) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'DR not found' });
        }
        if (drCheck.recordset[0].Status === 'Received') {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Cannot edit or re-post a received document.' });
        }

        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);
        const isReceiving = data.status === 'Received';
        
        const request = new sql.Request(transaction);
        request.input('id', sql.BIGINT, id);
        request.input('supplierId', sql.INT, data.supplierId);
        request.input('purchaseOrderNumber', sql.NVARCHAR, data.purchaseOrderNumber || null);
        request.input('invoiceNumber', sql.NVARCHAR, data.invoiceNumber || null);
        request.input('deliveryDate', sql.DATE, data.deliveryDate ? String(data.deliveryDate).slice(0, 10) : todayStr);
        request.input('status', sql.NVARCHAR, data.status);
        request.input('remarks', sql.NVARCHAR, data.remarks || null);
        request.input('modifiedBy', sql.INT, 1);
        request.input('receivedBy', sql.INT, isReceiving ? 1 : null);

        await request.query(`
            UPDATE Warehouse_DeliveryReceipts
            SET 
                SupplierID = @supplierId, PurchaseOrderNumber = @purchaseOrderNumber, 
                InvoiceNumber = @invoiceNumber, DeliveryDate = @deliveryDate, 
                Status = @status, Remarks = @remarks, ModifiedBy = @modifiedBy, ModifiedDate = SYSUTCDATETIME(),
                ReceivedBy = CASE WHEN @status = 'Received' THEN @receivedBy ELSE ReceivedBy END,
                ReceivedDate = CASE WHEN @status = 'Received' THEN SYSUTCDATETIME() ELSE ReceivedDate END
            WHERE DeliveryReceiptID = @id
        `);
        
        // Replace items
        await request.query(`DELETE FROM Warehouse_DeliveryReceiptItems WHERE DeliveryReceiptID = @id`);
        
        if (data.items && data.items.length > 0) {
            for (const item of data.items) {
                if (Number(item.quantityReceived) <= 0) {
                    throw new Error("Quantity received must be greater than zero.");
                }

                // Medicine validation
                const medReq = new sql.Request(transaction);
                medReq.input('medId', sql.INT, item.medicineId);
                const medRes = await medReq.query('SELECT TrackBatchNumbers, TrackExpirationDates, Status FROM Warehouse_Medicines WHERE MedicineID = @medId');
                if (medRes.recordset.length === 0) {
                    throw new Error(`Medicine ID ${item.medicineId} does not exist.`);
                }
                const medConfig = medRes.recordset[0];
                if (medConfig.TrackBatchNumbers && (!item.batchNumber || item.batchNumber.trim() === '')) {
                    throw new Error(`Batch/Lot Number is mandatory for this medicine.`);
                }
                const normalizedExpiry = item.expiryDate ? String(item.expiryDate).slice(0, 10) : '';
                if (medConfig.TrackExpirationDates) {
                    if (!normalizedExpiry) {
                        throw new Error(`Expiration Date is mandatory for this medicine.`);
                    }
                    if (normalizedExpiry < todayStr) {
                        throw new Error(`Cannot receive already expired stock (Expiry: ${normalizedExpiry}).`);
                    }
                }

                const itemReq = new sql.Request(transaction);
                itemReq.input('drId', sql.BIGINT, id);
                itemReq.input('medicineId', sql.INT, item.medicineId);
                itemReq.input('batchNumber', sql.NVARCHAR, item.batchNumber || null);
                itemReq.input('lotNumber', sql.NVARCHAR, item.batchNumber || item.lotNumber || 'N/A');
                itemReq.input('expiryDate', sql.DATE, normalizedExpiry || '2099-12-31');
                itemReq.input('unitCost', sql.DECIMAL(18,4), item.unitCost || 0);
                itemReq.input('quantityReceived', sql.INT, item.quantityReceived);
                itemReq.input('createdBy', sql.INT, 1);
                
                const itemInsert = await itemReq.query(`
                    INSERT INTO Warehouse_DeliveryReceiptItems (
                        DeliveryReceiptID, MedicineID, BatchNumber, LotNumber, ExpiryDate,
                        UnitCost, QuantityReceived, QuantityAccepted, QuantityRejected,
                        CreatedBy, CreatedDate
                    )
                    OUTPUT INSERTED.DeliveryReceiptItemID as drItemId
                    VALUES (
                        @drId, @medicineId, @batchNumber, @lotNumber, @expiryDate,
                        @unitCost, @quantityReceived, @quantityReceived, 0,
                        @createdBy, SYSUTCDATETIME()
                    )
                `);
                
                // POSTING LOGIC - If status is Received, push to inventory!
                if (isReceiving) {
                    const drItemId = itemInsert.recordset[0].drItemId;
                    const invReq = new sql.Request(transaction);
                    invReq.input('locationId', sql.INT, 1);
                    invReq.input('medicineId', sql.INT, item.medicineId);
                    invReq.input('sourceDrItemId', sql.BIGINT, drItemId);
                    invReq.input('batchNumber', sql.NVARCHAR, item.batchNumber || null);
                    invReq.input('lotNumber', sql.NVARCHAR, item.batchNumber || item.lotNumber || 'N/A');
                    invReq.input('expiryDate', sql.DATE, normalizedExpiry || '2099-12-31');
                    invReq.input('unitCost', sql.DECIMAL(18,4), item.unitCost || 0);
                    invReq.input('qty', sql.INT, item.quantityReceived);
                    invReq.input('createdBy', sql.INT, 1);
                    
                    const invInsert = await invReq.query(`
                        INSERT INTO Warehouse_Inventory (
                            LocationID, MedicineID, SourceDeliveryReceiptItemID,
                            BatchNumber, LotNumber, ExpiryDate, UnitCost,
                            QuantityReceived, QuantityAvailable, Status,
                            CreatedBy, CreatedDate
                        )
                        OUTPUT INSERTED.InventoryID as invId
                        VALUES (
                            @locationId, @medicineId, @sourceDrItemId,
                            @batchNumber, @lotNumber, @expiryDate, @unitCost,
                            @qty, @qty, 'Active',
                            @createdBy, SYSUTCDATETIME()
                        )
                    `);
                    
                    const invId = invInsert.recordset[0].invId;
                    
                    // Transaction Log
                    const txReq = new sql.Request(transaction);
                    txReq.input('invId', sql.BIGINT, invId);
                    txReq.input('locationId', sql.INT, 1);
                    txReq.input('medicineId', sql.INT, item.medicineId);
                    txReq.input('refId', sql.BIGINT, id);
                    txReq.input('qty', sql.INT, item.quantityReceived);
                    txReq.input('unitCost', sql.DECIMAL(18,4), item.unitCost || 0);
                    txReq.input('totalCost', sql.DECIMAL(18,4), (item.unitCost || 0) * item.quantityReceived);
                    txReq.input('createdBy', sql.INT, 1);
                    
                    await txReq.query(`
                        INSERT INTO Warehouse_InventoryTransactions (
                            InventoryID, LocationID, MedicineID, TransactionType, ReferenceDocument, ReferenceID,
                            Quantity, UnitCost, TotalCost, CreatedBy, CreatedDate
                        ) VALUES (
                            @invId, @locationId, @medicineId, 'RECEIVING', 'DR', @refId,
                            @qty, @unitCost, @totalCost, @createdBy, SYSUTCDATETIME()
                        )
                    `);
                }
            }
        }
        
        await transaction.commit();
        res.json({ success: true, message: isReceiving ? 'Delivery Receipt posted and inventory updated.' : 'Delivery Receipt updated.' });
    } catch (err) {
        if (transaction) await transaction.rollback();
        console.error('ERROR:', err);
        res.status(500).json({ success: false, message: err.message || 'Database error' });
    }
});

app.delete('/api/warehouse/delivery-receipts/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await sql.connect(config);
        
        const checkReq = new sql.Request();
        const drCheck = await checkReq.query(`SELECT Status FROM Warehouse_DeliveryReceipts WHERE DeliveryReceiptID = ${id}`);
        if (drCheck.recordset.length > 0 && drCheck.recordset[0].Status === 'Received') {
            return res.status(400).json({ success: false, message: 'Cannot delete a received document.' });
        }
        
        const request = new sql.Request();
        request.input('id', sql.BIGINT, id);
        request.input('deletedBy', sql.INT, 1);

        await request.query(`
            UPDATE Warehouse_DeliveryReceipts
            SET IsDeleted = 1, DeletedBy = @deletedBy, DeletedDate = SYSUTCDATETIME(), Status = 'Void'
            WHERE DeliveryReceiptID = @id
        `);
        res.json({ success: true, message: 'DR deleted successfully' });
    } catch (err) {
        console.error('ERROR:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});


app.get('/api/warehouse/inventory', async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query(`
            SELECT 
                i.InventoryID as id,
                i.LocationID as locationId,
                l.LocationName as locationName,
                i.MedicineID as medicineId,
                m.ProductName as medicineName,
                m.GenericName as genericName,
                m.BrandName as brandName,
                m.MedicineCode as medicineCode,
                c.CategoryName as categoryName,
                i.SourceDeliveryReceiptItemID as sourceDrItemId,
                dr.ReferenceNumber as drNumber,
                dr.SupplierID as supplierId,
                s.SupplierName as supplierName,
                i.BatchNumber as batchNumber,
                i.LotNumber as lotNumber,
                i.ExpiryDate as expiryDate,
                i.UnitCost as unitCost,
                i.QuantityReceived as quantityReceived,
                i.QuantityAvailable as quantityAvailable,
                i.ReservedQuantity as reservedQuantity,
                i.Status as status,
                DATEDIFF(day, SYSUTCDATETIME(), i.ExpiryDate) as daysUntilExpiry,
                i.CreatedDate as createdAt
            FROM Warehouse_Inventory i
            LEFT JOIN Warehouse_Locations l ON i.LocationID = l.LocationID
            LEFT JOIN Warehouse_Medicines m ON i.MedicineID = m.MedicineID
            LEFT JOIN Warehouse_MedicineCategories c ON m.CategoryID = c.CategoryID
            LEFT JOIN Warehouse_DeliveryReceiptItems dri ON i.SourceDeliveryReceiptItemID = dri.DeliveryReceiptItemID
            LEFT JOIN Warehouse_DeliveryReceipts dr ON dri.DeliveryReceiptID = dr.DeliveryReceiptID
            LEFT JOIN Warehouse_Suppliers s ON dr.SupplierID = s.SupplierID
            WHERE i.IsDeleted = 0
            ORDER BY m.ProductName, i.ExpiryDate
        `);
        
        const inventory = result.recordset.map(r => {
            let expiryStatus = 'Healthy';
            if (r.daysUntilExpiry <= 0) expiryStatus = 'Expired';
            else if (r.daysUntilExpiry <= 7) expiryStatus = 'Expires in 7 Days';
            else if (r.daysUntilExpiry <= 30) expiryStatus = 'Expires in 30 Days';
            else if (r.daysUntilExpiry <= 90) expiryStatus = 'Expires in 90 Days';

            return {
                ...r,
                id: String(r.id),
                locationId: String(r.locationId),
                medicineId: String(r.medicineId),
                supplierId: r.supplierId ? String(r.supplierId) : undefined,
                expiryStatus,
                totalValue: r.quantityAvailable * r.unitCost
            };
        });
        res.json(inventory);
    } catch (err) {
        console.error('ERROR:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

app.get('/api/warehouse/inventory/kpis', async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query(`
            SELECT 
                COUNT(DISTINCT MedicineID) as totalMedicines,
                COUNT(InventoryID) as totalBatches,
                SUM(QuantityAvailable) as totalQuantityOnHand,
                SUM(QuantityAvailable * UnitCost) as totalInventoryValue,
                SUM(CASE WHEN QuantityAvailable <= 100 AND QuantityAvailable > 0 THEN 1 ELSE 0 END) as lowStockBatches,
                SUM(CASE WHEN QuantityAvailable = 0 THEN 1 ELSE 0 END) as outOfStockBatches,
                SUM(CASE WHEN DATEDIFF(day, SYSUTCDATETIME(), ExpiryDate) <= 30 AND DATEDIFF(day, SYSUTCDATETIME(), ExpiryDate) > 0 THEN 1 ELSE 0 END) as expiringSoonBatches,
                SUM(CASE WHEN DATEDIFF(day, SYSUTCDATETIME(), ExpiryDate) <= 0 THEN 1 ELSE 0 END) as expiredBatches
            FROM Warehouse_Inventory
            WHERE IsDeleted = 0
        `);
        
        res.json(result.recordset[0]);
    } catch (err) {
        console.error('ERROR:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

app.get('/api/warehouse/inventory/:id/transactions', async (req, res) => {
    try {
        await sql.connect(config);
        const { id } = req.params;
        const result = await sql.query(`
            SELECT 
                TransactionID as id,
                TransactionID,
                TransactionType as type,
                TransactionType,
                ReferenceDocument as referenceDocument,
                ReferenceDocument,
                Quantity as quantity,
                Quantity,
                UnitCost as unitCost,
                UnitCost,
                TotalCost as totalCost,
                TotalCost,
                CreatedDate as createdAt,
                CreatedDate,
                usr.Username as createdBy
            FROM Warehouse_InventoryTransactions t
            LEFT JOIN Users usr ON t.CreatedBy = usr.UserID
            WHERE InventoryID = ${id}
            ORDER BY CreatedDate DESC
        `);
        
        res.json(result.recordset);
    } catch (err) {
        console.error('ERROR:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

const PORT = process.env.PORT || 5000;





// ==========================================
// WAREHOUSE: LIVE NOTIFICATIONS
// ==========================================
app.get('/api/warehouse/notifications', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const notifications = [];

        // 1. Stock Requests (From Pharmacy/Facilities)
        const srRes = await pool.request().query(`
            SELECT TOP 5
                'sr-' + CAST(SR.StockRequestID as varchar) as id,
                'stock_request' as type,
                'Stock Request: ' + SR.RequestNumber as title,
                'From: ' + ISNULL(L.LocationName, 'Pharmacy') + ' • Priority: ' + ISNULL(SR.Priority, 'Routine') as description,
                SR.CreatedDate as timestamp,
                'stock-requests' as actionView,
                ISNULL(SR.Priority, 'Routine') as badge,
                CASE 
                    WHEN SR.Priority = 'Emergency' THEN 'destructive'
                    WHEN SR.Priority = 'Urgent' THEN 'amber'
                    ELSE 'primary'
                END as badgeColor
            FROM Warehouse_StockRequests SR
            LEFT JOIN Warehouse_Locations L ON SR.RequestingLocationID = L.LocationID
            WHERE SR.IsDeleted = 0 AND SR.Status IN ('Draft', 'Submitted', 'Pending', 'Under Review', 'Approved')
            ORDER BY SR.CreatedDate DESC
        `);
        notifications.push(...srRes.recordset);

        // 2. Inbound Delivery Receipts
        const drRes = await pool.request().query(`
            SELECT TOP 5
                'dr-' + CAST(DR.DeliveryReceiptID as varchar) as id,
                'delivery_receipt' as type,
                'Delivery Receipt: ' + ISNULL(DR.ReferenceNumber, 'DR-' + CAST(DR.DeliveryReceiptID as varchar)) as title,
                'Supplier: ' + ISNULL(S.SupplierName, 'Direct Supplier') + ' • Status: ' + DR.Status as description,
                DR.CreatedDate as timestamp,
                'receiving' as actionView,
                DR.Status as badge,
                'blue' as badgeColor
            FROM Warehouse_DeliveryReceipts DR
            LEFT JOIN Warehouse_Suppliers S ON DR.SupplierID = S.SupplierID
            WHERE DR.IsDeleted = 0
            ORDER BY DR.CreatedDate DESC
        `);
        notifications.push(...drRes.recordset);

        // 3. Near-Expiry Batches
        const expRes = await pool.request().query(`
            SELECT TOP 5
                'exp-' + CAST(I.InventoryID as varchar) as id,
                'expiry_alert' as type,
                'Batch Expiry Notice: ' + M.ProductName as title,
                'Lot #' + ISNULL(I.LotNumber, 'N/A') + ' expires ' + CONVERT(varchar, I.ExpiryDate, 107) + ' (' + CAST(I.QuantityAvailable as varchar) + ' left)' as description,
                I.ExpiryDate as timestamp,
                'inventory' as actionView,
                'Expiring' as badge,
                'amber' as badgeColor
            FROM Warehouse_Inventory I
            JOIN Medicines M ON I.MedicineID = M.MedicineID
            WHERE I.IsDeleted = 0 AND I.QuantityAvailable > 0 AND I.ExpiryDate <= DATEADD(day, 90, GETDATE())
            ORDER BY I.ExpiryDate ASC
        `);
        notifications.push(...expRes.recordset);

        notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        res.json({
            success: true,
            unreadCount: notifications.length,
            notifications
        });
    } catch (err) {
        console.error('Error fetching warehouse notifications:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// WAREHOUSE: STOCK REQUESTS
// ==========================================

// GET all stock requests

// GET stock requests summary KPIs for Warehouse Dashboard
app.get('/api/warehouse/stock-requests/kpis', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query(`
            SELECT 
                COUNT(*) AS totalRequests,
                ISNULL(SUM(CASE WHEN UPPER(REPLACE(Status, ' ', '_')) IN ('SUBMITTED', 'PENDING', 'UNDER_REVIEW') THEN 1 ELSE 0 END), 0) AS pendingReview,
                ISNULL(SUM(CASE WHEN UPPER(REPLACE(Status, ' ', '_')) = 'UNDER_REVIEW' THEN 1 ELSE 0 END), 0) AS underReview,
                ISNULL(SUM(CASE WHEN UPPER(REPLACE(Status, ' ', '_')) IN ('APPROVED', 'READY_FOR_FULFILLMENT') THEN 1 ELSE 0 END), 0) AS approved,
                ISNULL(SUM(CASE WHEN UPPER(REPLACE(Status, ' ', '_')) IN ('APPROVED', 'READY_FOR_FULFILLMENT', 'STOCK_UNAVAILABLE') THEN 1 ELSE 0 END), 0) AS approvedReserved,
                ISNULL(SUM(CASE WHEN UPPER(REPLACE(Status, ' ', '_')) = 'STOCK_UNAVAILABLE' THEN 1 ELSE 0 END), 0) AS stockUnavailable,
                ISNULL(SUM(CASE WHEN UPPER(REPLACE(Status, ' ', '_')) IN ('PARTIALLY_APPROVED', 'PARTIALLY_FULFILLED', 'PARTIALLY_RECEIVED') THEN 1 ELSE 0 END), 0) AS partiallyApproved,
                ISNULL(SUM(CASE WHEN UPPER(REPLACE(Status, ' ', '_')) IN ('APPROVED', 'PARTIALLY_APPROVED', 'STOCK_UNAVAILABLE', 'READY_FOR_FULFILLMENT', 'PARTIALLY_FULFILLED') THEN 1 ELSE 0 END), 0) AS awaitingIssuance,
                ISNULL(SUM(CASE WHEN UPPER(REPLACE(SR.Status, ' ', '_')) IN ('ISSUED', 'IN_TRANSIT') OR IssuedDist.ReferenceStockRequestID IS NOT NULL THEN 1 ELSE 0 END), 0) AS inTransit,
                ISNULL(SUM(CASE WHEN UPPER(REPLACE(SR.Status, ' ', '_')) IN ('RECEIVED', 'PARTIALLY_RECEIVED') THEN 1 ELSE 0 END), 0) AS received,
                ISNULL(SUM(CASE WHEN UPPER(REPLACE(SR.Status, ' ', '_')) IN ('COMPLETED', 'FULFILLED', 'RECEIVED') THEN 1 ELSE 0 END), 0) AS completed,
                ISNULL(SUM(CASE WHEN UPPER(REPLACE(SR.Status, ' ', '_')) IN ('REJECTED', 'CANCELLED') THEN 1 ELSE 0 END), 0) AS rejected,
                ISNULL(SUM(CASE WHEN UPPER(REPLACE(SR.Status, ' ', '_')) IN ('REJECTED', 'CANCELLED') THEN 1 ELSE 0 END), 0) AS rejectedOrCancelled
            FROM Warehouse_StockRequests SR
            LEFT JOIN (
                SELECT DISTINCT ReferenceStockRequestID
                FROM Warehouse_Distributions
                WHERE Status = 'Issued' AND IsDeleted = 0 AND ReferenceStockRequestID IS NOT NULL
            ) IssuedDist ON IssuedDist.ReferenceStockRequestID = SR.StockRequestID
            WHERE SR.IsDeleted = 0
        `);
        res.json(result.recordset[0] || {});
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET stock request full review details (Requested vs Physical vs Reserved vs Unavailable vs Available vs Shortage & FEFO map)
app.get('/api/warehouse/stock-requests/:id/review', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const details = await StockRequestService.getStockRequestReviewDetails(pool, req.params.id);
        res.json(details);
    } catch (err) {
        res.status(err.statusCode || (err.message.includes('not found') ? 404 : 500)).json({ error: err.message });
    }
});

// POST Mark Request Under Review (no stock deduction)
app.post('/api/warehouse/stock-requests/:id/under-review', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const headerUserId = req.headers['x-user-id'] || req.headers['X-User-Id'];
        const userId = Number(headerUserId || req.body.userId || 1);
        const result = await StockRequestService.markUnderReview(pool, req.params.id, userId);
        res.json(result);
    } catch (err) {
        res.status(err.statusCode || 400).json({ success: false, error: err.message });
    }
});

// POST Warehouse Admin Decision: Administrative Approval Only (succeeds even when stock is 0; does NOT deduct stock)
app.post('/api/warehouse/stock-requests/:id/approve', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const headerUserId = req.headers['x-user-id'] || req.headers['X-User-Id'];
        const userId = Number(headerUserId || req.body.userId || 1);
        const result = await StockRequestService.approveStockRequest(pool, req.params.id, userId, req.body);
        res.json(result);
    } catch (err) {
        console.error('Stock request approval error:', err);
        res.status(err.statusCode || 400).json({ success: false, error: err.message });
    }
});

// POST Warehouse Admin Decision: Rejection with Mandatory Reason
app.post('/api/warehouse/stock-requests/:id/reject', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const headerUserId = req.headers['x-user-id'] || req.headers['X-User-Id'];
        const userId = Number(headerUserId || req.body.userId || 1);
        const reason = req.body.rejectionReason || req.body.reason || '';
        const result = await StockRequestService.rejectStockRequest(pool, req.params.id, userId, reason);
        res.json(result);
    } catch (err) {
        console.error('Stock request rejection error:', err);
        res.status(err.statusCode || 400).json({ success: false, error: err.message });
    }
});

// POST Warehouse Admin Action: Record Stock Shortage / Mark STOCK_UNAVAILABLE
app.post('/api/warehouse/stock-requests/:id/shortage', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const headerUserId = req.headers['x-user-id'] || req.headers['X-User-Id'];
        const userId = Number(headerUserId || req.body.userId || 1);
        const result = await StockRequestService.recordShortage(pool, req.params.id, userId, req.body);
        res.json(result);
    } catch (err) {
        console.error('Stock request shortage log error:', err);
        res.status(err.statusCode || 400).json({ success: false, error: err.message });
    }
});

// POST Controlled Stock Release (Only Approved requests; strict live FEFO validation + Distribution Issue)
app.post('/api/warehouse/stock-requests/:id/release', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const headerUserId = req.headers['x-user-id'] || req.headers['X-User-Id'];
        const userId = Number(headerUserId || req.body.userId || 1);
        const result = await StockRequestService.releaseApprovedStock(pool, req.params.id, userId, req.body);
        res.json(result);
    } catch (err) {
        console.error('Controlled stock release error:', err);
        res.status(err.statusCode || 400).json({ success: false, error: err.message });
    }
});

// POST Cancel Stock Request (before physical stock release)
app.post('/api/warehouse/stock-requests/:id/cancel', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const headerUserId = req.headers['x-user-id'] || req.headers['X-User-Id'];
        const userId = Number(headerUserId || req.body.userId || 1);
        const reason = req.body.cancellationReason || req.body.reason || '';
        const result = await StockRequestService.cancelStockRequest(pool, req.params.id, userId, reason);
        res.json(result);
    } catch (err) {
        console.error('Stock request cancellation error:', err);
        res.status(err.statusCode || 400).json({ success: false, error: err.message });
    }
});

app.get('/api/warehouse/stock-requests', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query(`
            SELECT 
                SR.StockRequestID AS id,
                SR.StockRequestID,
                SR.RequestNumber,
                SR.RequestingLocationID,
                SR.RequestedByUserID,
                COALESCE(WL.LocationName, 'City Health Pharmacy') AS RequestingFacility,
                U.FullName AS RequesterName,
                SR.CreatedDate AS RequestDate,
                SR.RequiredDate,
                SR.Priority,
                SR.Purpose,
                SR.Remarks,
                SR.Status,
                SR.ShortageNotes,
                SR.AdminRemarks,
                SR.RejectionReason,
                SR.ApprovedDate,
                SR.RejectedDate,
                SR.CreatedDate,
                (SELECT COUNT(*) FROM Warehouse_StockRequestItems SRI WHERE SRI.StockRequestID = SR.StockRequestID AND SRI.IsDeleted = 0) AS ItemCount,
                (SELECT ISNULL(SUM(QuantityRequested), 0) FROM Warehouse_StockRequestItems SRI WHERE SRI.StockRequestID = SR.StockRequestID AND SRI.IsDeleted = 0) AS TotalQuantityRequested,
                (SELECT ISNULL(SUM(QuantityApproved), 0) FROM Warehouse_StockRequestItems SRI WHERE SRI.StockRequestID = SR.StockRequestID AND SRI.IsDeleted = 0) AS TotalQuantityApproved,
                (SELECT ISNULL(SUM(QuantityReleased), 0) FROM Warehouse_StockRequestItems SRI WHERE SRI.StockRequestID = SR.StockRequestID AND SRI.IsDeleted = 0) AS TotalQuantityReleased,
                (SELECT COUNT(*) FROM Warehouse_Distributions d WHERE d.ReferenceStockRequestID = SR.StockRequestID AND d.Status = 'Issued' AND d.IsDeleted = 0) AS OpenDistributionCount
            FROM Warehouse_StockRequests SR
            LEFT JOIN Warehouse_Locations WL ON SR.RequestingLocationID = WL.LocationID
            LEFT JOIN Users U ON SR.RequestedByUserID = U.UserID
            WHERE SR.IsDeleted = 0
            ORDER BY SR.CreatedDate DESC, SR.StockRequestID DESC
        `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET stock request details (items with live inventory)
app.get('/api/warehouse/stock-requests/:id/items', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query(`
                SELECT 
                    SRI.*,
                    SRI.QuantityRequested as RequestedQuantity,
                    M.ProductName,
                    M.GenericName,
                    (
                        SELECT ISNULL(SUM(QuantityAvailable), 0)
                        FROM Warehouse_Inventory I
                        WHERE I.MedicineID = SRI.MedicineID
                          AND I.IsDeleted = 0
                          AND I.Status = 'Active'
                          AND (I.ExpiryDate IS NULL OR I.ExpiryDate > CAST(GETUTCDATE() AS DATE))
                    ) as QuantityAvailable
                FROM Warehouse_StockRequestItems SRI
                JOIN Warehouse_Medicines M ON SRI.MedicineID = M.MedicineID
                WHERE SRI.StockRequestID = @id AND SRI.IsDeleted = 0
            `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST Create new draft request
app.post('/api/warehouse/stock-requests', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const { RequiredDate, RequestingFacility, RequestingDepartment, Priority, Purpose, Remarks, items } = req.body;
        
        // Generate Request Number (e.g. SR-2026-070001)
        const datePrefix = new Date().toISOString().slice(0, 7).replace('-', '');
        const countResult = await pool.request().query(`SELECT COUNT(*) as count FROM Warehouse_StockRequests WHERE RequestNumber LIKE 'SR-${datePrefix}%'`);
        const count = countResult.recordset[0].count + 1;
        const requestNumber = `SR-${datePrefix}${count.toString().padStart(4, '0')}`;

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const request = new sql.Request(transaction);
            const srResult = await request
                .input('RequestNumber', sql.VarChar, requestNumber)
                .input('Priority', sql.VarChar, Priority || 'Routine')
                .input('Purpose', sql.VarChar, Purpose || Remarks || '')
                .query(`
                    INSERT INTO Warehouse_StockRequests (
                        RequestNumber, RequestingLocationID, RequestedByUserID, Priority, Purpose, Status, CreatedBy, CreatedDate, IsDeleted
                    )
                    OUTPUT INSERTED.StockRequestID
                    VALUES (
                        @RequestNumber, 2, 1, @Priority, @Purpose, 'Draft', 1, SYSUTCDATETIME(), 0
                    )
                `);
            
            const stockRequestId = srResult.recordset[0].StockRequestID;

            if (items && items.length > 0) {
                for (const item of items) {
                    const itemReq = new sql.Request(transaction);
                    await itemReq
                        .input('StockRequestID', sql.Int, stockRequestId)
                        .input('MedicineID', sql.Int, item.medicineId)
                        .input('RequestedQuantity', sql.Int, item.requestedQuantity)
                        .query(`
                            INSERT INTO Warehouse_StockRequestItems (
                                StockRequestID, MedicineID, QuantityRequested, QuantityApproved, QuantityReleased, CreatedBy, CreatedDate, IsDeleted
                            ) VALUES (
                                @StockRequestID, @MedicineID, @RequestedQuantity, @RequestedQuantity, 0, 1, SYSUTCDATETIME(), 0
                            )
                        `);
                }
            }

            await transaction.commit();
            res.json({ success: true, id: stockRequestId, requestNumber });
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT Update status (Submit, Approve, Reject, Cancel)
app.put('/api/warehouse/stock-requests/:id/status', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const headerUserId = req.headers['x-user-id'] || req.headers['X-User-Id'];
        const userId = Number(headerUserId || req.body.userId || 1);
        const { status, remarks, adminRemarks, rejectionReason } = req.body;
        const norm = StockRequestService.normalizeStatus(status);

        if (norm === 'UNDER_REVIEW') {
            return res.json(await StockRequestService.markUnderReview(pool, req.params.id, userId));
        }
        if (norm === 'APPROVED') {
            return res.json(await StockRequestService.approveStockRequest(pool, req.params.id, userId, { adminRemarks: adminRemarks || remarks || '' }));
        }
        if (norm === 'REJECTED') {
            return res.json(await StockRequestService.rejectStockRequest(pool, req.params.id, userId, rejectionReason || remarks || ''));
        }
        if (norm === 'CANCELLED') {
            return res.json(await StockRequestService.cancelStockRequest(pool, req.params.id, userId, remarks || rejectionReason || ''));
        }
        if (norm === 'STOCK_UNAVAILABLE') {
            return res.json(await StockRequestService.recordShortage(pool, req.params.id, userId, { shortageNotes: remarks || 'Marked stock unavailable', markUnavailable: true }));
        }

        return res.status(400).json({
            error: `Direct status override to '${status}' is not permitted. Use dedicated Approval, Rejection, Shortage, or Controlled Stock Release endpoints.`
        });
    } catch (err) {
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});


// ==========================================
// WAREHOUSE: DISTRIBUTIONS (HARDENED & AUDITED)
// ==========================================

// GET all distributions
app.get('/api/warehouse/distributions', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query(`
            SELECT 
                D.DistributionID AS id,
                D.DistributionID,
                D.DistributionNumber,
                D.ReferenceStockRequestID,
                D.SourceLocationID,
                D.DestinationLocationID,
                COALESCE(WL.LocationName, 'Pharmacy Dispensary') as DestinationFacility,
                D.CreatedDate as DistributionDate,
                D.Status,
                D.Remarks,
                D.HasDiscrepancy,
                D.DiscrepancyRemarks,
                D.ReleasedDate,
                D.ReceivedDate,
                D.CreatedDate,
                SR.RequestNumber as StockRequestNumber,
                (SELECT COUNT(*) FROM Warehouse_DistributionItems DI WHERE DI.DistributionID = D.DistributionID AND DI.IsDeleted = 0) as ItemCount
            FROM Warehouse_Distributions D
            LEFT JOIN Warehouse_StockRequests SR ON D.ReferenceStockRequestID = SR.StockRequestID
            LEFT JOIN Warehouse_Locations WL ON D.DestinationLocationID = WL.LocationID
            WHERE D.IsDeleted = 0
            ORDER BY D.CreatedDate DESC
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error("Distributions GET error:", err);
        res.status(500).json({ error: err.message });
    }
});

// GET approved stock requests (for dropdown selection when creating a distribution)
app.get('/api/warehouse/stock-requests/approved', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query(`
            SELECT 
                SR.StockRequestID, 
                SR.RequestNumber, 
                COALESCE(WL.LocationName, 'Pharmacy Dispensary') as RequestingFacility, 
                'Main Department' as RequestingDepartment, 
                SR.Purpose 
            FROM Warehouse_StockRequests SR
            LEFT JOIN Warehouse_Locations WL ON SR.RequestingLocationID = WL.LocationID
            WHERE UPPER(REPLACE(SR.Status, ' ', '_')) IN ('APPROVED', 'PARTIALLY_APPROVED', 'RESERVED', 'READY_FOR_ISSUANCE', 'READY_FOR_FULFILLMENT', 'PARTIALLY_FULFILLED', 'STOCK_UNAVAILABLE', 'PARTIALLY_RECEIVED')
              AND SR.IsDeleted = 0
              AND EXISTS (
                  SELECT 1 FROM Warehouse_StockRequestItems SRI
                  WHERE SRI.StockRequestID = SR.StockRequestID
                    AND SRI.IsDeleted = 0
                    AND ISNULL(SRI.QuantityApproved, SRI.QuantityRequested) > ISNULL(SRI.QuantityReleased, 0)
              )
            ORDER BY SR.CreatedDate DESC
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error("Approved SR GET error:", err);
        res.status(500).json({ error: err.message });
    }
});

// GET FEFO Allocation Map for a given Stock Request (HARDENED FEFO LOGIC)
app.get('/api/warehouse/stock-requests/:id/fefo-allocation', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const allocations = await StockRequestService.getFefoAllocation(pool, req.params.id);
        res.json(allocations);
    } catch (err) {
        console.error("FEFO allocation error:", err);
        res.status(500).json({ error: err.message });
    }
});

/* Legacy FEFO replaced with hardened StockRequestService.getFefoAllocation */
app.get('/api/warehouse/stock-requests/:id/fefo-allocation-legacy', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        
        // 1. Get requested items
        const reqItemsResult = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query(`
                SELECT 
                    SRI.StockRequestItemID, 
                    SRI.MedicineID, 
                    SRI.QuantityRequested as RequestedQuantity, 
                    M.ProductName,
                    M.GenericName,
                    M.FEFOEnabled,
                    M.TrackExpirationDates
                FROM Warehouse_StockRequestItems SRI
                JOIN Warehouse_Medicines M ON SRI.MedicineID = M.MedicineID
                WHERE SRI.StockRequestID = @id AND SRI.IsDeleted = 0 AND M.IsDeleted = 0
            `);
            
        const requestedItems = reqItemsResult.recordset;
        const allocations = [];

        // 2. Allocate inventory using strict FEFO rules:
        // - Exclude expired batches (ExpiryDate <= current UTC date)
        // - Exclude inactive or damaged inventory
        // - Earliest valid expiration date first; tie-break by CreatedDate, InventoryID
        for (const reqItem of requestedItems) {
            let remainingToFulfill = reqItem.RequestedQuantity;
            
            const inventoryResult = await pool.request()
                .input('MedicineID', sql.Int, reqItem.MedicineID)
                .query(`
                    SELECT 
                        InventoryID, 
                        BatchNumber, 
                        LotNumber, 
                        ExpiryDate, 
                        QuantityAvailable, 
                        LocationID,
                        UnitCost
                    FROM Warehouse_Inventory
                    WHERE MedicineID = @MedicineID 
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
                
            const availableBatches = inventoryResult.recordset;
            let allocatedForThisItem = 0;
            
            for (const batch of availableBatches) {
                if (remainingToFulfill <= 0) break;
                
                const issueQty = Math.min(remainingToFulfill, batch.QuantityAvailable);
                allocatedForThisItem += issueQty;
                
                allocations.push({
                    StockRequestItemID: reqItem.StockRequestItemID,
                    MedicineID: reqItem.MedicineID,
                    ProductName: reqItem.ProductName,
                    GenericName: reqItem.GenericName,
                    RequestedQuantity: reqItem.RequestedQuantity,
                    InventoryID: batch.InventoryID,
                    BatchNumber: batch.BatchNumber || batch.LotNumber || 'BATCH-DEFAULT',
                    ExpiryDate: batch.ExpiryDate,
                    QuantityAvailable: batch.QuantityAvailable,
                    IssuedQuantity: issueQty,
                    UnitCost: batch.UnitCost,
                    Shortage: 0
                });
                
                remainingToFulfill -= issueQty;
            }
            
            // Explicit shortage tracking
            if (remainingToFulfill > 0) {
                allocations.push({
                    StockRequestItemID: reqItem.StockRequestItemID,
                    MedicineID: reqItem.MedicineID,
                    ProductName: reqItem.ProductName,
                    GenericName: reqItem.GenericName,
                    RequestedQuantity: reqItem.RequestedQuantity,
                    InventoryID: null,
                    BatchNumber: 'INSUFFICIENT ELIGIBLE STOCK',
                    ExpiryDate: null,
                    QuantityAvailable: 0,
                    IssuedQuantity: 0,
                    UnitCost: 0,
                    Shortage: remainingToFulfill
                });
            }
        }

        res.json(allocations);
    } catch (err) {
        console.error("FEFO allocation error:", err);
        res.status(500).json({ error: err.message });
    }
});

// GET Distribution Details & Line Items
app.get('/api/warehouse/distributions/:id/items', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query(`
                SELECT 
                    DI.DistributionItemID,
                    DI.DistributionID,
                    DI.InventoryID,
                    DI.StockRequestItemID,
                    DI.Quantity,
                    DI.Quantity as IssuedQuantity,
                    DI.UnitCostAtTimeOfRelease,
                    I.MedicineID,
                    M.ProductName,
                    M.GenericName,
                    I.BatchNumber,
                    I.LotNumber,
                    I.ExpiryDate
                FROM Warehouse_DistributionItems DI
                JOIN Warehouse_Inventory I ON DI.InventoryID = I.InventoryID
                JOIN Warehouse_Medicines M ON I.MedicineID = M.MedicineID
                WHERE DI.DistributionID = @id AND DI.IsDeleted = 0
            `);
        res.json(result.recordset);
    } catch (err) {
        console.error("Distribution items GET error:", err);
        res.status(500).json({ error: err.message });
    }
});

// POST Create Draft Distribution (Transactional, Validated Against Schema)
app.post('/api/warehouse/distributions', async (req, res) => {
    let pool;
    let transaction;
    try {
        pool = await sql.connect(config);
        const { StockRequestID, Remarks, items } = req.body;
        
        if (!StockRequestID) {
            return res.status(400).json({ error: "StockRequestID is required." });
        }

        // Verify source stock request is approved
        const srCheck = await pool.request()
            .input('srId', sql.Int, StockRequestID)
            .query(`
                SELECT StockRequestID, Status, RequestingLocationID 
                FROM Warehouse_StockRequests 
                WHERE StockRequestID = @srId AND IsDeleted = 0
            `);
        if (srCheck.recordset.length === 0) {
            return res.status(404).json({ error: "Stock Request not found." });
        }
        if (!StockRequestService.isApprovedReleasableStatus(srCheck.recordset[0].Status)) {
            return res.status(400).json({ error: `Cannot create distribution for Stock Request with status "${srCheck.recordset[0].Status}". Must be "Approved".` });
        }

        const requestingLocId = srCheck.recordset[0].RequestingLocationID || 2;

        // Generate Distribution Number
        const datePrefix = new Date().toISOString().slice(0, 7).replace('-', '');
        const countResult = await pool.request().query(`SELECT COUNT(*) as count FROM Warehouse_Distributions WHERE DistributionNumber LIKE 'DST-${datePrefix}%'`);
        const count = countResult.recordset[0].count + 1;
        const distNumber = `DST-${datePrefix}${count.toString().padStart(4, '0')}`;

        transaction = new sql.Transaction(pool);
        await transaction.begin();

        const distReq = new sql.Request(transaction);
        distReq.input('DistributionNumber', sql.NVarChar, distNumber);
        distReq.input('ReferenceStockRequestID', sql.BigInt, StockRequestID);
        distReq.input('SourceLocationID', sql.Int, 1); // Main Warehouse
        distReq.input('DestinationLocationID', sql.Int, requestingLocId);
        distReq.input('Remarks', sql.NVarChar, Remarks || null);
        distReq.input('CreatedBy', sql.Int, 1);

        const distResult = await distReq.query(`
            INSERT INTO Warehouse_Distributions (
                DistributionNumber, ReferenceStockRequestID, SourceLocationID, DestinationLocationID,
                Remarks, Status, CreatedBy, CreatedDate, IsDeleted
            )
            OUTPUT INSERTED.DistributionID
            VALUES (
                @DistributionNumber, @ReferenceStockRequestID, @SourceLocationID, @DestinationLocationID,
                @Remarks, 'Draft', @CreatedBy, SYSUTCDATETIME(), 0
            )
        `);
        const distributionId = distResult.recordset[0].DistributionID;

        // Insert line items
        if (items && items.length > 0) {
            for (const item of items) {
                const qtyToIssue = Number(item.IssuedQuantity || item.Quantity || 0);
                if (qtyToIssue <= 0 || !item.InventoryID) continue;

                // Lookup batch unit cost
                const costReq = new sql.Request(transaction);
                costReq.input('invId', sql.BigInt, item.InventoryID);
                const costRes = await costReq.query('SELECT UnitCost FROM Warehouse_Inventory WHERE InventoryID = @invId');
                const unitCost = costRes.recordset[0]?.UnitCost || 0;

                const itemReq = new sql.Request(transaction);
                itemReq.input('DistributionID', sql.BigInt, distributionId);
                itemReq.input('InventoryID', sql.BigInt, item.InventoryID);
                itemReq.input('StockRequestItemID', sql.BigInt, item.StockRequestItemID || null);
                itemReq.input('Quantity', sql.Int, qtyToIssue);
                itemReq.input('UnitCost', sql.Decimal(18, 4), unitCost);
                itemReq.input('CreatedBy', sql.Int, 1);

                await itemReq.query(`
                    INSERT INTO Warehouse_DistributionItems (
                        DistributionID, InventoryID, StockRequestItemID, Quantity,
                        UnitCostAtTimeOfRelease, CreatedBy, CreatedDate, IsDeleted
                    ) VALUES (
                        @DistributionID, @InventoryID, @StockRequestItemID, @Quantity,
                        @UnitCost, @CreatedBy, SYSUTCDATETIME(), 0
                    )
                `);
            }
        }

        await transaction.commit();
        res.json({ success: true, id: distributionId, distributionId: distributionId, DistributionNumber: distNumber, distributionNumber: distNumber });
    } catch (err) {
        if (transaction) await transaction.rollback();
        console.error("Create Distribution error:", err);
        res.status(500).json({ error: err.message });
    }
});

// PUT Issue Distribution (ACID TRANSACTION: Pessimistic Row Lock, Ledger Writing, Atomic Deduction)
app.put('/api/warehouse/distributions/:id/issue', async (req, res) => {
    let pool;
    let transaction;
    const headerUserId = req.headers['x-user-id'] || req.headers['X-User-Id'];
    const userId = Number(headerUserId || req.body?.userId || 1);
    try {
        pool = await sql.connect(config);
        transaction = new sql.Transaction(pool);
        await transaction.begin();

        // 1. Lock and fetch Distribution Header in Draft status
        const distReq = new sql.Request(transaction);
        distReq.input('id', sql.BigInt, req.params.id);
        const distResult = await distReq.query(`
            SELECT D.*, SR.RequestNumber as StockRequestNumber
            FROM Warehouse_Distributions D WITH (UPDLOCK, HOLDLOCK)
            LEFT JOIN Warehouse_StockRequests SR ON D.ReferenceStockRequestID = SR.StockRequestID
            WHERE D.DistributionID = @id AND D.IsDeleted = 0
        `);
            
        if (distResult.recordset.length === 0) {
            throw new Error("Distribution document not found.");
        }
        
        const distribution = distResult.recordset[0];
        if (distribution.Status !== 'Draft') {
            throw new Error(`Distribution is in status "${distribution.Status}". Only "Draft" distributions can be issued.`);
        }

        // Verify source stock request if attached
        if (distribution.ReferenceStockRequestID) {
            const srReq = new sql.Request(transaction);
            srReq.input('srId', sql.BigInt, distribution.ReferenceStockRequestID);
            const srRes = await srReq.query('SELECT Status FROM Warehouse_StockRequests WHERE StockRequestID = @srId');
            if (srRes.recordset.length > 0 && !['Approved', 'Partially Fulfilled'].includes(srRes.recordset[0].Status)) {
                throw new Error(`Source Stock Request is not in Approved status (currently: ${srRes.recordset[0].Status}).`);
            }
        }

        // 2. Fetch line items
        const itemsReq = new sql.Request(transaction);
        itemsReq.input('id', sql.BigInt, req.params.id);
        const itemsResult = await itemsReq.query(`
            SELECT 
                DI.DistributionItemID,
                DI.InventoryID,
                DI.Quantity,
                DI.UnitCostAtTimeOfRelease,
                I.MedicineID,
                I.LocationID,
                I.QuantityAvailable,
                I.Status as BatchStatus,
                I.ExpiryDate
            FROM Warehouse_DistributionItems DI
            JOIN Warehouse_Inventory I WITH (UPDLOCK, HOLDLOCK) ON DI.InventoryID = I.InventoryID
            WHERE DI.DistributionID = @id AND DI.IsDeleted = 0
        `);
            
        const items = itemsResult.recordset;
        if (items.length === 0) {
            throw new Error("Cannot issue distribution with no line items.");
        }

        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);

        // 3. Process each item: Atomic validation, Deduction, Ledger Entry
        for (const item of items) {
            // Verify batch active and not expired
            if (item.BatchStatus !== 'Active') {
                throw new Error(`Inventory Batch ${item.InventoryID} is not Active (status: ${item.BatchStatus}). Issuance rejected.`);
            }
            if (item.ExpiryDate && item.ExpiryDate < todayStr) {
                throw new Error(`Inventory Batch ${item.InventoryID} has expired on ${item.ExpiryDate}. Issuance of expired stock is forbidden.`);
            }

            // Atomic inventory decrement with strict guard against negative stock
            const deductReq = new sql.Request(transaction);
            deductReq.input('InventoryID', sql.BigInt, item.InventoryID);
            deductReq.input('Quantity', sql.Int, item.Quantity);
            const deductRes = await deductReq.query(`
                UPDATE Warehouse_Inventory 
                SET 
                    ReservedQuantity = CASE WHEN ReservedQuantity >= @Quantity THEN ReservedQuantity - @Quantity ELSE 0 END,
                    QuantityAvailable = CASE WHEN ReservedQuantity >= @Quantity THEN QuantityAvailable ELSE QuantityAvailable - (@Quantity - ReservedQuantity) END,
                    ModifiedDate = SYSUTCDATETIME()
                WHERE InventoryID = @InventoryID 
                  AND (QuantityAvailable + ReservedQuantity) >= @Quantity 
                  AND Status = 'Active';
            `);

            if (deductRes.rowsAffected[0] === 0) {
                throw new Error(`Insufficient stock or concurrent modification on Inventory Batch ${item.InventoryID}. Required: ${item.Quantity}, Available: ${item.QuantityAvailable}.`);
            }
                
            // Write to Warehouse_InventoryTransactions (signed negative quantity for outbound distribution)
            const unitCost = Number(item.UnitCostAtTimeOfRelease || 0);
            const totalCost = unitCost * item.Quantity;

            const logReq = new sql.Request(transaction);
            logReq.input('InventoryID', sql.BigInt, item.InventoryID);
            logReq.input('LocationID', sql.Int, item.LocationID || distribution.SourceLocationID || 1);
            logReq.input('MedicineID', sql.Int, item.MedicineID);
            logReq.input('TransactionType', sql.NVarChar, 'DISTRIBUTION');
            logReq.input('ReferenceDocument', sql.NVarChar, 'DISTRIBUTION');
            logReq.input('ReferenceID', sql.BigInt, req.params.id);
            logReq.input('Quantity', sql.Int, -Math.abs(item.Quantity)); // Signed negative
            logReq.input('UnitCost', sql.Decimal(18, 4), unitCost);
            logReq.input('TotalCost', sql.Decimal(18, 4), totalCost);
            logReq.input('Remarks', sql.NVarChar, `Issued via ${distribution.DistributionNumber}`);
            logReq.input('CreatedBy', sql.Int, 1);

            await logReq.query(`
                INSERT INTO Warehouse_InventoryTransactions (
                    InventoryID, LocationID, MedicineID, TransactionType, ReferenceDocument, ReferenceID,
                    Quantity, UnitCost, TotalCost, Remarks, CreatedBy, CreatedDate
                ) VALUES (
                    @InventoryID, @LocationID, @MedicineID, @TransactionType, @ReferenceDocument, @ReferenceID,
                    @Quantity, @UnitCost, @TotalCost, @Remarks, @CreatedBy, SYSUTCDATETIME()
                )
            `);
        }

        // 4. Transition Distribution status to Issued
        const actorUserId = Number(req.headers['x-user-id'] || req.headers['X-User-Id'] || req.body?.userId || 1);
        const updateDistReq = new sql.Request(transaction);
        updateDistReq.input('id', sql.BigInt, req.params.id);
        updateDistReq.input('userId', sql.Int, actorUserId);
        const updateDistRes = await updateDistReq.query(`
            UPDATE Warehouse_Distributions 
            SET 
                Status = 'Issued', 
                ReleasedDate = SYSUTCDATETIME(),
                ReleasedByUserID = @userId,
                ModifiedDate = SYSUTCDATETIME()
            WHERE DistributionID = @id AND Status = 'Draft'
        `);
        if (updateDistRes.rowsAffected[0] === 0) {
            throw new Error("Concurrent update error: Distribution was already processed.");
        }

        // 5. Update source Stock Request & Stock Request Items (accurate partial vs full remaining balance)
        if (distribution.ReferenceStockRequestID) {
            for (const item of items) {
                const updateSriReq = new sql.Request(transaction);
                updateSriReq.input('srId', sql.BigInt, distribution.ReferenceStockRequestID);
                updateSriReq.input('medId', sql.Int, item.MedicineID);
                updateSriReq.input('qty', sql.Int, item.Quantity);
                await updateSriReq.query(`
                    UPDATE Warehouse_StockRequestItems
                    SET QuantityApproved = CASE 
                            WHEN ISNULL(QuantityApproved, 0) < (ISNULL(QuantityReleased, 0) + @qty) 
                            THEN (ISNULL(QuantityReleased, 0) + @qty)
                            ELSE QuantityApproved
                        END,
                        QuantityReleased = ISNULL(QuantityReleased, 0) + @qty,
                        QuantityUnfulfilled = CASE
                            WHEN ISNULL(QuantityApproved, QuantityRequested) > (ISNULL(QuantityReleased, 0) + @qty)
                            THEN ISNULL(QuantityApproved, QuantityRequested) - (ISNULL(QuantityReleased, 0) + @qty)
                            ELSE 0
                        END
                    WHERE StockRequestID = @srId AND MedicineID = @medId AND IsDeleted = 0
                `);
            }

            const remReq = new sql.Request(transaction);
            remReq.input('StockRequestID', sql.BigInt, distribution.ReferenceStockRequestID);
            const remRes = await remReq.query(`
                SELECT ISNULL(SUM(
                    CASE WHEN ISNULL(QuantityApproved, QuantityRequested) > ISNULL(QuantityReleased, 0)
                         THEN ISNULL(QuantityApproved, QuantityRequested) - ISNULL(QuantityReleased, 0)
                         ELSE 0 END
                ), 0) AS remTotal,
                (SELECT TOP 1 Status FROM Warehouse_StockRequests WHERE StockRequestID = @StockRequestID) AS prevStatus
                FROM Warehouse_StockRequestItems
                WHERE StockRequestID = @StockRequestID AND IsDeleted = 0
            `);
            const remTotal = Number(remRes.recordset[0]?.remTotal || 0);
            const prevStatus = remRes.recordset[0]?.prevStatus || null;
            const nextSrStatus = remTotal > 0 ? 'PARTIALLY_FULFILLED' : 'FULFILLED';

            const updateSrReq = new sql.Request(transaction);
            updateSrReq.input('StockRequestID', sql.BigInt, distribution.ReferenceStockRequestID);
            updateSrReq.input('NextStatus', sql.NVarChar(50), nextSrStatus);
            await updateSrReq.query(`
                UPDATE Warehouse_StockRequests 
                SET Status = @NextStatus, ModifiedDate = SYSUTCDATETIME()
                WHERE StockRequestID = @StockRequestID;
            `);

            await StockRequestService.logAudit(transaction, {
                stockRequestId: distribution.ReferenceStockRequestID,
                distributionId: Number(req.params.id),
                action: remTotal > 0 ? 'PARTIAL_RELEASE' : 'FULL_RELEASE',
                previousStatus: prevStatus,
                newStatus: nextSrStatus,
                actorUserId,
                notes: `Issued distribution ${distribution.DistributionNumber}. Remaining unfulfilled: ${remTotal}.`,
            });
        }

        // Consume corresponding stock reservations for this distribution
        await StockRequestService.consumeReservationsForDistribution(transaction, req.params.id, userId || 1);

        await transaction.commit();
        res.json({ success: true, message: `Distribution ${distribution.DistributionNumber} successfully issued and stock deducted.` });
    } catch (err) {
        if (transaction) await transaction.rollback();
        console.error("Issue Distribution error:", err);
        res.status(500).json({ error: err.message });
    }
});

// PUT Cancel Distribution (Draft Only)
app.put('/api/warehouse/distributions/:id/cancel', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('id', sql.BigInt, req.params.id)
            .query(`
                UPDATE Warehouse_Distributions 
                SET Status = 'Cancelled', ModifiedDate = SYSUTCDATETIME()
                WHERE DistributionID = @id AND Status = 'Draft'
            `);
        if (result.rowsAffected[0] === 0) {
            return res.status(400).json({ error: "Only Draft distributions can be cancelled." });
        }
        res.json({ success: true });
    } catch (err) {
        console.error("Cancel Distribution error:", err);
        res.status(500).json({ error: err.message });
    }
});


// ==========================================
// WAREHOUSE: RECONCILIATION & INTEGRITY AUDIT API
// ==========================================

// GET Reconciliation KPI Summary
app.get('/api/warehouse/reconciliation/summary', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const summary = await ReconciliationService.getSummary(pool);
        res.json(summary);
    } catch (err) {
        console.error("Reconciliation summary error:", err);
        res.status(500).json({ error: err.message });
    }
});

// GET Discrepancy List with Filtering and Pagination
app.get('/api/warehouse/reconciliation/discrepancies', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const data = await ReconciliationService.getDiscrepancies(pool, req.query);
        res.json(data);
    } catch (err) {
        console.error("Discrepancies list error:", err);
        res.status(500).json({ error: err.message });
    }
});

// GET Single Discrepancy Details & Associated Transactions / Investigation History
app.get('/api/warehouse/reconciliation/discrepancies/:id', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const detail = await ReconciliationService.getDiscrepancyDetail(pool, req.params.id);
        if (!detail) return res.status(404).json({ error: "Discrepancy record not found." });
        res.json(detail);
    } catch (err) {
        console.error("Discrepancy detail error:", err);
        res.status(500).json({ error: err.message });
    }
});

// POST Add Investigation Note
app.post('/api/warehouse/reconciliation/discrepancies/:id/notes', async (req, res) => {
    try {
        const { noteText, userId } = req.body;
        if (!noteText || noteText.trim().length === 0) {
            return res.status(400).json({ error: "Note text cannot be empty." });
        }
        const pool = await sql.connect(config);
        const note = await ReconciliationService.addNote(pool, req.params.id, userId || 1, noteText);
        res.json({ success: true, note });
    } catch (err) {
        console.error("Add note error:", err);
        res.status(500).json({ error: err.message });
    }
});

// PUT Update Investigation Status with Justification
app.put('/api/warehouse/reconciliation/discrepancies/:id/status', async (req, res) => {
    try {
        const { status, justification, userId } = req.body;
        const pool = await sql.connect(config);
        const result = await ReconciliationService.updateStatus(pool, req.params.id, userId || 1, status, justification);
        res.json(result);
    } catch (err) {
        console.error("Update status error:", err);
        res.status(500).json({ error: err.message });
    }
});

// POST Trigger On-Demand Reconciliation Run
app.post('/api/warehouse/reconciliation/runs', async (req, res) => {
    try {
        const { userId } = req.body;
        const pool = await sql.connect(config);
        const result = await ReconciliationService.executeReconciliationRun(pool, userId || 1);
        res.json({ success: true, ...result });
    } catch (err) {
        console.error("Run reconciliation error:", err);
        res.status(500).json({ error: err.message });
    }
});

// GET Historical Audit Runs
app.get('/api/warehouse/reconciliation/runs', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const runs = await ReconciliationService.getRuns(pool);
        res.json(runs);
    } catch (err) {
        console.error("Get runs error:", err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// WAREHOUSE: PHYSICAL INVENTORY COUNTS & ADJUSTMENTS
// ==========================================

// GET count sessions list
app.get('/api/warehouse/physical-counts', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const counts = await PhysicalCountService.getCountSessions(pool, req.query);
        res.json(counts);
    } catch (err) {
        console.error("Get count sessions error:", err);
        res.status(500).json({ error: err.message });
    }
});

// GET count session details and line items
app.get('/api/warehouse/physical-counts/:id', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const details = await PhysicalCountService.getCountDetails(pool, req.params.id);
        if (!details) {
            return res.status(404).json({ error: "Physical count session not found." });
        }
        res.json(details);
    } catch (err) {
        console.error("Get count details error:", err);
        res.status(500).json({ error: err.message });
    }
});

// POST Create new count session (baseline snapshot)
app.post('/api/warehouse/physical-counts', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await PhysicalCountService.createCountSession(pool, req.body, req.body.userId || 1);
        res.json(result);
    } catch (err) {
        console.error("Create count session error:", err);
        res.status(500).json({ error: err.message });
    }
});

// PUT Update count items (physical counts, discrepancy reasons, notes)
app.put('/api/warehouse/physical-counts/:id', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const { items, remarks, userId } = req.body;
        const result = await PhysicalCountService.updateCountItems(pool, req.params.id, items || [], remarks, userId || 1);
        res.json(result);
    } catch (err) {
        console.error("Update count items error:", err);
        res.status(500).json({ error: err.message });
    }
});

// PUT Submit count for review
app.put('/api/warehouse/physical-counts/:id/submit', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const { userId } = req.body;
        const result = await PhysicalCountService.submitCount(pool, req.params.id, userId || 1);
        res.json(result);
    } catch (err) {
        console.error("Submit count error:", err);
        res.status(500).json({ error: err.message });
    }
});

// PUT Approve count
app.put('/api/warehouse/physical-counts/:id/approve', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const { userId, reviewNotes } = req.body;
        const result = await PhysicalCountService.approveCount(pool, req.params.id, userId || 1, reviewNotes);
        res.json(result);
    } catch (err) {
        console.error("Approve count error:", err);
        res.status(500).json({ error: err.message });
    }
});

// PUT Reject count
app.put('/api/warehouse/physical-counts/:id/reject', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const { userId, rejectionReason } = req.body;
        const result = await PhysicalCountService.rejectCount(pool, req.params.id, userId || 1, rejectionReason);
        res.json(result);
    } catch (err) {
        console.error("Reject count error:", err);
        res.status(500).json({ error: err.message });
    }
});

// PUT Post approved stock adjustments (ACID transactional posting)
app.put('/api/warehouse/physical-counts/:id/post', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const { userId } = req.body;
        const result = await PhysicalCountService.postAdjustment(pool, req.params.id, userId || 1);
        res.json(result);
    } catch (err) {
        console.error("Post adjustment error:", err);
        res.status(500).json({ error: err.message });
    }
});


// =========================================================================
// PHASE 7: PHARMACY MANAGEMENT & MEDICINE DISPENSING ENDPOINTS
// =========================================================================

// GET Pharmacy Dashboard Real-time KPIs
app.get('/api/pharmacy/dashboard', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const stats = await PharmacyService.getDashboardStats(pool);
        res.json(stats);
    } catch (err) {
        console.error('Pharmacy dashboard stats error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET Pharmacy Inventory Batches with FEFO and Status
app.get('/api/pharmacy/inventory', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const inventory = await PharmacyService.getPharmacyInventory(pool, req.query);
        res.json(inventory);
    } catch (err) {
        console.error('Pharmacy inventory error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET Issued Warehouse Distributions awaiting receipt
app.get('/api/pharmacy/distributions/issued', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const distributions = await PharmacyService.getIssuedDistributions(pool);
        res.json(distributions);
    } catch (err) {
        console.error('Issued distributions error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Unified /api/pharmacy/stock-requests GET routes are defined in the top Stock Request section.

// POST Create Pharmacy Stock Request to Central Warehouse
// GET Requestable Medicines Catalog for Pharmacy Stock Requests with live Pharmacy and Warehouse stock
app.get(['/api/pharmacy/medicines-for-request', '/api/pharmacy/medicines'], async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const search = req.query.search || req.query.q || '';
        const medicines = await PharmacyService.getMedicinesForRequest(pool, search);
        res.json(medicines);
    } catch (err) {
        console.error('Pharmacy medicines-for-request error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Unified /api/pharmacy/stock-requests POST route is defined in the top Stock Request section.

// GET Distribution Details with line items
app.get('/api/pharmacy/distributions/:id', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const details = await PharmacyService.getDistributionDetails(pool, req.params.id);
        res.json(details);
    } catch (err) {
        console.error('Distribution details error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST Receive Warehouse Distribution atomically into Pharmacy (supports per-item accepted/damaged/shortage quantities)
app.post('/api/pharmacy/distributions/:id/receive', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const { userId } = req.body;
        const result = await PharmacyService.receiveWarehouseDistribution(pool, req.params.id, userId || 1, req.body);
        res.json(result);
    } catch (err) {
        console.error('Receive distribution error:', err);
        res.status(400).json({ error: err.message });
    }
});

// GET Search Registered Patients
app.get('/api/pharmacy/patients/search', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const patients = await PharmacyService.searchPatients(pool, req.query.q || req.query.search || '');
        res.json(patients);
    } catch (err) {
        console.error('Patient search error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET Eligible Batches for Medicine (FEFO)
app.get('/api/pharmacy/medicines/:id/eligible-batches', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const batches = await PharmacyService.getEligibleBatchesForMedicine(pool, req.params.id);
        res.json(batches);
    } catch (err) {
        console.error('Eligible batches error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Helper function: strictly resolve and authenticate City Pharmacy personnel
async function resolvePharmacyPersonnel(req, pool) {
    const rawId = req.headers['x-user-id'] || req.query.userId || (req.body && req.body.userId);
    if (!rawId) {
        const err = new Error('Unauthorized: Authentication credentials required to dispense medicines.');
        err.statusCode = 401;
        throw err;
    }
    const userId = parseInt(rawId, 10);
    if (isNaN(userId)) {
        const err = new Error('Unauthorized: Invalid User ID provided.');
        err.statusCode = 401;
        throw err;
    }
    const userReq = pool.request();
    userReq.input('id', sql.Int, userId);
    const userRes = await userReq.query('SELECT UserID, FullName, Role, IsActive FROM Users WHERE UserID = @id');
    if (userRes.recordset.length === 0 || !userRes.recordset[0].IsActive) {
        const err = new Error('Unauthorized: Account is inactive or does not exist.');
        err.statusCode = 401;
        throw err;
    }
    const user = userRes.recordset[0];
    const rawRole = (user.Role || '').toLowerCase().trim();
    const isBarangayRole = rawRole.includes('bhw') || rawRole.includes('barangay') || rawRole.includes('health worker');
    if (isBarangayRole) {
        const err = new Error('Access Denied: Barangay Health Worker accounts cannot dispense Pharmacy medicine.');
        err.statusCode = 403;
        throw err;
    }
    const isPharmacyOrAdmin = rawRole === 'admin' || rawRole.includes('pharmac') || rawRole.includes('super admin') || rawRole === 'staff';
    if (!isPharmacyOrAdmin) {
        const err = new Error('Access Denied: Only City Pharmacy or Administrator personnel may perform dispensing operations.');
        err.statusCode = 403;
        throw err;
    }
    return user;
}

// POST Preview FEFO batch allocation for dispensing cart
app.post('/api/pharmacy/preview-allocation', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const { items } = req.body;
        if (!items || !Array.isArray(items)) {
            return res.status(400).json({ error: 'Items array is required' });
        }
        const preview = await PharmacyService.calculateFefoAllocationForItems(pool, items);
        res.json(preview);
    } catch (err) {
        console.error('Preview allocation error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST Dispense Medicines (Atomic FEFO deduction + ledger)
app.post('/api/pharmacy/dispense', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const authPersonnel = await resolvePharmacyPersonnel(req, pool);
        const result = await PharmacyService.dispenseMedicines(pool, req.body, authPersonnel.UserID);
        res.json({
            ...result,
            dispensedBy: {
                userId: authPersonnel.UserID,
                fullName: authPersonnel.FullName,
                role: authPersonnel.Role
            }
        });
    } catch (err) {
        console.error('Dispense error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// GET Dispensing History with filters
app.get('/api/pharmacy/dispensing/history', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const history = await PharmacyService.getDispensingHistory(pool, req.query);
        res.json(history);
    } catch (err) {
        console.error('Dispensing history error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET Dispensing Voucher / Record Details
app.get('/api/pharmacy/dispensing/:id', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const details = await PharmacyService.getDispensingDetails(pool, req.params.id);
        res.json(details);
    } catch (err) {
        console.error('Dispensing details error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST Cancel / Reverse Dispensing Record (with compensating ledger)
app.post('/api/pharmacy/dispensing/:id/reverse', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const authPersonnel = await resolvePharmacyPersonnel(req, pool);
        const result = await PharmacyService.reverseDispensing(pool, req.params.id, req.body, authPersonnel.UserID);
        res.json({
            ...result,
            reversedBy: {
                userId: authPersonnel.UserID,
                fullName: authPersonnel.FullName,
                role: authPersonnel.Role
            }
        });
    } catch (err) {
        console.error('Dispensing reversal error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// GET Stock Movement History (Audit Ledger)
app.get(['/api/pharmacy/movements', '/api/pharmacy/stock-movements'], async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const movements = await PharmacyService.getStockMovementHistory(pool, req.query);
        res.json(movements);
    } catch (err) {
        console.error('Stock movements error:', err);
        res.status(500).json({ error: err.message });
    }
});


// =========================================================================
// PHASE 8: PATIENT MANAGEMENT & CLINICAL CONSULTATION ENDPOINTS
// =========================================================================

// GET Clinical Dashboard Real-time KPIs
app.get('/api/clinical/dashboard', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const stats = await ClinicalService.getClinicalDashboardStats(pool);
        res.json(stats);
    } catch (err) {
        console.error('Clinical dashboard stats error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET Searchable & Filterable Patients Registry
app.get('/api/clinical/patients', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const patients = await ClinicalService.getPatients(pool, req.query);
        res.json(patients);
    } catch (err) {
        console.error('Get patients error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET Patient by ID
app.get('/api/clinical/patients/:id', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const patient = await ClinicalService.getPatientById(pool, req.params.id);
        res.json(patient);
    } catch (err) {
        console.error('Get patient by ID error:', err);
        res.status(err.message.includes('not found') ? 404 : 500).json({ error: err.message });
    }
});

// POST Register New Patient (With duplicate prevention)
app.post('/api/clinical/patients', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const { userId } = req.body;
        const result = await ClinicalService.createPatient(pool, req.body, userId || 1);
        res.json(result);
    } catch (err) {
        console.error('Create patient error:', err);
        const isDuplicate = err.message.includes('Duplicate patient');
        res.status(isDuplicate ? 409 : 500).json({ error: err.message });
    }
});

// PUT Update Patient Demographic & Contact Details
app.put('/api/clinical/patients/:id', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const { userId } = req.body;
        const result = await ClinicalService.updatePatient(pool, req.params.id, req.body, userId || 1);
        res.json(result);
    } catch (err) {
        console.error('Update patient error:', err);
        const isDuplicate = err.message.includes('already registered');
        res.status(isDuplicate ? 409 : 500).json({ error: err.message });
    }
});

// GET Patient Unified Medical History (Encounters + Pharmacy Dispensing)
app.get('/api/clinical/patients/:id/history', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const history = await ClinicalService.getPatientMedicalHistory(pool, req.params.id);
        res.json(history);
    } catch (err) {
        console.error('Patient history error:', err);
        res.status(err.message.includes('not found') ? 404 : 500).json({ error: err.message });
    }
});

// GET List of Encounters across clinic
app.get('/api/clinical/encounters', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const encounters = await ClinicalService.getEncountersList(pool, req.query);
        res.json(encounters);
    } catch (err) {
        console.error('Get encounters list error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET Encounter by ID
app.get('/api/clinical/encounters/:id', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const encounter = await ClinicalService.getEncounterById(pool, req.params.id);
        res.json(encounter);
    } catch (err) {
        console.error('Get encounter by ID error:', err);
        res.status(err.message.includes('not found') ? 404 : 500).json({ error: err.message });
    }
});

// POST Create Clinical Encounter / Consultation
app.post('/api/clinical/encounters', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const { userId } = req.body;
        const result = await ClinicalService.createEncounter(pool, req.body, userId || 1);
        res.json(result);
    } catch (err) {
        console.error('Create encounter error:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT Update In-Progress Clinical Encounter
app.put('/api/clinical/encounters/:id', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const { userId } = req.body;
        const result = await ClinicalService.updateEncounter(pool, req.params.id, req.body, userId || 1);
        res.json(result);
    } catch (err) {
        console.error('Update encounter error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST Finalize Clinical Encounter
app.post('/api/clinical/encounters/:id/finalize', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const { userId } = req.body;
        const result = await ClinicalService.finalizeEncounter(pool, req.params.id, userId || 1);
        res.json(result);
    } catch (err) {
        console.error('Finalize encounter error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST Amend Finalized Clinical Encounter (With Audit Trail)
app.post('/api/clinical/encounters/:id/amend', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const { userId } = req.body;
        const result = await ClinicalService.amendEncounter(pool, req.params.id, req.body, userId || 1);
        res.json(result);
    } catch (err) {
        console.error('Amend encounter error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// PHASE 9: CLINICAL WORKFLOW INTEGRATION
// ==========================================

// GET Pharmacy Prescriptions Queue
app.get('/api/pharmacy/prescriptions', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const { status, search, startDate, endDate } = req.query;
        const queue = await PrescriptionService.getPrescriptionsQueue(pool, { status, search, startDate, endDate });
        res.json(queue);
    } catch (err) {
        console.error('Get prescriptions queue error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET Prescription Fulfillment Details (with FEFO stock check)
app.get('/api/pharmacy/prescriptions/:id/fulfillment', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const details = await PrescriptionService.getPrescriptionFulfillmentDetails(pool, req.params.id);
        res.json(details);
    } catch (err) {
        console.error('Get prescription fulfillment details error:', err);
        res.status(err.message.includes('not found') ? 404 : 500).json({ error: err.message });
    }
});

// POST Dispense Prescription (Full or Partial with FEFO deduction)
app.post('/api/pharmacy/prescriptions/:id/dispense', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const { userId, items, remarks } = req.body;
        const result = await PrescriptionService.dispensePrescription(pool, {
            prescriptionId: req.params.id,
            items,
            remarks
        }, userId || 1);
        res.json(result);
    } catch (err) {
        console.error('Dispense prescription error:', err);
        res.status(400).json({ error: err.message });
    }
});

// POST Create Prescription for Clinical Encounter
app.post('/api/clinical/encounters/:encounterId/prescriptions', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const { userId } = req.body;
        const result = await PrescriptionService.createPrescription(pool, {
            ...req.body,
            encounterId: req.params.encounterId
        }, userId || 1);
        res.json(result);
    } catch (err) {
        console.error('Create prescription error:', err);
        res.status(400).json({ error: err.message });
    }
});

// GET Prescriptions for Clinical Encounter
app.get('/api/clinical/encounters/:encounterId/prescriptions', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const list = await PrescriptionService.getPrescriptionsByEncounter(pool, req.params.encounterId);
        res.json(list);
    } catch (err) {
        console.error('Get prescriptions by encounter error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET Single Prescription by ID
app.get('/api/clinical/prescriptions/:id', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const prescription = await PrescriptionService.getPrescriptionById(pool, req.params.id);
        res.json(prescription);
    } catch (err) {
        console.error('Get prescription by ID error:', err);
        res.status(err.message.includes('not found') ? 404 : 500).json({ error: err.message });
    }
});

// POST Cancel Prescription
app.post('/api/clinical/prescriptions/:id/cancel', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const { reason, userId } = req.body;
        const result = await PrescriptionService.cancelPrescription(pool, req.params.id, reason, userId || 1);
        res.json(result);
    } catch (err) {
        console.error('Cancel prescription error:', err);
        res.status(400).json({ error: err.message });
    }
});


// =========================================================================
// PHASE 11: BARANGAY DISTRIBUTION ACCOUNTABILITY & TRACEABILITY ENDPOINTS
// =========================================================================

// Helper to extract authenticated userId from header, query, or body
function getAuthUserId(req) {
    const raw = req.headers['x-user-id'] || req.query.userId || (req.body && req.body.userId);
    return raw ? parseInt(raw, 10) : null;
}

// GET All Barangay Health Stations (for selection/dropdowns)
app.get('/api/barangay/locations', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query(`
            SELECT LocationID, LocationName, LocationType, CreatedDate 
            FROM Warehouse_Locations 
            WHERE LocationType = 'Barangay' AND IsDeleted = 0 
            ORDER BY LocationName ASC
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error('Get barangay locations error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET Current User Barangay Profile / Scope
app.get('/api/barangay/me', async (req, res) => {
    try {
        const userId = getAuthUserId(req);
        if (!userId) return res.status(401).json({ error: 'User ID is required.' });
        const pool = await sql.connect(config);
        const scope = await BarangayService.getUserScope(pool, userId);
        res.json(scope);
    } catch (err) {
        console.error('Get user scope error:', err);
        res.status(400).json({ error: err.message });
    }
});

// POST Submit Stock Request from Barangay
app.post('/api/barangay/stock-requests', async (req, res) => {
    try {
        const userId = getAuthUserId(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized: User ID required.' });
        const pool = await sql.connect(config);
        const result = await BarangayService.createStockRequest(pool, userId, req.body);
        res.status(201).json(result);
    } catch (err) {
        console.error('Barangay create stock request error:', err);
        const code = (err.message.includes('Access Denied') || err.message.includes('access denied')) ? 403 : (err.message.includes('inactive') || err.message.includes('not found')) ? 401 : 400;
        res.status(code).json({ error: err.message });
    }
});

// GET Stock Requests Scoped to Barangay
app.get('/api/barangay/stock-requests', async (req, res) => {
    try {
        const userId = getAuthUserId(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized: User ID required.' });
        const pool = await sql.connect(config);
        const requests = await BarangayService.getStockRequests(pool, userId, req.query);
        res.json(requests);
    } catch (err) {
        console.error('Barangay get stock requests error:', err);
        const code = (err.message.includes('Access Denied') || err.message.includes('access denied')) ? 403 : (err.message.includes('inactive') || err.message.includes('not found')) ? 401 : 400;
        res.status(code).json({ error: err.message });
    }
});

// GET Single Stock Request Details
app.get('/api/barangay/stock-requests/:id', async (req, res) => {
    try {
        const userId = getAuthUserId(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized: User ID required.' });
        const pool = await sql.connect(config);
        const details = await BarangayService.getStockRequestDetails(pool, req.params.id, userId);
        res.json(details);
    } catch (err) {
        console.error('Barangay get stock request details error:', err);
        const status = err.message.includes('not found') ? 404 :
                       (err.message.includes('Access Denied') || err.message.includes('access denied')) ? 403 : 400;
        res.status(status).json({ error: err.message });
    }
});

// GET Incoming Distributions for Barangay
app.get('/api/barangay/distributions/incoming', async (req, res) => {
    try {
        const userId = getAuthUserId(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized: User ID required.' });
        const pool = await sql.connect(config);
        const incoming = await BarangayService.getIncomingDistributions(pool, userId, req.query);
        res.json(incoming);
    } catch (err) {
        console.error('Barangay incoming distributions error:', err);
        const code = (err.message.includes('Access Denied') || err.message.includes('access denied')) ? 403 : (err.message.includes('inactive') || err.message.includes('not found')) ? 401 : 400;
        res.status(code).json({ error: err.message });
    }
});

// GET Distribution details for receipt confirmation
app.get('/api/barangay/distributions/:id', async (req, res) => {
    try {
        const userId = getAuthUserId(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized: User ID required.' });
        const pool = await sql.connect(config);
        const dist = await BarangayService.getDistributionForReceipt(pool, req.params.id, userId);
        res.json(dist);
    } catch (err) {
        console.error('Barangay get distribution for receipt error:', err);
        res.status(err.message.includes('not found') ? 404 : 403).json({ error: err.message });
    }
});

// POST Confirm Receipt of Distribution into Barangay Inventory
app.post('/api/barangay/distributions/:id/receive', async (req, res) => {
    try {
        const userId = getAuthUserId(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized: User ID required.' });
        const pool = await sql.connect(config);
        const result = await BarangayService.receiveDistribution(pool, req.params.id, userId, req.body);
        res.json(result);
    } catch (err) {
        console.error('Barangay receive distribution error:', err);
        const status = err.message.includes('Access Denied') ? 403 : 400;
        res.status(status).json({ error: err.message });
    }
});

// GET Barangay Local Inventory
app.get('/api/barangay/inventory', async (req, res) => {
    try {
        const userId = getAuthUserId(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized: User ID required.' });
        const pool = await sql.connect(config);
        const inventory = await BarangayService.getInventory(pool, userId, req.query);
        res.json(inventory);
    } catch (err) {
        console.error('Barangay get inventory error:', err);
        const code = (err.message.includes('Access Denied') || err.message.includes('access denied')) ? 403 : (err.message.includes('inactive') || err.message.includes('not found')) ? 401 : 400;
        res.status(code).json({ error: err.message });
    }
});

// GET Barangay Inventory Movement Ledger
app.get('/api/barangay/movements', async (req, res) => {
    try {
        const userId = getAuthUserId(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized: User ID required.' });
        const pool = await sql.connect(config);
        const movements = await BarangayService.getMovementLedger(pool, userId, req.query);
        res.json(movements);
    } catch (err) {
        console.error('Barangay get movements error:', err);
        const code = (err.message.includes('Access Denied') || err.message.includes('access denied')) ? 403 : (err.message.includes('inactive') || err.message.includes('not found')) ? 401 : 400;
        res.status(code).json({ error: err.message });
    }
});

// POST Disburse Medicines to Patient / Resident
app.post('/api/barangay/disburse', async (req, res) => {
    try {
        const userId = getAuthUserId(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized: User ID required.' });
        const pool = await sql.connect(config);
        const result = await BarangayService.disburseMedicines(pool, userId, req.body);
        res.status(201).json(result);
    } catch (err) {
        console.error('Barangay disburse medicines error:', err);
        const code = (err.message.includes('Access Denied') || err.message.includes('access denied')) ? 403 : (err.message.includes('inactive') || err.message.includes('not found')) ? 401 : 400;
        res.status(code).json({ error: err.message });
    }
});

// GET Barangay Disbursement History
app.get('/api/barangay/disbursements', async (req, res) => {
    try {
        const userId = getAuthUserId(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized: User ID required.' });
        const pool = await sql.connect(config);
        const disbursements = await BarangayService.getDisbursements(pool, userId, req.query);
        res.json(disbursements);
    } catch (err) {
        console.error('Barangay get disbursements error:', err);
        const code = (err.message.includes('Access Denied') || err.message.includes('access denied')) ? 403 : (err.message.includes('inactive') || err.message.includes('not found')) ? 401 : 400;
        res.status(code).json({ error: err.message });
    }
});

// GET Barangay Disbursement Details for Voucher
app.get('/api/barangay/disbursements/:id', async (req, res) => {
    try {
        const userId = getAuthUserId(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized: User ID required.' });
        const pool = await sql.connect(config);
        const details = await BarangayService.getDisbursementDetails(pool, req.params.id, userId);
        res.json(details);
    } catch (err) {
        console.error('Barangay get disbursement details error:', err);
        const code = (err.message.includes('Access Denied') || err.message.includes('access denied')) ? 403 : (err.message.includes('inactive') || err.message.includes('not found')) ? 401 : 400;
        res.status(code).json({ error: err.message });
    }
});

// GET End-to-End Traceability by Lot Number
app.get('/api/traceability/lot/:lotNumber', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const data = await BarangayService.getTraceabilityByLot(pool, req.params.lotNumber);
        res.json(data);
    } catch (err) {
        console.error('Traceability by lot error:', err);
        res.status(err.message.includes('not found') ? 404 : 400).json({ error: err.message });
    }
});

// GET System-Wide Distribution Audit & Discrepancy Summary
app.get('/api/traceability/distributions', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const { status, destinationType, hasDiscrepancy, search } = req.query;

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
                d.CreatedDate,
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

        const request = pool.request();

        if (status) {
            query += ` AND d.Status = @status`;
            request.input('status', sql.NVarChar, status);
        }

        if (destinationType) {
            query += ` AND destLoc.LocationType = @destinationType`;
            request.input('destinationType', sql.NVarChar, destinationType);
        }

        if (hasDiscrepancy === 'true' || hasDiscrepancy === '1') {
            query += ` AND d.HasDiscrepancy = 1`;
        }

        if (search) {
            query += ` AND (d.DistributionNumber LIKE @search OR sr.RequestNumber LIKE @search OR destLoc.LocationName LIKE @search)`;
            request.input('search', sql.NVarChar, `%${search}%`);
        }

        query += ` ORDER BY d.CreatedDate DESC`;

        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error('Traceability distributions error:', err);
        res.status(500).json({ error: err.message });
    }
});



// =========================================================================
// PHASE 12: MEDICINE RELEASE ACCOUNTABILITY & CENTRALIZED DISTRIBUTION AUDIT
// =========================================================================

// --- ADMIN ACCOUNT MANAGEMENT ---

app.get('/api/admin/accounts', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        await verifyAdminAuth(req, pool);
        const accounts = await AccountService.getAccounts(pool, req.query);
        res.json(accounts);
    } catch (err) {
        console.error('Get accounts error:', err);
        const code = err.statusCode || (err.message.includes('Access Denied') ? 403 : err.message.includes('Unauthorized') ? 401 : 500);
        res.status(code).json({ error: err.message });
    }
});

app.get('/api/admin/accounts/:id', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        await verifyAdminAuth(req, pool);
        const account = await AccountService.getAccountById(pool, req.params.id);
        res.json(account);
    } catch (err) {
        console.error('Get account by ID error:', err);
        const code = err.statusCode || (err.message.includes('Access Denied') ? 403 : err.message.includes('not found') ? 404 : err.message.includes('Unauthorized') ? 401 : 500);
        res.status(code).json({ error: err.message });
    }
});

app.post('/api/admin/accounts', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const admin = await verifyAdminAuth(req, pool);
        const adminUserId = admin.UserID;
        const result = await AccountService.createAccount(pool, adminUserId, req.body);
        res.status(201).json(result);
    } catch (err) {
        console.error('Create account error:', err);
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/admin/accounts/:id/assignment', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const admin = await verifyAdminAuth(req, pool);
        const adminUserId = admin.UserID;
        const { newLocationId, reason } = req.body;
        const result = await AccountService.reassignStation(pool, adminUserId, req.params.id, newLocationId, reason);
        res.json(result);
    } catch (err) {
        console.error('Reassign station error:', err);
        const code = err.statusCode || (err.message.includes('Access Denied') ? 403 : err.message.includes('Unauthorized') ? 401 : 400);
        res.status(code).json({ error: err.message });
    }
});

app.put('/api/admin/accounts/:id/status', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const admin = await verifyAdminAuth(req, pool);
        const adminUserId = admin.UserID;
        const { isActive, reason } = req.body;
        const result = await AccountService.updateAccountStatus(pool, adminUserId, req.params.id, isActive, reason);
        res.json(result);
    } catch (err) {
        console.error('Update account status error:', err);
        const code = err.statusCode || (err.message.includes('Access Denied') ? 403 : err.message.includes('Unauthorized') ? 401 : 400);
        res.status(code).json({ error: err.message });
    }
});

app.post('/api/admin/accounts/:id/reset-password', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const admin = await verifyAdminAuth(req, pool);
        const adminUserId = admin.UserID;
        const { newPassword, reason } = req.body;
        const result = await AccountService.resetPassword(pool, adminUserId, req.params.id, newPassword, reason);
        res.json(result);
    } catch (err) {
        console.error('Reset password error:', err);
        const code = err.statusCode || (err.message.includes('Access Denied') ? 403 : err.message.includes('Unauthorized') ? 401 : 400);
        res.status(code).json({ error: err.message });
    }
});

// --- BARANGAY DISBURSEMENT REVERSAL ---

app.post('/api/barangay/disbursements/:id/reverse', async (req, res) => {
    try {
        const userId = getAuthUserId(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized: User ID required.' });
        const { reason } = req.body;
        const pool = await sql.connect(config);
        const result = await BarangayService.reverseDisbursement(pool, req.params.id, userId, reason);
        res.json(result);
    } catch (err) {
        console.error('Reverse disbursement error:', err);
        const code = (err.message.includes('Access Denied') || err.message.includes('access denied')) ? 403 : (err.message.includes('inactive') || err.message.includes('not found')) ? 401 : 400;
        res.status(code).json({ error: err.message });
    }
});

// --- 10 CENTRALIZED DISTRIBUTION AUDIT & ACCOUNTABILITY REPORTS ---

// 1. Central Warehouse Distribution Report

// Centralized Stock Request & Fulfillment Traceability Report
app.get('/api/reports/stock-requests-traceability', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const report = await ReportService.getStockRequestTraceabilityReport(pool, req.query);
        res.json(report);
    } catch (err) {
        console.error("Stock Requests Traceability Report error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/reports/warehouse-distributions', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const report = await ReportService.getWarehouseDistributionReport(pool, req.query);
        res.json(report);
    } catch (err) {
        console.error('Warehouse distribution report error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 2. City Pharmacy Medicine Release Report
app.get('/api/reports/pharmacy-releases', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const report = await ReportService.getPharmacyReleaseReport(pool, req.query);
        res.json(report);
    } catch (err) {
        console.error('Pharmacy release report error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 3. Barangay Medicine Receiving Report
app.get('/api/reports/barangay-receipts', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const report = await ReportService.getBarangayReceivingReport(pool, req.query);
        res.json(report);
    } catch (err) {
        console.error('Barangay receiving report error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 4. Barangay Patient Disbursement Report
app.get('/api/reports/barangay-disbursements', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const report = await ReportService.getBarangayDisbursementReport(pool, req.query);
        res.json(report);
    } catch (err) {
        console.error('Barangay disbursement report error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 5. Barangay Inventory Balance Report
app.get('/api/reports/barangay-inventory', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const report = await ReportService.getBarangayInventoryBalanceReport(pool, req.query);
        res.json(report);
    } catch (err) {
        console.error('Barangay inventory balance report error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 6. Unreceived Distribution Report
app.get('/api/reports/unreceived-distributions', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        await verifyElevatedAuth(req, pool);
        const report = await ReportService.getUnreceivedDistributionReport(pool, req.query);
        res.json(report);
    } catch (err) {
        console.error('Unreceived distribution report error:', err);
        const code = err.statusCode || (err.message.includes('Access Denied') ? 403 : err.message.includes('Unauthorized') ? 401 : 500);
        res.status(code).json({ error: err.message });
    }
});

// 7. Distribution Discrepancy Report
app.get('/api/reports/distribution-discrepancies', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        await verifyElevatedAuth(req, pool);
        const report = await ReportService.getDistributionDiscrepancyReport(pool, req.query);
        res.json(report);
    } catch (err) {
        console.error('Distribution discrepancy report error:', err);
        const code = err.statusCode || (err.message.includes('Access Denied') ? 403 : err.message.includes('Unauthorized') ? 401 : 500);
        res.status(code).json({ error: err.message });
    }
});

// 8. Medicine Batch Traceability Report
app.get('/api/reports/batch-traceability/:lotNumber', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const report = await ReportService.getBatchTraceabilityReport(pool, req.params.lotNumber);
        res.json(report);
    } catch (err) {
        console.error('Batch traceability report error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 9. Personnel Accountability Report
app.get('/api/reports/personnel-accountability', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        await verifyElevatedAuth(req, pool);
        const report = await ReportService.getPersonnelAccountabilityReport(pool, req.query);
        res.json(report);
    } catch (err) {
        console.error('Personnel accountability report error:', err);
        const code = err.statusCode || (err.message.includes('Access Denied') ? 403 : err.message.includes('Unauthorized') ? 401 : 500);
        res.status(code).json({ error: err.message });
    }
});

// 10. City-Wide Medicine Movement Report
app.get('/api/reports/citywide-movements', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        await verifyElevatedAuth(req, pool);
        const report = await ReportService.getCityWideMovementReport(pool, req.query);
        res.json(report);
    } catch (err) {
        console.error('Citywide movement report error:', err);
        const code = err.statusCode || (err.message.includes('Access Denied') ? 403 : err.message.includes('Unauthorized') ? 401 : 500);
        res.status(code).json({ error: err.message });
    }
});

// 11. Phase 14 (Workstream 14.3): System-Wide Cross-Facility Inventory Reconciliation Report
app.get('/api/warehouse/reconciliation/cross-facility', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const report = await ReconciliationService.getCrossFacilityReconciliation(pool);
        res.json(report);
    } catch (err) {
        console.error('Cross-facility reconciliation error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/reports/inventory-reconciliation', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        if (req.headers['x-user-id'] || req.query.userId) {
            await verifyElevatedAuth(req, pool);
        }
        const report = await ReconciliationService.getCrossFacilityReconciliation(pool);
        res.json(report);
    } catch (err) {
        console.error('Inventory reconciliation report error:', err);
        const code = err.statusCode || (err.message.includes('Access Denied') ? 403 : err.message.includes('Unauthorized') ? 401 : 500);
        res.status(code).json({ error: err.message });
    }
});

// 12. Phase 14 (Workstream 14.5): Non-Destructive Database Backup, Integrity & Recovery Status
app.get('/api/admin/database-health', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        await verifyAdminAuth(req, pool);
        const health = await ReconciliationService.getDatabaseBackupAndIntegrityStatus(pool);
        res.json(health);
    } catch (err) {
        console.error('Database health verification error:', err);
        const code = err.statusCode || (err.message.includes('Access Denied') ? 403 : err.message.includes('Unauthorized') ? 401 : 500);
        res.status(code).json({ error: err.message });
    }
});

app.listen(PORT, '0.0.0.0', () => { console.log(`Server running at http://0.0.0.0:${PORT}`); });
