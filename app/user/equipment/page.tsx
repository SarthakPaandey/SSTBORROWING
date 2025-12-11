'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { CompactTimePicker } from '@/components/ui/CompactTimePicker';
import { DatePicker } from '@/components/ui/DatePicker';
import { getISTToday, getISTNow, formatISTDate } from '@/lib/timezone-client';
import { LoadingState, InlineLoading } from '@/components/ui/LoadingState';
import { triggerBookingSuccess } from '@/lib/confetti';
import { Package, Sparkles, FlaskConical, Trophy, Clock, ShoppingCart, CheckCircle2, AlertTriangle, Info, Zap } from 'lucide-react';
import { POLICIES } from '@/lib/policies';
import { getMaxQuantityForItem } from '@/lib/sportEquipmentKits';

// Enhanced sport icons with more detail
const sportIcons: Record<string, string> = {
  CRICKET: '🏏',
  BADMINTON: '🏸',
  TABLE_TENNIS: '🏓',
  BASKETBALL: '🏀',
  FOOTBALL: '⚽',
  VOLLEYBALL: '🏐',
  TENNIS: '🎾',
  GENERAL: '🎯',
};

const sportNames: Record<string, string> = {
  CRICKET: 'Cricket',
  BADMINTON: 'Badminton',
  TABLE_TENNIS: 'Table Tennis',
  BASKETBALL: 'Basketball',
  FOOTBALL: 'Football',
  VOLLEYBALL: 'Volleyball',
  TENNIS: 'Tennis',
  GENERAL: 'General',
};

