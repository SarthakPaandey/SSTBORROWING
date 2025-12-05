'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { CompactTimePicker } from '@/components/ui/CompactTimePicker';
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

        // FIX EC-30: Use exact matching instead of includes() to avoid fragile matching
        // e.g., "Science Fiction Library" would incorrectly match "Fiction"
        if (resource.name === 'Non-Fiction Library') {
          setNonFictionBooks(itemsData.items || []);
        } else if (resource.name === 'Fiction Library') {
          setFictionBooks(itemsData.items || []);
        } else if (resource.name === 'Textbooks Library') {
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

  const renderBookList = (books: any[], resourceId: string, category: 'fiction' | 'non-fiction' | 'textbooks') => {
    const categoryConfig = {
      fiction: { icon: '📚', color: 'from-purple-500/10 to-purple-600/5 border-purple-500/20', accent: 'purple' },
      'non-fiction': { icon: '📖', color: 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20', accent: 'emerald' },
      textbooks: { icon: '📘', color: 'from-blue-500/10 to-blue-600/5 border-blue-500/20', accent: 'blue' },
    };

    const config = categoryConfig[category];

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <DatePicker
            value={new Date(date)}
            onChange={(newDate) => {
              if (newDate instanceof Date) {
                const dateStr = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-${String(newDate.getDate()).padStart(2, '0')}`;
                setDate(dateStr);
              }
            }}
            minDate={getISTToday()}
            placeholder="Select pickup date"
            className="mb-2"
          />
          <CompactTimePicker
            date={date}
            value={startTime}
            onChange={setStartTime}
            minTime="09:00"
            maxTime="20:00"
            stepMinutes={30}
            label="Pickup Time"
          />
        </div>

        {/* Book Selection */}
        <div className={`rounded-xl border bg-gradient-to-br ${config.color} p-4 space-y-3`}>
          <div className="flex items-center gap-2 pb-2 border-b border-border-subtle/50">
            <span className="text-2xl">{config.icon}</span>
            <h3 className="font-semibold text-text-main">Select a Book</h3>
            <Badge variant="secondary" className="ml-auto text-xs">
              {books.length} {books.length === 1 ? 'book' : 'books'}
            </Badge>
          </div>

          <div className="space-y-2">
            {books.map((book) => (
              <div
                key={book._id}
                className={`flex items-center gap-3 bg-surface-card/50 rounded-lg p-3 cursor-pointer transition-all duration-200 ${selectedBook === book._id
                  ? 'ring-2 ring-accent-blue bg-accent-blue/10 shadow-lg shadow-accent-blue/10'
                  : 'hover:bg-surface-card border border-transparent hover:border-border-subtle'
                  }`}
                onClick={() => handleBookSelect(book._id)}
              >
                {/* Book Icon */}
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${selectedBook === book._id ? 'bg-accent-blue/20' : 'bg-surface-elevated'
                  }`}>
                  📕
                </div>

                {/* Book Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-text-main truncate">{book.name}</p>
                  <p className="text-xs text-text-muted">
                    {book.qtyAvailable}/{book.qtyTotal} available
                  </p>
                </div>

                {/* Selection Indicator */}
                <div className="flex items-center gap-2">
                  {book.qtyAvailable > 0 ? (
                    <Badge variant="success" className="text-xs">Available</Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs">Out</Badge>
                  )}
                  {selectedBook === book._id && (
                    <div className="w-5 h-5 rounded-full bg-accent-blue flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400 flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        {success && (
          <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-sm text-green-400 flex items-center gap-2">
            <span>✅</span> Book borrowed successfully! Redirecting...
          </div>
        )}

        <Button
          onClick={() => handleBorrow(resourceId)}
          disabled={loading || !selectedBook}
          className="w-full"
        >
          {loading ? '📚 Processing...' : '📖 Borrow Book (14 Days)'}
        </Button>

        {/* Info Card */}
        <div className="rounded-xl bg-accent-blue/5 border border-accent-blue/20 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-accent-blue">
            <span>ℹ️</span> Borrowing Rules
          </div>
          <ul className="text-xs text-text-muted space-y-1.5">
            <li className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-accent-blue"></span>
              1 book at a time per student
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-accent-blue"></span>
              Pick up within 24 hours (scan QR code)
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-accent-blue"></span>
              Return within 14 days
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-amber-400"></span>
              Late return: 2 penalty points
            </li>
          </ul>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-accent-blue">Library</h1>
        <p className="text-text-muted">Borrow books for 14 days</p>
      </div>

      <Tabs defaultValue="fiction">
        <TabsList className="mb-6">
          <TabsTrigger value="fiction">📚 Fiction</TabsTrigger>
          <TabsTrigger value="non-fiction">📖 Non-Fiction</TabsTrigger>
          <TabsTrigger value="textbooks">📘 Textbooks</TabsTrigger>
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
                  libraryResources.find(r => r.name === 'Fiction Library')._id,
                  'fiction'
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
                  libraryResources.find(r => r.name === 'Non-Fiction Library')._id,
                  'non-fiction'
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
                  libraryResources.find(r => r.name === 'Textbooks Library')._id,
                  'textbooks'
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
