'use client';

import Script from 'next/script';
import { useEffect } from 'react';

/**
 * Twemoji Script Provider
 * Loads the Twemoji library and automatically parses emojis throughout the page
 * This ensures consistent emoji rendering across all platforms (macOS, Windows, Linux)
 */
export default function TwemojiScript() {
    useEffect(() => {
        // Parse emojis on the entire document after the script loads
        const parseAllEmojis = () => {
            const win = window as typeof window & { twemoji?: { parse: (element: HTMLElement, options?: object) => void } };
            if (win.twemoji && document.body) {
                win.twemoji.parse(document.body, {
                    base: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/',
                    folder: 'svg',
                    ext: '.svg',
                });
            }
        };

        // Initial parse
        if (document.readyState === 'complete') {
            setTimeout(parseAllEmojis, 100);
        } else {
            window.addEventListener('load', parseAllEmojis);
        }

        // Set up a MutationObserver to parse new content
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const element = node as HTMLElement;
                        const win = window as typeof window & { twemoji?: { parse: (element: HTMLElement, options?: object) => void } };
                        if (win.twemoji) {
                            win.twemoji.parse(element, {
                                base: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/',
                                folder: 'svg',
                                ext: '.svg',
                            });
                        }
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        return () => {
            window.removeEventListener('load', parseAllEmojis);
            observer.disconnect();
        };
    }, []);

    return (
        <Script
            src="https://cdn.jsdelivr.net/npm/@twemoji/api@latest/dist/twemoji.min.js"
            strategy="afterInteractive"
            onLoad={() => {
                // Parse the entire document after script loads
                const win = window as typeof window & { twemoji?: { parse: (element: HTMLElement, options?: object) => void } };
                if (win.twemoji && document.body) {
                    win.twemoji.parse(document.body, {
                        base: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/',
                        folder: 'svg',
                        ext: '.svg',
                    });
                }
            }}
        />
    );
}
