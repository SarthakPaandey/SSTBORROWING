'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/LoadingState';
import { formatDateTime, parseStudentEmail } from '@/lib/utils';

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

  const getStatusBadge = (status: string, kind?: string) => {
    if (status === 'CONFIRMED') {
      // For equipment/library, make it clear the item is awaiting pickup
      if (kind === 'EQUIPMENT' || kind === 'LIBRARY') {
        return <Badge variant="warning">Awaiting Pickup</Badge>;
      }
      return <Badge variant="success">Confirmed</Badge>;
    }
    if (status === 'PENDING') return <Badge variant="warning">Pending</Badge>;
    if (status === 'CHECKED_IN') {
      // For equipment/library, it means the user has the item
      if (kind === 'EQUIPMENT' || kind === 'LIBRARY') {
        return <Badge variant="default">Picked Up</Badge>;
      }
      return <Badge variant="default">Checked In</Badge>;
    }
    if (status === 'COMPLETED') {
      // For equipment/library, it means returned
      if (kind === 'EQUIPMENT' || kind === 'LIBRARY') {
        return <Badge variant="secondary">Returned</Badge>;
      }
      return <Badge variant="secondary">Completed</Badge>;
    }
    if (status === 'CANCELLED') return <Badge variant="destructive">Cancelled</Badge>;
    if (status === 'NO_SHOW') return <Badge variant="destructive">No Show</Badge>;
    return <Badge>{status}</Badge>;
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
            {bookings.slice(0, 50).map((booking) => {
              const studentInfo = booking.userEmail
                ? parseStudentEmail(booking.userEmail)
                : null;

              return (
                <div
                  key={booking._id}
                  className="flex items-start justify-between rounded-lg border border-card-border bg-card p-4 hover:border-accent-blue/30 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-text-main">{booking.resourceName}</p>
                      {getStatusBadge(booking.status, booking.kind)}
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
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
