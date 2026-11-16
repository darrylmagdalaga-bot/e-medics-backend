const sql = require('mssql');

class AccountService {

    /**
     * List all system accounts with station details, role, and status.
     * Accessible by Admin.
     */
    static async getAccounts(pool, filters = {}) {
        const { role, locationId, search, status } = filters;
        let query = `
            SELECT 
                u.UserID,
                u.Username,
                u.FullName,
                u.Role,
                u.Barangay,
                u.LocationID,
                u.IsActive,
                u.DateCreated,
                u.LastLogin,
                loc.LocationName,
                loc.LocationType,
                loc.Classification,
                ISNULL(u.MustChangePassword, 0) AS MustChangePassword,
                (SELECT COUNT(*) FROM User_AuditLogs WHERE TargetUserID = u.UserID) AS AuditLogCount
            FROM Users u
            LEFT JOIN Warehouse_Locations loc ON u.LocationID = loc.LocationID
            WHERE 1=1
        `;

        const req = pool.request();

        if (role) {
            query += ' AND u.Role = @role';
            req.input('role', sql.NVarChar, role);
        }

        if (locationId) {
            query += ' AND u.LocationID = @locationId';
            req.input('locationId', sql.Int, Number(locationId));
        }

        if (status !== undefined && status !== '' && status !== 'ALL') {
            const isActive = status === 'active' || status === '1' || status === true;
            query += ' AND u.IsActive = @isActive';
            req.input('isActive', sql.Bit, isActive ? 1 : 0);
        }

        if (search) {
            query += ` AND (u.Username LIKE @search OR u.FullName LIKE @search OR u.Barangay LIKE @search OR loc.LocationName LIKE @search)`;
            req.input('search', sql.NVarChar, `%${search}%`);
        }

        query += ' ORDER BY u.Role ASC, loc.LocationName ASC, u.Username ASC';

        const res = await req.query(query);
        return res.recordset;
    }

    /**
     * Get single user account details with audit log history.
     */
    static async getAccountById(pool, targetUserId) {
        const req = pool.request();
        req.input('id', sql.Int, targetUserId);

        const userRes = await req.query(`
            SELECT 
                u.UserID, u.Username, u.FullName, u.Role, u.Barangay, 
                u.LocationID, u.IsActive, u.DateCreated, u.LastLogin,
                loc.LocationName, loc.LocationType, loc.Classification, ISNULL(u.MustChangePassword, 0) AS MustChangePassword
            FROM Users u
            LEFT JOIN Warehouse_Locations loc ON u.LocationID = loc.LocationID
            WHERE u.UserID = @id
        `);

        if (userRes.recordset.length === 0) {
            throw new Error(`User account with ID ${targetUserId} not found.`);
        }

        const auditReq = pool.request();
        auditReq.input('id', sql.Int, targetUserId);
        const auditRes = await auditReq.query(`
            SELECT 
                al.*,
                prevLoc.LocationName AS PreviousLocationName,
                newLoc.LocationName AS NewLocationName,
                adminUser.FullName AS PerformedByName
            FROM User_AuditLogs al
            LEFT JOIN Warehouse_Locations prevLoc ON al.PreviousLocationID = prevLoc.LocationID
            LEFT JOIN Warehouse_Locations newLoc ON al.NewLocationID = newLoc.LocationID
            LEFT JOIN Users adminUser ON al.PerformedByUserID = adminUser.UserID
            WHERE al.TargetUserID = @id
            ORDER BY al.PerformedDate DESC
        `);

        return {
            account: userRes.recordset[0],
            auditLogs: auditRes.recordset
        };
    }

