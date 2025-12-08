'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/LoadingState';
import { Button } from '@/components/ui/Button';
import {
    BarChart3,
    RefreshCw,
    Download,
    TrendingUp,
    Clock,
    AlertTriangle,
    Calendar,
    Activity
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
    Legend,
} from 'recharts';

interface AnalyticsData {
    period: { days: number; startDate: string };
    heatmap: { day: string; hour: number; count: number }[];
    utilization: { resourceName: string; resourceType: string; totalBookings: number; totalHours: number }[];
    penaltyTrends: { type: string; count: number; totalPoints: number }[];
    statusDistribution: { status: string; count: number }[];
    dailyActivity: { _id: string; bookings: number; confirmed: number; cancelled: number }[];
    peakHours: { hour: number; count: number }[];
    summary: {
        totalBookings: number;
        completedBookings: number;
        completionRate: number;
        totalPenalties: number;
        avgBookingsPerDay: number;
    };
}

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1'];
const STATUS_COLORS: Record<string, string> = {
    CONFIRMED: '#10b981',
    COMPLETED: '#8b5cf6',
    CANCELLED: '#ef4444',
    PENDING: '#f59e0b',
    CHECKED_IN: '#3b82f6',
    NO_SHOW: '#6b7280',
};

export default function AnalyticsPage() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [days, setDays] = useState(30);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/analytics?days=${days}`);
            const result = await res.json();
            setData(result);
        } catch (error) {
            console.error('Failed to fetch analytics:', error);
        } finally {
            setLoading(false);
        }
    }, [days]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const exportToCSV = () => {
        if (!data) return;

        // Create CSV content
        const lines = [
            'Analytics Report',
            `Period: Last ${data.period.days} days`,
            '',
            'Resource Utilization',
            'Resource,Type,Bookings,Hours',
            ...data.utilization.map(u => `${u.resourceName},${u.resourceType},${u.totalBookings},${u.totalHours}`),
            '',
            'Status Distribution',
            'Status,Count',
            ...data.statusDistribution.map(s => `${s.status},${s.count}`),
            '',
            'Penalty Trends',
            'Type,Count,Points',
            ...data.penaltyTrends.map(p => `${p.type},${p.count},${p.totalPoints}`),
        ];

        const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    if (loading && !data) {
        return (
            <LoadingState
                title="Loading analytics"
                subtitle="Crunching the numbers..."
                variant="galaxy"
            />
        );
    }

    if (!data) {
        return <div>Failed to load analytics</div>;
    }

    // Transform heatmap data for visualization
    const heatmapGrid = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let day = 0; day < 7; day++) {
        const row = { day: dayNames[day] };
        for (let hour = 0; hour < 24; hour++) {
            const found = data.heatmap.find(h => h.day === dayNames[day] && h.hour === hour);
            (row as Record<string, unknown>)[`h${hour}`] = found?.count || 0;
        }
        heatmapGrid.push(row);
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <BarChart3 className="w-8 h-8 text-accent-purple-1" />
                        Advanced Analytics
                    </h1>
                    <p className="text-text-muted mt-1">
                        Insights and trends for the last {days} days
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={days}
                        onChange={(e) => setDays(parseInt(e.target.value))}
                        className="rounded-lg bg-bg-dark border border-card-border px-3 py-2 text-text-main"
                    >
                        <option value={7}>Last 7 days</option>
                        <option value={14}>Last 14 days</option>
                        <option value={30}>Last 30 days</option>
                        <option value={60}>Last 60 days</option>
                        <option value={90}>Last 90 days</option>
                    </select>
                    <Button variant="ghost" onClick={fetchData}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button variant="ghost" onClick={exportToCSV}>
                        <Download className="w-4 h-4 mr-2" />
                        Export
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card className="bg-gradient-to-br from-accent-purple-1/10 to-purple-500/5">
                    <CardContent className="pt-4">
                        <p className="text-3xl font-bold text-accent-purple-1">{data.summary.totalBookings}</p>
                        <p className="text-sm text-text-muted">Total Bookings</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-success/10 to-emerald-500/5">
                    <CardContent className="pt-4">
                        <p className="text-3xl font-bold text-success">{data.summary.completionRate}%</p>
                        <p className="text-sm text-text-muted">Completion Rate</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-accent-blue/10 to-blue-500/5">
                    <CardContent className="pt-4">
                        <p className="text-3xl font-bold text-accent-blue">{data.summary.avgBookingsPerDay}</p>
                        <p className="text-sm text-text-muted">Avg/Day</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-warning/10 to-amber-500/5">
                    <CardContent className="pt-4">
                        <p className="text-3xl font-bold text-warning">{data.summary.totalPenalties}</p>
                        <p className="text-sm text-text-muted">Penalties</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-pink-500/10 to-rose-500/5">
                    <CardContent className="pt-4">
                        <p className="text-3xl font-bold text-pink-400">
                            {data.peakHours[0] ? `${data.peakHours[0].hour}:00` : '-'}
                        </p>
                        <p className="text-sm text-text-muted">Peak Hour</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Grid */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Usage Heatmap */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="w-5 h-5 text-accent-blue" />
                            Usage Heatmap (Hour × Day)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <div className="min-w-[800px]">
                                <div className="flex items-center gap-1 mb-2 text-xs text-text-muted">
                                    <span className="w-12">Day</span>
                                    {Array.from({ length: 24 }, (_, i) => (
                                        <span key={i} className="w-8 text-center">{i}</span>
                                    ))}
                                </div>
                                {heatmapGrid.map((row) => (
                                    <div key={row.day} className="flex items-center gap-1 mb-1">
                                        <span className="w-12 text-sm text-text-muted">{row.day}</span>
                                        {Array.from({ length: 24 }, (_, hour) => {
                                            const value = (row as Record<string, unknown>)[`h${hour}`] as number;
                                            const maxValue = Math.max(...data.heatmap.map(h => h.count), 1);
                                            const intensity = value / maxValue;
                                            return (
                                                <div
                                                    key={hour}
                                                    className="w-8 h-6 rounded-sm transition-all hover:scale-110 cursor-pointer"
                                                    style={{
                                                        backgroundColor: value > 0
                                                            ? `rgba(139, 92, 246, ${0.2 + intensity * 0.8})`
                                                            : 'rgba(255, 255, 255, 0.05)',
                                                    }}
                                                    title={`${row.day} ${hour}:00 - ${value} bookings`}
                                                />
                                            );
                                        })}
                                    </div>
                                ))}
                                <div className="flex items-center justify-end gap-2 mt-4 text-xs text-text-muted">
                                    <span>Less</span>
                                    <div className="flex gap-1">
                                        {[0.2, 0.4, 0.6, 0.8, 1].map((i) => (
                                            <div
                                                key={i}
                                                className="w-4 h-4 rounded-sm"
                                                style={{ backgroundColor: `rgba(139, 92, 246, ${i})` }}
                                            />
                                        ))}
                                    </div>
                                    <span>More</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Resource Utilization */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-success" />
                            Top Resources
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={data.utilization.slice(0, 8)} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                <XAxis type="number" stroke="#888" />
                                <YAxis
                                    dataKey="resourceName"
                                    type="category"
                                    width={100}
                                    stroke="#888"
                                    tick={{ fontSize: 12 }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#1a1a2e',
                                        border: '1px solid #333',
                                        borderRadius: '8px',
                                    }}
                                />
                                <Bar dataKey="totalBookings" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Status Distribution */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Activity className="w-5 h-5 text-accent-blue" />
                            Booking Status Distribution
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={data.statusDistribution}
                                    dataKey="count"
                                    nameKey="status"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={100}
                                    label
                                    labelLine={false}
                                >
                                    {data.statusDistribution.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={STATUS_COLORS[entry.status] || COLORS[index % COLORS.length]}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#1a1a2e',
                                        border: '1px solid #333',
                                        borderRadius: '8px',
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Daily Activity Trend */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-pink-400" />
                            Daily Activity (Last 14 Days)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={data.dailyActivity}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                <XAxis
                                    dataKey="_id"
                                    stroke="#888"
                                    tick={{ fontSize: 12 }}
                                    tickFormatter={(value) => value.slice(5)} // Show MM-DD
                                />
                                <YAxis stroke="#888" />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#1a1a2e',
                                        border: '1px solid #333',
                                        borderRadius: '8px',
                                    }}
                                />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="bookings"
                                    stroke="#8b5cf6"
                                    strokeWidth={2}
                                    dot={false}
                                    name="Total"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="confirmed"
                                    stroke="#10b981"
                                    strokeWidth={2}
                                    dot={false}
                                    name="Confirmed"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="cancelled"
                                    stroke="#ef4444"
                                    strokeWidth={2}
                                    dot={false}
                                    name="Cancelled"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Penalty Trends */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-warning" />
                            Penalties by Resource Type
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {data.penaltyTrends.length === 0 ? (
                            <div className="text-center py-8 text-text-muted">
                                <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                <p>No penalties in this period</p>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={data.penaltyTrends}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                    <XAxis dataKey="type" stroke="#888" tick={{ fontSize: 12 }} />
                                    <YAxis stroke="#888" />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#1a1a2e',
                                            border: '1px solid #333',
                                            borderRadius: '8px',
                                        }}
                                    />
                                    <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Count" />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                {/* Peak Hours */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="w-5 h-5 text-accent-purple-1" />
                            Peak Booking Hours
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {data.peakHours.map((peak, index) => (
                                <div key={peak.hour} className="flex items-center gap-3">
                                    <Badge variant={index === 0 ? 'success' : 'default'}>
                                        #{index + 1}
                                    </Badge>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-medium">{peak.hour}:00 - {peak.hour + 1}:00</span>
                                            <span className="text-text-muted">{peak.count} bookings</span>
                                        </div>
                                        <div className="h-2 bg-bg-dark rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-accent-purple-1 rounded-full transition-all"
                                                style={{
                                                    width: `${(peak.count / data.peakHours[0].count) * 100}%`
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
