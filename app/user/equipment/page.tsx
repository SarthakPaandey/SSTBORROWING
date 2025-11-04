'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';

export default function EquipmentPage() {
  const router = useRouter();
  const [sportsResources, setSportsResources] = useState<any[]>([]);
  const [labResources, setLabResources] = useState<any[]>([]);
  const [sportsItems, setSportsItems] = useState<any[]>([]);
  const [labItems, setLabItems] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<{ [key: string]: number }>({});
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('09:00');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchResources();
  }, []);

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

    setLoading(true);
    setError('');

    try {
      const start = new Date(`${date}T${startTime}`);
      const end = new Date(start);
      end.setHours(end.getHours() + 2);

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
        <h1 className="text-3xl font-bold">Borrow Equipment</h1>
        <p className="text-gray-600">Select sports or lab equipment</p>
      </div>

      <Tabs defaultValue="sports">
        <TabsList>
          <TabsTrigger value="sports">Sports Equipment</TabsTrigger>
          <TabsTrigger value="lab">Lab Equipment</TabsTrigger>
        </TabsList>

        <TabsContent value="sports">
          <Card>
            <CardHeader>
              <CardTitle>Sports Equipment</CardTitle>
              <CardDescription>Available for immediate checkout</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Pickup Date & Time</label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                {sportsItems.map((item) => (
                  <div
                    key={item._id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-gray-600">
                        Available: {item.qtyAvailable}/{item.qtyTotal}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleQuantityChange(item._id, (selectedItems[item._id] || 0) - 1)
                        }
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
                        disabled={(selectedItems[item._id] || 0) >= item.qtyAvailable}
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
              <CardTitle>Lab Equipment</CardTitle>
              <CardDescription>
                <Badge variant="warning">Requires Admin Approval</Badge>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Pickup Date & Time</label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                {labItems.map((item) => (
                  <div
                    key={item._id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-gray-600">
                        Available: {item.qtyAvailable}/{item.qtyTotal}
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
                        disabled={(selectedItems[item._id] || 0) >= item.qtyAvailable}
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
