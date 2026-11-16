import React, { useEffect, useMemo } from 'react';
import { z } from 'zod';
import { useFieldArray, useWatch } from 'react-hook-form';
import { Truck, Search, Plus, Trash2, Calendar, FileText, Package } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { EntityPage } from '../../../../components/framework/EntityPage';
import { EntityConfig } from '../../../../components/framework/types';
import { TextInput } from '../../../../components/forms/TextInput';
import { SelectBox } from '../../../../components/forms/SelectBox';
import { SearchableSelect } from '../../../../components/forms/SearchableSelect';
import { DatePickerField } from '../../../../components/forms/DatePickerField';
import { Section } from '../../../../components/layout/Section';
import { Column } from '../../../../components/tables/EnterpriseTable';
import { API_URL } from '../../../../app/api-config';

// 1. Zod Schemas
const DeliveryReceiptItemSchema = z.object({
  itemId: z.string().nullish(),
  medicineId: z.string().min(1, "Medicine is required"),
  batchNumber: z.string().nullish(),
  expiryDate: z.string().nullish(),
  unitCost: z.coerce.number().min(0.01, "Cost must be > 0"),
  quantityReceived: z.coerce.number().min(1, "Qty must be > 0"),
}).superRefine((data, ctx) => {
  // We can't synchronously validate complex DB rules here without access to the medicines array,
  // so we'll do basic checks and rely on UI warnings / backend.
});

const DeliveryReceiptSchema = z.object({
  id: z.string().nullish(),
  referenceNumber: z.string().nullish(),
  supplierId: z.string().min(1, "Supplier is required"),
  purchaseOrderNumber: z.string().nullish(),
  invoiceNumber: z.string().nullish(),
  deliveryDate: z.string().min(1, "Delivery Date is required"),
  status: z.enum(['Draft', 'Received', 'Void']).default('Draft'),
  remarks: z.string().nullish(),
  items: z.array(DeliveryReceiptItemSchema).min(1, "At least one item is required")
});

type DeliveryReceiptFormData = z.infer<typeof DeliveryReceiptSchema>;

// 2. Table Columns
const columns: Column<DeliveryReceiptFormData>[] = [
  { id: 'referenceNumber', header: 'DR Number', accessorKey: 'referenceNumber', sortable: true },
  { id: 'supplierName', header: 'Supplier', accessorKey: 'supplierName', sortable: true },
  { id: 'deliveryDate', header: 'Delivery Date', accessorKey: 'deliveryDate', sortable: true },
  { id: 'itemCount', header: 'Items', accessorKey: 'itemCount' },
  { id: 'grandTotal', header: 'Grand Total', accessorKey: 'grandTotal' },
  { id: 'status', header: 'Status', accessorKey: 'status', sortable: true }
];

