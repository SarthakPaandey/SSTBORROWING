'use client';

import { useEffect, useState } from 'react';
import { Activity, TrendingUp, BarChart3, Zap } from 'lucide-react';

interface StatsData {
    bookingsByType: { name: string; value: number }[];
    weeklyActivity: { date: string; fullDate: string; count: number }[];
    statusDistribution: { name: string; value: number }[];
}

// Color palette for different types
const TYPE_COLORS: Record<string, { gradient: string; glow: string; text: string }> = {
    EQUIPMENT: { gradient: 'from-blue-500 to-cyan-400', glow: 'shadow-blue-500/50', text: 'text-blue-400' },
    FACILITY: { gradient: 'from-emerald-500 to-teal-400', glow: 'shadow-emerald-500/50', text: 'text-emerald-400' },
    LIBRARY: { gradient: 'from-amber-500 to-orange-400', glow: 'shadow-amber-500/50', text: 'text-amber-400' },
    ROOM: { gradient: 'from-purple-500 to-violet-400', glow: 'shadow-purple-500/50', text: 'text-purple-400' },
};

const STATUS_COLORS: Record<string, { gradient: string; glow: string; text: string; icon: string }> = {
    CANCELLED: { gradient: 'from-blue-500 to-cyan-400', glow: 'shadow-blue-500/40', text: 'text-blue-400', icon: '❌' },
    COMPLETED: { gradient: 'from-emerald-500 to-green-400', glow: 'shadow-emerald-500/40', text: 'text-emerald-400', icon: '✅' },
    NO_SHOW: { gradient: 'from-amber-500 to-yellow-400', glow: 'shadow-amber-500/40', text: 'text-amber-400', icon: '👻' },
};

// Animated progress ring component
function ProgressRing({
    percentage,
    size = 120,
    strokeWidth = 8,
    gradient,
    glow,
    label,
    value,
    delay = 0
}: {
    percentage: number;
    size?: number;
    strokeWidth?: number;
    gradient: string;
    glow: string;
    label: string;
    value: number;
    delay?: number;
}) {
    const [animatedPercentage, setAnimatedPercentage] = useState(0);
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (animatedPercentage / 100) * circumference;

    useEffect(() => {
        const timer = setTimeout(() => {
            setAnimatedPercentage(percentage);
        }, delay);
        return () => clearTimeout(timer);
    }, [percentage, delay]);

    return (
        <div className="flex flex-col items-center group">
            <div className="relative" style={{ width: size, height: size }}>
                {/* Glow effect */}
                <div className={`absolute inset-4 rounded-full bg-gradient-to-br ${gradient} blur-xl opacity-30 group-hover:opacity-50 transition-opacity`} />

                {/* Background ring */}
                <svg className="transform -rotate-90" width={size} height={size}>
                    <circle
                        className="text-white/5"
                        strokeWidth={strokeWidth}
                        stroke="currentColor"
                        fill="transparent"
                        r={radius}
                        cx={size / 2}
                        cy={size / 2}
                    />
                    {/* Progress ring */}
                    <circle
                        className={`transition-all duration-1000 ease-out`}
                        strokeWidth={strokeWidth}
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        stroke="url(#gradient)"
                        fill="transparent"
                        r={radius}
                        cx={size / 2}
                        cy={size / 2}
                        style={{ filter: `drop-shadow(0 0 10px var(--tw-shadow-color))` }}
                    />
                    <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#3b82f6" />
                            <stop offset="100%" stopColor="#06b6d4" />
                        </linearGradient>
                    </defs>
                </svg>

                {/* Center content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-text-main">{value}</span>
                    <span className="text-xs text-text-muted">bookings</span>
                </div>
            </div>
            <p className="mt-3 text-sm font-medium text-text-muted group-hover:text-text-main transition-colors">{label}</p>
        </div>
    );
}

// 3D-style progress bar
function ProgressBar3D({
    percentage,
    label,
    value,
    gradient,
    glow,
    icon,
    delay = 0
}: {
    percentage: number;
    label: string;
    value: number;
    gradient: string;
    glow: string;
    icon: string;
    delay?: number;
}) {
    const [animatedWidth, setAnimatedWidth] = useState(0);

    useEffect(() => {
        const timer = setTimeout(() => {
            setAnimatedWidth(percentage);
        }, delay);
        return () => clearTimeout(timer);
    }, [percentage, delay]);

    return (
        <div className="group p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all hover:bg-white/[0.07]">
            <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                    <span className="text-lg">{icon}</span>
                    <span className="font-medium text-text-main">{label}</span>
                </div>
                <span className={`text-lg font-bold ${gradient.includes('blue') ? 'text-blue-400' : gradient.includes('emerald') ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {value}
                </span>
            </div>

            {/* 3D Bar container */}
            <div className="relative h-4 rounded-full bg-black/40 overflow-hidden" style={{ perspective: '200px' }}>
                {/* Reflection */}
                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent rounded-t-full z-10" />

                {/* Progress fill */}
                <div
                    className={`absolute inset-y-0 left-0 bg-gradient-to-r ${gradient} rounded-full shadow-lg ${glow} transition-all duration-1000 ease-out`}
                    style={{
                        width: `${animatedWidth}%`,
                        transform: 'translateZ(5px)',
                    }}
                >
                    {/* Shine effect */}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-black/20 rounded-full" />

                    {/* Animated pulse */}
                    <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-r from-transparent to-white/30 animate-pulse rounded-r-full" />
                </div>
            </div>

            <div className="flex justify-between mt-2">
                <span className="text-xs text-text-muted">{percentage.toFixed(0)}%</span>
            </div>
        </div>
    );
}

