'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { DatePicker } from '@/components/ui/DatePicker';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';
import { ArrowLeft, Users, X, MapPin, Clock, AlertTriangle, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { getISTToday, getISTNow } from '@/lib/timezone-client';
import { POLICIES } from '@/lib/policies';
import { Resource } from '@/types/frontend';

// Lazy load heavy components to reduce initial bundle size
const SuccessCelebration = dynamic(
  () => import('@/components/ui/SuccessCelebration').then(mod => ({ default: mod.SuccessCelebration })),
  { ssr: false }
);

const TimeRangePicker = dynamic(
  () => import('@/components/booking/TimeRangePicker'),
  {
    ssr: false,
    loading: () => (
      <div className="h-48 flex items-center justify-center bg-white/5 rounded-xl animate-pulse">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
          <p className="text-sm text-text-muted">Loading time picker...</p>
        </div>
      </div>
    )
  }
);

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
  const [sportsResourceId, setSportsResourceId] = useState<string | null>(null);
  const [sportsItems, setSportsItems] = useState<Array<{ _id: string; name: string; qtyAvailable: number; qtyTotal: number }>>([]);
  const [equipmentSelection, setEquipmentSelection] = useState<Record<string, number>>({});
  const [equipmentLoading, setEquipmentLoading] = useState(false);
  const [equipmentError, setEquipmentError] = useState('');
  const [sharedTurfSport, setSharedTurfSport] = useState<'FOOTBALL' | 'CRICKET'>('FOOTBALL');

  useEffect(() => {
    fetchResource();
  }, [params.id]);

  // Reset selected slot when date changes
  useEffect(() => {
    setSelectedSlot(null);
  }, [date]);

  const fetchResource = async () => {
    try {
      setError('');
      const res = await fetch(`/api/resources?type=FACILITY`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to fetch facility');
        return;
      }

      const found = data.resources.find((r: Resource) => r._id === params.id);
      if (!found) {
        setError('Facility not found');
        return;
      }
      setResource(found);
    } catch (err) {
      console.error('Error fetching facility:', err);
      setError('An unexpected error occurred.');
    }
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

  // Map facility name to sport category (client-safe, no mongoose)
  const getFacilitySportCategory = (name?: string | null) => {
    if (!name) return null;
    const lower = name.toLowerCase();
    if (lower.includes('table tennis')) return 'TABLE_TENNIS';
    if (lower.includes('basketball')) return 'BASKETBALL';
    if (lower.includes('volleyball')) return 'VOLLEYBALL';
    if (lower.includes('turf')) return 'FOOTBALL';
    if (lower.includes('cricket')) return 'CRICKET';
    if (lower.includes('badminton')) return 'BADMINTON';
    return null;
  };

  const facilitySport = getFacilitySportCategory(resource?.name);
  const isSharedTurf =
    resource?.sharedGroupId === POLICIES.SHARED_TURF_GROUP_ID ||
    (resource?.name?.toLowerCase() || '').includes('turf');
  const sportForEquipment = isSharedTurf ? sharedTurfSport : facilitySport;

  const recommendedEquipment: Record<string, string[]> = {
    TABLE_TENNIS: ['TT Bat (up to 4)', 'TT Ball (up to 1)'],
    BASKETBALL: ['Basketball (1)'],
    FOOTBALL: ['Football (1)'],
    CRICKET: ['Bat (up to 2)', 'Ball (1)', 'Stumps (up to 2)'],
    VOLLEYBALL: ['Volleyball (1)'],
    BADMINTON: ['Badminton Racket (up to 4)'],
  };

  const equipmentMaxBySport: Record<string, Record<string, number>> = {
    TABLE_TENNIS: { 'TT Bat': 4, 'TT Ball': 1 },
    BASKETBALL: { Basketball: 1 },
    FOOTBALL: { Football: 1 },
    CRICKET: { 'Cricket Bat': 2, 'Cricket Ball': 1, 'Cricket Stumps': 2 },
    VOLLEYBALL: { Volleyball: 1 },
    BADMINTON: { 'Badminton Racket': 4 },
  };

  // Fetch sports equipment resource once
  useEffect(() => {
    const fetchSportsResource = async () => {
      try {
        const res = await fetch('/api/resources?type=SPORTS_EQUIPMENT');
        if (!res.ok) return;
        const data = await res.json();
        const sportsRes = Array.isArray(data.resources) ? data.resources[0] : null;
        if (sportsRes?._id) {
          setSportsResourceId(sportsRes._id);
        }
      } catch (err) {
        console.error('Failed to fetch sports resource', err);
      }
    };
    fetchSportsResource();
  }, []);

  // Fetch available sports items for the selected slot and sport
  useEffect(() => {
    const sport = sportForEquipment;
    if (!sport || !sportsResourceId || !selectedSlot) {
      setSportsItems([]);
      setEquipmentSelection({});
      return;
    }

    const fetchItems = async () => {
      setEquipmentLoading(true);
      setEquipmentError('');
      try {
        const startISO = selectedSlot.start;
        const endISO = selectedSlot.end;
        const res = await fetch(
          `/api/admin/equipment?resourceId=${sportsResourceId}&start=${startISO}&end=${endISO}`
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to load equipment availability');
        }
        const allowed = equipmentMaxBySport[sportForEquipment] || {};
        const filtered =
          Array.isArray(data.items)
            ? data.items.filter((item: any) => allowed[item.name] !== undefined)
            : [];
        setSportsItems(filtered);
        setEquipmentSelection({});
      } catch (err) {
        console.error(err);
        setEquipmentError(err instanceof Error ? err.message : 'Failed to load equipment availability');
      } finally {
        setEquipmentLoading(false);
      }
    };

    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sportForEquipment, sportsResourceId, selectedSlot?.start, selectedSlot?.end]);

  const handleBook = async () => {
    if (!selectedSlot) return;

    // Validate that slot is not in the past and clamp end to 8 PM
    const today = getISTToday();
    const slotStart = new Date(selectedSlot.start);
    const slotEndRaw = new Date(selectedSlot.end);
    const now = getISTNow();
    const closing = new Date(slotStart);
    closing.setHours(20, 0, 0, 0); // 8 PM local
    const slotEnd = slotEndRaw > closing ? closing : slotEndRaw;

    if (date === today && slotStart < now) {
      setError('Cannot book a time slot in the past');
      return;
    }

    // Ensure minimum duration (15 minutes) and not zero after clamp
    const durationMinutes = (slotEnd.getTime() - slotStart.getTime()) / (1000 * 60);
    if (durationMinutes < 15) {
      setError(`Booking duration must be at least ${POLICIES.MIN_BOOKING_DURATION_MINUTES} minutes before 8:00 PM closing.`);
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
            end: slotEnd.toISOString(),
            memberEmails: validEmails,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to create group booking');
        }

        setSuccess(true);
        router.push('/user/bookings');
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
            end: slotEnd.toISOString(),
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to create booking');
        }

        // If user selected equipment, create an equipment booking for the same slot (clamped to max 75 min and 8 PM)
        const selectedItems = Object.entries(equipmentSelection)
          .filter(([_, qty]) => qty > 0)
          .map(([itemId, qty]) => ({ itemId, qty }));

        if (selectedItems.length > 0 && sportsResourceId) {
          try {
            const startDate = new Date(selectedSlot.start);
            const endDate = slotEnd;

            // Equipment borrow matches facility window, clamped to 8 PM same day
            const equipStart = new Date(startDate);
            const equipEnd = new Date(endDate);
            const closing = new Date(startDate);
            closing.setHours(20, 0, 0, 0); // 8 PM local
            if (equipEnd > closing) equipEnd.setTime(closing.getTime());

            // Ensure at least 15 minutes
            if (equipEnd <= equipStart || (equipEnd.getTime() - equipStart.getTime()) / (1000 * 60) < 15) {
              throw new Error('Equipment borrow window is too short for this slot.');
            }

            const equipRes = await fetch('/api/bookings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                resourceId: sportsResourceId,
                kind: 'EQUIPMENT',
                start: equipStart.toISOString(),
                end: equipEnd.toISOString(),
                items: selectedItems,
              }),
            });

            const equipData = await equipRes.json();
            if (!equipRes.ok) {
              throw new Error(equipData.error || 'Failed to book equipment');
            }
          } catch (equipErr) {
            console.error(equipErr);
            setError(
              `Facility booked, but equipment booking failed: ${equipErr instanceof Error ? equipErr.message : 'Unknown error'
              }`
            );
            setLoading(false);
            return;
          }
        }

        setSuccess(true);
        router.push('/user/bookings');
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

  if (error && !resource) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Link href="/user/facilities">
          <Button variant="ghost" size="sm" className="group">
            <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back to Facilities
          </Button>
        </Link>
        <ErrorDisplay
          message={error}
          onRetry={() => fetchResource()}
          backHref="/user/facilities"
          backLabel="Back to Facilities"
          className="animate-fade-in"
        />
      </div>
    );
  }

  if (!resource) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto animate-pulse">
        <div className="h-10 w-32 rounded bg-card"></div>
        <div className="rounded-2xl border border-card-border overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-accent-blue/10 to-transparent" />
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
                    Team sports require at least {POLICIES.GROUP_BOOKING_MIN_MEMBERS} participants. Invite {POLICIES.GROUP_BOOKING_MIN_MEMBERS - 1} friends below - bookings must be made at least {POLICIES.GROUP_BOOKING_CUTOFF_MINUTES} minutes in advance.
                    Friends can confirm until {POLICIES.GROUP_BOOKING_CUTOFF_MINUTES} minutes before start. Cancel early if your group can't make it.
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
                  {isTeamSport && ` (Group bookings require ${POLICIES.GROUP_BOOKING_CUTOFF_MINUTES} min advance notice)`}
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

          {/* Optional equipment prompt for sport-specific facilities */}
          {selectedSlot && sportForEquipment && recommendedEquipment[sportForEquipment] && (
            <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-accent-blue/10">
                  <Sparkles className="h-5 w-5 text-accent-blue" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-text-main">
                    Optional: add {sportForEquipment.replace('_', ' ').toLowerCase()} equipment for this slot
                  </p>
                  <p className="text-xs text-text-muted">
                    You can borrow matching equipment for this booking. It’s optional and non-blocking.
                  </p>
                  {isSharedTurf && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      {(['FOOTBALL', 'CRICKET'] as const).map((sport) => (
                        <Button
                          key={sport}
                          type="button"
                          size="sm"
                          variant={sharedTurfSport === sport ? 'default' : 'ghost'}
                          onClick={() => {
                            setSharedTurfSport(sport);
                            setEquipmentSelection({});
                          }}
                        >
                          {sport === 'FOOTBALL' ? 'Football' : 'Cricket'}
                        </Button>
                      ))}
                    </div>
                  )}
                  {equipmentLoading ? (
                    <p className="text-xs text-text-muted">Loading equipment availability...</p>
                  ) : equipmentError ? (
                    <p className="text-xs text-red-300">{equipmentError}</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2 text-xs text-text-muted">
                        {recommendedEquipment[sportForEquipment].map(item => (
                          <span key={item} className="px-2 py-1 rounded-full bg-white/5 border border-white/10">
                            {item}
                          </span>
                        ))}
                      </div>
                      <div className="space-y-2">
                        {sportsItems.map((item) => {
                          const maxAllowed = equipmentMaxBySport[sportForEquipment]?.[item.name] ?? 0;
                          const maxSelectable = Math.min(maxAllowed, item.qtyAvailable ?? 0);
                          const current = equipmentSelection[item._id] ?? 0;
                          return (
                            <div key={item._id} className="flex items-center justify-between rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                              <div className="space-y-1">
                                <p className="text-sm text-text-main">{item.name}</p>
                                <p className="text-xs text-text-muted">
                                  Available: {item.qtyAvailable ?? 0} • Max per booking: {maxAllowed}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={current <= 0}
                                  onClick={() =>
                                    setEquipmentSelection((prev) => ({
                                      ...prev,
                                      [item._id]: Math.max(0, current - 1),
                                    }))
                                  }
                                >
                                  -
                                </Button>
                                <span className="min-w-[24px] text-center text-sm">{current}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={current >= maxSelectable}
                                  onClick={() =>
                                    setEquipmentSelection((prev) => ({
                                      ...prev,
                                      [item._id]: Math.min(maxSelectable, current + 1),
                                    }))
                                  }
                                >
                                  +
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                        {sportsItems.length === 0 && (
                          <p className="text-xs text-text-muted">No matching equipment available for this time.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

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
