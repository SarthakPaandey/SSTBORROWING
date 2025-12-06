'use client';

import { Toaster as SonnerToaster } from 'sonner';

/**
 * Themed Toaster component matching the glass/aurora aesthetic
 * Usage: import { toast } from 'sonner' and call toast.success(), toast.error(), etc.
 */
export function Toaster() {
    return (
        <SonnerToaster
            position="top-right"
            expand={true}
            richColors
            closeButton
            toastOptions={{
                style: {
                    background: 'rgba(10, 15, 26, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    backdropFilter: 'blur(12px)',
                    color: '#E6EAF0',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 20px rgba(13, 140, 232, 0.1)',
                    borderRadius: '12px',
                    fontSize: '14px',
                },
                classNames: {
                    toast: 'toast-glass',
                    title: 'toast-title',
                    description: 'toast-description',
                    actionButton: 'toast-action',
                    cancelButton: 'toast-cancel',
                    closeButton: 'toast-close',
                    success: 'toast-success',
                    error: 'toast-error',
                    warning: 'toast-warning',
                    info: 'toast-info',
                },
            }}
        />
    );
}

// Re-export toast for easy importing
export { toast } from 'sonner';
