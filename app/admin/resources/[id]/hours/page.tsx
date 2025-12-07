'use client';

import { useState, useEffect, use } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { LoadingState } from '@/components/ui/LoadingState';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Clock, ArrowLeft, Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface DaySchedule {
    open: boolean;
    startHour: number;
    endHour: number;
}

interface OperatingHours {
    useCustom: boolean;
    schedule: DaySchedule[];
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ResourceHoursPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [resourceName, setResourceName] = useState('');
    const [operatingHours, setOperatingHours] = useState<OperatingHours | null>(null);

    useEffect(() => {
        fetchHours();
    }, []);

    const fetchHours = async () => {
        try {
            const res = await fetch(`/api/admin/resources/${resolvedParams.id}/hours`);
            const data = await res.json();

            if (res.ok) {
                setResourceName(data.resourceName);
                setOperatingHours(data.operatingHours);
            } else {
                toast.error(data.error || 'Failed to load hours');
            }
        } catch {
            toast.error('Failed to load operating hours');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!operatingHours) return;

        setSaving(true);
        try {
            const res = await fetch(`/api/admin/resources/${resolvedParams.id}/hours`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ operatingHours: { ...operatingHours, useCustom: true } }),
            });

            const data = await res.json();

            if (res.ok) {
                toast.success(data.message);
            } else {
                toast.error(data.error || 'Failed to save');
            }
        } catch {
            toast.error('Failed to save operating hours');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        setSaving(true);
        try {
            const res = await fetch(`/api/admin/resources/${resolvedParams.id}/hours`, {
                method: 'DELETE',
            });

            const data = await res.json();

            if (res.ok) {
                toast.success(data.message);
                fetchHours(); // Refresh to get defaults
            } else {
                toast.error(data.error || 'Failed to reset');
            }
        } catch {
            toast.error('Failed to reset operating hours');
        } finally {
            setSaving(false);
        }
    };

    const updateDay = (dayIndex: number, updates: Partial<DaySchedule>) => {
        if (!operatingHours) return;

        const newSchedule = [...operatingHours.schedule];
        newSchedule[dayIndex] = { ...newSchedule[dayIndex], ...updates };
        setOperatingHours({ ...operatingHours, schedule: newSchedule });
    };

    const formatHour = (hour: number) => {
        if (hour === 0) return '12 AM';
        if (hour === 12) return '12 PM';
        if (hour === 24) return '12 AM';
        if (hour < 12) return `${hour} AM`;
        return `${hour - 12} PM`;
    };

    if (loading) {
        return (
            <LoadingState
                title="Loading hours"
                subtitle="Fetching operating hours..."
                variant="galaxy"
            />
        );
    }

    if (!operatingHours) {
        return (
            <div className="text-center py-12">
                <p className="text-text-muted">Failed to load operating hours</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/admin/resources">
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Clock className="w-6 h-6 text-accent-blue" />
                            Operating Hours
                        </h1>
                        <p className="text-text-muted">{resourceName}</p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <Button variant="ghost" onClick={handleReset} disabled={saving}>
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reset to Defaults
                    </Button>
                    <Button onClick={handleSave} disabled={saving} className="bg-accent-blue hover:bg-accent-blue/90">
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? 'Saving...' : 'Save Hours'}
                    </Button>
                </div>
            </div>

            {/* Hours Editor */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        Weekly Schedule
                        {operatingHours.useCustom && (
                            <Badge variant="info">Custom Hours</Badge>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {operatingHours.schedule.map((day, index) => (
                            <div
                                key={index}
                                className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${day.open
                                        ? 'border-green-500/30 bg-green-500/5'
                                        : 'border-card-border bg-card opacity-60'
                                    }`}
                            >
                                {/* Day name */}
                                <div className="w-28">
                                    <span className="font-medium text-text-main">{DAY_NAMES[index]}</span>
                                    <span className="text-xs text-text-muted ml-2">({DAY_SHORT[index]})</span>
                                </div>

                                {/* Open/Closed toggle */}
                                <button
                                    onClick={() => updateDay(index, { open: !day.open })}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${day.open
                                            ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30'
                                            : 'bg-red-500/20 text-red-500 hover:bg-red-500/30'
                                        }`}
                                >
                                    {day.open ? 'Open' : 'Closed'}
                                </button>

                                {/* Hours inputs */}
                                {day.open && (
                                    <div className="flex items-center gap-3 flex-1">
                                        <div className="flex items-center gap-2">
                                            <label className="text-sm text-text-muted">Opens:</label>
                                            <select
                                                value={day.startHour}
                                                onChange={(e) => updateDay(index, { startHour: parseInt(e.target.value) })}
                                                className="bg-bg-dark border border-card-border rounded-lg px-3 py-2 text-sm"
                                            >
                                                {Array.from({ length: 24 }, (_, i) => (
                                                    <option key={i} value={i}>{formatHour(i)}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <span className="text-text-muted">to</span>

                                        <div className="flex items-center gap-2">
                                            <label className="text-sm text-text-muted">Closes:</label>
                                            <select
                                                value={day.endHour}
                                                onChange={(e) => updateDay(index, { endHour: parseInt(e.target.value) })}
                                                className="bg-bg-dark border border-card-border rounded-lg px-3 py-2 text-sm"
                                            >
                                                {Array.from({ length: 24 }, (_, i) => i + 1).map((hour) => (
                                                    <option key={hour} value={hour}>{formatHour(hour)}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <span className="text-xs text-text-muted ml-auto">
                                            {day.endHour - day.startHour} hours
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
                <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                const newSchedule = operatingHours.schedule.map(day => ({ ...day, open: true }));
                                setOperatingHours({ ...operatingHours, schedule: newSchedule });
                            }}
                        >
                            Open All Days
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                const newSchedule = operatingHours.schedule.map((day, i) => ({
                                    ...day,
                                    open: i !== 0, // Close Sunday only
                                }));
                                setOperatingHours({ ...operatingHours, schedule: newSchedule });
                            }}
                        >
                            Close Sundays Only
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                const newSchedule = operatingHours.schedule.map((day, i) => ({
                                    ...day,
                                    open: i >= 1 && i <= 5, // Monday to Friday
                                }));
                                setOperatingHours({ ...operatingHours, schedule: newSchedule });
                            }}
                        >
                            Weekdays Only
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                const newSchedule = operatingHours.schedule.map(day => ({
                                    ...day,
                                    startHour: 8,
                                    endHour: 20,
                                }));
                                setOperatingHours({ ...operatingHours, schedule: newSchedule });
                            }}
                        >
                            Set All to 8 AM - 8 PM
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