    /**
     * Create a new BHW or Staff Account.
     */
    static async createAccount(pool, adminUserId, data) {
        const { username, password, fullName, role, locationId, barangay } = data;

        if (!username || !password || !fullName || !role) {
            throw new Error('Username, password, full name, and role are required.');
        }

        const cleanUsername = username.trim().toLowerCase();

        // Check duplicate username
        const checkReq = pool.request();
        checkReq.input('username', sql.NVarChar, cleanUsername);
        const checkRes = await checkReq.query('SELECT UserID FROM Users WHERE LOWER(Username) = LOWER(@username)');
        if (checkRes.recordset.length > 0) {
            throw new Error(`Username "${cleanUsername}" already exists. Please choose another username.`);
        }

        let assignedLocId = locationId ? Number(locationId) : null;
        let assignedBarangay = barangay ? barangay.trim() : null;

        // Verify location exists if provided
        if (assignedLocId) {
            const locReq = pool.request();
            locReq.input('locId', sql.Int, assignedLocId);
            const locRes = await locReq.query('SELECT LocationName FROM Warehouse_Locations WHERE LocationID = @locId AND IsDeleted = 0');
            if (locRes.recordset.length === 0) {
                throw new Error(`Location ID ${assignedLocId} does not exist.`);
            }
            if (!assignedBarangay) {
                assignedBarangay = locRes.recordset[0].LocationName.replace(/^BHS\s+/, '').trim();
            }
        }

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const insertReq = new sql.Request(transaction);
            insertReq.input('username', sql.NVarChar, cleanUsername);
            insertReq.input('password', sql.NVarChar, password.trim());
            insertReq.input('role', sql.NVarChar, role);
            insertReq.input('fullName', sql.NVarChar, fullName.trim());
            insertReq.input('bgy', sql.NVarChar, assignedBarangay);
            insertReq.input('locId', sql.Int, assignedLocId);

            const insertRes = await insertReq.query(`
                INSERT INTO Users (
                    Username, Password, Role, FullName, Barangay, LocationID, IsActive, MustChangePassword, DateCreated
                )
                OUTPUT INSERTED.UserID
                VALUES (
                    @username, @password, @role, @fullName, @bgy, @locId, 1, 1, SYSUTCDATETIME()
                )
            `);

            const newUserId = insertRes.recordset[0].UserID;

            // Log audit record
            const auditReq = new sql.Request(transaction);
            auditReq.input('targetId', sql.Int, newUserId);
            auditReq.input('action', sql.NVarChar, 'CREATE_ACCOUNT');
            auditReq.input('locId', sql.Int, assignedLocId);
            auditReq.input('bgy', sql.NVarChar, assignedBarangay);
            auditReq.input('reason', sql.NVarChar, `Created account ${cleanUsername} assigned to ${assignedBarangay || 'Central'}`);
            auditReq.input('adminId', sql.Int, adminUserId);

            await auditReq.query(`
                INSERT INTO User_AuditLogs (
                    TargetUserID, Action, PreviousLocationID, NewLocationID,
                    PreviousBarangay, NewBarangay, PreviousStatus, NewStatus,
                    Reason, PerformedByUserID, PerformedDate
                )
                VALUES (
                    @targetId, @action, NULL, @locId,
                    NULL, @bgy, NULL, 1,
                    @reason, @adminId, SYSUTCDATETIME()
                )
            `);

            await transaction.commit();

            return {
                success: true,
                userId: newUserId,
                username: cleanUsername,
                role,
                barangay: assignedBarangay,
                locationId: assignedLocId
            };
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    }

