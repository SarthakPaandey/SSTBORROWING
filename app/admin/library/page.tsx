'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/LoadingState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Plus, Edit, Trash2, BookOpen } from 'lucide-react';
import { Resource, LibraryBook } from '@/types/frontend';

type ModalMode = 'add' | 'edit' | null;

export default function LibraryManagementPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [loading, setLoading] = useState(true);

  // Book modal state
  const [bookModal, setBookModal] = useState(false);
  const [bookMode, setBookMode] = useState<ModalMode>(null);
  const [selectedBook, setSelectedBook] = useState<LibraryBook | null>(null);
  const [bookForm, setBookForm] = useState({
    name: '',
    qtyTotal: '',
    qtyAvailable: '',
    safety: false,
    restricted: false,
    resourceId: '',
  });

  // Delete confirmation
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LibraryBook | null>(null);

  useEffect(() => {
    fetchLibraryResources();
  }, []);

  const fetchLibraryResources = async () => {
    try {
      const res = await fetch('/api/resources?type=LIBRARY');
      const data = await res.json();
      setResources(data.resources || []);
    } catch (error) {
      console.error('Failed to fetch library resources:', error);
    }
  };

  const fetchBooks = async () => {
    try {
      const res = await fetch('/api/admin/equipment');
      const data = await res.json();
      // FIX EC-4: Filter only library books using resources
      const libraryBooks = (data.items || []).filter((item: LibraryBook) =>
        resources.some(r => r._id === item.resourceId && r.type === 'LIBRARY')
      );
      setBooks(libraryBooks);
    } catch (error) {
      console.error('Failed to fetch books:', error);
    } finally {
      setLoading(false);
    }
  };

  // FIX EC-4: Fetch books AFTER resources are loaded
  useEffect(() => {
    if (resources.length > 0) {
      fetchBooks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resources]);

  // Book handlers
  const openAddBook = (resourceId: string) => {
    setBookForm({
      name: '',
      qtyTotal: '',
      qtyAvailable: '',
      safety: false,
      restricted: false,
      resourceId,
    });
    setBookMode('add');
    setBookModal(true);
  };

  const openEditBook = (book: LibraryBook) => {
    setSelectedBook(book);
    setBookForm({
      name: book.name,
      qtyTotal: book.qtyTotal.toString(),
      qtyAvailable: book.qtyAvailable.toString(),
      safety: book.safety || false,
      restricted: book.restricted || false,
      resourceId: book.resourceId,
    });
    setBookMode('edit');
    setBookModal(true);
  };

  const saveBook = async () => {
    try {
      const url = bookMode === 'add' ? '/api/admin/equipment' : `/api/admin/equipment`;
      const method = bookMode === 'add' ? 'POST' : 'PATCH';

      interface SaveBookBody {
        resourceId: string;
        name: string;
        qtyTotal: number;
        qtyAvailable: number;
        safety: boolean;
        restricted: boolean;
        itemId?: string;
      }

      const body: SaveBookBody = {
        resourceId: bookForm.resourceId,
        name: bookForm.name,
        qtyTotal: parseInt(bookForm.qtyTotal),
        qtyAvailable: parseInt(bookForm.qtyAvailable),
        safety: bookForm.safety,
        restricted: bookForm.restricted,
      };

      if (bookMode === 'edit' && selectedBook) {
        body.itemId = selectedBook._id;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setBookModal(false);
        fetchBooks();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to save book');
      }
    } catch (error) {
      console.error('Save book error:', error);
      alert('Failed to save book');
    }
  };

  const confirmDelete = (book: LibraryBook) => {
    setDeleteTarget(book);
    setDeleteModal(true);
  };

  const deleteBook = async () => {
    if (!deleteTarget) return;

    try {
      const res = await fetch(`/api/admin/equipment/${deleteTarget._id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setDeleteModal(false);
        fetchBooks();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete book');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete book');
    }
  };

  if (loading) {
    return (
      <LoadingState
        title="Loading library inventory"
        subtitle="Fetching categories and books..."
        variant="galaxy"
      />
    );
  }

  // FIX EC-30: Organize books by category using exact matching
  const fictionResource = resources.find(r => r.name === 'Fiction Library');
  const nonFictionResource = resources.find(r => r.name === 'Non-Fiction Library');
  const textbooksResource = resources.find(r => r.name === 'Textbooks Library');

  const fictionBooks = books.filter(b => fictionResource && b.resourceId === fictionResource._id);
  const nonFictionBooks = books.filter(b => nonFictionResource && b.resourceId === nonFictionResource._id);
  const textbooks = books.filter(b => textbooksResource && b.resourceId === textbooksResource._id);

  const renderBookList = (bookList: LibraryBook[], resourceId: string, categoryName: string) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-accent-blue" />
          <CardTitle className="text-text-main">{categoryName}</CardTitle>
        </div>
        {resourceId && (
          <Button
            onClick={() => openAddBook(resourceId)}
            variant="gradient"
            size="sm"
            className="btn-ripple"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Book
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {bookList.length === 0 ? (
            <p className="text-center text-text-muted py-8">No books yet. Add one to get started.</p>
          ) : (
            bookList.map((book) => (
              <div
                key={book._id}
                className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-card-border bg-card p-4 hover:border-accent-blue/30 transition-colors"
              >
                <div className="flex-1">
                  <p className="font-medium text-text-main">{book.name}</p>
                  <p className="text-sm text-text-muted">
                    Available: {book.qtyAvailable} / {book.qtyTotal}
                  </p>
                  <div className="flex gap-2 mt-1">
                    {book.safety && <Badge variant="warning">Special Handling</Badge>}
                    {book.restricted && <Badge variant="destructive">Restricted</Badge>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => openEditBook(book)}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() => confirmDelete(book)}
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
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-main">Library Management</h1>
        <p className="text-text-muted">Manage library book inventory by category</p>
      </div>

      <Tabs defaultValue="fiction">
        <TabsList>
          <TabsTrigger value="fiction">Fiction</TabsTrigger>
          <TabsTrigger value="non-fiction">Non-Fiction</TabsTrigger>
          <TabsTrigger value="textbooks">Textbooks</TabsTrigger>
        </TabsList>

        <TabsContent value="fiction">
          {renderBookList(fictionBooks, fictionResource?._id || '', 'Fiction Books')}
        </TabsContent>

        <TabsContent value="non-fiction">
          {renderBookList(nonFictionBooks, nonFictionResource?._id || '', 'Non-Fiction Books')}
        </TabsContent>

        <TabsContent value="textbooks">
          {renderBookList(textbooks, textbooksResource?._id || '', 'Textbooks')}
        </TabsContent>
      </Tabs>

      {/* Book Add/Edit Modal */}
      <Modal
        isOpen={bookModal}
        onClose={() => setBookModal(false)}
        title={bookMode === 'add' ? 'Add Book' : 'Edit Book'}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Book Title *</label>
            <Input
              value={bookForm.name}
              onChange={(e) => setBookForm({ ...bookForm, name: e.target.value })}
              placeholder="e.g., 1984 by George Orwell"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">Total Quantity *</label>
              <Input
                type="number"
                value={bookForm.qtyTotal}
                onChange={(e) => setBookForm({ ...bookForm, qtyTotal: e.target.value })}
                placeholder="e.g., 3"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">Available *</label>
              <Input
                type="number"
                value={bookForm.qtyAvailable}
                onChange={(e) => setBookForm({ ...bookForm, qtyAvailable: e.target.value })}
                placeholder="e.g., 3"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="restricted"
              checked={bookForm.restricted}
              onChange={(e) => setBookForm({ ...bookForm, restricted: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="restricted" className="text-sm text-text-main">Restricted Access</label>
          </div>
          <div className="flex gap-3 pt-4">
            <Button onClick={() => setBookModal(false)} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button onClick={saveBook} variant="gradient" className="flex-1">
              {bookMode === 'add' ? 'Add Book' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModal}
        onClose={() => setDeleteModal(false)}
        title="Confirm Delete"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-text-main">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
            This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button onClick={() => setDeleteModal(false)} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button onClick={deleteBook} variant="destructive" className="flex-1">
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
