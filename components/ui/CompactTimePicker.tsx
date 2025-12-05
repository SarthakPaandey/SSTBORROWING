'use client';

import { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { getISTToday, getISTNow } from '@/lib/timezone-client';
import { Clock, ChevronDown, Zap, X } from 'lucide-react';

interface CompactTimePickerProps {
    date: string;
    value: string;
    onChange: (time: string) => void;
    minTime?: string;
    maxTime?: string;
    stepMinutes?: number;
    label?: string;
    className?: string;
    /** Optional hint about duration policy (e.g., "Sports: 75 min • Lab: 24 hours"). If not provided, no hint is shown. */
    durationHint?: string;
}

export function CompactTimePicker({
    date,
    value,
    onChange,
    minTime = '09:00',
    maxTime = '20:00',
    stepMinutes = 30,
    label,
    className,
    durationHint,
}: CompactTimePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    // For portal - wait for client-side mount
    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Close on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        if (isOpen) {
            window.addEventListener('keydown', handleEscape);
            return () => window.removeEventListener('keydown', handleEscape);
        }
    }, [isOpen]);

    const availableTimes = useMemo(() => {
        const times: string[] = [];
        const [minHour, minMinute] = minTime.split(':').map(Number);
        const [maxHour, maxMinute] = maxTime.split(':').map(Number);
        const minTotalMinutes = minHour * 60 + minMinute;
        const maxTotalMinutes = maxHour * 60 + maxMinute;

        for (let totalMinutes = minTotalMinutes; totalMinutes <= maxTotalMinutes; totalMinutes += stepMinutes) {
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            times.push(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
        }

        const today = getISTToday();
        if (date === today) {
            const now = getISTNow();
            const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
            const roundedCurrentMinutes = Math.ceil(currentTotalMinutes / stepMinutes) * stepMinutes;
            return times.filter((time) => {
                const [hour, minute] = time.split(':').map(Number);
                return hour * 60 + minute >= roundedCurrentMinutes;
            });
        }
        return times;
    }, [date, minTime, maxTime, stepMinutes]);

    const getQuickSlots = useMemo(() => {
        const today = getISTToday();
        const now = getISTNow();
        const slots: { label: string; time: string; icon?: string }[] = [];

        if (date === today) {
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            const roundedMinutes = Math.ceil(currentMinutes / stepMinutes) * stepMinutes;

            const nowTime = `${Math.floor(roundedMinutes / 60).toString().padStart(2, '0')}:${(roundedMinutes % 60).toString().padStart(2, '0')}`;
            if (availableTimes.includes(nowTime)) slots.push({ label: 'Now', time: nowTime, icon: '⚡' });

            const plus30 = roundedMinutes + 30;
            const plus30Time = `${Math.floor(plus30 / 60).toString().padStart(2, '0')}:${(plus30 % 60).toString().padStart(2, '0')}`;
            if (availableTimes.includes(plus30Time)) slots.push({ label: '+30m', time: plus30Time });

            const plus60 = roundedMinutes + 60;
            const plus60Time = `${Math.floor(plus60 / 60).toString().padStart(2, '0')}:${(plus60 % 60).toString().padStart(2, '0')}`;
            if (availableTimes.includes(plus60Time)) slots.push({ label: '+1h', time: plus60Time });
        } else {
            ['09:00', '10:00', '12:00', '14:00'].forEach((time, i) => {
                if (availableTimes.includes(time)) {
                    slots.push({ label: ['9 AM', '10 AM', '12 PM', '2 PM'][i], time });
                }
            });
        }
        return slots.slice(0, 4);
    }, [date, availableTimes, stepMinutes]);

    const timeGroups = useMemo(() => ({
        morning: availableTimes.filter(t => { const h = parseInt(t.split(':')[0]); return h >= 5 && h < 12; }),
        afternoon: availableTimes.filter(t => { const h = parseInt(t.split(':')[0]); return h >= 12 && h < 17; }),
        evening: availableTimes.filter(t => { const h = parseInt(t.split(':')[0]); return h >= 17; }),
    }), [availableTimes]);

    const formatTime = (time: string): string => {
        const [hours, minutes] = time.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    };

    const handleTimeSelect = (time: string) => {
        onChange(time);
        setIsOpen(false);
    };

    if (availableTimes.length === 0) {
        return (
            <div className={cn('', className)}>
                {label && <label className="text-sm font-medium text-text-main mb-2 block">{label}</label>}
                <div className="bg-surface-card/50 rounded-xl p-4 text-center text-text-muted text-sm">
                    No available times for this date
                </div>
            </div>
        );
    }

    // Modal content to be portaled
    const modalContent = isOpen && mounted ? createPortal(
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
            }}
        >
            {/* Backdrop */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.75)',
                    backdropFilter: 'blur(4px)',
                }}
                onClick={() => setIsOpen(false)}
            />

            {/* Modal Box */}
            <div
                style={{
                    position: 'relative',
                    backgroundColor: 'var(--surface-card, #1a1a2e)',
                    borderRadius: '16px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    width: '100%',
                    maxWidth: '360px',
                    maxHeight: '70vh',
                    overflow: 'hidden',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border-subtle" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent-blue/10 flex items-center justify-center">
                            <Clock className="h-5 w-5 text-accent-blue" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-text-main">Select Time</h3>
                            <p className="text-xs text-text-muted">Choose pickup time</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="w-8 h-8 rounded-lg hover:bg-red-500/20 flex items-center justify-center transition-colors"
                    >
                        <X className="h-4 w-4 text-text-muted hover:text-red-400" />
                    </button>
                </div>

                {/* Time Grid */}
                <div className="p-4 space-y-4 overflow-y-auto" style={{ maxHeight: '45vh' }}>
                    {timeGroups.morning.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium text-text-muted">
                                <span>🌅</span><span>Morning</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {timeGroups.morning.map((time) => (
                                    <button
                                        key={time}
                                        onClick={() => handleTimeSelect(time)}
                                        className={cn(
                                            'px-2 py-2.5 rounded-lg text-sm font-medium transition-all',
                                            value === time
                                                ? 'bg-accent-blue text-white shadow-lg shadow-accent-blue/30'
                                                : 'bg-surface-elevated hover:bg-accent-blue/20 text-text-main border border-border-subtle'
                                        )}
                                    >
                                        {formatTime(time)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {timeGroups.afternoon.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium text-text-muted">
                                <span>☀️</span><span>Afternoon</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {timeGroups.afternoon.map((time) => (
                                    <button
                                        key={time}
                                        onClick={() => handleTimeSelect(time)}
                                        className={cn(
                                            'px-2 py-2.5 rounded-lg text-sm font-medium transition-all',
                                            value === time
                                                ? 'bg-accent-blue text-white shadow-lg shadow-accent-blue/30'
                                                : 'bg-surface-elevated hover:bg-accent-blue/20 text-text-main border border-border-subtle'
                                        )}
                                    >
                                        {formatTime(time)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {timeGroups.evening.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium text-text-muted">
                                <span>🌆</span><span>Evening</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {timeGroups.evening.map((time) => (
                                    <button
                                        key={time}
                                        onClick={() => handleTimeSelect(time)}
                                        className={cn(
                                            'px-2 py-2.5 rounded-lg text-sm font-medium transition-all',
                                            value === time
                                                ? 'bg-accent-blue text-white shadow-lg shadow-accent-blue/30'
                                                : 'bg-surface-elevated hover:bg-accent-blue/20 text-text-main border border-border-subtle'
                                        )}
                                    >
                                        {formatTime(time)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border-subtle flex items-center justify-between" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                    <span className="text-sm text-text-muted">Selected:</span>
                    <span className="text-lg font-bold text-accent-blue">{formatTime(value)}</span>
                </div>
            </div>
        </div>,
        document.body
    ) : null;

    return (
        <>
            <div className={cn('', className)}>
                {label && <label className="text-sm font-medium text-text-main mb-3 block">{label}</label>}

                <div className="bg-gradient-to-br from-surface-card to-surface-card/80 rounded-xl border border-border-subtle p-4 space-y-3">
                    {getQuickSlots.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                            <Zap className="h-4 w-4 text-amber-400" />
                            <span className="text-xs text-text-muted mr-1">Quick:</span>
                            {getQuickSlots.map((slot) => (
                                <button
                                    key={slot.time}
                                    onClick={() => onChange(slot.time)}
                                    className={cn(
                                        'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                                        value === slot.time
                                            ? 'bg-accent-blue text-white shadow-lg shadow-accent-blue/30'
                                            : 'bg-surface-elevated hover:bg-surface-elevated/80 text-text-main border border-border-subtle hover:border-accent-blue/50'
                                    )}
                                >
                                    {slot.icon && <span className="mr-1">{slot.icon}</span>}
                                    {slot.label}
                                </button>
                            ))}
                        </div>
                    )}

                    <button
                        onClick={() => setIsOpen(true)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-surface-elevated border border-border-subtle hover:border-accent-blue/50 transition-all duration-200 text-left group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-accent-blue/10 flex items-center justify-center">
                                <Clock className="h-4 w-4 text-accent-blue" />
                            </div>
                            <div>
                                <div className="text-xs text-text-muted">Pickup at</div>
                                <div className="text-sm font-semibold text-text-main">{formatTime(value)}</div>
                            </div>
                        </div>
                        <ChevronDown className="h-5 w-5 text-text-muted group-hover:text-accent-blue transition-colors" />
                    </button>

                    {durationHint && (
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                            {durationHint}
                        </div>
                    )}
                </div>
            </div>

            {modalContent}
        </>
    );
}
