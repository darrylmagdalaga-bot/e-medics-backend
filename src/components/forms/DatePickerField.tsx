import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Check, Sparkles, RotateCcw } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '../../app/components/ui/popover';
import { cn } from '../../lib/utils';

export interface DatePickerFieldProps {
  label?: string;
  value?: string; // ISO date 'YYYY-MM-DD'
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  minYear?: number;
  maxYear?: number;
  mode?: 'delivery' | 'expiry' | 'general';
  className?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const SHORT_MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Format a date object to 'YYYY-MM-DD'
function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Parse 'YYYY-MM-DD' string safely to year, month (0-indexed), and day
function parseIsoDate(str?: string) {
  if (!str) return null;
  const parts = str.split('-');
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return { year: y, month: m, day: d };
}

export function DatePickerField({
  label,
  value,
  onChange,
  error,
  hint,
  disabled = false,
  required = false,
  placeholder = "Select date...",
  minYear,
  maxYear,
  mode = 'delivery',
  className
}: DatePickerFieldProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Today reference
  const today = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => toIsoDate(today), [today]);

  const parsed = useMemo(() => parseIsoDate(value), [value]);

  // Current view year & month for calendar navigation
  const [viewYear, setViewYear] = useState<number>(() => parsed?.year || today.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(() => parsed?.month ?? today.getMonth());

  // Update view when value changes from outside
  useEffect(() => {
    if (parsed) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
    }
  }, [value]);

  // Determine year range
  const currentYear = today.getFullYear();
  const yearStart = minYear ?? (mode === 'expiry' ? currentYear : currentYear - 8);
  const yearEnd = maxYear ?? (mode === 'expiry' ? currentYear + 12 : currentYear + 6);
  
  const yearsList = useMemo(() => {
    const list: number[] = [];
    for (let y = yearStart; y <= yearEnd; y++) {
      list.push(y);
    }
    // If the currently viewed or selected year isn't in list, add it
    if (viewYear < yearStart) list.unshift(viewYear);
    if (viewYear > yearEnd) list.push(viewYear);
    return list;
  }, [yearStart, yearEnd, viewYear]);

  // Calculate calendar grid days for viewYear & viewMonth
  const calendarDays = useMemo(() => {
    const totalDaysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const startDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sunday
    
    // Days from previous month to fill the first row
    const prevMonthDaysCount = new Date(viewYear, viewMonth, 0).getDate();
    const prevDays: { day: number; isCurrentMonth: boolean; iso: string }[] = [];
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthDaysCount - i;
      const prevDate = new Date(viewYear, viewMonth - 1, d);
      prevDays.push({ day: d, isCurrentMonth: false, iso: toIsoDate(prevDate) });
    }

    // Days in current month
    const currentDays: { day: number; isCurrentMonth: boolean; iso: string }[] = [];
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const curDate = new Date(viewYear, viewMonth, d);
      currentDays.push({ day: d, isCurrentMonth: true, iso: toIsoDate(curDate) });
    }

