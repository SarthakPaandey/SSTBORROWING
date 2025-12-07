'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedCounterProps {
    value: number;
    duration?: number;
    delay?: number;
    prefix?: string;
    suffix?: string;
    separator?: string;
    decimals?: number;
    className?: string;
    onComplete?: () => void;
}

function easeOutQuart(t: number): number {
    return 1 - Math.pow(1 - t, 4);
}

export function AnimatedCounter({
    value,
    duration = 1500,
    delay = 0,
    prefix = '',
    suffix = '',
    separator = ',',
    decimals = 0,
    className,
    onComplete,
}: AnimatedCounterProps) {
    const [displayValue, setDisplayValue] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);
    const elementRef = useRef<HTMLSpanElement>(null);
    const hasAnimated = useRef(false);

    const formatNumber = (num: number): string => {
        const fixed = num.toFixed(decimals);
        const [intPart, decPart] = fixed.split('.');

        // Add thousand separators
        const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, separator);

        return decPart ? `${formatted}.${decPart}` : formatted;
    };

    useEffect(() => {
        // Use Intersection Observer for scroll trigger
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && !hasAnimated.current) {
                        hasAnimated.current = true;

                        // Start animation after delay
                        setTimeout(() => {
                            setIsAnimating(true);
                            const startTime = Date.now();
                            const startValue = 0;

                            const animate = () => {
                                const elapsed = Date.now() - startTime;
                                const progress = Math.min(elapsed / duration, 1);
                                const easedProgress = easeOutQuart(progress);
                                const currentValue = startValue + (value - startValue) * easedProgress;

                                setDisplayValue(currentValue);

                                if (progress < 1) {
                                    requestAnimationFrame(animate);
                                } else {
                                    setDisplayValue(value);
                                    setIsAnimating(false);
                                    onComplete?.();
                                }
                            };

                            requestAnimationFrame(animate);
                        }, delay);
                    }
                });
            },
            { threshold: 0.1 }
        );

        if (elementRef.current) {
            observer.observe(elementRef.current);
        }

        return () => observer.disconnect();
    }, [value, duration, delay, onComplete]);

    // Update display when value changes after initial animation
    useEffect(() => {
        if (hasAnimated.current && !isAnimating) {
            setDisplayValue(value);
        }
    }, [value, isAnimating]);

    return (
        <span
            ref={elementRef}
            className={cn(
                'stat-number tabular-nums',
                isAnimating && 'counting',
                className
            )}
        >
            {prefix}
            {formatNumber(displayValue)}
            {suffix}
        </span>
    );
}

// Simpler version without intersection observer - animates immediately
interface SimpleCounterProps {
    value: number;
    duration?: number;
    className?: string;
}

export function SimpleCounter({ value, duration = 1000, className }: SimpleCounterProps) {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let startTime: number;
        let animationFrame: number;

        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            const easedProgress = easeOutQuart(progress);

            setCount(Math.floor(easedProgress * value));

            if (progress < 1) {
                animationFrame = requestAnimationFrame(animate);
            } else {
                setCount(value);
            }
        };

        animationFrame = requestAnimationFrame(animate);

        return () => {
            if (animationFrame) {
                cancelAnimationFrame(animationFrame);
            }
        };
    }, [value, duration]);

    return (
        <span className={cn('tabular-nums', className)}>
            {count}
        </span>
    );
}

// Progress bar with animated fill
interface AnimatedProgressProps {
    value: number;
    max?: number;
    showLabel?: boolean;
    variant?: 'default' | 'success' | 'warning' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export function AnimatedProgress({
    value,
    max = 100,
    showLabel = false,
    variant = 'default',
    size = 'md',
    className,
}: AnimatedProgressProps) {
    const percentage = Math.min((value / max) * 100, 100);

    const variantStyles = {
        default: 'bg-gradient-to-r from-accent-blue to-accent-cyan',
        success: 'bg-gradient-to-r from-success to-emerald-400',
        warning: 'bg-gradient-to-r from-warning to-amber-400',
        danger: 'bg-gradient-to-r from-danger to-red-400',
    };

    const sizeStyles = {
        sm: 'h-1',
        md: 'h-2',
        lg: 'h-3',
    };

    return (
        <div className={cn('w-full', className)}>
            <div className={cn('progress-bar', sizeStyles[size])}>
                <div
                    className={cn('progress-fill', variantStyles[variant])}
                    style={{ width: `${percentage}%` }}
                />
            </div>
            {showLabel && (
                <div className="mt-1 flex justify-between text-xs text-text-muted">
                    <span>{value}</span>
                    <span>{max}</span>
                </div>
            )}
        </div>
    );
}
