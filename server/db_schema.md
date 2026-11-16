# Pharmacy & Warehouse Database Schema


### Table: database_firewall_rules
| Column Name | Data Type | Length | Nullable |
|-------------|-----------|--------|----------|
| id | int | N/A | NO |
| name | nvarchar | 128 | NO |
| start_ip_address | varchar | 45 | NO |
| end_ip_address | varchar | 45 | NO |
| create_date | datetime | N/A | NO |
| modify_date | datetime | N/A | NO |

### Table: DR_Header
| Column Name | Data Type | Length | Nullable |
|-------------|-----------|--------|----------|
| DR_ID | int | N/A | NO |
| DR_Number | nvarchar | 50 | NO |
| DR_Date | date | N/A | YES |
| SupplierName | nvarchar | 200 | YES |
| ReceivedBy | nvarchar | 100 | YES |
| Remarks | nvarchar | 500 | YES |
| DateCreated | datetime | N/A | NO |

### Table: DR_Items
| Column Name | Data Type | Length | Nullable |
|-------------|-----------|--------|----------|
| DR_ItemID | int | N/A | NO |
| DR_ID | int | N/A | NO |
| MedicineID | int | N/A | NO |
| QuantityReceived | int | N/A | NO |
| LotNumber | nvarchar | 100 | YES |
| ExpiryDate | date | N/A | YES |
| Price | decimal | N/A | NO |

### Table: Medicine_Category
| Column Name | Data Type | Length | Nullable |
|-------------|-----------|--------|----------|
| CategoryID | int | N/A | NO |
| CategoryName | nvarchar | 100 | NO |

### Table: Medicine_Unit
| Column Name | Data Type | Length | Nullable |
|-------------|-----------|--------|----------|
| UnitID | int | N/A | NO |
| UnitName | nvarchar | 50 | NO |
| IsActive | bit | N/A | NO |

### Table: Medicines
| Column Name | Data Type | Length | Nullable |
|-------------|-----------|--------|----------|
| MedicineID | int | N/A | NO |
| ProductName | nvarchar | 200 | NO |
| GenericName | nvarchar | 200 | YES |
| BrandName | nvarchar | 200 | YES |
| Dosage | nvarchar | 100 | YES |
| Form | nvarchar | 100 | YES |
| Description | nvarchar | 500 | YES |
| UnitID | int | N/A | NO |
| CategoryID | int | N/A | YES |
| IsActive | bit | N/A | NO |

### Table: Patients
| Column Name | Data Type | Length | Nullable |
|-------------|-----------|--------|----------|
| PatientID | int | N/A | NO |
| FirstName | nvarchar | 100 | NO |
| MiddleName | nvarchar | 100 | YES |
| Surname | nvarchar | 100 | NO |
| FullName | nvarchar | 350 | YES |
| BirthDate | date | N/A | YES |
| Barangay | nvarchar | 100 | YES |
| DetailedAddress | nvarchar | 255 | YES |
| ContactNumber | nvarchar | 30 | YES |
| Email | nvarchar | 150 | YES |
| DateRegistered | datetime | N/A | NO |

### Table: Pharmacy_Sales
| Column Name | Data Type | Length | Nullable |
|-------------|-----------|--------|----------|
| SaleID | int | N/A | NO |
| SoldBy | int | N/A | NO |
| PatientID | int | N/A | YES |
| SaleDate | datetime | N/A | NO |

### Table: Pharmacy_Sales_Details
| Column Name | Data Type | Length | Nullable |
|-------------|-----------|--------|----------|
| DetailID | int | N/A | NO |
| SaleID | int | N/A | NO |
| MedicineID | int | N/A | NO |
| Quantity | int | N/A | NO |
| Price | decimal | N/A | NO |
| UnitID | int | N/A | YES |

### Table: Pharmacy_Stocks
| Column Name | Data Type | Length | Nullable |
|-------------|-----------|--------|----------|
| StockID | int | N/A | NO |
| MedicineID | int | N/A | NO |
| Quantity | int | N/A | NO |
| UnitID | int | N/A | YES |
| LotNumber | nvarchar | 100 | YES |
| ExpiryDate | date | N/A | YES |
| Price | decimal | N/A | NO |
| DateReceived | datetime | N/A | NO |