// Helper component for Line Items with full Desktop, Tablet, and Mobile responsiveness
function LineItemsForm({ control, register, errors, setValue }: any) {
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = useWatch({ control, name: 'items' });

  const { data: medicines = [] } = useQuery({
    queryKey: ['warehouse-medicines'],
    queryFn: () => fetch(`${API_URL}/api/warehouse/medicines`).then(res => res.json())
  });

  const medicineOptions = useMemo(() => {
    return medicines.map((m: any) => ({
      value: String(m.id),
      label: m.productName,
      subtitle: m.genericName && m.genericName !== m.productName ? `Generic: ${m.genericName}` : (m.genericName || undefined),
      badge: m.unitName || (m.dosageForm ? m.dosageForm : undefined)
    }));
  }, [medicines]);

  const getMedicineInfo = (id: string) => medicines.find((m: any) => String(m.id) === String(id));

  const totalItemsCount = fields.length;
  const totalUnits = items?.reduce((sum: number, item: any) => sum + (Number(item?.quantityReceived) || 0), 0) || 0;
  const grandTotal = items?.reduce((sum: number, item: any) => sum + ((Number(item?.quantityReceived) || 0) * (Number(item?.unitCost) || 0)), 0) || 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Received Items ({totalItemsCount})
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Add medicines, batch numbers, and quantities received from this delivery.
          </p>
        </div>
        <button
          type="button"
          onClick={() => append({ medicineId: '', unitCost: '' as any, quantityReceived: 1, batchNumber: '', expiryDate: '' })}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs sm:text-sm font-semibold transition-all border border-primary/20 shrink-0 w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" /> Add Item
        </button>
      </div>

      {/* Empty State */}
      {fields.length === 0 && (
        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border rounded-xl bg-muted/10 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
            <Package className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-foreground">No items added yet</h4>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Start adding the medicines included in this delivery receipt.
          </p>
          <button
            type="button"
            onClick={() => append({ medicineId: '', unitCost: '' as any, quantityReceived: 1, batchNumber: '', expiryDate: '' })}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-medium hover:opacity-90 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add First Item
          </button>
        </div>
      )}

      {/* Desktop View Table Layout (Hidden on Mobile & Tablet) */}
      <div className="hidden xl:block space-y-3">
        {fields.length > 0 && (
          <div className="grid grid-cols-12 gap-3 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/40 rounded-lg border border-border">
            <div className="col-span-4">Medicine</div>
            <div className="col-span-2">Unit Cost (₱)</div>
            <div className="col-span-1">Qty</div>
            <div className="col-span-2">Batch No.</div>
            <div className="col-span-2">Expiry Date</div>
            <div className="col-span-1 text-right pr-2">Action</div>
          </div>
        )}

        {fields.map((field, index) => {
          const currentMedId = items?.[index]?.medicineId;
          const medInfo = getMedicineInfo(currentMedId);
          const needsBatch = medInfo?.trackBatchNumbers;
          const needsExpiry = medInfo?.trackExpirationDates;
          const rowQty = Number(items?.[index]?.quantityReceived) || 0;
          const rowCost = Number(items?.[index]?.unitCost) || 0;
          const rowSubtotal = rowQty * rowCost;

          return (
            <div 
              key={field.id} 
              className="grid grid-cols-12 gap-3 p-3 items-start border border-border rounded-xl bg-card hover:border-primary/40 transition-colors relative group"
            >
              {/* Medicine */}
              <div className="col-span-4">
                <SearchableSelect 
                  value={items?.[index]?.medicineId}
                  onChange={(val) => setValue(`items.${index}.medicineId`, val, { shouldValidate: true, shouldDirty: true })}
                  options={medicineOptions}
                  placeholder="Select Medicine..."
                  searchPlaceholder="Type keyword (e.g. Paracetamol, 500mg)..."
                  error={errors.items?.[index]?.medicineId?.message as string}
                />
              </div>

              {/* Unit Cost */}
              <div className="col-span-2">
                <TextInput 
                  type="number" 
                  step="0.01" 
                  min="0"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={items?.[index]?.unitCost ?? ''}
                  onChange={(e) => setValue(`items.${index}.unitCost`, e.target.value, { shouldValidate: true, shouldDirty: true })}
                  error={errors.items?.[index]?.unitCost?.message as string} 
                />
              </div>

              {/* Quantity */}
              <div className="col-span-1">
                <TextInput 
                  type="number" 
                  min="1"
                  inputMode="numeric"
                  placeholder="1"
                  value={items?.[index]?.quantityReceived ?? ''}
                  onChange={(e) => setValue(`items.${index}.quantityReceived`, e.target.value, { shouldValidate: true, shouldDirty: true })}
                  error={errors.items?.[index]?.quantityReceived?.message as string} 
                />
              </div>

              {/* Batch No. */}
              <div className="col-span-2">
                <TextInput 
                  placeholder={needsBatch ? "e.g. B-9021" : "N/A"} 
                  value={items?.[index]?.batchNumber ?? ''}
                  onChange={(e) => setValue(`items.${index}.batchNumber`, e.target.value, { shouldValidate: true, shouldDirty: true })}
                  required={needsBatch} 
                  disabled={!needsBatch} 
                />
              </div>

              {/* Expiry Date */}
              <div className="col-span-2">
                <DatePickerField 
                  value={items?.[index]?.expiryDate ? String(items[index].expiryDate).slice(0, 10) : ''} 
                  onChange={(val) => setValue(`items.${index}.expiryDate`, val, { shouldValidate: true, shouldDirty: true })} 
                  disabled={!needsExpiry} 
                  required={needsExpiry}
                  mode="expiry"
                  placeholder={needsExpiry ? "Select Expiry..." : "N/A"}
                  error={errors.items?.[index]?.expiryDate?.message as string}
                />
              </div>

              {/* Actions & Subtotal */}
              <div className="col-span-1 flex flex-col items-end justify-center pt-2 gap-1">
                <button 
                  type="button" 
                  onClick={() => remove(index)} 
                  className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                  title="Remove Item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                {rowSubtotal > 0 && (
                  <span className="text-[11px] font-medium text-muted-foreground truncate max-w-full">
                    ₱{rowSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile & Tablet Card Layout (Visible on < xl screens) */}
      <div className="block xl:hidden space-y-4">
        {fields.map((field, index) => {
          const currentMedId = items?.[index]?.medicineId;
          const medInfo = getMedicineInfo(currentMedId);
          const needsBatch = medInfo?.trackBatchNumbers;
          const needsExpiry = medInfo?.trackExpirationDates;
          const rowQty = Number(items?.[index]?.quantityReceived) || 0;
          const rowCost = Number(items?.[index]?.unitCost) || 0;
          const rowSubtotal = rowQty * rowCost;

          return (
            <div 
              key={field.id} 
              className="p-4 sm:p-5 border border-border rounded-xl bg-card/90 shadow-sm space-y-3.5 relative"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold text-xs">
                    Item #{index + 1}
                  </span>
                  {medInfo && (
                    <span className="text-xs text-muted-foreground font-medium hidden sm:inline truncate max-w-[200px]">
                      {medInfo.productName}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  {rowSubtotal > 0 && (
                    <span className="text-xs font-semibold text-primary px-2 py-0.5 rounded-md bg-primary/5">
                      ₱{rowSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )}
                  <button 
                    type="button" 
                    onClick={() => remove(index)} 
                    className="inline-flex items-center gap-1 p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-destructive hover:bg-destructive/10 text-xs font-medium transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Remove</span>
                  </button>
                </div>
              </div>

              {/* Medicine Select */}
              <div>
                <SearchableSelect 
                  label="Medicine *" 
                  value={items?.[index]?.medicineId}
                  onChange={(val) => setValue(`items.${index}.medicineId`, val, { shouldValidate: true, shouldDirty: true })}
                  options={medicineOptions}
                  placeholder="Select Medicine..."
                  searchPlaceholder="Type keyword (e.g. Paracetamol, 500mg)..."
                  error={errors.items?.[index]?.medicineId?.message as string}
                />
              </div>

              {/* Cost & Quantity Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TextInput 
                  label="Unit Cost (₱) *" 
                  type="number" 
                  step="0.01" 
                  min="0"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={items?.[index]?.unitCost ?? ''}
                  onChange={(e) => setValue(`items.${index}.unitCost`, e.target.value, { shouldValidate: true, shouldDirty: true })}
                  error={errors.items?.[index]?.unitCost?.message as string} 
                />
                <TextInput 
                  label="Quantity Received *" 
                  type="number" 
                  min="1"
                  inputMode="numeric"
                  placeholder="1"
                  value={items?.[index]?.quantityReceived ?? ''}
                  onChange={(e) => setValue(`items.${index}.quantityReceived`, e.target.value, { shouldValidate: true, shouldDirty: true })}
                  error={errors.items?.[index]?.quantityReceived?.message as string} 
                />
              </div>

              {/* Batch & Expiry Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TextInput 
                  label={needsBatch ? "Batch / Lot No. *" : "Batch No. (N/A)"} 
                  placeholder={needsBatch ? "Enter batch number" : "Not tracked"} 
                  value={items?.[index]?.batchNumber ?? ''}
                  onChange={(e) => setValue(`items.${index}.batchNumber`, e.target.value, { shouldValidate: true, shouldDirty: true })}
                  required={needsBatch} 
                  disabled={!needsBatch} 
                />
                <DatePickerField 
                  label={needsExpiry ? "Expiration Date *" : "Expiry Date (N/A)"} 
                  value={items?.[index]?.expiryDate ? String(items[index].expiryDate).slice(0, 10) : ''} 
                  onChange={(val) => setValue(`items.${index}.expiryDate`, val, { shouldValidate: true, shouldDirty: true })} 
                  disabled={!needsExpiry} 
                  required={needsExpiry}
                  mode="expiry"
                  placeholder={needsExpiry ? "Select Expiry..." : "Not tracked"}
                  error={errors.items?.[index]?.expiryDate?.message as string}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Footer */}
      {fields.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-muted/40 border border-border rounded-xl mt-4">
          <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
            <span>Total Units: <strong className="text-foreground">{totalUnits.toLocaleString()}</strong></span>
            <span className="mx-2">•</span>
            <span>Items: <strong className="text-foreground">{totalItemsCount}</strong></span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">Grand Total:</span>
            <span className="text-lg sm:text-xl font-extrabold text-primary">
              ₱{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}

      {typeof errors.items?.message === 'string' && (
        <p className="text-xs sm:text-sm font-medium text-destructive mt-1">{errors.items.message}</p>
      )}
    </div>
  );
}


function DeliveryReceiptFormContent({ methods, suppliers }: { methods: any; suppliers: any[] }) {
  const { register, control, formState: { errors }, setValue, watch } = methods;
  const status = watch('status');
  const deliveryDate = watch('deliveryDate');

  // Auto-default deliveryDate and status when creating receipt
  useEffect(() => {
    if (!deliveryDate) {
      const today = new Date().toISOString().split('T')[0];
      setValue('deliveryDate', today, { shouldValidate: true, shouldDirty: true });
    }
    if (!status) {
      setValue('status', 'Draft', { shouldValidate: false });
    }
  }, [deliveryDate, status, setValue]);

  return (
    <div className="space-y-6">
      {status === 'Received' ? (
        <div className="p-3.5 sm:p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm font-medium flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span>This document has been <strong>Received</strong> and posted to inventory. Line items are locked.</span>
        </div>
      ) : (
        <div className="p-3.5 sm:p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-700 dark:text-amber-300 text-xs sm:text-sm font-medium">
          <strong>Draft Mode (Not Yet in Warehouse Stock):</strong> Saving with status{' '}
          <strong>Draft</strong> saves this receipt for inspection only. Change{' '}
          <strong>Document Status</strong> below to <strong>Received (Post to Inventory)</strong> to add stock to Warehouse inventory.
        </div>
      )}
      
      {/* Header Receipt Information */}
      <div className="bg-card/50 border border-border rounded-xl p-4 sm:p-5 space-y-4">
        <div className="border-b border-border/60 pb-2.5">
          <h3 className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Receipt Information
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Header details and delivery metadata from the supplier.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {/* Supplier */}
          <div className="sm:col-span-2 lg:col-span-1">
            <SelectBox 
              label="Supplier *" 
              {...register('supplierId')} 
              options={suppliers.map((s: any) => ({ value: String(s.id), label: s.supplierName }))}
              placeholder="Select Supplier..."
              error={errors.supplierId?.message as string} 
              disabled={status === 'Received'}
            />
          </div>

          {/* Delivery Date with Easy Year and Date Selection */}
          <div>
            <DatePickerField 
              label="Delivery Date" 
              required
              value={deliveryDate ? String(deliveryDate).slice(0, 10) : ''} 
              onChange={(val) => setValue('deliveryDate', val, { shouldValidate: true, shouldDirty: true })} 
              error={errors.deliveryDate?.message as string} 
              disabled={status === 'Received'} 
              mode="delivery"
              placeholder="Select delivery date..."
            />
          </div>

          {/* Status */}
          <div>
            <SelectBox 
              label="Document Status *" 
              {...register('status')} 
              options={[
                { value: 'Draft', label: 'Draft (Pending Inspection)' }, 
                { value: 'Received', label: 'Received (Post to Inventory)' }
              ]} 
              disabled={status === 'Received'}
            />
          </div>

          {/* Invoice Number */}
          <div>
            <TextInput 
              label="Invoice Number" 
              placeholder="e.g. INV-2026-001"
              {...register('invoiceNumber')} 
              error={errors.invoiceNumber?.message as string} 
              disabled={status === 'Received'} 
            />
          </div>

          {/* Purchase Order Number */}
          <div>
            <TextInput 
              label="Purchase Order No." 
              placeholder="e.g. PO-88392"
              {...register('purchaseOrderNumber')} 
              error={errors.purchaseOrderNumber?.message as string} 
              disabled={status === 'Received'} 
            />
          </div>

          {/* Remarks */}
          <div className="sm:col-span-2 lg:col-span-1">
            <TextInput 
              label="Remarks / Notes" 
              placeholder="Optional delivery notes..."
              {...register('remarks')} 
              error={errors.remarks?.message as string} 
              disabled={status === 'Received'} 
            />
          </div>
        </div>
      </div>

      {/* Line Items Form */}
      {status !== 'Received' ? (
         <LineItemsForm control={control} register={register} errors={errors} setValue={setValue} />
      ) : (
         <div className="p-6 border border-border rounded-xl bg-muted/20 text-center text-muted-foreground text-sm">
           Line items are locked because this delivery receipt has already been posted to inventory.
         </div>
      )}
    </div>
  );
}

export function DeliveryReceipts() {
  const { data: suppliers = [] } = useQuery({
    queryKey: ['warehouse-suppliers'],
    queryFn: () => fetch(`${API_URL}/api/warehouse/suppliers`).then(res => res.json())
  });

  const config: EntityConfig<DeliveryReceiptFormData> = {
    entityName: 'Delivery Receipt',
    entityNamePlural: 'Delivery Receipts',
    apiEndpoint: '/api/warehouse/delivery-receipts',
    icon: Truck,
    columns,
    schema: DeliveryReceiptSchema,
    formMaxWidth: '5xl',
    
    permissions: {
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canViewDetails: true,
    },

    renderForm: (methods) => (
      <DeliveryReceiptFormContent methods={methods} suppliers={suppliers} />
    ),

    renderMobileCard: (entity: any, actions) => {
      const isReceived = entity.status === 'Received';
      return (
        <div
          onClick={actions.onView}
          className="p-4 rounded-2xl border border-border/70 bg-card shadow-xs space-y-3 active:bg-muted/30 transition-colors cursor-pointer"
        >
          <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-border/60">
            <div>
              <span className="text-xs font-mono font-bold text-primary block">
                {entity.referenceNumber || 'DR-DRAFT'}
              </span>
              <h3 className="text-sm font-bold text-foreground mt-0.5">
                {entity.supplierName || 'Supplier'}
              </h3>
            </div>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              isReceived
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
            }`}>
              {entity.status || 'Draft'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs bg-muted/30 p-2.5 rounded-xl border border-border/40">
            <div>
              <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Delivery Date</span>
              <span className="font-semibold text-foreground">
                {entity.deliveryDate ? new Date(entity.deliveryDate).toLocaleDateString() : '-'}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Line Items</span>
              <span className="font-bold text-foreground">{entity.itemCount || entity.items?.length || 0} items</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Grand Total</span>
              <span className="font-bold text-primary">
                {typeof entity.grandTotal === 'string' && entity.grandTotal.startsWith('₱')
                  ? entity.grandTotal
                  : `₱${Number(entity.grandTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={actions.onView}
              className="px-3 py-2 min-h-[38px] rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground transition-colors"
            >
              View Receipt
            </button>
            {!isReceived && (
              <button
                type="button"
                onClick={actions.onEdit}
                className="px-3 py-2 min-h-[38px] rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                Edit / Post
              </button>
            )}
          </div>
        </div>
      );
    },

    renderDetails: (entity: any) => {
      return (
        <div className="space-y-6 mt-2">
          <div className="grid grid-cols-2 gap-3.5 p-4 bg-muted/40 rounded-xl border border-border">
            <div><p className="text-muted-foreground text-xs">DR Number</p><p className="font-bold font-mono text-foreground text-base">{entity.referenceNumber}</p></div>
            <div><p className="text-muted-foreground text-xs">Status</p><p className="font-bold text-foreground">{entity.status}</p></div>
            <div className="col-span-2 sm:col-span-1"><p className="text-muted-foreground text-xs">Supplier</p><p className="font-semibold text-foreground">{entity.supplierName}</p></div>
            <div><p className="text-muted-foreground text-xs">Delivery Date</p><p className="font-medium text-foreground">{entity.deliveryDate ? new Date(entity.deliveryDate).toLocaleDateString() : '-'}</p></div>
            <div><p className="text-muted-foreground text-xs">Invoice No.</p><p className="font-medium text-foreground">{entity.invoiceNumber || '-'}</p></div>
            <div><p className="text-muted-foreground text-xs">PO No.</p><p className="font-medium text-foreground">{entity.purchaseOrderNumber || '-'}</p></div>
          </div>

          {/* Mobile Line Items Cards */}
          <div className="sm:hidden space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Received Batches ({entity.items?.length || 0})
            </h4>
            {entity.items?.map((item: any, idx: number) => (
              <div key={idx} className="p-3.5 rounded-xl border border-border bg-background space-y-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-sm text-foreground">{item.medicineName}</span>
                  <span className="font-bold text-primary">
                    ₱{((item.quantityReceived || 0) * (item.unitCost || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1 text-muted-foreground">
                  <div>
                    <span className="text-[10px] uppercase block">Batch</span>
                    <span className="font-mono text-foreground font-medium">{item.batchNumber || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase block">Expiry</span>
                    <span className="text-foreground font-medium">
                      {item.expiryDate && item.expiryDate !== '2099-12-31' ? new Date(item.expiryDate).toLocaleDateString() : '-'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase block">Qty × Cost</span>
                    <span className="text-foreground font-semibold">
                      {item.quantityReceived} × ₱{Number(item.unitCost || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop/Tablet Table */}
          <div className="hidden sm:block border rounded-xl overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">Medicine</th>
                  <th className="px-4 py-2.5">Batch/Expiry</th>
                  <th className="px-4 py-2.5 text-right">Qty</th>
                  <th className="px-4 py-2.5 text-right">Unit Cost</th>
                  <th className="px-4 py-2.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {entity.items?.map((item: any, idx: number) => (
                  <tr key={idx} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{item.medicineName}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {item.batchNumber !== 'N/A' && item.batchNumber ? `B: ${item.batchNumber}` : ''}
                      <br/>
                      {item.expiryDate !== '2099-12-31' && item.expiryDate ? `E: ${new Date(item.expiryDate).toLocaleDateString()}` : ''}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{item.quantityReceived}</td>
                    <td className="px-4 py-3 text-right">₱{Number(item.unitCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-right font-bold">₱{(item.quantityReceived * item.unitCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="flex justify-end p-4 bg-muted/30 rounded-xl border border-border/60">
             <div className="text-lg sm:text-xl font-extrabold text-primary">
               Total: ₱{(entity.items?.reduce((sum: number, item: any) => sum + ((item.quantityReceived || 0) * (item.unitCost || 0)), 0) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
             </div>
          </div>
        </div>
      );
    }
  };

  return <EntityPage<DeliveryReceiptFormData> config={config} />;
}
