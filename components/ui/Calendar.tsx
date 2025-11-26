'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/utils';
import { getISTNow } from '@/lib/timezone-client';

export type CalendarEvent = {
  id: string;
  title: string;
  date: Date;
  type: 'FACILITY' | 'ROOM' | 'EQUIPMENT' | 'LIBRARY';
  status: string;
};

export interface CalendarProps {
  events?: CalendarEvent[];
  onDateClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onMonthChange?: (date: Date) => void;
  selectedDate?: Date;
}

export function Calendar({ events = [], onDateClick, onEventClick, onMonthChange, selectedDate }: CalendarProps) {
  // FIX: Use IST timezone for initial month display
  const [currentDate, setCurrentDate] = useState(getISTNow());

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

  // Check if date is today (using IST timezone)
  const isToday = (date: Date) => {
    const today = getISTNow();
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
    const newDate = new Date(year, month - 1, 1);
    setCurrentDate(newDate);
    onMonthChange?.(newDate);
  };

  const goToNextMonth = () => {
    const newDate = new Date(year, month + 1, 1);
    setCurrentDate(newDate);
    onMonthChange?.(newDate);
  };

  const goToToday = () => {
    // FIX: Use IST timezone when navigating to today
    const newDate = getISTNow();
    setCurrentDate(newDate);
    onMonthChange?.(newDate);
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
      case 'LIBRARY':
        return 'bg-warning';
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
      <div className="rounded-xl border border-card-border bg-card overflow-hidden shadow-lg">
        {/* Day Headers */}
        <div className="grid grid-cols-7 bg-bg-dark">
          {daysOfWeek.map((day) => (
            <div
              key={day}
              className="p-3 text-center text-sm font-semibold text-text-muted uppercase tracking-wider"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-px bg-card-border">
          {calendarDays.map((date, index) => {
            if (!date) {
              return (
                <div
                  key={`empty-${index}`}
                  className="min-h-[90px] sm:min-h-[110px] bg-bg-very-dark/30"
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
                  'min-h-[90px] sm:min-h-[110px] p-2 transition-all cursor-pointer bg-card relative group',
                  'hover:bg-accent-blue/5 hover:shadow-inner',
                  isCurrentDay && 'bg-accent-blue/10',
                  isSelectedDay && 'bg-accent-purple-1/10',
                  dayEvents.length > 0 && 'font-medium'
                )}
              >
                <div className="flex flex-col h-full">
                  <div
                    className={cn(
                      'text-sm mb-2 w-8 h-8 flex items-center justify-center rounded-full transition-all',
                      isCurrentDay && 'bg-accent-blue text-white font-bold shadow-lg shadow-accent-blue/30',
                      isSelectedDay && !isCurrentDay && 'bg-accent-purple-1 text-white',
                      !isCurrentDay && !isSelectedDay && 'text-text-main group-hover:bg-bg-dark'
                    )}
                  >
                    {date.getDate()}
                  </div>

                  {/* Event indicators */}
                  <div className="flex-1 space-y-1 overflow-hidden">
                    {dayEvents.slice(0, 3).map((event) => (
                      <div
                        key={event.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick?.(event);
                        }}
                        className={cn(
                          'text-[10px] sm:text-xs px-2 py-1 rounded-md truncate text-white cursor-pointer transition-all hover:scale-105 hover:shadow-md',
                          getEventTypeColor(event.type)
                        )}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-text-muted px-2 font-medium">
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
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-warning" />
          <span className="text-text-muted">Library</span>
        </div>
      </div>
    </div>
  );
}
