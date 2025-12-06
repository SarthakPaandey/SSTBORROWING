'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
    icon?: string;
    title: string;
    description: string;
    actionLabel?: string;
    actionHref?: string;
    onAction?: () => void;
    variant?: 'default' | 'success' | 'muted';
    className?: string;
}

/**
 * Illustrated empty state component with optional CTA
 * Used when lists or content areas have no items
 */
export function EmptyState({
    icon = '📭',
    title,
    description,
    actionLabel,
    actionHref,
    onAction,
    variant = 'default',
    className,
}: EmptyStateProps) {
    const variantStyles = {
        default: 'from-accent-blue/10 to-accent-blue/5 border-accent-blue/20',
        success: 'from-success/10 to-success/5 border-success/20',
        muted: 'from-text-muted/10 to-text-muted/5 border-text-muted/20',
    };

    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center py-12 px-6 text-center rounded-2xl',
                `bg-gradient-to-br ${variantStyles[variant]} border`,
                'animate-fade-in',
                className
            )}
        >
            {/* Animated icon */}
            <div className="relative mb-6">
                <div className="absolute inset-0 blur-xl opacity-30 animate-pulse">
                    <span className="text-6xl">{icon}</span>
                </div>
                <span className="relative text-6xl animate-float">{icon}</span>
            </div>

            {/* Title */}
            <h3 className="text-xl font-semibold text-text-main mb-2">{title}</h3>

            {/* Description */}
            <p className="text-text-muted mb-6 max-w-sm">{description}</p>

            {/* CTA Button */}
            {(actionLabel && actionHref) || (actionLabel && onAction) ? (
                actionHref ? (
                    <Link href={actionHref}>
                        <Button variant="gradient" className="group">
                            <Sparkles className="mr-2 h-4 w-4 group-hover:animate-pulse" />
                            {actionLabel}
                        </Button>
                    </Link>
                ) : (
                    <Button variant="gradient" onClick={onAction} className="group">
                        <Sparkles className="mr-2 h-4 w-4 group-hover:animate-pulse" />
                        {actionLabel}
                    </Button>
                )
            ) : null}
        </div>
    );
}

/**
 * Preset empty states for common scenarios
 */
export function EmptyBookings() {
    return (
        <EmptyState
            icon="📅"
            title="No Upcoming Bookings"
            description="Your schedule is clear! Time to book something?"
            actionLabel="Browse Facilities"
            actionHref="/user/facilities"
        />
    );
}

export function EmptyPenalties() {
    return (
        <EmptyState
            icon="✨"
            title="No Penalties"
            description="Great job! You're in good standing with no penalty points."
            variant="success"
        />
    );
}

export function EmptyHistory() {
    return (
        <EmptyState
            icon="📜"
            title="No Past Bookings"
            description="Your booking history will appear here after you make your first reservation."
            variant="muted"
        />
    );
}