    /**
     * Reassign an account's Barangay Health Station with mandatory audit log and justification.
     */
    static async reassignStation(pool, adminUserId, targetUserId, newLocationId, reason) {
        if (!newLocationId) {
            throw new Error('New Location ID is required for station reassignment.');
        }

        if (!reason || !reason.trim()) {
            throw new Error('A documented authorization reason is mandatory for changing account station assignment.');
        }

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // Lock and fetch target user
            const userReq = new sql.Request(transaction);
            userReq.input('id', sql.Int, targetUserId);
            const userRes = await userReq.query(`
                SELECT UserID, Username, Role, Barangay, LocationID, IsActive 
                FROM Users WITH (UPDLOCK, ROWLOCK)
                WHERE UserID = @id
            `);

            if (userRes.recordset.length === 0) {
                throw new Error(`User account with ID ${targetUserId} not found.`);
            }

            const currentUser = userRes.recordset[0];

            // Verify new location exists
            const locReq = new sql.Request(transaction);
            locReq.input('locId', sql.Int, Number(newLocationId));
            const locRes = await locReq.query(`
                SELECT LocationID, LocationName, LocationType 
                FROM Warehouse_Locations 
                WHERE LocationID = @locId AND IsDeleted = 0
            `);

            if (locRes.recordset.length === 0) {
                throw new Error(`Location ID ${newLocationId} does not exist.`);
            }

            const newStation = locRes.recordset[0];
            const newBarangay = newStation.LocationName.replace(/^BHS\s+/, '').trim();

            // Update user record
            const updateReq = new sql.Request(transaction);
            updateReq.input('id', sql.Int, targetUserId);
            updateReq.input('locId', sql.Int, newStation.LocationID);
            updateReq.input('bgy', sql.NVarChar, newBarangay);

            await updateReq.query(`
                UPDATE Users
                SET LocationID = @locId,
                    Barangay = @bgy
                WHERE UserID = @id
            `);

            // Write immutable audit log
            const auditReq = new sql.Request(transaction);
            auditReq.input('targetId', sql.Int, targetUserId);
            auditReq.input('action', sql.NVarChar, 'STATION_REASSIGNMENT');
            auditReq.input('prevLocId', sql.Int, currentUser.LocationID);
            auditReq.input('newLocId', sql.Int, newStation.LocationID);
            auditReq.input('prevBgy', sql.NVarChar, currentUser.Barangay);
            auditReq.input('newBgy', sql.NVarChar, newBarangay);
            auditReq.input('reason', sql.NVarChar, reason.trim());
            auditReq.input('adminId', sql.Int, adminUserId);

            await auditReq.query(`
                INSERT INTO User_AuditLogs (
                    TargetUserID, Action, PreviousLocationID, NewLocationID,
                    PreviousBarangay, NewBarangay, PreviousStatus, NewStatus,
                    Reason, PerformedByUserID, PerformedDate
                )
                VALUES (
                    @targetId, @action, @prevLocId, @newLocId,
                    @prevBgy, @newBgy, currentUser_status, currentUser_status,
                    @reason, @adminId, SYSUTCDATETIME()
                )
            `.replace('currentUser_status, currentUser_status', currentUser.IsActive ? '1, 1' : '0, 0'));

            await transaction.commit();

            return {
                success: true,
                userId: targetUserId,
                username: currentUser.Username,
                previousLocationId: currentUser.LocationID,
                previousBarangay: currentUser.Barangay,
                newLocationId: newStation.LocationID,
                newBarangay,
                stationName: newStation.LocationName,
                reason: reason.trim()
            };
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    }

