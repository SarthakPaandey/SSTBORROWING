'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Calendar, CalendarEvent } from '@/components/ui/Calendar';
import { Modal } from '@/components/ui/Modal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDateTime } from '@/lib/utils';
import { getISTNow } from '@/lib/timezone-client';
import { CalendarDays, Clock, MapPin, Package, Filter, Users, User, Sparkles, TrendingUp, CheckCircle2, Timer, BarChart3 } from 'lucide-react';

import { EnrichedBooking } from '@/types/booking';

// Status configuration with emojis
const statusConfig = {
  CONFIRMED: { emoji: '✅', label: 'Confirmed', color: 'success' as const },
  PENDING: { emoji: '⏳', label: 'Pending Approval', color: 'warning' as const },
  CHECKED_IN: { emoji: '🔑', label: 'Checked In', color: 'default' as const },
  COMPLETED: { emoji: '🏁', label: 'Completed', color: 'default' as const },
  CANCELLED: { emoji: '❌', label: 'Cancelled', color: 'destructive' as const },
  NO_SHOW: { emoji: '👻', label: 'No Show', color: 'destructive' as const },
};

const kindConfig = {
  FACILITY: { emoji: '🏟️', icon: MapPin, label: 'Facility' },
  ROOM: { emoji: '🚪', icon: CalendarDays, label: 'Room' },
  EQUIPMENT: { emoji: '🎾', icon: Package, label: 'Equipment' },
};

