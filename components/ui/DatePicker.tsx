'use client';

import { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  minDate?: Date;
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

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

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
    if (!minDate) return false;
    return date < minDate;
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-2.5 rounded-lg bg-bg-dark border border-card-border text-text-main focus:border-accent-blue focus:outline-none transition-colors flex items-center justify-between hover:border-accent-blue/50 ${className}`}
      >
        <span className={value ? 'text-text-main' : 'text-text-muted'}>
          {value ? formatDate(value) : placeholder}
        </span>
        <CalendarIcon className={`h-4 w-4 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-[280px] p-3 bg-bg-darker border border-card-border rounded-lg shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={goToPreviousMonth}
              className="p-1.5 hover:bg-bg-dark rounded-md transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-text-main" />
            </button>
            <span className="text-sm font-semibold text-text-main">
              {monthNames[month]} {year}
            </span>
            <button
              type="button"
              onClick={goToNextMonth}
              className="p-1.5 hover:bg-bg-dark rounded-md transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-text-main" />
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {daysOfWeek.map((day) => (
              <div key={day} className="text-[10px] font-medium text-text-muted text-center py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
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
                  onClick={() => !disabled && handleDateClick(date)}
                  disabled={disabled}
                  className={cn(
                    'aspect-square rounded-md text-xs font-medium transition-all',
                    'hover:bg-accent-blue/10 hover:text-accent-blue',
                    disabled && 'opacity-30 cursor-not-allowed hover:bg-transparent hover:text-text-muted',
                    selected && 'bg-accent-blue text-white hover:bg-accent-blue hover:text-white',
                    today && !selected && 'border border-accent-blue text-accent-blue',
                    !selected && !today && 'text-text-main'
                  )}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
