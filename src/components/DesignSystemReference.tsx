import React, { useState } from 'react';
import { AppShell } from './layout/AppShell';
import { PageContainer } from './layout/PageContainer';
import { Section } from './layout/Section';
import { Sidebar } from './navigation/Sidebar';
import { TopNavigation } from './navigation/TopNavigation';
import { StatCard } from './cards/StatCard';
import { KpiCard } from './cards/KpiCard';
import { TextInput } from './forms/TextInput';
import { SelectBox } from './forms/SelectBox';
import { StatusBadge } from './status/StatusBadge';
import { TrendIndicator } from './status/TrendIndicator';
import { EnterpriseTable } from './tables/EnterpriseTable';
import { Modal } from './feedback/Modal';
import { Button } from '../ui/button';
import { 
  Activity, Package, Users, Settings, Bell, LayoutDashboard, 
  Database, FileText, CheckCircle2 
} from 'lucide-react';

const MOCK_DATA = [
  { id: '1', name: 'Paracetamol', category: 'Analgesics', stock: 1200, status: 'success' },
  { id: '2', name: 'Amoxicillin', category: 'Antibiotics', stock: 450, status: 'warning' },
  { id: '3', name: 'Vitamin C', category: 'Supplements', stock: 0, status: 'error' },
];

export function DesignSystemReference() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeView, setActiveView] = useState('components');

  const navGroups = [
    {
      label: 'Main',
      items: [
        { id: 'components', label: 'Components UI', icon: LayoutDashboard },
        { id: 'data', label: 'Data Registry', icon: Database },
      ]
    },
    {
      label: 'System',
      items: [
        { id: 'reports', label: 'Reports', icon: FileText },
        { id: 'settings', label: 'Settings', icon: Settings },
      ]
    }
  ];

  const columns = [
    { header: 'ID', accessorKey: 'id', sortable: true },
    { header: 'Name', accessorKey: 'name', sortable: true },
    { header: 'Category', accessorKey: 'category' },
    { header: 'Stock', accessorKey: 'stock', sortable: true },
    { 
      header: 'Status', 
      accessorKey: 'status',
      cell: (row: any) => (
        <StatusBadge 
          status={row.status} 
          label={row.status === 'error' ? 'Out of Stock' : row.status === 'warning' ? 'Low Stock' : 'In Stock'} 
        />
      )
    },
  ];

  const sidebar = (
    <Sidebar 
      isOpen={isSidebarOpen}
      onClose={() => setIsSidebarOpen(false)}
      brandIcon={Activity}
      navGroups={navGroups}
      activeView={activeView}
      onNavigate={setActiveView}
    />
  );

  const header = (
    <TopNavigation 
      onMenuClick={() => setIsSidebarOpen(true)}
      onSearch={(q) => console.log('Search:', q)}
    />
  );

  return (
    <AppShell sidebar={sidebar} header={header}>
      <PageContainer>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Design System Reference</h1>
          <p className="text-muted-foreground mt-2">A unified collection of enterprise components.</p>
        </div>

        <Section title="1. Cards & Metrics" description="Reusable cards for dashboards.">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard 
              title="Total Patients" 
              value="1,248" 
              icon={Users} 
              trend="+12%" 
              trendDirection="up" 
            />
            <StatCard 
              title="Inventory Items" 
              value="842" 
              icon={Package} 
            />
            <KpiCard 
              label="Revenue" 
              value="₱1.4M" 
              trend="-2.4%" 
              trendDirection="down" 
              subtitle="Compared to last month"
            />
            <KpiCard 
              label="Active Alerts" 
              value="3" 
              subtitle="System notifications"
            />
          </div>
        </Section>

        <Section title="2. Status Indicators" description="Badges and trend metrics.">
          <div className="flex flex-wrap gap-4 p-4 bg-card rounded-xl border border-border">
            <StatusBadge status="success" label="Active" />
            <StatusBadge status="warning" label="Pending Review" />
            <StatusBadge status="error" label="Failed" />
            <StatusBadge status="info" label="Processing" />
            <StatusBadge status="neutral" label="Draft" />
            <div className="w-px h-6 bg-border mx-2"></div>
            <TrendIndicator value={12.5} />
            <TrendIndicator value={-4.2} />
          </div>
        </Section>

        <Section title="3. Form Elements" description="Inputs, selects, and controls.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-card rounded-xl border border-border">
            <TextInput label="Email Address" placeholder="Enter your email" type="email" required />
            <TextInput label="Username" error="This username is already taken" />
            <SelectBox 
              label="Department" 
              options={[
                { value: 'hr', label: 'Human Resources' },
                { value: 'it', label: 'Information Technology' }
              ]} 
              placeholder="Select a department"
            />
          </div>
        </Section>

        <Section 
          title="4. Data Tables" 
          description="Enterprise tables with sorting and pagination."
          headerAction={<Button onClick={() => setIsModalOpen(true)}>Open Modal</Button>}
        >
          <EnterpriseTable 
            data={MOCK_DATA}
            columns={columns}
            searchPlaceholder="Search inventory..."
          />
        </Section>

        {/* Modal Example */}
        <Modal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)}
          title="Create New Item"
          description="Add a new item to the registry."
          footer={
            <>
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button onClick={() => setIsModalOpen(false)}>Save Changes</Button>
            </>
          }
        >
          <div className="space-y-4 py-2">
            <TextInput label="Item Name" placeholder="e.g. Paracetamol 500mg" />
            <SelectBox 
              label="Category" 
              options={[{ value: 'med', label: 'Medicine' }, { value: 'sup', label: 'Supply' }]} 
            />
          </div>
        </Modal>

      </PageContainer>
    </AppShell>
  );
}
