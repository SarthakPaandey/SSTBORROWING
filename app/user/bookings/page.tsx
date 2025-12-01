'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { formatDateTime } from '@/lib/utils';
import { getISTNow } from '@/lib/timezone-client';
import { QrCode, Clock } from 'lucide-react';
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
    newStart?: string;
    newEnd?: string;
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
    // In development mode, bypass the 15-minute check
    const isDev = process.env.NODE_ENV === 'development';

    if (!isDev) {
      const start = new Date(startTime).getTime();
      const now = new Date().getTime();
      const timeUntilStart = start - now;
      const minutesUntilStart = timeUntilStart / (1000 * 60);

      if (minutesUntilStart > 15) {
        setError('QR code can only be generated 15 minutes before the booking start time');
        return;
      }
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

    setRescheduling(true);
    setError('');

    try {
      const res = await fetch(`/api/bookings/${rescheduleModal.booking._id}/reschedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: rescheduleModal.newStart,
          end: rescheduleModal.newEnd,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to reschedule booking');
      }

      // Show success message with approval info if needed
      if (data.requiresApproval) {
        alert('Booking rescheduled successfully! Since the new time requires approval, your booking status has been reset to "Awaiting Approval". You will be notified once an admin reviews your request.');
      } else {
        alert('Booking rescheduled successfully!');
      }

      fetchBookings(); // Refresh bookings list
      setRescheduleModal({ open: false }); // Close modal
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
        <div className="h-12 w-64 animate-pulse rounded bg-card"></div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-card"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Bookings</h1>
        <p className="text-gray-600">View and manage your bookings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingBookings.length === 0 ? (
            <p className="text-center text-gray-500">No upcoming bookings</p>
          ) : (
            <div className="space-y-4">
              {upcomingBookings.map((booking) => (
                <div
                  key={booking._id}
                  className="flex items-start justify-between rounded-lg border p-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{booking.resourceName}</p>
                      {getStatusBadge(booking.status, booking.approval, booking.kind, booking.start, booking.end)}
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      {booking.kind === 'EQUIPMENT' ? 'Pickup: ' : ''}{formatDateTime(booking.start)}
                      {booking.kind !== 'EQUIPMENT' && ` - ${formatDateTime(booking.end)}`}
                    </p>
                    {booking.kind === 'EQUIPMENT' && (
                      <p className="mt-1 text-sm text-gray-600">
                        Return by: {formatDateTime(booking.end)}
                      </p>
                    )}
                    {booking.items && booking.items.length > 0 && (
                      <div className="mt-2 text-sm text-gray-600">
                        Items: {booking.items.map((item: BookingItem) => `${item.name} (${item.qty})`).join(', ')}
                      </div>
                    )}
                    {/* Show reschedule count badge if applicable */}
                    {(booking.rescheduleCount || 0) > 0 && (
                      <Badge variant="secondary" className="mt-2">
                        Rescheduled {booking.rescheduleCount}x
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {booking.status === 'CONFIRMED' && (booking.kind === 'EQUIPMENT' || booking.kind === 'LIBRARY') && (
                      <Button
                        size="sm"
                        onClick={() => handleGenerateQR(booking._id, new Date(booking.start).toISOString())}
                      >
                        <QrCode className="mr-2 h-4 w-4" />
                        Get QR
                      </Button>
                    )}
                    {/* Reschedule button with validation */}
                    {(() => {
                      const rescheduleCheck = canReschedule(booking);
                      if (['CONFIRMED', 'PENDING'].includes(booking.status)) {
                        return rescheduleCheck.allowed ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setRescheduleModal({
                                open: true,
                                booking,
                                newStart: new Date(booking.start).toISOString().slice(0, 16),
                                newEnd: new Date(booking.end).toISOString().slice(0, 16),
                              });
                              setConfirmedPenalty(false);
                            }}
                          >
                            <Clock className="mr-2 h-4 w-4" />
                            Reschedule
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled
                            title={rescheduleCheck.reason}
                          >
                            <Clock className="mr-2 h-4 w-4" />
                            Reschedule
                          </Button>
                        );
                      }
                      return null;
                    })()}
                    {/* Cancel button */}
                    {['CONFIRMED', 'PENDING'].includes(booking.status) && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleCancel(booking._id)}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Past Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          {pastBookings.length === 0 ? (
            <p className="text-center text-gray-500">No past bookings</p>
          ) : (
            <div className="space-y-4">
              {pastBookings.slice(0, 10).map((booking) => (
                <div
                  key={booking._id}
                  className="flex items-start justify-between rounded-lg border p-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{booking.resourceName}</p>
                      {getStatusBadge(booking.status, booking.approval, booking.kind, booking.start, booking.end)}
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      {formatDateTime(booking.start)}
                    </p>
                  </div>
                </div>
              ))}
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

            {/* New Start Time Input */}
            <div>
              <label className="block text-sm font-medium text-text-main mb-2">
                Select New Start Time
              </label>
              <input
                type="datetime-local"
                value={rescheduleModal.newStart || ''}
                onChange={(e) => {
                  const newStartVal = e.target.value;
                  if (!newStartVal || !rescheduleModal.booking) {
                    setRescheduleModal({ ...rescheduleModal, newStart: '', newEnd: '' });
                    return;
                  }

                  // Calculate duration from original booking
                  const originalStart = new Date(rescheduleModal.booking.start).getTime();
                  const originalEnd = new Date(rescheduleModal.booking.end).getTime();
                  const durationMs = originalEnd - originalStart;

                  // Calculate new end time
                  const newStartDate = new Date(newStartVal);
                  const newEndDate = new Date(newStartDate.getTime() + durationMs);

                  // Convert to datetime-local format (YYYY-MM-DDTHH:mm)
                  const pad = (n: number) => n < 10 ? '0' + n : n;
                  const newEndStr = newEndDate.getFullYear() + '-' +
                    pad(newEndDate.getMonth() + 1) + '-' +
                    pad(newEndDate.getDate()) + 'T' +
                    pad(newEndDate.getHours()) + ':' +
                    pad(newEndDate.getMinutes());

                  setRescheduleModal({
                    ...rescheduleModal,
                    newStart: newStartVal,
                    newEnd: newEndStr,
                  });
                }}
                className="w-full px-4 py-2.5 border border-card-border rounded-lg bg-bg-main text-text-main focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent transition-all"
              />
            </div>

            {/* Calculated End Time Display (Read-only) */}
            {rescheduleModal.newEnd && (
              <div className="p-3 bg-secondary/10 rounded-lg border border-secondary/30">
                <p className="text-sm text-text-muted">
                  <span className="font-medium text-text-main">Duration will be maintained:</span>
                </p>
                <p className="text-sm text-secondary font-medium mt-1">
                  Ends at: {formatDateTime(rescheduleModal.newEnd)}
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
