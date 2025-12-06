'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Users, Clock, MapPin, Calendar, Mail, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';

export default function AdminGroupBookingsPage() {
  const [groupBookings, setGroupBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchGroupBookings();
  }, [filter]);

  const fetchGroupBookings = async () => {
    setLoading(true);
    try {
      const url = filter === 'all'
        ? '/api/admin/group-bookings'
        : `/api/admin/group-bookings?status=${filter}`;

      const res = await fetch(url);
      const data = await res.json();
      setGroupBookings(data.groupBookings || []);
    } catch (err) {
      console.error('Failed to fetch group bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string) => formatDateTime(date);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return <Badge variant="success">Confirmed</Badge>;
      case 'PENDING_CONFIRMATIONS':
        return <Badge variant="warning">Pending</Badge>;
      case 'CANCELLED':
        return <Badge variant="destructive">Cancelled</Badge>;
      case 'EXPIRED':
        return <Badge variant="default">Expired</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getMemberStatusIcon = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'REJECTED':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'PENDING':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return null;
    }
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

  const stats = {
    total: groupBookings.length,
    confirmed: groupBookings.filter(gb => gb.status === 'CONFIRMED').length,
    pending: groupBookings.filter(gb => gb.status === 'PENDING_CONFIRMATIONS').length,
    cancelled: groupBookings.filter(gb => gb.status === 'CANCELLED').length,
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-accent-blue">Group Bookings</h1>
        <div className="h-96 animate-pulse rounded-lg bg-card"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-accent-blue">Group Bookings</h1>
        <p className="text-text-muted">Manage team sports group bookings</p>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-text-muted">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-text-muted">Confirmed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.confirmed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-text-muted">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-text-muted">Cancelled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.cancelled}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="PENDING_CONFIRMATIONS">Pending</TabsTrigger>
          <TabsTrigger value="CONFIRMED">Confirmed</TabsTrigger>
          <TabsTrigger value="CANCELLED">Cancelled</TabsTrigger>
          <TabsTrigger value="EXPIRED">Expired</TabsTrigger>
        </TabsList>

        {['all', 'PENDING_CONFIRMATIONS', 'CONFIRMED', 'CANCELLED', 'EXPIRED'].map((tabValue) => (
          <TabsContent key={tabValue} value={tabValue} className="space-y-4 mt-6">
            {groupBookings.length === 0 ? (
              <Card>
                <CardContent className="p-6">
                  <p className="text-center text-text-muted">No group bookings found</p>
                </CardContent>
              </Card>
            ) : (
              groupBookings.map((gb) => (
                <Card key={gb._id} className="border-l-4 border-l-accent-blue">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{gb.resourceName}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <MapPin className="h-4 w-4" />
                          {gb.resourceLocation}
                        </CardDescription>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {getStatusBadge(gb.status)}
                        {gb.status === 'PENDING_CONFIRMATIONS' && (
                          <Badge variant="warning" className="text-xs">
                            <Clock className="mr-1 h-3 w-3" />
                            {getTimeRemaining(gb.expiresAt)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Booking Details */}
                    <div className="grid md:grid-cols-2 gap-4 p-4 bg-gradient-to-br from-accent-blue/5 to-transparent rounded-lg border border-accent-blue/10">
                      <div>
                        <span className="text-sm text-text-muted">Organizer</span>
                        <p className="font-medium flex items-center gap-2 text-text-main">
                          <Mail className="h-4 w-4 text-accent-blue" />
                          {gb.organizerName}
                        </p>
                        <p className="text-sm text-text-muted">{gb.organizerEmail}</p>
                      </div>
                      <div>
                        <span className="text-sm text-text-muted">Booking Time</span>
                        <p className="font-medium flex items-center gap-2 text-text-main">
                          <Calendar className="h-4 w-4 text-accent-blue" />
                          {gb.bookingStart ? formatDate(gb.bookingStart) : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm text-text-muted">Confirmations</span>
                        <p className="font-medium flex items-center gap-2 text-text-main">
                          <Users className="h-4 w-4 text-accent-blue" />
                          {gb.confirmedCount} / {gb.requiredMinimum} required
                        </p>
                      </div>
                      <div>
                        <span className="text-sm text-text-muted">Created</span>
                        <p className="font-medium text-text-main">{formatDate(gb.createdAt)}</p>
                      </div>
                    </div>

                    {/* Members List */}
                    <div>
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Team Members ({gb.members.length + 1} total)
                      </h4>
                      <div className="space-y-2">
                        {/* Organizer */}
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 bg-gradient-to-r from-accent-blue/10 to-accent-blue/5 rounded-lg border border-accent-blue/20">
                          <div className="flex items-center gap-3">
                            <CheckCircle className="h-4 w-4" style={{ color: 'var(--success)' }} />
                            <div>
                              <p className="font-medium text-sm text-text-main">{gb.organizerName}</p>
                              <p className="text-xs text-text-muted">{gb.organizerEmail}</p>
                            </div>
                          </div>
                          <Badge variant="default" className="text-xs">Organizer</Badge>
                        </div>

                        {/* Other Members */}
                        {gb.members.map((member: any, index: number) => (
                          <div
                            key={index}
                            className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 bg-gradient-to-r from-white/[0.03] to-transparent rounded-lg border border-white/[0.05] hover:border-white/10 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              {getMemberStatusIcon(member.status)}
                              <div>
                                <p className="font-medium text-sm text-text-main">{member.userName}</p>
                                <p className="text-xs text-text-muted">{member.email}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge
                                variant={
                                  member.status === 'CONFIRMED'
                                    ? 'success'
                                    : member.status === 'REJECTED'
                                      ? 'destructive'
                                      : 'warning'
                                }
                                className="text-xs"
                              >
                                {member.status}
                              </Badge>
                              {member.respondedAt && (
                                <p className="text-xs text-text-muted mt-1">
                                  {formatDate(member.respondedAt)}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Additional Info */}
                    {gb.status === 'PENDING_CONFIRMATIONS' && (
                      <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-3 text-sm">
                        <p className="font-semibold text-yellow-400 mb-1">
                          <AlertCircle className="inline h-4 w-4 mr-1" />
                          Waiting for confirmations
                        </p>
                        <p className="text-yellow-300/80">
                          {gb.confirmedCount} of {gb.requiredMinimum} minimum members confirmed.
                          Expires: {formatDate(gb.expiresAt)}
                        </p>
                      </div>
                    )}

                    {gb.status === 'CONFIRMED' && (
                      <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-3 text-sm text-green-400">
                        <CheckCircle className="inline h-4 w-4 mr-1" />
                        Group booking confirmed with {gb.confirmedCount} members
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