### Table: Stock_Request
| Column Name | Data Type | Length | Nullable |
|-------------|-----------|--------|----------|
| RequestID | int | N/A | NO |
| RequestedBy | int | N/A | NO |
| Remarks | nvarchar | 500 | YES |
| Status | nvarchar | 20 | NO |
| RequestDate | datetime | N/A | NO |

### Table: Stock_Request_Details
| Column Name | Data Type | Length | Nullable |
|-------------|-----------|--------|----------|
| DetailID | int | N/A | NO |
| RequestID | int | N/A | NO |
| MedicineID | int | N/A | NO |
| QuantityRequested | int | N/A | NO |
| UnitID | int | N/A | YES |

### Table: Users
| Column Name | Data Type | Length | Nullable |
|-------------|-----------|--------|----------|
| UserID | int | N/A | NO |
| Username | nvarchar | 50 | NO |
| Password | nvarchar | 255 | NO |
| FullName | nvarchar | 100 | YES |
| Role | nvarchar | 20 | NO |
| IsActive | bit | N/A | NO |
| DateCreated | datetime | N/A | NO |
| LastLogin | datetime | N/A | YES |

### Table: Warehouse_Bulk_Release
| Column Name | Data Type | Length | Nullable |
|-------------|-----------|--------|----------|
| ReleaseID | int | N/A | NO |
| ReleasedTo | nvarchar | 200 | NO |
| ReleasedBy | int | N/A | YES |
| ReleaseDate | datetime | N/A | NO |

### Table: Warehouse_Bulk_Release_Details
| Column Name | Data Type | Length | Nullable |
|-------------|-----------|--------|----------|
| DetailID | int | N/A | NO |
| ReleaseID | int | N/A | NO |
| MedicineID | int | N/A | NO |
| Quantity | int | N/A | NO |
| UnitID | int | N/A | YES |
| Price | decimal | N/A | NO |

### Table: Warehouse_DeliveryReceiptItems
| Column Name | Data Type | Length | Nullable |
|-------------|-----------|--------|----------|
| DeliveryReceiptItemID | bigint | N/A | NO |
| DeliveryReceiptID | bigint | N/A | NO |
| MedicineID | int | N/A | NO |
| BatchNumber | nvarchar | 100 | YES |
| LotNumber | nvarchar | 100 | NO |
| ExpiryDate | date | N/A | NO |
| UnitCost | decimal | N/A | NO |
| QuantityReceived | int | N/A | NO |
| QuantityAccepted | int | N/A | NO |
| QuantityRejected | int | N/A | NO |
| CreatedBy | int | N/A | NO |
| CreatedDate | datetime2 | N/A | NO |
| ModifiedBy | int | N/A | YES |
| ModifiedDate | datetime2 | N/A | YES |
| IsDeleted | bit | N/A | NO |
| DeletedBy | int | N/A | YES |
| DeletedDate | datetime2 | N/A | YES |
| RowVersion | timestamp | N/A | NO |

### Table: Warehouse_DeliveryReceipts
| Column Name | Data Type | Length | Nullable |
|-------------|-----------|--------|----------|
| DeliveryReceiptID | bigint | N/A | NO |
| SupplierID | int | N/A | NO |
| PurchaseOrderNumber | nvarchar | 100 | YES |
| InvoiceNumber | nvarchar | 100 | YES |
| ReferenceNumber | nvarchar | 100 | NO |
| ReceivingLocationID | int | N/A | NO |
| DeliveryDate | date | N/A | NO |
| Status | nvarchar | 20 | NO |
| Remarks | nvarchar | 500 | YES |
| CreatedBy | int | N/A | NO |
| CreatedDate | datetime2 | N/A | NO |
| ModifiedBy | int | N/A | YES |
| ModifiedDate | datetime2 | N/A | YES |
| IsDeleted | bit | N/A | NO |
| DeletedBy | int | N/A | YES |
| DeletedDate | datetime2 | N/A | YES |
| RowVersion | timestamp | N/A | NO |
| ReceivedBy | int | N/A | YES |
| ReceivedDate | datetime2 | N/A | YES |

