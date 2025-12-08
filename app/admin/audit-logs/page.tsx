'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/LoadingState';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
    ClipboardList,
    Search,
    Filter,
    ChevronLeft,
    ChevronRight,
    Calendar,
    User,
    X,
    RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';

interface AuditLog {
    _id: string;
    action: string;
    actionLabel: { label: string; emoji: string; color: string };
    actor: { userId: string; email: string; name: string };
    target?: { type: string; id: string; name?: string };
    details: Record<string, unknown>;
    createdAt: string;
}

interface FilterOption {
    value: string;
    label: string;
    emoji?: string;
    email?: string;
}

interface Filters {
    actions: FilterOption[];
    actors: FilterOption[];
    targetTypes: string[];
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [filters, setFilters] = useState<Filters | null>(null);

    // Filter state
    const [selectedAction, setSelectedAction] = useState('');
    const [selectedActor, setSelectedActor] = useState('');
    const [selectedTargetType, setSelectedTargetType] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [page, setPage] = useState(1);

    const [showFilters, setShowFilters] = useState(false);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (selectedAction) params.set('action', selectedAction);
            if (selectedActor) params.set('actorId', selectedActor);
            if (selectedTargetType) params.set('targetType', selectedTargetType);
            if (searchQuery) params.set('search', searchQuery);
            if (startDate) params.set('startDate', new Date(startDate).toISOString());
            if (endDate) params.set('endDate', new Date(endDate + 'T23:59:59').toISOString());
            params.set('page', page.toString());
            params.set('limit', '25');

            const res = await fetch(`/api/admin/audit-logs?${params}`);
            const data = await res.json();

