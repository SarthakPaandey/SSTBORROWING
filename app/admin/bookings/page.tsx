'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatDateTime } from '@/lib/utils';

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    const res = await fetch('/api/bookings');
    const data = await res.json();
    setBookings(data.bookings);
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    if (status === 'CONFIRMED') return <Badge variant="success">Confirmed</Badge>;
    if (status === 'PENDING') return <Badge variant="warning">Pending</Badge>;
    if (status === 'CHECKED_IN') return <Badge variant="default">Checked In</Badge>;
    if (status === 'COMPLETED') return <Badge variant="secondary">Completed</Badge>;
    if (status === 'CANCELLED') return <Badge variant="destructive">Cancelled</Badge>;
    if (status === 'NO_SHOW') return <Badge variant="destructive">No Show</Badge>;
    return <Badge>{status}</Badge>;
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">All Bookings</h1>
        <p className="text-gray-600">View and manage all system bookings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {bookings.slice(0, 50).map((booking) => (
              <div
                key={booking._id}
                className="flex items-start justify-between rounded-lg border p-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{booking.resourceName}</p>
                    {getStatusBadge(booking.status)}
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    User: {booking.userId}
                  </p>
                  <p className="text-sm text-gray-600">
                    {formatDateTime(booking.start)} - {formatDateTime(booking.end)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
