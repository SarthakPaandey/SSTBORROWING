'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TimePicker } from '@/components/ui/TimePicker';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getISTToday, getISTNow } from '@/lib/timezone-client';

interface Params {
  id: string;
}

export default function RoomBookingPage({ params }: { params: Params }) {
  const router = useRouter();
  const [resource, setResource] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(getISTNow());
  const [selectedStartTime, setSelectedStartTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchResource();
  }, [params.id]);

  const fetchResource = async () => {
    const res = await fetch(`/api/resources?type=ROOM`);
    const data = await res.json();
    const found = data.resources.find((r: any) => r._id === params.id);
    setResource(found);
  };

  const handleBook = async () => {
    if (!selectedStartTime) {
      setError('Please select a time');
      return;
    }

    // Helper to get YYYY-MM-DD from Date object in IST
    const formatISTDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // Validate that slot is not in the past
    const dateStr = formatISTDate(selectedDate);
    const [hour, minute] = selectedStartTime.split(':').map(Number);

    const startDateTime = new Date(`${dateStr}T${selectedStartTime}:00+05:30`);
    const endDateTime = new Date(startDateTime);
    endDateTime.setHours(hour + 1, minute, 0); // 1 hour slot

    const now = getISTNow();
    if (startDateTime < now) {
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
          start: startDateTime.toISOString(),
          end: endDateTime.toISOString(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create booking');
      }

      setSuccess(true);
      setTimeout(() => router.push('/user/bookings'), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!resource) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-32 animate-pulse rounded bg-card"></div>
        <div className="h-96 animate-pulse rounded-lg bg-card"></div>
      </div>
    );
  }

  // Helper to get YYYY-MM-DD from Date object in IST
  const formatISTDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const dateStr = formatISTDate(selectedDate);

  return (
    <div className="space-y-6">
      <Link href="/user/rooms">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Rooms
        </Button>
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{resource.name}</CardTitle>
          <p className="text-text-muted">Select a date and time for your booking</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Date Input */}
          <div>
            <label className="mb-2 block text-sm font-medium text-text-main">Select Date</label>
            <input
              type="date"
              value={dateStr}
              onChange={(e) => {
                const newDate = new Date(e.target.value + 'T00:00:00+05:30');
                setSelectedDate(newDate);
              }}
              min={formatISTDate(getISTNow())}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-text-main focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Time Picker */}
          <TimePicker
            date={dateStr}
            value={selectedStartTime}
            onChange={setSelectedStartTime}
            minTime="08:00"
            maxTime="20:00"
            stepMinutes={30}
            label="Select Time Slot"
            helperText="Each booking is for 1 hour"
          />

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-md bg-green-500/10 border border-green-500/30 p-3 text-sm text-green-600">
              Booking successful! Redirecting...
            </div>
          )}

          <Button
            onClick={handleBook}
            disabled={!selectedStartTime || loading}
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