const sportColors: Record<string, { gradient: string; border: string; bg: string }> = {
  CRICKET: { gradient: 'from-green-500/20 to-emerald-600/10', border: 'border-green-500/30', bg: 'bg-green-500/10' },
  BADMINTON: { gradient: 'from-blue-500/20 to-cyan-600/10', border: 'border-blue-500/30', bg: 'bg-blue-500/10' },
  TABLE_TENNIS: { gradient: 'from-orange-500/20 to-amber-600/10', border: 'border-orange-500/30', bg: 'bg-orange-500/10' },
  BASKETBALL: { gradient: 'from-amber-500/20 to-yellow-600/10', border: 'border-amber-500/30', bg: 'bg-amber-500/10' },
  FOOTBALL: { gradient: 'from-emerald-500/20 to-teal-600/10', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' },
  VOLLEYBALL: { gradient: 'from-purple-500/20 to-violet-600/10', border: 'border-purple-500/30', bg: 'bg-purple-500/10' },
  TENNIS: { gradient: 'from-lime-500/20 to-green-600/10', border: 'border-lime-500/30', bg: 'bg-lime-500/10' },
  GENERAL: { gradient: 'from-gray-500/20 to-slate-600/10', border: 'border-gray-500/30', bg: 'bg-gray-500/10' },
};

const getItemMaxSelectable = (item: any): number => {
  const sportCategory = item?.sportCategory || 'GENERAL';
  const policyMax = getMaxQuantityForItem(item?.name || '', sportCategory);
  const available = item?.availableNow ?? 0;
  return Math.max(0, Math.min(policyMax, available));
};

const getSelectedSportCategory = (
  selected: Record<string, number>,
  sportsItems: any[]
): string | null => {
  const categories = new Set<string>();
  for (const item of sportsItems) {
    const qty = selected[item._id] || 0;
    if (qty > 0) {
      categories.add(item.sportCategory || 'GENERAL');
    }
  }
  if (categories.size === 0) return null;
  if (categories.size === 1) return Array.from(categories)[0];
  return 'MIXED';
};

export default function EquipmentPage() {
  const router = useRouter();
  const [sportsResources, setSportsResources] = useState<any[]>([]);
  const [labResources, setLabResources] = useState<any[]>([]);
  const [sportsItems, setSportsItems] = useState<any[]>([]);
  const [labItems, setLabItems] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<{ [key: string]: number }>({});
  const [tab, setTab] = useState<'sports' | 'lab'>('sports');
  // Use IST timezone for accurate date display; startTime only used for Lab tab
  const [date, setDate] = useState<Date>(getISTNow());
  const [startTime, setStartTime] = useState('09:00');
  const [labDurationDays, setLabDurationDays] = useState(1); // 1-7 days for lab equipment
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const fetchRequestId = useRef(0);
  const equipmentThought = useMemo(() => {
    const quotes = [
      { text: 'The harder you work, the luckier you get.', author: 'Gary Player' },
      { text: 'It always seems impossible until it’s done.', author: 'Nelson Mandela' },
      { text: 'Practice beats talent when talent doesn’t practice.', author: 'Unknown' },
      { text: 'Somewhere, something incredible is waiting to be known.', author: 'Carl Sagan' },
      { text: 'Imagination is more important than knowledge.', author: 'Albert Einstein' },
      { text: 'Champions keep playing until they get it right.', author: 'Billie Jean King' },
      { text: 'In science, we don’t make predictions, we try to explain.', author: 'Steven Weinberg' },
    ];
    return quotes[Math.floor(Math.random() * quotes.length)];
  }, []);

  useEffect(() => {
    fetchResources();
  }, []);

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/f414a5f8-0119-4df2-8bf1-d8bbc7364ecd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'lab-duration-pre-fix',
        hypothesisId: 'H1',
        location: 'equipment/page.tsx:tabEffect',
        message: 'Tab changed',
        data: { tab },
        timestamp: Date.now(),
      }),
    }).catch(() => { });
  }, [tab]);
  // #endregion

  // For Lab tab only, ensure startTime is not in the past if the date is today
  useEffect(() => {
    if (tab !== 'lab') return;
    const today = getISTToday();
    const dateStr = formatISTDate(date);
    if (dateStr === today) {
      const [hours, minutes] = startTime.split(':').map(Number);
      const now = getISTNow();
      const selectedTime = new Date(now);
      selectedTime.setHours(hours, minutes, 0, 0);

      if (selectedTime < now) {
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const roundedMinutes = Math.ceil(currentMinutes / 15) * 15;
        const nextHour = Math.floor(roundedMinutes / 60);
        const nextMinute = roundedMinutes % 60;
        const nextTime = `${nextHour.toString().padStart(2, '0')}:${nextMinute.toString().padStart(2, '0')}`;

        if (nextHour >= 9 && nextHour < 20) {
          setStartTime(nextTime);
        } else if (nextHour < 9) {
          setStartTime('09:00');
        } else {
          setStartTime('09:00');
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, tab]);

  // #region agent log
  useEffect(() => {
    const now = getISTNow();
    fetch('http://127.0.0.1:7242/ingest/f414a5f8-0119-4df2-8bf1-d8bbc7364ecd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'lab-duration-pre-fix',
        hypothesisId: 'H2',
        location: 'equipment/page.tsx:labDurationRender',
        message: 'Lab render state',
        data: { tab, labDurationDays, startTime, date: formatISTDate(date), now: now.toISOString() },
        timestamp: Date.now(),
      }),
    }).catch(() => { });
  }, [tab, labDurationDays, startTime, date]);
  // #endregion

  // Refetch items when date or time changes to update availability
  useEffect(() => {
    if (sportsResources.length > 0 || labResources.length > 0) {
      fetchItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, startTime]);

  const fetchResources = async () => {
    const handleUnauthorized = () => {
      setError('Your session has expired or you do not have access. Please log in again.');
      // Force sign-out to clear any stale/invalid session and redirect to login
      signOut({ callbackUrl: '/login' });
    };

    const parseResponse = async (res: Response, label: string) => {
      if (res.status === 401 || res.status === 403) {
        // Try to surface the server message for easier debugging
        const body = await res.json().catch(() => ({}));
        console.warn(`${label} request unauthorized`, body?.error || body);
        handleUnauthorized();
        return null;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to fetch ${label}`);
      }
      return res.json();
    };

    try {
      setInitialLoading(true);
      const sportsData = await parseResponse(
        await fetch('/api/resources?type=SPORTS_EQUIPMENT', { credentials: 'include' }),
        'sports resources'
      );
      if (!sportsData) return;

      const labData = await parseResponse(
        await fetch('/api/resources?type=LAB_EQUIPMENT', { credentials: 'include' }),
        'lab resources'
      );
      if (!labData) return;

      const sportsList = Array.isArray(sportsData.resources) ? sportsData.resources : [];
      const labList = Array.isArray(labData.resources) ? labData.resources : [];

      setSportsResources(sportsList);
      setLabResources(labList);

      // Fetch initial items after resources are loaded
      if (sportsList.length > 0 || labList.length > 0) {
        await fetchItems(sportsList, labList, false);
      }
    } catch (err) {
      console.error('Failed to fetch equipment resources:', err);
      setError(err instanceof Error ? err.message : 'Failed to load equipment resources.');
    } finally {
      setInitialLoading(false);
    }
  };

  const fetchItems = async (sportsRes = sportsResources, labRes = labResources, showLoader = true) => {
    const requestId = ++fetchRequestId.current;
    if (showLoader) setItemsLoading(true);
    // Build time window for availability check
    const dateStr = formatISTDate(date);
    const start = new Date(`${dateStr}T${startTime}:00+05:30`);
    const end = new Date(start);

    // Dynamic duration: min(75 minutes, time until 8 PM IST closing)
    // FIX: Create closing time explicitly in IST to avoid browser timezone issues
    const closingTime = new Date(`${dateStr}T20:00:00+05:30`); // 8:00 PM IST

    const maxEndWithDuration = new Date(start);
    maxEndWithDuration.setMinutes(maxEndWithDuration.getMinutes() + 75);

    if (maxEndWithDuration <= closingTime) {
      end.setMinutes(end.getMinutes() + 75);
    } else {
      end.setTime(closingTime.getTime());
    }

    const startISO = start.toISOString();
    const endISO = end.toISOString();

    try {
      if (sportsRes.length > 0) {
        const itemsRes = await fetch(
          `/api/admin/equipment?resourceId=${sportsRes[0]._id}&start=${startISO}&end=${endISO}`
        );
        const itemsData = await itemsRes.json();
        if (requestId === fetchRequestId.current) {
          setSportsItems(itemsData.items);
        }
      }

      if (labRes.length > 0) {
        // Lab equipment has 24-hour duration
        const labEnd = new Date(start);
        labEnd.setHours(labEnd.getHours() + 24);
        const labEndISO = labEnd.toISOString();

        const itemsRes = await fetch(
          `/api/admin/equipment?resourceId=${labRes[0]._id}&start=${startISO}&end=${labEndISO}`
        );
        const itemsData = await itemsRes.json();
        if (requestId === fetchRequestId.current) {
          setLabItems(itemsData.items);
        }
      }
    } catch (err) {
      console.error('Failed to fetch equipment availability:', err);
    } finally {
      if (showLoader && requestId === fetchRequestId.current) {
        setItemsLoading(false);
      }
    }
  };

  const handleQuantityChange = (itemId: string, qty: number) => {
    const item = [...sportsItems, ...labItems].find((i) => i._id === itemId);
    const maxSelectable = item ? getItemMaxSelectable(item) : undefined;
    let nextQty = maxSelectable !== undefined ? Math.min(Math.max(0, qty), maxSelectable) : Math.max(0, qty);

    // Enforce single-sport rule in UI: once a sport is selected, block others
    if (tab === 'sports' && item) {
      const selectedCategory = getSelectedSportCategory(selectedItems, sportsItems);
      const itemCategory = item.sportCategory || 'GENERAL';

      if (selectedCategory && selectedCategory !== 'GENERAL' && itemCategory !== selectedCategory) {
        setError('You can only borrow one sport at a time. Clear other selections to switch sports.');
        return;
      }

      if (selectedCategory === 'GENERAL' && itemCategory !== 'GENERAL') {
        setError('You can only borrow one sport at a time. Clear general items to pick a sport.');
        return;
      }

      // Clear stale error when change is valid
      setError('');
    }

    // Enforce single-item rule for lab equipment
    // Only one lab item can be borrowed at a time
    if (tab === 'lab' && item && nextQty > 0) {
      // Check if there's already a different item selected
      const currentlySelectedId = Object.keys(selectedItems).find(id => selectedItems[id] > 0);
      if (currentlySelectedId && currentlySelectedId !== itemId) {
        // Replace the selection - clear old and add new
        setSelectedItems({ [itemId]: Math.min(1, nextQty) });
        setError('');
        return;
      }
      // Lab items can only have qty of 1
      nextQty = Math.min(1, nextQty);
    }

    setSelectedItems((prev) => ({
      ...prev,
      [itemId]: nextQty,
    }));
  };

  const handleBook = async (resourceId: string, kind: string) => {
    const items = Object.entries(selectedItems)
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, qty]) => ({ itemId, qty }));

    if (items.length === 0) {
      setError('Please select at least one item');
      return;
    }

    // Check item limits
    const totalItemCount = items.reduce((sum, item) => sum + item.qty, 0);
    const isSports = kind === 'EQUIPMENT' && sportsResources.some(r => r._id === resourceId);
    const isLab = kind === 'EQUIPMENT' && labResources.some(r => r._id === resourceId);

    if (isSports) {
      const selectedCategory = getSelectedSportCategory(selectedItems, sportsItems);
      if (selectedCategory === 'MIXED') {
        setError('You can only borrow one sport at a time.');
        return;
      }

      // If a specific sport is chosen, allow exceeding 3; otherwise cap GENERAL to 3
      const hasSpecificSport = selectedCategory && selectedCategory !== 'GENERAL';
      if (!hasSpecificSport && totalItemCount > 3) {
        setError('You can only borrow up to 3 sports equipment items at once.');
        return;
      }
    }

    if (isLab && totalItemCount > 1) {
      setError('You can only borrow 1 lab equipment item at a time');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let start: Date;
      let end: Date;

      if (isSports) {
        // Instant pickup for sports: start now, end = min(start+120min, 8 PM today)
        const now = getISTNow();
        start = new Date(now);
        const closingTime = new Date(`${formatISTDate(now)}T20:00:00+05:30`);
        end = new Date(start);
        end.setMinutes(end.getMinutes() + POLICIES.MAX_BOOKING_DURATION_MINUTES); // 120 minutes cap
        if (end > closingTime) {
          end = closingTime;
        }

        const sessionMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
        if (sessionMinutes < 15) {
          setError('No pickup window available before 8:00 PM.');
          setLoading(false);
          return;
        }

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/f414a5f8-0119-4df2-8bf1-d8bbc7364ecd', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: 'debug-session',
            runId: 'sports-duration-dynamic',
            hypothesisId: 'H3',
            location: 'equipment/page.tsx:handleBook-sports',
            message: 'Sports booking window',
            data: { start: start.toISOString(), end: end.toISOString(), sessionMinutes },
            timestamp: Date.now(),
          }),
        }).catch(() => { });
        // #endregion
      } else {
        // Lab flow: dynamic duration based on item category
        start = getISTNow();
        end = new Date(start);

        // Get the selected lab item to check its category
        const selectedItemId = Object.keys(selectedItems).find(id => selectedItems[id] > 0);
        const selectedLabItem = labItems.find((item: any) => item._id === selectedItemId);
        const labCategory = selectedLabItem?.labCategory || 'GENERAL';

        if (labCategory === 'SAME_DAY_RETURN') {
          // VR Headsets and Monitors: Return by 8 PM today
          const dateStr = formatISTDate(start);
          end = new Date(`${dateStr}T20:00:00+05:30`); // 8 PM IST

          // Check if it's already past 8 PM
          if (end <= start) {
            setError('It is too late to borrow same-day return items. They must be returned by 8:00 PM.');
            setLoading(false);
            return;
          }
        } else if (labCategory === 'LAPTOP') {
          // Laptops: Up to 60 days (2 months)
          const days = Math.max(1, Math.min(60, labDurationDays));
          end.setDate(end.getDate() + days);
        } else {
          // GENERAL: 1-7 days
          const days = Math.max(1, Math.min(7, labDurationDays));
          end.setDate(end.getDate() + days);
        }
      }

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceId,
          kind: 'EQUIPMENT',
          start: start.toISOString(),
          end: end.toISOString(),
          items,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Handle validation errors with details
        if (data.details) {
          const fieldErrors = data.details.fieldErrors;
          const formErrors = data.details.formErrors;
          const errorMessages = [];

          if (fieldErrors) {
            Object.entries(fieldErrors).forEach(([field, errors]) => {
              if (Array.isArray(errors) && errors.length > 0) {
                errorMessages.push(`${field}: ${errors.join(', ')}`);
              }
            });
          }

          if (formErrors && formErrors.length > 0) {
            errorMessages.push(...formErrors);
          }

          throw new Error(errorMessages.length > 0 ? errorMessages.join('; ') : data.error);
        }
        throw new Error(data.error || 'Failed to create booking');
      }

      setSuccess(true);
      triggerBookingSuccess();
      setTimeout(() => router.push('/user/bookings'), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Calculate total selected items
  const totalSelected = Object.values(selectedItems).reduce((sum, qty) => sum + qty, 0);

  if (initialLoading) {
    return (
      <LoadingState
        title="Loading equipment"
        subtitle="Fetching available sports and lab inventory..."
        thought={equipmentThought.text}
        thoughtAuthor={equipmentThought.author}
        variant="galaxy"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-success/20 via-emerald-500/10 to-transparent p-6 border border-success/20">
        {/* Background decorations */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-success/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        {/* Floating equipment icons */}
        <div className="absolute top-4 right-8 text-4xl opacity-20 animate-float">🏸</div>
        <div className="absolute bottom-4 right-24 text-3xl opacity-20 animate-float" style={{ animationDelay: '1s' }}>🏀</div>
        <div className="absolute top-12 right-32 text-2xl opacity-20 animate-float" style={{ animationDelay: '2s' }}>🏏</div>

        <div className="relative flex items-center gap-4">
          <div className="relative">
            {/* Animated glow ring */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-success to-emerald-500 blur-xl opacity-40 animate-pulse" />
            <div className="relative p-4 rounded-2xl bg-gradient-to-br from-success/20 to-emerald-500/10 border border-success/30 backdrop-blur-sm flex items-center justify-center animate-float">
              <span className="text-4xl drop-shadow-lg">🎾</span>
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-text-main">
              Borrow Equipment
            </h1>
            <p className="text-text-muted">
              Select sports or lab equipment to borrow
            </p>
          </div>
        </div>
      </div>

      {/* Cart Summary (if items selected) */}
      {totalSelected > 0 && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-success/10 to-emerald-500/10 border border-success/30 animate-fade-in-up">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/20">
                <ShoppingCart className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="font-medium text-text-main">
                  {totalSelected} item{totalSelected !== 1 ? 's' : ''} selected
                </p>
                <p className="text-xs text-text-muted">Ready to book</p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full justify-between sm:w-auto sm:justify-end">
              {Object.entries(selectedItems)
                .filter(([_, qty]) => qty > 0)
                .slice(0, 3)
                .map(([itemId, qty]) => {
                  const item = [...sportsItems, ...labItems].find(i => i._id === itemId);
                  return item ? (
                    <Badge key={itemId} variant="secondary" className="text-xs">
                      {item.name} ×{qty}
                    </Badge>
                  ) : null;
                })}
              {Object.entries(selectedItems).filter(([_, qty]) => qty > 0).length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{Object.entries(selectedItems).filter(([_, qty]) => qty > 0).length - 3} more
                </Badge>
              )}
            </div>
          </div>
        </div>
      )}

      {itemsLoading && (
        <div className="flex items-center gap-3 rounded-xl border border-card-border bg-bg-dark/70 px-4 py-3">
          <InlineLoading text="Updating availability for your selected time..." />
        </div>
      )}

      <Tabs
        value={tab}
        className="animate-fade-in"
        onValueChange={(value) => {
          setTab(value as 'sports' | 'lab'); // Keep Tabs state in sync so switching works
          // Clear selected items when switching between tabs to avoid confusion
          setSelectedItems({});
          setError('');
          setSuccess(false); // Also clear success banner so it doesn't appear on other tabs
        }}
      >
        <TabsList className="mb-6">
          <TabsTrigger value="sports" icon={<Trophy className="h-4 w-4" />}>
            Sports Equipment
          </TabsTrigger>
          <TabsTrigger value="lab" icon={<FlaskConical className="h-4 w-4" />}>
            Lab Equipment
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sports" className="animate-fade-in-up">
          <Card className="border-success/20 bg-gradient-to-br from-success/5 to-transparent">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-success/10">
                  <Trophy className="h-6 w-6 text-success" />
                </div>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    🏆 Sports Equipment
                    <Badge variant="success" className="text-xs">Instant Checkout</Badge>
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <Zap className="h-3 w-3" />
                    One sport at a time • Can exceed 3 if same sport
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Sports: instant pickup, no time selection */}
              <div className="p-4 rounded-xl bg-bg-dark/50 border border-card-border space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-text-main">
                  <Clock className="h-4 w-4 text-success" />
                  Instant pickup
                </div>
                <p className="text-xs text-text-muted">
                  Starts now. Return by 8:00 PM today.
                </p>
              </div>

              {/* Lab duration selector - only show on Lab tab */}
              {tab === 'lab' && (
                <div className="rounded-xl border border-card-border/40 bg-card/60 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-accent-blue" />
                    <p className="text-sm font-semibold text-text-main">Lab borrow duration</p>
                  </div>
                  <p className="text-xs text-text-muted">
                    Choose how many days to keep lab equipment (min 1 day, max 7 days). Lab items require admin approval.
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={7}
                      value={labDurationDays}
                      onChange={(e) => setLabDurationDays(Math.max(1, Math.min(7, Number(e.target.value) || 1)))}
                      className="w-24"
                    />
                    <span className="text-sm text-text-muted">day(s)</span>
                  </div>
                </div>
              )}

              {/* Sport Category Groups - Enhanced */}
              <div className="space-y-4">
                {(() => {
                  // Group items
                  const grouped = sportsItems.reduce((acc: Record<string, any[]>, item) => {
                    const category = item.sportCategory || 'GENERAL';
                    if (!acc[category]) acc[category] = [];
                    acc[category].push(item);
                    return acc;
                  }, {});

                  const categoryOrder = ['CRICKET', 'BADMINTON', 'BASKETBALL', 'FOOTBALL', 'TABLE_TENNIS', 'VOLLEYBALL', 'TENNIS', 'GENERAL'];

                  return categoryOrder.map((category, catIndex) => {
                    const items = grouped[category];
                    if (!items || items.length === 0) return null;

                    const colors = sportColors[category] || sportColors.GENERAL;
                    const availableCount = items.filter((i: any) => i.availableNow > 0).length;

                    return (
                      <div
                        key={category}
                        className={`rounded-2xl border ${colors.border} bg-gradient-to-br ${colors.gradient} p-4 space-y-3 animate-fade-in-up hover:shadow-lg transition-all duration-300`}
                        style={{ animationDelay: `${catIndex * 50}ms` }}
                      >
                        {/* Category Header */}
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-card-border/30">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl hover:scale-125 transition-transform cursor-default">
                              {sportIcons[category]}
                            </span>
                            <div>
                              <h3 className="font-bold text-text-main text-lg">{sportNames[category]}</h3>
                              <p className="text-xs text-text-muted">
                                {availableCount}/{items.length} items available
                              </p>
                            </div>
                          </div>
                          <Badge className={`${colors.bg} text-xs`}>
                            {items.length} {items.length === 1 ? 'item' : 'items'}
                          </Badge>
                        </div>

                        {/* Items */}
                        <div className="space-y-2">
                          {items.map((item: any, itemIndex: number) => {
                            const isSelected = (selectedItems[item._id] || 0) > 0;
                            const isOutOfStock = item.availableNow === 0;
                            const itemMaxPerPolicy = getMaxQuantityForItem(item.name, item.sportCategory || 'GENERAL');
                            const maxSelectable = Math.min(item.availableNow ?? 0, itemMaxPerPolicy);
                            const plusDisabled =
                              isOutOfStock ||
                              (selectedItems[item._id] || 0) >= maxSelectable;

                            return (
                              <div
                                key={item._id}
                                className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl p-3 transition-all duration-200 ${isSelected
                                  ? 'bg-success/10 border border-success/30 shadow-sm'
                                  : isOutOfStock
                                    ? 'bg-bg-dark/30 opacity-60'
                                    : 'bg-card/50 hover:bg-card border border-transparent hover:border-card-border'
                                  }`}
                                style={{ animationDelay: `${itemIndex * 30}ms` }}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    {isSelected && <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />}
                                    <p className="font-medium text-text-main truncate">{item.name}</p>
                                    {isOutOfStock && (
                                      <Badge variant="destructive" className="text-xs flex-shrink-0">
                                        ❌ Out
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <div className="flex-1 h-1.5 bg-bg-dark rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full transition-all ${item.availableNow === 0 ? 'bg-destructive' :
                                          item.availableNow < item.qtyTotal * 0.3 ? 'bg-warning' : 'bg-success'
                                          }`}
                                        style={{ width: `${(item.availableNow / item.qtyTotal) * 100}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-text-muted whitespace-nowrap">
                                      {item.availableNow}/{item.qtyTotal} • Max per booking: {itemMaxPerPolicy}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 w-full justify-between sm:w-auto sm:justify-end sm:gap-2 sm:ml-4">
                                  <button
                                    onClick={() => handleQuantityChange(item._id, (selectedItems[item._id] || 0) - 1)}
                                    disabled={(selectedItems[item._id] || 0) === 0}
                                    className="w-9 h-9 rounded-xl bg-bg-dark border border-card-border flex items-center justify-center hover:bg-card hover:border-destructive/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-lg font-medium text-text-main hover:text-destructive"
                                  >
                                    −
                                  </button>
                                  <span className={`w-10 text-center font-bold text-lg ${isSelected ? 'text-success' : 'text-text-main'}`}>
                                    {selectedItems[item._id] || 0}
                                  </span>
                                  <button
                                    onClick={() => handleQuantityChange(item._id, (selectedItems[item._id] || 0) + 1)}
                                    disabled={plusDisabled}
                                    className="w-9 h-9 rounded-xl bg-success/10 border border-success/30 flex items-center justify-center hover:bg-success/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-lg font-medium text-success"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Error/Success Messages - Enhanced */}
              {error && (
                <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-4 flex items-start gap-3 animate-shake">
                  <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive">Booking Error</p>
                    <p className="text-sm text-destructive/80">{error}</p>
                  </div>
                </div>
              )}

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
                onClick={() => handleBook(sportsResources[0]?._id, 'EQUIPMENT')}
                disabled={loading || Object.values(selectedItems).every((v) => v === 0)}
                className="w-full h-12 text-lg font-semibold group relative overflow-hidden"
                variant={Object.values(selectedItems).some((v) => v > 0) ? 'default' : 'outline'}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">⏳</span>
                    Booking...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Package className="h-5 w-5 group-hover:scale-110 transition-transform" />
                    {Object.values(selectedItems).some((v) => v > 0)
                      ? `Book ${totalSelected} Item${totalSelected !== 1 ? 's' : ''}`
                      : 'Select Items to Book'
                    }
                  </span>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lab" className="animate-fade-in-up">
          <Card className="border-accent-purple-1/20 bg-gradient-to-br from-accent-purple-1/5 to-transparent">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-accent-purple-1/10">
                  <FlaskConical className="h-6 w-6 text-accent-purple-1" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <CardTitle className="flex items-center gap-2">
                      🔬 Lab Equipment
                    </CardTitle>
                    <Badge variant="warning" className="animate-pulse-subtle">
                      ⏳ Requires Approval
                    </Badge>
                  </div>
                  <CardDescription className="mt-1">
                    Max 1 item • Laptops: up to 2 months • VR/Monitors: same-day return
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Info Banner */}
              <div className="p-4 rounded-xl bg-accent-purple-1/10 border border-accent-purple-1/20 flex items-start gap-3">
                <Info className="h-5 w-5 text-accent-purple-1 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-text-main">Approval Required</p>
                  <p className="text-sm text-text-muted">
                    Lab equipment requests need admin approval. You&apos;ll receive a notification once approved.
                  </p>
                </div>
              </div>

              {/* Lab borrow duration - only show when an item is selected */}
              {(() => {
                // Get the currently selected lab item to determine duration settings
                const selectedItemId = Object.keys(selectedItems).find(id => selectedItems[id] > 0);
                const selectedLabItem = labItems.find((item: any) => item._id === selectedItemId);

                // Don't show duration section until an item is selected
                if (!selectedLabItem) {
                  return null;
                }

                const labCategory = selectedLabItem?.labCategory || 'GENERAL';

                if (labCategory === 'SAME_DAY_RETURN') {
                  // VR Headsets and Monitors - same day return
                  return (
                    <div className="p-4 rounded-xl bg-warning/10 border border-warning/30 space-y-2 animate-fade-in-up">
                      <div className="flex items-center gap-2 text-sm font-medium text-warning">
                        <Clock className="h-4 w-4" />
                        Same-Day Return Required
                      </div>
                      <p className="text-sm text-text-muted">
                        <strong>{selectedLabItem?.name}</strong> must be returned by <span className="text-warning font-semibold">8:00 PM today</span>.
                        VR Headsets and Monitors cannot be borrowed overnight.
                      </p>
                    </div>
                  );
                }

                // LAPTOP or GENERAL - show duration picker
                const maxDays = labCategory === 'LAPTOP' ? 60 : 7;

                return (
                  <div className="p-4 rounded-xl bg-bg-dark/50 border border-card-border space-y-4 animate-fade-in-up">
                    <div className="flex items-center gap-2 text-sm font-medium text-text-main">
                      <Clock className="h-4 w-4 text-accent-purple-1" />
                      Borrow Duration for <span className="text-accent-purple-1">{selectedLabItem?.name}</span>
                      {labCategory === 'LAPTOP' && (
                        <Badge variant="secondary" className="text-xs">💻 Up to 2 months</Badge>
                      )}
                    </div>
                    <p className="text-xs text-text-muted">
                      {labCategory === 'LAPTOP'
                        ? 'Laptops can be borrowed for up to 2 months (60 days).'
                        : 'Choose how many days to keep this equipment (min 1 day, max 7 days).'
                      } Requests need admin approval.
                    </p>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={maxDays}
                        value={labDurationDays}
                        onChange={(e) => setLabDurationDays(Math.max(1, Math.min(maxDays, Number(e.target.value) || 1)))}
                        className="w-24"
                      />
                      <span className="text-sm text-text-muted">day(s) • max {maxDays}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Lab Items - Enhanced */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-text-muted flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Available Equipment
                </h3>
                {labItems.length === 0 ? (
                  <div className="text-center py-8 text-text-muted">
                    <span className="text-4xl mb-2 block">🔬</span>
                    <p>No lab equipment available</p>
                  </div>
                ) : (
                  labItems.map((item, index) => {
                    const isSelected = (selectedItems[item._id] || 0) > 0;
                    const isOutOfStock = item.availableNow === 0;

                    return (
                      <div
                        key={item._id}
                        className={`rounded-xl border p-4 transition-all duration-200 animate-fade-in-up ${isSelected
                          ? 'bg-accent-purple-1/10 border-accent-purple-1/30 shadow-lg shadow-accent-purple-1/10'
                          : isOutOfStock
                            ? 'bg-bg-dark/30 opacity-60 border-card-border'
                            : 'bg-card border-card-border hover:border-accent-purple-1/30 hover:shadow-md'
                          }`}
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {isSelected && <CheckCircle2 className="h-4 w-4 text-accent-purple-1" />}
                              <span className="text-xl">
                                {item.labCategory === 'LAPTOP' ? '💻' :
                                  item.labCategory === 'SAME_DAY_RETURN' ? '🎮' : '🔬'}
                              </span>
                              <p className="font-semibold text-text-main">{item.name}</p>
                              {/* Category-specific badges */}
                              {item.labCategory === 'LAPTOP' && (
                                <Badge variant="secondary" className="text-xs bg-blue-500/20 text-blue-400">
                                  📅 Up to 60 days
                                </Badge>
                              )}
                              {item.labCategory === 'SAME_DAY_RETURN' && (
                                <Badge variant="warning" className="text-xs">
                                  ⏰ Return by 8 PM
                                </Badge>
                              )}
                              {(!item.labCategory || item.labCategory === 'GENERAL') && (
                                <Badge variant="secondary" className="text-xs">
                                  1-7 days
                                </Badge>
                              )}
                              {isOutOfStock && (
                                <Badge variant="destructive">❌ Out of Stock</Badge>
                              )}
                              {item.restricted && (
                                <Badge variant="destructive" className="text-xs">
                                  🔒 Restricted
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                              <div className="flex-1 max-w-[200px] h-2 bg-bg-dark rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${item.availableNow === 0 ? 'bg-destructive' :
                                    item.availableNow < item.qtyTotal * 0.3 ? 'bg-warning' : 'bg-accent-purple-1'
                                    }`}
                                  style={{ width: `${(item.availableNow / item.qtyTotal) * 100}%` }}
                                />
                              </div>
                              <span className="text-sm text-text-muted">
                                {item.availableNow}/{item.qtyTotal} available
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 w-full justify-between sm:w-auto sm:justify-end sm:ml-4">
                            <Button
                              variant={isSelected ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleQuantityChange(item._id, isSelected ? 0 : 1)}
                              disabled={isOutOfStock && !isSelected}
                              className={`min-w-[100px] transition-all ${isSelected
                                  ? 'bg-accent-purple-1 hover:bg-accent-purple-1/90 text-white'
                                  : 'hover:border-accent-purple-1/30 hover:text-accent-purple-1'
                                }`}
                            >
                              {isSelected ? (
                                <span className="flex items-center gap-1">
                                  <CheckCircle2 className="h-4 w-4" />
                                  Selected
                                </span>
                              ) : 'Select'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Error/Success Messages */}
              {error && (
                <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-4 flex items-start gap-3 animate-shake">
                  <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive">Request Error</p>
                    <p className="text-sm text-destructive/80">{error}</p>
                  </div>
                </div>
              )}

              {success && (
                <div className="rounded-xl bg-success/10 border border-success/30 p-4 flex items-start gap-3 animate-success-pop">
                  <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-success">📨 Request Submitted!</p>
                    <p className="text-sm text-success/80">Awaiting admin approval...</p>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <Button
                onClick={() => handleBook(labResources[0]?._id, 'EQUIPMENT')}
                disabled={loading || Object.values(selectedItems).every((v) => v === 0)}
                className="w-full h-12 text-lg font-semibold group bg-gradient-to-r from-accent-purple-1 to-pink-500 hover:from-accent-purple-1/90 hover:to-pink-500/90"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">⏳</span>
                    Submitting Request...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <FlaskConical className="h-5 w-5 group-hover:scale-110 transition-transform" />
                    Request Lab Equipment
                  </span>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
