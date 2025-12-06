'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatDateTime, parseStudentEmail } from '@/lib/utils';
import { CheckCircle, XCircle, Package, MapPin, CalendarDays } from 'lucide-react';

export default function LabApprovalsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleApproval = async (bookingId: string, action: 'approve' | 'reject') => {
    try {
      const res = await fetch(`/api/admin/approvals/${bookingId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        fetchPendingApprovals();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to process approval');
      }
    } catch (error) {
      alert('Failed to process approval');
    }
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-main">Booking Approvals</h1>
        <p className="text-text-muted">Review and approve booking requests</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-text-main">
            Pending Approvals ({bookings.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bookings.length === 0 ? (
            <p className="text-center text-text-muted py-8">No pending approvals</p>
          ) : (
            <div className="space-y-4">
              {bookings.map((booking) => {
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
                        onClick={() => handleApproval(booking._id, 'reject')}
                        className="border-danger text-danger hover:bg-danger/10 whitespace-nowrap"
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
