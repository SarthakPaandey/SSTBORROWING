'use client';

import { useEffect, useRef, memo } from 'react';

interface EmojiProps {
    /** The emoji character(s) to display */
    symbol: string;
    /** Optional className for additional styling */
    className?: string;
    /** Size variant for the emoji */
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
}

// Size mapping for consistent emoji sizes
const sizeClasses: Record<string, string> = {
    xs: 'emoji-xs',
    sm: 'emoji-sm',
    md: 'emoji-md',
    lg: 'emoji-lg',
    xl: 'emoji-xl',
    '2xl': 'emoji-2xl',
    '3xl': 'emoji-3xl',
};

/**
 * Cross-platform Emoji component using Twemoji
 * Renders emojis consistently across macOS, Windows, and Linux
 */
const Emoji = memo(function Emoji({ symbol, className = '', size = 'md' }: EmojiProps) {
    const containerRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // Check if twemoji is available
        const win = window as typeof window & { twemoji?: { parse: (element: HTMLElement, options?: object) => void } };
        if (win.twemoji) {
            win.twemoji.parse(container, {
                base: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/',
                folder: 'svg',
                ext: '.svg',
            });
        }
    }, [symbol]);

    return (
        <span
            ref={containerRef}
            className={`emoji-container ${sizeClasses[size]} ${className}`}
            aria-hidden="true"
        >
            {symbol}
        </span>
    );
});

export default Emoji;

/**
 * Hook to parse all emojis in a container element
 * Useful for parsing emojis in dynamic content
 */
export function useTwemojiParse(elementRef: React.RefObject<HTMLElement | null>, deps: unknown[] = []) {
    useEffect(() => {
        const element = elementRef.current;
        if (!element) return;

        const win = window as typeof window & { twemoji?: { parse: (element: HTMLElement, options?: object) => void } };
        if (win.twemoji) {
            win.twemoji.parse(element, {
                base: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/',
                folder: 'svg',
                ext: '.svg',
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [elementRef, ...deps]);
}

/**
 * Utility to parse emojis in a DOM element imperatively
 * For use outside React components
 */
export function parseEmojis(element: HTMLElement | null) {
    if (!element) return;

    const win = window as typeof window & { twemoji?: { parse: (element: HTMLElement, options?: object) => void } };
    if (win.twemoji) {
        win.twemoji.parse(element, {
            base: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/',
            folder: 'svg',
            ext: '.svg',
        });
    }
}
