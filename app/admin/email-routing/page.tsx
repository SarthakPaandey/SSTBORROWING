'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/LoadingState';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Mail, Plus, Trash2, Save, RotateCcw, AlertCircle, Check, X } from 'lucide-react';
import { toast } from 'sonner';

interface EmailRoutingCategory {
    category: string;
    label: string;
    description: string;
    emails: string[];
    enabled: boolean;
    isConfigured: boolean;
    updatedAt?: string;
}

export default function EmailRoutingPage() {
    const [categories, setCategories] = useState<EmailRoutingCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [pendingChanges, setPendingChanges] = useState<Map<string, { emails: string[]; enabled: boolean }>>(new Map());
    const [newEmails, setNewEmails] = useState<Map<string, string>>(new Map());

    useEffect(() => {
        fetchRoutingConfig();
    }, []);

    const fetchRoutingConfig = async () => {
        try {
            const res = await fetch('/api/admin/email-routing');
            const data = await res.json();
            setCategories(data.categories || []);
            setPendingChanges(new Map());
            setNewEmails(new Map());
        } catch (error) {
            console.error('Failed to fetch routing config:', error);
            toast.error('Failed to load email routing configuration');
        } finally {
            setLoading(false);
        }
    };

    const getCategoryState = (category: string) => {
        const pending = pendingChanges.get(category);
        const original = categories.find(c => c.category === category);
        return {
            emails: pending?.emails ?? original?.emails ?? [],
            enabled: pending?.enabled ?? original?.enabled ?? false,
        };
    };

    const updateCategoryState = (category: string, updates: Partial<{ emails: string[]; enabled: boolean }>) => {
        const current = getCategoryState(category);
        setPendingChanges(prev => {
            const next = new Map(prev);
            next.set(category, {
                emails: updates.emails ?? current.emails,
                enabled: updates.enabled ?? current.enabled,
            });
            return next;
        });
    };

    const addEmail = (category: string) => {
        const newEmail = newEmails.get(category)?.trim().toLowerCase();
        if (!newEmail) return;

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newEmail)) {
            toast.error('Please enter a valid email address');
            return;
        }

        const current = getCategoryState(category);
        if (current.emails.includes(newEmail)) {
            toast.error('This email is already added');
            return;
        }

        updateCategoryState(category, {
            emails: [...current.emails, newEmail],
            enabled: true, // Auto-enable when adding emails
        });

        // Clear the input
        setNewEmails(prev => {
            const next = new Map(prev);
            next.delete(category);
            return next;
        });
    };

    const removeEmail = (category: string, email: string) => {
        const current = getCategoryState(category);
        const newEmails = current.emails.filter(e => e !== email);
        updateCategoryState(category, { emails: newEmails });
    };

    const toggleEnabled = (category: string) => {
        const current = getCategoryState(category);
        updateCategoryState(category, { enabled: !current.enabled });
    };

    const saveCategory = async (category: string) => {
        const state = getCategoryState(category);

        if (state.emails.length === 0) {
            toast.error('Add at least one email address before saving');
            return;
        }

        setSaving(category);
        try {
            const res = await fetch('/api/admin/email-routing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category,
                    emails: state.emails,
                    enabled: state.enabled,
                }),
            });

            const data = await res.json();

            if (res.ok) {
                toast.success(data.message);
                fetchRoutingConfig();
            } else {
                toast.error(data.error || 'Failed to save');
            }
        } catch {
            toast.error('Failed to save routing configuration');
        } finally {
            setSaving(null);
        }
    };

    const deleteCategory = async (category: string) => {
        if (!confirm('Remove email routing for this category? It will fall back to default routing.')) {
            return;
        }

        setSaving(category);
        try {
            const res = await fetch('/api/admin/email-routing', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category }),
            });

            const data = await res.json();

            if (res.ok) {
                toast.success(data.message);
                fetchRoutingConfig();
            } else {
                toast.error(data.error || 'Failed to delete');
            }
        } catch {
            toast.error('Failed to delete routing configuration');
        } finally {
            setSaving(null);
        }
    };

    const hasChanges = (category: string) => {
        return pendingChanges.has(category);
    };

    if (loading) {
        return (
            <LoadingState
                title="Loading email routing"
                subtitle="Fetching configuration..."
                variant="galaxy"
            />
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold flex items-center gap-3">
                    <Mail className="w-8 h-8 text-accent-purple-1" />
                    Email Routing
                </h1>
                <p className="text-text-muted mt-1">
                    Configure which email addresses receive approval notifications for each resource category
                </p>
            </div>

            {/* Info Banner */}
            <div className="bg-accent-blue/10 border border-accent-blue/30 rounded-lg p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-accent-blue flex-shrink-0 mt-0.5" />
                <div className="text-sm text-text-main">
                    <p className="font-medium mb-1">How Email Routing Works</p>
                    <ul className="text-text-muted space-y-1">
                        <li>• When a booking requires approval, the system checks for configured routing</li>
                        <li>• If no category-specific routing exists, it falls back to the <strong>Default Fallback</strong></li>
                        <li>• If no routing is configured at all, emails are sent to <strong>all admins</strong></li>
                    </ul>
                </div>
            </div>

            {/* Routing Categories */}
            <div className="grid gap-4">
                {categories.map(cat => {
                    const state = getCategoryState(cat.category);
                    const isModified = hasChanges(cat.category);
                    const isSaving = saving === cat.category;

                    return (
                        <Card key={cat.category} className={isModified ? 'ring-2 ring-accent-blue/50' : ''}>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Mail className="w-5 h-5 text-accent-purple-1" />
                                        <div>
                                            <span>{cat.label}</span>
                                            <p className="text-sm font-normal text-text-muted mt-0.5">
                                                {cat.description}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {cat.isConfigured && (
                                            <Badge variant={state.enabled ? 'success' : 'warning'}>
                                                {state.enabled ? 'Active' : 'Disabled'}
                                            </Badge>
                                        )}
                                        {!cat.isConfigured && (
                                            <Badge variant="default">Not configured</Badge>
                                        )}
                                        {isModified && (
                                            <Badge variant="info">Modified</Badge>
                                        )}
                                    </div>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Email List */}
                                <div className="space-y-2">
                                    {state.emails.length === 0 ? (
                                        <p className="text-sm text-text-muted italic">
                                            No emails configured. Add emails below.
                                        </p>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {state.emails.map(email => (
                                                <div
                                                    key={email}
                                                    className="flex items-center gap-2 bg-bg-dark rounded-lg px-3 py-1.5 text-sm"
                                                >
                                                    <span className="text-text-main">{email}</span>
                                                    <button
                                                        onClick={() => removeEmail(cat.category, email)}
                                                        className="text-text-muted hover:text-red-400 transition-colors"
                                                        disabled={isSaving}
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Add Email Input */}
                                <div className="flex gap-2">
                                    <Input
                                        type="email"
                                        placeholder="Enter email address..."
                                        value={newEmails.get(cat.category) || ''}
                                        onChange={(e) => {
                                            setNewEmails(prev => {
                                                const next = new Map(prev);
                                                next.set(cat.category, e.target.value);
                                                return next;
                                            });
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                addEmail(cat.category);
                                            }
                                        }}
                                        className="flex-1"
                                        disabled={isSaving}
                                    />
                                    <Button
                                        onClick={() => addEmail(cat.category)}
                                        variant="ghost"
                                        className="text-accent-blue hover:bg-accent-blue/10"
                                        disabled={isSaving}
                                    >
                                        <Plus className="w-4 h-4 mr-1" />
                                        Add
                                    </Button>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center justify-between pt-2 border-t border-card-border">
                                    <div className="flex items-center gap-2">
                                        {state.emails.length > 0 && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => toggleEnabled(cat.category)}
                                                disabled={isSaving}
                                                className={state.enabled ? 'text-green-400' : 'text-yellow-400'}
                                            >
                                                {state.enabled ? (
                                                    <>
                                                        <Check className="w-4 h-4 mr-1" />
                                                        Enabled
                                                    </>
                                                ) : (
                                                    <>
                                                        <X className="w-4 h-4 mr-1" />
                                                        Disabled
                                                    </>
                                                )}
                                            </Button>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {cat.isConfigured && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => deleteCategory(cat.category)}
                                                disabled={isSaving}
                                                className="text-red-400 hover:bg-red-500/10"
                                            >
                                                <Trash2 className="w-4 h-4 mr-1" />
                                                Remove
                                            </Button>
                                        )}

                                        {isModified && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => {
                                                    setPendingChanges(prev => {
                                                        const next = new Map(prev);
                                                        next.delete(cat.category);
                                                        return next;
                                                    });
                                                }}
                                                disabled={isSaving}
                                                className="text-text-muted"
                                            >
                                                <RotateCcw className="w-4 h-4 mr-1" />
                                                Reset
                                            </Button>
                                        )}

                                        <Button
                                            size="sm"
                                            onClick={() => saveCategory(cat.category)}
                                            disabled={isSaving || state.emails.length === 0}
                                            className="bg-accent-blue hover:bg-accent-blue/90"
                                        >
                                            <Save className="w-4 h-4 mr-1" />
                                            {isSaving ? 'Saving...' : 'Save'}
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
