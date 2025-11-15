'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { ArrowLeft, Users, X } from 'lucide-react';
import Link from 'next/link';

interface Params {
  id: string;
}

const TEAM_SPORTS = ['Main Turf', 'Basketball Court', 'Volleyball Court'];

export default function FacilityBookingPage({ params }: { params: Params }) {
  const router = useRouter();
  const [resource, setResource] = useState<any>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Group booking state
  const [isGroupBooking, setIsGroupBooking] = useState(false);
  const [memberEmails, setMemberEmails] = useState<string[]>(['', '', '', '', '']);
  const [emailInput, setEmailInput] = useState('');

  useEffect(() => {
    fetchResource();
  }, [params.id]);

  const fetchResource = async () => {
    const res = await fetch(`/api/resources?type=FACILITY`);
    const data = await res.json();
    const found = data.resources.find((r: any) => r._id === params.id);
    setResource(found);
    
    // Automatically set group booking to true for team sports
    const isTeamSport = found && TEAM_SPORTS.includes(found.name);
    if (isTeamSport) {
      setIsGroupBooking(true);
    }
  };

  const handleBook = async () => {
    if (!selectedSlot) return;

    const isTeamSport = resource && TEAM_SPORTS.includes(resource.name);

    // For team sports, validate group booking requirements
    if (isTeamSport) {
      const validEmails = memberEmails.filter(email => email.trim() !== '');
      if (validEmails.length < 5) {
        setError('Please provide at least 5 friend emails (6 total including you)');
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      for (const email of validEmails) {
        if (!emailRegex.test(email)) {
          setError(`Invalid email format: ${email}`);
          return;
        }
      }

      setLoading(true);
      setError('');

      try {
        const res = await fetch('/api/bookings/group', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resourceId: params.id,
            start: selectedSlot.start,
            end: selectedSlot.end,
            memberEmails: validEmails,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to create group booking');
        }

        setSuccess(true);
        setTimeout(() => router.push('/user/bookings'), 2000);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    } else {
      // Regular booking for non-team sports
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
    }
  };

  const addEmailField = () => {
    setMemberEmails([...memberEmails, '']);
  };

  const removeEmailField = (index: number) => {
    const updated = memberEmails.filter((_, i) => i !== index);
    setMemberEmails(updated);
  };

  const updateEmail = (index: number, value: string) => {
    const updated = [...memberEmails];
    updated[index] = value;
    setMemberEmails(updated);
  };

  const isTeamSport = resource && TEAM_SPORTS.includes(resource.name);

  if (!resource) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-32 animate-pulse rounded bg-card"></div>
        <div className="h-96 animate-pulse rounded-lg bg-card"></div>
      </div>
    );
  }

  // Generate time slots (6am - 8pm)
  const generateSlots = () => {
    const slots = [];
    for (let hour = 6; hour < 20; hour++) {
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
          <div className="flex items-center justify-between">
            <CardTitle>{resource.name}</CardTitle>
            {isTeamSport && (
              <Badge variant="default">
                <Users className="mr-1 h-3 w-3" />
                Group Booking Required
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isTeamSport && (
            <div className="rounded-lg bg-blue-50 p-4 border-2 border-blue-300">
              <div className="flex items-start space-x-3">
                <Users className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-blue-900">
                    Group Booking Required (Minimum 6 people)
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    Team sports require at least 6 participants. Invite 5 friends below - they'll have 2 hours to confirm. All members share penalties for no-shows.
                  </p>
                </div>
              </div>
            </div>
          )}

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

          {isTeamSport && (
            <div className="space-y-3">
              <label className="block text-sm font-medium">
                Friend Emails (minimum 5, you'll be the 6th)
              </label>
              {memberEmails.map((email, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    type="email"
                    placeholder={`Friend ${index + 1} email (@sst.scaler.com)`}
                    value={email}
                    onChange={(e) => updateEmail(index, e.target.value)}
                  />
                  {memberEmails.length > 5 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeEmailField(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={addEmailField}
                className="w-full"
              >
                + Add More Friends
              </Button>
              <p className="text-xs text-muted-foreground">
                Total: {memberEmails.filter(e => e.trim()).length + 1} people
                (including you)
              </p>
            </div>
          )}

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
            {loading
              ? (isTeamSport ? 'Creating Group Booking...' : 'Booking...')
              : (isTeamSport ? 'Send Invitations & Book' : 'Confirm Booking')
            }
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
