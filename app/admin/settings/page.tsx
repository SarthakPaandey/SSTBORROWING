'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/LoadingState';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Settings, Clock, AlertTriangle, Sliders, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';

interface PolicyConfig {
    key: string;
    value: number;
    defaultValue: number;
    description: string;
    category: string;
    min: number;
    max: number;
    isCustom: boolean;
    updatedAt?: string;
}

interface GroupedPolicies {
    limits: PolicyConfig[];
    durations: PolicyConfig[];
    penalties: PolicyConfig[];
    general: PolicyConfig[];
}

const categoryIcons: Record<string, React.ReactNode> = {
    limits: <Sliders className="w-5 h-5" />,
    durations: <Clock className="w-5 h-5" />,
    penalties: <AlertTriangle className="w-5 h-5" />,
    general: <Settings className="w-5 h-5" />,
};

const categoryTitles: Record<string, string> = {
    limits: 'Booking Limits',
    durations: 'Duration Settings',
    penalties: 'Penalty Settings',
    general: 'General Settings',
};

const categoryDescriptions: Record<string, string> = {
    limits: 'Control how many bookings users can make',
    durations: 'Configure timing and working hours',
    penalties: 'Adjust penalty thresholds and suspensions',
    general: 'Other system-wide settings',
};

export default function AdminSettingsPage() {
    const [grouped, setGrouped] = useState<GroupedPolicies | null>(null);
    const [loading, setLoading] = useState(true);
    const [pendingChanges, setPendingChanges] = useState<Map<string, number>>(new Map());
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const res = await fetch('/api/admin/config');
            const data = await res.json();
            setGrouped(data.grouped);
        } catch (error) {
            console.error('Failed to fetch config:', error);
            toast.error('Failed to load settings');
        } finally {
            setLoading(false);
        }
    };

    const handleValueChange = (key: string, value: number) => {
        setPendingChanges(prev => {
            const next = new Map(prev);
            next.set(key, value);
            return next;
        });
    };

    const resetValue = (key: string, defaultValue: number) => {
        setPendingChanges(prev => {
            const next = new Map(prev);
            next.delete(key);
            return next;
        });
        // Also reset in the UI
        if (grouped) {
            const updated = { ...grouped };
            for (const category of Object.keys(updated) as (keyof GroupedPolicies)[]) {
                updated[category] = updated[category].map(p =>
                    p.key === key ? { ...p, value: defaultValue, isCustom: false } : p
                );
            }
            setGrouped(updated);
        }
    };

    const handleReset = async (key: string) => {
        try {
            const res = await fetch('/api/admin/config', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key }),
            });

            const data = await res.json();

            if (res.ok) {
                toast.success(data.message);
                resetValue(key, data.defaultValue);
                fetchConfig(); // Refresh to get updated state
            } else {
                toast.error(data.error || 'Failed to reset');
            }
        } catch {
            toast.error('Failed to reset setting');
        }
    };

    const handleSave = async () => {
        if (pendingChanges.size === 0) {
            toast.info('No changes to save');
            return;
        }

        setSaving(true);
        try {
            const updates = Array.from(pendingChanges.entries()).map(([key, value]) => ({
                key,
                value,
            }));

            const res = await fetch('/api/admin/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates }),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                toast.success(data.message);
                setPendingChanges(new Map());
                fetchConfig();
            } else {
                // Show individual errors
                const errors = data.results?.filter((r: any) => !r.success) || [];
                if (errors.length > 0) {
                    errors.forEach((e: any) => toast.error(`${e.key}: ${e.error}`));
                } else {
                    toast.error(data.error || 'Failed to save');
                }
            }
        } catch {
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <LoadingState
                title="Loading settings"
                subtitle="Fetching system configuration..."
                variant="galaxy"
            />
        );
    }

    if (!grouped) {
        return (
            <div className="text-center py-12">
                <p className="text-text-muted">Failed to load settings</p>
            </div>
        );
    }

    const hasChanges = pendingChanges.size > 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Settings className="w-8 h-8 text-accent-purple-1" />
                        System Settings
                    </h1>
                    <p className="text-text-muted mt-1">
                        Configure booking limits, durations, and penalties
                    </p>
                </div>

                {hasChanges && (
                    <div className="flex items-center gap-3">
                        <Badge variant="warning">{pendingChanges.size} unsaved change(s)</Badge>
                        <Button
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-accent-blue hover:bg-accent-blue/90"
                        >
                            <Save className="w-4 h-4 mr-2" />
                            {saving ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                )}
            </div>

            {/* Policy Categories */}
            {(Object.keys(grouped) as (keyof GroupedPolicies)[]).map(category => (
                <Card key={category}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-accent-purple-1/10">
                                {categoryIcons[category]}
                            </div>
                            <div>
                                <span>{categoryTitles[category]}</span>
                                <p className="text-sm font-normal text-text-muted mt-0.5">
                                    {categoryDescriptions[category]}
                                </p>
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {grouped[category].map(policy => {
                                const currentValue = pendingChanges.get(policy.key) ?? policy.value;
                                const isModified = pendingChanges.has(policy.key);
                                const isCustom = policy.isCustom || isModified;

                                return (
                                    <div
                                        key={policy.key}
                                        className="flex items-center justify-between p-4 rounded-lg border border-card-border bg-bg-dark hover:border-accent-blue/30 transition-colors"
                                    >
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-text-main">
                                                    {policy.description}
                                                </span>
                                                {isCustom && (
                                                    <Badge variant="info" className="text-xs">
                                                        Custom
                                                    </Badge>
                                                )}
                                                {isModified && (
                                                    <Badge variant="warning" className="text-xs">
                                                        Modified
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-xs text-text-muted mt-1">
                                                Key: {policy.key} • Default: {policy.defaultValue} • Range: {policy.min}-{policy.max}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <Input
                                                type="number"
                                                value={currentValue}
                                                onChange={(e) => handleValueChange(policy.key, parseInt(e.target.value) || 0)}
                                                min={policy.min}
                                                max={policy.max}
                                                className="w-24 text-center"
                                            />

                                            {isCustom && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-text-muted hover:text-text-main"
                                                    onClick={() => handleReset(policy.key)}
                                                    title="Reset to default"
                                                >
                                                    <RotateCcw className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            ))}

            {/* Floating Save Button for mobile */}
            {hasChanges && (
                <div className="fixed bottom-6 right-6 md:hidden">
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        size="lg"
                        className="bg-accent-blue hover:bg-accent-blue/90 shadow-lg rounded-full px-6"
                    >
                        <Save className="w-5 h-5 mr-2" />
                        Save
                    </Button>
                </div>
            )}
        </div>
    );
}
