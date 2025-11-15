'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Users, Clock, MapPin, CheckCircle, XCircle } from 'lucide-react';

export default function GroupInvitationsPage() {
  const [invitations, setInvitations] = useState<any>({ pending: [], confirmed: [] });
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchInvitations();
  }, []);

  const fetchInvitations = async () => {
    try {
      const res = await fetch('/api/group-bookings/invitations');
      const data = await res.json();
      setInvitations(data);
    } catch (err) {
      console.error('Failed to fetch invitations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (groupBookingId: string, response: 'ACCEPT' | 'REJECT') => {
    setResponding(groupBookingId);
    setError('');

    try {
      const res = await fetch(`/api/group-bookings/${groupBookingId}/respond`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to respond');
      }

      // Refresh invitations
      await fetchInvitations();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setResponding(null);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date().getTime();
    const expiry = new Date(expiresAt).getTime();
    const diff = expiry - now;

    if (diff <= 0) return 'Expired';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-accent-blue">Group Invitations</h1>
        <div className="h-96 animate-pulse rounded-lg bg-card"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-accent-blue">Group Invitations</h1>
        <p className="text-text-muted">Pending and confirmed group bookings</p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Pending Invitations */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Pending Invitations</h2>

        {invitations.pending.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-center text-text-muted">No pending invitations</p>
            </CardContent>
          </Card>
        ) : (
          invitations.pending.map((inv: any) => (
            <Card key={inv._id} className="border-blue-200">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{inv.resourceName}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <MapPin className="h-4 w-4" />
                      {inv.location}
                    </CardDescription>
                  </div>
                  <Badge variant="warning">
                    <Clock className="mr-1 h-3 w-3" />
                    {getTimeRemaining(inv.expiresAt)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-text-muted">Organizer:</span>
                    <p className="font-medium">{inv.organizerEmail}</p>
                  </div>
                  <div>
                    <span className="text-text-muted">Date & Time:</span>
                    <p className="font-medium">{formatDate(inv.start)}</p>
                  </div>
                  <div>
                    <span className="text-text-muted">Status:</span>
                    <p className="font-medium">
                      {inv.confirmedCount}/{inv.requiredMinimum} confirmed
                    </p>
                  </div>
                  <div>
                    <span className="text-text-muted">Total Members:</span>
                    <p className="font-medium flex items-center">
                      <Users className="mr-1 h-4 w-4" />
                      {inv.totalMembers} people
                    </p>
                  </div>
                </div>

                <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
                  <p className="font-semibold mb-1">Important:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>All confirmed members share penalty points for no-shows</li>
                    <li>Booking confirmed when {inv.requiredMinimum}+ members accept</li>
                    <li>Only organizer can generate QR code</li>
                  </ul>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleRespond(inv.groupBookingId, 'ACCEPT')}
                    disabled={responding === inv.groupBookingId}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    {responding === inv.groupBookingId ? 'Accepting...' : 'Accept'}
                  </Button>
                  <Button
                    onClick={() => handleRespond(inv.groupBookingId, 'REJECT')}
                    disabled={responding === inv.groupBookingId}
                    variant="destructive"
                    className="flex-1"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    {responding === inv.groupBookingId ? 'Rejecting...' : 'Reject'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Confirmed Group Bookings */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Confirmed Group Bookings</h2>

        {invitations.confirmed.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-center text-text-muted">No confirmed group bookings</p>
            </CardContent>
          </Card>
        ) : (
          invitations.confirmed.map((inv: any) => (
            <Card key={inv._id} className="border-green-200">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{inv.resourceName}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <MapPin className="h-4 w-4" />
                      {inv.location}
                    </CardDescription>
                  </div>
                  <Badge variant="success">Confirmed</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-text-muted">Organizer:</span>
                    <p className="font-medium">{inv.organizerEmail}</p>
                  </div>
                  <div>
                    <span className="text-text-muted">Date & Time:</span>
                    <p className="font-medium">{formatDate(inv.start)}</p>
                  </div>
                  <div>
                    <span className="text-text-muted">Members:</span>
                    <p className="font-medium flex items-center">
                      <Users className="mr-1 h-4 w-4" />
                      {inv.confirmedCount} confirmed
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
