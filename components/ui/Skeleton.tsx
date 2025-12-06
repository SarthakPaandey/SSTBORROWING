'use client';

import { cn } from '@/lib/utils';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'card' | 'avatar' | 'button' | 'badge';
    width?: string;
    height?: string;
    count?: number;
}

/**
 * Shimmer skeleton component for loading states
 * Matches the glass/aurora aesthetic of the app
 */
export function Skeleton({
    className,
    variant = 'text',
    width,
    height,
    count = 1,
}: SkeletonProps) {
    const baseClasses = 'skeleton animate-pulse rounded-lg';

    const variantClasses = {
        text: 'h-4 w-full',
        card: 'h-32 w-full',
        avatar: 'h-10 w-10 rounded-full',
        button: 'h-10 w-24',
        badge: 'h-6 w-16',
    };

    const elements = Array.from({ length: count }, (_, i) => (
        <div
            key={i}
            className={cn(baseClasses, variantClasses[variant], className)}
            style={{
                width: width,
                height: height,
                animationDelay: `${i * 0.1}s`,
            }}
        />
    ));

    return count > 1 ? <div className="space-y-3">{elements}</div> : elements[0];
}

/**
 * Skeleton card with header and content
 */
export function SkeletonCard({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                'rounded-xl border border-card-border/50 bg-bg-dark/40 p-5 space-y-4',
                className
            )}
        >
            {/* Header row */}
            <div className="flex items-center gap-4">
                <div className="skeleton h-12 w-12 rounded-xl" />
                <div className="space-y-2 flex-1">
                    <div className="skeleton h-4 w-1/3 rounded" />
                    <div className="skeleton h-3 w-1/4 rounded" />
                </div>
                <div className="skeleton h-6 w-20 rounded-full" />
            </div>
            {/* Content */}
            <div className="space-y-2">
                <div className="skeleton h-3 w-full rounded" />
                <div className="skeleton h-3 w-2/3 rounded" />
            </div>
        </div>
    );
}

/**
 * Skeleton for booking cards list
 */
export function SkeletonBookingList({ count = 3 }: { count?: number }) {
    return (
        <div className="space-y-4">
            {Array.from({ length: count }, (_, i) => (
                <SkeletonCard key={i} />
            ))}
        </div>
    );
}

/**
 * Skeleton for stats grid
 */
export function SkeletonStats() {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }, (_, i) => (
                <div
                    key={i}
                    className="rounded-xl border border-card-border/50 bg-bg-dark/40 p-4 space-y-2"
                    style={{ animationDelay: `${i * 0.1}s` }}
                >
                    <div className="skeleton h-8 w-12 rounded" />
                    <div className="skeleton h-3 w-20 rounded" />
                </div>
            ))}
        </div>
    );
}

/**
 * Full page skeleton for dashboard
 */
export function SkeletonDashboard() {
    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header skeleton */}
            <div className="rounded-2xl border border-card-border/50 bg-bg-dark/40 p-6">
                <div className="flex items-center gap-4">
                    <div className="skeleton h-16 w-16 rounded-2xl" />
                    <div className="space-y-2">
                        <div className="skeleton h-8 w-48 rounded" />
                        <div className="skeleton h-4 w-32 rounded" />
                    </div>
                </div>
            </div>
            {/* Stats grid */}
            <SkeletonStats />
            {/* Cards */}
            <SkeletonBookingList count={2} />
        </div>
    );
}
