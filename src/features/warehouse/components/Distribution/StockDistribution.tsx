import React, { useEffect } from 'react';
import { z } from 'zod';
import { useFieldArray, useWatch } from 'react-hook-form';
import { ArrowUpRight, CheckCircle2, XCircle, AlertTriangle, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { EntityPage } from '../../../../components/framework/EntityPage';
import { EntityConfig } from '../../../../components/framework/types';
import { Column } from '../../../../components/tables/EnterpriseTable';
import { TextInput } from '../../../../components/forms/TextInput';
import { SelectBox } from '../../../../components/forms/SelectBox';
import { Section } from '../../../../components/layout/Section';
import { Button } from '../../../../components/ui/button';
import { toast } from 'sonner';
import { API_URL, getActiveUserId } from '../../../../app/api-config';

const DistributionItemSchema = z.object({
  StockRequestItemID: z.number(),
  MedicineID: z.number(),
  InventoryID: z.number(),
  ProductName: z.string(),
  BatchNumber: z.string(),
  ExpiryDate: z.string().nullable(),
  QuantityAvailable: z.number(),
  RequestedQuantity: z.number(),
  IssuedQuantity: z.number().min(0, 'Cannot be negative'),
  Remarks: z.string().optional()
}).refine(data => data.IssuedQuantity <= data.RequestedQuantity, {
  message: "Issued quantity cannot exceed requested quantity",
  path: ["IssuedQuantity"]
}).refine(data => data.IssuedQuantity <= data.QuantityAvailable, {
  message: "Issued quantity cannot exceed available batch quantity",
  path: ["IssuedQuantity"]
});

const DistributionSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  StockRequestID: z.string().min(1, 'Required'),
  DestinationFacility: z.string().min(1, 'Required'),
  DestinationDepartment: z.string().optional(),
  Remarks: z.string().optional(),
  items: z.array(DistributionItemSchema).min(1, 'At least one item is required')
});

type DistributionFormData = z.infer<typeof DistributionSchema>;

const columns: Column<any>[] = [
  { id: 'DistributionNumber', header: 'Dist No.', accessorKey: 'DistributionNumber', sortable: true },
  { id: 'StockRequestNumber', header: 'Request No.', accessorKey: 'StockRequestNumber' },
  { 
    id: 'DistributionDate', 
    header: 'Date', 
    accessorKey: 'DistributionDate',
    cell: (row) => new Date(row.DistributionDate).toLocaleDateString()
  },
  { id: 'DestinationFacility', header: 'Destination', accessorKey: 'DestinationFacility' },
  { 
    id: 'Status', 
    header: 'Status', 
    accessorKey: 'Status',
    cell: (row) => {
      let color = 'bg-gray-100 text-gray-800';
      if (row.Status === 'Draft') color = 'bg-blue-100 text-blue-800';
      if (row.Status === 'Issued') color = 'bg-green-100 text-green-800';
      if (row.Status === 'Cancelled') color = 'bg-red-100 text-red-800';
      
      return <span className={`px-2 py-1 rounded text-xs font-semibold ${color}`}>{row.Status}</span>;
    }
  },
  { id: 'ItemCount', header: 'Allocations', accessorKey: 'ItemCount' }
];

