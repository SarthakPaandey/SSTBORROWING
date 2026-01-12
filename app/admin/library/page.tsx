'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/LoadingState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Plus, Edit, Trash2, Camera, Keyboard, X, BookOpen, Search } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

type ModalMode = 'add' | 'edit' | null;

export default function AdminLibraryPage() {
  const [libraryResources, setLibraryResources] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Book modal state
  const [bookModal, setBookModal] = useState(false);
  const [bookMode, setBookMode] = useState<ModalMode>(null);
  const [selectedBook, setSelectedBook] = useState<any>(null);
  const [bookForm, setBookForm] = useState({
    name: '',
    author: '',
    isbn: '',
    qtyTotal: '',
    qtyAvailable: '',
    imageUrl: '',
    resourceId: '',
  });

  // ISBN scanner state
  const [isbnScannerMode, setIsbnScannerMode] = useState<'camera' | 'manual'>('camera');
  const [isScanning, setIsScanning] = useState(false);
  const [isbnInput, setIsbnInput] = useState('');
  const [fetchingDetails, setFetchingDetails] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef(false);

  // Delete confirmation
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  useEffect(() => {
    fetchLibraryData();
  }, []);

  const fetchLibraryData = async () => {
    try {
      // Fetch library resources
      const resourcesRes = await fetch('/api/resources?type=LIBRARY');
      const resourcesData = await resourcesRes.json();
      const libraryRes = resourcesData.resources || [];
      setLibraryResources(libraryRes);

      // Fetch all books from all library resources
      const allBooks: any[] = [];
      for (const resource of libraryRes) {
        const booksRes = await fetch(`/api/admin/equipment?resourceId=${resource._id}`);
        const booksData = await booksRes.json();
        const resourceBooks = (booksData.items || []).map((book: any) => ({
          ...book,
          resourceName: resource.name,
        }));
        allBooks.push(...resourceBooks);
      }
      setBooks(allBooks);
    } catch (error) {
      console.error('Failed to fetch library data:', error);
    } finally {
      setLoading(false);
    }
  };

  const startIsbnScanner = async () => {
    setIsScanning(true);
  };

  useEffect(() => {
    if (!isScanning || isbnScannerMode !== 'camera') return;

    const initCamera = async () => {
      try {
        const html5QrCode = new Html5Qrcode('isbn-scanner');
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          async (decodedText) => {
            if (isScanningRef.current) return;
            isScanningRef.current = true;

            await handleIsbnScanned(decodedText);

            setTimeout(() => {
              isScanningRef.current = false;
            }, 2000);
          },
          (errorMessage) => {
            // Ignore scan errors
            console.debug(errorMessage);
          }
        );
      } catch (err) {
        console.error('Camera error:', err);
        setIsScanning(false);
      }
    };

    initCamera();

    return () => {
      stopIsbnScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScanning, isbnScannerMode]);

  const stopIsbnScanner = async () => {
    try {
      if (scannerRef.current && isScanning) {
        await scannerRef.current.stop();
        scannerRef.current = null;
      }
      setIsScanning(false);
      isScanningRef.current = false;
    } catch (err) {
      console.error('Error stopping scanner:', err);
    }
  };

  const handleIsbnScanned = async (isbn: string) => {
    setIsbnInput(isbn);
    await fetchBookDetails(isbn);
    stopIsbnScanner();
  };

  const fetchBookDetails = async (isbn?: string) => {
    const isbnToFetch = isbn || isbnInput;
    if (!isbnToFetch) return;

    setFetchingDetails(true);
    try {
      const res = await fetch('/api/isbn/fetch-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isbn: isbnToFetch }),
      });

      const data = await res.json();

      if (data.found && data.book) {
        setBookForm({
          ...bookForm,
          name: data.book.title,
          author: data.book.author,
          isbn: data.book.isbn,
          imageUrl: data.book.coverUrl || '',
        });
      } else {
        // Book not found in Open Library, but allow manual entry
        setBookForm({
          ...bookForm,
          isbn: isbnToFetch.replace(/[-\s]/g, ''),
        });
        alert('Book not found in Open Library. Please enter details manually.');
      }
    } catch (error) {
      console.error('Failed to fetch book details:', error);
      alert('Failed to fetch book details. Please enter manually.');
    } finally {
      setFetchingDetails(false);
    }
  };

  const openAddBook = (resourceId: string) => {
    setBookForm({
      name: '',
      author: '',
      isbn: '',
      qtyTotal: '',
      qtyAvailable: '',
      imageUrl: '',
      resourceId,
    });
    setBookMode('add');
    setBookModal(true);
    setIsbnInput('');
    setIsScanning(false);
  };

  const openEditBook = (book: any) => {
    setSelectedBook(book);
    setBookForm({
      name: book.name,
      author: book.author || '',
      isbn: book.isbn || '',
      qtyTotal: book.qtyTotal.toString(),
      qtyAvailable: book.qtyAvailable.toString(),
      imageUrl: book.imageUrl || '',
      resourceId: book.resourceId,
    });
    setBookMode('edit');
    setBookModal(true);
    setIsbnInput('');
    setIsScanning(false);
  };

  const handleSaveBook = async () => {
    try {
      if (!bookForm.name || !bookForm.resourceId) {
        alert('Book name and library category are required');
        return;
      }

      const payload: any = {
        name: bookForm.name,
        qtyTotal: parseInt(bookForm.qtyTotal) || 1,
        qtyAvailable: parseInt(bookForm.qtyAvailable) || parseInt(bookForm.qtyTotal) || 1,
        safety: false,
        restricted: false,
        requiresApproval: false,
        resourceId: bookForm.resourceId,
      };

      if (bookForm.author) payload.author = bookForm.author;
      if (bookForm.isbn) payload.isbn = bookForm.isbn.replace(/[-\s]/g, '');
      if (bookForm.imageUrl) payload.imageUrl = bookForm.imageUrl;

      if (bookMode === 'add') {
        await fetch('/api/admin/equipment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else if (bookMode === 'edit' && selectedBook) {
        await fetch('/api/admin/equipment', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: selectedBook._id,
            ...payload,
          }),
        });
      }

      setBookModal(false);
      fetchLibraryData();
    } catch (error) {
      console.error('Failed to save book:', error);
      alert('Failed to save book');
    }
  };

  const handleDeleteBook = async () => {
    try {
      await fetch(`/api/admin/equipment/${deleteTarget._id}`, {
        method: 'DELETE',
      });
      setDeleteModal(false);
      fetchLibraryData();
    } catch (error) {
      console.error('Failed to delete book:', error);
      alert('Failed to delete book');
    }
  };

  const filteredBooks = books.filter(
    (book) =>
      book.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (book.author && book.author.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (book.isbn && book.isbn.includes(searchQuery))
  );

  const fictionResource = libraryResources.find((r) => r.name === 'Fiction Library');
  const nonFictionResource = libraryResources.find((r) => r.name === 'Non-Fiction Library');
  const textbooksResource = libraryResources.find((r) => r.name === 'Textbooks Library');

  if (loading) {
    return (
      <LoadingState
        title="Loading library"
        subtitle="Fetching books and categories..."
        variant="galaxy"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-accent-blue">Library Management</h1>
        <p className="text-text-muted">Manage books and library collections</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <Input
          placeholder="Search books by title, author, or ISBN..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Books ({books.length})</TabsTrigger>
          <TabsTrigger value="fiction">
            Fiction ({books.filter((b) => b.resourceName === 'Fiction Library').length})
          </TabsTrigger>
          <TabsTrigger value="non-fiction">
            Non-Fiction ({books.filter((b) => b.resourceName === 'Non-Fiction Library').length})
          </TabsTrigger>
          <TabsTrigger value="textbooks">
            Textbooks ({books.filter((b) => b.resourceName === 'Textbooks Library').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-text-main">All Books</CardTitle>
              <div className="flex gap-2">
                {fictionResource && (
                  <Button
                    onClick={() => openAddBook(fictionResource._id)}
                    variant="gradient"
                    size="sm"
                    className="btn-ripple"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Fiction Book
                  </Button>
                )}
                {nonFictionResource && (
                  <Button
                    onClick={() => openAddBook(nonFictionResource._id)}
                    variant="gradient"
                    size="sm"
                    className="btn-ripple"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Non-Fiction Book
                  </Button>
                )}
                {textbooksResource && (
                  <Button
                    onClick={() => openAddBook(textbooksResource._id)}
                    variant="gradient"
                    size="sm"
                    className="btn-ripple"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Textbook
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredBooks.length === 0 ? (
                  <p className="text-center text-text-muted py-8">
                    {searchQuery ? 'No books found matching your search.' : 'No books yet. Add one to get started.'}
                  </p>
                ) : (
                  filteredBooks.map((book) => (
                    <div
                      key={book._id}
                      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-card-border bg-card p-4 hover:border-accent-blue/30 transition-colors"
                    >
                      <div className="flex gap-4 flex-1">
                        {book.imageUrl && (
                          <img
                            src={book.imageUrl}
                            alt={book.name}
                            className="w-16 h-24 object-cover rounded border border-card-border"
                          />
                        )}
                        <div className="flex-1">
                          <p className="font-medium text-text-main">{book.name}</p>
                          {book.author && <p className="text-sm text-text-muted">by {book.author}</p>}
                          {book.isbn && (
                            <p className="text-xs text-text-muted font-mono mt-1">ISBN: {book.isbn}</p>
                          )}
                          <Badge variant="secondary" className="mt-2 text-xs">
                            {book.resourceName}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={book.qtyAvailable > 0 ? 'success' : 'destructive'}>
                          {book.qtyAvailable}/{book.qtyTotal} available
                        </Badge>
                        <Button
                          onClick={() => openEditBook(book)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => {
                            setDeleteTarget(book);
                            setDeleteModal(true);
                          }}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:text-danger"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fiction">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-text-main">Fiction Books</CardTitle>
              {fictionResource && (
                <Button
                  onClick={() => openAddBook(fictionResource._id)}
                  variant="gradient"
                  size="sm"
                  className="btn-ripple"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Fiction Book
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {books
                  .filter((b) => b.resourceName === 'Fiction Library')
                  .filter(
                    (b) =>
                      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (b.author && b.author.toLowerCase().includes(searchQuery.toLowerCase()))
                  )
                  .map((book) => (
                    <div
                      key={book._id}
                      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-card-border bg-card p-4"
                    >
                      <div className="flex gap-4 flex-1">
                        {book.imageUrl && (
                          <img
                            src={book.imageUrl}
                            alt={book.name}
                            className="w-16 h-24 object-cover rounded border border-card-border"
                          />
                        )}
                        <div>
                          <p className="font-medium text-text-main">{book.name}</p>
                          {book.author && <p className="text-sm text-text-muted">by {book.author}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={book.qtyAvailable > 0 ? 'success' : 'destructive'}>
                          {book.qtyAvailable}/{book.qtyTotal}
                        </Badge>
                        <Button
                          onClick={() => openEditBook(book)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => {
                            setDeleteTarget(book);
                            setDeleteModal(true);
                          }}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:text-danger"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="non-fiction">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-text-main">Non-Fiction Books</CardTitle>
              {nonFictionResource && (
                <Button
                  onClick={() => openAddBook(nonFictionResource._id)}
                  variant="gradient"
                  size="sm"
                  className="btn-ripple"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Non-Fiction Book
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {books
                  .filter((b) => b.resourceName === 'Non-Fiction Library')
                  .filter(
                    (b) =>
                      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (b.author && b.author.toLowerCase().includes(searchQuery.toLowerCase()))
                  )
                  .map((book) => (
                    <div
                      key={book._id}
                      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-card-border bg-card p-4"
                    >
                      <div className="flex gap-4 flex-1">
                        {book.imageUrl && (
                          <img
                            src={book.imageUrl}
                            alt={book.name}
                            className="w-16 h-24 object-cover rounded border border-card-border"
                          />
                        )}
                        <div>
                          <p className="font-medium text-text-main">{book.name}</p>
                          {book.author && <p className="text-sm text-text-muted">by {book.author}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={book.qtyAvailable > 0 ? 'success' : 'destructive'}>
                          {book.qtyAvailable}/{book.qtyTotal}
                        </Badge>
                        <Button
                          onClick={() => openEditBook(book)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => {
                            setDeleteTarget(book);
                            setDeleteModal(true);
                          }}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:text-danger"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="textbooks">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-text-main">Textbooks</CardTitle>
              {textbooksResource && (
                <Button
                  onClick={() => openAddBook(textbooksResource._id)}
                  variant="gradient"
                  size="sm"
                  className="btn-ripple"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Textbook
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {books
                  .filter((b) => b.resourceName === 'Textbooks Library')
                  .filter(
                    (b) =>
                      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (b.author && b.author.toLowerCase().includes(searchQuery.toLowerCase()))
                  )
                  .map((book) => (
                    <div
                      key={book._id}
                      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-card-border bg-card p-4"
                    >
                      <div className="flex gap-4 flex-1">
                        {book.imageUrl && (
                          <img
                            src={book.imageUrl}
                            alt={book.name}
                            className="w-16 h-24 object-cover rounded border border-card-border"
                          />
                        )}
                        <div>
                          <p className="font-medium text-text-main">{book.name}</p>
                          {book.author && <p className="text-sm text-text-muted">by {book.author}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={book.qtyAvailable > 0 ? 'success' : 'destructive'}>
                          {book.qtyAvailable}/{book.qtyTotal}
                        </Badge>
                        <Button
                          onClick={() => openEditBook(book)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => {
                            setDeleteTarget(book);
                            setDeleteModal(true);
                          }}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:text-danger"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Book Modal */}
      <Modal
        isOpen={bookModal}
        onClose={() => {
          setBookModal(false);
          stopIsbnScanner();
        }}
        title={bookMode === 'add' ? 'Add Book' : 'Edit Book'}
      >
        <div className="space-y-4">
          {/* ISBN Scanner */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                variant={isbnScannerMode === 'camera' ? 'gradient' : 'outline'}
                onClick={() => {
                  setIsbnScannerMode('camera');
                  stopIsbnScanner();
                }}
                size="sm"
              >
                <Camera className="mr-2 h-4 w-4" />
                Scan ISBN
              </Button>
              <Button
                variant={isbnScannerMode === 'manual' ? 'gradient' : 'outline'}
                onClick={() => {
                  setIsbnScannerMode('manual');
                  stopIsbnScanner();
                }}
                size="sm"
              >
                <Keyboard className="mr-2 h-4 w-4" />
                Manual Entry
              </Button>
            </div>

            {isbnScannerMode === 'camera' && (
              <div className="space-y-2">
                {!isScanning ? (
                  <Button onClick={startIsbnScanner} variant="outline" className="w-full">
                    <Camera className="mr-2 h-4 w-4" />
                    Start Camera Scanner
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <div
                      id="isbn-scanner"
                      className="rounded-lg overflow-hidden border-2 border-accent-blue/50"
                    ></div>
                    <Button onClick={stopIsbnScanner} variant="outline" className="w-full">
                      <X className="mr-2 h-4 w-4" />
                      Stop Scanner
                    </Button>
                  </div>
                )}
              </div>
            )}

            {isbnScannerMode === 'manual' && (
              <div className="flex gap-2">
                <Input
                  placeholder="Enter ISBN (13 or 10 digits)"
                  value={isbnInput}
                  onChange={(e) => setIsbnInput(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={() => fetchBookDetails()}
                  disabled={!isbnInput || fetchingDetails}
                  variant="outline"
                >
                  {fetchingDetails ? 'Fetching...' : 'Fetch Details'}
                </Button>
              </div>
            )}
          </div>

          <Input
            label="Book Title *"
            value={bookForm.name}
            onChange={(e) => setBookForm({ ...bookForm, name: e.target.value })}
            placeholder="Enter book title"
          />

          <Input
            label="Author"
            value={bookForm.author}
            onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })}
            placeholder="Enter author name"
          />

          <Input
            label="ISBN"
            value={bookForm.isbn}
            onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })}
            placeholder="ISBN-13 or ISBN-10"
          />

          <Input
            label="Cover Image URL"
            value={bookForm.imageUrl}
            onChange={(e) => setBookForm({ ...bookForm, imageUrl: e.target.value })}
            placeholder="https://..."
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Total Quantity *"
              type="number"
              value={bookForm.qtyTotal}
              onChange={(e) => setBookForm({ ...bookForm, qtyTotal: e.target.value })}
              placeholder="1"
            />

            <Input
              label="Available Quantity *"
              type="number"
              value={bookForm.qtyAvailable}
              onChange={(e) => setBookForm({ ...bookForm, qtyAvailable: e.target.value })}
              placeholder="1"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSaveBook} variant="gradient" className="flex-1">
              {bookMode === 'add' ? 'Add Book' : 'Save Changes'}
            </Button>
            <Button
              onClick={() => {
                setBookModal(false);
                stopIsbnScanner();
              }}
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModal}
        onClose={() => setDeleteModal(false)}
        title="Delete Book"
      >
        <div className="space-y-4">
          <p className="text-text-main">
            Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This action cannot be undone.
          </p>
          <div className="flex gap-2">
            <Button onClick={handleDeleteBook} variant="destructive" className="flex-1">
              Delete
            </Button>
            <Button onClick={() => setDeleteModal(false)} variant="outline">
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
