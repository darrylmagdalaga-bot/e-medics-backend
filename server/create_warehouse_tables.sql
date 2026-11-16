-- ==============================================================================
-- eMEDICS Enterprise Warehouse Domain Schema Redesign
-- ==============================================================================
-- Description: Creates the foundation for the Warehouse Domain.
-- Includes full auditability (8 columns per table), soft deletes, row versioning,
-- and strict transactional constraints for tracing medicine from supplier to patient.
-- ==============================================================================

-- 1. MASTER DATA TABLES

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Warehouse_Suppliers' AND xtype='U')
CREATE TABLE Warehouse_Suppliers (
    SupplierID INT IDENTITY(1,1) PRIMARY KEY,
    SupplierName NVARCHAR(200) NOT NULL UNIQUE,
    ContactPerson NVARCHAR(100) NULL,
    ContactNumber NVARCHAR(50) NULL,
    Address NVARCHAR(500) NULL,
    TaxIdNumber NVARCHAR(50) NULL,
    
    -- Audit Columns
    CreatedBy INT NOT NULL FOREIGN KEY REFERENCES Users(UserID),
    CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    ModifiedBy INT NULL FOREIGN KEY REFERENCES Users(UserID),
    ModifiedDate DATETIME2 NULL,
    IsDeleted BIT NOT NULL DEFAULT 0,
    DeletedBy INT NULL FOREIGN KEY REFERENCES Users(UserID),
    DeletedDate DATETIME2 NULL,
    RowVersion ROWVERSION
);
GO

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Warehouse_MedicineCategories' AND xtype='U')
CREATE TABLE Warehouse_MedicineCategories (
    CategoryID INT IDENTITY(1,1) PRIMARY KEY,
    CategoryName NVARCHAR(100) NOT NULL UNIQUE,
    
    -- Audit Columns
    CreatedBy INT NOT NULL FOREIGN KEY REFERENCES Users(UserID),
    CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    ModifiedBy INT NULL FOREIGN KEY REFERENCES Users(UserID),
    ModifiedDate DATETIME2 NULL,
    IsDeleted BIT NOT NULL DEFAULT 0,
    DeletedBy INT NULL FOREIGN KEY REFERENCES Users(UserID),
    DeletedDate DATETIME2 NULL,
    RowVersion ROWVERSION
);
GO

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Warehouse_MedicineUnits' AND xtype='U')
CREATE TABLE Warehouse_MedicineUnits (
    UnitID INT IDENTITY(1,1) PRIMARY KEY,
    UnitName NVARCHAR(50) NOT NULL UNIQUE,
    Abbreviation NVARCHAR(20) NULL,
    
    -- Audit Columns
    CreatedBy INT NOT NULL FOREIGN KEY REFERENCES Users(UserID),
    CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    ModifiedBy INT NULL FOREIGN KEY REFERENCES Users(UserID),
    ModifiedDate DATETIME2 NULL,
    IsDeleted BIT NOT NULL DEFAULT 0,
    DeletedBy INT NULL FOREIGN KEY REFERENCES Users(UserID),
    DeletedDate DATETIME2 NULL,
    RowVersion ROWVERSION
);
GO

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Warehouse_Locations' AND xtype='U')
CREATE TABLE Warehouse_Locations (
    LocationID INT IDENTITY(1,1) PRIMARY KEY,
    LocationName NVARCHAR(150) NOT NULL UNIQUE,
    LocationType NVARCHAR(50) NOT NULL, -- e.g., 'Warehouse', 'Pharmacy', 'RHU'
    
    -- Audit Columns
    CreatedBy INT NOT NULL FOREIGN KEY REFERENCES Users(UserID),
    CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    ModifiedBy INT NULL FOREIGN KEY REFERENCES Users(UserID),
    ModifiedDate DATETIME2 NULL,
    IsDeleted BIT NOT NULL DEFAULT 0,
    DeletedBy INT NULL FOREIGN KEY REFERENCES Users(UserID),
    DeletedDate DATETIME2 NULL,
    RowVersion ROWVERSION
);
GO

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Warehouse_Medicines' AND xtype='U')
CREATE TABLE Warehouse_Medicines (
    MedicineID INT IDENTITY(1,1) PRIMARY KEY,
    ProductName NVARCHAR(200) NOT NULL,
    GenericName NVARCHAR(200) NULL,
    BrandName NVARCHAR(200) NULL,
    Dosage NVARCHAR(50) NULL,
    Form NVARCHAR(50) NULL,
    CategoryID INT NULL FOREIGN KEY REFERENCES Warehouse_MedicineCategories(CategoryID),
    BaseUnitID INT NOT NULL FOREIGN KEY REFERENCES Warehouse_MedicineUnits(UnitID),
    
    -- Audit Columns
    CreatedBy INT NOT NULL FOREIGN KEY REFERENCES Users(UserID),
    CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    ModifiedBy INT NULL FOREIGN KEY REFERENCES Users(UserID),
    ModifiedDate DATETIME2 NULL,
    IsDeleted BIT NOT NULL DEFAULT 0,
    DeletedBy INT NULL FOREIGN KEY REFERENCES Users(UserID),
    DeletedDate DATETIME2 NULL,
    RowVersion ROWVERSION
);
GO

