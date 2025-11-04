'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface Params {
  id: string;
}

export default function FacilityBookingPage({ params }: { params: Params }) {
  const router = useRouter();
  const [resource, setResource] = useState<any>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchResource();
  }, [params.id]);

  const fetchResource = async () => {
    const res = await fetch(`/api/resources?type=FACILITY`);
    const data = await res.json();
    const found = data.resources.find((r: any) => r._id === params.id);
    setResource(found);
  };

  const handleBook = async () => {
    if (!selectedSlot) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceId: params.id,
          kind: 'FACILITY',
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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!resource) {
    return <div>Loading...</div>;
  }

  // Generate time slots (simplified)
  const generateSlots = () => {
    const slots = [];
    for (let hour = 6; hour < 22; hour++) {
      const start = new Date(date);
      start.setHours(hour, 0, 0, 0);
      const end = new Date(start);
      end.setHours(hour + 1, 0, 0, 0);

      slots.push({
        start: start.toISOString(),
        end: end.toISOString(),
        label: `${hour}:00 - ${hour + 1}:00`,
      });
    }
    return slots;
  };

  const slots = generateSlots();

  return (
    <div className="space-y-6">
      <Link href="/user/facilities">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Facilities
        </Button>
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>{resource.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">Select Date</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Available Slots</label>
            <div className="grid grid-cols-3 gap-2">
              {slots.map((slot, idx) => (
                <Button
                  key={idx}
                  variant={
                    selectedSlot?.start === slot.start ? 'default' : 'outline'
                  }
                  onClick={() => setSelectedSlot(slot)}
                  size="sm"
                >
                  {slot.label}
                </Button>
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">
              Booking successful! Redirecting...
            </div>
          )}

          <Button
            onClick={handleBook}
            disabled={!selectedSlot || loading}
            className="w-full"
            size="lg"
          >
            {loading ? 'Booking...' : 'Confirm Booking'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
