import React, { useEffect, useState } from 'react';
import { z } from 'zod';
import { Pill, Activity, Archive, Fingerprint, ToggleLeft } from 'lucide-react';
import { EntityPage } from '../../../../components/framework/EntityPage';
import { EntityConfig } from '../../../../components/framework/types';
import { TextInput } from '../../../../components/forms/TextInput';
import { SelectBox } from '../../../../components/forms/SelectBox';
import { Section } from '../../../../components/layout/Section';
import { Column } from '../../../../components/tables/EnterpriseTable';
import { useQuery } from '@tanstack/react-query';
import { API_URL } from '../../../../app/api-config';

// 1. Zod Schema
const MedicineSchema = z.object({
  id: z.string().optional(),
  medicineCode: z.string().trim().toUpperCase().optional(),
  genericName: z.string().min(1, "Generic Name is required").max(200).trim(),
  brandName: z.string().max(200).trim().optional(),
  scientificName: z.string().max(200).trim().optional(),
  medicineDescription: z.string().optional(),
  
  strength: z.string().max(50).optional(),
  strengthUnit: z.string().max(50).optional(),
  dosageForm: z.string().max(50).optional(),
  routeOfAdministration: z.string().max(100).optional(),
  classification: z.string().max(100).optional(),
  prescriptionRequired: z.boolean().default(false),
  controlledDrug: z.boolean().default(false),
  highAlertMedication: z.boolean().default(false),
  lasa: z.boolean().default(false),
  essentialMedicine: z.boolean().default(false),
  
  categoryId: z.string().min(1, "Category is required"),
  unitId: z.string().min(1, "Base Unit is required"),
  supplierId: z.string().min(1, "Supplier is required"),
  
  manufacturer: z.string().max(100).optional(),
  countryOfOrigin: z.string().max(100).optional(),
  barcode: z.string().max(100).optional(),
  qrCode: z.string().optional(),
  internalReferenceNumber: z.string().max(100).optional(),
  status: z.enum(['Active', 'Inactive', 'Discontinued']).default('Active'),
  
  minimumStock: z.coerce.number().min(0).default(0),
  maximumStock: z.coerce.number().min(0).optional(),
  reorderLevel: z.coerce.number().min(0).default(0),
  reorderQuantity: z.coerce.number().min(0).optional(),
  shelfLifeMonths: z.coerce.number().min(0).optional(),
  fefoEnabled: z.boolean().default(true),
  allowNegativeStock: z.boolean().default(false),
  trackBatchNumbers: z.boolean().default(true),
  trackExpirationDates: z.boolean().default(true),
});

type MedicineFormData = z.infer<typeof MedicineSchema>;

// 2. Table Columns
const columns: Column<MedicineFormData>[] = [
  { id: 'medicineCode', header: 'Code', accessorKey: 'medicineCode', sortable: true },
  { id: 'genericName', header: 'Generic Name', accessorKey: 'genericName', sortable: true },
  { id: 'brandName', header: 'Brand Name', accessorKey: 'brandName', sortable: true },
  { id: 'categoryName', header: 'Category', accessorKey: 'categoryName', sortable: true },
  { id: 'unitName', header: 'Unit', accessorKey: 'unitName' },
  { id: 'supplierName', header: 'Supplier', accessorKey: 'supplierName', sortable: true },
  { id: 'strength', header: 'Strength', accessorKey: 'strength' },
  { id: 'status', header: 'Status', accessorKey: 'status', sortable: true }
];

