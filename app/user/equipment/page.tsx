'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { TimePicker } from '@/components/ui/TimePicker';
import { getISTToday, getISTNow } from '@/lib/timezone-client';

export default function EquipmentPage() {
  const router = useRouter();
  const [sportsResources, setSportsResources] = useState<any[]>([]);
  const [labResources, setLabResources] = useState<any[]>([]);
  const [sportsItems, setSportsItems] = useState<any[]>([]);
  const [labItems, setLabItems] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<{ [key: string]: number }>({});
  // FIX: Use IST timezone for accurate date display
  const [date, setDate] = useState(getISTToday());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchResources();
  }, []);

  // Reset time if it becomes invalid when date changes
  useEffect(() => {
    // FIX: Use IST timezone for accurate today check
    const today = getISTToday();
    if (date === today) {
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

  const fetchResources = async () => {
    const sportsRes = await fetch('/api/resources?type=SPORTS_EQUIPMENT');
    const sportsData = await sportsRes.json();
    setSportsResources(sportsData.resources);

    const labRes = await fetch('/api/resources?type=LAB_EQUIPMENT');
    const labData = await labRes.json();
    setLabResources(labData.resources);

    if (sportsData.resources.length > 0) {
      const itemsRes = await fetch(`/api/admin/equipment?resourceId=${sportsData.resources[0]._id}`);
      const itemsData = await itemsRes.json();
      setSportsItems(itemsData.items);
    }

    if (labData.resources.length > 0) {
      const itemsRes = await fetch(`/api/admin/equipment?resourceId=${labData.resources[0]._id}`);
      const itemsData = await itemsRes.json();
      setLabItems(itemsData.items);
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
      const start = new Date(`${date}T${startTime}:00+05:30`);
      const startHour = parseInt(startTime.split(':')[0]);
      // FIX: Use IST timezone for today check
      const today = getISTToday();

      // Check if booking is in the past for today
      if (date === today && start < getISTNow()) {
        setError('Pickup time must be in the future for today');
        setLoading(false);
        return;
      }

      // Equipment pickup time must be between 9am and 8pm (inclusive)
      // Hour 20 = 8:00 PM (should be allowed), Hour 21 = 9:00 PM (should be rejected)
      if (startHour < 9 || startHour > 20) {
        setError('Equipment pickup time must be between 9:00 AM and 8:00 PM');
        setLoading(false);
        return;
      }

      // Calculate end time based on equipment type
      const end = new Date(start);
      if (isSports) {
        end.setMinutes(end.getMinutes() + 75); // 75 minutes for sports equipment
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-accent-blue">Borrow Equipment</h1>
        <p className="text-text-muted">Select sports or lab equipment</p>
      </div>

      <Tabs defaultValue="sports">
        <TabsList className="mb-6">
          <TabsTrigger value="sports">Sports Equipment</TabsTrigger>
          <TabsTrigger value="lab">Lab Equipment</TabsTrigger>
        </TabsList>

        <TabsContent value="sports">
          <Card>
            <CardHeader>
              <CardTitle>Sports Equipment</CardTitle>
              <CardDescription>
                Available for immediate checkout • Max 3 items per booking
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {/* FIX: Use IST today for accurate minimum date */}
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  min={getISTToday()}
                  className="mb-2"
                />
                <TimePicker
                  date={date}
                  value={startTime}
                  onChange={setStartTime}
                  minTime="09:00"
                  maxTime="20:00"
                  label="Pickup Time"
                  helperText="Pickup times are from 9:00 AM to 8:00 PM. If no times shown for today, select a future date."
                />
              </div>

              <div className="space-y-2">
                {sportsItems.map((item) => (
                  <div
                    key={item._id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{item.name}</p>
                        {item.availableNow === 0 && (
                          <Badge variant="destructive">Out of Stock</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        Available: {item.availableNow}/{item.qtyTotal}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleQuantityChange(item._id, (selectedItems[item._id] || 0) - 1)
                        }
                        disabled={(selectedItems[item._id] || 0) === 0}
                      >
                        -
                      </Button>
                      <span className="w-8 text-center">{selectedItems[item._id] || 0}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleQuantityChange(item._id, (selectedItems[item._id] || 0) + 1)
                        }
                        disabled={item.availableNow === 0 || (selectedItems[item._id] || 0) >= item.availableNow}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                ))}
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
                onClick={() => handleBook(sportsResources[0]?._id, 'EQUIPMENT')}
                disabled={loading || Object.values(selectedItems).every((v) => v === 0)}
                className="w-full"
              >
                {loading ? 'Booking...' : 'Book Equipment'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lab">
          <Card>
            <CardHeader>
              <div className="space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <CardTitle className="mb-0">Lab Equipment</CardTitle>
                  <Badge variant="warning">Requires Admin Approval</Badge>
                </div>
                <CardDescription>Max 1 item per booking</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {/* FIX: Use IST today for accurate minimum date */}
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  min={getISTToday()}
                  className="mb-2"
                />
                <TimePicker
                  date={date}
                  value={startTime}
                  onChange={setStartTime}
                  minTime="09:00"
                  maxTime="20:00"
                  label="Pickup Time"
                  helperText="Pickup times are from 9:00 AM to 8:00 PM. If no times shown for today, select a future date."
                />
              </div>

              <div className="space-y-2">
                {labItems.map((item) => (
                  <div
                    key={item._id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{item.name}</p>
                        {item.availableNow === 0 && (
                          <Badge variant="destructive">Out of Stock</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        Available: {item.availableNow}/{item.qtyTotal}
                      </p>
                      {item.restricted && <Badge variant="destructive" className="mt-1">Restricted</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleQuantityChange(item._id, (selectedItems[item._id] || 0) - 1)
                        }
                        disabled={(selectedItems[item._id] || 0) === 0}
                      >
                        -
                      </Button>
                      <span className="w-8 text-center">{selectedItems[item._id] || 0}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleQuantityChange(item._id, (selectedItems[item._id] || 0) + 1)
                        }
                        disabled={item.availableNow === 0 || (selectedItems[item._id] || 0) >= item.availableNow}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {success && (
                <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">
                  Booking request submitted! Awaiting approval...
                </div>
              )}

              <Button
                onClick={() => handleBook(labResources[0]?._id, 'EQUIPMENT')}
                disabled={loading || Object.values(selectedItems).every((v) => v === 0)}
                className="w-full"
              >
                {loading ? 'Submitting...' : 'Request Lab Equipment'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