CREATE NONCLUSTERED INDEX IX_Warehouse_Medicines_ProductName ON Warehouse_Medicines(ProductName);
CREATE NONCLUSTERED INDEX IX_Warehouse_Medicines_GenericName ON Warehouse_Medicines(GenericName);
GO

-- 2. INBOUND TRANSACTIONS (Delivery Receipts)

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Warehouse_DeliveryReceipts' AND xtype='U')
CREATE TABLE Warehouse_DeliveryReceipts (
    DeliveryReceiptID BIGINT IDENTITY(1,1) PRIMARY KEY,
    SupplierID INT NOT NULL FOREIGN KEY REFERENCES Warehouse_Suppliers(SupplierID),
    PurchaseOrderNumber NVARCHAR(100) NULL,
    InvoiceNumber NVARCHAR(100) NULL,
    ReferenceNumber NVARCHAR(100) NOT NULL UNIQUE,
    ReceivingLocationID INT NOT NULL FOREIGN KEY REFERENCES Warehouse_Locations(LocationID),
    DeliveryDate DATE NOT NULL,
    Status NVARCHAR(20) NOT NULL CHECK (Status IN ('Draft', 'Received', 'Void')),
    Remarks NVARCHAR(500) NULL,
    
    -- Audit Columns
    CreatedBy INT NOT NULL FOREIGN KEY REFERENCES Users(UserID),
    CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    ModifiedBy INT NULL FOREIGN KEY REFERENCES Users(UserID),
    ModifiedDate DATETIME2 NULL,
    IsDeleted BIT NOT NULL DEFAULT 0,
    DeletedBy INT NULL FOREIGN KEY REFERENCES Users(UserID),
    DeletedDate DATETIME2 NULL,
    RowVersion ROWVERSION
);
GO

CREATE NONCLUSTERED INDEX IX_Warehouse_DR_Reference ON Warehouse_DeliveryReceipts(ReferenceNumber);
CREATE NONCLUSTERED INDEX IX_Warehouse_DR_Supplier ON Warehouse_DeliveryReceipts(SupplierID);
CREATE NONCLUSTERED INDEX IX_Warehouse_DR_Date ON Warehouse_DeliveryReceipts(DeliveryDate);
GO

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Warehouse_DeliveryReceiptItems' AND xtype='U')
CREATE TABLE Warehouse_DeliveryReceiptItems (
    DeliveryReceiptItemID BIGINT IDENTITY(1,1) PRIMARY KEY,
    DeliveryReceiptID BIGINT NOT NULL FOREIGN KEY REFERENCES Warehouse_DeliveryReceipts(DeliveryReceiptID),
    MedicineID INT NOT NULL FOREIGN KEY REFERENCES Warehouse_Medicines(MedicineID),
    BatchNumber NVARCHAR(100) NULL,
    LotNumber NVARCHAR(100) NOT NULL,
    ExpiryDate DATE NOT NULL,
    UnitCost DECIMAL(18,4) NOT NULL,
    QuantityReceived INT NOT NULL,
    QuantityAccepted INT NOT NULL,
    QuantityRejected INT NOT NULL,
    
    CHECK (QuantityReceived = QuantityAccepted + QuantityRejected),
    
    -- Audit Columns
    CreatedBy INT NOT NULL FOREIGN KEY REFERENCES Users(UserID),
    CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    ModifiedBy INT NULL FOREIGN KEY REFERENCES Users(UserID),
    ModifiedDate DATETIME2 NULL,
    IsDeleted BIT NOT NULL DEFAULT 0,
    DeletedBy INT NULL FOREIGN KEY REFERENCES Users(UserID),
    DeletedDate DATETIME2 NULL,
    RowVersion ROWVERSION
);
GO