export default function CalendarPage() {
  const { data: session } = useSession();
  const [bookings, setBookings] = useState<EnrichedBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedEvent, setSelectedEvent] = useState<EnrichedBooking | null>(null);
  const [eventModal, setEventModal] = useState(false);
  const [dayViewModal, setDayViewModal] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Toggle for showing all bookings - Default to TRUE for better visibility
  const [showAllBookings, setShowAllBookings] = useState(true);

  // Toggle for showing cancelled bookings - Default to FALSE to reduce clutter
  const [showCancelled, setShowCancelled] = useState(false);

  const fetchBookings = useCallback(async (date: Date) => {
    setLoading(true);
    try {
      // Calculate start and end of the month
      const year = date.getFullYear();
      const month = date.getMonth();
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);

      // Add buffer days for calendar grid (previous/next month days)
      start.setDate(start.getDate() - 7);
      end.setDate(end.getDate() + 7);

      const meParam = showAllBookings ? '' : '&me=true';
      const url = `/api/bookings?from=${start.toISOString()}&to=${end.toISOString()}${meParam}`;

      const res = await fetch(url);
      const data = await res.json();
      setBookings(data.bookings || []);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    } finally {
      setLoading(false);
    }
  }, [showAllBookings]); // Added showAllBookings to dependencies

  useEffect(() => {
    fetchBookings(currentMonth);
  }, [fetchBookings, currentMonth, showAllBookings]);

  const handleMonthChange = (date: Date) => {
    setCurrentMonth(date);
  };

  // Helper to check if booking belongs to current user
  const isMyBooking = (booking: EnrichedBooking) => {
    return session?.user?.id === booking.userId;
  };

  // Filter bookings
  const filteredBookings = bookings.filter(booking => {
    // Hide library bookings for v0
    if (booking.kind === 'LIBRARY') return false;

    // Filter by type
    if (typeFilter !== 'ALL' && booking.kind !== typeFilter) return false;

    // Filter by status
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'ACTIVE' && booking.status !== 'CHECKED_IN') return false;
      if (statusFilter !== 'ACTIVE' && booking.status !== statusFilter) return false;
    }

    // Filter out cancelled/no-show unless explicitly shown or selected in status filter
    if (!showCancelled && statusFilter === 'ALL') {
      if (booking.status === 'CANCELLED' || booking.status === 'NO_SHOW') return false;
    }

    return true;
  });

  // Convert bookings to calendar events
  const calendarEvents: CalendarEvent[] = filteredBookings.map((booking) => ({
    id: String(booking._id),
    title: booking.resourceName || 'Booking',
    date: new Date(booking.start),
    type: booking.kind,
    status: booking.status,
  }));

  const handleEventClick = (event: CalendarEvent) => {
    const booking = bookings.find(b => String(b._id) === event.id);
    if (booking) {
      setSelectedEvent(booking);
      setEventModal(true);
    }
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setDayViewModal(true);
  };

  // Get events for selected date
  const selectedDateEvents = selectedDate
    ? filteredBookings.filter(b => {
      const bookingDate = new Date(b.start);
      return (
        bookingDate.getDate() === selectedDate.getDate() &&
        bookingDate.getMonth() === selectedDate.getMonth() &&
        bookingDate.getFullYear() === selectedDate.getFullYear()
      );
    })
    : [];

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig];
    if (!config) return <Badge>{status}</Badge>;
    return (
      <Badge variant={config.color} className="gap-1">
        <span>{config.emoji}</span>
        <span>{config.label}</span>
      </Badge>
    );
  };

  const getKindIcon = (kind: string) => {
    const config = kindConfig[kind as keyof typeof kindConfig];
    if (!config) return null;
    const Icon = config.icon;
    return <Icon className="h-5 w-5" />;
  };

  const getKindEmoji = (kind: string) => {
    return kindConfig[kind as keyof typeof kindConfig]?.emoji || '📌';
  };

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent-blue/20 via-cyan-500/10 to-transparent p-6 border border-accent-blue/20">
        {/* Background decorations */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent-blue/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        {/* Floating calendar icons */}
        <div className="absolute top-4 right-8 text-4xl opacity-20 animate-float">📅</div>
        <div className="absolute bottom-4 right-24 text-3xl opacity-20 animate-float" style={{ animationDelay: '1s' }}>📆</div>
        <div className="absolute top-12 right-32 text-2xl opacity-20 animate-float" style={{ animationDelay: '2s' }}>🗓️</div>

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              {/* Animated glow ring */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-accent-blue to-cyan-500 blur-xl opacity-40 animate-pulse" />
              <div className="relative p-4 rounded-2xl bg-gradient-to-br from-accent-blue/20 to-cyan-500/10 border border-accent-blue/30 backdrop-blur-sm flex items-center justify-center animate-float">
                <span className="text-4xl drop-shadow-lg">📅</span>
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-text-main">
                Calendar View
              </h1>
              <p className="text-text-muted flex items-center gap-2">
                {showAllBookings ? (
                  <>
                    <Users className="h-4 w-4" />
                    Viewing all bookings
                  </>
                ) : (
                  <>
                    <User className="h-4 w-4" />
                    Viewing your bookings
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-card rounded-xl border border-card-border animate-fade-in-up">
        <span className="text-sm font-medium text-text-muted flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Filters:
        </span>

        {/* Show All Toggle */}
        <Button
          variant={showAllBookings ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowAllBookings(!showAllBookings)}
          className="flex items-center gap-2 transition-all hover:scale-105"
        >
          {showAllBookings ? (
            <>
              <Users className="h-4 w-4" />
              👥 All Bookings
            </>
          ) : (
            <>
              <User className="h-4 w-4" />
              👤 My Bookings
            </>
          )}
        </Button>

        {/* Show Cancelled Toggle */}
        <Button
          variant={showCancelled ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setShowCancelled(!showCancelled)}
          className="flex items-center gap-2 transition-all hover:scale-105"
          title="Show/Hide Cancelled Bookings"
        >
          {showCancelled ? '🙈 Hide Cancelled' : '👀 Show Cancelled'}
        </Button>

        <div className="flex items-center gap-2 bg-bg-dark border border-card-border rounded-lg p-1.5 hover:border-accent-blue/30 transition-colors">
          <span className="text-lg ml-1">🏷️</span>
          <select
            className="bg-transparent text-sm text-text-main border-none focus:ring-0 cursor-pointer pr-2"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="ALL">All Types</option>
            <option value="FACILITY">🏟️ Facilities</option>
            <option value="ROOM">🚪 Rooms</option>
            <option value="EQUIPMENT">🎾 Equipment</option>
          </select>
        </div>

        <div className="flex items-center gap-2 bg-bg-dark border border-card-border rounded-lg p-1.5 hover:border-accent-blue/30 transition-colors">
          <span className="text-lg ml-1">📊</span>
          <select
            className="bg-transparent text-sm text-text-main border-none focus:ring-0 cursor-pointer pr-2"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Status</option>
            <option value="CONFIRMED">✅ Confirmed</option>
            <option value="PENDING">⏳ Pending</option>
            <option value="ACTIVE">🔑 Active</option>
            <option value="COMPLETED">🏁 Completed</option>
            <option value="CANCELLED">❌ Cancelled</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-6 animate-pulse">
          <div className="h-16 w-full rounded-xl bg-gradient-to-r from-card via-bg-dark to-card" />
          <div className="h-[600px] rounded-2xl bg-card border border-card-border overflow-hidden">
            <div className="h-12 bg-bg-dark" />
            <div className="grid grid-cols-7 gap-px p-4">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="h-24 rounded-lg bg-bg-dark/50" style={{ animationDelay: `${i * 20}ms` }} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="animate-fade-in">
          <Calendar
            events={calendarEvents}
            onDateClick={handleDateClick}
            onEventClick={handleEventClick}
            onMonthChange={handleMonthChange}
            selectedDate={selectedDate}
            viewDate={currentMonth}
          />
        </div>
      )}

      {/* Event Details Modal - Enhanced */}
      <Modal
        isOpen={eventModal}
        onClose={() => {
          setEventModal(false);
          setSelectedEvent(null);
        }}
        title={selectedEvent && isMyBooking(selectedEvent) ? "📋 My Booking Details" : "📋 Booking Details"}
        size="md"
      >
        {selectedEvent && (
          <div className="space-y-4 animate-fade-in-up">
            {/* Privacy Notice for Other Users' Bookings */}
            {!isMyBooking(selectedEvent) && (
              <div className="bg-accent-blue/10 border border-accent-blue/30 rounded-xl p-4 flex items-start gap-3 animate-fade-in">
                <span className="text-2xl">🔒</span>
                <div>
                  <p className="font-medium text-text-main">Privacy Protected</p>
                  <p className="text-sm text-text-muted">
                    This booking belongs to another user. Personal details are hidden.
                  </p>
                </div>
              </div>
            )}

            {/* Resource Header */}
            <div className="flex items-start gap-4 p-4 bg-gradient-to-br from-bg-dark to-transparent rounded-xl border border-card-border">
              <div className="p-3 rounded-xl bg-gradient-to-br from-accent-blue/20 to-accent-purple-1/20 border border-accent-blue/20">
                <span className="text-3xl">{getKindEmoji(selectedEvent.kind)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-text-main truncate">
                  {selectedEvent.resourceName}
                </h3>
                {isMyBooking(selectedEvent) ? (
                  <p className="text-sm text-text-muted flex items-center gap-1">
                    <span>🆔</span>
                    Booking ID: {String(selectedEvent._id).slice(-8)}
                  </p>
                ) : (
                  <p className="text-sm text-text-muted flex items-center gap-1">
                    <span>👤</span>
                    Booked by another user
                  </p>
                )}
              </div>
              {getStatusBadge(selectedEvent.status)}
            </div>

            {/* Time Details */}
            <div className="bg-bg-dark rounded-xl p-4 space-y-4 border border-card-border/50">
              <div className="flex items-center gap-4 group">
                <div className="p-2 rounded-lg bg-success/10 text-success group-hover:scale-110 transition-transform">
                  <Clock className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-text-muted uppercase tracking-wider">
                    {selectedEvent.kind === 'EQUIPMENT' ? '📦 Pickup Time' : '▶️ Start Time'}
                  </p>
                  <p className="text-text-main font-semibold">
                    {formatDateTime(selectedEvent.start)}
                  </p>
                </div>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-card-border to-transparent" />

              <div className="flex items-center gap-4 group">
                <div className="p-2 rounded-lg bg-warning/10 text-warning group-hover:scale-110 transition-transform">
                  <Timer className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-text-muted uppercase tracking-wider">
                    {selectedEvent.kind === 'EQUIPMENT' ? '🔄 Return By' : '⏹️ End Time'}
                  </p>
                  <p className="text-text-main font-semibold">
                    {formatDateTime(selectedEvent.end)}
                  </p>
                </div>
              </div>

              {selectedEvent.kind === 'EQUIPMENT' && selectedEvent.items && isMyBooking(selectedEvent) && (
                <>
                  <div className="h-px bg-gradient-to-r from-transparent via-card-border to-transparent" />
                  <div>
                    <p className="text-xs text-text-muted uppercase tracking-wider mb-3 flex items-center gap-2">
                      <span>🎒</span> Items Borrowed
                    </p>
                    <div className="space-y-2">
                      {selectedEvent.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm bg-bg-very-dark rounded-lg px-4 py-3 hover:bg-bg-very-dark/80 transition-colors"
                          style={{ animationDelay: `${idx * 50}ms` }}
                        >
                          <span className="text-text-main font-medium flex items-center gap-2">
                            <span>🏷️</span>
                            {item.name}
                          </span>
                          <Badge variant="secondary" className="font-mono">×{item.qty}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {selectedEvent.kind === 'EQUIPMENT' && !isMyBooking(selectedEvent) && (
                <div className="bg-bg-very-dark/50 rounded-lg px-4 py-3 border border-dashed border-card-border">
                  <p className="text-sm text-text-muted flex items-center gap-2">
                    <span>🔐</span>
                    Equipment details hidden for privacy
                  </p>
                </div>
              )}
            </div>

            {/* Status-specific info cards */}
            {selectedEvent.status === 'CONFIRMED' && selectedEvent.kind === 'EQUIPMENT' && isMyBooking(selectedEvent) && (
              <div className="bg-gradient-to-r from-accent-blue/10 to-cyan-500/10 border border-accent-blue/30 rounded-xl p-4 animate-pulse-subtle">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">📱</span>
                  <div>
                    <p className="font-medium text-text-main">Next Step</p>
                    <p className="text-sm text-text-muted">
                      Generate QR code from &quot;My Bookings&quot; to pick up equipment
                    </p>
                  </div>
                </div>
              </div>
            )}

            {selectedEvent.status === 'PENDING' && isMyBooking(selectedEvent) && (
              <div className="bg-gradient-to-r from-warning/10 to-amber-500/10 border border-warning/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl animate-bounce-subtle">⏳</span>
                  <div>
                    <p className="font-medium text-text-main">Awaiting Approval</p>
                    <p className="text-sm text-text-muted">
                      Your request is being reviewed by the lab admin
                    </p>
                  </div>
                </div>
              </div>
            )}

            <Button
              variant="outline"
              className="w-full group"
              onClick={() => {
                setEventModal(false);
                setSelectedEvent(null);
              }}
            >
              <span className="group-hover:hidden">Close</span>
              <span className="hidden group-hover:inline">👋 Close</span>
            </Button>
          </div>
        )}
      </Modal>

      {/* Day View Modal - Enhanced */}
      <Modal
        isOpen={dayViewModal}
        onClose={() => {
          setDayViewModal(false);
          setSelectedDate(undefined);
        }}
        title={selectedDate ? `📆 ${selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}` : '📆 Events'}
        size="lg"
      >
        {selectedDateEvents.length === 0 ? (
          <div className="text-center py-12 animate-fade-in">
            <span className="text-6xl mb-4 block">📭</span>
            <p className="text-text-muted text-lg">No events on this date</p>
            <p className="text-sm text-text-muted mt-2">This day is free for new bookings!</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            <p className="text-sm text-text-muted mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              {selectedDateEvents.length} event{selectedDateEvents.length !== 1 ? 's' : ''} scheduled
            </p>
            {selectedDateEvents.map((booking, index) => (
              <div
                key={String(booking._id)}
                onClick={() => {
                  setSelectedEvent(booking);
                  setDayViewModal(false);
                  setEventModal(true);
                }}
                className="flex items-start gap-4 p-4 rounded-xl border border-card-border bg-card hover:bg-accent-blue/5 hover:border-accent-blue/30 cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 group animate-fade-in-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Type indicator */}
                <div className="p-2 rounded-lg bg-bg-dark group-hover:scale-110 transition-transform">
                  <span className="text-2xl">{getKindEmoji(booking.kind)}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-text-main truncate">{booking.resourceName}</p>
                    {getStatusBadge(booking.status)}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-text-muted">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {booking.kind === 'EQUIPMENT' ? 'Pickup: ' : ''}
                      {formatDateTime(booking.start)}
                    </span>
                  </div>
                  {booking.kind === 'EQUIPMENT' && (
                    <p className="text-sm text-text-muted mt-1 flex items-center gap-1">
                      <Timer className="h-3 w-3" />
                      Return by: {formatDateTime(booking.end)}
                    </p>
                  )}
                  {!isMyBooking(booking) && (
                    <p className="text-xs text-accent-blue/70 mt-2 flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      Booked by another user
                    </p>
                  )}
                  {isMyBooking(booking) && (
                    <p className="text-xs text-success mt-2 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Your booking
                    </p>
                  )}
                </div>

                {/* Arrow indicator */}
                <div className="text-text-muted group-hover:text-accent-blue group-hover:translate-x-1 transition-all">
                  →
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Stats - Enhanced */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'Total Bookings',
            value: bookings.length,
            emoji: '📊',
            gradient: 'from-slate-500/20 to-slate-600/10',
            textColor: 'text-text-main',
            icon: BarChart3,
          },
          {
            label: 'Upcoming',
            value: bookings.filter(b =>
              new Date(b.start) > getISTNow() &&
              ['CONFIRMED', 'PENDING'].includes(b.status)
            ).length,
            emoji: '🚀',
            gradient: 'from-accent-blue/20 to-cyan-500/10',
            textColor: 'text-accent-blue',
            icon: TrendingUp,
          },
          {
            label: 'Active Now',
            value: bookings.filter(b => b.status === 'CHECKED_IN').length,
            emoji: '🔥',
            gradient: 'from-success/20 to-emerald-500/10',
            textColor: 'text-success',
            icon: Sparkles,
          },
          {
            label: 'Completed',
            value: bookings.filter(b => b.status === 'COMPLETED').length,
            emoji: '🏆',
            gradient: 'from-amber-500/20 to-yellow-500/10',
            textColor: 'text-amber-400',
            icon: CheckCircle2,
          },
        ].map((stat, index) => (
          <Card
            key={stat.label}
            className={`bg-gradient-to-br ${stat.gradient} border-card-border/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group animate-fade-in-up`}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-text-muted flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span>{stat.label}</span>
                <span className="text-xl group-hover:scale-125 transition-transform">{stat.emoji}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${stat.textColor} flex items-center gap-2`}>
                <span className="tabular-nums">{stat.value}</span>
                <stat.icon className="h-5 w-5 opacity-50" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
