import React from 'react';
import { z } from 'zod';
import { Truck, Activity, Building, Phone, MapPin, FileCheck } from 'lucide-react';
import { EntityPage } from '../../../../components/framework/EntityPage';
import { EntityConfig } from '../../../../components/framework/types';
import { TextInput } from '../../../../components/forms/TextInput';
import { SelectBox } from '../../../../components/forms/SelectBox';
import { Section } from '../../../../components/layout/Section';
import { Column } from '../../../../components/tables/EnterpriseTable';

// 1. Zod Schema for Validation
const SupplierSchema = z.object({
  id: z.string().optional(),
  supplierCode: z.string().trim().toUpperCase().optional(),
  supplierName: z.string().min(1, "Supplier Name is required").max(200, "Maximum 200 characters").trim(),
  businessName: z.string().max(200).trim().optional(),
  supplierType: z.string().max(50).optional(),
  status: z.enum(['Active', 'Inactive']).default('Active'),
  
  contactPerson: z.string().max(100).optional(),
  position: z.string().max(100).optional(),
  email: z.string().email("Invalid email format").max(100).optional().or(z.literal('')),
  telephone: z.string().max(50).optional(),
  mobileNumber: z.string().max(50).optional(),
  website: z.string().max(200).optional(),

  street: z.string().max(200).optional(),
  barangay: z.string().max(100).optional(),
  municipalityCity: z.string().max(100).optional(),
  province: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().max(100).optional(),

  businessPermitNumber: z.string().max(100).optional(),
  tin: z.string().max(50).optional(),
  fdaLicenseNumber: z.string().max(100).optional(),
  licenseExpirationDate: z.string().optional().or(z.literal('')),
  vatRegistered: z.boolean().default(false),
  supplierCategory: z.string().max(50).optional(),
});

type SupplierFormData = z.infer<typeof SupplierSchema>;

// 2. Table Columns
const columns: Column<SupplierFormData>[] = [
  { id: 'supplierCode', header: 'Supplier Code', accessorKey: 'supplierCode', sortable: true },
  { id: 'supplierName', header: 'Supplier Name', accessorKey: 'supplierName', sortable: true },
  { id: 'businessName', header: 'Business Name', accessorKey: 'businessName', sortable: true },
  { id: 'contactPerson', header: 'Contact Person', accessorKey: 'contactPerson', sortable: true },
  { id: 'mobileNumber', header: 'Mobile Number', accessorKey: 'mobileNumber' },
  { id: 'email', header: 'Email', accessorKey: 'email' },
  { id: 'status', header: 'Status', accessorKey: 'status', sortable: true }
];

