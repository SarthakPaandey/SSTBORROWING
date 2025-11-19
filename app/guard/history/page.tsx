'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Clock, User, Package, CheckCircle, AlertTriangle } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

export default function HistoryPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/guard/history');
      const data = await res.json();
      setHistory(data.bookings || []);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getConditionBadge = (condition: string) => {
    if (!condition) return null;

    const variants: Record<string, 'success' | 'warning' | 'destructive'> = {
      excellent: 'success',
      good: 'success',
      fair: 'warning',
      damaged: 'destructive',
    };

    return (
      <Badge variant={variants[condition] || 'default'}>
        {condition}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-64 animate-pulse rounded bg-card"></div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-card"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-accent-blue">Scan History</h1>
        <p className="text-text-muted">Recent check-ins and returns</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity ({history.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <h3 className="text-xl font-semibold text-text-main mb-2">No History</h3>
              <p className="text-text-muted">No completed returns yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((booking: any) => (
                <div
                  key={booking._id}
                  className="flex flex-col rounded-lg border border-card-border bg-bg-dark/50 p-4 transition-all hover:border-accent-blue/30"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="icon-circle w-10 h-10">
                        <Package className="h-5 w-5 text-accent-blue" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-text-main">{booking.resourceName}</h4>
                        <p className="text-sm text-text-muted">
                          {booking.userName || 'Unknown User'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="default">Completed</Badge>
                      {booking.returnCondition && getConditionBadge(booking.returnCondition)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center text-text-muted">
                      <CheckCircle className="h-4 w-4 mr-2 text-success" />
                      <div>
                        <p className="text-xs text-text-muted">Checked In</p>
                        <p className="text-text-main">{formatDateTime(booking.checkedInAt || booking.start)}</p>
                      </div>
                    </div>
                    <div className="flex items-center text-text-muted">
                      <Clock className="h-4 w-4 mr-2 text-badge-blue" />
                      <div>
                        <p className="text-xs text-text-muted">Returned</p>
                        <p className="text-text-main">{formatDateTime(booking.returnedAt || booking.updatedAt)}</p>
                      </div>
                    </div>
                  </div>

                  {booking.returnNotes && (
                    <div className="mt-3 rounded bg-bg-dark border border-card-border p-3">
                      <p className="text-xs text-text-muted mb-1">Notes:</p>
                      <p className="text-sm text-text-main">{booking.returnNotes}</p>
                    </div>
                  )}

                  {booking.items && booking.items.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-text-muted mb-2">Items:</p>
                      <div className="flex flex-wrap gap-2">
                        {booking.items.map((item: any, idx: number) => (
                          <span key={idx} className="text-xs bg-card-border/50 text-text-main px-2 py-1 rounded">
                            {item.name} ×{item.qty}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
