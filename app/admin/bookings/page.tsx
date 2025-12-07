'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/LoadingState';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { formatDateTime, parseStudentEmail } from '@/lib/utils';
import { XCircle, CheckCircle, AlertTriangle, Trash2, CheckSquare, Square } from 'lucide-react';
import { toast } from 'sonner';

type FilterStatus = 'all' | 'active' | 'completed' | 'cancelled';

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('active');

  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCancelModal, setBulkCancelModal] = useState(false);
  const [bulkReason, setBulkReason] = useState('');
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Override modal state
  const [overrideModal, setOverrideModal] = useState<{
    open: boolean;
    booking: any | null;
    action: 'force_cancel' | 'force_complete' | null;
  }>({ open: false, booking: null, action: null });
  const [overrideReason, setOverrideReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchBookings();
  }, []);

  // Clear selection when filter changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filter]);

  const fetchBookings = async () => {
    const res = await fetch('/api/bookings');
    const data = await res.json();
    setBookings(data.bookings || []);
    setLoading(false);
  };

  const handleOverride = async () => {
    if (!overrideModal.booking || !overrideModal.action) return;

    setProcessing(true);
    try {
      const res = await fetch(`/api/admin/bookings/${overrideModal.booking._id}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: overrideModal.action,
          reason: overrideReason || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(data.message || 'Override successful');
        fetchBookings();
        setOverrideModal({ open: false, booking: null, action: null });
        setOverrideReason('');
      } else {
        toast.error(data.error || 'Failed to override booking');
      }
    } catch {
      toast.error('Failed to override booking');
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkCancel = async () => {
    if (selectedIds.size === 0) return;

    setBulkProcessing(true);
    try {
      const res = await fetch('/api/admin/bookings/bulk-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingIds: Array.from(selectedIds),
          reason: bulkReason || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(data.message);
        fetchBookings();
        setSelectedIds(new Set());
        setBulkCancelModal(false);
        setBulkReason('');
      } else {
        toast.error(data.error || 'Failed to cancel bookings');
      }
    } catch {
      toast.error('Failed to cancel bookings');
    } finally {
      setBulkProcessing(false);
    }
  };

  const openOverrideModal = (booking: any, action: 'force_cancel' | 'force_complete') => {
    setOverrideModal({ open: true, booking, action });
    setOverrideReason('');
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getStatusBadge = (status: string, kind?: string) => {
    if (status === 'CONFIRMED') {
      if (kind === 'EQUIPMENT' || kind === 'LIBRARY') {
        return <Badge variant="warning">Awaiting Pickup</Badge>;
      }
      return <Badge variant="success">Confirmed</Badge>;
    }
    if (status === 'PENDING') return <Badge variant="warning">Pending</Badge>;
    if (status === 'CHECKED_IN') {
      if (kind === 'EQUIPMENT' || kind === 'LIBRARY') {
        return <Badge variant="default">Picked Up</Badge>;
      }
      return <Badge variant="default">Checked In</Badge>;
    }
    if (status === 'COMPLETED') {
      if (kind === 'EQUIPMENT' || kind === 'LIBRARY') {
        return <Badge variant="secondary">Returned</Badge>;
      }
      return <Badge variant="secondary">Completed</Badge>;
    }
    if (status === 'CANCELLED') return <Badge variant="destructive">Cancelled</Badge>;
    if (status === 'NO_SHOW') return <Badge variant="destructive">No Show</Badge>;
    return <Badge>{status}</Badge>;
  };

  const filteredBookings = bookings.filter(b => {
    if (filter === 'all') return true;
    if (filter === 'active') return ['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(b.status);
    if (filter === 'completed') return b.status === 'COMPLETED';
    if (filter === 'cancelled') return ['CANCELLED', 'NO_SHOW'].includes(b.status);
    return true;
  });

  const selectableBookings = filteredBookings.filter(b =>
    ['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(b.status)
  );

  const selectAll = () => {
    const ids = selectableBookings.map(b => b._id);
    setSelectedIds(new Set(ids));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  if (loading) {
    return (
      <LoadingState
        title="Loading bookings"
        subtitle="Fetching the latest booking activity..."
        variant="galaxy"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">All Bookings</h1>
          <p className="text-gray-600">View and manage all system bookings</p>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="sticky top-16 z-40 bg-gradient-to-r from-red-500/10 to-red-600/10 border border-red-500/30 rounded-lg p-4 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-3">
            <CheckSquare className="w-5 h-5 text-red-500" />
            <span className="font-medium text-text-main">
              {selectedIds.size} booking{selectedIds.size > 1 ? 's' : ''} selected
            </span>
            <Button size="sm" variant="ghost" onClick={deselectAll}>
              Clear
            </Button>
          </div>
          <Button
            variant="destructive"
            onClick={() => setBulkCancelModal(true)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Cancel Selected
          </Button>
        </div>
      )}

      <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterStatus)}>
        <TabsList>
          <TabsTrigger value="all">All ({bookings.length})</TabsTrigger>
          <TabsTrigger value="active">
            Active ({bookings.filter(b => ['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(b.status)).length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({bookings.filter(b => b.status === 'COMPLETED').length})
          </TabsTrigger>
          <TabsTrigger value="cancelled">
            Cancelled ({bookings.filter(b => ['CANCELLED', 'NO_SHOW'].includes(b.status)).length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)} Bookings
                </CardTitle>
                {selectableBookings.length > 0 && (filter === 'all' || filter === 'active') && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={selectedIds.size === selectableBookings.length ? deselectAll : selectAll}
                  >
                    {selectedIds.size === selectableBookings.length ? 'Deselect All' : 'Select All Active'}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredBookings.length === 0 ? (
                  <p className="text-center text-text-muted py-8">No bookings found</p>
                ) : (
                  filteredBookings.slice(0, 50).map((booking) => {
                    const studentInfo = booking.userEmail
                      ? parseStudentEmail(booking.userEmail)
                      : null;
                    const canOverride = ['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(booking.status);
                    const isSelected = selectedIds.has(booking._id);

                    return (
                      <div
                        key={booking._id}
                        className={`flex items-start gap-3 rounded-lg border p-4 transition-colors ${isSelected
                            ? 'border-red-500/50 bg-red-500/5'
                            : 'border-card-border bg-card hover:border-accent-blue/30'
                          }`}
                      >
                        {/* Checkbox for active bookings */}
                        {canOverride && (
                          <button
                            onClick={() => toggleSelection(booking._id)}
                            className="mt-1 text-text-muted hover:text-text-main transition-colors"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5 text-red-500" />
                            ) : (
                              <Square className="w-5 h-5" />
                            )}
                          </button>
                        )}

                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-text-main">{booking.resourceName}</p>
                            {getStatusBadge(booking.status, booking.kind)}
                            {booking.overrideBy && (
                              <Badge variant="secondary" className="text-xs">
                                Admin Override
                              </Badge>
                            )}
                          </div>
                          {studentInfo ? (
                            <div className="mt-2 space-y-1">
                              <p className="text-sm text-text-main">
                                <span className="font-medium">Student:</span> {studentInfo.name}
                              </p>
                              <p className="text-sm text-text-muted">
                                <span className="font-medium">Roll No:</span> {studentInfo.rollNumber}
                              </p>
                              <p className="text-xs text-text-muted">{studentInfo.email}</p>
                            </div>
                          ) : (
                            <p className="mt-1 text-sm text-text-muted">
                              User: {booking.userName || booking.userId}
                            </p>
                          )}
                          <p className="mt-2 text-sm text-text-muted">
                            {formatDateTime(booking.start)} - {formatDateTime(booking.end)}
                          </p>
                          {booking.overrideReason && (
                            <p className="mt-1 text-xs text-amber-500">
                              Override reason: {booking.overrideReason}
                            </p>
                          )}
                        </div>

                        {canOverride && (
                          <div className="flex gap-2 ml-4">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-500 border-red-500/30 hover:bg-red-500/10"
                              onClick={() => openOverrideModal(booking, 'force_cancel')}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Cancel
                            </Button>
                            {booking.status === 'CHECKED_IN' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-500 border-green-500/30 hover:bg-green-500/10"
                                onClick={() => openOverrideModal(booking, 'force_complete')}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Complete
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Override Confirmation Modal */}
      <Modal
        isOpen={overrideModal.open}
        onClose={() => {
          setOverrideModal({ open: false, booking: null, action: null });
          setOverrideReason('');
        }}
        title={overrideModal.action === 'force_cancel' ? 'Force Cancel Booking' : 'Force Complete Booking'}
        variant="warning"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-500">Admin Override</p>
              <p className="text-xs text-text-muted mt-1">
                {overrideModal.action === 'force_cancel'
                  ? 'This will cancel the booking without applying any penalty to the user.'
                  : 'This will mark the booking as completed early.'}
              </p>
            </div>
          </div>

          {overrideModal.booking && (
            <div className="p-3 bg-bg-dark rounded-lg space-y-1">
              <p className="text-sm font-medium">{overrideModal.booking.resourceName}</p>
              <p className="text-xs text-text-muted">
                {formatDateTime(overrideModal.booking.start)} - {formatDateTime(overrideModal.booking.end)}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Reason (optional)</label>
            <Input
              placeholder="Enter reason for override..."
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
            />
          </div>

          <div className="flex gap-3 justify-end">
            <Button
              variant="ghost"
              onClick={() => setOverrideModal({ open: false, booking: null, action: null })}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              variant={overrideModal.action === 'force_cancel' ? 'destructive' : 'default'}
              onClick={handleOverride}
              disabled={processing}
            >
              {processing ? 'Processing...' : 'Confirm'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bulk Cancel Modal */}
      <Modal
        isOpen={bulkCancelModal}
        onClose={() => {
          setBulkCancelModal(false);
          setBulkReason('');
        }}
        title="Bulk Cancel Bookings"
        variant="danger"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-500">
                Cancel {selectedIds.size} Booking{selectedIds.size > 1 ? 's' : ''}
              </p>
              <p className="text-xs text-text-muted mt-1">
                This will cancel all selected bookings without applying penalties. This action cannot be undone.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Reason (optional)</label>
            <Input
              placeholder="e.g., Facility maintenance, Event conflict..."
              value={bulkReason}
              onChange={(e) => setBulkReason(e.target.value)}
            />
          </div>

          <div className="flex gap-3 justify-end">
            <Button
              variant="ghost"
              onClick={() => setBulkCancelModal(false)}
              disabled={bulkProcessing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkCancel}
              disabled={bulkProcessing}
            >
              {bulkProcessing ? 'Cancelling...' : `Cancel ${selectedIds.size} Booking${selectedIds.size > 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
