import React, { useState } from 'react';
import { z } from 'zod';
import { useFieldArray, useWatch } from 'react-hook-form';
import { FileOutput, Plus, Trash2, CheckCircle2, XCircle, Clock, AlertTriangle, Layers, Truck, Check } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { EntityPage } from '../../../../components/framework/EntityPage';
import { EntityConfig } from '../../../../components/framework/types';
import { Column } from '../../../../components/tables/EnterpriseTable';
import { TextInput } from '../../../../components/forms/TextInput';
import { SelectBox } from '../../../../components/forms/SelectBox';
import { Button } from '../../../../components/ui/button';
import { toast } from 'sonner';
import { API_URL, getActiveUserId } from '../../../../app/api-config';
import { getFacilityTypeBadgeInfo } from '../../../../lib/terminology';
import { StockRequestKPIs } from './StockRequestKPIs';
import { StockRequestReviewDetail } from './StockRequestReviewDetail';

const StockRequestItemSchema = z.object({
  medicineId: z.string().min(1, 'Required'),
  requestedQuantity: z.number().min(1, 'Must be at least 1'),
  remarks: z.string().optional()
});

const StockRequestSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  RequiredDate: z.string().min(1, 'Required'),
  RequestingFacility: z.string().min(1, 'Required'),
  RequestingDepartment: z.string().optional(),
  Priority: z.enum(['Routine', 'Urgent', 'Emergency']).default('Routine'),
  Purpose: z.string().optional(),
  Remarks: z.string().optional(),
  items: z.array(StockRequestItemSchema).min(1, 'At least one item is required')
});

type StockRequestFormData = z.infer<typeof StockRequestSchema>;