    // Days in next month to complete standard 35 or 42 grid cells
    const nextDays: { day: number; isCurrentMonth: boolean; iso: string }[] = [];
    const totalRendered = prevDays.length + currentDays.length;
    const remaining = totalRendered <= 35 ? 35 - totalRendered : 42 - totalRendered;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(viewYear, viewMonth + 1, d);
      nextDays.push({ day: d, isCurrentMonth: false, iso: toIsoDate(nextDate) });
    }

    return [...prevDays, ...currentDays, ...nextDays];
  }, [viewYear, viewMonth]);

  const handleSelectDate = (iso: string) => {
    onChange(iso);
    setIsOpen(false);
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const handleSetToday = () => {
    onChange(todayIso);
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setIsOpen(false);
  };

  const handleSetYesterday = () => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const iso = toIsoDate(y);
    onChange(iso);
    setViewYear(y.getFullYear());
    setViewMonth(y.getMonth());
    setIsOpen(false);
  };

  const handleAddYears = (yearsToAdd: number) => {
    const base = parsed ? new Date(parsed.year, parsed.month, parsed.day) : new Date();
    base.setFullYear(base.getFullYear() + yearsToAdd);
    const iso = toIsoDate(base);
    onChange(iso);
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth());
    setIsOpen(false);
  };

  // Formatted display text
  const displayLabel = useMemo(() => {
    if (!parsed) return null;
    const dateObj = new Date(parsed.year, parsed.month, parsed.day);
    const monthStr = SHORT_MONTH_NAMES[parsed.month];
    return `${monthStr} ${parsed.day}, ${parsed.year}`;
  }, [parsed]);

  const isTodaySelected = value === todayIso;

  return (
    <div className={cn("w-full space-y-1.5", className)}>
      {/* Label and Quick Set Today shortcut */}
      <div className="flex items-center justify-between">
        {label && (
          <label className="text-sm font-medium leading-none text-foreground flex items-center gap-1">
            {label}
            {required && <span className="text-destructive">*</span>}
          </label>
        )}

        {!disabled && (
          <button
            type="button"
            onClick={handleSetToday}
            className="text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-1 hover:underline"
            title="Set to today's date"
          >
            <Sparkles className="w-3 h-3 text-primary" />
            Set Today
          </button>
        )}
      </div>

      {/* Popover Trigger Input Button */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-left",
              disabled ? "cursor-not-allowed opacity-50 bg-muted/40" : "cursor-pointer",
              error && "border-destructive focus:ring-destructive/50",
              isOpen && "ring-2 ring-primary/40 border-primary"
            )}
          >
            <div className="flex items-center gap-2 truncate flex-1 min-w-0">
              <CalendarIcon className="w-4 h-4 text-primary shrink-0" />
              {displayLabel ? (
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-semibold text-foreground tracking-tight text-xs sm:text-sm truncate">
                    {displayLabel}
                  </span>
                  {isTodaySelected && (
                    <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full border border-primary/20 shrink-0">
                      Today
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-muted-foreground text-xs sm:text-sm">{placeholder}</span>
              )}
            </div>

            <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200 shrink-0 ml-1.5", isOpen && "rotate-90 text-primary")} />
          </button>
        </PopoverTrigger>

        {/* Dropdown Popover Content with Direct Year/Month Dropdowns */}
        <PopoverContent 
          className="z-[100] w-[320px] sm:w-[350px] p-3.5 bg-card text-card-foreground border border-border shadow-2xl rounded-2xl animate-in zoom-in-95 duration-150"
          align="start"
          sideOffset={6}
        >
          {/* Header: Year & Month Selectors with Prev/Next buttons */}
          <div className="flex items-center justify-between gap-1.5 pb-3 border-b border-border">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Direct Month & Year Dropdowns */}
            <div className="flex items-center gap-1.5 flex-1 justify-center">
              {/* Month Select */}
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                className="h-8 px-2 text-xs sm:text-sm font-bold bg-muted/60 border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                title="Select Month"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx} className="bg-card text-foreground">
                    {name}
                  </option>
                ))}
              </select>

              {/* Year Select - The Crucial Feature Requested by User! */}
              <select
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                className="h-8 px-2 text-xs sm:text-sm font-bold bg-muted/60 border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                title="Select Year"
              >
                {yearsList.map((y) => (
                  <option key={y} value={y} className="bg-card text-foreground font-semibold">
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Shortcuts Bar */}
          <div className="flex items-center gap-1.5 py-2.5 overflow-x-auto no-scrollbar border-b border-border/60">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 mr-1">
              Quick:
            </span>
            <button
              type="button"
              onClick={handleSetToday}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-semibold transition-colors shrink-0 border",
                isTodaySelected
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/40 hover:bg-muted text-foreground border-border"
              )}
            >
              Today
            </button>

            {mode === 'delivery' && (
              <button
                type="button"
                onClick={handleSetYesterday}
                className="px-2.5 py-1 rounded-md text-xs font-semibold bg-muted/40 hover:bg-muted text-foreground border border-border transition-colors shrink-0"
              >
                Yesterday
              </button>
            )}

            {mode === 'expiry' && (
              <>
                <button
                  type="button"
                  onClick={() => handleAddYears(1)}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold bg-muted/40 hover:bg-muted text-foreground border border-border transition-colors shrink-0"
                >
                  +1 Year
                </button>
                <button
                  type="button"
                  onClick={() => handleAddYears(2)}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold bg-muted/40 hover:bg-muted text-foreground border border-border transition-colors shrink-0"
                >
                  +2 Years
                </button>
                <button
                  type="button"
                  onClick={() => handleAddYears(3)}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold bg-muted/40 hover:bg-muted text-foreground border border-border transition-colors shrink-0"
                >
                  +3 Years
                </button>
              </>
            )}
          </div>

          {/* Day of Week Header */}
          <div className="grid grid-cols-7 gap-1 pt-2.5 pb-1 text-center">
            {DAYS_OF_WEEK.map((day, i) => (
              <div 
                key={day} 
                className={cn(
                  "text-[11px] font-bold py-1",
                  i === 0 || i === 6 ? "text-primary/70" : "text-muted-foreground"
                )}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map(({ day, isCurrentMonth, iso }) => {
              const isSelected = value === iso;
              const isToday = todayIso === iso;

              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => handleSelectDate(iso)}
                  className={cn(
                    "h-8 w-full rounded-lg text-xs font-medium flex items-center justify-center transition-all relative",
                    !isCurrentMonth && "text-muted-foreground/40 hover:text-foreground hover:bg-muted/30",
                    isCurrentMonth && !isSelected && "text-foreground hover:bg-muted",
                    isSelected && "bg-primary text-primary-foreground font-black shadow-sm scale-105",
                    isToday && !isSelected && "border border-primary/50 font-bold text-primary"
                  )}
                >
                  {day}
                  {isToday && !isSelected && (
                    <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer with Manual Direct Input & Current Selection */}
          <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span>Date:</span>
              <input
                type="text"
                placeholder="YYYY-MM-DD"
                value={value || ''}
                onChange={(e) => {
                  const val = e.target.value.trim();
                  onChange(val);
                  const p = parseIsoDate(val);
                  if (p) {
                    setViewYear(p.year);
                    setViewMonth(p.month);
                  }
                }}
                className="w-24 px-1.5 py-0.5 text-xs font-mono bg-muted/50 border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs font-bold text-primary hover:underline px-1.5 py-0.5"
            >
              Done
            </button>
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
