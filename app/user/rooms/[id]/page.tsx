'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { ArrowLeft, MapPin, Users, Clock, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { getISTToday, getISTNow } from '@/lib/timezone-client';
import { POLICIES } from '@/lib/policies';
import TimeRangePicker from '@/components/booking/TimeRangePicker';

interface Params {
  id: string;
}

interface Resource {
  _id: string;
  name: string;
  location?: string;
  capacity?: number;
}

export default function RoomBookingPage({ params }: { params: Params }) {
  const router = useRouter();
  const [resource, setResource] = useState<Resource | null>(null);
  const [date, setDate] = useState(getISTToday());
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Availability data for TimeRangePicker
  const [busySlots, setBusySlots] = useState<Array<{ start: string; end: string }>>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  useEffect(() => {
    fetchResource();
  }, [params.id]);

  // Reset selected slot when date changes
  useEffect(() => {
    setSelectedSlot(null);
  }, [date]);

  const fetchResource = async () => {
    const res = await fetch(`/api/resources?type=ROOM`);
    const data = await res.json();
    const found = data.resources.find((r: Resource) => r._id === params.id);
    setResource(found);
  };

  // Fetch availability data for TimeRangePicker
  const fetchAvailability = async () => {
    if (!resource?._id || !date) return;

    setLoadingAvailability(true);
    try {
      const res = await fetch(`/api/availability?resourceId=${resource._id}&date=${date}`);
      const data = await res.json();

      if (res.ok) {
        setBusySlots(data.busySlots || []);
      } else {
        console.error('Failed to fetch availability:', data);
        setBusySlots([]);
      }
    } catch (err) {
      console.error('Error fetching availability:', err);
      setBusySlots([]);
    } finally {
      setLoadingAvailability(false);
    }
  };

  // Fetch availability when resource or date changes
  useEffect(() => {
    if (resource) {
      fetchAvailability();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource, date]);

  const handleBook = async () => {
    if (!selectedSlot) {
      setError('Please select a time slot');
      return;
    }

    // Validate that slot is not in the past
    const today = getISTToday();
    const slotStart = new Date(selectedSlot.start);
    const now = getISTNow();

    if (date === today && slotStart < now) {
      setError('Cannot book a time slot in the past');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceId: params.id,
          kind: 'ROOM',
          start: selectedSlot.start,
          end: selectedSlot.end,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create booking');
      }

      setSuccess(true);
      setTimeout(() => router.push('/user/bookings'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Calculate max date (7 days from today)
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + POLICIES.ADVANCE_BOOKING_DAYS);
  const maxDateStr = maxDate.toISOString().split('T')[0];

  if (!resource) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-32 animate-pulse rounded bg-card"></div>
        <div className="h-96 animate-pulse rounded-lg bg-card"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Link href="/user/rooms">
        <Button variant="ghost" size="sm" className="group">
          <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to Rooms
        </Button>
      </Link>

      {/* Resource Info Card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-purple-500/20 via-purple-500/10 to-transparent p-6 border-b border-white/5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl mb-2">{resource.name}</CardTitle>
              <div className="flex flex-wrap items-center gap-4 text-sm text-text-muted">
                {resource.location && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-purple-400" />
                    {resource.location}
                  </div>
                )}
                {resource.capacity && (
                  <div className="flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-purple-400" />
                    {resource.capacity} people
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-purple-400" />
                  8:00 AM – 8:00 PM
                </div>
              </div>
            </div>
          </div>
        </div>

        <CardContent className="p-6 space-y-6">
          {/* Date Selection - Using Custom DatePicker */}
          <div className="space-y-2">
            <DatePicker
              value={date}
              onChange={(newDate) => setDate(typeof newDate === 'string' ? newDate : newDate.toISOString().split('T')[0])}
              minDate={getISTToday()}
              maxDate={maxDateStr}
              returnFormat="string"
              placeholder="Pick a date"
            />
            <p className="text-xs text-text-muted">
              You can book up to {POLICIES.ADVANCE_BOOKING_DAYS} days in advance
            </p>
          </div>

          {/* Time Selection */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-text-main">
              <Clock className="h-4 w-4 text-purple-400" />
              Select Time
            </label>

            {date === getISTToday() && (
              <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>Only remaining time slots for today are shown</span>
              </div>
            )}

            {loadingAvailability ? (
              <div className="h-48 flex items-center justify-center bg-white/5 rounded-xl">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
                  <p className="text-sm text-text-muted">Loading availability...</p>
                </div>
              </div>
            ) : (
              <TimeRangePicker
                date={date}
                busySlots={busySlots}
                workingHours={{ start: '08:00', end: '20:00' }}
                onSelect={(start, end) => {
                  setSelectedSlot({
                    start: start.toISOString(),
                    end: end.toISOString(),
                  });
                }}
              />
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4">
              <p className="text-sm text-emerald-300">
                ✓ Booking successful! Redirecting to your bookings...
              </p>
            </div>
          )}

          {/* Book Button */}
          <Button
            onClick={handleBook}
            disabled={!selectedSlot || loading}
            className="w-full"
            size="lg"
            variant="gradient"
          >
            {loading ? 'Booking...' : 'Confirm Booking'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
