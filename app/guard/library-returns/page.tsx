'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { BookOpen, CheckCircle, AlertTriangle, Clock, User } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

export default function GuardLibraryReturnsPage() {
  const [issuedBooks, setIssuedBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [returnModal, setReturnModal] = useState<{
    open: boolean;
    booking?: any;
  }>({ open: false });
  const [condition, setCondition] = useState<'excellent' | 'good' | 'fair' | 'damaged'>('good');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchIssuedBooks();
  }, []);

  const fetchIssuedBooks = async () => {
    try {
      const res = await fetch('/api/guard/issued-library');
      const data = await res.json();
      setIssuedBooks(data.bookings || []);
    } catch (error) {
      console.error('Failed to fetch issued books:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReturn = async () => {
    if (!returnModal.booking) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/guard/return-equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: returnModal.booking._id,
          condition,
          notes,
        }),
      });

      if (res.ok) {
        alert('Book marked as returned successfully!');
        setReturnModal({ open: false });
        setCondition('good');
        setNotes('');
        fetchIssuedBooks();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to process return');
      }
    } catch (error) {
      alert('Failed to process return');
    } finally {
      setSubmitting(false);
    }
  };

  const getConditionColor = (cond: string) => {
    switch (cond) {
      case 'excellent':
        return 'bg-success text-white';
      case 'good':
        return 'bg-badge-blue text-white';
      case 'fair':
        return 'bg-yellow-500 text-white';
      case 'damaged':
        return 'bg-danger text-white';
      default:
        return 'bg-bg-dark text-text-muted';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-64 animate-pulse rounded bg-card"></div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-card"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-accent-blue">Library Returns</h1>
        <p className="text-text-muted">Manage library book returns and report condition</p>
      </div>

      {issuedBooks.length === 0 ? (
        <Card>
          <CardContent>
            <div className="empty-state">
              <div className="empty-state-icon">📚</div>
              <h3 className="text-xl font-semibold text-text-main mb-2">No Issued Books</h3>
              <p className="text-text-muted">All books have been returned</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {issuedBooks.map((booking) => (
            <Card key={booking._id} className="transition-all hover:shadow-[0_0_20px_rgba(47,176,255,0.2)]">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="icon-circle w-10 h-10">
                        <BookOpen className="h-5 w-5 text-accent-blue" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-text-main">{booking.resourceName}</h3>
                        <p className="text-sm text-text-muted">Booking ID: {booking._id.slice(-8)}</p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <div className="flex items-center text-sm text-text-muted mb-1">
                          <User className="h-4 w-4 mr-2" />
                          <span>Student: {booking.userName || 'N/A'}</span>
                        </div>
                        <div className="flex items-center text-sm text-text-muted">
                          <Clock className="h-4 w-4 mr-2" />
                          <span>Issued: {formatDateTime(booking.checkedInAt || booking.start)}</span>
                        </div>
                        <div className="flex items-center text-sm text-text-muted mt-1">
                          <Clock className="h-4 w-4 mr-2" />
                          <span>Due: {formatDateTime(booking.end)}</span>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm text-text-muted mb-1">Books:</p>
                        <div className="space-y-1">
                          {booking.items?.map((item: any, idx: number) => (
                            <div key={idx} className="flex items-center text-sm">
                              <span className="font-medium text-text-main">
                                {item.name} <span className="text-text-muted">×{item.qty}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="default">Checked In</Badge>
                      {new Date(booking.end) < new Date() && (
                        <Badge variant="warning">Overdue</Badge>
                      )}
                    </div>
                  </div>

                  <Button
                    onClick={() => setReturnModal({ open: true, booking })}
                    variant="gradient"
                    className="btn-ripple"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Mark Returned
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Return Modal */}
      <Modal
        isOpen={returnModal.open}
        onClose={() => {
          setReturnModal({ open: false });
          setCondition('good');
          setNotes('');
        }}
        title="Mark Book as Returned"
        size="md"
      >
        <div className="space-y-6">
          <div>
            <h4 className="font-semibold text-text-main mb-2">Book Details</h4>
            <div className="bg-bg-dark rounded-lg p-4 space-y-2">
              <p className="text-sm">
                <span className="text-text-muted">Student:</span>{' '}
                <span className="text-text-main font-medium">{returnModal.booking?.userName}</span>
              </p>
              <p className="text-sm">
                <span className="text-text-muted">Books:</span>
              </p>
              {returnModal.booking?.items?.map((item: any, idx: number) => (
                <div key={idx} className="ml-4 text-sm text-text-main">
                  • {item.name} ×{item.qty}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-main mb-3">
              Book Condition <span className="text-danger">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(['excellent', 'good', 'fair', 'damaged'] as const).map((cond) => (
                <button
                  key={cond}
                  type="button"
                  onClick={() => setCondition(cond)}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    condition === cond
                      ? 'border-accent-blue bg-accent-blue/10'
                      : 'border-card-border hover:border-accent-blue/50'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    {cond === 'excellent' && <CheckCircle className="h-6 w-6 text-success" />}
                    {cond === 'good' && <CheckCircle className="h-6 w-6 text-badge-blue" />}
                    {cond === 'fair' && <AlertTriangle className="h-6 w-6 text-yellow-500" />}
                    {cond === 'damaged' && <AlertTriangle className="h-6 w-6 text-danger" />}
                    <span className="text-sm font-medium text-text-main capitalize">{cond}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-main mb-2">
              Notes / Comments (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any damage, missing pages, or observations..."
              className="w-full px-4 py-3 rounded-lg bg-bg-dark border border-card-border text-text-main placeholder:text-text-muted focus:border-accent-blue focus:outline-none resize-none"
              rows={4}
            />
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => {
                setReturnModal({ open: false });
                setCondition('good');
                setNotes('');
              }}
              variant="outline"
              className="flex-1"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReturn}
              variant="gradient"
              className="flex-1 btn-ripple"
              disabled={submitting}
            >
              {submitting ? 'Processing...' : 'Confirm Return'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}


