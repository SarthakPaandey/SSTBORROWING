'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatDateTime, parseStudentEmail } from '@/lib/utils';
import { CheckCircle, XCircle, Package, MapPin, CalendarDays, AlertTriangle, X } from 'lucide-react';

export default function LabApprovalsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectingBookingId, setRejectingBookingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchPendingApprovals();
  }, []);

  const fetchPendingApprovals = async () => {
    try {
      const res = await fetch('/api/admin/lab-approvals');
      const data = await res.json();
      setBookings(data.bookings || []);
    } catch (error) {
      console.error('Failed to fetch approvals:', error);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const isExpired = (booking: any) => {
    const now = new Date();
    const endDate = new Date(booking.end);
    return endDate < now;
  };

  const handleApproval = async (bookingId: string, action: 'approve' | 'reject', reason?: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/approvals/${bookingId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      });

      if (res.ok) {
        setRejectingBookingId(null);
        setRejectReason('');
        fetchPendingApprovals();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to process approval');
      }
    } catch (error) {
      alert('Failed to process approval');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openRejectModal = (bookingId: string) => {
    setRejectingBookingId(bookingId);
    setRejectReason('');
  };

  const closeRejectModal = () => {
    setRejectingBookingId(null);
    setRejectReason('');
  };

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'FACILITY':
        return <MapPin className="h-5 w-5 text-accent-blue" />;
      case 'ROOM':
        return <CalendarDays className="h-5 w-5 text-accent-blue" />;
      case 'LAB_EQUIPMENT':
      case 'SPORTS_EQUIPMENT':
        return <Package className="h-5 w-5 text-accent-blue" />;
      default:
        return <Package className="h-5 w-5 text-accent-blue" />;
    }
  };

  const getResourceTypeLabel = (type: string) => {
    switch (type) {
      case 'FACILITY':
        return 'Facility';
      case 'ROOM':
        return 'Room';
      case 'LAB_EQUIPMENT':
        return 'Lab Equipment';
      case 'SPORTS_EQUIPMENT':
        return 'Sports Equipment';
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-64 animate-pulse rounded bg-card"></div>
        <div className="h-96 animate-pulse rounded-lg bg-card"></div>
      </div>
    );
  }

  // Separate active and expired bookings
  const activeBookings = bookings.filter(b => !isExpired(b));
  const expiredBookings = bookings.filter(b => isExpired(b));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-main">Booking Approvals</h1>
        <p className="text-text-muted">Review and approve booking requests</p>
      </div>

      {/* Rejection Reason Modal */}
      {rejectingBookingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-main">Reject Booking</h3>
              <button onClick={closeRejectModal} className="text-text-muted hover:text-text-main">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-text-muted">
                Reason for rejection (optional)
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g., Item not available, Student has pending returns..."
                className="w-full h-24 px-3 py-2 rounded-lg border border-card-border bg-bg-dark text-text-main placeholder:text-text-muted focus:border-accent-blue focus:outline-none resize-none"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                variant="ghost"
                onClick={closeRejectModal}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleApproval(rejectingBookingId, 'reject', rejectReason)}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Rejecting...' : 'Reject Booking'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-text-main">
            Pending Approvals ({activeBookings.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeBookings.length === 0 && expiredBookings.length === 0 ? (
            <p className="text-center text-text-muted py-8">No pending approvals</p>
          ) : (
            <div className="space-y-4">
              {activeBookings.map((booking) => {
                const studentInfo = booking.userEmail
                  ? parseStudentEmail(booking.userEmail)
                  : null;

                return (
                  <div
                    key={booking._id}
                    className="flex items-start gap-4 rounded-lg border border-card-border bg-card p-4 hover:border-accent-blue/30 transition-colors"
                  >
                    <div className="icon-circle mt-1">
                      {getResourceIcon(booking.resourceType)}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-text-main text-lg">
                          {booking.resourceName}
                        </p>
                        <Badge variant="default">
                          {getResourceTypeLabel(booking.resourceType)}
                        </Badge>
                        <Badge variant="warning">Pending Approval</Badge>
                      </div>

                      {studentInfo ? (
                        <div className="space-y-1">
                          <p className="text-sm text-text-main">
                            <span className="font-medium">Student:</span> {studentInfo.name}
                          </p>
                          <p className="text-sm text-text-muted">
                            <span className="font-medium">Roll No:</span> {studentInfo.rollNumber}
                          </p>
                          <p className="text-xs text-text-muted">{studentInfo.email}</p>
                        </div>
                      ) : (
                        <p className="text-sm text-text-muted">
                          <span className="font-medium">User:</span>{' '}
                          {booking.userName || booking.userId}
                        </p>
                      )}

                      <div className="bg-bg-dark rounded-lg p-3 space-y-2">
                        <p className="text-sm text-text-main">
                          <span className="font-medium">Start:</span>{' '}
                          {formatDateTime(booking.start)}
                        </p>
                        <p className="text-sm text-text-main">
                          <span className="font-medium">End:</span> {formatDateTime(booking.end)}
                        </p>
                      </div>

                      {booking.items && booking.items.length > 0 && (
                        <div className="bg-bg-dark rounded-lg p-3">
                          <p className="text-sm font-medium text-text-main mb-2">
                            Requested Items:
                          </p>
                          <div className="space-y-1">
                            {booking.items.map((item: any, idx: number) => (
                              <div
                                key={idx}
                                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm bg-bg-very-dark rounded px-3 py-2"
                              >
                                <span className="text-text-main font-medium">{item.name}</span>
                                <span className="text-text-muted">×{item.qty}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Borrow Reason - Show if provided */}
                      {booking.borrowReason && (
                        <div className="bg-accent-purple-1/10 border border-accent-purple-1/30 rounded-lg p-3">
                          <p className="text-sm font-medium text-accent-purple-1 mb-1 flex items-center gap-2">
                            📝 Reason for Borrowing:
                          </p>
                          <p className="text-sm text-text-main whitespace-pre-wrap">
                            {booking.borrowReason}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        variant="gradient"
                        onClick={() => handleApproval(booking._id, 'approve')}
                        className="btn-ripple whitespace-nowrap"
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openRejectModal(booking._id)}
                        className="border-danger text-danger hover:bg-danger/10 whitespace-nowrap"
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  </div>
                );
              })}

              {/* Expired Bookings Section */}
              {expiredBookings.length > 0 && (
                <div className="mt-6 pt-6 border-t border-card-border">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                    <h3 className="font-semibold text-warning">Expired Bookings ({expiredBookings.length})</h3>
                    <p className="text-sm text-text-muted">These have passed and can only be rejected</p>
                  </div>
                  <div className="space-y-3">
                    {expiredBookings.map((booking) => {
                      const studentInfo = booking.userEmail
                        ? parseStudentEmail(booking.userEmail)
                        : null;

                      return (
                        <div
                          key={booking._id}
                          className="flex items-center justify-between rounded-lg border border-warning/30 bg-warning/5 p-4"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-text-main">{booking.resourceName}</p>
                              <Badge variant="destructive">Expired</Badge>
                            </div>
                            <p className="text-sm text-text-muted">
                              {studentInfo ? studentInfo.name : booking.userName} • {formatDateTime(booking.start)} - {formatDateTime(booking.end)}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openRejectModal(booking._id)}
                            className="border-warning text-warning hover:bg-warning/10"
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Dismiss
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

