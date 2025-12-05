'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { DatePicker } from '@/components/ui/DatePicker';
import { formatDateTime } from '@/lib/utils';
import { getISTNow } from '@/lib/timezone-client';
import { QrCode, Clock, Calendar, ArrowRight, RefreshCw, X, Sparkles, Package, AlertCircle } from 'lucide-react';
import { EnrichedBooking, BookingItem } from '@/types/booking';

export default function BookingsPage() {
  const [bookings, setBookings] = useState<EnrichedBooking[]>([]);
  const [qrModal, setQrModal] = useState<{
    open: boolean;
    qrImage?: string;
    booking?: EnrichedBooking;
    expiresAt?: string;
    token?: string;
  }>({
    open: false,
  });
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [generatingQR, setGeneratingQR] = useState<string | null>(null);
  const [rescheduleModal, setRescheduleModal] = useState<{
    open: boolean;
    booking?: EnrichedBooking;
    selectedDate?: string;     // YYYY-MM-DD format
    selectedSlot?: { start: string; end: string };  // Selected time slot
    newStart?: string;         // Keep for API call
    newEnd?: string;           // Keep for API call
  }>({ open: false });
  const [rescheduling, setRescheduling] = useState(false);
  const [confirmedPenalty, setConfirmedPenalty] = useState(false);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    const res = await fetch('/api/bookings?me=true');
    const data = await res.json();
    setBookings(data.bookings);
    setLoading(false);
  };

  // Countdown timer effect
  useEffect(() => {
    if (!qrModal.open || !qrModal.expiresAt) {
      setTimeRemaining('');
      return;
    }

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const expiry = new Date(qrModal.expiresAt!).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeRemaining('Expired');
        clearInterval(timer);
        setTimeout(() => {
          setQrModal({ open: false });
          alert('QR code has expired. Please generate a new one.');
        }, 1000);
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [qrModal.open, qrModal.expiresAt]);

  const handleGenerateQR = async (bookingId: string, startTime: string) => {
    const start = new Date(startTime).getTime();
    const now = new Date().getTime();
    const timeUntilStart = start - now;
    const minutesUntilStart = timeUntilStart / (1000 * 60);

    if (minutesUntilStart > 15) {
      setError('QR code can only be generated 15 minutes before the booking start time');
      return;
    }

    setGeneratingQR(bookingId);
    setError('');

    try {
      const res = await fetch(`/api/bookings/${bookingId}/qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate QR code');
      }

      const booking = bookings.find((b) => b._id === bookingId);
      setQrModal({
        open: true,
        qrImage: data.qrImage, // Assuming the API still returns qrImage
        booking,
        expiresAt: data.expiresAt,
        token: data.token // Store the token if available
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate QR code');
    } finally {
      setGeneratingQR(null);
    }
  };

  const handleCancel = async (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;

    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'PATCH',
      });

      if (res.ok) {
        fetchBookings();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to cancel booking');
      }
    } catch (error) {
      console.error(error);
      alert('Failed to cancel booking');
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleModal.booking || !rescheduleModal.newStart || !rescheduleModal.newEnd) {
      return;
    }

    try {
      setRescheduling(true);
      setError('');

      // Convert datetime-local format to ISO strings
      const startISO = new Date(rescheduleModal.newStart).toISOString();
      const endISO = new Date(rescheduleModal.newEnd).toISOString();

      const response = await fetch(`/api/bookings/${rescheduleModal.booking._id}/reschedule`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          start: startISO,
          end: endISO,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reschedule booking');
      }

      // Success - refresh bookings and close modal
      await fetchBookings();
      setRescheduleModal({ open: false });
      setConfirmedPenalty(false);

      // Show success message
      if (data.requiresApproval) {
        alert('Booking rescheduled successfully! Since the new time requires approval, your booking status has been reset to "Awaiting Approval".');
      } else {
        alert('Booking rescheduled successfully!');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reschedule booking';
      setError(errorMessage);
      alert(errorMessage);
    } finally {
      setRescheduling(false);
    }
  };


  const canReschedule = (booking: EnrichedBooking): { allowed: boolean, reason?: string } => {
    // Status check
    if (!['CONFIRMED', 'PENDING'].includes(booking.status)) {
      return { allowed: false, reason: 'Only confirmed or pending bookings can be rescheduled' };
    }

    // Reschedule count check (max 1 per booking)
    if ((booking.rescheduleCount || 0) >= 1) {
      return { allowed: false, reason: 'Booking has already been rescheduled once (maximum limit reached)' };
    }

    // Time window check (2 hours before start)
    const now = getISTNow();
    const start = new Date(booking.start);
    const hoursUntilStart = (start.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilStart < 2) {
      return { allowed: false, reason: 'Cannot reschedule within 2 hours of start time' };
    }

    return { allowed: true };
  };

  // Generate time slots for rescheduling (30-min intervals)
  const generateRescheduleSlots = (date: string, booking: EnrichedBooking) => {
    const slots = [];
    const selectedDateObj = new Date(`${date}T00:00:00+05:30`);
    const today = getISTNow();
    const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Calculate original duration
    const originalStart = new Date(booking.start).getTime();
    const originalEnd = new Date(booking.end).getTime();
    const durationMs = originalEnd - originalStart;

    // Generate slots from 8 AM to 8 PM (30-min increments) - matches backend working hours
    for (let hour = 8; hour < 20; hour++) {
      for (let minute of [0, 30]) {
        const slotStart = new Date(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+05:30`);
        const slotEnd = new Date(slotStart.getTime() + durationMs);

        // Skip past slots if today
        if (date === todayDateStr) {
          if (slotStart < today) continue;

          // Skip slots within 2-hour reschedule window
          const hoursUntilSlot = (slotStart.getTime() - today.getTime()) / (1000 * 60 * 60);
          if (hoursUntilSlot < 2) continue;
        }

        // Format time label
        const formatTime = (d: Date) => {
          const h = d.getHours();
          const m = d.getMinutes();
          const period = h >= 12 ? 'PM' : 'AM';
          const displayHour = h % 12 || 12;
          return `${displayHour}:${String(m).padStart(2, '0')} ${period}`;
        };

        slots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          label: formatTime(slotStart),
        });
      }
    }

    return slots;
  };

  const getStatusBadge = (status: string, approval: string, kind?: string, startTime?: Date | string, endTime?: Date | string) => {
    // Check if booking time has passed for CONFIRMED/PENDING bookings
    const now = getISTNow();
    const start = startTime ? new Date(startTime) : null;
    const end = endTime ? new Date(endTime) : null;

    // For equipment/library: show "Late" if start time + grace period has passed and not picked up
    // For facilities/rooms: show "Missed" if end time has passed
    if (status === 'CONFIRMED' || status === 'PENDING') {
      if (kind === 'EQUIPMENT' || kind === 'LIBRARY') {
        if (start) {
          const graceEndTime = new Date(start.getTime() + 15 * 60 * 1000); // 15 min grace
          if (now > graceEndTime) {
            return <Badge variant="destructive">Late - Cannot Pickup</Badge>;
          }
        }
      } else if (kind === 'FACILITY' || kind === 'ROOM') {
        if (end && now > end) {
          return <Badge variant="destructive">Missed</Badge>;
        }
      }
    }

    if (status === 'PENDING' && approval === 'PENDING') {
      return <Badge variant="warning">Awaiting Approval</Badge>;
    }
    if (status === 'CONFIRMED') {
      // For equipment/library, make it clear the item is awaiting pickup
      if (kind === 'EQUIPMENT' || kind === 'LIBRARY') {
        return <Badge variant="warning">Awaiting Pickup</Badge>;
      }
      // For facilities/rooms, "Confirmed" is appropriate
      return <Badge variant="success">Confirmed</Badge>;
    }
    if (status === 'CHECKED_IN') {
      // For equipment/library, it means the user has the item
      if (kind === 'EQUIPMENT' || kind === 'LIBRARY') {
        return <Badge variant="default">Picked Up</Badge>;
      }
      return <Badge variant="default">Checked In</Badge>;
    }
    if (status === 'COMPLETED') {
      // For equipment/library, it means returned
      if (kind === 'EQUIPMENT' || kind === 'LIBRARY') {
        return <Badge variant="secondary">Returned</Badge>;
      }
      return <Badge variant="secondary">Completed</Badge>;
    }
    if (status === 'CANCELLED') {
      return <Badge variant="destructive">Cancelled</Badge>;
    }
    if (status === 'NO_SHOW') {
      return <Badge variant="destructive">No Show</Badge>;
    }
    return <Badge>{status}</Badge>;
  };

  // FIX: Use IST time for accurate upcoming/past booking filtering
  // Include bookings within 15-minute grace period after start time
  const now = getISTNow();
  const QR_GRACE_PERIOD_MS = 15 * 60 * 1000; // 15 minutes

  const upcomingBookings = bookings.filter((b) => {
    if (!['CONFIRMED', 'PENDING', 'CHECKED_IN'].includes(b.status)) {
      return false;
    }
    // Keep in "upcoming" if start time + 15 min grace period hasn't passed yet
    const graceEnd = new Date(new Date(b.start).getTime() + QR_GRACE_PERIOD_MS);
    return graceEnd >= now;
  });

  const pastBookings = bookings.filter((b) => {
    if (!['CONFIRMED', 'PENDING', 'CHECKED_IN'].includes(b.status)) {
      return true; // Cancelled, completed, no-show go to past
    }
    const graceEnd = new Date(new Date(b.start).getTime() + QR_GRACE_PERIOD_MS);
    return graceEnd < now;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-64 skeleton rounded-xl"></div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 skeleton rounded-xl" style={{ animationDelay: `${i * 0.1}s` }}></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500/20 via-yellow-500/10 to-transparent p-6 border border-amber-500/20">
        {/* Background decorations */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-yellow-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        
        {/* Floating booking icons */}
        <div className="absolute top-4 right-8 text-4xl opacity-20 animate-float">📋</div>
        <div className="absolute bottom-4 right-24 text-3xl opacity-20 animate-float" style={{ animationDelay: '1s' }}>📅</div>
        <div className="absolute top-12 right-32 text-2xl opacity-20 animate-float" style={{ animationDelay: '2s' }}>✅</div>
        
        <div className="relative flex items-center gap-4">
          <div className="relative">
            {/* Animated glow ring */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-500 blur-xl opacity-40 animate-pulse" />
            <div className="relative p-4 rounded-2xl bg-gradient-to-br from-amber-500/20 to-yellow-500/10 border border-amber-500/30 backdrop-blur-sm flex items-center justify-center animate-float">
              <span className="text-4xl drop-shadow-lg">📋</span>
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-text-main">
              My Bookings
            </h1>
            <p className="text-text-muted">
              View and manage your reservations
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in-up">
        <div className="p-4 rounded-xl bg-gradient-to-br from-success/10 to-success/5 border border-success/20">
          <p className="text-2xl font-bold text-success">{upcomingBookings.filter(b => b.status === 'CONFIRMED').length}</p>
          <p className="text-sm text-text-muted">✅ Confirmed</p>
        </div>
        <div className="p-4 rounded-xl bg-gradient-to-br from-warning/10 to-warning/5 border border-warning/20">
          <p className="text-2xl font-bold text-warning">{upcomingBookings.filter(b => b.status === 'PENDING').length}</p>
          <p className="text-sm text-text-muted">⏳ Pending</p>
        </div>
        <div className="p-4 rounded-xl bg-gradient-to-br from-accent-blue/10 to-accent-blue/5 border border-accent-blue/20">
          <p className="text-2xl font-bold text-accent-blue">{upcomingBookings.filter(b => b.status === 'CHECKED_IN').length}</p>
          <p className="text-sm text-text-muted">📍 Checked In</p>
        </div>
        <div className="p-4 rounded-xl bg-gradient-to-br from-text-muted/10 to-text-muted/5 border border-text-muted/20">
          <p className="text-2xl font-bold text-text-muted">{pastBookings.length}</p>
          <p className="text-sm text-text-muted">📜 Past</p>
        </div>
      </div>

      {/* Upcoming Bookings */}
      <Card variant="glow" className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">📅</span>
            Upcoming Bookings
            {upcomingBookings.length > 0 && (
              <Badge variant="info" className="ml-2">{upcomingBookings.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingBookings.length === 0 ? (
            <div className="empty-state py-12">
              <div className="empty-state-icon text-6xl">📭</div>
              <h3 className="text-xl font-semibold text-text-main mb-2">No Upcoming Bookings</h3>
              <p className="text-text-muted mb-6">Your schedule is clear! Time to book something?</p>
              <Button variant="gradient" onClick={() => window.location.href = '/user/facilities'}>
                <Sparkles className="mr-2 h-4 w-4" />
                Browse Facilities
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingBookings.map((booking, index) => (
                <div
                  key={booking._id}
                  className="group relative overflow-hidden rounded-xl border border-card-border bg-gradient-to-r from-bg-dark/80 to-bg-dark/40 p-5 transition-all duration-300 hover:border-accent-blue/30 hover:shadow-lg hover:shadow-accent-blue/5 animate-fade-in-left"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  {/* Status indicator line */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                    booking.status === 'CONFIRMED' ? 'bg-success' :
                    booking.status === 'PENDING' ? 'bg-warning' :
                    booking.status === 'CHECKED_IN' ? 'bg-accent-blue' :
                    'bg-text-muted'
                  }`} />
                  
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pl-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-text-main text-lg group-hover:text-accent-blue transition-colors">
                          {booking.resourceName}
                        </p>
                        {getStatusBadge(booking.status, booking.approval, booking.kind, booking.start, booking.end)}
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-4 text-sm text-text-muted">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4 text-accent-blue" />
                          {booking.kind === 'EQUIPMENT' ? 'Pickup: ' : ''}{formatDateTime(booking.start)}
                          {booking.kind !== 'EQUIPMENT' && ` → ${formatDateTime(booking.end)}`}
                        </span>
                        {booking.kind === 'EQUIPMENT' && (
                          <span className="flex items-center gap-1.5 text-warning">
                            <Clock className="h-4 w-4" />
                            Return by: {formatDateTime(booking.end)}
                          </span>
                        )}
                      </div>
                      
                      {booking.items && booking.items.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {booking.items.map((item: BookingItem, i: number) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-accent-blue/10 text-xs text-accent-blue">
                              <Package className="h-3 w-3" />
                              {item.name} ({item.qty})
                            </span>
                          ))}
                        </div>
                      )}
                      
                      {(booking.rescheduleCount || 0) > 0 && (
                        <Badge variant="secondary" icon="🔄" className="mt-2">
                          Rescheduled {booking.rescheduleCount}x
                        </Badge>
                      )}
                    </div>
                    
                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2">
                      {booking.status === 'CONFIRMED' && (booking.kind === 'EQUIPMENT' || booking.kind === 'LIBRARY') && (
                        <Button
                          size="sm"
                          onClick={() => handleGenerateQR(booking._id, new Date(booking.start).toISOString())}
                          loading={generatingQR === booking._id}
                          className="group/btn"
                        >
                          <QrCode className="mr-2 h-4 w-4 group-hover/btn:animate-pulse" />
                          Get QR
                        </Button>
                      )}
                      
                      {(() => {
                        const rescheduleCheck = canReschedule(booking);
                        if (['CONFIRMED', 'PENDING'].includes(booking.status)) {
                          return rescheduleCheck.allowed ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const today = getISTNow();
                                const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                                setRescheduleModal({
                                  open: true,
                                  booking,
                                  selectedDate: todayDateStr,
                                  selectedSlot: undefined,
                                  newStart: undefined,
                                  newEnd: undefined,
                                });
                                setConfirmedPenalty(false);
                              }}
                              className="group/btn"
                            >
                              <RefreshCw className="mr-2 h-4 w-4 group-hover/btn:rotate-180 transition-transform duration-500" />
                              Reschedule
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled
                              title={rescheduleCheck.reason}
                            >
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Reschedule
                            </Button>
                          );
                        }
                        return null;
                      })()}
                      
                      {['CONFIRMED', 'PENDING'].includes(booking.status) && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleCancel(booking._id)}
                          className="group/btn"
                        >
                          <X className="mr-2 h-4 w-4 group-hover/btn:rotate-90 transition-transform" />
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past Bookings */}
      <Card className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">📜</span>
            Past Bookings
            {pastBookings.length > 0 && (
              <Badge variant="secondary" className="ml-2">{pastBookings.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pastBookings.length === 0 ? (
            <div className="text-center py-8">
                <p className="text-text-muted">No past bookings yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pastBookings.slice(0, 10).map((booking, index) => (
                <div
                  key={booking._id}
                  className="flex items-center justify-between rounded-xl border border-card-border/50 bg-bg-dark/30 p-4 transition-all duration-300 hover:bg-bg-dark/50 opacity-75 hover:opacity-100"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      booking.status === 'COMPLETED' ? 'bg-success/10 text-success' :
                      booking.status === 'CANCELLED' ? 'bg-danger/10 text-danger' :
                      booking.status === 'NO_SHOW' ? 'bg-warning/10 text-warning' :
                      'bg-text-muted/10 text-text-muted'
                    }`}>
                      {booking.status === 'COMPLETED' ? '✅' :
                       booking.status === 'CANCELLED' ? '❌' :
                       booking.status === 'NO_SHOW' ? '👻' : '📋'}
                    </div>
                    <div>
                      <p className="font-medium text-text-main">{booking.resourceName}</p>
                      <p className="text-sm text-text-muted flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDateTime(booking.start)}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(booking.status, booking.approval, booking.kind, booking.start, booking.end)}
                </div>
              ))}
              
              {pastBookings.length > 10 && (
                <p className="text-center text-sm text-text-muted pt-4">
                  Showing 10 of {pastBookings.length} past bookings
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={qrModal.open}
        onClose={() => setQrModal({ open: false })}
        title="Your QR Code"
        size="md"
      >
        {qrModal.qrImage && (
          <div className="space-y-4">
            {/* Countdown Timer */}
            <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-accent-blue/10 border border-accent-blue/30">
              <Clock className="h-5 w-5 text-accent-blue" />
              <span className="text-lg font-bold text-accent-blue">
                {timeRemaining || 'Loading...'}
              </span>
              <span className="text-sm text-text-muted">remaining</span>
            </div>

            {/* QR Code */}
            <div className="flex justify-center p-6 bg-white rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrModal.qrImage} alt="QR Code" className="w-64 h-64" />
            </div>

            {/* Instructions */}
            <div className="text-center space-y-2">
              <p className="font-medium text-text-main">{qrModal.booking?.resourceName}</p>
              <p className="text-sm text-text-muted">
                Show this QR code to the guard for {qrModal.booking?.kind === 'LIBRARY' ? 'book pickup' : 'equipment pickup'}
              </p>
              <p className="text-xs text-danger">
                ⚠️ QR code expires in 10 minutes. You can generate QR code maximum 2 times per booking.
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Reschedule Modal */}
      <Modal
        isOpen={rescheduleModal.open}
        onClose={() => setRescheduleModal({ open: false })}
        title="Reschedule Booking"
        size="md"
      >
        {rescheduleModal.booking && (
          <div className="space-y-4">
            {/* Current Booking Info Card - Enhanced */}
            <div className="p-4 bg-gradient-to-br from-accent-blue/10 to-accent-blue/5 rounded-lg border border-accent-blue/30">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-accent-blue/20 rounded-lg flex items-center justify-center">
                  <Clock className="h-5 w-5 text-accent-blue" />
                </div>
                <div>
                  <p className="font-semibold text-text-main">{rescheduleModal.booking.resourceName}</p>
                  <p className="text-sm text-text-muted mt-1">
                    <span className="font-medium">Current:</span> {formatDateTime(rescheduleModal.booking.start)}
                    {rescheduleModal.booking.kind !== 'EQUIPMENT' && ` - ${formatDateTime(rescheduleModal.booking.end)}`}
                  </p>
                  {rescheduleModal.booking.kind === 'EQUIPMENT' && (
                    <p className="text-xs text-text-muted mt-0.5">
                      Return by: {formatDateTime(rescheduleModal.booking.end)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Date Picker */}
            <div>
              <label className="block text-sm font-medium text-text-main mb-2">
                Select Date
              </label>
              <DatePicker
                value={rescheduleModal.selectedDate ? new Date(`${rescheduleModal.selectedDate}T00:00:00`) : getISTNow()}
                onChange={(date) => {
                  if (date instanceof Date) {
                    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                    setRescheduleModal({
                      ...rescheduleModal,
                      selectedDate: dateStr,
                      selectedSlot: undefined,
                      newStart: undefined,
                      newEnd: undefined,
                    });
                  }
                }}
                minDate={getISTNow()}
                placeholder="Select a date"
              />
            </div>

            {/* Time Slot Grid */}
            {rescheduleModal.selectedDate && rescheduleModal.booking && (
              <div>
                <label className="block text-sm font-medium text-text-main mb-2">
                  Select Time
                </label>
                {(() => {
                  const slots = generateRescheduleSlots(rescheduleModal.selectedDate, rescheduleModal.booking);

                  if (slots.length === 0) {
                    return (
                      <div className="p-4 bg-warning/10 rounded-lg border border-warning/30 text-sm text-warning">
                        No available slots for this date. Slots must be at least 2 hours in the future.
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto p-2">
                      {slots.map((slot, idx) => {
                        const isSelected = rescheduleModal.selectedSlot?.start === slot.start;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setRescheduleModal({
                                ...rescheduleModal,
                                selectedSlot: slot,
                                newStart: slot.start,
                                newEnd: slot.end,
                              });
                            }}
                            className={`
                              px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                              ${isSelected ? 'bg-accent-blue text-white shadow-lg shadow-accent-blue/30' : 'bg-bg-secondary hover:bg-accent-blue/20 text-text-main'}
                            `}
                          >
                            {slot.label}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Calculated End Time Display */}
            {rescheduleModal.newEnd && (
              <div className="p-3 bg-secondary/10 rounded-lg border border-secondary/30">
                <p className="text-sm font-medium text-secondary">
                  📅 Ends at: {formatDateTime(rescheduleModal.newEnd)}
                </p>
              </div>
            )}

            {/* Penalty Policy Warning */}
            <div className="p-3 bg-warning/10 rounded-lg border border-warning/30">
              <p className="text-sm font-medium text-warning mb-2">
                ⚠️ Rescheduling Policies:
              </p>
              <ul className="text-xs text-warning space-y-1 list-disc list-inside">
                <li>You can only reschedule this booking <strong>1 time</strong></li>
                <li><strong>3 penalty points</strong> will be added to your account</li>
                <li>Maximum <strong>3 reschedules allowed per month</strong></li>
                <li>Cannot reschedule within <strong>2 hours</strong> of start time</li>
              </ul>
            </div>

            {/* Confirmation Checkbox */}
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmedPenalty}
                onChange={(e) => setConfirmedPenalty(e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm text-text-main">
                I understand that <strong>3 penalty points</strong> will be added to my account and this booking can only be rescheduled once.
              </span>
            </label>

            {rescheduleModal.booking.requiresApproval && rescheduleModal.booking.status === 'CONFIRMED' && (
              <div className="p-3 bg-warning/10 rounded-lg border border-warning/30">
                <p className="text-sm text-warning">
                  ⚠️ Note: Rescheduling may require admin approval again depending on the new time slot.
                </p>
              </div>
            )}

            {error && (
              <div className="p-3 bg-danger/10 rounded-lg border border-danger/30">
                <p className="text-sm text-danger">{error}</p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setRescheduleModal({ open: false })}
                disabled={rescheduling}
              >
                Cancel
              </Button>
              <Button
                onClick={handleReschedule}
                disabled={rescheduling || !rescheduleModal.newStart || !rescheduleModal.newEnd || !confirmedPenalty}
              >
                {rescheduling ? 'Rescheduling...' : 'Reschedule'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