-- 3. INVENTORY MANAGEMENT

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Warehouse_Inventory' AND xtype='U')
CREATE TABLE Warehouse_Inventory (
    InventoryID BIGINT IDENTITY(1,1) PRIMARY KEY,
    LocationID INT NOT NULL FOREIGN KEY REFERENCES Warehouse_Locations(LocationID),
    MedicineID INT NOT NULL FOREIGN KEY REFERENCES Warehouse_Medicines(MedicineID),
    SourceDeliveryReceiptItemID BIGINT NULL FOREIGN KEY REFERENCES Warehouse_DeliveryReceiptItems(DeliveryReceiptItemID),
    BatchNumber NVARCHAR(100) NULL,
    LotNumber NVARCHAR(100) NOT NULL,
    ExpiryDate DATE NOT NULL,
    UnitCost DECIMAL(18,4) NOT NULL,
    QuantityReceived INT NOT NULL,
    QuantityAvailable INT NOT NULL,
    ReservedQuantity INT NOT NULL DEFAULT 0,
    DamagedQuantity INT NOT NULL DEFAULT 0,
    ExpiredQuantity INT NOT NULL DEFAULT 0,
    Status NVARCHAR(20) NOT NULL, -- 'Active', 'Quarantine', 'Depleted'
    
    CHECK (QuantityAvailable >= 0),
    CHECK (QuantityAvailable + ReservedQuantity + DamagedQuantity + ExpiredQuantity <= QuantityReceived),
    
    -- Audit Columns
    CreatedBy INT NOT NULL FOREIGN KEY REFERENCES Users(UserID),
    CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    ModifiedBy INT NULL FOREIGN KEY REFERENCES Users(UserID),
    ModifiedDate DATETIME2 NULL,
    IsDeleted BIT NOT NULL DEFAULT 0,
    DeletedBy INT NULL FOREIGN KEY REFERENCES Users(UserID),
    DeletedDate DATETIME2 NULL,
    RowVersion ROWVERSION
);
GO

-- Clustered index on primary key is default. Add non-clustered for FEFO querying:
CREATE NONCLUSTERED INDEX IX_Warehouse_Inventory_FEFO ON Warehouse_Inventory(MedicineID, LocationID, ExpiryDate);
GO

-- 4. OUTBOUND TRANSACTIONS & WORKFLOW (Requests & Distributions)

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Warehouse_StockRequests' AND xtype='U')
CREATE TABLE Warehouse_StockRequests (
    StockRequestID BIGINT IDENTITY(1,1) PRIMARY KEY,
    RequestNumber NVARCHAR(100) NOT NULL UNIQUE,
    RequestingLocationID INT NOT NULL FOREIGN KEY REFERENCES Warehouse_Locations(LocationID),
    RequestedByUserID INT NOT NULL FOREIGN KEY REFERENCES Users(UserID),
    ApprovedByUserID INT NULL FOREIGN KEY REFERENCES Users(UserID),
    ApprovedDate DATETIME2 NULL,
    Priority NVARCHAR(20) NOT NULL, -- 'Routine', 'Urgent', 'Emergency'
    Purpose NVARCHAR(500) NULL,
    Status NVARCHAR(20) NOT NULL, -- 'Draft', 'Submitted', 'Reviewed', 'Approved', 'Rejected', 'Cancelled', 'Partially Released', 'Completed'
    
    -- Audit Columns
    CreatedBy INT NOT NULL FOREIGN KEY REFERENCES Users(UserID),
    CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    ModifiedBy INT NULL FOREIGN KEY REFERENCES Users(UserID),
    ModifiedDate DATETIME2 NULL,
    IsDeleted BIT NOT NULL DEFAULT 0,
    DeletedBy INT NULL FOREIGN KEY REFERENCES Users(UserID),
    DeletedDate DATETIME2 NULL,
    RowVersion ROWVERSION
);
GO

