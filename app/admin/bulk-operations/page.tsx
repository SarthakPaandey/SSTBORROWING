'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/LoadingState';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
    Zap,
    CheckCircle2,
    XCircle,
    Calendar,
    Package,
    RefreshCw,
    AlertTriangle,
    Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface PendingBooking {
    _id: string;
    resourceId: string;
    resourceName: string;
    resourceType: string;
    userId: string;
    start: string;
    end: string;
    createdAt: string;
    kind: string;
}

interface Resource {
    _id: string;
    name: string;
    type: string;
}

export default function BulkOperationsPage() {
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [pendingBookings, setPendingBookings] = useState<PendingBooking[]>([]);
    const [resources, setResources] = useState<Resource[]>([]);
    const [resourceTypes, setResourceTypes] = useState<string[]>([]);

    // Selection state
    const [selectedBookings, setSelectedBookings] = useState<Set<string>>(new Set());

    // Cancel by date state
    const [cancelDate, setCancelDate] = useState('');
    const [cancelResourceType, setCancelResourceType] = useState('');
    const [cancelReason, setCancelReason] = useState('');

    // Rejection reason
    const [rejectReason, setRejectReason] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/bulk-operations');
            const data = await res.json();
            setPendingBookings(data.pendingBookings || []);
            setResources(data.resources || []);
            setResourceTypes(data.resourceTypes || []);
        } catch (error) {
            console.error('Failed to fetch data:', error);
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const toggleBookingSelection = (id: string) => {
        const newSelection = new Set(selectedBookings);
        if (newSelection.has(id)) {
            newSelection.delete(id);
        } else {
            newSelection.add(id);
        }
        setSelectedBookings(newSelection);
    };

    const selectAll = () => {
        setSelectedBookings(new Set(pendingBookings.map(b => b._id)));
    };

    const deselectAll = () => {
        setSelectedBookings(new Set());
    };

    const handleBulkApprove = async () => {
        if (selectedBookings.size === 0) {
            toast.error('No bookings selected');
            return;
        }

        setProcessing(true);
        try {
            const res = await fetch('/api/admin/bulk-operations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    operation: 'bulk-approve',
                    bookingIds: Array.from(selectedBookings),
                }),
            });

            const data = await res.json();

            if (res.ok) {
                toast.success(data.message);
                setSelectedBookings(new Set());
                fetchData();
            } else {
                toast.error(data.error || 'Failed to approve bookings');
            }
        } catch (error) {
            toast.error('Failed to process request');
        } finally {
            setProcessing(false);
        }
    };

    const handleBulkReject = async () => {
        if (selectedBookings.size === 0) {
            toast.error('No bookings selected');
            return;
        }

        setProcessing(true);
        try {
            const res = await fetch('/api/admin/bulk-operations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    operation: 'bulk-reject',
                    bookingIds: Array.from(selectedBookings),
                    reason: rejectReason || 'Rejected by admin',
                }),
            });

            const data = await res.json();

            if (res.ok) {
                toast.success(data.message);
                setSelectedBookings(new Set());
                setRejectReason('');
                fetchData();
            } else {
                toast.error(data.error || 'Failed to reject bookings');
            }
        } catch (error) {
            toast.error('Failed to process request');
        } finally {
            setProcessing(false);
        }
    };

    const handleCancelByDate = async () => {
        if (!cancelDate) {
            toast.error('Please select a date');
            return;
        }

        if (!confirm(`Are you sure you want to cancel all bookings for ${cancelDate}? This action cannot be undone.`)) {
            return;
        }

        setProcessing(true);
        try {
            const res = await fetch('/api/admin/bulk-operations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    operation: 'cancel-by-date',
                    date: cancelDate,
                    resourceType: cancelResourceType || undefined,
                    reason: cancelReason || 'Admin cancelled for date',
                }),
            });

            const data = await res.json();

            if (res.ok) {
                toast.success(data.message);
                setCancelDate('');
                setCancelResourceType('');
                setCancelReason('');
                fetchData();
            } else {
                toast.error(data.error || 'Failed to cancel bookings');
            }
        } catch (error) {
            toast.error('Failed to process request');
        } finally {
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <LoadingState
                title="Loading bulk operations"
                subtitle="Fetching pending requests..."
                variant="galaxy"
            />
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Zap className="w-8 h-8 text-accent-blue" />
                        Bulk Operations
                    </h1>
                    <p className="text-text-muted mt-1">
                        Perform batch actions on bookings and resources
                    </p>
                </div>
                <Button
                    variant="ghost"
                    onClick={fetchData}
                    disabled={processing}
                >
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Pending Approvals Section */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Package className="w-5 h-5 text-amber-400" />
                                Pending Approvals
                                <Badge variant="warning">{pendingBookings.length}</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={selectAll}
                                    disabled={pendingBookings.length === 0}
                                >
                                    Select All
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={deselectAll}
                                    disabled={selectedBookings.size === 0}
                                >
                                    Deselect All
                                </Button>
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {pendingBookings.length === 0 ? (
                            <div className="text-center py-8 text-text-muted">
                                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                <p>No pending approvals</p>
                            </div>
                        ) : (
                            <>
                                {/* Booking List */}
                                <div className="max-h-96 overflow-y-auto space-y-2">
                                    {pendingBookings.map((booking) => (
                                        <div
                                            key={booking._id}
                                            onClick={() => toggleBookingSelection(booking._id)}
                                            className={`
                                                flex items-center gap-4 p-3 rounded-lg cursor-pointer
                                                transition-all duration-200
                                                ${selectedBookings.has(booking._id)
                                                    ? 'bg-accent-blue/20 border border-accent-blue/50'
                                                    : 'bg-bg-dark border border-card-border hover:border-accent-blue/30'
                                                }
                                            `}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedBookings.has(booking._id)}
                                                onChange={() => toggleBookingSelection(booking._id)}
                                                className="w-4 h-4 rounded border-card-border"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-text-main truncate">
                                                    {booking.resourceName}
                                                </p>
                                                <p className="text-sm text-text-muted">
                                                    {format(new Date(booking.start), 'MMM d, yyyy HH:mm')} - {format(new Date(booking.end), 'HH:mm')}
                                                </p>
                                            </div>
                                            <Badge variant="default">{booking.resourceType}</Badge>
                                        </div>
                                    ))}
                                </div>

                                {/* Actions */}
                                <div className="pt-4 border-t border-card-border space-y-3">
                                    <div className="flex items-center gap-2 text-sm text-text-muted">
                                        <span>{selectedBookings.size} selected</span>
                                    </div>

                                    {/* Rejection reason input */}
                                    {selectedBookings.size > 0 && (
                                        <Input
                                            placeholder="Rejection reason (optional, for reject action)"
                                            value={rejectReason}
                                            onChange={(e) => setRejectReason(e.target.value)}
                                        />
                                    )}

                                    <div className="flex flex-wrap gap-3">
                                        <Button
                                            onClick={handleBulkApprove}
                                            disabled={selectedBookings.size === 0 || processing}
                                            className="bg-success hover:bg-success/90"
                                        >
                                            {processing ? (
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            ) : (
                                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                            )}
                                            Approve Selected ({selectedBookings.size})
                                        </Button>
                                        <Button
                                            onClick={handleBulkReject}
                                            disabled={selectedBookings.size === 0 || processing}
                                            variant="destructive"
                                        >
                                            {processing ? (
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            ) : (
                                                <XCircle className="w-4 h-4 mr-2" />
                                            )}
                                            Reject Selected ({selectedBookings.size})
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* Cancel by Date Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-red-400" />
                            Cancel by Date
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-text-muted">
                            Cancel all bookings for a specific date. Useful for holidays or emergency closures.
                        </p>

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-text-muted mb-1 block">Date</label>
                                <Input
                                    type="date"
                                    value={cancelDate}
                                    onChange={(e) => setCancelDate(e.target.value)}
                                    min={new Date().toISOString().split('T')[0]}
                                />
                            </div>

                            <div>
                                <label className="text-xs text-text-muted mb-1 block">Resource Type (optional)</label>
                                <select
                                    value={cancelResourceType}
                                    onChange={(e) => setCancelResourceType(e.target.value)}
                                    className="w-full rounded-lg bg-bg-dark border border-card-border px-3 py-2 text-text-main"
                                >
                                    <option value="">All Types</option>
                                    {resourceTypes.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-xs text-text-muted mb-1 block">Reason</label>
                                <Input
                                    placeholder="e.g., Holiday closure"
                                    value={cancelReason}
                                    onChange={(e) => setCancelReason(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="pt-2">
                            <Button
                                onClick={handleCancelByDate}
                                disabled={!cancelDate || processing}
                                variant="destructive"
                                className="w-full"
                            >
                                {processing ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <AlertTriangle className="w-4 h-4 mr-2" />
                                )}
                                Cancel All Bookings for Date
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Stats Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Zap className="w-5 h-5 text-accent-purple-1" />
                            Quick Stats
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                <p className="text-2xl font-bold text-amber-400">{pendingBookings.length}</p>
                                <p className="text-sm text-text-muted">Pending Approvals</p>
                            </div>
                            <div className="p-4 rounded-lg bg-accent-blue/10 border border-accent-blue/20">
                                <p className="text-2xl font-bold text-accent-blue">{resources.length}</p>
                                <p className="text-sm text-text-muted">Total Resources</p>
                            </div>
                        </div>

                        <div className="pt-3 border-t border-card-border">
                            <p className="text-xs text-text-muted">
                                💡 All bulk operations are logged in the Audit Logs for accountability.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
