'use client';

import { useMemo } from 'react';
import { Button } from './Button';
import { cn } from '@/lib/utils';
import { getISTToday, getISTNow } from '@/lib/timezone-client';

interface TimePickerProps {
  date: string; // ISO date string (YYYY-MM-DD)
  value: string; // Time string (HH:mm)
  onChange: (time: string) => void;
  minTime?: string; // Time string (HH:mm), default "09:00"
  maxTime?: string; // Time string (HH:mm), default "20:00"
  stepMinutes?: number; // Minutes between slots, default 15
  label?: string;
  helperText?: string;
  className?: string;
}

export function TimePicker({
  date,
  value,
  onChange,
  minTime = '09:00',
  maxTime = '20:00',
  stepMinutes = 15,
  label,
  helperText,
  className,
}: TimePickerProps) {
  const availableTimes = useMemo(() => {
    const times: string[] = [];
    const [minHour, minMinute] = minTime.split(':').map(Number);
    const [maxHour, maxMinute] = maxTime.split(':').map(Number);

    const minTotalMinutes = minHour * 60 + minMinute;
    const maxTotalMinutes = maxHour * 60 + maxMinute;

    // Generate all possible time slots
    for (let totalMinutes = minTotalMinutes; totalMinutes <= maxTotalMinutes; totalMinutes += stepMinutes) {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      times.push(timeString);
    }

    // FIX: Filter out past times if date is today (using IST timezone)
    const today = getISTToday();
    if (date === today) {
      const now = getISTNow();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTotalMinutes = currentHour * 60 + currentMinute;

      // Round up to next step
      const roundedCurrentMinutes = Math.ceil(currentTotalMinutes / stepMinutes) * stepMinutes;

      return times.filter((time) => {
        const [hour, minute] = time.split(':').map(Number);
        const timeTotalMinutes = hour * 60 + minute;
        return timeTotalMinutes >= roundedCurrentMinutes;
      });
    }

    return times;
  }, [date, minTime, maxTime, stepMinutes]);

  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  return (
    <div className={cn('space-y-2', className)}>
      {label && <label className="text-sm font-medium">{label}</label>}
      {helperText && <p className="text-xs text-text-muted">{helperText}</p>}
      <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
        {availableTimes.length === 0 ? (
          <p className="text-sm text-text-muted py-4">No available times for this date</p>
        ) : (
          availableTimes.map((time) => (
            <Button
              key={time}
              variant={value === time ? 'default' : 'outline'}
              size="sm"
              onClick={() => onChange(time)}
              className={cn(
                'min-w-[100px]',
                value === time && 'shadow-lg shadow-accent-blue/30'
              )}
            >
              {formatTime(time)}
            </Button>
          ))
        )}
      </div>
    </div>
  );
}

