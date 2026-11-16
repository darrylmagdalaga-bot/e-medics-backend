import React from 'react';
import { z } from 'zod';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { EntityConfig } from '../../../../components/framework/types';
import { EntityPage } from '../../../../components/framework/EntityPage';
import { Tags, User, Clock } from 'lucide-react';
import { TextInput } from '../../../../components/forms/TextInput';
import { SelectBox } from '../../../../components/forms/SelectBox';
import { StatusBadge } from '../../../../components/status/StatusBadge';
import { API_URL } from '../../../../app/api-config';

// 1. Zod Schema
const categorySchema = z.object({
  name: z.string().min(1, 'Category Name is required').max(100, 'Maximum 100 characters').trim(),
  description: z.string().max(255).optional(),
  status: z.enum(['Active', 'Inactive']).default('Active'),
});

type CategoryFormData = z.infer<typeof categorySchema>;

interface Category {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string;
  modifiedAt?: string;
  modifiedBy?: string;
  status: 'Active' | 'Inactive';
}

const API_BASE = `${API_URL}/api/warehouse/medicine-categories`;

// 2. Configuration
export const MedicineCategoriesConfig: EntityConfig<Category> = {
  title: 'Medicine Categories',
  description: 'Manage categorization of all pharmaceutical items in the Warehouse.',
  icon: Tags,
  permissions: {
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canExport: true,
  },
  columns: [
    { header: 'ID', accessorKey: 'id', sortable: true },
    { header: 'Category Name', accessorKey: 'name', sortable: true },
    { 
      header: 'Status', 
      accessorKey: 'status',
      cell: (row) => <StatusBadge status={row.status === 'Active' ? 'success' : 'neutral'} label={row.status} />
    }
  ],
  api: {
    fetch: async () => {
      const res = await fetch(API_BASE);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    create: async (data) => {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to create');
      }
      return res.json();
    },
    update: async (id, data) => {
      const res = await fetch(`${API_BASE}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update');
      return res.json();
    },
    delete: async (id) => {
      const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
    },
  },
  
  // 3. Render Form
  renderForm: (initialData, onSave) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const methods = useForm<CategoryFormData>({
      resolver: zodResolver(categorySchema),
      defaultValues: {
        name: initialData?.name || '',
        description: '', // Description is simulated
        status: initialData?.status || 'Active',
      }
    });

    const { register, handleSubmit, formState: { errors } } = methods;

    const onSubmit = (data: CategoryFormData) => {
      if (onSave) onSave(data);
    };

    return (
      <FormProvider {...methods}>
        <form id="entity-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <TextInput 
            label="Category Name" 
            placeholder="e.g. Analgesics" 
            {...register('name')}
            error={errors.name?.message}
            required 
          />
          <TextInput 
            label="Description" 
            placeholder="Brief description of this category (Simulated)" 
            {...register('description')}
            error={errors.description?.message}
          />
          <SelectBox 
            label="Status" 
            options={[
              { value: 'Active', label: 'Active' },
              { value: 'Inactive', label: 'Inactive' }
            ]} 
            {...register('status')}
            error={errors.status?.message}
          />
        </form>
      </FormProvider>
    );
  },

  // 4. Render Details
  renderDetails: (item) => (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-muted-foreground">Category Name</h4>
        <p className="text-lg font-semibold text-foreground">{item.name}</p>
      </div>
      {/* We can omit description as it is not strictly stored, but this matches requirements */}
    </div>
  )
};

export function MedicineCategories() {
  return <EntityPage config={MedicineCategoriesConfig} />;
}
