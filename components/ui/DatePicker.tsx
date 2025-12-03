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


      {isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/20 backdrop-blur-sm flex items-center justify-center" onClick={() => setIsOpen(false)}>
          <div
            className="w-[280px] p-4 bg-[#1a1d29] border-2 border-accent-blue/30 rounded-xl shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-card-border">
              <button
                type="button"
                onClick={goToPreviousMonth}
                className="p-2 hover:bg-accent-blue/10 hover:text-accent-blue rounded-lg transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-base font-bold text-white">
                {monthNames[month]} {year}
              </span>
              <button
                type="button"
                onClick={goToNextMonth}
                className="p-2 hover:bg-accent-blue/10 hover:text-accent-blue rounded-lg transition-colors"
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
            <div className="grid grid-cols-7 gap-2">
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
                      'aspect-square rounded-lg text-sm font-semibold transition-all',
                      'hover:bg-accent-blue/20 hover:text-white hover:scale-105',
                      disabled && 'opacity-30 cursor-not-allowed hover:bg-transparent hover:text-gray-600 hover:scale-100',
                      selected && 'bg-accent-blue text-white shadow-lg shadow-accent-blue/30 scale-105',
                      today && !selected && 'bg-[#252938] border-2 border-accent-blue text-accent-blue font-bold',
                      !selected && !today && !disabled && 'text-gray-200 bg-[#252938]/50 hover:bg-[#252938]'
                    )}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
