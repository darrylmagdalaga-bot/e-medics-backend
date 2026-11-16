import React from 'react';
import { EntityConfig } from '../../components/framework/types';
import { EntityPage } from '../../components/framework/EntityPage';
import { Tags } from 'lucide-react';
import { TextInput } from '../../components/forms/TextInput';
import { StatusBadge } from '../../components/status/StatusBadge';

// 1. Define the Entity Type
interface Category {
  id: string;
  name: string;
  description: string;
  status: 'Active' | 'Inactive';
  createdAt: string;
  createdBy: string;
}

// 2. Define Mock API (Simulating React Query / Fetch)
const mockApi = {
  fetch: async (): Promise<Category[]> => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));
    return [
      { id: '1', name: 'Analgesics', description: 'Pain relievers', status: 'Active', createdAt: '2026-07-20', createdBy: 'Admin' },
      { id: '2', name: 'Antibiotics', description: 'Bacterial infection treatment', status: 'Active', createdAt: '2026-07-21', createdBy: 'Admin' },
      { id: '3', name: 'Vitamins', description: 'Dietary supplements', status: 'Inactive', createdAt: '2026-07-22', createdBy: 'Admin' },
    ];
  },
  create: async (data: any) => data,
  update: async (id: string, data: any) => data,
  delete: async (id: string) => {},
};

// 3. Define the Configuration
export const MedicineCategoriesConfig: EntityConfig<Category> = {
  title: 'Medicine Categories',
  description: 'Manage categorization of all pharmaceutical items.',
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
    { header: 'Description', accessorKey: 'description' },
    { 
      header: 'Status', 
      accessorKey: 'status',
      cell: (row) => <StatusBadge status={row.status === 'Active' ? 'success' : 'neutral'} label={row.status} />
    }
  ],
  api: mockApi,
  
  // Custom Render for Forms (would typically use React Hook Form here)
  renderForm: (initialData) => (
    <div className="space-y-4">
      <TextInput 
        label="Category Name" 
        defaultValue={initialData?.name || ''} 
        placeholder="e.g. Analgesics" 
        required 
      />
      <TextInput 
        label="Description" 
        defaultValue={initialData?.description || ''} 
        placeholder="Brief description of this category" 
      />
      {/* Example static select for status */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Status</label>
        <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
          <option value="Active" selected={initialData?.status === 'Active'}>Active</option>
          <option value="Inactive" selected={initialData?.status === 'Inactive'}>Inactive</option>
        </select>
      </div>
    </div>
  ),

  // Custom Render for Details Drawer
  renderDetails: (item) => (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-muted-foreground">Category Name</h4>
        <p className="text-lg font-semibold text-foreground">{item.name}</p>
      </div>
      <div>
        <h4 className="text-sm font-medium text-muted-foreground">Description</h4>
        <p className="text-base text-foreground">{item.description}</p>
      </div>
    </div>
  )
};

// 4. Create the Page Component just by passing the config!
export function MedicineCategoriesExamplePage() {
  return <EntityPage config={MedicineCategoriesConfig} />;
}
