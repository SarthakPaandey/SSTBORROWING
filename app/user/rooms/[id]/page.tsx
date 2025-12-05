'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DatePicker } from '@/components/ui/DatePicker';
import { ArrowLeft, MapPin, Users, Clock, AlertTriangle, DoorOpen, Calendar, CheckCircle2, Sparkles, Info } from 'lucide-react';
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

// Room type configuration
const roomTypeConfig: Record<string, { emoji: string; color: string }> = {
  'Meeting': { emoji: '🤝', color: 'from-blue-500/20 to-cyan-500/10' },
  'Study': { emoji: '📚', color: 'from-amber-500/20 to-yellow-500/10' },
  'Conference': { emoji: '🎯', color: 'from-purple-500/20 to-pink-500/10' },
  'Seminar': { emoji: '🎤', color: 'from-emerald-500/20 to-green-500/10' },
  'Lab': { emoji: '🔬', color: 'from-rose-500/20 to-red-500/10' },
  'default': { emoji: '🚪', color: 'from-accent-purple-1/20 to-pink-500/10' },
};

function getRoomConfig(name: string) {
  for (const [key, config] of Object.entries(roomTypeConfig)) {
    if (name.toLowerCase().includes(key.toLowerCase())) {
      return config;
    }
  }
  return roomTypeConfig.default;
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

  const roomConfig = resource ? getRoomConfig(resource.name) : roomTypeConfig.default;

  if (!resource) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto animate-pulse">
        <div className="h-10 w-32 rounded-lg bg-card" />
        <div className="rounded-2xl border border-card-border overflow-hidden">
          <div className="h-32 bg-gradient-to-r from-accent-purple-1/10 to-transparent" />
          <div className="p-6 space-y-4">
            <div className="h-8 w-64 rounded bg-card" />
            <div className="h-48 rounded-xl bg-card" />
            <div className="h-12 rounded-xl bg-card" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back Button */}
      <Link href="/user/rooms">
        <Button variant="ghost" size="sm" className="group hover:bg-accent-purple-1/10">
          <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to Rooms
        </Button>
      </Link>

      {/* Resource Info Card - Cleaner */}
      <Card className="overflow-hidden border border-card-border animate-fade-in-up">
        {/* Header with subtle background */}
        <div className="relative bg-card/60 p-6 border-b border-card-border backdrop-blur">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-bg-dark border border-card-border shadow-sm">
                <DoorOpen className="h-6 w-6 text-text-main" />
              </div>
              <div>
                <CardTitle className="text-2xl text-text-main">{resource.name}</CardTitle>
                <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-text-muted">
                  {resource.location && (
                    <Badge variant="secondary" className="gap-1.5">
                      <MapPin className="h-3 w-3" />
                      {resource.location}
                    </Badge>
                  )}
                  {resource.capacity && (
                    <Badge variant="secondary" className="gap-1.5">
                      <Users className="h-3 w-3" />
                      {resource.capacity} people
                    </Badge>
                  )}
                  <Badge variant="secondary" className="gap-1.5">
                    <Clock className="h-3 w-3" />
                    8 AM – 8 PM
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>

        <CardContent className="p-6 space-y-6">
          {/* Booking Steps Indicator */}
          <div className="flex items-center justify-center gap-2 text-sm text-text-muted">
            <div className={`flex items-center gap-2 ${date ? 'text-accent-purple-1' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${date ? 'bg-accent-purple-1 text-white' : 'bg-bg-dark text-text-muted'}`}>
                1
              </div>
              <span className="hidden sm:inline">Date</span>
            </div>
            <div className="w-8 h-0.5 bg-card-border" />
            <div className={`flex items-center gap-2 ${selectedSlot ? 'text-accent-purple-1' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${selectedSlot ? 'bg-accent-purple-1 text-white' : 'bg-bg-dark text-text-muted'}`}>
                2
              </div>
              <span className="hidden sm:inline">Time</span>
            </div>
            <div className="w-8 h-0.5 bg-card-border" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-bg-dark text-text-muted">
                3
              </div>
              <span className="hidden sm:inline">Confirm</span>
            </div>
          </div>

          {/* Date Selection - Enhanced */}
          <div className="p-4 rounded-xl bg-bg-dark/50 border border-card-border space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-text-main">
              <Calendar className="h-4 w-4 text-accent-purple-1" />
              📅 Select Date
            </label>
            <DatePicker
              value={date}
              onChange={(newDate) => setDate(typeof newDate === 'string' ? newDate : newDate.toISOString().split('T')[0])}
              minDate={getISTToday()}
              maxDate={maxDateStr}
              returnFormat="string"
              placeholder="Pick a date"
            />
            <p className="text-xs text-text-muted flex items-center gap-1">
              <Info className="h-3 w-3" />
              You can book up to {POLICIES.ADVANCE_BOOKING_DAYS} days in advance
            </p>
          </div>

          {/* Time Selection - Enhanced */}
          <div className="p-4 rounded-xl bg-bg-dark/50 border border-card-border space-y-4">
            <label className="flex items-center gap-2 text-sm font-medium text-text-main">
              <Clock className="h-4 w-4 text-accent-purple-1" />
              ⏰ Select Time Slot
            </label>

            {date === getISTToday() && (
              <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5 animate-pulse-subtle">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>⚡ Only remaining time slots for today are shown</span>
              </div>
            )}

            {loadingAvailability ? (
              <div className="h-48 flex items-center justify-center bg-bg-dark/30 rounded-xl border border-card-border/50">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-3 border-accent-purple-1/30 border-t-accent-purple-1 rounded-full animate-spin" />
                  <p className="text-sm text-text-muted">Loading availability...</p>
                </div>
              </div>
            ) : (
              <div className="animate-fade-in">
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
              </div>
            )}
          </div>

          {/* Selected Slot Summary */}
          {selectedSlot && (
            <div className="p-4 rounded-xl bg-accent-purple-1/10 border border-accent-purple-1/30 animate-fade-in-up">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-accent-purple-1" />
                <div>
                  <p className="font-medium text-text-main">✅ Time Slot Selected</p>
                  <p className="text-sm text-text-muted">
                    {new Date(selectedSlot.start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - {new Date(selectedSlot.end).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error Message - Enhanced */}
          {error && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-4 flex items-start gap-3 animate-shake">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Booking Error</p>
                <p className="text-sm text-destructive/80">{error}</p>
              </div>
            </div>
          )}

          {/* Success Message - Enhanced */}
          {success && (
            <div className="rounded-xl bg-success/10 border border-success/30 p-4 flex items-start gap-3 animate-success-pop">
              <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-success">🎉 Booking Successful!</p>
                <p className="text-sm text-success/80">Redirecting to your bookings...</p>
              </div>
            </div>
          )}

          {/* Book Button - Enhanced */}
          <Button
            onClick={handleBook}
            disabled={!selectedSlot || loading}
            className="w-full h-12 text-lg font-semibold group relative overflow-hidden"
            size="lg"
            variant={selectedSlot ? 'gradient' : 'outline'}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⏳</span>
                Booking...
              </span>
            ) : selectedSlot ? (
              <span className="flex items-center gap-2">
                <DoorOpen className="h-5 w-5 group-hover:scale-110 transition-transform" />
                🚪 Confirm Booking
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Select a Time Slot
              </span>
            )}
          </Button>

          {/* Pro Tip */}
          <div className="text-center text-xs text-text-muted">
            💡 Tip: Green slots are available, red slots are booked
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