CREATE NONCLUSTERED INDEX IX_Warehouse_SR_RequestNumber ON Warehouse_StockRequests(RequestNumber);
CREATE NONCLUSTERED INDEX IX_Warehouse_SR_Status ON Warehouse_StockRequests(Status);
CREATE NONCLUSTERED INDEX IX_Warehouse_SR_Location ON Warehouse_StockRequests(RequestingLocationID);
GO

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Warehouse_StockRequestItems' AND xtype='U')
CREATE TABLE Warehouse_StockRequestItems (
    StockRequestItemID BIGINT IDENTITY(1,1) PRIMARY KEY,
    StockRequestID BIGINT NOT NULL FOREIGN KEY REFERENCES Warehouse_StockRequests(StockRequestID),
    MedicineID INT NOT NULL FOREIGN KEY REFERENCES Warehouse_Medicines(MedicineID),
    QuantityRequested INT NOT NULL,
    QuantityApproved INT NULL,
    QuantityReleased INT NOT NULL DEFAULT 0,
    
    CHECK (QuantityReleased <= QuantityApproved),
    
    -- Audit Columns
    CreatedBy INT NOT NULL FOREIGN KEY REFERENCES Users(UserID),
    CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    ModifiedBy INT NULL FOREIGN KEY REFERENCES Users(UserID),
    ModifiedDate DATETIME2 NULL,
    IsDeleted BIT NOT NULL DEFAULT 0,
    DeletedBy INT NULL FOREIGN KEY REFERENCES Users(UserID),
    DeletedDate DATETIME2 NULL,
    RowVersion ROWVERSION
);
GO

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Warehouse_Distributions' AND xtype='U')
CREATE TABLE Warehouse_Distributions (
    DistributionID BIGINT IDENTITY(1,1) PRIMARY KEY,
    DistributionNumber NVARCHAR(100) NOT NULL UNIQUE,
    ReferenceStockRequestID BIGINT NULL FOREIGN KEY REFERENCES Warehouse_StockRequests(StockRequestID),
    SourceLocationID INT NOT NULL FOREIGN KEY REFERENCES Warehouse_Locations(LocationID),
    DestinationLocationID INT NOT NULL FOREIGN KEY REFERENCES Warehouse_Locations(LocationID),
    RequestedByUserID INT NULL FOREIGN KEY REFERENCES Users(UserID),
    ApprovedByUserID INT NULL FOREIGN KEY REFERENCES Users(UserID),
    ReleasedByUserID INT NULL FOREIGN KEY REFERENCES Users(UserID),
    ReceivedByUserID INT NULL FOREIGN KEY REFERENCES Users(UserID),
    ReleasedDate DATETIME2 NULL,
    ReceivedDate DATETIME2 NULL,
    Status NVARCHAR(20) NOT NULL, -- 'Prepared', 'In Transit', 'Delivered', 'Cancelled'
    Remarks NVARCHAR(500) NULL,
    
    -- Audit Columns
    CreatedBy INT NOT NULL FOREIGN KEY REFERENCES Users(UserID),
    CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    ModifiedBy INT NULL FOREIGN KEY REFERENCES Users(UserID),
    ModifiedDate DATETIME2 NULL,
    IsDeleted BIT NOT NULL DEFAULT 0,
    DeletedBy INT NULL FOREIGN KEY REFERENCES Users(UserID),
    DeletedDate DATETIME2 NULL,
    RowVersion ROWVERSION
);
GO

CREATE NONCLUSTERED INDEX IX_Warehouse_Dist_Number ON Warehouse_Distributions(DistributionNumber);
CREATE NONCLUSTERED INDEX IX_Warehouse_Dist_SourceLoc ON Warehouse_Distributions(SourceLocationID);
CREATE NONCLUSTERED INDEX IX_Warehouse_Dist_DestLoc ON Warehouse_Distributions(DestinationLocationID);
GO

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Warehouse_DistributionItems' AND xtype='U')
CREATE TABLE Warehouse_DistributionItems (
    DistributionItemID BIGINT IDENTITY(1,1) PRIMARY KEY,
    DistributionID BIGINT NOT NULL FOREIGN KEY REFERENCES Warehouse_Distributions(DistributionID),
    InventoryID BIGINT NOT NULL FOREIGN KEY REFERENCES Warehouse_Inventory(InventoryID),
    StockRequestItemID BIGINT NULL FOREIGN KEY REFERENCES Warehouse_StockRequestItems(StockRequestItemID),
    Quantity INT NOT NULL,
    UnitCostAtTimeOfRelease DECIMAL(18,4) NOT NULL,
    
    -- Audit Columns
    CreatedBy INT NOT NULL FOREIGN KEY REFERENCES Users(UserID),
    CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    ModifiedBy INT NULL FOREIGN KEY REFERENCES Users(UserID),
    ModifiedDate DATETIME2 NULL,
    IsDeleted BIT NOT NULL DEFAULT 0,
    DeletedBy INT NULL FOREIGN KEY REFERENCES Users(UserID),
    DeletedDate DATETIME2 NULL,
    RowVersion ROWVERSION
);
GO