            setLogs(data.logs || []);
            setPagination(data.pagination);
            if (!filters) {
                setFilters(data.filters);
            }
        } catch (error) {
            console.error('Failed to fetch audit logs:', error);
        } finally {
            setLoading(false);
        }
    }, [selectedAction, selectedActor, selectedTargetType, searchQuery, startDate, endDate, page, filters]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const clearFilters = () => {
        setSelectedAction('');
        setSelectedActor('');
        setSelectedTargetType('');
        setSearchQuery('');
        setStartDate('');
        setEndDate('');
        setPage(1);
    };

    const hasActiveFilters = selectedAction || selectedActor || selectedTargetType || searchQuery || startDate || endDate;

    const getColorClass = (color: string) => {
        switch (color) {
            case 'success': return 'bg-success/20 text-success border-success/30';
            case 'danger': return 'bg-danger/20 text-danger border-danger/30';
            case 'warning': return 'bg-warning/20 text-warning border-warning/30';
            case 'info': return 'bg-accent-blue/20 text-accent-blue border-accent-blue/30';
            default: return 'bg-text-muted/20 text-text-muted border-text-muted/30';
        }
    };

    if (loading && !logs.length) {
        return (
            <LoadingState
                title="Loading audit logs"
                subtitle="Fetching activity history..."
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
                        <ClipboardList className="w-8 h-8 text-accent-purple-1" />
                        Audit Logs
                    </h1>
                    <p className="text-text-muted mt-1">
                        Track all admin actions and system changes
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        onClick={fetchLogs}
                        className="text-text-muted"
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button
                        variant={showFilters ? 'gradient' : 'ghost'}
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        <Filter className="w-4 h-4 mr-2" />
                        Filters
                        {hasActiveFilters && (
                            <span className="ml-2 w-2 h-2 rounded-full bg-accent-blue" />
                        )}
                    </Button>
                </div>
            </div>

            {/* Filters Panel */}
            {showFilters && (
                <Card className="animate-fade-in">
                    <CardContent className="pt-4 space-y-4">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                            <Input
                                placeholder="Search by admin name, email, or target..."
                                value={searchQuery}
                                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                                className="pl-10"
                            />
                        </div>

                        {/* Filter Dropdowns */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Action Filter */}
                            <div>
                                <label className="text-xs text-text-muted mb-1 block">Action Type</label>
                                <select
                                    value={selectedAction}
                                    onChange={(e) => { setSelectedAction(e.target.value); setPage(1); }}
                                    className="w-full rounded-lg bg-bg-dark border border-card-border px-3 py-2 text-text-main"
                                >
                                    <option value="">All Actions</option>
                                    {filters?.actions.map(a => (
                                        <option key={a.value} value={a.value}>
                                            {a.emoji} {a.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Actor Filter */}
                            <div>
                                <label className="text-xs text-text-muted mb-1 block">Admin</label>
                                <select
                                    value={selectedActor}
                                    onChange={(e) => { setSelectedActor(e.target.value); setPage(1); }}
                                    className="w-full rounded-lg bg-bg-dark border border-card-border px-3 py-2 text-text-main"
                                >
                                    <option value="">All Admins</option>
                                    {filters?.actors.map(a => (
                                        <option key={a.value} value={a.value}>
                                            {a.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Date Range */}
                            <div>
                                <label className="text-xs text-text-muted mb-1 block">From Date</label>
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-text-muted mb-1 block">To Date</label>
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                                />
                            </div>
                        </div>

                        {/* Clear Filters */}
                        {hasActiveFilters && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearFilters}
                                className="text-text-muted"
                            >
                                <X className="w-4 h-4 mr-1" />
                                Clear all filters
                            </Button>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Results Summary */}
            {pagination && (
                <p className="text-sm text-text-muted">
                    Showing {logs.length} of {pagination.total} entries
                </p>
            )}

            {/* Logs List */}
            <div className="space-y-3">
                {logs.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <ClipboardList className="w-12 h-12 text-text-muted mx-auto mb-4 opacity-50" />
                            <p className="text-text-muted">No audit logs found</p>
                            {hasActiveFilters && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearFilters}
                                    className="mt-2"
                                >
                                    Clear filters
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    logs.map((log) => (
                        <Card key={log._id} className="hover:border-accent-purple-1/30 transition-colors">
                            <CardContent className="py-4">
                                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                                    {/* Action Badge */}
                                    <div className="flex items-center gap-3 lg:w-56 shrink-0">
                                        <span className="text-2xl">{log.actionLabel.emoji}</span>
                                        <div>
                                            <Badge className={getColorClass(log.actionLabel.color)}>
                                                {log.actionLabel.label}
                                            </Badge>
                                        </div>
                                    </div>

                                    {/* Details */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 text-sm">
                                            <User className="w-4 h-4 text-text-muted shrink-0" />
                                            <span className="font-medium text-text-main truncate">
                                                {log.actor.name}
                                            </span>
                                            <span className="text-text-muted truncate hidden sm:inline">
                                                ({log.actor.email})
                                            </span>
                                        </div>
                                        {log.target && (
                                            <p className="text-sm text-text-muted mt-1">
                                                Target: <span className="text-text-main">{log.target.name || log.target.id}</span>
                                                <span className="text-xs ml-2 opacity-70">({log.target.type})</span>
                                            </p>
                                        )}
                                        {Object.keys(log.details).length > 0 && (
                                            <p className="text-xs text-text-muted mt-1 truncate">
                                                {JSON.stringify(log.details).slice(0, 100)}...
                                            </p>
                                        )}
                                    </div>

                                    {/* Timestamp */}
                                    <div className="flex items-center gap-2 text-sm text-text-muted lg:w-44 shrink-0">
                                        <Calendar className="w-4 h-4" />
                                        <span>{format(new Date(log.createdAt), 'MMM d, yyyy HH:mm')}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 pt-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                    >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Previous
                    </Button>
                    <span className="text-sm text-text-muted">
                        Page {page} of {pagination.totalPages}
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                        disabled={page === pagination.totalPages}
                    >
                        Next
                        <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                </div>
            )}
        </div>
    );
}
