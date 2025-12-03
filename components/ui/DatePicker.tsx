'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getISTToday } from '@/lib/timezone-client';

interface DatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  minDate?: Date | string;
  placeholder?: string;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  minDate,
  placeholder = 'Select date',
  className = '',
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(value || new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalize minDate to start of day for accurate comparison
  const normalizedMinDate = minDate ? new Date(minDate) : null;
  if (normalizedMinDate) {
    normalizedMinDate.setHours(0, 0, 0, 0);
  }

  // Close popover when clicking outside is handled by the backdrop in the Portal
  // The previous useEffect for document.mousedown caused issues because the Portal content
  // is not inside containerRef, so every click was considered "outside"

  const formatDate = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleDateClick = (date: Date) => {
    onChange(date);
    setIsOpen(false);
  };

  // Calendar generation
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();

  const calendarDays = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(new Date(year, month, day));
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
    if (!value) return false;
    return (
      date.getDate() === value.getDate() &&
      date.getMonth() === value.getMonth() &&
      date.getFullYear() === value.getFullYear()
    );
  };

  const isDisabled = (date: Date) => {
    if (!normalizedMinDate) return false;
    return date < normalizedMinDate;
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

  return (
    <div ref={containerRef} className="relative cursor-pointer">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-2.5 rounded-lg bg-bg-dark border border-card-border text-text-main focus:border-accent-blue focus:outline-none transition-colors flex items-center justify-between hover:border-accent-blue/50 cursor-pointer ${className}`}
        aria-label="Select date"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <span className={value ? 'text-text-main' : 'text-text-muted'}>
          {value ? formatDate(value) : placeholder}
        </span>
        <CalendarIcon className={`h-4 w-4 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>


      {isOpen && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center" onClick={() => setIsOpen(false)}>
          <div
            className="w-[320px] p-4 bg-[#1a1d29] border-2 border-accent-blue/30 rounded-xl shadow-2xl relative animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Close Button */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-card-border">
              <h3 className="text-lg font-bold text-white">Select Date</h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors text-gray-400"
                aria-label="Close calendar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4 px-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goToPreviousMonth();
                }}
                className="p-2 hover:bg-accent-blue/10 hover:text-accent-blue rounded-lg transition-colors bg-bg-dark border border-card-border"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-base font-bold text-white">
                {monthNames[month]} {year}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goToNextMonth();
                }}
                className="p-2 hover:bg-accent-blue/10 hover:text-accent-blue rounded-lg transition-colors bg-bg-dark border border-card-border"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {daysOfWeek.map((day) => (
                <div key={day} className="text-[11px] font-bold text-gray-400 text-center py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2 mb-4">
              {calendarDays.map((date, index) => {
                if (!date) {
                  return <div key={`empty-${index}`} className="aspect-square" />;
                }

                const disabled = isDisabled(date);
                const selected = isSelected(date);
                const today = isToday(date);

                return (
                  <button
                    key={date.toISOString()}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!disabled) handleDateClick(date);
                    }}
                    disabled={disabled}
                    className={cn(
                      'aspect-square rounded-lg text-sm font-semibold transition-all relative',
                      'hover:bg-accent-blue/20 hover:text-white hover:scale-105',
                      disabled && 'opacity-30 cursor-not-allowed hover:bg-transparent hover:text-gray-600 hover:scale-100',
                      selected && 'bg-accent-blue text-white shadow-lg shadow-accent-blue/30 scale-105',
                      today && !selected && 'bg-[#252938] border-2 border-accent-blue text-accent-blue font-bold',
                      !selected && !today && !disabled && 'text-gray-200 bg-[#252938]/50 hover:bg-[#252938]'
                    )}
                  >
                    {date.getDate()}
                    {today && !selected && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent-blue rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-card-border">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const todayStr = getISTToday();
                  handleDateClick(new Date(todayStr));
                }}
                className="text-sm font-medium text-accent-blue hover:text-accent-blue/80 transition-colors px-3 py-1.5 hover:bg-accent-blue/10 rounded-md"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-sm font-medium text-gray-400 hover:text-white transition-colors px-3 py-1.5 hover:bg-white/5 rounded-md"
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
