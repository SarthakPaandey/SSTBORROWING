'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { formatDate } from '@/lib/utils';
import { Search, Shield, Ban, CheckCircle2 } from 'lucide-react';

type FilterStatus = 'all' | 'active' | 'waived';
type FilterPeriod = 'all' | 'today' | 'week' | 'month';

export default function PenaltiesPage() {
  const [penalties, setPenalties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // User search states
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchPenalties();
  }, []);

  const fetchPenalties = async () => {
    try {
      const res = await fetch('/api/admin/penalties');
      if (!res.ok) {
        if (res.status === 403) {
          setError('You do not have permission to view penalties. Admin access required.');
        } else if (res.status === 401) {
          setError('Please log in to view penalties.');
        } else {
          setError('Failed to load penalties. Please try again.');
        }
        console.error('Failed to fetch penalties:', res.status, res.statusText);
        setPenalties([]);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setPenalties(data.penalties || []);
      setError(null);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching penalties:', error);
      setError('An unexpected error occurred. Please try again.');
      setPenalties([]);
      setLoading(false);
    }
  };

  // Filter penalties based on selected filters
  const filteredPenalties = useMemo(() => {
    let filtered = [...penalties];

    // Filter by status (active/waived)
    if (filterStatus === 'active') {
      filtered = filtered.filter(p => !p.waivedBy);
    } else if (filterStatus === 'waived') {
      filtered = filtered.filter(p => p.waivedBy);
    }

    // Filter by time period
    const now = new Date();
    if (filterPeriod === 'today') {
      const startOfDay = new Date(now.setHours(0, 0, 0, 0));
      filtered = filtered.filter(p => new Date(p.createdAt) >= startOfDay);
    } else if (filterPeriod === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(p => new Date(p.createdAt) >= weekAgo);
    } else if (filterPeriod === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(p => new Date(p.createdAt) >= monthAgo);
    }

    // Filter by search query (name or email)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.userName?.toLowerCase().includes(query) ||
        p.userEmail?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [penalties, filterStatus, filterPeriod, searchQuery]);

  // Calculate stats from filtered data
  const stats = useMemo(() => {
    return {
      total: filteredPenalties.length,
      active: filteredPenalties.filter(p => !p.waivedBy).length,
      waived: filteredPenalties.filter(p => p.waivedBy).length,
      totalPoints: filteredPenalties.filter(p => !p.waivedBy).reduce((sum, p) => sum + p.points, 0)
    };
  }, [filteredPenalties]);

  const handleWaive = async (userId: string) => {
    if (!confirm('Are you sure you want to waive all penalties for this user?')) return;

    try {
      const res = await fetch('/api/admin/penalties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          action: 'waive',
          reason: 'Admin waived',
        }),
      });

      if (res.ok) {
        fetchPenalties();
        alert('Penalties waived successfully');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to waive penalties');
      }
    } catch (error) {
      alert('Failed to waive penalties');
    }
  };

  const handleBlockUser = async (userId: string, action: 'block' | 'unblock') => {
    const confirmMsg = action === 'block'
      ? 'Are you sure you want to block this user? They will not be able to access the system.'
      : 'Are you sure you want to unblock this user?';

    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action }),
      });

      if (res.ok) {
        fetchPenalties();
        alert(action === 'block' ? 'User blocked successfully' : 'User unblocked successfully');
      } else {
        const data = await res.json();
        alert(data.error || `Failed to ${action} user`);
      }
    } catch (error) {
      alert(`Failed to ${action} user`);
    }
  };

  const handleUserSearch = async () => {
    if (!userSearchQuery.trim() || userSearchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const res = await fetch(`/api/admin/users?q=${encodeURIComponent(userSearchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.users || []);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('User search failed:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      handleUserSearch();
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearchQuery]);

  if (loading) {
    return (
      <LoadingState
        title="Loading penalties"
        subtitle="Fetching user penalties and access status..."
        variant="galaxy"
      />
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardContent className="p-6">
            <div className="text-center">
              <div className="text-4xl mb-4">⚠️</div>
              <h2 className="text-xl font-bold text-text-main mb-2">Access Error</h2>
              <p className="text-text-muted mb-4">{error}</p>
              <Button onClick={() => window.location.reload()} variant="outline">
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">User & Penalty Management</h1>
        <p className="text-gray-600">Search and manage users, view penalties</p>
      </div>

      {/* User Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-accent-blue" />
            User Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search users by name or email..."
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-card-border rounded-lg bg-bg-dark text-text-main placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent transition-all"
            />
          </div>

          {searching && (
            <p className="text-sm text-text-muted">Searching...</p>
          )}

          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {searchResults.map((user) => (
                <div
                  key={user._id}
                  className="flex items-center justify-between p-4 rounded-lg border border-card-border bg-card hover:bg-accent-blue/5 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-text-main">{user.name}</p>
                      <span className="text-xs text-text-muted">
                        ({user.role})
                      </span>
                      {user.blocked && (
                        <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white flex items-center gap-1">
                          <Ban className="h-3 w-3" />
                          BLOCKED
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-text-muted">{user.email}</p>
                    {user.activePenaltyCount > 0 && (
                      <p className="text-xs text-warning mt-1">
                        {user.activePenaltyCount} active {user.activePenaltyCount === 1 ? 'penalty' : 'penalties'}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {user.blocked ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleBlockUser(user._id, 'unblock')}
                        className="flex items-center gap-1"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Unblock
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleBlockUser(user._id, 'block')}
                        className="flex items-center gap-1"
                      >
                        <Ban className="h-4 w-4" />
                        Block
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {userSearchQuery.trim().length >= 2 && searchResults.length === 0 && !searching && (
            <p className="text-center text-text-muted py-4">No users found matching "{userSearchQuery}"</p>
          )}
        </CardContent>
      </Card>

      {/* Penalty Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Penalty Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search penalties by user name or email
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <input
                type="text"
                placeholder="Search user..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-card-border rounded-lg bg-bg-dark text-text-main placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Filter Buttons */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={filterStatus === 'all' ? 'default' : 'outline'}
                  onClick={() => setFilterStatus('all')}
                >
                  All
                </Button>
                <Button
                  size="sm"
                  variant={filterStatus === 'active' ? 'default' : 'outline'}
                  onClick={() => setFilterStatus('active')}
                >
                  Active
                </Button>
                <Button
                  size="sm"
                  variant={filterStatus === 'waived' ? 'default' : 'outline'}
                  onClick={() => setFilterStatus('waived')}
                >
                  Waived
                </Button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Time Period
              </label>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={filterPeriod === 'all' ? 'default' : 'outline'}
                  onClick={() => setFilterPeriod('all')}
                >
                  All Time
                </Button>
                <Button
                  size="sm"
                  variant={filterPeriod === 'today' ? 'default' : 'outline'}
                  onClick={() => setFilterPeriod('today')}
                >
                  Today
                </Button>
                <Button
                  size="sm"
                  variant={filterPeriod === 'week' ? 'default' : 'outline'}
                  onClick={() => setFilterPeriod('week')}
                >
                  7 Days
                </Button>
                <Button
                  size="sm"
                  variant={filterPeriod === 'month' ? 'default' : 'outline'}
                  onClick={() => setFilterPeriod('month')}
                >
                  30 Days
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dynamic Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Penalties
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Active Penalties
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Waived Penalties
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.waived}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Active Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.totalPoints}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Penalties
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({filteredPenalties.length} {filteredPenalties.length === 1 ? 'result' : 'results'})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredPenalties.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              {penalties.length === 0 ? 'No penalties found' : 'No penalties match the current filters'}
            </p>
          ) : (
            <div className="space-y-4">
              {filteredPenalties.map((penalty) => (
                <div
                  key={penalty._id}
                  className="flex items-start justify-between rounded-lg border p-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        {penalty.userName} ({penalty.userEmail})
                      </p>
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                        {penalty.points} {penalty.points === 1 ? 'point' : 'points'}
                      </span>
                      {penalty.waivedBy && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                          Waived
                        </span>
                      )}
                      {penalty.userBlocked && (
                        <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                          BLOCKED
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{penalty.reason}</p>
                    <p className="text-sm text-gray-500">
                      {formatDate(penalty.createdAt)}
                    </p>
                    {penalty.waivedBy && (
                      <p className="mt-1 text-sm text-green-600">
                        Waived by admin on {formatDate(penalty.waivedAt)}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!penalty.waivedBy && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleWaive(penalty.userId)}
                      >
                        Waive
                      </Button>
                    )}
                    {penalty.userBlocked ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleBlockUser(penalty.userId, 'unblock')}
                      >
                        Unblock User
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleBlockUser(penalty.userId, 'block')}
                      >
                        Block User
                      </Button>
                    )}
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
