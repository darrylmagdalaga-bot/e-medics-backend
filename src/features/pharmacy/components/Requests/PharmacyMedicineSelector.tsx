import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Search,
  ChevronDown,
  Check,
  X,
  Pill,
  Building2,
  Package,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '../../../../app/components/ui/popover';
import { cn } from '../../../../lib/utils';
import { PharmacyRequestableMedicine } from '../../types';

export interface PharmacyMedicineSelectorProps {
  label?: string;
  value?: number;
  onChange: (medicineId: number, selectedMedicine?: PharmacyRequestableMedicine) => void;
  medicines: PharmacyRequestableMedicine[];
  disabledMedicineIds?: number[];
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  allowClear?: boolean;
}

export function PharmacyMedicineSelector({
  label,
  value,
  onChange,
  medicines = [],
  disabledMedicineIds = [],
  placeholder = "Search or select a medicine...",
  error,
  disabled = false,
  required = false,
  className,
  allowClear = true,
}: PharmacyMedicineSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Find currently selected medicine
  const selectedMedicine = useMemo(() => {
    if (!value) return undefined;
    return medicines.find(m => Number(m.id || m.MedicineID) === Number(value));
  }, [medicines, value]);

  // Filter medicines based on search across multiple fields
  const filteredMedicines = useMemo(() => {
    if (!searchQuery.trim()) return medicines;
    const q = searchQuery.toLowerCase().trim();
    return medicines.filter(m => {
      const pName = (m.productName || m.ProductName || '').toLowerCase();
      const gName = (m.genericName || m.GenericName || '').toLowerCase();
      const bName = (m.brandName || m.BrandName || '').toLowerCase();
      const code = (m.medicineCode || m.MedicineCode || '').toLowerCase();
      const str = (m.strength || '').toLowerCase();
      const form = (m.dosageForm || '').toLowerCase();
      const cat = (m.categoryName || m.CategoryName || '').toLowerCase();
      return (
        pName.includes(q) ||
        gName.includes(q) ||
        bName.includes(q) ||
        code.includes(q) ||
        str.includes(q) ||
        form.includes(q) ||
        cat.includes(q)
      );
    });
  }, [medicines, searchQuery]);

  // Focus search input when popover opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      const currentIdx = filteredMedicines.findIndex(
        m => Number(m.id || m.MedicineID) === Number(value)
      );
      setHighlightedIndex(currentIdx >= 0 ? currentIdx : 0);

      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Auto-scroll highlighted item into view
  useEffect(() => {
    if (isOpen && itemRefs.current[highlightedIndex]) {
      itemRefs.current[highlightedIndex]?.scrollIntoView({
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (med: PharmacyRequestableMedicine) => {
    const medId = Number(med.id || med.MedicineID);
    onChange(medId, med);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(0, undefined);
    setSearchQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1 < filteredMedicines.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 >= 0 ? prev - 1 : filteredMedicines.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const targetMed = filteredMedicines[highlightedIndex];
      if (targetMed) {
        handleSelect(targetMed);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  const formatSubtitle = (m: PharmacyRequestableMedicine) => {
    const parts: string[] = [];
    if (m.strength) parts.push(m.strength);
    if (m.dosageForm) parts.push(m.dosageForm);
    if (m.unitName || m.UnitName) parts.push(`• ${m.unitName || m.UnitName}`);
    const gen = m.genericName || m.GenericName;
    const prod = m.productName || m.ProductName;
    if (gen && gen !== prod) {
      parts.push(`(${gen})`);
    }
    return parts.join(' ');
  };

  return (
    <div className={cn("w-full space-y-1.5", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center">
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </label>
          {allowClear && value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="text-[11px] text-muted-foreground hover:text-destructive transition-colors font-medium hover:underline cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      )}

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            onKeyDown={handleKeyDown}
            className={cn(
              "flex min-h-[46px] w-full items-center justify-between rounded-xl border border-input bg-background/95 px-3 py-2 text-xs sm:text-sm text-foreground transition-all shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40 text-left group",
              disabled && "cursor-not-allowed opacity-50 bg-muted/40",
              error && "border-destructive focus:ring-destructive/50",
              isOpen && "ring-2 ring-emerald-500/40 border-emerald-500"
            )}
            title={selectedMedicine ? selectedMedicine.productName : placeholder}
          >
            <div className="flex items-center gap-2.5 truncate flex-1 min-w-0 pr-1">
              <div className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                selectedMedicine
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground group-hover:text-foreground"
              )}>
                <Pill className="w-3.5 h-3.5" />
              </div>

              {selectedMedicine ? (
                <div className="flex flex-col truncate min-w-0">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-bold text-foreground text-xs sm:text-sm truncate">
                      {selectedMedicine.productName || selectedMedicine.ProductName}
                    </span>
                    {(selectedMedicine.unitName || selectedMedicine.UnitName) && (
                      <span className="text-[10px] font-bold text-muted-foreground bg-muted/80 px-1.5 py-0.5 rounded border border-border/50 shrink-0 hidden sm:inline-block">
                        {selectedMedicine.unitName || selectedMedicine.UnitName}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground truncate font-normal">
                    {formatSubtitle(selectedMedicine) || 'Ready for replenishment'}
                  </span>
                </div>
              ) : (
                <span className="text-muted-foreground text-xs sm:text-sm truncate font-medium">
                  {placeholder}
                </span>
              )}
            </div>

            {/* Right side info & chevron */}
            <div className="flex items-center gap-2 shrink-0 ml-1.5">
              {selectedMedicine && (
                <div className="flex items-center gap-1.5">
                  {/* Pharmacy Stock Badge */}
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1",
                    selectedMedicine.pharmacyStock > 20
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                      : selectedMedicine.pharmacyStock > 0
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                        : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                  )}>
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full shrink-0",
                      selectedMedicine.pharmacyStock > 20
                        ? "bg-emerald-500"
                        : selectedMedicine.pharmacyStock > 0
                          ? "bg-amber-500"
                          : "bg-rose-500"
                    )} />
                    Pharm: {selectedMedicine.pharmacyStock}
                  </span>

                  {/* Central Warehouse Stock Badge */}
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold border hidden md:inline-flex items-center gap-1",
                    selectedMedicine.warehouseStock > 50
                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
                      : selectedMedicine.warehouseStock > 0
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                        : "bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/30"
                  )}>
                    <Building2 className="w-2.5 h-2.5" />
                    WH: {selectedMedicine.warehouseStock}
                  </span>
                </div>
              )}

              {allowClear && value && !disabled && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={handleClear}
                  className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                  title="Clear selection"
                >
                  <X className="w-3.5 h-3.5" />
                </span>
              )}

              <ChevronDown className={cn(
                "w-4 h-4 text-muted-foreground transition-transform duration-200",
                isOpen && "rotate-180 text-emerald-500"
              )} />
            </div>
          </button>
        </PopoverTrigger>

        {/* Dropdown Popover */}
        <PopoverContent
          className="z-[150] w-[calc(100vw-32px)] sm:w-[480px] max-w-[560px] p-0 bg-card text-card-foreground border border-border shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-150"
          align="start"
          sideOffset={6}
        >
          {/* Search Header */}
          <div className="p-3 border-b border-border bg-muted/30 flex items-center gap-2">
            <Search className="w-4 h-4 text-emerald-500 shrink-0 ml-1" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setHighlightedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search by name, generic, strength, category..."
              className="flex-1 bg-transparent text-xs sm:text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                title="Clear search text"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div
            ref={listRef}
            className="max-h-[300px] overflow-y-auto custom-scrollbar divide-y divide-border/40 p-1.5"
          >
            {filteredMedicines.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
                <Pill className="w-7 h-7 text-muted-foreground/40" />
                <p className="text-xs font-bold text-foreground">
                  {searchQuery ? "No medicines match your search" : "No requestable medicines found"}
                </p>
                <p className="text-[11px] text-muted-foreground max-w-[260px]">
                  {searchQuery ? (
                    <>No items found for <strong className="text-foreground">"{searchQuery}"</strong></>
                  ) : (
                    "Central Warehouse medicine master has no active items."
                  )}
                </p>
              </div>
            ) : (
              filteredMedicines.map((med, idx) => {
                const medId = Number(med.id || med.MedicineID);
                const isSelected = Number(value) === medId;
                const isHighlighted = idx === highlightedIndex;
                const isAlreadyAddedElsewhere = disabledMedicineIds.includes(medId) && !isSelected;

                return (
                  <button
                    key={medId}
                    ref={(el) => (itemRefs.current[idx] = el)}
                    type="button"
                    disabled={isAlreadyAddedElsewhere}
                    onClick={() => handleSelect(med)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={cn(
                      "w-full text-left p-2.5 rounded-xl transition-all flex items-start gap-2.5 group cursor-pointer relative",
                      isSelected && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30",
                      !isSelected && isHighlighted && "bg-muted/70 text-foreground",
                      !isSelected && !isHighlighted && "text-foreground hover:bg-muted/40",
                      isAlreadyAddedElsewhere && "opacity-45 cursor-not-allowed bg-muted/20"
                    )}
                  >
                    <div className={cn(
                      "w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                      isSelected
                        ? "bg-emerald-600 text-white"
                        : "bg-muted text-muted-foreground group-hover:text-foreground"
                    )}>
                      {isSelected ? <Check className="w-3.5 h-3.5" /> : <Pill className="w-3.5 h-3.5" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className={cn(
                          "text-xs truncate tracking-tight",
                          isSelected ? "font-bold text-emerald-600 dark:text-emerald-400" : "font-semibold text-foreground"
                        )}>
                          {med.productName || med.ProductName}
                        </span>

                        {isAlreadyAddedElsewhere && (
                          <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 shrink-0">
                            Already Added
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-muted-foreground truncate font-normal mt-0.5">
                        {formatSubtitle(med) || 'Standard unit'}
                      </p>

                      {/* Stock Status Indicators */}
                      <div className="flex items-center gap-2 mt-1.5 pt-1 border-t border-border/30">
                        {/* Pharmacy Stock Badge */}
                        <span className={cn(
                          "inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md",
                          med.pharmacyStock > 20
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : med.pharmacyStock > 0
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        )}>
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full shrink-0",
                            med.pharmacyStock > 20
                              ? "bg-emerald-500"
                              : med.pharmacyStock > 0
                                ? "bg-amber-500"
                                : "bg-rose-500"
                          )} />
                          Pharm: {med.pharmacyStock}
                        </span>

                        {/* Central Warehouse Available Badge */}
                        <span className={cn(
                          "inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md",
                          med.warehouseStock > 50
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            : med.warehouseStock > 0
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "bg-slate-500/10 text-slate-500 dark:text-slate-400"
                        )}>
                          <Building2 className="w-2.5 h-2.5" />
                          Warehouse: {med.warehouseStock}
                        </span>

                        {(med.categoryName || med.CategoryName) && (
                          <span className="text-[9px] text-muted-foreground/80 truncate ml-auto hidden sm:inline-block">
                            {med.categoryName || med.CategoryName}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Popover Footer */}
          <div className="p-2.5 border-t border-border bg-muted/20 flex items-center justify-between text-[11px] text-muted-foreground px-3">
            <span>
              Showing {filteredMedicines.length} of {medicines.length} requestable medicines
            </span>

            {value && allowClear && (
              <button
                type="button"
                onClick={handleClear}
                className="font-bold text-destructive hover:underline cursor-pointer"
              >
                Clear Selection
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {error && (
        <p className="text-xs font-semibold text-destructive mt-1 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
