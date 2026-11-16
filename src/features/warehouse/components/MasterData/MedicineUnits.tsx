import React from 'react';
import { z } from 'zod';
import { Ruler, Activity } from 'lucide-react';
import { EntityPage } from '../../../../components/framework/EntityPage';
import { EntityConfig } from '../../../../components/framework/types';
import { TextInput } from '../../../../components/forms/TextInput';
import { SelectBox } from '../../../../components/forms/SelectBox';
import { Section } from '../../../../components/layout/Section';
import { Column } from '../../../../components/tables/EnterpriseTable';

// 1. Zod Schema for Validation
const MedicineUnitSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Unit Name is required").max(100, "Maximum 100 characters").trim(),
  abbreviation: z.string().max(20, "Maximum 20 characters").trim().transform(val => val.toUpperCase()).optional(),
  description: z.string().max(500, "Maximum 500 characters").trim().optional(),
  status: z.enum(['Active', 'Inactive']).default('Active'),
});

type MedicineUnitFormData = z.infer<typeof MedicineUnitSchema>;

// 2. Table Columns
const columns: Column<MedicineUnitFormData>[] = [
  { 
    id: 'name', 
    header: 'Unit Name', 
    accessorKey: 'name',
    sortable: true,
  },
  { 
    id: 'abbreviation', 
    header: 'Abbreviation', 
    accessorKey: 'abbreviation',
    sortable: true,
  },
  {
    id: 'status',
    header: 'Status',
    accessorKey: 'status',
    sortable: true,
  }
];

// 3. Entity Configuration
const config: EntityConfig<MedicineUnitFormData> = {
  entityName: 'Medicine Unit',
  entityNamePlural: 'Medicine Units',
  apiEndpoint: '/api/warehouse/medicine-units',
  icon: Ruler,
  columns,
  schema: MedicineUnitSchema,
  
  permissions: {
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canViewDetails: true,
  },

  renderForm: (methods) => {
    const { register, formState: { errors } } = methods;
    
    return (
      <div className="space-y-6">
        <Section title="Unit Information" description="Basic details about the medicine unit of measurement.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextInput
              label="Unit Name"
              placeholder="e.g. Milligram, Box, Tablet"
              {...register('name')}
              error={errors.name?.message as string}
              required
            />
            <TextInput
              label="Abbreviation"
              placeholder="e.g. mg, bx, tab"
              {...register('abbreviation')}
              error={errors.abbreviation?.message as string}
            />
            <div className="md:col-span-2">
              <TextInput
                label="Description"
                placeholder="Optional description"
                {...register('description')}
                error={errors.description?.message as string}
              />
            </div>
          </div>
        </Section>
        
        <Section title="Status">
          <SelectBox
            label="Status"
            {...register('status')}
            error={errors.status?.message as string}
            options={[
              { value: 'Active', label: 'Active' },
              { value: 'Inactive', label: 'Inactive' }
            ]}
          />
        </Section>
      </div>
    );
  },

  renderDetails: (entity) => {
    return (
      <div className="space-y-6 mt-4">
        <div className="p-4 bg-muted/50 rounded-lg border border-border">
          <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Unit Information
          </h4>
          <div className="grid grid-cols-2 gap-y-4 text-sm">
            <div>
              <p className="text-muted-foreground">Unit Name</p>
              <p className="font-medium text-foreground">{entity.name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Abbreviation</p>
              <p className="font-medium text-foreground">{entity.abbreviation || '-'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-muted-foreground">Description</p>
              <p className="font-medium text-foreground">{entity.description || '-'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <p className="font-medium text-foreground">{entity.status}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
};

export function MedicineUnits() {
  return <EntityPage<MedicineUnitFormData> config={config} />;
}