### Table: Warehouse_DistributionItems
| Column Name | Data Type | Length | Nullable |
|-------------|-----------|--------|----------|
| DistributionItemID | bigint | N/A | NO |
| DistributionID | bigint | N/A | NO |
| InventoryID | bigint | N/A | NO |
| StockRequestItemID | bigint | N/A | YES |
| Quantity | int | N/A | NO |
| UnitCostAtTimeOfRelease | decimal | N/A | NO |
| CreatedBy | int | N/A | NO |
| CreatedDate | datetime2 | N/A | NO |
| ModifiedBy | int | N/A | YES |
| ModifiedDate | datetime2 | N/A | YES |
| IsDeleted | bit | N/A | NO |
| DeletedBy | int | N/A | YES |
| DeletedDate | datetime2 | N/A | YES |
| RowVersion | timestamp | N/A | NO |

### Table: Warehouse_Distributions
| Column Name | Data Type | Length | Nullable |
|-------------|-----------|--------|----------|
| DistributionID | bigint | N/A | NO |
| DistributionNumber | nvarchar | 100 | NO |
| ReferenceStockRequestID | bigint | N/A | YES |
| SourceLocationID | int | N/A | NO |
| DestinationLocationID | int | N/A | NO |
| RequestedByUserID | int | N/A | YES |
| ApprovedByUserID | int | N/A | YES |
| ReleasedByUserID | int | N/A | YES |
| ReceivedByUserID | int | N/A | YES |
| ReleasedDate | datetime2 | N/A | YES |
| ReceivedDate | datetime2 | N/A | YES |
| Status | nvarchar | 20 | NO |
| Remarks | nvarchar | 500 | YES |
| CreatedBy | int | N/A | NO |
| CreatedDate | datetime2 | N/A | NO |
| ModifiedBy | int | N/A | YES |
| ModifiedDate | datetime2 | N/A | YES |
| IsDeleted | bit | N/A | NO |
| DeletedBy | int | N/A | YES |
| DeletedDate | datetime2 | N/A | YES |
| RowVersion | timestamp | N/A | NO |

### Table: Warehouse_Inventory
| Column Name | Data Type | Length | Nullable |
|-------------|-----------|--------|----------|
| InventoryID | bigint | N/A | NO |
| LocationID | int | N/A | NO |
| MedicineID | int | N/A | NO |
| SourceDeliveryReceiptItemID | bigint | N/A | YES |
| BatchNumber | nvarchar | 100 | YES |
| LotNumber | nvarchar | 100 | NO |
| ExpiryDate | date | N/A | NO |
| UnitCost | decimal | N/A | NO |
| QuantityReceived | int | N/A | NO |
| QuantityAvailable | int | N/A | NO |
| ReservedQuantity | int | N/A | NO |
| DamagedQuantity | int | N/A | NO |
| ExpiredQuantity | int | N/A | NO |
| Status | nvarchar | 20 | NO |
| CreatedBy | int | N/A | NO |
| CreatedDate | datetime2 | N/A | NO |
| ModifiedBy | int | N/A | YES |
| ModifiedDate | datetime2 | N/A | YES |
| IsDeleted | bit | N/A | NO |
| DeletedBy | int | N/A | YES |
| DeletedDate | datetime2 | N/A | YES |
| RowVersion | timestamp | N/A | NO |

### Table: Warehouse_InventoryTransactions
| Column Name | Data Type | Length | Nullable |
|-------------|-----------|--------|----------|
| TransactionID | bigint | N/A | NO |
| InventoryID | bigint | N/A | NO |
| LocationID | int | N/A | NO |
| MedicineID | int | N/A | NO |
| TransactionType | nvarchar | 50 | NO |
| ReferenceDocument | nvarchar | 100 | YES |
| ReferenceID | bigint | N/A | YES |
| Quantity | int | N/A | NO |
| UnitCost | decimal | N/A | YES |
| TotalCost | decimal | N/A | YES |
| Remarks | nvarchar | 500 | YES |
| CreatedBy | int | N/A | NO |
| CreatedDate | datetime2 | N/A | NO |
| RowVersion | timestamp | N/A | NO |