const columns: Column<any>[] = [
  { id: 'RequestNumber', header: 'Request No.', accessorKey: 'RequestNumber', sortable: true },
  { 
    id: 'RequestDate', 
    header: 'Date', 
    accessorKey: 'RequestDate',
    cell: (row) => new Date(row.RequestDate).toLocaleDateString()
  },
  { 
    id: 'RequestingFacility', 
    header: 'Requesting Facility', 
    accessorKey: 'RequestingFacility',
    cell: (row) => {
      const badge = getFacilityTypeBadgeInfo(row.RequestingFacility, row.RequestingLocationID);
      return (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-foreground">{row.RequestingFacility}</span>
          <span className={`inline-flex w-fit px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.badgeClass}`}>
            {badge.shortBadge}
          </span>
        </div>
      );
    }
  },
  { 
    id: 'Priority', 
    header: 'Priority', 
    accessorKey: 'Priority',
    cell: (row) => {
      let color = 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
      if (row.Priority === 'Urgent') color = 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-500/20';
      if (row.Priority === 'Emergency') color = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-red-500/20';
      return <span className={`px-2 py-1 rounded text-xs font-semibold ${color}`}>{row.Priority}</span>;
    }
  },
  { 
    id: 'Status', 
    header: 'Status', 
    accessorKey: 'Status',
    cell: (row) => {
      let color = 'bg-gray-100 text-gray-800';
      const ns = String(row.Status || '').trim().toUpperCase().replace(/\s+/g, '_');
      if (['SUBMITTED', 'PENDING', 'UNDER_REVIEW', 'STOCK_UNAVAILABLE'].includes(ns)) {
        color = ns === 'STOCK_UNAVAILABLE'
          ? 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border border-orange-500/30'
          : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30';
      } else if (['PARTIALLY_APPROVED', 'PARTIALLY_FULFILLED'].includes(ns)) {
        color = 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30';
      } else if (['APPROVED', 'RESERVED', 'READY_FOR_FULFILLMENT'].includes(ns)) {
        color = 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30';
      } else if (['READY_FOR_ISSUANCE', 'ISSUED', 'IN_TRANSIT'].includes(ns)) {
        color = 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border border-cyan-500/30';
      } else if (ns === 'PARTIALLY_RECEIVED') {
        color = 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30';
      } else if (['COMPLETED', 'RECEIVED', 'FULFILLED', 'CLOSED'].includes(ns)) {
        color = 'bg-teal-500/15 text-teal-700 dark:text-teal-400 border border-teal-500/30';
      } else if (['REJECTED', 'CANCELLED'].includes(ns)) {
        color = 'bg-destructive/15 text-destructive border border-destructive/30';
      }
      return <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${color}`}>{row.Status}</span>;
    }
  },
  { id: 'ItemCount', header: 'Items', accessorKey: 'ItemCount' }
];

export function StockRequests() {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const { data: inventory = [] } = useQuery({
    queryKey: ['warehouse-inventory'],
    queryFn: () => fetch(`${API_URL}/api/warehouse/inventory`).then(res => res.json())
  });

  const { data: medicines = [] } = useQuery({
    queryKey: ['warehouse-medicines'],
    queryFn: () => fetch(`${API_URL}/api/warehouse/medicines`).then(res => res.json())
  });

  const config: EntityConfig<StockRequestFormData> = {
    entityName: 'Stock Request',
    entityNamePlural: 'Stock Requests',
    apiEndpoint: '/api/warehouse/stock-requests',
    icon: FileOutput,
    columns,
    schema: StockRequestSchema,
    formMaxWidth: '5xl',
    
    permissions: {
      canCreate: true,
      canEdit: false,
      canDelete: false,
      canViewDetails: true,
    },

    filterData: (data) => {
      if (!statusFilter || statusFilter === 'ALL') return data;
      const n = (v?: string) => String(v || '').trim().toUpperCase().replace(/\s+/g, '_');
      if (statusFilter === 'Pending') {
        return data.filter((r: any) => ['SUBMITTED', 'PENDING', 'UNDER_REVIEW'].includes(n(r.Status)));
      }
      if (statusFilter === 'Partially Approved') {
        return data.filter((r: any) => ['PARTIALLY_APPROVED', 'PARTIALLY_FULFILLED', 'PARTIALLY_RECEIVED'].includes(n(r.Status)));
      }
      if (statusFilter === 'Approved') {
        return data.filter((r: any) => ['APPROVED', 'RESERVED', 'READY_FOR_FULFILLMENT', 'STOCK_UNAVAILABLE'].includes(n(r.Status)));
      }
      if (statusFilter === 'In Transit') {
        return data.filter((r: any) => ['READY_FOR_ISSUANCE', 'ISSUED', 'IN_TRANSIT'].includes(n(r.Status)) || (r.OpenDistributionCount || 0) > 0);
      }
      if (statusFilter === 'Completed') {
        return data.filter((r: any) => ['COMPLETED', 'RECEIVED', 'FULFILLED', 'CLOSED'].includes(n(r.Status)));
      }
      if (statusFilter === 'Rejected') {
        return data.filter((r: any) => ['REJECTED', 'CANCELLED'].includes(n(r.Status)));
      }
      return data.filter((r: any) => n(r.Status) === n(statusFilter));
    },

    renderForm: (methods) => {
      const { register, control, formState: { errors }, watch, setValue } = methods;
      const status = watch('Status') || 'Draft';
      const isLocked = status !== 'Draft';

      const { fields, append, remove } = useFieldArray({
        control,
        name: "items"
      });

      const watchedItems = useWatch({ control, name: "items" }) || [];
      const totalItemsCount = fields.length;
      const totalRequestedUnits = watchedItems?.reduce((sum: number, item: any) => sum + (Number(item?.requestedQuantity) || 0), 0) || 0;

      const handleAction = async (newStatus: string) => {
        const id = watch('StockRequestID');
        if (!id) return;
        
        try {
          const uid = getActiveUserId();
          const res = await fetch(`${API_URL}/api/warehouse/stock-requests/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-user-id': String(uid) },
            body: JSON.stringify({ status: newStatus })
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data.error || 'Failed to update status');
          }
          toast.success(`Request ${newStatus} successfully!`);
          window.dispatchEvent(new Event('warehouse-refresh'));
        } catch(e: any) {
          toast.error(e.message || "Failed to update status");
        }
      };

      const upperStatus = String(status || '').trim().toUpperCase();

      return (
        <div className="space-y-6">
          {/* Action Bar for Existing Records */}
          {upperStatus !== 'DRAFT' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 bg-muted/50 rounded-xl border border-border">
               <div className="flex items-center gap-2">
                 {upperStatus === 'SUBMITTED' && <Clock className="w-5 h-5 text-blue-500 shrink-0"/>}
                 {upperStatus === 'APPROVED' && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0"/>}
                 {upperStatus === 'REJECTED' && <XCircle className="w-5 h-5 text-destructive shrink-0"/>}
                 <span className="font-semibold text-xs sm:text-sm">Status: <span className="font-bold">{status}</span></span>
               </div>
               
               <div className="flex flex-wrap gap-2">
                 {(upperStatus === 'SUBMITTED' || upperStatus === 'PENDING') && (
                   <>
                    <Button type="button" onClick={() => handleAction('Approved')} variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-xs sm:text-sm">
                      <CheckCircle2 className="w-4 h-4 mr-1.5"/> Approve
                    </Button>
                    <Button type="button" onClick={() => handleAction('Rejected')} variant="destructive" className="text-xs sm:text-sm">
                      <XCircle className="w-4 h-4 mr-1.5"/> Reject
                    </Button>
                   </>
                 )}
                 {(upperStatus === 'APPROVED' || upperStatus === 'SUBMITTED' || upperStatus === 'PENDING') && (
                    <Button type="button" onClick={() => handleAction('Cancelled')} variant="outline" className="text-xs sm:text-sm">
                      Cancel Request
                    </Button>
                 )}
               </div>
            </div>
          )}

          {/* Request Header Details */}
          <div className="bg-card/50 border border-border rounded-xl p-4 sm:p-5 space-y-4">
            <div className="border-b border-border/60 pb-2.5">
              <h3 className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
                <FileOutput className="w-4 h-4 text-primary" />
                Request Details
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Header information and destination department for this stock request.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              <div>
                <TextInput
                  label="Required Date *"
                  type="date"
                  {...register('RequiredDate')}
                  error={errors.RequiredDate?.message as string}
                  disabled={isLocked}
                />
              </div>
              <div>
                <TextInput
                  label="Requesting Facility *"
                  placeholder="e.g. Main Hospital"
                  {...register('RequestingFacility')}
                  error={errors.RequestingFacility?.message as string}
                  disabled={isLocked}
                />
              </div>
              <div>
                <TextInput
                  label="Requesting Department"
                  placeholder="e.g. Emergency Room"
                  {...register('RequestingDepartment')}
                  error={errors.RequestingDepartment?.message as string}
                  disabled={isLocked}
                />
              </div>
              <div>
                <SelectBox
                  label="Priority Level *"
                  {...register('Priority')}
                  options={[
                    { value: 'Routine', label: 'Routine' },
                    { value: 'Urgent', label: 'Urgent (High Priority)' },
                    { value: 'Emergency', label: 'Emergency (Immediate)' }
                  ]}
                  disabled={isLocked}
                />
              </div>
              <div>
                <TextInput
                  label="Purpose of Request"
                  placeholder="e.g. Monthly Ward Replenishment"
                  {...register('Purpose')}
                  disabled={isLocked}
                />
              </div>
              <div>
                <TextInput
                  label="Remarks / Notes"
                  placeholder="Additional delivery instructions..."
                  {...register('Remarks')}
                  disabled={isLocked}
                />
              </div>
            </div>
          </div>

          {/* Requested Items Section */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
              <div>
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <FileOutput className="w-5 h-5 text-primary" />
                  Requested Items ({totalItemsCount})
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Specify the medicines and required quantities needed for dispatch.
                </p>
              </div>

              {!isLocked && (
                <button
                  type="button"
                  onClick={() => append({ medicineId: '', requestedQuantity: 1, remarks: '' })}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs sm:text-sm font-semibold transition-all border border-primary/20 shrink-0 w-full sm:w-auto"
                >
                  <Plus className="w-4 h-4" /> Add Item
                </button>
              )}
            </div>

            {/* Empty State */}
            {fields.length === 0 && (
              <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border rounded-xl bg-muted/10 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
                  <FileOutput className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">No medicines added yet</h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Specify medicines and quantities you want to request from the warehouse.
                </p>
                {!isLocked && (
                  <button
                    type="button"
                    onClick={() => append({ medicineId: '', requestedQuantity: 1, remarks: '' })}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-medium hover:opacity-90 transition-all shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Add First Item
                  </button>
                )}
              </div>
            )}

            {/* Desktop View Table Layout */}
            <div className="hidden xl:block space-y-3">
              {fields.length > 0 && (
                <div className="grid grid-cols-12 gap-3 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/40 rounded-lg border border-border">
                  <div className="col-span-5">Medicine</div>
                  <div className="col-span-2">Requested Qty</div>
                  <div className="col-span-2">Stock Available</div>
                  <div className="col-span-2">Remarks</div>
                  <div className="col-span-1 text-right pr-2">Action</div>
                </div>
              )}

              {fields.map((field, index) => {
                const selectedMedId = watchedItems[index]?.medicineId;
                const stockAvailable = inventory.find((i: any) => String(i.medicineId) === String(selectedMedId))?.quantityAvailable || 0;
                const reqQty = Number(watchedItems[index]?.requestedQuantity || 0);
                const isShortage = reqQty > stockAvailable && selectedMedId;

                return (
                  <div 
                    key={field.id} 
                    className="grid grid-cols-12 gap-3 p-3 items-center border border-border rounded-xl bg-card hover:border-primary/40 transition-colors"
                  >
                    <div className="col-span-5">
                      <SelectBox 
                        value={watchedItems[index]?.medicineId ?? ''}
                        onChange={(e) => setValue(`items.${index}.medicineId`, e.target.value, { shouldValidate: true, shouldDirty: true })}
                        options={medicines.map((m: any) => ({ 
                          value: String(m.id), 
                          label: m.productName + (m.genericName ? ` (${m.genericName})` : '') 
                        }))} 
                        placeholder="Select Medicine..."
                        error={errors.items?.[index]?.medicineId?.message as string}
                        disabled={isLocked}
                      />
                    </div>
                    
                    <div className="col-span-2">
                      <TextInput 
                        type="number"
                        min="1"
                        placeholder="1"
                        value={watchedItems[index]?.requestedQuantity ?? ''}
                        onChange={(e) => setValue(`items.${index}.requestedQuantity`, Number(e.target.value) || '', { shouldValidate: true, shouldDirty: true })}
                        error={errors.items?.[index]?.requestedQuantity?.message as string}
                        disabled={isLocked}
                      />
                    </div>

                    <div className="col-span-2 flex items-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        isShortage 
                          ? 'bg-destructive/10 text-destructive border border-destructive/20' 
                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      }`}>
                        Avail: {stockAvailable}
                      </span>
                    </div>

                    <div className="col-span-2">
                      <TextInput 
                        placeholder="Optional note"
                        value={watchedItems[index]?.remarks ?? ''}
                        onChange={(e) => setValue(`items.${index}.remarks`, e.target.value, { shouldValidate: true, shouldDirty: true })}
                        disabled={isLocked}
                      />
                    </div>

                    <div className="col-span-1 flex justify-end pr-1">
                      {!isLocked && (
                        <button 
                          type="button" 
                          onClick={() => remove(index)}
                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                          title="Remove Item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile & Tablet Card Layout */}
            <div className="block xl:hidden space-y-4">
              {fields.map((field, index) => {
                const selectedMedId = watchedItems[index]?.medicineId;
                const stockAvailable = inventory.find((i: any) => String(i.medicineId) === String(selectedMedId))?.quantityAvailable || 0;
                const reqQty = Number(watchedItems[index]?.requestedQuantity || 0);
                const isShortage = reqQty > stockAvailable && selectedMedId;

                return (
                  <div 
                    key={field.id} 
                    className="p-4 sm:p-5 border border-border rounded-xl bg-card shadow-sm space-y-3.5"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-border/60">
                      <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold text-xs">
                        Item #{index + 1}
                      </span>
                      
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          isShortage 
                            ? 'bg-destructive/10 text-destructive' 
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        }`}>
                          Warehouse Stock: {stockAvailable}
                        </span>
                        {!isLocked && (
                          <button 
                            type="button" 
                            onClick={() => remove(index)}
                            className="p-1 rounded text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <SelectBox 
                        label="Medicine *" 
                        value={watchedItems[index]?.medicineId ?? ''}
                        onChange={(e) => setValue(`items.${index}.medicineId`, e.target.value, { shouldValidate: true, shouldDirty: true })}
                        options={medicines.map((m: any) => ({ 
                          value: String(m.id), 
                          label: m.productName + (m.genericName ? ` (${m.genericName})` : '') 
                        }))} 
                        placeholder="Select Medicine..."
                        error={errors.items?.[index]?.medicineId?.message as string}
                        disabled={isLocked}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <TextInput 
                        label="Requested Quantity *" 
                        type="number"
                        min="1"
                        placeholder="1"
                        value={watchedItems[index]?.requestedQuantity ?? ''}
                        onChange={(e) => setValue(`items.${index}.requestedQuantity`, Number(e.target.value) || '', { shouldValidate: true, shouldDirty: true })}
                        error={errors.items?.[index]?.requestedQuantity?.message as string}
                        disabled={isLocked}
                      />
                      <TextInput 
                        label="Remarks / Notes" 
                        placeholder="Reason or specification"
                        value={watchedItems[index]?.remarks ?? ''}
                        onChange={(e) => setValue(`items.${index}.remarks`, e.target.value, { shouldValidate: true, shouldDirty: true })}
                        disabled={isLocked}
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
                  <span>Total Items: <strong className="text-foreground">{totalItemsCount}</strong></span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Requested Units:</span>
                  <span className="text-lg sm:text-xl font-extrabold text-primary">
                    {totalRequestedUnits.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {typeof errors.items?.message === 'string' && (
              <p className="text-xs sm:text-sm font-medium text-destructive mt-1">{errors.items.message}</p>
            )}
          </div>
        </div>
      );
    },

    detailsMode: 'custom-modal',
    renderDetails: (entity: any, helpers?: { onClose: () => void }) => (
      <StockRequestReviewDetail
        entity={entity}
        onClose={helpers?.onClose}
        onRefresh={() => {
          window.dispatchEvent(new Event('warehouse-refresh'));
        }}
      />
    ),

    renderMobileCard: (row: any, actions) => {
      let statusTone = 'bg-muted text-foreground';
      const ns = String(row.Status || '').trim().toUpperCase().replace(/\s+/g, '_');
      if (['SUBMITTED', 'PENDING', 'UNDER_REVIEW', 'STOCK_UNAVAILABLE'].includes(ns)) {
        statusTone = ns === 'STOCK_UNAVAILABLE'
          ? 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border border-orange-500/30'
          : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30';
      } else if (['PARTIALLY_APPROVED', 'PARTIALLY_FULFILLED'].includes(ns)) {
        statusTone = 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30';
      } else if (['APPROVED', 'RESERVED', 'READY_FOR_FULFILLMENT'].includes(ns)) {
        statusTone = 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30';
      } else if (['READY_FOR_ISSUANCE', 'ISSUED', 'IN_TRANSIT'].includes(ns)) {
        statusTone = 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border border-cyan-500/30';
      } else if (ns === 'PARTIALLY_RECEIVED') {
        statusTone = 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30';
      } else if (['COMPLETED', 'RECEIVED', 'FULFILLED', 'CLOSED'].includes(ns)) {
        statusTone = 'bg-teal-500/15 text-teal-700 dark:text-teal-400 border border-teal-500/30';
      } else if (['REJECTED', 'CANCELLED'].includes(ns)) {
        statusTone = 'bg-destructive/15 text-destructive border border-destructive/30';
      }

      let prioTone = 'bg-muted text-muted-foreground';
      if (row.Priority === 'Urgent') prioTone = 'bg-amber-500/15 text-amber-700 dark:text-amber-400';
      if (row.Priority === 'Emergency') prioTone = 'bg-destructive/15 text-destructive';

      const facilityBadge = getFacilityTypeBadgeInfo(row.RequestingFacility, row.RequestingLocationID);

      return (
        <div
          onClick={actions.onView}
          className="p-4 rounded-2xl border border-border/70 bg-card shadow-xs space-y-3 active:bg-muted/30 transition-colors cursor-pointer"
        >
          <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-border/60">
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-mono font-bold text-primary">{row.RequestNumber}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${prioTone}`}>
                  {row.Priority || 'Routine'}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${facilityBadge.badgeClass}`}>
                  {facilityBadge.shortBadge}
                </span>
              </div>
              <h3 className="text-sm font-bold text-foreground mt-1">
                {row.RequestingFacility}
              </h3>
            </div>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0 ${statusTone}`}>
              {row.Status}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs bg-muted/30 p-2.5 rounded-xl border border-border/40">
            <div>
              <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Request Date</span>
              <span className="font-semibold text-foreground">
                {row.RequestDate ? new Date(row.RequestDate).toLocaleDateString() : '-'}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Required By</span>
              <span className="font-semibold text-foreground">
                {row.RequiredDate ? new Date(row.RequiredDate).toLocaleDateString() : '-'}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Line Items</span>
              <span className="font-bold text-primary">{row.ItemCount || 0} medicines</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={actions.onView}
              className="px-3.5 py-2 min-h-[38px] rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              Review & Approve
            </button>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="space-y-4">
      <StockRequestKPIs onFilterStatus={setStatusFilter} selectedStatus={statusFilter} />
      <EntityPage config={config} />
    </div>
  );
}
