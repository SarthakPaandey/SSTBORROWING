'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Users, Clock, MapPin, CheckCircle, XCircle, Calendar, Sparkles, AlertTriangle } from 'lucide-react';
import { GroupInvitation } from '@/types/booking';
import { formatDateTime } from '@/lib/utils';

interface InvitationsResponse {
  pending: GroupInvitation[];
  confirmed: GroupInvitation[];
}

export default function GroupInvitationsPage() {
  const [invitations, setInvitations] = useState<InvitationsResponse>({ pending: [], confirmed: [] });
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

      await fetchInvitations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setResponding(null);
    }
  };

  const formatDate = (date: string | Date) => formatDateTime(date);

  const getTimeRemaining = (expiresAt: string | Date) => {
    const now = new Date().getTime();
    const expiry = new Date(expiresAt).getTime();
    const diff = expiry - now;

    if (diff <= 0) return { text: 'Expired', urgent: true };

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return { text: `${hours}h ${minutes}m left`, urgent: hours < 2 };
    }
    return { text: `${minutes}m left`, urgent: true };
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="text-4xl">👥</span>
          <h1 className="text-3xl font-bold">Group Invitations</h1>
        </div>
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 skeleton rounded-xl" style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      </div>
    );
  }

  const totalPending = invitations.pending.length;
  const totalConfirmed = invitations.confirmed.length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-fade-in-down">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-4xl animate-bounce-subtle">👥</span>
          <h1 className="text-3xl font-bold">Group Invitations</h1>
        </div>
        <p className="text-text-muted">Manage your group booking invitations ✨</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-4 animate-fade-in-up">
        <div className={`p-4 rounded-xl border ${totalPending > 0 ? 'bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20' : 'bg-bg-dark/50 border-card-border'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${totalPending > 0 ? 'bg-warning/20' : 'bg-text-muted/10'}`}>
              <span className="text-2xl">{totalPending > 0 ? '📨' : '📭'}</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-text-main">{totalPending}</p>
              <p className="text-sm text-text-muted">Pending</p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-gradient-to-br from-success/10 to-success/5 border border-success/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/20">
              <span className="text-2xl">✅</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-text-main">{totalConfirmed}</p>
              <p className="text-sm text-text-muted">Confirmed</p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-danger/10 border border-danger/30 p-4 text-sm text-danger flex items-center gap-2 animate-shake">
          <AlertTriangle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* Pending Invitations */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <span className="text-2xl">📨</span>
          Pending Invitations
          {totalPending > 0 && (
            <Badge variant="warning" pulse>{totalPending}</Badge>
          )}
        </h2>

        {invitations.pending.length === 0 ? (
          <Card className="animate-fade-in-up">
            <CardContent className="p-8">
              <div className="text-center">
                <span className="text-5xl block mb-4">📭</span>
                <p className="text-text-muted">No pending invitations</p>
                <p className="text-sm text-text-muted/70 mt-1">You&apos;re all caught up!</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          invitations.pending.map((inv, index) => {
            const timeInfo = getTimeRemaining(inv.expiresAt);

            return (
              <Card
                key={inv._id}
                className={`
                  border-warning/30 bg-gradient-to-r from-warning/5 to-transparent
                  animate-fade-in-left
                  ${timeInfo.urgent ? 'animate-pulse' : ''}
                `}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-warning/20">
                        <span className="text-2xl">🎉</span>
                      </div>
                      <div>
                        <CardTitle className="text-lg">{inv.resourceName}</CardTitle>
                        <CardDescription className="flex items-center gap-1.5 mt-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {inv.location}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge
                      variant={timeInfo.urgent ? 'destructive' : 'warning'}
                      pulse={timeInfo.urgent}
                      icon="⏰"
                    >
                      {timeInfo.text}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Info grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-bg-dark/50">
                      <p className="text-xs text-text-muted mb-1">👤 Organizer</p>
                      <p className="font-medium text-sm truncate">{inv.organizerEmail}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-bg-dark/50">
                      <p className="text-xs text-text-muted mb-1">📅 Date & Time</p>
                      <p className="font-medium text-sm">{formatDate(inv.start)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-bg-dark/50">
                      <p className="text-xs text-text-muted mb-1">✅ Status</p>
                      <p className="font-medium text-sm">
                        <span className="text-success">{inv.confirmedCount}</span>
                        <span className="text-text-muted">/{inv.requiredMinimum} confirmed</span>
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-bg-dark/50">
                      <p className="text-xs text-text-muted mb-1">👥 Total</p>
                      <p className="font-medium text-sm flex items-center gap-1">
                        <Users className="h-4 w-4 text-accent-blue" />
                        {inv.totalMembers} people
                      </p>
                    </div>
                  </div>

                  {/* Info box */}
                  <div className="rounded-xl bg-accent-blue/5 border border-accent-blue/20 p-4">
                    <p className="font-semibold text-accent-blue text-sm mb-2 flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      Important Info
                    </p>
                    <ul className="text-xs text-text-muted space-y-1.5">
                      <li className="flex items-start gap-2">
                        <span className="text-warning">⚠️</span>
                        Cancel early if the group can't make it to avoid blocking the slot
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-success">✅</span>
                        Booking confirmed when {inv.requiredMinimum}+ members accept
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-accent-blue">📱</span>
                        Only organizer can generate QR code
                      </li>
                    </ul>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3">
                    <Button
                      onClick={() => handleRespond(inv.groupBookingId, 'ACCEPT')}
                      disabled={responding === inv.groupBookingId}
                      loading={responding === inv.groupBookingId}
                      variant="success"
                      className="flex-1"
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Accept
                    </Button>
                    <Button
                      onClick={() => handleRespond(inv.groupBookingId, 'REJECT')}
                      disabled={responding === inv.groupBookingId}
                      variant="destructive"
                      className="flex-1"
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Decline
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Confirmed Group Bookings */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <span className="text-2xl">✅</span>
          Confirmed Group Bookings
          {totalConfirmed > 0 && (
            <Badge variant="success">{totalConfirmed}</Badge>
          )}
        </h2>

        {invitations.confirmed.length === 0 ? (
          <Card className="animate-fade-in-up">
            <CardContent className="p-8">
              <div className="text-center">
                <span className="text-5xl block mb-4">🎯</span>
                <p className="text-text-muted">No confirmed group bookings</p>
                <p className="text-sm text-text-muted/70 mt-1">Accept invitations to see them here</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          invitations.confirmed.map((inv, index) => (
            <Card
              key={inv._id}
              className="border-success/30 bg-gradient-to-r from-success/5 to-transparent animate-fade-in-left"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-success/20">
                      <span className="text-2xl">🎊</span>
                    </div>
                    <div>
                      <CardTitle className="text-lg">{inv.resourceName}</CardTitle>
                      <CardDescription className="flex items-center gap-1.5 mt-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {inv.location}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="success" icon="✅">Confirmed</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-bg-dark/50">
                    <p className="text-xs text-text-muted mb-1">👤 Organizer</p>
                    <p className="font-medium text-sm truncate">{inv.organizerEmail}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-bg-dark/50">
                    <p className="text-xs text-text-muted mb-1">📅 Date & Time</p>
                    <p className="font-medium text-sm">{formatDate(inv.start)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-bg-dark/50">
                    <p className="text-xs text-text-muted mb-1">👥 Members</p>
                    <p className="font-medium text-sm flex items-center gap-1">
                      <Users className="h-4 w-4 text-success" />
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
