import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X, Pill } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '../../app/components/ui/popover';
import { cn } from '../../lib/utils';

export interface SearchableOption {
  value: string;
  label: string;
  subtitle?: string;
  badge?: string;
}

export interface SearchableSelectProps {
  label?: string;
  value?: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  allowClear?: boolean;
}

export function SearchableSelect({
  label,
  value,
  onChange,
  options = [],
  placeholder = "Select or search...",
  searchPlaceholder = "Type keyword to search...",
  error,
  hint,
  disabled = false,
  required = false,
  className,
  allowClear = true,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Find currently selected option
  const selectedOption = useMemo(() => {
    return options.find(o => String(o.value) === String(value));
  }, [options, value]);

  // Filter options based on search query across label, subtitle, and badge
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter(o => 
      o.label.toLowerCase().includes(q) ||
      (o.subtitle && o.subtitle.toLowerCase().includes(q)) ||
      (o.badge && o.badge.toLowerCase().includes(q))
    );
  }, [options, searchQuery]);

  // Reset search and highlight when opening
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      // Default highlight to currently selected option if present, else 0
      const currentIdx = filteredOptions.findIndex(o => String(o.value) === String(value));
      setHighlightedIndex(currentIdx >= 0 ? currentIdx : 0);

      // Focus input after popover opens
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 60);
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

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange('');
    setSearchQuery('');
  };

  // Keyboard navigation within list
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
      setHighlightedIndex(prev => (prev + 1 < filteredOptions.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 >= 0 ? prev - 1 : filteredOptions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions[highlightedIndex]) {
        handleSelect(filteredOptions[highlightedIndex].value);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div className={cn("w-full space-y-1.5", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium leading-none text-foreground flex items-center">
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </label>
          {allowClear && value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="text-[11px] text-muted-foreground hover:text-destructive transition-colors font-medium hover:underline"
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
              "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-left group",
              disabled ? "cursor-not-allowed opacity-50 bg-muted/40" : "cursor-pointer",
              error && "border-destructive focus:ring-destructive/50",
              isOpen && "ring-2 ring-primary/40 border-primary"
            )}
            title={selectedOption ? selectedOption.label : placeholder}
          >
            <div className="flex items-center gap-2 truncate flex-1 min-w-0 pr-1">
              <Pill className={cn("w-4 h-4 shrink-0 transition-colors", selectedOption ? "text-primary" : "text-muted-foreground/60")} />
              {selectedOption ? (
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-semibold text-foreground tracking-tight truncate text-xs sm:text-sm">
                    {selectedOption.label}
                  </span>
                  {selectedOption.badge && (
                    <span className="text-[10px] font-bold text-muted-foreground bg-muted/70 px-1.5 py-0.5 rounded border border-border/50 shrink-0 hidden sm:inline-block">
                      {selectedOption.badge}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-muted-foreground text-xs sm:text-sm truncate">
                  {placeholder}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0 ml-1">
              {allowClear && value && !disabled && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={handleClear}
                  className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                  title="Clear medicine selection"
                >
                  <X className="w-3.5 h-3.5" />
                </span>
              )}

              <ChevronDown className={cn(
                "w-4 h-4 text-muted-foreground transition-transform duration-200",
                isOpen && "rotate-180 text-primary"
              )} />
            </div>
          </button>
        </PopoverTrigger>

        {/* Search & Selection Dropdown Menu */}
        <PopoverContent 
          className="z-[100] w-[var(--radix-popover-trigger-width)] min-w-[320px] max-w-[480px] p-0 bg-card text-card-foreground border border-border shadow-2xl rounded-xl overflow-hidden animate-in zoom-in-95 duration-150"
          align="start"
          sideOffset={6}
        >
          {/* Search Box Header */}
          <div className="p-2.5 border-b border-border bg-muted/30 flex items-center gap-2">
            <Search className="w-4 h-4 text-primary shrink-0 ml-1" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setHighlightedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder={searchPlaceholder}
              className="flex-1 bg-transparent text-xs sm:text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Clear search text"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Options List Container */}
          <div 
            ref={listRef}
            className="max-h-64 overflow-y-auto custom-scrollbar divide-y divide-border/40 p-1"
          >
            {filteredOptions.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground flex flex-col items-center justify-center gap-1.5">
                <Pill className="w-6 h-6 text-muted-foreground/40" />
                <p className="text-xs font-semibold text-foreground">No medicines found</p>
                <p className="text-[11px] text-muted-foreground max-w-[220px]">
                  No items match keyword <strong className="text-foreground">"{searchQuery}"</strong>
                </p>
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = String(opt.value) === String(value);
                const isHighlighted = idx === highlightedIndex;

                return (
                  <button
                    key={opt.value}
                    ref={(el) => (itemRefs.current[idx] = el)}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={cn(
                      "w-full text-left p-2.5 rounded-lg transition-all flex items-start gap-2.5 group cursor-pointer",
                      isSelected && "bg-primary/10 text-primary font-bold",
                      !isSelected && isHighlighted && "bg-muted/60 text-foreground",
                      !isSelected && !isHighlighted && "text-foreground hover:bg-muted/40"
                    )}
                  >
                    <div className={cn(
                      "w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                      isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:text-foreground"
                    )}>
                      {isSelected ? <Check className="w-3.5 h-3.5" /> : <Pill className="w-3.5 h-3.5" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className={cn(
                          "text-xs truncate tracking-tight",
                          isSelected ? "font-bold text-primary" : "font-semibold text-foreground"
                        )}>
                          {opt.label}
                        </p>
                        {opt.badge && (
                          <span className="text-[9px] font-bold text-muted-foreground bg-muted/80 px-1.5 py-0.5 rounded border border-border/50 shrink-0">
                            {opt.badge}
                          </span>
                        )}
                      </div>

                      {opt.subtitle && (
                        <p className="text-[11px] text-muted-foreground truncate font-normal mt-0.5">
                          {opt.subtitle}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Dropdown Footer */}
          <div className="p-2 border-t border-border bg-muted/20 flex items-center justify-between text-[11px] text-muted-foreground px-3">
            <span>
              {filteredOptions.length} of {options.length} medicines
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

      {/* Error or Hint */}
      {(error || hint) && (
        <p className={cn("text-xs font-medium", error ? "text-destructive" : "text-muted-foreground")}>
          {error || hint}
        </p>
      )}
    </div>
  );
}
