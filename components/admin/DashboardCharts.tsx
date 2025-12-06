'use client';

import { useEffect, useState } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend,
    Area,
    AreaChart
} from 'recharts';
import { BarChart3, PieChart as PieChartIcon, TrendingUp, Activity } from 'lucide-react';

// Modern color palette matching app theme
const MODERN_COLORS = {
    primary: {
        blue: '#3b82f6',
        cyan: '#06b6d4',
        purple: '#8b5cf6',
        emerald: '#10b981',
        amber: '#f59e0b',
        rose: '#f43f5e'
    },
    gradientStart: 'rgba(59, 130, 246, 0.8)',
    gradientEnd: 'rgba(59, 130, 246, 0.1)',
};

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];
const STATUS_COLORS = ['#3b82f6', '#10b981', '#f59e0b'];

interface StatsData {
    bookingsByType: { name: string; value: number }[];
    weeklyActivity: { date: string; fullDate: string; count: number }[];
    statusDistribution: { name: string; value: number }[];
}

// Custom tooltip component with glass effect
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-bg-dark/90 backdrop-blur-xl border border-accent-blue/30 rounded-xl px-4 py-3 shadow-xl shadow-accent-blue/10">
                <p className="text-text-main font-medium">{label}</p>
                <p className="text-accent-blue text-lg font-bold">{payload[0].value} bookings</p>
            </div>
        );
    }
    return null;
};

const PieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-bg-dark/90 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-3 shadow-xl">
                <p className="text-text-main font-medium">{payload[0].name}</p>
                <p className="text-lg font-bold" style={{ color: payload[0].payload.fill }}>{payload[0].value}</p>
            </div>
        );
    }
    return null;
};

// Custom legend with modern styling
const CustomLegend = ({ payload }: any) => (
    <div className="flex flex-wrap justify-center gap-3 mt-4">
        {payload.map((entry: any, index: number) => (
            <div key={`legend-${index}`} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-xs text-text-muted uppercase tracking-wide">{entry.value}</span>
            </div>
        ))}
    </div>
);

export function DashboardCharts() {
    const [data, setData] = useState<StatsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api/admin/stats');
                const json = await res.json();
                setData(json);
            } catch (error) {
                console.error('Failed to fetch stats:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="grid gap-6 md:grid-cols-2">
                {/* Skeleton loaders */}
                <div className="col-span-2 h-[380px] rounded-2xl bg-gradient-to-br from-white/5 to-transparent border border-white/10 animate-pulse" />
                <div className="h-[380px] rounded-2xl bg-gradient-to-br from-white/5 to-transparent border border-white/10 animate-pulse" />
                <div className="h-[380px] rounded-2xl bg-gradient-to-br from-white/5 to-transparent border border-white/10 animate-pulse" />
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="grid gap-6 md:grid-cols-2">
            {/* Weekly Activity - Full Width */}
            <div className="col-span-2 relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500/10 via-transparent to-transparent border border-blue-500/20 p-6 backdrop-blur-xl">
                {/* Background glow */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                <div className="relative">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2.5 rounded-xl bg-blue-500/20 border border-blue-500/30">
                            <Activity className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-text-main">Weekly Booking Activity</h3>
                            <p className="text-sm text-text-muted">Last 7 days overview</p>
                        </div>
                    </div>

                    <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.weeklyActivity}>
                                <defs>
                                    <linearGradient id="colorBookings" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                <XAxis
                                    dataKey="date"
                                    stroke="#64748b"
                                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                                    tickLine={{ stroke: '#64748b' }}
                                />
                                <YAxis
                                    allowDecimals={false}
                                    stroke="#64748b"
                                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                                    tickLine={{ stroke: '#64748b' }}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Area
                                    type="monotone"
                                    dataKey="count"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorBookings)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Bookings by Type */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent border border-emerald-500/20 p-6 backdrop-blur-xl">
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

                <div className="relative">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30">
                            <PieChartIcon className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-text-main">Bookings by Type</h3>
                            <p className="text-sm text-text-muted">Last 30 days</p>
                        </div>
                    </div>

                    <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data.bookingsByType}
                                    cx="50%"
                                    cy="45%"
                                    labelLine={false}
                                    outerRadius={90}
                                    innerRadius={0}
                                    fill="#8884d8"
                                    dataKey="value"
                                    label={({ name, percent }: { name?: string; percent?: number }) =>
                                        `${name || ''} ${percent ? (percent * 100).toFixed(0) : '0'}%`
                                    }
                                >
                                    {data.bookingsByType.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                                            stroke="rgba(0,0,0,0.2)"
                                            strokeWidth={2}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip content={<PieTooltip />} />
                                <Legend content={<CustomLegend />} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Status Distribution */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500/10 via-transparent to-transparent border border-purple-500/20 p-6 backdrop-blur-xl">
                <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                <div className="relative">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2.5 rounded-xl bg-purple-500/20 border border-purple-500/30">
                            <TrendingUp className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-text-main">Status Distribution</h3>
                            <p className="text-sm text-text-muted">Last 30 days</p>
                        </div>
                    </div>

                    <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data.statusDistribution}
                                    cx="50%"
                                    cy="45%"
                                    innerRadius={55}
                                    outerRadius={90}
                                    fill="#8884d8"
                                    paddingAngle={4}
                                    dataKey="value"
                                >
                                    {data.statusDistribution.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={STATUS_COLORS[index % STATUS_COLORS.length]}
                                            stroke="rgba(0,0,0,0.2)"
                                            strokeWidth={2}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip content={<PieTooltip />} />
                                <Legend content={<CustomLegend />} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
