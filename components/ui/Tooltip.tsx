'use client';

import { ReactNode, useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface TooltipProps {
    children: ReactNode;
    content: ReactNode;
    side?: 'top' | 'bottom' | 'left' | 'right';
    align?: 'start' | 'center' | 'end';
    delayDuration?: number;
    className?: string;
}

export function Tooltip({
    children,
    content,
    side = 'top',
    align = 'center',
    delayDuration = 300,
    className,
}: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const updatePosition = useCallback(() => {
        if (!triggerRef.current || !tooltipRef.current) return;

        const triggerRect = triggerRef.current.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const padding = 8;

        let top = 0;
        let left = 0;

        // Calculate position based on side
        switch (side) {
            case 'top':
                top = triggerRect.top - tooltipRect.height - padding;
                break;
            case 'bottom':
                top = triggerRect.bottom + padding;
                break;
            case 'left':
                left = triggerRect.left - tooltipRect.width - padding;
                top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
                break;
            case 'right':
                left = triggerRect.right + padding;
                top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
                break;
        }

        // Calculate horizontal alignment for top/bottom
        if (side === 'top' || side === 'bottom') {
            switch (align) {
                case 'start':
                    left = triggerRect.left;
                    break;
                case 'center':
                    left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
                    break;
                case 'end':
                    left = triggerRect.right - tooltipRect.width;
                    break;
            }
        }

        // Keep tooltip within viewport
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (left < padding) left = padding;
        if (left + tooltipRect.width > viewportWidth - padding) {
            left = viewportWidth - tooltipRect.width - padding;
        }
        if (top < padding) top = padding;
        if (top + tooltipRect.height > viewportHeight - padding) {
            top = viewportHeight - tooltipRect.height - padding;
        }

        setPosition({ top, left });
    }, [side, align]);

    const handleMouseEnter = () => {
        timeoutRef.current = setTimeout(() => {
            setIsVisible(true);
        }, delayDuration);
    };

    const handleMouseLeave = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setIsVisible(false);
    };

    useEffect(() => {
        if (isVisible) {
            updatePosition();
            window.addEventListener('scroll', updatePosition, true);
            window.addEventListener('resize', updatePosition);
        }

        return () => {
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [isVisible, updatePosition]);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return (
        <>
            <div
                ref={triggerRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onFocus={handleMouseEnter}
                onBlur={handleMouseLeave}
                className="inline-block"
            >
                {children}
            </div>

            {isVisible && (
                <div
                    ref={tooltipRef}
                    role="tooltip"
                    className={cn(
                        'fixed z-[100] px-3 py-2 rounded-lg text-sm font-medium',
                        'tooltip-content text-text-main',
                        'pointer-events-none',
                        className
                    )}
                    style={{
                        top: position.top,
                        left: position.left,
                    }}
                >
                    {content}
                    {/* Arrow */}
                    <svg
                        className={cn(
                            'absolute w-3 h-2 tooltip-arrow',
                            side === 'top' && 'bottom-0 left-1/2 -translate-x-1/2 translate-y-full rotate-180',
                            side === 'bottom' && 'top-0 left-1/2 -translate-x-1/2 -translate-y-full',
                            side === 'left' && 'right-0 top-1/2 -translate-y-1/2 translate-x-full -rotate-90',
                            side === 'right' && 'left-0 top-1/2 -translate-y-1/2 -translate-x-full rotate-90'
                        )}
                        viewBox="0 0 12 8"
                    >
                        <path d="M6 0L12 8H0L6 0Z" />
                    </svg>
                </div>
            )}
        </>
    );
}

// Simple inline tooltip for quick usage
interface TooltipSimpleProps {
    text: string;
    children: ReactNode;
    className?: string;
}

export function TooltipSimple({ text, children, className }: TooltipSimpleProps) {
    return (
        <span
            className={cn('tooltip-hover relative', className)}
            data-tooltip={text}
        >
            {children}
        </span>
    );
}
