'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { TimePicker } from '@/components/ui/TimePicker';
import { getISTToday, getISTNow, isISTToday } from '@/lib/timezone-client';

export default function LibraryPage() {
  const router = useRouter();
  const [libraryResources, setLibraryResources] = useState<any[]>([]);
  const [fictionBooks, setFictionBooks] = useState<any[]>([]);
  const [nonFictionBooks, setNonFictionBooks] = useState<any[]>([]);
  const [textbooks, setTextbooks] = useState<any[]>([]);
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  // FIX: Use IST timezone for accurate date display
  const [date, setDate] = useState(getISTToday());
  const [startTime, setStartTime] = useState('09:00');
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
    try {
      const res = await fetch('/api/resources?type=LIBRARY');
      const data = await res.json();
      setLibraryResources(data.resources);

      // Fetch books for each category
      for (const resource of data.resources) {
        const itemsRes = await fetch(`/api/admin/equipment?resourceId=${resource._id}`);
        const itemsData = await itemsRes.json();

        // Check Non-Fiction first to avoid matching Fiction
        if (resource.name.includes('Non-Fiction')) {
          setNonFictionBooks(itemsData.items || []);
        } else if (resource.name.includes('Fiction')) {
          setFictionBooks(itemsData.items || []);
        } else if (resource.name.includes('Textbooks')) {
          setTextbooks(itemsData.items || []);
        }
      }
    } catch (err) {
      console.error('Failed to fetch library resources:', err);
    }
  };

  const handleBookSelect = (bookId: string) => {
    setSelectedBook(selectedBook === bookId ? null : bookId);
  };

  const handleBorrow = async (resourceId: string) => {
    if (!selectedBook) {
      setError('Please select a book');
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

      // Check if booking is in the past for today (using IST time)
      if (date === today && start < getISTNow()) {
        setError('Pickup time must be in the future for today');
        setLoading(false);
        return;
      }

      // Book borrowing only allowed between 9am and 8pm
      if (startHour < 9 || startHour >= 20) {
        setError('Book borrowing is only available between 9:00 AM and 8:00 PM');
        setLoading(false);
        return;
      }

      const end = new Date(start);
      end.setDate(end.getDate() + 14); // 14 days later

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceId,
          kind: 'LIBRARY',
          start: start.toISOString(),
          end: end.toISOString(),
          items: [{ itemId: selectedBook, qty: 1 }],
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to borrow book');
      }

      setSuccess(true);
      setTimeout(() => router.push('/user/bookings'), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderBookList = (books: any[], resourceId: string) => (
    <div className="space-y-4">
      <div className="space-y-2">
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
          helperText="Only remaining pickup times for today are shown. Available between 9:00 AM - 8:00 PM • 14-day borrowing period"
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Select a book (1 book at a time)</p>
        {books.map((book) => (
          <div
            key={book._id}
            className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors ${selectedBook === book._id
              ? 'border-accent-blue bg-accent-blue/5'
              : 'hover:border-gray-300'
              }`}
            onClick={() => handleBookSelect(book._id)}
          >
            <div>
              <p className="font-medium">{book.name}</p>
              <p className="text-sm text-gray-600">
                Available: {book.qtyAvailable}/{book.qtyTotal}
              </p>
            </div>
            <div>
              {book.qtyAvailable > 0 ? (
                <Badge variant="success">Available</Badge>
              ) : (
                <Badge variant="destructive">Out of Stock</Badge>
              )}
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
          Book borrowed successfully! Redirecting...
        </div>
      )}

      <Button
        onClick={() => handleBorrow(resourceId)}
        disabled={loading || !selectedBook}
        className="w-full"
      >
        {loading ? 'Processing...' : 'Borrow Book (14 Days)'}
      </Button>

      <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
        <p className="font-semibold mb-1">Important:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>You can only borrow 1 book at a time</li>
          <li>Must pick up within 24 hours (generate QR code)</li>
          <li>Return within 14 days to avoid penalty</li>
          <li>Late return: 2 penalty points + payment required</li>
        </ul>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-accent-blue">Library</h1>
        <p className="text-text-muted">Borrow books for 14 days</p>
      </div>

      <Tabs defaultValue="fiction">
        <TabsList className="mb-6">
          <TabsTrigger value="fiction">Fiction</TabsTrigger>
          <TabsTrigger value="non-fiction">Non-Fiction</TabsTrigger>
          <TabsTrigger value="textbooks">Textbooks</TabsTrigger>
        </TabsList>

        <TabsContent value="fiction">
          <Card>
            <CardHeader>
              <CardTitle>Fiction Books</CardTitle>
              <CardDescription>
                Classic and contemporary fiction titles
              </CardDescription>
            </CardHeader>
            <CardContent>
              {libraryResources.find(r => r.name === 'Fiction Library') ? (
                renderBookList(
                  fictionBooks,
                  libraryResources.find(r => r.name === 'Fiction Library')._id
                )
              ) : (
                <p className="text-text-muted">Loading...</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="non-fiction">
          <Card>
            <CardHeader>
              <CardTitle>Non-Fiction Books</CardTitle>
              <CardDescription>
                Self-help, business, and educational books
              </CardDescription>
            </CardHeader>
            <CardContent>
              {libraryResources.find(r => r.name === 'Non-Fiction Library') ? (
                renderBookList(
                  nonFictionBooks,
                  libraryResources.find(r => r.name === 'Non-Fiction Library')._id
                )
              ) : (
                <p className="text-text-muted">Loading...</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="textbooks">
          <Card>
            <CardHeader>
              <CardTitle>Textbooks</CardTitle>
              <CardDescription>
                Computer Science and Programming textbooks
              </CardDescription>
            </CardHeader>
            <CardContent>
              {libraryResources.find(r => r.name === 'Textbooks Library') ? (
                renderBookList(
                  textbooks,
                  libraryResources.find(r => r.name === 'Textbooks Library')._id
                )
              ) : (
                <p className="text-text-muted">Loading...</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
