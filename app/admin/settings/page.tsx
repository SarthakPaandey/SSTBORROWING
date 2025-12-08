'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/LoadingState';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Settings, Clock, AlertTriangle, Sliders, RotateCcw, Save, HelpCircle, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

interface PolicyConfig {
    key: string;
    value: number;
    defaultValue: number;
    description: string;
    helpText?: string;
    category: string;
    min: number;
    max: number;
    isCustom: boolean;
    updatedAt?: string;
}

interface GroupedPolicies {
    limits: PolicyConfig[];
    durations: PolicyConfig[];
    durations_facility: PolicyConfig[];
    durations_room: PolicyConfig[];
    durations_sports: PolicyConfig[];
    durations_lab: PolicyConfig[];
    penalties: PolicyConfig[];
    general: PolicyConfig[];
}

type DurationCategory = 'durations' | 'durations_facility' | 'durations_room' | 'durations_sports' | 'durations_lab';

const DURATION_OPTIONS: { value: DurationCategory; label: string; emoji: string }[] = [
    { value: 'durations', label: 'All Resources (Global)', emoji: '🌐' },
    { value: 'durations_facility', label: 'Facilities', emoji: '🏟️' },
    { value: 'durations_room', label: 'Rooms', emoji: '🚪' },
    { value: 'durations_sports', label: 'Sports Equipment', emoji: '⚽' },
    { value: 'durations_lab', label: 'Lab Equipment', emoji: '🔬' },
];

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
    const [selectedDurationCategory, setSelectedDurationCategory] = useState<DurationCategory>('durations');
    const [dropdownOpen, setDropdownOpen] = useState(false);

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

    const renderPolicyItem = (policy: PolicyConfig) => {
        const currentValue = pendingChanges.get(policy.key) ?? policy.value;
        const isModified = pendingChanges.has(policy.key);
        const isCustom = policy.isCustom || isModified;

        return (
            <div
                key={policy.key}
                className="flex items-center justify-between p-4 rounded-lg border border-card-border bg-bg-dark hover:border-accent-blue/30 transition-colors"
            >
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
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
                    {policy.helpText && (
                        <p className="text-sm text-text-muted mt-1.5 leading-relaxed">
                            <HelpCircle className="w-3.5 h-3.5 inline-block mr-1.5 opacity-60" />
                            {policy.helpText}
                        </p>
                    )}
                    <p className="text-xs text-text-muted/70 mt-1">
                        Default: {policy.defaultValue} • Range: {policy.min}-{policy.max}
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
    const selectedDurationOption = DURATION_OPTIONS.find(o => o.value === selectedDurationCategory);
    const currentDurationPolicies = grouped[selectedDurationCategory] || [];

    // Categories to render (excluding per-type duration categories which are handled separately)
    const mainCategories: (keyof GroupedPolicies)[] = ['limits', 'penalties', 'general'];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Settings className="w-8 h-8 text-accent-purple-1" />
                        System Settings
                    </h1>
                    <p className="text-text-muted mt-1">
                        Configure booking limits, durations, and penalties
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {hasChanges && (
                        <Badge variant="warning">{pendingChanges.size} unsaved change(s)</Badge>
                    )}
                    <Button
                        onClick={handleSave}
                        disabled={saving || !hasChanges}
                        className={hasChanges
                            ? "bg-accent-blue hover:bg-accent-blue/90"
                            : "bg-gray-600 cursor-not-allowed opacity-60"
                        }
                    >
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? 'Saving...' : hasChanges ? 'Save Changes' : 'No Changes'}
                    </Button>
                </div>
            </div>

            {/* Duration Settings Card with Dropdown */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-accent-purple-1/10">
                                <Clock className="w-5 h-5" />
                            </div>
                            <div>
                                <span>Duration Settings</span>
                                <p className="text-sm font-normal text-text-muted mt-0.5">
                                    Configure timing and working hours per resource type
                                </p>
                            </div>
                        </div>

                        {/* Resource Type Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setDropdownOpen(!dropdownOpen)}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-card-border bg-bg-dark hover:border-accent-purple-1/50 transition-colors min-w-[200px]"
                            >
                                <span className="text-lg">{selectedDurationOption?.emoji}</span>
                                <span className="flex-1 text-left text-text-main">
                                    {selectedDurationOption?.label}
                                </span>
                                <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {dropdownOpen && (
                                <div className="absolute right-0 mt-2 w-full min-w-[220px] rounded-lg border border-card-border bg-bg-dark shadow-xl z-50">
                                    {DURATION_OPTIONS.map(option => (
                                        <button
                                            key={option.value}
                                            onClick={() => {
                                                setSelectedDurationCategory(option.value);
                                                setDropdownOpen(false);
                                            }}
                                            className={`flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-accent-purple-1/10 transition-colors first:rounded-t-lg last:rounded-b-lg ${option.value === selectedDurationCategory ? 'bg-accent-purple-1/20 text-accent-purple-1' : 'text-text-main'
                                                }`}
                                        >
                                            <span className="text-xl">{option.emoji}</span>
                                            <span>{option.label}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {currentDurationPolicies.length === 0 ? (
                            <p className="text-center text-text-muted py-8">
                                No duration settings configured for this resource type yet.
                            </p>
                        ) : (
                            currentDurationPolicies.map(renderPolicyItem)
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Other Policy Categories */}
            {mainCategories.map(category => (
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
                            {grouped[category].map(renderPolicyItem)}
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

