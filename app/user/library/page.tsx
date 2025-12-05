'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { CompactTimePicker } from '@/components/ui/CompactTimePicker';
import { getISTToday, getISTNow, isISTToday } from '@/lib/timezone-client';
import { Search, BookOpen, Grid3X3, List, Sparkles } from 'lucide-react';

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
  const [resourcesLoading, setResourcesLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

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
    setResourcesLoading(true);
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
    } finally {
      setResourcesLoading(false);
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

      // Book borrowing only allowed between 8am and 8pm
      if (startHour < 8 || startHour >= 20) {
        setError('Book borrowing is only available between 8:00 AM and 8:00 PM');
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
    
    // Filter books based on search query
    const filteredBooks = books.filter(book => 
      book.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const availableCount = filteredBooks.filter(b => b.qtyAvailable > 0).length;

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
            minTime="08:00"
            maxTime="20:00"
            stepMinutes={30}
            label="Pickup Time"
          />
        </div>

        {/* Search and View Toggle */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <Input
              placeholder="Search books..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-1 p-1 bg-bg-dark rounded-lg border border-card-border">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-accent-blue/20 text-accent-blue' : 'text-text-muted hover:text-text-main'}`}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-accent-blue/20 text-accent-blue' : 'text-text-muted hover:text-text-main'}`}
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Book Selection */}
        <div className={`rounded-xl border bg-gradient-to-br ${config.color} p-4 space-y-3`}>
          <div className="flex items-center gap-2 pb-2 border-b border-border-subtle/50">
            <span className="text-2xl">{config.icon}</span>
            <h3 className="font-semibold text-text-main">Select a Book</h3>
            <div className="ml-auto flex items-center gap-2">
              <Badge variant="success" className="text-xs">
                {availableCount} available
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {filteredBooks.length} {filteredBooks.length === 1 ? 'book' : 'books'}
              </Badge>
            </div>
          </div>

          {filteredBooks.length === 0 ? (
            <div className="text-center py-8">
              <span className="text-4xl mb-2 block">📚</span>
              <p className="text-text-muted">
                {searchQuery ? `No books found matching "${searchQuery}"` : 'No books available in this category'}
              </p>
              {searchQuery && (
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => setSearchQuery('')}>
                  Clear search
                </Button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredBooks.map((book, index) => (
                <div
                  key={book._id}
                  className={`relative p-3 rounded-xl cursor-pointer transition-all duration-200 animate-fade-in-up ${selectedBook === book._id
                    ? 'ring-2 ring-accent-blue bg-accent-blue/10 shadow-lg shadow-accent-blue/10'
                    : 'bg-card/50 hover:bg-card border border-transparent hover:border-card-border hover:-translate-y-1'
                    } ${book.qtyAvailable === 0 ? 'opacity-50' : ''}`}
                  style={{ animationDelay: `${index * 30}ms` }}
                  onClick={() => book.qtyAvailable > 0 && handleBookSelect(book._id)}
                >
                  {/* Selection check */}
                  {selectedBook === book._id && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-accent-blue flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                  
                  {/* Book cover placeholder */}
                  <div className="w-full aspect-[3/4] rounded-lg bg-gradient-to-br from-bg-dark to-bg-very-dark flex items-center justify-center mb-2">
                    <BookOpen className="h-8 w-8 text-text-muted/50" />
                  </div>
                  
                  <p className="font-medium text-text-main text-sm truncate">{book.name}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-text-muted">{book.qtyAvailable}/{book.qtyTotal}</span>
                    {book.qtyAvailable === 0 && (
                      <Badge variant="destructive" className="text-[10px] px-1.5">Out</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {filteredBooks.map((book, index) => (
                <div
                  key={book._id}
                  className={`flex items-center gap-3 bg-card/50 rounded-lg p-3 cursor-pointer transition-all duration-200 animate-fade-in-up ${selectedBook === book._id
                    ? 'ring-2 ring-accent-blue bg-accent-blue/10 shadow-lg shadow-accent-blue/10'
                    : 'hover:bg-card border border-transparent hover:border-card-border'
                    } ${book.qtyAvailable === 0 ? 'opacity-50' : ''}`}
                  style={{ animationDelay: `${index * 30}ms` }}
                  onClick={() => book.qtyAvailable > 0 && handleBookSelect(book._id)}
                >
                  {/* Book Icon */}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selectedBook === book._id ? 'bg-accent-blue/20' : 'bg-bg-dark'
                    }`}>
                    <BookOpen className="h-5 w-5 text-text-muted" />
                  </div>

                  {/* Book Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-text-main truncate">{book.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 max-w-[100px] h-1.5 bg-bg-dark rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            book.qtyAvailable === 0 ? 'bg-destructive' :
                            book.qtyAvailable < book.qtyTotal * 0.3 ? 'bg-warning' : 'bg-success'
                          }`}
                          style={{ width: `${(book.qtyAvailable / book.qtyTotal) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-text-muted">
                        {book.qtyAvailable}/{book.qtyTotal}
                      </span>
                    </div>
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
          )}
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

  // Total counts
  const totalBooks = fictionBooks.length + nonFictionBooks.length + textbooks.length;
  const totalAvailable = [...fictionBooks, ...nonFictionBooks, ...textbooks].filter(b => b.qtyAvailable > 0).length;

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-transparent p-6 border border-amber-500/20">
        {/* Background decorations */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        
        {/* Floating book icons */}
        <div className="absolute top-4 right-8 text-4xl opacity-20 animate-float">📚</div>
        <div className="absolute bottom-4 right-24 text-3xl opacity-20 animate-float" style={{ animationDelay: '1s' }}>📖</div>
        <div className="absolute top-12 right-32 text-2xl opacity-20 animate-float" style={{ animationDelay: '2s' }}>📘</div>
        
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/30">
              <BookOpen className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-text-main flex items-center gap-2">
                📚 Library
                <Sparkles className="h-5 w-5 text-amber-500 animate-pulse" />
              </h1>
              <p className="text-text-muted">
                Borrow books for 14 days • {totalBooks} books in collection
              </p>
            </div>
          </div>
          
          {/* Quick Stats */}
          <div className="flex items-center gap-3">
            <div className="px-3 py-2 rounded-xl bg-success/10 border border-success/20">
              <p className="text-xs text-text-muted">Available</p>
              <p className="text-lg font-bold text-success">{totalAvailable}</p>
            </div>
            <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <p className="text-xs text-text-muted">Categories</p>
              <p className="text-lg font-bold text-amber-500">3</p>
            </div>
          </div>
        </div>
      </div>

      {resourcesLoading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-12 bg-card rounded-xl w-full max-w-sm" />
          <div className="h-64 bg-card rounded-xl" />
        </div>
      ) : (
        <Tabs defaultValue="fiction" className="animate-fade-in">
          <TabsList className="mb-6">
            <TabsTrigger value="fiction" icon={<span className="text-base">📚</span>}>
              Fiction ({fictionBooks.length})
            </TabsTrigger>
            <TabsTrigger value="non-fiction" icon={<span className="text-base">📖</span>}>
              Non-Fiction ({nonFictionBooks.length})
            </TabsTrigger>
            <TabsTrigger value="textbooks" icon={<span className="text-base">📘</span>}>
              Textbooks ({textbooks.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="fiction" className="animate-fade-in-up">
            <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  📚 Fiction Books
                </CardTitle>
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
                  <div className="text-center py-8">
                    <span className="text-4xl mb-2 block">📚</span>
                    <p className="text-text-muted">Fiction library not configured</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="non-fiction" className="animate-fade-in-up">
            <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  📖 Non-Fiction Books
                </CardTitle>
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
                  <div className="text-center py-8">
                    <span className="text-4xl mb-2 block">📖</span>
                    <p className="text-text-muted">Non-fiction library not configured</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="textbooks" className="animate-fade-in-up">
            <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  📘 Textbooks
                </CardTitle>
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
                  <div className="text-center py-8">
                    <span className="text-4xl mb-2 block">📘</span>
                    <p className="text-text-muted">Textbooks library not configured</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
