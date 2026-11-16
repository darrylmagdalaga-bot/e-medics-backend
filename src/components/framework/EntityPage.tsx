import React, { useState, useEffect, useCallback } from 'react';
import { EntityConfig } from './types';
import { EntityToolbar } from './EntityToolbar';
import { EntityTable } from './EntityTable';
import { EntityFormDialog, EntityDeleteDialog } from './EntityDialogs';
import { AnimatePresence, motion } from 'motion/react';
import { EntityDetailsDrawer } from './EntityDetailsDrawer';
import { Section } from '../layout/Section';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { API_URL } from '../../app/api-config';

export interface EntityPageProps<T> {
  config: EntityConfig<T>;
}

export function EntityPage<T extends { id?: string | number }>({ config: rawConfig }: EntityPageProps<T>) {
  const queryClient = useQueryClient();
  // Normalize config to support both original and new properties, with useMemo to prevent infinite loops
  const config = React.useMemo(() => ({
    ...rawConfig,
    title: rawConfig.title || rawConfig.entityName || 'Entity',
    description: rawConfig.description || rawConfig.entityNamePlural,
    api: rawConfig.api || {
      fetch: () => fetch(`${API_URL}${rawConfig.apiEndpoint}`).then(res => res.json()),
      create: async (data: any) => {
        const res = await fetch(`${API_URL}${rawConfig.apiEndpoint}`, { method: 'POST', body: JSON.stringify(data), headers: {'Content-Type':'application/json'} });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.success === false) {
          throw new Error(json.message || json.error || `Failed to create ${rawConfig.entityName || 'record'}`);
        }
        return json;
      },
      update: async (id: string, data: any) => {
        const res = await fetch(`${API_URL}${rawConfig.apiEndpoint}/${id}`, { method: 'PUT', body: JSON.stringify(data), headers: {'Content-Type':'application/json'} });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.success === false) {
          throw new Error(json.message || json.error || `Failed to update ${rawConfig.entityName || 'record'}`);
        }
        return json;
      },
      delete: (id: string) => fetch(`${API_URL}${rawConfig.apiEndpoint}/${id}`, { method: 'DELETE' })
    }
  }), [rawConfig]);

  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Dialog States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isSavingRef = React.useRef(false);
  const isDeletingRef = React.useRef(false);
  
  // Selected Item State
  const [selectedItem, setSelectedItem] = useState<T | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const formDefaultValues = React.useMemo(() => selectedItem || {}, [selectedItem]);

  // Stabilize fetch function reference to prevent infinite loops
  const fetchRef = React.useRef(config.api.fetch);
  React.useEffect(() => {
    fetchRef.current = config.api.fetch;
  }, [config.api.fetch]);

  // Fetch Data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await fetchRef.current();
      setData(result);
    } catch (error) {
      console.error("Failed to load data", error);
      toast.error("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handleRefresh = () => loadData();
    window.addEventListener('warehouse-refresh', handleRefresh);
    return () => window.removeEventListener('warehouse-refresh', handleRefresh);
  }, [loadData]);

  // Handlers
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    // Real implementation would filter data locally or call API
  };

  const handleCreate = () => {
    setSelectedItem(null);
    setIsFormOpen(true);
  };

  const fetchFullItemDetails = async (item: T) => {
    if (!rawConfig.apiEndpoint || !item?.id) return item;
    try {
      const res = await fetch(`${API_URL}${rawConfig.apiEndpoint}/${item.id}`);
      if (res.ok) {
        const detail = await res.json();
        return { ...item, ...detail };
      }
    } catch {
      // Fall back to list item if detail endpoint is unavailable
    }
    return item;
  };

  const handleEdit = async (item: T) => {
    setSelectedItem(item);
    setIsFormOpen(true);
    const fullItem = await fetchFullItemDetails(item);
    setSelectedItem(fullItem);
  };

  const handleDelete = (item: T) => {
    setSelectedItem(item);
    setIsDeleteOpen(true);
  };

  const handleView = async (item: T) => {
    setSelectedItem(item);
    setIsDetailsOpen(true);
    const fullItem = await fetchFullItemDetails(item);
    setSelectedItem(fullItem);
  };

  const handleSaveForm = async (formData: Partial<T>) => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setIsSaving(true);
    try {
      if (selectedItem && selectedItem.id) {
        if (config.api.update) {
          await config.api.update(String(selectedItem.id), formData);
          toast.success(`${config.title} updated successfully`);
        }
      } else {
        if (config.api.create) {
          await config.api.create(formData);
          toast.success(`${config.title} created successfully`);
        }
      }
      setIsFormOpen(false);
      loadData();
      queryClient.invalidateQueries();
    } catch (error: any) {
      toast.error(error.message || `Failed to save ${config.title}`);
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedItem || !selectedItem.id || isDeletingRef.current) return;
    isDeletingRef.current = true;
    setIsDeleting(true);
    try {
      if (config.api.delete) {
        await config.api.delete(String(selectedItem.id));
      }
      toast.success(`${config.title} deleted successfully`);
      setIsDeleteOpen(false);
      loadData();
      queryClient.invalidateQueries();
    } catch (error) {
      toast.error("Failed to delete record");
    } finally {
      isDeletingRef.current = false;
      setIsDeleting(false);
    }
  };

  // Local filtering simulation based on search query + optional custom filter/sort
  const searchedData = data.filter((item) => 
    JSON.stringify(item).toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredData = config.filterData ? config.filterData(searchedData) : searchedData;

  return (
    <Section className="animate-in fade-in duration-500">
      <EntityToolbar
        title={config.title}
        description={config.description}
        canCreate={config.permissions.canCreate}
        canExport={config.permissions.canExport}
        onSearch={handleSearch}
        onCreateClick={handleCreate}
        onExportClick={() => toast.info("Export functionality triggered")}
      />

      {config.customToolbar && (
        <div className="mb-4">
          {config.customToolbar}
        </div>
      )}

      <EntityTable
        data={filteredData}
        columns={config.columns}
        isLoading={isLoading}
        permissions={config.permissions}
        onEditClick={handleEdit}
        onDeleteClick={handleDelete}
        onViewClick={handleView}
        renderMobileCard={config.renderMobileCard}
      />

      <EntityFormDialog
        isOpen={isFormOpen}
        onClose={() => !isSaving && setIsFormOpen(false)}
        title={selectedItem ? `Edit ${config.title}` : `Create ${config.title}`}
        description={config.description}
        maxWidth={config.formMaxWidth || 'xl'}
        isSaving={isSaving}
      >
        {config.renderForm ? (
          config.schema ? (
            <FormWrapper 
              schema={config.schema} 
              defaultValues={formDefaultValues} 
              onSubmit={handleSaveForm}
              render={(methods: any) => config.renderForm!(methods, handleSaveForm)}
            />
          ) : (
            config.renderForm(selectedItem || undefined, handleSaveForm)
          )
        ) : (
          <div className="text-center text-muted-foreground py-8">
            Form schema not configured for this entity.
          </div>
        )}
      </EntityFormDialog>

      <EntityDeleteDialog
        isOpen={isDeleteOpen}
        onClose={() => !isDeleting && setIsDeleteOpen(false)}
        title={`Delete ${config.title}`}
        itemName={selectedItem ? (selectedItem as any).name || (selectedItem as any).title : undefined}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />

      {config.detailsMode === 'custom-modal' ? (
        <AnimatePresence>
          {isDetailsOpen && selectedItem && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 md:p-6 overflow-y-auto">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsDetailsOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 16 }}
                transition={{ duration: 0.2 }}
                className="relative bg-card border border-border rounded-t-3xl sm:rounded-3xl w-full sm:max-w-3xl max-h-[94vh] sm:max-h-[90vh] overflow-hidden shadow-2xl flex flex-col my-auto z-50"
              >
                {config.renderDetails?.(selectedItem, { onClose: () => setIsDetailsOpen(false) })}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      ) : (
        <EntityDetailsDrawer
          isOpen={isDetailsOpen}
          onClose={() => setIsDetailsOpen(false)}
          title={`${config.title} Details`}
          item={selectedItem}
          renderDetails={config.renderDetails ? (item) => config.renderDetails!(item, { onClose: () => setIsDetailsOpen(false) }) : undefined}
        />
      )}
    </Section>
  );
}

function FormWrapper({ schema, defaultValues, onSubmit, render }: any) {
  const methods = useForm({
    resolver: zodResolver(schema),
    defaultValues
  });

  React.useEffect(() => {
    if (defaultValues) {
      methods.reset(defaultValues);
    }
  }, [defaultValues, methods]);
  
  const handleInvalid = (formErrors: Record<string, any>) => {
    const extractFirstError = (obj: any): string | null => {
      if (!obj || typeof obj !== 'object') return null;
      if (typeof obj.message === 'string' && obj.message) return obj.message;
      for (const val of Object.values(obj)) {
        const nested = extractFirstError(val);
        if (nested) return nested;
      }
      return null;
    };
    const msg = extractFirstError(formErrors) || 'Please check the required form fields before saving.';
    toast.error(msg);
  };

  return (
    <form id="entity-form" onSubmit={methods.handleSubmit(onSubmit, handleInvalid)}>
      {render(methods)}
    </form>
  );
}
