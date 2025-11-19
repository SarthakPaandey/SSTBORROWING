'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Package, CheckCircle, AlertTriangle, Clock, User } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

export default function GuardReturnsPage() {
  const [issuedEquipment, setIssuedEquipment] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [returnModal, setReturnModal] = useState<{
    open: boolean;
    booking?: any;
  }>({ open: false });
  const [isDamaged, setIsDamaged] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchIssuedEquipment();
  }, []);

  const fetchIssuedEquipment = async () => {
    try {
      const res = await fetch('/api/guard/issued-equipment');
      const data = await res.json();
      setIssuedEquipment(data.bookings || []);
    } catch (error) {
      console.error('Failed to fetch issued equipment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReturn = async () => {
    if (!returnModal.booking) return;

    // Validate: if damaged, notes are required
    if (isDamaged && !notes.trim()) {
      alert('Please provide notes describing the damage');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/guard/return-equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: returnModal.booking._id,
          condition: isDamaged ? 'damaged' : 'good',
          notes,
        }),
      });

      if (res.ok) {
        alert('Equipment marked as returned successfully!');
        setReturnModal({ open: false });
        setIsDamaged(false);
        setNotes('');
        fetchIssuedEquipment();
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
        <h1 className="text-3xl font-bold text-accent-blue">Equipment Returns</h1>
        <p className="text-text-muted">Manage equipment returns and report condition</p>
      </div>

      {issuedEquipment.length === 0 ? (
        <Card>
          <CardContent>
            <div className="empty-state">
              <div className="empty-state-icon">📦</div>
              <h3 className="text-xl font-semibold text-text-main mb-2">No Issued Equipment</h3>
              <p className="text-text-muted">All equipment has been returned</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {issuedEquipment.map((booking) => (
            <Card key={booking._id} className="transition-all hover:shadow-[0_0_20px_rgba(47,176,255,0.2)]">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="icon-circle w-10 h-10">
                        <Package className="h-5 w-5 text-accent-blue" />
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
                      </div>

                      <div>
                        <p className="text-sm text-text-muted mb-1">Items:</p>
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
          setIsDamaged(false);
          setNotes('');
        }}
        title="Mark Equipment as Returned"
        size="md"
      >
        <div className="space-y-6">
          <div>
            <h4 className="font-semibold text-text-main mb-2">Equipment Details</h4>
            <div className="bg-bg-dark rounded-lg p-4 space-y-2">
              <p className="text-sm">
                <span className="text-text-muted">Student:</span>{' '}
                <span className="text-text-main font-medium">{returnModal.booking?.userName}</span>
              </p>
              <p className="text-sm">
                <span className="text-text-muted">Items:</span>
              </p>
              {returnModal.booking?.items?.map((item: any, idx: number) => (
                <div key={idx} className="ml-4 text-sm text-text-main">
                  • {item.name} ×{item.qty}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isDamaged}
                onChange={(e) => setIsDamaged(e.target.checked)}
                className="w-5 h-5 rounded border-card-border text-danger focus:ring-danger focus:ring-offset-0"
              />
              <div>
                <span className="text-sm font-medium text-text-main">
                  Equipment is damaged
                </span>
                <p className="text-xs text-text-muted">
                  Check this if equipment has any damage or issues
                </p>
              </div>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-main mb-2">
              Notes / Comments {isDamaged && <span className="text-danger">*</span>}
              {isDamaged && <span className="text-xs text-danger ml-1">(Required for damaged items)</span>}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isDamaged ? "Describe the damage in detail..." : "Any observations or comments..."}
              className={`w-full px-4 py-3 rounded-lg bg-bg-dark border text-text-main placeholder:text-text-muted focus:border-accent-blue focus:outline-none resize-none ${isDamaged && !notes.trim() ? 'border-danger' : 'border-card-border'
                }`}
              rows={4}
            />
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => {
                setReturnModal({ open: false });
                setIsDamaged(false);
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
