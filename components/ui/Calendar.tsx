'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Sparkles } from 'lucide-react';
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
  viewDate?: Date;
}

// Type icons and emojis
const typeConfig = {
  FACILITY: { emoji: '🏟️', color: 'bg-accent-blue', gradient: 'from-accent-blue to-cyan-500' },
  ROOM: { emoji: '🚪', color: 'bg-accent-purple-1', gradient: 'from-accent-purple-1 to-pink-500' },
  EQUIPMENT: { emoji: '🎾', color: 'bg-success', gradient: 'from-success to-emerald-400' },
  LIBRARY: { emoji: '📚', color: 'bg-warning', gradient: 'from-warning to-amber-400' },
};

export function Calendar({ events = [], onDateClick, onEventClick, onMonthChange, selectedDate, viewDate }: CalendarProps) {
  const [internalDate, setInternalDate] = useState(getISTNow());
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationDirection, setAnimationDirection] = useState<'left' | 'right'>('right');
  const currentDate = viewDate || internalDate;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const monthEmojis = ['❄️', '💝', '🌸', '🌷', '🌺', '☀️', '🌴', '🌻', '🍂', '🎃', '🍁', '🎄'];

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();

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

  const isToday = (date: Date) => {
    const today = getISTNow();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (date: Date) => {
    if (!selectedDate) return false;
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  const animateTransition = (direction: 'left' | 'right') => {
    setAnimationDirection(direction);
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);
  };

  const goToPreviousMonth = () => {
    animateTransition('right');
    const newDate = new Date(year, month - 1, 1);
    if (!viewDate) setInternalDate(newDate);
    onMonthChange?.(newDate);
  };

  const goToNextMonth = () => {
    animateTransition('left');
    const newDate = new Date(year, month + 1, 1);
    if (!viewDate) setInternalDate(newDate);
    onMonthChange?.(newDate);
  };

  const goToToday = () => {
    const newDate = getISTNow();
    if (!viewDate) setInternalDate(newDate);
    onMonthChange?.(newDate);
  };

  const calendarDays = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(new Date(year, month, day));
  }

  const getEventTypeColor = (type: string) => {
    return typeConfig[type as keyof typeof typeConfig]?.color || 'bg-badge-blue';
  };

  const getEventTypeEmoji = (type: string) => {
    return typeConfig[type as keyof typeof typeConfig]?.emoji || '📌';
  };

  return (
    <div className="space-y-4">
      {/* Calendar Header - Enhanced */}
      <div className="flex items-center justify-between bg-gradient-to-r from-bg-dark/50 to-transparent rounded-xl p-4 border border-card-border/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-3xl animate-bounce-subtle">{monthEmojis[month]}</span>
            <div>
              <h2 className="text-2xl font-bold text-text-main">
                {monthNames[month]}
              </h2>
              <p className="text-sm text-text-muted">{year}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            className="hidden sm:inline-flex gap-2 group"
          >
            <CalendarIcon className="h-4 w-4 group-hover:animate-pulse" />
            Today
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPreviousMonth}
            className="h-10 w-10 p-0 hover:bg-accent-blue/10 hover:border-accent-blue/30 group"
          >
            <ChevronLeft className="h-5 w-5 group-hover:-translate-x-0.5 transition-transform" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={goToNextMonth}
            className="h-10 w-10 p-0 hover:bg-accent-blue/10 hover:border-accent-blue/30 group"
          >
            <ChevronRight className="h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid - Enhanced */}
      <div className={cn(
        "rounded-2xl border border-card-border bg-card overflow-hidden shadow-xl transition-all duration-300",
        isAnimating && animationDirection === 'left' && 'animate-fade-in-left',
        isAnimating && animationDirection === 'right' && 'animate-fade-in-right'
      )}>
        {/* Day Headers */}
        <div className="grid grid-cols-7 bg-gradient-to-r from-bg-dark via-bg-dark to-bg-dark/80">
          {daysOfWeek.map((day) => (
            <div
              key={day}
              className="p-4 text-center"
            >
              <span className="text-sm font-semibold text-text-muted uppercase tracking-wider">
                {day}
              </span>
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-px bg-card-border/50">
          {calendarDays.map((date, index) => {
            if (!date) {
              return (
                <div
                  key={`empty-${index}`}
                  className="min-h-[90px] sm:min-h-[120px] bg-bg-very-dark/20"
                />
              );
            }

            const dayEvents = getEventsForDate(date);
            const isCurrentDay = isToday(date);
            const isSelectedDay = isSelected(date);
            const hasEvents = dayEvents.length > 0;

            return (
              <div
                key={date.toISOString()}
                onClick={() => onDateClick?.(date)}
                className={cn(
                  'min-h-[90px] sm:min-h-[120px] p-2 transition-all duration-200 cursor-pointer bg-card relative group',
                  'hover:bg-accent-blue/5 hover:shadow-inner',
                  isCurrentDay && 'bg-gradient-to-br from-accent-blue/15 to-accent-blue/5',
                  isSelectedDay && 'bg-gradient-to-br from-accent-purple-1/15 to-accent-purple-1/5 ring-2 ring-accent-purple-1/30 ring-inset',
                  hasEvents && 'font-medium'
                )}
              >
                {/* Hover glow effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="absolute inset-0 bg-gradient-to-br from-accent-blue/5 to-transparent" />
                </div>

                <div className="flex flex-col h-full relative">
                  {/* Date number */}
                  <div
                    className={cn(
                      'text-sm mb-2 w-8 h-8 flex items-center justify-center rounded-full transition-all duration-300',
                      isCurrentDay && 'bg-gradient-to-br from-accent-blue to-cyan-500 text-white font-bold shadow-lg shadow-accent-blue/40 animate-pulse',
                      isSelectedDay && !isCurrentDay && 'bg-gradient-to-br from-accent-purple-1 to-pink-500 text-white shadow-lg shadow-accent-purple-1/40',
                      !isCurrentDay && !isSelectedDay && 'text-text-main group-hover:bg-bg-dark group-hover:scale-110'
                    )}
                  >
                    {date.getDate()}
                  </div>

                  {/* Today indicator */}
                  {isCurrentDay && (
                    <div className="absolute top-1 right-1">
                      <Sparkles className="h-3 w-3 text-accent-blue animate-pulse" />
                    </div>
                  )}

                  {/* Event indicators */}
                  <div className="flex-1 space-y-1 overflow-hidden">
                    {dayEvents.slice(0, 3).map((event, eventIndex) => (
                      <div
                        key={event.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick?.(event);
                        }}
                        className={cn(
                          'text-[10px] sm:text-xs px-2 py-1 rounded-lg truncate text-white cursor-pointer',
                          'transition-all duration-200 hover:scale-[1.02] hover:shadow-md',
                          'flex items-center gap-1',
                          getEventTypeColor(event.type)
                        )}
                        style={{ animationDelay: `${eventIndex * 50}ms` }}
                      >
                        <span className="hidden sm:inline text-xs">{getEventTypeEmoji(event.type)}</span>
                        <span className="truncate">{event.title}</span>
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div
                        className="text-xs text-accent-blue px-2 font-medium cursor-pointer hover:text-accent-purple-1 transition-colors flex items-center gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDateClick?.(date);
                        }}
                      >
                        <span>+{dayEvents.length - 3}</span>
                        <span className="hidden sm:inline">more</span>
                      </div>
                    )}
                  </div>

                  {/* Event count indicator for mobile */}
                  {hasEvents && (
                    <div className="absolute bottom-1 right-1 sm:hidden">
                      <div className="w-5 h-5 rounded-full bg-accent-blue/20 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-accent-blue">{dayEvents.length}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend - Enhanced */}
      <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 p-4 bg-bg-dark/30 rounded-xl border border-card-border/50">
        <span className="text-xs text-text-muted font-medium">Legend:</span>
        {Object.entries(typeConfig).map(([type, config]) => (
          <div key={type} className="flex items-center gap-2 group cursor-default">
            <div className={cn(
              'w-4 h-4 rounded-lg transition-transform group-hover:scale-110',
              config.color
            )}>
              <span className="text-[10px] flex items-center justify-center h-full">{config.emoji}</span>
            </div>
            <span className="text-sm text-text-muted group-hover:text-text-main transition-colors">
              {type.charAt(0) + type.slice(1).toLowerCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