    /**
     * Activate or deactivate account with audit logging.
     */
    static async updateAccountStatus(pool, adminUserId, targetUserId, isActive, reason) {
        if (!reason || !reason.trim()) {
            throw new Error('A documented reason is required to activate or deactivate an account.');
        }

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const userReq = new sql.Request(transaction);
            userReq.input('id', sql.Int, targetUserId);
            const userRes = await userReq.query(`
                SELECT UserID, Username, Barangay, LocationID, IsActive 
                FROM Users WITH (UPDLOCK, ROWLOCK)
                WHERE UserID = @id
            `);

            if (userRes.recordset.length === 0) {
                throw new Error(`User account with ID ${targetUserId} not found.`);
            }

            const currentUser = userRes.recordset[0];
            const newStatus = Boolean(isActive);

            // Update user
            const updateReq = new sql.Request(transaction);
            updateReq.input('id', sql.Int, targetUserId);
            updateReq.input('status', sql.Bit, newStatus ? 1 : 0);
            await updateReq.query('UPDATE Users SET IsActive = @status WHERE UserID = @id');

            // Audit log
            const auditReq = new sql.Request(transaction);
            auditReq.input('targetId', sql.Int, targetUserId);
            auditReq.input('action', sql.NVarChar, newStatus ? 'ACCOUNT_ACTIVATED' : 'ACCOUNT_DEACTIVATED');
            auditReq.input('locId', sql.Int, currentUser.LocationID);
            auditReq.input('bgy', sql.NVarChar, currentUser.Barangay);
            auditReq.input('prevStatus', sql.Bit, currentUser.IsActive ? 1 : 0);
            auditReq.input('newStatus', sql.Bit, newStatus ? 1 : 0);
            auditReq.input('reason', sql.NVarChar, reason.trim());
            auditReq.input('adminId', sql.Int, adminUserId);

            await auditReq.query(`
                INSERT INTO User_AuditLogs (
                    TargetUserID, Action, PreviousLocationID, NewLocationID,
                    PreviousBarangay, NewBarangay, PreviousStatus, NewStatus,
                    Reason, PerformedByUserID, PerformedDate
                )
                VALUES (
                    @targetId, @action, @locId, @locId,
                    @bgy, @bgy, @prevStatus, @newStatus,
                    @reason, @adminId, SYSUTCDATETIME()
                )
            `);

            await transaction.commit();

            return {
                success: true,
                userId: targetUserId,
                username: currentUser.Username,
                isActive: newStatus,
                reason: reason.trim()
            };
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    }

    /**
     * Reset user password with audit logging.
     */
    static async resetPassword(pool, adminUserId, targetUserId, newPassword, reason) {
        if (!newPassword || newPassword.trim().length < 4) {
            throw new Error('Password must be at least 4 characters long.');
        }

        if (!reason || !reason.trim()) {
            throw new Error('A documented reason is required for administrative credential reset.');
        }

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const userReq = new sql.Request(transaction);
            userReq.input('id', sql.Int, targetUserId);
            const userRes = await userReq.query(`
                SELECT UserID, Username, Barangay, LocationID, IsActive 
                FROM Users WITH (UPDLOCK, ROWLOCK)
                WHERE UserID = @id
            `);

            if (userRes.recordset.length === 0) {
                throw new Error(`User account with ID ${targetUserId} not found.`);
            }

            const currentUser = userRes.recordset[0];

            // Update password
            const updateReq = new sql.Request(transaction);
            updateReq.input('id', sql.Int, targetUserId);
            updateReq.input('pw', sql.NVarChar, newPassword.trim());
            await updateReq.query('UPDATE Users SET Password = @pw, MustChangePassword = 1 WHERE UserID = @id');

            // Log audit
            const auditReq = new sql.Request(transaction);
            auditReq.input('targetId', sql.Int, targetUserId);
            auditReq.input('action', sql.NVarChar, 'PASSWORD_RESET');
            auditReq.input('locId', sql.Int, currentUser.LocationID);
            auditReq.input('bgy', sql.NVarChar, currentUser.Barangay);
            auditReq.input('status', sql.Bit, currentUser.IsActive ? 1 : 0);
            auditReq.input('reason', sql.NVarChar, reason.trim());
            auditReq.input('adminId', sql.Int, adminUserId);

            await auditReq.query(`
                INSERT INTO User_AuditLogs (
                    TargetUserID, Action, PreviousLocationID, NewLocationID,
                    PreviousBarangay, NewBarangay, PreviousStatus, NewStatus,
                    Reason, PerformedByUserID, PerformedDate
                )
                VALUES (
                    @targetId, @action, @locId, @locId,
                    @bgy, @bgy, @status, @status,
                    @reason, @adminId, SYSUTCDATETIME()
                )
            `);

            await transaction.commit();

            return {
                success: true,
                userId: targetUserId,
                username: currentUser.Username,
                message: 'Password successfully reset.',
                reason: reason.trim()
            };
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    }
}

module.exports = AccountService;