### Table: Warehouse_Locations
| Column Name | Data Type | Length | Nullable |
|-------------|-----------|--------|----------|
| LocationID | int | N/A | NO |
| LocationName | nvarchar | 150 | NO |
| LocationType | nvarchar | 50 | NO |
| CreatedBy | int | N/A | NO |
| CreatedDate | datetime2 | N/A | NO |
| ModifiedBy | int | N/A | YES |
| ModifiedDate | datetime2 | N/A | YES |
| IsDeleted | bit | N/A | NO |
| DeletedBy | int | N/A | YES |
| DeletedDate | datetime2 | N/A | YES |
| RowVersion | timestamp | N/A | NO |

### Table: Warehouse_MedicineCategories
| Column Name | Data Type | Length | Nullable |
|-------------|-----------|--------|----------|
| CategoryID | int | N/A | NO |
| CategoryName | nvarchar | 100 | NO |
| CreatedBy | int | N/A | NO |
| CreatedDate | datetime2 | N/A | NO |
| ModifiedBy | int | N/A | YES |
| ModifiedDate | datetime2 | N/A | YES |
| IsDeleted | bit | N/A | NO |
| DeletedBy | int | N/A | YES |
| DeletedDate | datetime2 | N/A | YES |
| RowVersion | timestamp | N/A | NO |

### Table: Warehouse_Medicines
| Column Name | Data Type | Length | Nullable |
|-------------|-----------|--------|----------|
| MedicineID | int | N/A | NO |
| ProductName | nvarchar | 200 | NO |
| GenericName | nvarchar | 200 | YES |
| BrandName | nvarchar | 200 | YES |
| Dosage | nvarchar | 50 | YES |
| Form | nvarchar | 50 | YES |
| CategoryID | int | N/A | YES |
| BaseUnitID | int | N/A | NO |
| CreatedBy | int | N/A | NO |
| CreatedDate | datetime2 | N/A | NO |
| ModifiedBy | int | N/A | YES |
| ModifiedDate | datetime2 | N/A | YES |
| IsDeleted | bit | N/A | NO |
| DeletedBy | int | N/A | YES |
| DeletedDate | datetime2 | N/A | YES |
| RowVersion | timestamp | N/A | NO |
| MedicineCode | nvarchar | 50 | YES |
| ScientificName | nvarchar | 200 | YES |
| MedicineDescription | nvarchar | -1 | YES |
| SupplierID | int | N/A | YES |
| Manufacturer | nvarchar | 100 | YES |
| CountryOfOrigin | nvarchar | 100 | YES |
| Barcode | nvarchar | 100 | YES |
| QRCode | nvarchar | -1 | YES |
| MedicineImage | nvarchar | -1 | YES |
| InternalReferenceNumber | nvarchar | 100 | YES |
| Status | nvarchar | 50 | NO |
| StrengthUnit | nvarchar | 50 | YES |
| RouteOfAdministration | nvarchar | 100 | YES |
| Classification | nvarchar | 100 | YES |
| PrescriptionRequired | bit | N/A | NO |
| ControlledDrug | bit | N/A | NO |
| HighAlertMedication | bit | N/A | NO |
| LASA | bit | N/A | NO |
| EssentialMedicine | bit | N/A | NO |
| MinimumStock | int | N/A | NO |
| MaximumStock | int | N/A | YES |
| ReorderLevel | int | N/A | NO |
| ReorderQuantity | int | N/A | YES |
| ShelfLifeMonths | int | N/A | YES |
| FEFOEnabled | bit | N/A | NO |
| AllowNegativeStock | bit | N/A | NO |
| TrackBatchNumbers | bit | N/A | NO |
| TrackExpirationDates | bit | N/A | NO |

### Table: Warehouse_MedicineUnits
| Column Name | Data Type | Length | Nullable |
|-------------|-----------|--------|----------|
| UnitID | int | N/A | NO |
| UnitName | nvarchar | 50 | NO |
| Abbreviation | nvarchar | 20 | YES |
| CreatedBy | int | N/A | NO |
| CreatedDate | datetime2 | N/A | NO |
| ModifiedBy | int | N/A | YES |
| ModifiedDate | datetime2 | N/A | YES |
| IsDeleted | bit | N/A | NO |
| DeletedBy | int | N/A | YES |
| DeletedDate | datetime2 | N/A | YES |
| RowVersion | timestamp | N/A | NO |

