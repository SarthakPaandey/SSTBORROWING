'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getISTToday } from '@/lib/timezone-client';

interface DatePickerProps {
  value: Date | string;
  onChange: (date: Date | string) => void;
  minDate?: Date | string;
  maxDate?: Date | string;
  placeholder?: string;
  className?: string;
  returnFormat?: 'date' | 'string'; // 'string' returns YYYY-MM-DD format
}

export function DatePicker({
  value,
  onChange,
  minDate,
  maxDate,
  placeholder = 'Select date',
  className = '',
  returnFormat = 'date',
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Parse value to Date object
  const valueAsDate = value instanceof Date ? value : (value ? new Date(value + 'T00:00:00') : null);

  const [currentMonth, setCurrentMonth] = useState(valueAsDate || new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse minDate and maxDate
  const normalizedMinDate = minDate ? (minDate instanceof Date ? new Date(minDate) : new Date(minDate + 'T00:00:00')) : null;
  if (normalizedMinDate) {
    normalizedMinDate.setHours(0, 0, 0, 0);
  }

  const normalizedMaxDate = maxDate ? (maxDate instanceof Date ? new Date(maxDate) : new Date(maxDate + 'T00:00:00')) : null;
  if (normalizedMaxDate) {
    normalizedMaxDate.setHours(23, 59, 59, 999);
  }

  // Format date for display (DD/MM/YYYY)
  const formatDateDisplay = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Format date as YYYY-MM-DD
  const formatDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleDateClick = (date: Date) => {
    if (returnFormat === 'string') {
      onChange(formatDateString(date));
    } else {
      onChange(date);
    }
    setIsOpen(false);
  };

  // Calendar generation
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const daysOfWeek = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();

  // Get days from previous month
  const prevMonth = new Date(year, month, 0);
  const daysInPrevMonth = prevMonth.getDate();

  const calendarDays: Array<{ date: Date; isCurrentMonth: boolean }> = [];

  // Previous month days
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    calendarDays.push({
      date: new Date(year, month - 1, daysInPrevMonth - i),
      isCurrentMonth: false
    });
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push({
      date: new Date(year, month, day),
      isCurrentMonth: true
    });
  }

  // Next month days (fill remaining)
  const remaining = 42 - calendarDays.length; // 6 rows × 7 days
  for (let day = 1; day <= remaining; day++) {
    calendarDays.push({
      date: new Date(year, month + 1, day),
      isCurrentMonth: false
    });
  }

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (date: Date) => {
    if (!valueAsDate) return false;
    return (
      date.getDate() === valueAsDate.getDate() &&
      date.getMonth() === valueAsDate.getMonth() &&
      date.getFullYear() === valueAsDate.getFullYear()
    );
  };

  const isDisabled = (date: Date) => {
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    if (normalizedMinDate && normalizedDate < normalizedMinDate) return true;
    if (normalizedMaxDate && normalizedDate > normalizedMaxDate) return true;
    return false;
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  // Handle hydration mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Get relative day label
  const getRelativeLabel = () => {
    if (!valueAsDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(valueAsDate);
    selected.setHours(0, 0, 0, 0);

    const diffTime = selected.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
    return null;
  };

  const relativeLabel = getRelativeLabel();

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Modern Clickable Date Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "group relative w-full flex items-center gap-3 px-4 py-3 rounded-xl",
          "bg-gradient-to-br from-violet-600/90 via-purple-600/90 to-violet-700/90",
          "hover:from-violet-500/90 hover:via-purple-500/90 hover:to-violet-600/90",
          "border border-violet-400/30 hover:border-violet-400/50",
          "shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30",
          "transition-all duration-300 cursor-pointer",
          isOpen && "ring-2 ring-violet-400/50 ring-offset-2 ring-offset-transparent"
        )}
        aria-label="Select date"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        {/* Calendar Icon */}
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center group-hover:bg-white/20 transition-colors">
          <CalendarDays className="h-5 w-5 text-white" />
        </div>

        {/* Date Display */}
        <div className="flex-1 text-left">
          <p className="text-[10px] text-violet-200/70 uppercase tracking-wider font-medium">
            {relativeLabel || 'Selected Date'}
          </p>
          <p className="text-lg font-bold text-white">
            {valueAsDate ? formatDateDisplay(valueAsDate) : placeholder}
          </p>
        </div>

        {/* Arrow indicator */}
        <div className={cn(
          "w-6 h-6 rounded-full bg-white/10 flex items-center justify-center transition-transform duration-300",
          isOpen && "rotate-180"
        )}>
          <ChevronLeft className="h-4 w-4 text-white/70 rotate-[-90deg]" />
        </div>
      </button>

      {/* Calendar Modal */}
      {isOpen && mounted && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-[340px] bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative px-5 pt-5 pb-4 bg-gradient-to-r from-violet-600/20 via-purple-600/20 to-violet-600/20 border-b border-white/5">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.15),transparent_70%)]" />

              <div className="relative flex items-center justify-between">
                <div>
                  <p className="text-xs text-violet-300/70 uppercase tracking-wider font-medium">Pick a date</p>
                  <p className="text-lg font-bold text-white mt-0.5">
                    {monthNames[month]} {year}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                  aria-label="Close calendar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goToPreviousMonth();
                }}
                className="p-2 hover:bg-white/10 rounded-lg transition-all text-gray-400 hover:text-white active:scale-95"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold text-white">
                {monthNamesShort[month]} {year}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goToNextMonth();
                }}
                className="p-2 hover:bg-white/10 rounded-lg transition-all text-gray-400 hover:text-white active:scale-95"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-0 px-3 py-2 bg-white/[0.02]">
              {daysOfWeek.map((day) => (
                <div key={day} className="text-[10px] font-bold text-gray-500 text-center py-1 uppercase">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 p-3">
              {calendarDays.map(({ date, isCurrentMonth }, index) => {
                const disabled = isDisabled(date);
                const selected = isSelected(date);
                const today = isToday(date);

                return (
                  <button
                    key={`${date.toISOString()}-${index}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!disabled && isCurrentMonth) handleDateClick(date);
                    }}
                    disabled={disabled || !isCurrentMonth}
                    className={cn(
                      'aspect-square rounded-lg text-sm font-medium transition-all duration-200 relative',
                      // Base styles
                      !isCurrentMonth && 'opacity-20 cursor-default',
                      isCurrentMonth && !disabled && 'hover:bg-violet-500/20 hover:scale-105 active:scale-95',
                      // Disabled
                      disabled && isCurrentMonth && 'opacity-30 cursor-not-allowed hover:bg-transparent hover:scale-100',
                      // Selected
                      selected && 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/40 scale-105 font-bold',
                      // Today (not selected)
                      today && !selected && isCurrentMonth && 'bg-white/10 text-violet-400 font-bold ring-2 ring-violet-500/50',
                      // Normal day
                      !selected && !today && isCurrentMonth && !disabled && 'text-gray-300 hover:text-white'
                    )}
                  >
                    {date.getDate()}
                    {today && !selected && isCurrentMonth && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-violet-400 rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/5 bg-white/[0.02]">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const todayStr = getISTToday();
                  handleDateClick(new Date(todayStr + 'T00:00:00'));
                }}
                className="flex items-center gap-2 text-sm font-medium text-violet-400 hover:text-violet-300 transition-colors px-3 py-2 hover:bg-violet-500/10 rounded-lg"
              >
                <CalendarIcon className="w-4 h-4" />
                Today
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-sm font-medium text-gray-400 hover:text-white transition-colors px-4 py-2 hover:bg-white/5 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