// 3. Entity Configuration Wrapper
export function MedicineRegistry() {
  // Fetch Lookups
  const { data: categories = [] } = useQuery({
    queryKey: ['warehouse-categories'],
    queryFn: () => fetch(`${API_URL}/api/warehouse/medicine-categories`).then(res => res.json())
  });
  
  const { data: units = [] } = useQuery({
    queryKey: ['warehouse-units'],
    queryFn: () => fetch(`${API_URL}/api/warehouse/medicine-units`).then(res => res.json())
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['warehouse-suppliers'],
    queryFn: () => fetch(`${API_URL}/api/warehouse/suppliers`).then(res => res.json())
  });

  const categoryOptions = categories.map((c: any) => ({ value: String(c.id), label: c.categoryName }));
  const unitOptions = units.map((u: any) => ({ value: String(u.id), label: u.name || u.unitName }));
  const supplierOptions = suppliers.map((s: any) => ({ value: String(s.id), label: s.supplierName }));

  const config: EntityConfig<MedicineFormData> = {
    entityName: 'Medicine',
    entityNamePlural: 'Medicines',
    apiEndpoint: '/api/warehouse/medicines',
    icon: Pill,
    columns,
    schema: MedicineSchema,
    formMaxWidth: '4xl',
    
    permissions: {
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canViewDetails: true,
    },

    renderForm: (methods) => {
      const { register, formState: { errors } } = methods;
      
      return (
        <div className="space-y-8">
          <Section title="General Information" description="Basic medicine details." headerAction={<Pill className="w-5 h-5 text-muted-foreground" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextInput label="Medicine Code" placeholder="Auto-generated if blank" {...register('medicineCode')} error={errors.medicineCode?.message as string} />
              <TextInput label="Generic Name" placeholder="International Nonproprietary Name" {...register('genericName')} error={errors.genericName?.message as string} required />
              <TextInput label="Brand Name" placeholder="Trade Name" {...register('brandName')} error={errors.brandName?.message as string} />
              <TextInput label="Scientific Name" placeholder="Chemical Name" {...register('scientificName')} error={errors.scientificName?.message as string} />
              
              <SelectBox label="Category" {...register('categoryId')} options={categoryOptions} error={errors.categoryId?.message as string} />
              <SelectBox label="Base Unit" {...register('unitId')} options={unitOptions} error={errors.unitId?.message as string} />
              <SelectBox label="Primary Supplier" {...register('supplierId')} options={supplierOptions} error={errors.supplierId?.message as string} />
              
              <TextInput label="Manufacturer" placeholder="Manufacturer Name" {...register('manufacturer')} error={errors.manufacturer?.message as string} />
              <TextInput label="Country of Origin" placeholder="Country" {...register('countryOfOrigin')} error={errors.countryOfOrigin?.message as string} />
              
              <div className="md:col-span-2">
                <TextInput label="Description" placeholder="Additional details" {...register('medicineDescription')} error={errors.medicineDescription?.message as string} />
              </div>
            </div>
          </Section>

          <Section title="Medical Information" description="Clinical details." headerAction={<Activity className="w-5 h-5 text-muted-foreground" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextInput label="Strength" placeholder="e.g. 500" {...register('strength')} error={errors.strength?.message as string} />
              <TextInput label="Strength Unit" placeholder="e.g. mg, ml" {...register('strengthUnit')} error={errors.strengthUnit?.message as string} />
              <TextInput label="Dosage Form" placeholder="e.g. Tablet, Syrup" {...register('dosageForm')} error={errors.dosageForm?.message as string} />
              <TextInput label="Route of Administration" placeholder="e.g. Oral, IV" {...register('routeOfAdministration')} error={errors.routeOfAdministration?.message as string} />
              <TextInput label="Classification" placeholder="e.g. Antibiotic" {...register('classification')} error={errors.classification?.message as string} />
              
              <div className="md:col-span-2 grid grid-cols-2 gap-4 mt-4">
                <div className="flex items-center space-x-2"><input type="checkbox" id="prescriptionRequired" className="w-4 h-4 text-primary rounded border-input" {...register('prescriptionRequired')} /><label htmlFor="prescriptionRequired" className="text-sm font-medium">Prescription Required</label></div>
                <div className="flex items-center space-x-2"><input type="checkbox" id="controlledDrug" className="w-4 h-4 text-primary rounded border-input" {...register('controlledDrug')} /><label htmlFor="controlledDrug" className="text-sm font-medium">Controlled Drug</label></div>
                <div className="flex items-center space-x-2"><input type="checkbox" id="highAlertMedication" className="w-4 h-4 text-primary rounded border-input" {...register('highAlertMedication')} /><label htmlFor="highAlertMedication" className="text-sm font-medium">High Alert Medication</label></div>
                <div className="flex items-center space-x-2"><input type="checkbox" id="lasa" className="w-4 h-4 text-primary rounded border-input" {...register('lasa')} /><label htmlFor="lasa" className="text-sm font-medium">LASA (Look-Alike Sound-Alike)</label></div>
                <div className="flex items-center space-x-2"><input type="checkbox" id="essentialMedicine" className="w-4 h-4 text-primary rounded border-input" {...register('essentialMedicine')} /><label htmlFor="essentialMedicine" className="text-sm font-medium">Essential Medicine</label></div>
              </div>
            </div>
          </Section>

          <Section title="Inventory Settings" description="Stock management configurations." headerAction={<Archive className="w-5 h-5 text-muted-foreground" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextInput label="Minimum Stock" type="number" {...register('minimumStock')} error={errors.minimumStock?.message as string} />
              <TextInput label="Maximum Stock" type="number" {...register('maximumStock')} error={errors.maximumStock?.message as string} />
              <TextInput label="Reorder Level" type="number" {...register('reorderLevel')} error={errors.reorderLevel?.message as string} />
              <TextInput label="Reorder Quantity" type="number" {...register('reorderQuantity')} error={errors.reorderQuantity?.message as string} />
              <TextInput label="Shelf Life (Months)" type="number" {...register('shelfLifeMonths')} error={errors.shelfLifeMonths?.message as string} />
              
              <div className="md:col-span-2 grid grid-cols-2 gap-4 mt-4">
                <div className="flex items-center space-x-2"><input type="checkbox" id="fefoEnabled" className="w-4 h-4 text-primary rounded border-input" {...register('fefoEnabled')} /><label htmlFor="fefoEnabled" className="text-sm font-medium">FEFO Enabled</label></div>
                <div className="flex items-center space-x-2"><input type="checkbox" id="allowNegativeStock" className="w-4 h-4 text-primary rounded border-input" {...register('allowNegativeStock')} /><label htmlFor="allowNegativeStock" className="text-sm font-medium">Allow Negative Stock</label></div>
                <div className="flex items-center space-x-2"><input type="checkbox" id="trackBatchNumbers" className="w-4 h-4 text-primary rounded border-input" {...register('trackBatchNumbers')} /><label htmlFor="trackBatchNumbers" className="text-sm font-medium">Track Batch Numbers</label></div>
                <div className="flex items-center space-x-2"><input type="checkbox" id="trackExpirationDates" className="w-4 h-4 text-primary rounded border-input" {...register('trackExpirationDates')} /><label htmlFor="trackExpirationDates" className="text-sm font-medium">Track Expiration Dates</label></div>
              </div>
            </div>
          </Section>

          <Section title="Identification" description="Barcodes and references." headerAction={<Fingerprint className="w-5 h-5 text-muted-foreground" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextInput label="Barcode" placeholder="EAN / UPC" {...register('barcode')} error={errors.barcode?.message as string} />
              <TextInput label="Internal Reference" placeholder="SKU" {...register('internalReferenceNumber')} error={errors.internalReferenceNumber?.message as string} />
            </div>
          </Section>

          <Section title="Status" headerAction={<ToggleLeft className="w-5 h-5 text-muted-foreground" />}>
            <SelectBox label="Status" {...register('status')} options={[
                { value: 'Active', label: 'Active' },
                { value: 'Inactive', label: 'Inactive' },
                { value: 'Discontinued', label: 'Discontinued' }
              ]} />
          </Section>
        </div>
      );
    },

    renderDetails: (entity: any) => {
      return (
        <div className="space-y-6 mt-4">
          <div className="p-4 bg-muted/50 rounded-lg border border-border space-y-6">
            
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Pill className="w-4 h-4 text-primary" /> Medicine Information
              </h4>
              <div className="grid grid-cols-2 gap-y-4 text-sm">
                <div className="col-span-2"><p className="text-muted-foreground">Product Name</p><p className="font-bold text-foreground text-base">{entity.productName}</p></div>
                <div><p className="text-muted-foreground">Medicine Code</p><p className="font-medium text-foreground">{entity.medicineCode || '-'}</p></div>
                <div><p className="text-muted-foreground">Generic Name</p><p className="font-medium text-foreground">{entity.genericName}</p></div>
                <div><p className="text-muted-foreground">Category</p><p className="font-medium text-foreground">{entity.categoryName || '-'}</p></div>
                <div><p className="text-muted-foreground">Unit</p><p className="font-medium text-foreground">{entity.unitName || '-'}</p></div>
                <div><p className="text-muted-foreground">Supplier</p><p className="font-medium text-foreground">{entity.supplierName || '-'}</p></div>
                <div><p className="text-muted-foreground">Status</p><p className="font-medium text-foreground">{entity.status}</p></div>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" /> Medical Details
              </h4>
              <div className="grid grid-cols-2 gap-y-4 text-sm">
                <div><p className="text-muted-foreground">Strength</p><p className="font-medium text-foreground">{entity.strength || '-'} {entity.strengthUnit || ''}</p></div>
                <div><p className="text-muted-foreground">Dosage Form</p><p className="font-medium text-foreground">{entity.dosageForm || '-'}</p></div>
                <div><p className="text-muted-foreground">Route</p><p className="font-medium text-foreground">{entity.routeOfAdministration || '-'}</p></div>
                <div><p className="text-muted-foreground">Prescription</p><p className="font-medium text-foreground">{entity.prescriptionRequired ? 'Yes' : 'No'}</p></div>
                <div><p className="text-muted-foreground">High Alert</p><p className="font-medium text-foreground">{entity.highAlertMedication ? 'Yes' : 'No'}</p></div>
                <div><p className="text-muted-foreground">LASA</p><p className="font-medium text-foreground">{entity.lasa ? 'Yes' : 'No'}</p></div>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Archive className="w-4 h-4 text-primary" /> Inventory Settings
              </h4>
              <div className="grid grid-cols-2 gap-y-4 text-sm">
                <div><p className="text-muted-foreground">Min Stock</p><p className="font-medium text-foreground">{entity.minimumStock}</p></div>
                <div><p className="text-muted-foreground">Max Stock</p><p className="font-medium text-foreground">{entity.maximumStock || '-'}</p></div>
                <div><p className="text-muted-foreground">Reorder Level</p><p className="font-medium text-foreground">{entity.reorderLevel}</p></div>
                <div><p className="text-muted-foreground">Reorder Qty</p><p className="font-medium text-foreground">{entity.reorderQuantity || '-'}</p></div>
                <div><p className="text-muted-foreground">Track Batch</p><p className="font-medium text-foreground">{entity.trackBatchNumbers ? 'Yes' : 'No'}</p></div>
                <div><p className="text-muted-foreground">Track Expiry</p><p className="font-medium text-foreground">{entity.trackExpirationDates ? 'Yes' : 'No'}</p></div>
              </div>
            </div>

          </div>
        </div>
      );
    }
  };

  return <EntityPage<MedicineFormData> config={config} />;
}
