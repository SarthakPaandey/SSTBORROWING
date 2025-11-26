'use client';

import { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Calendar } from './Calendar';

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

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-2.5 rounded-lg bg-bg-dark border border-card-border text-text-main focus:border-accent-blue focus:outline-none transition-colors flex items-center justify-between ${className}`}
      >
        <span className={value ? 'text-text-main' : 'text-text-muted'}>
          {value ? formatDate(value) : placeholder}
        </span>
        <CalendarIcon className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 p-3 bg-bg-darker border border-card-border rounded-lg shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
          <Calendar
            selectedDate={value}
            onDateClick={handleDateClick}
            minDate={minDate}
          />
        </div>
      )}
    </div>
  );
}
