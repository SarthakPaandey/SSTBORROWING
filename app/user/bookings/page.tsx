'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { formatDateTime } from '@/lib/utils';
import { QrCode, X } from 'lucide-react';

export default function BookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [qrModal, setQrModal] = useState<{ open: boolean; qrImage?: string; booking?: any }>({
    open: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    const res = await fetch('/api/bookings?me=true');
    const data = await res.json();
    setBookings(data.bookings);
    setLoading(false);
  };

  const handleGenerateQR = async (bookingId: string) => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/qr`, {
        method: 'POST',
      });
      const data = await res.json();

      if (res.ok) {
        const booking = bookings.find((b) => b._id === bookingId);
        setQrModal({ open: true, qrImage: data.qrImage, booking });
      } else {
        alert(data.error || 'Failed to generate QR code');
      }
    } catch (error) {
      alert('Failed to generate QR code');
    }
  };

  const handleCancel = async (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;

    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'PATCH',
      });

      if (res.ok) {
        fetchBookings();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to cancel booking');
      }
    } catch (error) {
      alert('Failed to cancel booking');
    }
  };

  const getStatusBadge = (status: string, approval: string) => {
    if (status === 'PENDING' && approval === 'PENDING') {
      return <Badge variant="warning">Awaiting Approval</Badge>;
    }
    if (status === 'CONFIRMED') {
      return <Badge variant="success">Confirmed</Badge>;
    }
    if (status === 'CHECKED_IN') {
      return <Badge variant="default">Checked In</Badge>;
    }
    if (status === 'COMPLETED') {
      return <Badge variant="secondary">Completed</Badge>;
    }
    if (status === 'CANCELLED') {
      return <Badge variant="destructive">Cancelled</Badge>;
    }
    if (status === 'NO_SHOW') {
      return <Badge variant="destructive">No Show</Badge>;
    }
    return <Badge>{status}</Badge>;
  };

  const upcomingBookings = bookings.filter(
    (b) => ['CONFIRMED', 'PENDING', 'CHECKED_IN'].includes(b.status) && new Date(b.start) >= new Date()
  );

  const pastBookings = bookings.filter(
    (b) => !['CONFIRMED', 'PENDING', 'CHECKED_IN'].includes(b.status) || new Date(b.start) < new Date()
  );

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Bookings</h1>
        <p className="text-gray-600">View and manage your bookings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingBookings.length === 0 ? (
            <p className="text-center text-gray-500">No upcoming bookings</p>
          ) : (
            <div className="space-y-4">
              {upcomingBookings.map((booking) => (
                <div
                  key={booking._id}
                  className="flex items-start justify-between rounded-lg border p-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{booking.resourceName}</p>
                      {getStatusBadge(booking.status, booking.approval)}
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      {formatDateTime(booking.start)} - {formatDateTime(booking.end)}
                    </p>
                    {booking.items && booking.items.length > 0 && (
                      <div className="mt-2 text-sm text-gray-600">
                        Items: {booking.items.map((item: any) => `${item.name} (${item.qty})`).join(', ')}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {booking.status === 'CONFIRMED' && (
                      <Button
                        size="sm"
                        onClick={() => handleGenerateQR(booking._id)}
                      >
                        <QrCode className="mr-2 h-4 w-4" />
                        Get QR
                      </Button>
                    )}
                    {['CONFIRMED', 'PENDING'].includes(booking.status) && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleCancel(booking._id)}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Past Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          {pastBookings.length === 0 ? (
            <p className="text-center text-gray-500">No past bookings</p>
          ) : (
            <div className="space-y-4">
              {pastBookings.slice(0, 10).map((booking) => (
                <div
                  key={booking._id}
                  className="flex items-start justify-between rounded-lg border p-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{booking.resourceName}</p>
                      {getStatusBadge(booking.status, booking.approval)}
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      {formatDateTime(booking.start)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={qrModal.open}
        onClose={() => setQrModal({ open: false })}
        title="Your QR Code"
        size="md"
      >
        {qrModal.qrImage && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <img src={qrModal.qrImage} alt="QR Code" className="w-64 h-64" />
            </div>
            <div className="text-center">
              <p className="font-medium">{qrModal.booking?.resourceName}</p>
              <p className="text-sm text-gray-600">
                Show this QR code to the guard for check-in
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
