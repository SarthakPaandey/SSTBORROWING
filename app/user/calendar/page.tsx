'use client';

import { useState, useEffect } from 'react';
import { Calendar, CalendarEvent } from '@/components/ui/Calendar';
import { Modal } from '@/components/ui/Modal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDateTime } from '@/lib/utils';
import { CalendarDays, Clock, MapPin, Package, X } from 'lucide-react';

export default function CalendarPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [eventModal, setEventModal] = useState(false);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const res = await fetch('/api/bookings');
      const data = await res.json();
      setBookings(data.bookings || []);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Convert bookings to calendar events
  const calendarEvents: CalendarEvent[] = bookings.map((booking) => ({
    id: booking._id,
    title: booking.resourceName || 'Booking',
    date: new Date(booking.start),
    type: booking.kind,
    status: booking.status,
  }));

  const handleEventClick = (event: CalendarEvent) => {
    const booking = bookings.find(b => b._id === event.id);
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
        return <Badge variant="danger">Cancelled</Badge>;
      case 'NO_SHOW':
        return <Badge variant="danger">No Show</Badge>;
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-64 animate-pulse rounded bg-card"></div>
        <div className="h-[600px] animate-pulse rounded-lg bg-card"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-accent-blue">Calendar View</h1>
        <p className="text-text-muted">View all your bookings in a calendar</p>
      </div>

      <Calendar
        events={calendarEvents}
        onDateClick={setSelectedDate}
        onEventClick={handleEventClick}
        selectedDate={selectedDate}
      />

      {/* Event Details Modal */}
      <Modal
        isOpen={eventModal}
        onClose={() => {
          setEventModal(false);
          setSelectedEvent(null);
        }}
        title="Booking Details"
        size="md"
      >
        {selectedEvent && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="icon-circle w-12 h-12">
                {getKindIcon(selectedEvent.kind)}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-text-main">
                  {selectedEvent.resourceName}
                </h3>
                <p className="text-sm text-text-muted">
                  Booking ID: {selectedEvent._id.slice(-8)}
                </p>
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

              {selectedEvent.kind === 'EQUIPMENT' && selectedEvent.items && (
                <div>
                  <p className="text-sm text-text-muted mb-2">Items:</p>
                  <div className="space-y-1">
                    {selectedEvent.items.map((item: any, idx: number) => (
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
            </div>

            {selectedEvent.status === 'CONFIRMED' && selectedEvent.kind === 'EQUIPMENT' && (
              <div className="bg-accent-blue/10 border border-accent-blue/30 rounded-lg p-3">
                <p className="text-sm text-text-main">
                  <span className="font-medium">Next step:</span> Generate QR code from "My Bookings" to pick up equipment
                </p>
              </div>
            )}

            {selectedEvent.status === 'PENDING' && (
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
            <div className="text-2xl font-bold text-accent-blue">
              {bookings.filter(b =>
                new Date(b.start) > new Date() &&
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
