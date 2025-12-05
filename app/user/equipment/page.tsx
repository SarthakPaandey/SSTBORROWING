'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { CompactTimePicker } from '@/components/ui/CompactTimePicker';
import { DatePicker } from '@/components/ui/DatePicker';
import { getISTToday, getISTNow, formatISTDate } from '@/lib/timezone-client';
import { LoadingState, InlineLoading } from '@/components/ui/LoadingState';
import { Package, Sparkles, FlaskConical, Trophy, Clock, ShoppingCart, CheckCircle2, AlertTriangle, Info, Zap } from 'lucide-react';

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

export default function EquipmentPage() {
  const router = useRouter();
  const [sportsResources, setSportsResources] = useState<any[]>([]);
  const [labResources, setLabResources] = useState<any[]>([]);
  const [sportsItems, setSportsItems] = useState<any[]>([]);
  const [labItems, setLabItems] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<{ [key: string]: number }>({});
  const [tab, setTab] = useState<'sports' | 'lab'>('sports');
  // FIX: Use IST timezone for accurate date display
  const [date, setDate] = useState<Date>(getISTNow());
  const [startTime, setStartTime] = useState('09:00');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchResources();
  }, []);

  // Reset time if it becomes invalid when date changes
  useEffect(() => {
    // FIX: Use IST timezone for accurate today check
    const today = getISTToday();
    const dateStr = formatISTDate(date);
    if (dateStr === today) {
      const [hours, minutes] = startTime.split(':').map(Number);
      // FIX: Use IST time for both selectedTime and now to ensure consistent comparison
      const now = getISTNow();
      const selectedTime = new Date(now);
      selectedTime.setHours(hours, minutes, 0, 0);

      // If selected time is in the past, reset to next available time slot
      if (selectedTime < now) {
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const roundedMinutes = Math.ceil(currentMinutes / 15) * 15; // Round up to next 15-minute slot
        const nextHour = Math.floor(roundedMinutes / 60);
        const nextMinute = roundedMinutes % 60;
        const nextTime = `${nextHour.toString().padStart(2, '0')}:${nextMinute.toString().padStart(2, '0')}`;

        // Ensure it's within allowed hours (9 AM - 8 PM)
        if (nextHour >= 9 && nextHour < 20) {
          setStartTime(nextTime);
        } else if (nextHour < 9) {
          setStartTime('09:00');
        } else {
          setStartTime('09:00'); // If past 8 PM, reset to start of next day's window
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // Refetch items when date or time changes to update availability
  useEffect(() => {
    if (sportsResources.length > 0 || labResources.length > 0) {
      fetchItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, startTime]);

  const fetchResources = async () => {
    try {
      setInitialLoading(true);
      const sportsRes = await fetch('/api/resources?type=SPORTS_EQUIPMENT');
      const sportsData = await sportsRes.json();
      setSportsResources(sportsData.resources);

      const labRes = await fetch('/api/resources?type=LAB_EQUIPMENT');
      const labData = await labRes.json();
      setLabResources(labData.resources);

      // Fetch initial items after resources are loaded
      if (sportsData.resources.length > 0 || labData.resources.length > 0) {
        await fetchItems(sportsData.resources, labData.resources, false);
      }
    } catch (err) {
      console.error('Failed to fetch equipment resources:', err);
    } finally {
      setInitialLoading(false);
    }
  };

  const fetchItems = async (sportsRes = sportsResources, labRes = labResources, showLoader = true) => {
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
        setSportsItems(itemsData.items);
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
        setLabItems(itemsData.items);
      }
    } catch (err) {
      console.error('Failed to fetch equipment availability:', err);
    } finally {
      if (showLoader) setItemsLoading(false);
    }
  };

  const handleQuantityChange = (itemId: string, qty: number) => {
    setSelectedItems((prev) => ({
      ...prev,
      [itemId]: Math.max(0, qty),
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

    if (isSports && totalItemCount > 3) {
      setError('You can only borrow up to 3 sports equipment items at once');
      return;
    }

    if (isLab && totalItemCount > 1) {
      setError('You can only borrow 1 lab equipment item at a time');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // FIX: Create date in IST timezone by specifying +05:30 offset
      // This ensures the backend receives the correct IST time regardless of browser timezone
      const dateStr = formatISTDate(date);
      const start = new Date(`${dateStr}T${startTime}:00+05:30`);
      const startHour = parseInt(startTime.split(':')[0]);
      // FIX: Use IST timezone for today check
      const today = getISTToday();

      // Check if booking is in the past for today
      if (dateStr === today && start < getISTNow()) {
        setError('Pickup time must be in the future for today');
        setLoading(false);
        return;
      }

      // Equipment pickup time must be between 8am and 8pm
      if (startHour < 8) {
        setError('Equipment pickup time must be after 8:00 AM');
        setLoading(false);
        return;
      }

      // Calculate end time based on equipment type
      const end = new Date(start);
      if (isSports) {
        // Dynamic duration: min(75 minutes, time until 8 PM IST)
        // FIX: Create closing time explicitly in IST to avoid browser timezone issues
        const closingTime = new Date(`${dateStr}T20:00:00+05:30`); // 8:00 PM IST
        
        const maxEndWithDuration = new Date(start);
        maxEndWithDuration.setMinutes(maxEndWithDuration.getMinutes() + 75);
        
        // Use the earlier of: 75 min from pickup OR 8 PM IST closing
        if (maxEndWithDuration <= closingTime) {
          end.setMinutes(end.getMinutes() + 75);
        } else {
          end.setTime(closingTime.getTime());
        }
        
        // Validate minimum 15 minutes session
        const sessionMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
        if (sessionMinutes < 15) {
          setError('Minimum borrowing time is 15 minutes. Please select an earlier pickup time.');
          setLoading(false);
          return;
        }
      } else if (isLab) {
        end.setHours(end.getHours() + 24); // 24 hours for lab equipment
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
          <div className="flex items-center justify-between">
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
            <div className="flex items-center gap-2">
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
                    Available for immediate checkout • Max 3 items per booking
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Date/Time Selection */}
              <div className="p-4 rounded-xl bg-bg-dark/50 border border-card-border space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-text-main">
                  <Clock className="h-4 w-4 text-success" />
                  Select Pickup Time
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <DatePicker
                    value={date}
                    onChange={(newDate) => {
                      if (newDate instanceof Date) setDate(newDate);
                    }}
                    minDate={getISTNow()}
                    placeholder="Select a date"
                  />
                  <CompactTimePicker
                    date={`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`}
                    value={startTime}
                    onChange={setStartTime}
                    minTime="08:00"
                    maxTime="19:45"
                    stepMinutes={15}
                    label="Pickup Time"
                    durationHint={(() => {
                      const [h, m] = startTime.split(':').map(Number);
                      const pickupMinutes = h * 60 + m;
                      const closeMinutes = 20 * 60; // 8 PM = 20:00
                      const availableMinutes = Math.max(0, closeMinutes - pickupMinutes);
                      const displayMinutes = Math.min(availableMinutes, 75); // Cap at 75 min max
                      if (displayMinutes >= 60) {
                        const hrs = Math.floor(displayMinutes / 60);
                        const mins = displayMinutes % 60;
                        return `⏱️ Duration: ${hrs}h ${mins > 0 ? mins + 'm' : ''} (return by 8 PM)`;
                      }
                      return `⏱️ Duration: ${displayMinutes} min (return by 8 PM)`;
                    })()}
                  />
                </div>
              </div>

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
                        <div className="flex items-center justify-between pb-3 border-b border-card-border/30">
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
                            
                            return (
                              <div
                                key={item._id}
                                className={`flex items-center justify-between rounded-xl p-3 transition-all duration-200 ${
                                  isSelected 
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
                                        className={`h-full rounded-full transition-all ${
                                          item.availableNow === 0 ? 'bg-destructive' :
                                          item.availableNow < item.qtyTotal * 0.3 ? 'bg-warning' : 'bg-success'
                                        }`}
                                        style={{ width: `${(item.availableNow / item.qtyTotal) * 100}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-text-muted whitespace-nowrap">
                                      {item.availableNow}/{item.qtyTotal}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 ml-4">
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
                                    disabled={isOutOfStock || (selectedItems[item._id] || 0) >= item.availableNow}
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
                    Max 1 item per booking • 24-hour borrowing period
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

              {/* Date/Time Selection */}
              <div className="p-4 rounded-xl bg-bg-dark/50 border border-card-border space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-text-main">
                  <Clock className="h-4 w-4 text-accent-purple-1" />
                  Select Pickup Time
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <DatePicker
                    value={date}
                    onChange={(newDate) => {
                      if (newDate instanceof Date) setDate(newDate);
                    }}
                    minDate={getISTNow()}
                    placeholder="Select a date"
                  />
                  <CompactTimePicker
                    date={`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`}
                    value={startTime}
                    onChange={setStartTime}
                    minTime="08:00"
                    maxTime="20:00"
                    stepMinutes={30}
                    label="Pickup Time"
                    durationHint="⏱️ Duration: 24 hours"
                  />
                </div>
              </div>

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
                        className={`rounded-xl border p-4 transition-all duration-200 animate-fade-in-up ${
                          isSelected 
                            ? 'bg-accent-purple-1/10 border-accent-purple-1/30 shadow-lg shadow-accent-purple-1/10' 
                            : isOutOfStock
                            ? 'bg-bg-dark/30 opacity-60 border-card-border'
                            : 'bg-card border-card-border hover:border-accent-purple-1/30 hover:shadow-md'
                        }`}
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {isSelected && <CheckCircle2 className="h-4 w-4 text-accent-purple-1" />}
                              <span className="text-xl">🔬</span>
                              <p className="font-semibold text-text-main">{item.name}</p>
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
                                  className={`h-full rounded-full transition-all ${
                                    item.availableNow === 0 ? 'bg-destructive' :
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
                          <div className="flex items-center gap-2 ml-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleQuantityChange(item._id, (selectedItems[item._id] || 0) - 1)
                              }
                              disabled={(selectedItems[item._id] || 0) === 0}
                              className="w-10 h-10 text-lg hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                            >
                              −
                            </Button>
                            <span className={`w-10 text-center font-bold text-lg ${isSelected ? 'text-accent-purple-1' : 'text-text-main'}`}>
                              {selectedItems[item._id] || 0}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleQuantityChange(item._id, (selectedItems[item._id] || 0) + 1)
                              }
                              disabled={isOutOfStock || (selectedItems[item._id] || 0) >= item.availableNow}
                              className="w-10 h-10 text-lg hover:bg-accent-purple-1/10 hover:text-accent-purple-1 hover:border-accent-purple-1/30"
                            >
                              +
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
