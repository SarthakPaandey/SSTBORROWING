'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';

export default function PenaltiesPage() {
  const [penalties, setPenalties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPenalties();
  }, []);

  const fetchPenalties = async () => {
    const res = await fetch('/api/admin/penalties');
    const data = await res.json();
    setPenalties(data.penalties);
    setLoading(false);
  };

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

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Penalty Management</h1>
        <p className="text-gray-600">View and manage user penalties</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Penalties</CardTitle>
        </CardHeader>
        <CardContent>
          {penalties.length === 0 ? (
            <p className="text-center text-gray-500">No penalties</p>
          ) : (
            <div className="space-y-4">
              {penalties.map((penalty) => (
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
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{penalty.reason}</p>
                    <p className="text-sm text-gray-600">
                      {formatDate(penalty.createdAt)}
                    </p>
                    {penalty.waivedBy && (
                      <p className="mt-1 text-sm text-green-600">
                        Waived by: {penalty.waivedBy}
                      </p>
                    )}
                  </div>
                  {!penalty.waivedBy && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleWaive(penalty.userId)}
                    >
                      Waive
                    </Button>
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
