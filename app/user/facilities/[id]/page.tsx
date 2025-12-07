'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { DatePicker } from '@/components/ui/DatePicker';
import { SuccessCelebration } from '@/components/ui/SuccessCelebration';
import { ArrowLeft, Users, X, MapPin, Clock, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { getISTToday, getISTNow } from '@/lib/timezone-client';
import { POLICIES } from '@/lib/policies';
import { Resource } from '@/types/frontend';
import TimeRangePicker from '@/components/booking/TimeRangePicker';

interface Params {
  id: string;
}

const TEAM_SPORTS = POLICIES.GROUP_BOOKING_TEAM_SPORTS;

export default function FacilityBookingPage({ params }: { params: Params }) {
  const router = useRouter();
  const [resource, setResource] = useState<Resource | null>(null);
  const [date, setDate] = useState(getISTToday());
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Group booking state
  const [memberEmails, setMemberEmails] = useState<string[]>(['']); // Start with just one field

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
    const res = await fetch(`/api/resources?type=FACILITY`);
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
    if (!selectedSlot) return;

    // Validate that slot is not in the past
    const today = getISTToday();
    const slotStart = new Date(selectedSlot.start);
    const now = getISTNow();

    if (date === today && slotStart < now) {
      setError('Cannot book a time slot in the past');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isTeamSport = resource && TEAM_SPORTS.includes(resource.name as any);

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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }
  };

  const removeEmailField = (index: number) => {
    const updated = memberEmails.filter((_, i) => i !== index);
    setMemberEmails(updated);
  };

  const updateEmail = (index: number, value: string) => {
    const updated = [...memberEmails];
    updated[index] = value;
    setMemberEmails(updated);

    // Auto-add new field if this field has content and it's the last field
    if (value.trim() !== '' && index === memberEmails.length - 1) {
      setMemberEmails([...updated, '']);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isTeamSport = resource && TEAM_SPORTS.includes(resource.name as any);

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
      <Link href="/user/facilities">
        <Button variant="ghost" size="sm" className="group">
          <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to Facilities
        </Button>
      </Link>

      {/* Resource Info Card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-accent-blue/20 via-accent-blue/10 to-transparent p-6 border-b border-white/5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl mb-2">{resource.name}</CardTitle>
              <div className="flex flex-wrap items-center gap-4 text-sm text-text-muted">
                {resource.location && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-accent-blue" />
                    {resource.location}
                  </div>
                )}
                {resource.capacity && (
                  <div className="flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-accent-blue" />
                    {resource.capacity} people
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-accent-blue" />
                  8:00 AM – 8:00 PM
                </div>
              </div>
            </div>
            {isTeamSport && (
              <Badge variant="default" className="flex-shrink-0">
                <Users className="mr-1 h-3 w-3" />
                Group Booking Required
              </Badge>
            )}
          </div>
        </div>

        <CardContent className="p-6 space-y-6">
          {/* Group Booking Notice */}
          {isTeamSport && (
            <div className="rounded-xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-5 border border-blue-500/20">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Users className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-main mb-1">
                    Group Booking Required (Minimum 6 people)
                  </p>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Team sports require at least 6 participants. Invite 5 friends below - bookings must be made 30 minutes in advance.
                    Friends can confirm until 15 minutes before start. Cancel early if your group can't make it.
                  </p>
                </div>
              </div>
            </div>
          )}

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
              <Clock className="h-4 w-4 text-accent-blue" />
              Select Time
            </label>

            {date === getISTToday() && (
              <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>
                  Only remaining time slots for today are shown
                  {isTeamSport && ' (Group bookings require 30 min advance notice)'}
                </span>
              </div>
            )}

            {loadingAvailability ? (
              <div className="h-48 flex items-center justify-center bg-white/5 rounded-xl">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin"></div>
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
                isGroupBooking={isTeamSport || false}
              />
            )}
          </div>

          {/* Group Member Emails */}
          {isTeamSport && (
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-medium text-text-main">
                <Users className="h-4 w-4 text-accent-blue" />
                Friend Emails (minimum 5, you&apos;ll be the 6th)
              </label>

              <div className="space-y-2">
                {memberEmails.map((email, index) => {
                  // Only show this field if:
                  // 1. It's the first field, OR
                  // 2. The previous field has content
                  const shouldShow = index === 0 || memberEmails[index - 1].trim() !== '';

                  if (!shouldShow) return null;

                  return (
                    <div key={index} className="flex gap-2 items-center">
                      <div className="flex-1">
                        <Input
                          type="email"
                          placeholder={`Friend ${index + 1} email (@sst.scaler.com)`}
                          value={email}
                          onChange={(e) => updateEmail(index, e.target.value)}
                          onKeyDown={(e) => {
                            // Move to next field on Enter
                            if (e.key === 'Enter' && email.trim() !== '') {
                              e.preventDefault();
                              const nextInput = document.querySelector<HTMLInputElement>(
                                `input[placeholder="Friend ${index + 2} email (@sst.scaler.com)"]`
                              );
                              if (nextInput) {
                                nextInput.focus();
                              }
                            }
                          }}
                        />
                      </div>
                      {index > 4 && email.trim() === '' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEmailField(index)}
                          className="flex-shrink-0 text-text-muted hover:text-danger"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg">
                <Users className="h-4 w-4 text-accent-blue" />
                <p className="text-sm text-text-muted">
                  Total: <span className="font-semibold text-text-main">{memberEmails.filter(e => e.trim()).length + 1} people</span> (including you)
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Success Celebration */}
          <SuccessCelebration
            show={success}
            message="Booking Confirmed!"
            subMessage="Redirecting to your bookings..."
            type="booking"
          />

          {/* Book Button */}
          <Button
            onClick={handleBook}
            disabled={!selectedSlot || loading}
            className="w-full"
            size="lg"
            variant="gradient"
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
