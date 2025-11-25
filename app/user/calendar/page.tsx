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
import { CalendarDays, Clock, MapPin, Package, Filter, Users, User } from 'lucide-react';

import { EnrichedBooking } from '@/types/booking';

export default function CalendarPage() {
  const { data: session } = useSession();
  const [bookings, setBookings] = useState<EnrichedBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedEvent, setSelectedEvent] = useState<EnrichedBooking | null>(null);
  const [eventModal, setEventModal] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Toggle for showing all bookings
  const [showAllBookings, setShowAllBookings] = useState(false);

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
      const res = await fetch(`/api/bookings?from=${start.toISOString()}&to=${end.toISOString()}${meParam}`);
      const data = await res.json();
      setBookings(data.bookings || []);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

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
    if (typeFilter !== 'ALL' && booking.kind !== typeFilter) return false;
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'ACTIVE' && booking.status !== 'CHECKED_IN') return false;
      if (statusFilter !== 'ACTIVE' && booking.status !== statusFilter) return false;
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return <Badge variant="success">Confirmed</Badge>;
      case 'PENDING':
        return <Badge variant="warning">Pending Approval</Badge>;
      case 'CHECKED_IN':
        return <Badge variant="default">Checked In</Badge>;
      case 'COMPLETED':
        return <Badge variant="default">Completed</Badge>;
      case 'CANCELLED':
        return <Badge variant="destructive">Cancelled</Badge>;
      case 'NO_SHOW':
        return <Badge variant="destructive">No Show</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getKindIcon = (kind: string) => {
    switch (kind) {
      case 'FACILITY':
        return <MapPin className="h-5 w-5" />;
      case 'ROOM':
        return <CalendarDays className="h-5 w-5" />;
      case 'EQUIPMENT':
        return <Package className="h-5 w-5" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-accent-blue">Calendar View</h1>
          <p className="text-text-muted">
            {showAllBookings ? 'View all bookings' : 'View your bookings'}
          </p>
        </div>

        {/* Toggle and Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Show All Toggle */}
          <Button
            variant={showAllBookings ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowAllBookings(!showAllBookings)}
            className="flex items-center gap-2"
          >
            {showAllBookings ? (
              <>
                <Users className="h-4 w-4" />
                All Bookings
              </>
            ) : (
              <>
                <User className="h-4 w-4" />
                My Bookings
              </>
            )}
          </Button>

          <div className="flex items-center gap-2 bg-card border border-card-border rounded-lg p-1">
            <Filter className="h-4 w-4 text-text-muted ml-2" />
            <select
              className="bg-transparent text-sm text-text-main border-none focus:ring-0 cursor-pointer"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="ALL">All Types</option>
              <option value="FACILITY">Facilities</option>
              <option value="ROOM">Rooms</option>
              <option value="EQUIPMENT">Equipment</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-card border border-card-border rounded-lg p-1">
            <select
              className="bg-transparent text-sm text-text-main border-none focus:ring-0 cursor-pointer"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Status</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="PENDING">Pending</option>
              <option value="ACTIVE">Active (Checked In)</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="h-12 w-64 animate-pulse rounded bg-card"></div>
          <div className="h-[600px] animate-pulse rounded-lg bg-card"></div>
        </div>
      ) : (
        <Calendar
          events={calendarEvents}
          onDateClick={setSelectedDate}
          onEventClick={handleEventClick}
          onMonthChange={handleMonthChange}
          selectedDate={selectedDate}
        />
      )}

      {/* Event Details Modal */}
      <Modal
        isOpen={eventModal}
        onClose={() => {
          setEventModal(false);
          setSelectedEvent(null);
        }}
        title={selectedEvent && isMyBooking(selectedEvent) ? "My Booking Details" : "Booking Details"}
        size="md"
      >
        {selectedEvent && (
          <div className="space-y-4">
            {/* Privacy Notice for Other Users' Bookings */}
            {!isMyBooking(selectedEvent) && (
              <div className="bg-accent-blue/10 border border-accent-blue/30 rounded-lg p-3 flex items-start gap-2">
                <Users className="h-4 w-4 text-accent-blue mt-0.5 flex-shrink-0" />
                <p className="text-sm text-text-main">
                  This booking belongs to another user. Personal details are hidden for privacy.
                </p>
              </div>
            )}
            <div className="flex items-start gap-3">
              <div className="icon-circle w-12 h-12">
                {getKindIcon(selectedEvent.kind)}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-text-main">
                  {selectedEvent.resourceName}
                </h3>
                {isMyBooking(selectedEvent) ? (
                  <p className="text-sm text-text-muted">
                    Booking ID: {String(selectedEvent._id).slice(-8)}
                  </p>
                ) : (
                  <p className="text-sm text-text-muted">
                    Booked by another user
                  </p>
                )}
              </div>
              {getStatusBadge(selectedEvent.status)}
            </div>

            <div className="bg-bg-dark rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-accent-blue" />
                <div>
                  <p className="text-sm text-text-muted">
                    {selectedEvent.kind === 'EQUIPMENT' ? 'Pickup' : 'Start'}
                  </p>
                  <p className="text-text-main font-medium">
                    {formatDateTime(selectedEvent.start)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-accent-blue" />
                <div>
                  <p className="text-sm text-text-muted">
                    {selectedEvent.kind === 'EQUIPMENT' ? 'Return by' : 'End'}
                  </p>
                  <p className="text-text-main font-medium">
                    {formatDateTime(selectedEvent.end)}
                  </p>
                </div>
              </div>

              {selectedEvent.kind === 'EQUIPMENT' && selectedEvent.items && isMyBooking(selectedEvent) && (
                <div>
                  <p className="text-sm text-text-muted mb-2">Items:</p>
                  <div className="space-y-1">
                    {selectedEvent.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-sm bg-bg-very-dark rounded px-3 py-2"
                      >
                        <span className="text-text-main font-medium">{item.name}</span>
                        <span className="text-text-muted">×{item.qty}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hide items for non-owned bookings */}
              {selectedEvent.kind === 'EQUIPMENT' && !isMyBooking(selectedEvent) && (
                <div className="bg-bg-dark rounded px-3 py-2">
                  <p className="text-sm text-text-muted">Equipment borrowed (details hidden)</p>
                </div>
              )}
            </div>

            {selectedEvent.status === 'CONFIRMED' && selectedEvent.kind === 'EQUIPMENT' && isMyBooking(selectedEvent) && (
              <div className="bg-accent-blue/10 border border-accent-blue/30 rounded-lg p-3">
                <p className="text-sm text-text-main">
                  <span className="font-medium">Next step:</span> Generate QR code from &quot;My Bookings&quot; to pick up equipment
                </p>
              </div>
            )}

            {selectedEvent.status === 'PENDING' && isMyBooking(selectedEvent) && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <p className="text-sm text-text-main">
                  <span className="font-medium">Awaiting approval</span> from lab admin
                </p>
              </div>
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setEventModal(false);
                setSelectedEvent(null);
              }}
            >
              Close
            </Button>
          </div>
        )}
      </Modal>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-text-muted">
              Total Bookings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-text-main">{bookings.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-text-muted">
              Upcoming
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* FIX: Use IST time for accurate upcoming count */}
            <div className="text-2xl font-bold text-accent-blue">
              {bookings.filter(b =>
                new Date(b.start) > getISTNow() &&
                ['CONFIRMED', 'PENDING'].includes(b.status)
              ).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-text-muted">
              Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {bookings.filter(b => b.status === 'CHECKED_IN').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-text-muted">
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-text-muted">
              {bookings.filter(b => b.status === 'COMPLETED').length}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