### Table: Warehouse_StockRequestItems
| Column Name | Data Type | Length | Nullable |
|-------------|-----------|--------|----------|
| StockRequestItemID | bigint | N/A | NO |
| StockRequestID | bigint | N/A | NO |
| MedicineID | int | N/A | NO |
| QuantityRequested | int | N/A | NO |
| QuantityApproved | int | N/A | YES |
| QuantityReleased | int | N/A | NO |
| CreatedBy | int | N/A | NO |
| CreatedDate | datetime2 | N/A | NO |
| ModifiedBy | int | N/A | YES |
| ModifiedDate | datetime2 | N/A | YES |
| IsDeleted | bit | N/A | NO |
| DeletedBy | int | N/A | YES |
| DeletedDate | datetime2 | N/A | YES |
| RowVersion | timestamp | N/A | NO |

### Table: Warehouse_StockRequests
| Column Name | Data Type | Length | Nullable |
|-------------|-----------|--------|----------|
| StockRequestID | bigint | N/A | NO |
| RequestNumber | nvarchar | 100 | NO |
| RequestingLocationID | int | N/A | NO |
| RequestedByUserID | int | N/A | NO |
| ApprovedByUserID | int | N/A | YES |
| ApprovedDate | datetime2 | N/A | YES |
| Priority | nvarchar | 20 | NO |
| Purpose | nvarchar | 500 | YES |
| Status | nvarchar | 20 | NO |
| CreatedBy | int | N/A | NO |
| CreatedDate | datetime2 | N/A | NO |
| ModifiedBy | int | N/A | YES |
| ModifiedDate | datetime2 | N/A | YES |
| IsDeleted | bit | N/A | NO |
| DeletedBy | int | N/A | YES |
| DeletedDate | datetime2 | N/A | YES |
| RowVersion | timestamp | N/A | NO |

### Table: Warehouse_Stocks
| Column Name | Data Type | Length | Nullable |
|-------------|-----------|--------|----------|
| StockID | int | N/A | NO |
| MedicineID | int | N/A | NO |
| UnitID | int | N/A | YES |
| Quantity | int | N/A | NO |
| LotNumber | nvarchar | 100 | YES |
| ExpiryDate | date | N/A | YES |
| Price | decimal | N/A | NO |
| DateReceived | datetime | N/A | NO |

### Table: Warehouse_Suppliers
| Column Name | Data Type | Length | Nullable |
|-------------|-----------|--------|----------|
| SupplierID | int | N/A | NO |
| SupplierName | nvarchar | 200 | NO |
| ContactPerson | nvarchar | 100 | YES |
| ContactNumber | nvarchar | 50 | YES |
| Address | nvarchar | 500 | YES |
| TaxIdNumber | nvarchar | 50 | YES |
| CreatedBy | int | N/A | NO |
| CreatedDate | datetime2 | N/A | NO |
| ModifiedBy | int | N/A | YES |
| ModifiedDate | datetime2 | N/A | YES |
| IsDeleted | bit | N/A | NO |
| DeletedBy | int | N/A | YES |
| DeletedDate | datetime2 | N/A | YES |
| RowVersion | timestamp | N/A | NO |
| SupplierCode | nvarchar | 50 | YES |
| BusinessName | nvarchar | 200 | YES |
| SupplierType | nvarchar | 50 | YES |
| Status | nvarchar | 50 | NO |
| Position | nvarchar | 100 | YES |
| Email | nvarchar | 100 | YES |
| Telephone | nvarchar | 50 | YES |
| MobileNumber | nvarchar | 50 | YES |
| Website | nvarchar | 200 | YES |
| Street | nvarchar | 200 | YES |
| Barangay | nvarchar | 100 | YES |
| MunicipalityCity | nvarchar | 100 | YES |
| Province | nvarchar | 100 | YES |
| Region | nvarchar | 100 | YES |
| PostalCode | nvarchar | 20 | YES |
| Country | nvarchar | 100 | YES |
| BusinessPermitNumber | nvarchar | 100 | YES |
| FDALicenseNumber | nvarchar | 100 | YES |
| LicenseExpirationDate | date | N/A | YES |
| VATRegistered | bit | N/A | NO |
| SupplierCategory | nvarchar | 50 | YES |