// 3. Entity Configuration
const config: EntityConfig<SupplierFormData> = {
  entityName: 'Supplier',
  entityNamePlural: 'Suppliers',
  apiEndpoint: '/api/warehouse/suppliers',
  icon: Truck,
  columns,
  schema: SupplierSchema,
  formMaxWidth: '3xl',
  
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
        <Section title="General Information" description="Basic supplier registry details." headerAction={<Building className="w-5 h-5 text-muted-foreground" />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextInput label="Supplier Code" placeholder="Auto-generated if blank" {...register('supplierCode')} error={errors.supplierCode?.message as string} />
            <TextInput label="Supplier Name" placeholder="Official Supplier Name" {...register('supplierName')} error={errors.supplierName?.message as string} required />
            <TextInput label="Business Name" placeholder="DBA or Trading Name" {...register('businessName')} error={errors.businessName?.message as string} />
            <SelectBox label="Supplier Type" {...register('supplierType')} options={[
                { value: 'Manufacturer', label: 'Manufacturer' },
                { value: 'Distributor', label: 'Distributor' },
                { value: 'Wholesaler', label: 'Wholesaler' },
                { value: 'Importer', label: 'Importer' }
              ]} />
            <SelectBox label="Status" {...register('status')} options={[
                { value: 'Active', label: 'Active' },
                { value: 'Inactive', label: 'Inactive' }
              ]} />
          </div>
        </Section>
        
        <Section title="Contact Information" description="Primary contact details." headerAction={<Phone className="w-5 h-5 text-muted-foreground" />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextInput label="Contact Person" placeholder="Full Name" {...register('contactPerson')} error={errors.contactPerson?.message as string} />
            <TextInput label="Position" placeholder="Job Title" {...register('position')} error={errors.position?.message as string} />
            <TextInput label="Email Address" type="email" placeholder="example@domain.com" {...register('email')} error={errors.email?.message as string} />
            <TextInput label="Telephone" placeholder="Landline Number" {...register('telephone')} error={errors.telephone?.message as string} />
            <TextInput label="Mobile Number" placeholder="09XX-XXX-XXXX" {...register('mobileNumber')} error={errors.mobileNumber?.message as string} />
            <TextInput label="Website" placeholder="https://www.example.com" {...register('website')} error={errors.website?.message as string} />
          </div>
        </Section>

        <Section title="Business Address" description="Official physical and billing address." headerAction={<MapPin className="w-5 h-5 text-muted-foreground" />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <TextInput label="Street" placeholder="Building, Block, Street Name" {...register('street')} error={errors.street?.message as string} />
            </div>
            <TextInput label="Barangay" placeholder="Barangay" {...register('barangay')} error={errors.barangay?.message as string} />
            <TextInput label="Municipality / City" placeholder="City" {...register('municipalityCity')} error={errors.municipalityCity?.message as string} />
            <TextInput label="Province" placeholder="Province" {...register('province')} error={errors.province?.message as string} />
            <TextInput label="Region" placeholder="Region" {...register('region')} error={errors.region?.message as string} />
            <TextInput label="Postal Code" placeholder="ZIP Code" {...register('postalCode')} error={errors.postalCode?.message as string} />
            <TextInput label="Country" placeholder="Country" {...register('country')} error={errors.country?.message as string} />
          </div>
        </Section>

        <Section title="Regulatory Information" description="Licenses and permits." headerAction={<FileCheck className="w-5 h-5 text-muted-foreground" />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextInput label="Business Permit Number" placeholder="Permit No." {...register('businessPermitNumber')} error={errors.businessPermitNumber?.message as string} />
            <TextInput label="TIN" placeholder="Tax Identification Number" {...register('tin')} error={errors.tin?.message as string} />
            <TextInput label="FDA License Number" placeholder="LTO Number" {...register('fdaLicenseNumber')} error={errors.fdaLicenseNumber?.message as string} />
            <TextInput label="License Expiration Date" type="date" {...register('licenseExpirationDate')} error={errors.licenseExpirationDate?.message as string} />
            <SelectBox label="Supplier Category" {...register('supplierCategory')} options={[
                { value: 'Local', label: 'Local' },
                { value: 'International', label: 'International' },
                { value: 'Government', label: 'Government' }
              ]} />
            <div className="flex items-center space-x-2 mt-8">
              <input type="checkbox" id="vatRegistered" className="w-4 h-4 text-primary rounded border-input" {...register('vatRegistered')} />
              <label htmlFor="vatRegistered" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">VAT Registered</label>
            </div>
          </div>
        </Section>
      </div>
    );
  },

  renderDetails: (entity) => {
    return (
      <div className="space-y-6 mt-4">
        <div className="p-4 bg-muted/50 rounded-lg border border-border space-y-6">
          
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Building className="w-4 h-4 text-primary" /> General Information
            </h4>
            <div className="grid grid-cols-2 gap-y-4 text-sm">
              <div><p className="text-muted-foreground">Supplier Code</p><p className="font-medium text-foreground">{entity.supplierCode || '-'}</p></div>
              <div><p className="text-muted-foreground">Supplier Name</p><p className="font-medium text-foreground">{entity.supplierName}</p></div>
              <div><p className="text-muted-foreground">Business Name</p><p className="font-medium text-foreground">{entity.businessName || '-'}</p></div>
              <div><p className="text-muted-foreground">Supplier Type</p><p className="font-medium text-foreground">{entity.supplierType || '-'}</p></div>
              <div><p className="text-muted-foreground">Status</p><p className="font-medium text-foreground">{entity.status}</p></div>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary" /> Contact Information
            </h4>
            <div className="grid grid-cols-2 gap-y-4 text-sm">
              <div><p className="text-muted-foreground">Contact Person</p><p className="font-medium text-foreground">{entity.contactPerson || '-'}</p></div>
              <div><p className="text-muted-foreground">Position</p><p className="font-medium text-foreground">{entity.position || '-'}</p></div>
              <div><p className="text-muted-foreground">Mobile</p><p className="font-medium text-foreground">{entity.mobileNumber || '-'}</p></div>
              <div><p className="text-muted-foreground">Email</p><p className="font-medium text-foreground">{entity.email || '-'}</p></div>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" /> Address
            </h4>
            <div className="text-sm text-foreground">
              {entity.street ? <p>{entity.street}</p> : null}
              {entity.barangay || entity.municipalityCity || entity.province ? (
                <p>
                  {[entity.barangay, entity.municipalityCity, entity.province].filter(Boolean).join(', ')}
                </p>
              ) : null}
              {entity.region || entity.country || entity.postalCode ? (
                <p>
                  {[entity.region, entity.country, entity.postalCode].filter(Boolean).join(', ')}
                </p>
              ) : null}
              {!entity.street && !entity.barangay && !entity.municipalityCity && !entity.province && <p className="text-muted-foreground">-</p>}
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-primary" /> Regulatory
            </h4>
            <div className="grid grid-cols-2 gap-y-4 text-sm">
              <div><p className="text-muted-foreground">TIN</p><p className="font-medium text-foreground">{entity.tin || '-'}</p></div>
              <div><p className="text-muted-foreground">FDA License</p><p className="font-medium text-foreground">{entity.fdaLicenseNumber || '-'}</p></div>
              <div><p className="text-muted-foreground">VAT Registered</p><p className="font-medium text-foreground">{entity.vatRegistered ? 'Yes' : 'No'}</p></div>
            </div>
          </div>

        </div>
      </div>
    );
  }
};

export function Suppliers() {
  return <EntityPage<SupplierFormData> config={config} />;
}