// Weekly activity with 3D bars
function WeeklyActivity3D({ data }: { data: { date: string; count: number }[] }) {
    const maxCount = Math.max(...data.map(d => d.count), 1);
    const [animated, setAnimated] = useState(false);
    const chartHeight = 180; // Fixed height in pixels

    useEffect(() => {
        setTimeout(() => setAnimated(true), 100);
    }, []);

    return (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/5 border border-blue-500/20 p-6 backdrop-blur-xl">
            {/* Background effects */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

            <div className="relative">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/30 to-purple-500/20 border border-blue-500/30">
                        <Activity className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-text-main">Weekly Activity</h3>
                        <p className="text-sm text-text-muted">Bookings over the last 7 days</p>
                    </div>
                </div>

                {/* 3D Bar Chart with fixed height */}
                <div className="flex items-end justify-between gap-4 px-2" style={{ height: `${chartHeight}px` }}>
                    {data.map((day, index) => {
                        const barHeight = Math.max((day.count / maxCount) * chartHeight, 8); // Min 8px
                        const isToday = index === data.length - 1;

                        return (
                            <div key={day.date} className="flex-1 flex flex-col items-center group h-full">
                                {/* Bar container */}
                                <div className="flex-1 w-full flex items-end justify-center">
                                    <div
                                        className="relative w-full max-w-[40px] rounded-t-lg overflow-visible transition-all duration-700 ease-out"
                                        style={{
                                            height: animated ? `${barHeight}px` : '8px',
                                            transitionDelay: `${index * 100}ms`,
                                        }}
                                    >
                                        {/* Glow effect behind bar */}
                                        <div className={`absolute inset-0 bg-blue-500/30 blur-xl scale-150 transition-opacity ${animated ? 'opacity-100' : 'opacity-0'}`} />

                                        {/* Main 3D bar */}
                                        <div className={`relative h-full w-full rounded-t-lg overflow-hidden ${isToday ? 'bg-gradient-to-t from-cyan-500 via-blue-400 to-blue-300' : 'bg-gradient-to-t from-blue-600 via-blue-500 to-cyan-400'} shadow-lg shadow-blue-500/30 group-hover:shadow-blue-500/60 transition-shadow`}>
                                            {/* Top shine */}
                                            <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/50 to-transparent rounded-t-lg" />
                                            {/* Right side shadow for 3D */}
                                            <div className="absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-black/20 to-transparent" />
                                            {/* Bottom glow line */}
                                            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                                        </div>

                                        {/* Value tooltip - always visible */}
                                        <div className={`absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-lg text-xs font-bold transition-all ${animated ? 'opacity-100' : 'opacity-0'} ${day.count > 0 ? 'bg-blue-500/80 text-white' : 'bg-white/10 text-text-muted'}`}>
                                            {day.count}
                                        </div>
                                    </div>
                                </div>

                                {/* Day label */}
                                <span className={`mt-3 text-xs font-medium transition-colors ${isToday ? 'text-blue-400' : 'text-text-muted group-hover:text-blue-400'}`}>
                                    {day.date}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

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
                <div className="col-span-2 h-[320px] rounded-2xl bg-gradient-to-br from-white/5 to-transparent border border-white/10 animate-pulse" />
                <div className="h-[300px] rounded-2xl bg-gradient-to-br from-white/5 to-transparent border border-white/10 animate-pulse" />
                <div className="h-[300px] rounded-2xl bg-gradient-to-br from-white/5 to-transparent border border-white/10 animate-pulse" />
            </div>
        );
    }

    if (!data) return null;

    const totalByType = data.bookingsByType.reduce((sum, item) => sum + item.value, 0) || 1;
    const totalByStatus = data.statusDistribution.reduce((sum, item) => sum + item.value, 0) || 1;

    return (
        <div className="grid gap-6 md:grid-cols-2">
            {/* Weekly Activity - Full Width */}
            <div className="col-span-2">
                <WeeklyActivity3D data={data.weeklyActivity} />
            </div>

            {/* Bookings by Type */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/10 via-transparent to-cyan-500/5 border border-emerald-500/20 p-6 backdrop-blur-xl">
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

                <div className="relative">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/30 to-cyan-500/20 border border-emerald-500/30">
                            <BarChart3 className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-text-main">Bookings by Type</h3>
                            <p className="text-sm text-text-muted">Last 30 days</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {data.bookingsByType.map((item, index) => {
                            const colors = TYPE_COLORS[item.name] || TYPE_COLORS.EQUIPMENT;
                            const percentage = (item.value / totalByType) * 100;
                            const icons: Record<string, string> = {
                                EQUIPMENT: '🔧',
                                FACILITY: '🏟️',
                                LIBRARY: '📚',
                                ROOM: '🚪'
                            };
                            return (
                                <ProgressBar3D
                                    key={item.name}
                                    percentage={percentage}
                                    label={item.name}
                                    value={item.value}
                                    gradient={colors.gradient}
                                    glow={colors.glow}
                                    icon={icons[item.name] || '📊'}
                                    delay={index * 150}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Status Distribution */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500/10 via-transparent to-pink-500/5 border border-purple-500/20 p-6 backdrop-blur-xl">
                <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                <div className="relative">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/20 border border-purple-500/30">
                            <TrendingUp className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-text-main">Status Distribution</h3>
                            <p className="text-sm text-text-muted">Last 30 days</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {data.statusDistribution.map((item, index) => {
                            const colors = STATUS_COLORS[item.name] || STATUS_COLORS.COMPLETED;
                            const percentage = (item.value / totalByStatus) * 100;
                            return (
                                <ProgressBar3D
                                    key={item.name}
                                    percentage={percentage}
                                    label={item.name.replace('_', ' ')}
                                    value={item.value}
                                    gradient={colors.gradient}
                                    glow={colors.glow}
                                    icon={colors.icon}
                                    delay={index * 150}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
