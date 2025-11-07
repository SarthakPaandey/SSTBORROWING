'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';
import { Badge } from './Badge';
import { cn } from '@/lib/utils';

export type CalendarEvent = {
  id: string;
  title: string;
  date: Date;
  type: 'FACILITY' | 'ROOM' | 'EQUIPMENT';
  status: string;
};

export interface CalendarProps {
  events?: CalendarEvent[];
  onDateClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  selectedDate?: Date;
}

export function Calendar({ events = [], onDateClick, onEventClick, selectedDate }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Get first day of month and number of days
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();

  // Get events for a specific date
  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.date);
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear()
      );
    });
  };

  // Check if date is today
  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Check if date is selected
  const isSelected = (date: Date) => {
    if (!selectedDate) return false;
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  // Navigate months
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Generate calendar days
  const calendarDays = [];

  // Add empty cells for days before the first day of the month
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null);
  }

  // Add cells for each day of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(new Date(year, month, day));
  }

  // Get event type color
  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'FACILITY':
        return 'bg-accent-blue';
      case 'ROOM':
        return 'bg-accent-purple-1';
      case 'EQUIPMENT':
        return 'bg-success';
      default:
        return 'bg-badge-blue';
    }
  };

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-text-main">
            {monthNames[month]} {year}
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            className="hidden sm:inline-flex"
          >
            Today
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPreviousMonth}
            className="h-9 w-9 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={goToNextMonth}
            className="h-9 w-9 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-lg border border-card-border bg-card overflow-hidden">
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b border-card-border bg-bg-dark">
          {daysOfWeek.map((day) => (
            <div
              key={day}
              className="p-2 sm:p-3 text-center text-xs sm:text-sm font-semibold text-text-muted"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7">
          {calendarDays.map((date, index) => {
            if (!date) {
              return (
                <div
                  key={`empty-${index}`}
                  className="min-h-[80px] sm:min-h-[100px] border-b border-r border-card-border bg-bg-very-dark/50"
                />
              );
            }

            const dayEvents = getEventsForDate(date);
            const isCurrentDay = isToday(date);
            const isSelectedDay = isSelected(date);

            return (
              <div
                key={date.toISOString()}
                onClick={() => onDateClick?.(date)}
                className={cn(
                  'min-h-[80px] sm:min-h-[100px] border-b border-r border-card-border p-1 sm:p-2 transition-all cursor-pointer',
                  isCurrentDay && 'bg-accent-blue/5 border-accent-blue/50',
                  isSelectedDay && 'bg-accent-purple-1/10 border-accent-purple-1/50',
                  !isCurrentDay && !isSelectedDay && 'hover:bg-bg-dark',
                  dayEvents.length > 0 && 'font-medium'
                )}
              >
                <div className="flex flex-col h-full">
                  <div
                    className={cn(
                      'text-xs sm:text-sm mb-1 w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full',
                      isCurrentDay && 'bg-accent-blue text-white font-bold',
                      !isCurrentDay && 'text-text-main'
                    )}
                  >
                    {date.getDate()}
                  </div>

                  {/* Event indicators */}
                  <div className="flex-1 space-y-0.5 overflow-hidden">
                    {dayEvents.slice(0, 3).map((event, idx) => (
                      <div
                        key={event.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick?.(event);
                        }}
                        className={cn(
                          'text-[10px] sm:text-xs px-1 sm:px-1.5 py-0.5 rounded truncate text-white cursor-pointer transition-all hover:scale-105',
                          getEventTypeColor(event.type)
                        )}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[9px] sm:text-xs text-text-muted px-1">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-accent-blue" />
          <span className="text-text-muted">Facility</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-accent-purple-1" />
          <span className="text-text-muted">Room</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-success" />
          <span className="text-text-muted">Equipment</span>
        </div>
      </div>
    </div>
  );
}