export function StockDistribution() {
  const { data: approvedRequests = [] } = useQuery({
    queryKey: ['warehouse-approved-requests'],
    queryFn: () => fetch(`${API_URL}/api/warehouse/stock-requests/approved`).then(res => res.json())
  });

  const config: EntityConfig<DistributionFormData> = {
    entityName: 'Distribution',
    entityNamePlural: 'Distributions',
    apiEndpoint: '/api/warehouse/distributions',
    icon: ArrowUpRight,
    columns,
    schema: DistributionSchema,
    formMaxWidth: '5xl',
    
    permissions: {
      canCreate: true,
      canEdit: false, // Distributions are strictly immutable after creation/issuance
      canDelete: false, 
      canViewDetails: true,
    },

    renderForm: (methods) => {
      const { register, control, formState: { errors }, watch, setValue } = methods;
      const status = watch('Status') || 'Draft';
      const selectedRequestId = watch('StockRequestID');
      
      const isLocked = status !== 'Draft';

      const { fields, replace } = useFieldArray({
        control,
        name: "items"
      });

      const watchedItems = useWatch({ control, name: "items" }) || [];
      const totalAllocatedItems = fields.length;
      const totalIssuedUnits = watchedItems?.reduce((sum: number, item: any) => sum + (Number(item?.IssuedQuantity) || 0), 0) || 0;
      const totalRequestedUnits = watchedItems?.reduce((sum: number, item: any) => sum + (Number(item?.RequestedQuantity) || 0), 0) || 0;

      // When StockRequestID changes, fetch FEFO allocation
      useEffect(() => {
        if (selectedRequestId && !isLocked && !watch('id')) {
          const req = approvedRequests.find((r: any) => String(r.StockRequestID) === selectedRequestId);
          if (req) {
            setValue('DestinationFacility', req.RequestingFacility);
            setValue('DestinationDepartment', req.RequestingDepartment);
            
            // Fetch FEFO map
            fetch(`${API_URL}/api/warehouse/stock-requests/${selectedRequestId}/fefo-allocation`)
              .then(res => res.json())
              .then(allocations => {
                replace(allocations);
              })
              .catch(err => {
                toast.error("Failed to load FEFO allocation");
              });
          }
        }
      }, [selectedRequestId, isLocked, approvedRequests, replace, setValue, watch]);

      // Custom action handlers
      const handleAction = async (action: 'issue' | 'cancel') => {
        const id = watch('DistributionID');
        if (!id) return;
        
        try {
          const uid = getActiveUserId();
          const res = await fetch(`${API_URL}/api/warehouse/distributions/${id}/${action}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-user-id': String(uid) }
          });
          
          if (!res.ok) {
             const err = await res.json();
             throw new Error(err.error || "Action failed");
          }
          
          toast.success(`Distribution ${action === 'issue' ? 'Issued' : 'Cancelled'} successfully!`);
          window.dispatchEvent(new Event('warehouse-refresh')); 
        } catch(e: any) {
          toast.error(e.message || "Action failed");
        }
      };

      return (
        <div className="space-y-6">
          {status !== 'Draft' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 bg-muted/50 rounded-xl border border-border">
               <div className="flex items-center gap-2">
                 {status === 'Issued' && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0"/>}
                 {status === 'Cancelled' && <XCircle className="w-5 h-5 text-destructive shrink-0"/>}
                 <span className="font-semibold text-xs sm:text-sm">Status: <span className="font-bold">{status}</span></span>
               </div>
            </div>
          )}
          
          {status === 'Draft' && watch('DistributionID') && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-blue-500/10 text-blue-700 dark:text-blue-300 rounded-xl border border-blue-500/20">
               <div className="flex items-start gap-3">
                 <AlertTriangle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5"/>
                 <div className="text-xs sm:text-sm">
                   <p className="font-bold">Draft Distribution Pending</p>
                   <p className="text-muted-foreground mt-0.5">Review the FEFO allocations and click Issue to deduct inventory.</p>
                 </div>
               </div>
               <div className="flex gap-2 shrink-0 w-full sm:w-auto">
                 <Button type="button" onClick={() => handleAction('issue')} className="bg-emerald-600 hover:bg-emerald-700 text-xs sm:text-sm w-full sm:w-auto">
                   <CheckCircle2 className="w-4 h-4 mr-1.5"/> Issue Inventory
                 </Button>
                 <Button type="button" onClick={() => handleAction('cancel')} variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10 text-xs sm:text-sm w-full sm:w-auto">
                   Cancel
                 </Button>
               </div>
            </div>
          )}

          {/* Source Document Card */}
          <div className="bg-card/50 border border-border rounded-xl p-4 sm:p-5 space-y-4">
            <div className="border-b border-border/60 pb-2.5">
              <h3 className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-primary" />
                Source Document
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Select an approved stock request to populate items and auto-allocate inventory.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              <div className="sm:col-span-2 lg:col-span-1">
                <SelectBox
                  label="Approved Stock Request *"
                  {...register('StockRequestID')}
                  options={[
                    { value: '', label: 'Select Request...' },
                    ...approvedRequests.map((r: any) => ({ value: String(r.StockRequestID), label: `${r.RequestNumber} - ${r.RequestingFacility}` }))
                  ]}
                  placeholder="Select approved request..."
                  error={errors.StockRequestID?.message as string}
                  disabled={isLocked || !!watch('id')}
                />
              </div>
              <div>
                <TextInput
                  label="Destination Facility"
                  placeholder="Auto-populated from request"
                  {...register('DestinationFacility')}
                  error={errors.DestinationFacility?.message as string}
                  disabled={isLocked}
                  readOnly
                />
              </div>
              <div>
                <TextInput
                  label="Destination Department"
                  placeholder="Auto-populated from request"
                  {...register('DestinationDepartment')}
                  error={errors.DestinationDepartment?.message as string}
                  disabled={isLocked}
                  readOnly
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <TextInput
                  label="Remarks / Dispatch Notes"
                  placeholder="Add carrier, packaging, or handover details..."
                  {...register('Remarks')}
                  disabled={isLocked}
                />
              </div>
            </div>
          </div>

          {/* FEFO Batch Allocations */}
          <div className="space-y-4">
            <div className="border-b border-border pb-2.5">
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-primary" />
                FEFO Batch Allocations ({totalAllocatedItems})
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                The system automatically allocates batches based on the First-Expiring-First-Out rule.
              </p>
            </div>

            {fields.length === 0 && (
              <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border rounded-xl bg-muted/10 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
                  <ArrowUpRight className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">No Stock Request Selected</h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Choose an approved stock request from the dropdown above to load items and batch allocations.
                </p>
              </div>
            )}

            {/* Desktop Table View */}
            <div className="hidden xl:block space-y-3">
              {fields.length > 0 && (
                <div className="grid grid-cols-12 gap-3 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/40 rounded-lg border border-border">
                  <div className="col-span-4">Medicine</div>
                  <div className="col-span-3">Allocated Batch / Expiry</div>
                  <div className="col-span-2 text-center">Requested</div>
                  <div className="col-span-3">Issued Qty (Avail)</div>
                </div>
              )}

              {fields.map((field, index) => {
                const reqQty = watchedItems[index]?.RequestedQuantity || 0;
                const issueQty = watchedItems[index]?.IssuedQuantity || 0;
                const avail = watchedItems[index]?.QuantityAvailable || 0;
                const isOver = issueQty > avail;

                return (
                  <div 
                    key={field.id} 
                    className="grid grid-cols-12 gap-3 p-3 items-center border border-border rounded-xl bg-card hover:border-primary/40 transition-colors"
                  >
                    <div className="col-span-4">
                      <p className="font-semibold text-sm text-foreground">{watchedItems[index]?.ProductName}</p>
                      <p className="text-xs text-muted-foreground">ID: #{watchedItems[index]?.MedicineID}</p>
                    </div>
                    
                    <div className="col-span-3">
                      <div className="flex items-center gap-2">
                        <span className="bg-muted px-2 py-0.5 rounded text-xs font-mono font-medium border border-border">
                          {watchedItems[index]?.BatchNumber || 'N/A'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Exp: {watchedItems[index]?.ExpiryDate ? new Date(watchedItems[index].ExpiryDate).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div className="col-span-2 text-center">
                      <span className="text-sm font-bold text-foreground">{reqQty}</span>
                    </div>

                    <div className="col-span-3">
                      <div className="flex items-center gap-2">
                        <TextInput 
                          type="number"
                          min="0"
                          max={avail}
                          value={watchedItems[index]?.IssuedQuantity ?? ''}
                          onChange={(e) => setValue(`items.${index}.IssuedQuantity`, Number(e.target.value) || 0, { shouldValidate: true, shouldDirty: true })}
                          error={errors.items?.[index]?.IssuedQuantity?.message as string}
                          disabled={isLocked}
                        />
                        <span className={`text-xs whitespace-nowrap px-2 py-1 rounded-full font-medium ${
                          isOver ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
                        }`}>
                          Avail: {avail}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile & Tablet Card Layout */}
            <div className="block xl:hidden space-y-4">
              {fields.map((field, index) => {
                const reqQty = watchedItems[index]?.RequestedQuantity || 0;
                const issueQty = watchedItems[index]?.IssuedQuantity || 0;
                const avail = watchedItems[index]?.QuantityAvailable || 0;
                const isOver = issueQty > avail;

                return (
                  <div 
                    key={field.id} 
                    className="p-4 sm:p-5 border border-border rounded-xl bg-card shadow-sm space-y-3"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-border/60">
                      <span className="font-bold text-sm text-foreground">{watchedItems[index]?.ProductName}</span>
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold text-xs">
                        Item #{index + 1}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Batch: <strong className="text-foreground font-mono">{watchedItems[index]?.BatchNumber || 'N/A'}</strong></span>
                      <span>Exp: <strong className="text-foreground">{watchedItems[index]?.ExpiryDate ? new Date(watchedItems[index].ExpiryDate).toLocaleDateString() : 'N/A'}</strong></span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="text-xs text-muted-foreground">Requested</label>
                        <p className="text-base font-bold text-foreground mt-1">{reqQty}</p>
                      </div>
                      <div>
                        <TextInput 
                          label={`Issue Qty (Avail: ${avail})`}
                          type="number"
                          min="0"
                          max={avail}
                          value={watchedItems[index]?.IssuedQuantity ?? ''}
                          onChange={(e) => setValue(`items.${index}.IssuedQuantity`, Number(e.target.value) || 0, { shouldValidate: true, shouldDirty: true })}
                          error={errors.items?.[index]?.IssuedQuantity?.message as string}
                          disabled={isLocked}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary Footer */}
            {fields.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-muted/40 border border-border rounded-xl mt-4">
                <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
                  <span>Total Items: <strong className="text-foreground">{totalAllocatedItems}</strong></span>
                  <span className="mx-2">•</span>
                  <span>Requested: <strong className="text-foreground">{totalRequestedUnits}</strong></span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Issued Units:</span>
                  <span className="text-lg sm:text-xl font-extrabold text-primary">
                    {totalIssuedUnits.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    },

    renderDetails: (entity: any) => {
      const { data: items = [] } = useQuery({
        queryKey: ['warehouse-distribution-items', entity.DistributionID],
        queryFn: () => fetch(`${API_URL}/api/warehouse/distributions/${entity.DistributionID}/items`).then(res => res.json())
      });

      const handleDraftAction = async (action: 'issue' | 'cancel') => {
        if (!entity.DistributionID) return;
        try {
          const uid = getActiveUserId();
          const res = await fetch(`${API_URL}/api/warehouse/distributions/${entity.DistributionID}/${action}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-user-id': String(uid) }
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Action failed');
          }
          toast.success(`Distribution ${action === 'issue' ? 'Issued' : 'Cancelled'} successfully!`);
          window.location.reload();
        } catch (e: any) {
          toast.error(e.message || 'Action failed');
        }
      };

      return (
        <div className="space-y-6 mt-2">
          <Section title="Fulfillment Details" description="Distribution header and dispatch status.">
            <div className="grid grid-cols-2 gap-3.5 bg-muted/30 p-4 rounded-xl border border-border/60 text-sm">
              <div><p className="text-xs text-muted-foreground">Status</p><p className="font-bold text-base text-foreground">{entity.Status}</p></div>
              <div><p className="text-xs text-muted-foreground">Distribution No.</p><p className="font-mono font-bold text-primary">{entity.DistributionNumber}</p></div>
              <div><p className="text-xs text-muted-foreground">Source Request</p><p className="font-mono font-medium">{entity.StockRequestNumber}</p></div>
              <div><p className="text-xs text-muted-foreground">Destination</p><p className="font-semibold text-foreground">{entity.DestinationFacility}</p></div>
              <div><p className="text-xs text-muted-foreground">Created Date</p><p className="font-medium">{entity.DistributionDate ? new Date(entity.DistributionDate).toLocaleDateString() : '-'}</p></div>
              <div><p className="text-xs text-muted-foreground">Issued Date</p><p className="font-medium">{entity.IssuedDate ? new Date(entity.IssuedDate).toLocaleDateString() : 'Pending'}</p></div>
            </div>

            {entity.Status === 'Draft' && (
              <div className="flex flex-col sm:flex-row gap-2.5 mt-3">
                <Button
                  type="button"
                  onClick={() => handleDraftAction('issue')}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 min-h-[44px] rounded-xl font-semibold"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" /> Confirm & Issue FEFO Batches
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDraftAction('cancel')}
                  className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10 min-h-[44px] rounded-xl font-semibold"
                >
                  <XCircle className="w-4 h-4 mr-1.5" /> Cancel Draft
                </Button>
              </div>
            )}
          </Section>

          <Section title="FEFO Allocated Batches" description="Exact inventory batches allocated for this dispatch.">
            {/* Mobile Cards */}
            <div className="sm:hidden space-y-2.5">
              {items.map((item: any, i: number) => (
                <div key={i} className="p-3.5 rounded-xl border border-border bg-background space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-sm text-foreground">{item.ProductName}</span>
                    <span className="px-2 py-0.5 rounded bg-muted font-mono font-semibold text-foreground">
                      {item.BatchNumber || 'N/A'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1.5 border-t border-border/50">
                    <div>
                      <span className="text-[10px] uppercase text-muted-foreground block">Expiry</span>
                      <span className="font-medium text-foreground">
                        {item.ExpiryDate ? new Date(item.ExpiryDate).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-muted-foreground block">Requested</span>
                      <span className="font-semibold text-foreground">{item.RequestedQuantity}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase text-muted-foreground block">Issued Qty</span>
                      <span className="text-sm font-extrabold text-emerald-600">{item.IssuedQuantity}</span>
                    </div>
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <div className="p-6 text-center text-muted-foreground text-xs border border-dashed rounded-xl">
                  Loading batch allocations...
                </div>
              )}
            </div>

            {/* Desktop/Tablet Table */}
            <div className="hidden sm:block border rounded-xl overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5">Medicine</th>
                    <th className="px-4 py-2.5">Batch No.</th>
                    <th className="px-4 py-2.5">Expiry</th>
                    <th className="px-4 py-2.5 text-right">Requested Qty</th>
                    <th className="px-4 py-2.5 text-right">Issued Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item: any, i: number) => (
                    <tr key={i} className="hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium">{item.ProductName}</td>
                      <td className="px-4 py-3 font-mono text-xs">{item.BatchNumber}</td>
                      <td className="px-4 py-3">{item.ExpiryDate ? new Date(item.ExpiryDate).toLocaleDateString() : 'N/A'}</td>
                      <td className="px-4 py-3 text-right">{item.RequestedQuantity}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600">{item.IssuedQuantity}</td>
                    </tr>
                  ))}
                  {items.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Loading allocations...</td></tr>}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      );
    },

    renderMobileCard: (row: any, actions) => {
      let statusTone = 'bg-muted text-foreground';
      if (row.Status === 'Draft') statusTone = 'bg-blue-500/15 text-blue-700 dark:text-blue-400';
      if (row.Status === 'Issued') statusTone = 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400';
      if (row.Status === 'Cancelled') statusTone = 'bg-destructive/15 text-destructive';

      return (
        <div
          onClick={actions.onView}
          className="p-4 rounded-2xl border border-border/70 bg-card shadow-xs space-y-3 active:bg-muted/30 transition-colors cursor-pointer"
        >
          <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-border/60">
            <div>
              <span className="text-xs font-mono font-bold text-primary block">
                {row.DistributionNumber}
              </span>
              <h3 className="text-sm font-bold text-foreground mt-0.5">
                {row.DestinationFacility}
              </h3>
            </div>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0 ${statusTone}`}>
              {row.Status}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs bg-muted/30 p-2.5 rounded-xl border border-border/40">
            <div>
              <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Request Ref</span>
              <span className="font-mono font-semibold text-foreground">{row.StockRequestNumber || '-'}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Date</span>
              <span className="font-semibold text-foreground">
                {row.DistributionDate ? new Date(row.DistributionDate).toLocaleDateString() : '-'}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Allocations</span>
              <span className="font-bold text-primary">{row.ItemCount || 0} batches</span>
            </div>
          </div>

          <div className="flex items-center justify-end pt-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={actions.onView}
              className="px-3.5 py-2 min-h-[38px] rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors"
            >
              {row.Status === 'Draft' ? 'Review & Issue FEFO Batches' : 'View Allocated Batches'}
            </button>
          </div>
        </div>
      );
    }
  };

  return <EntityPage config={config} />;
}
