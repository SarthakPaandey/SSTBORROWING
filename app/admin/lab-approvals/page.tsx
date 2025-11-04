'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatDateTime } from '@/lib/utils';
import { CheckCircle, XCircle } from 'lucide-react';

export default function LabApprovalsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingApprovals();
  }, []);

  const fetchPendingApprovals = async () => {
    const res = await fetch('/api/bookings?status=PENDING');
    const data = await res.json();
    const pending = data.bookings.filter((b: any) => b.approval === 'PENDING');
    setBookings(pending);
    setLoading(false);
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

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Lab Equipment Approvals</h1>
        <p className="text-gray-600">Review and approve lab equipment requests</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Approvals ({bookings.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {bookings.length === 0 ? (
            <p className="text-center text-gray-500">No pending approvals</p>
          ) : (
            <div className="space-y-4">
              {bookings.map((booking) => (
                <div
                  key={booking._id}
                  className="flex items-start justify-between rounded-lg border p-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{booking.resourceName}</p>
                      <Badge variant="warning">Pending</Badge>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      User: {booking.userId}
                    </p>
                    <p className="text-sm text-gray-600">
                      Time: {formatDateTime(booking.start)} - {formatDateTime(booking.end)}
                    </p>
                    {booking.items && booking.items.length > 0 && (
                      <div className="mt-2 text-sm text-gray-600">
                        <p className="font-medium">Requested Items:</p>
                        <ul className="list-disc list-inside">
                          {booking.items.map((item: any, idx: number) => (
                            <li key={idx}>
                              {item.name} × {item.qty}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleApproval(booking._id, 'approve')}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleApproval(booking._id, 'reject')}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
