import React from 'react';
import { AlertTriangle, RefreshCcw, ArrowLeft } from 'lucide-react';
import { Button } from './Button';

interface ErrorDisplayProps {
    message: string;
    className?: string;
    onRetry?: () => void;
    backHref?: string;
    backLabel?: string;
}

/**
 * Generic error display component for non-account-restriction errors
 * (e.g., 404 not found, network errors, unexpected failures)
 * 
 * For account-level restrictions (blocked/suspended), use AccessRestricted instead.
 */
export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
    message,
    className = '',
    onRetry,
    backHref,
    backLabel = 'Go Back',
}) => {
    return (
        <div className={`rounded-xl bg-warning/10 border border-warning/30 p-6 text-sm flex items-start gap-4 animate-fade-in ${className}`}>
            <div className="p-3 rounded-full bg-warning/20 flex-shrink-0">
                <AlertTriangle className="h-6 w-6 text-warning" />
            </div>
            <div className="flex-1">
                <h3 className="text-lg font-bold text-warning mb-1">Something Went Wrong</h3>
                <p className="text-text-main text-base leading-relaxed opacity-90">{message}</p>
                <div className="mt-5 flex flex-wrap gap-3">
                    {onRetry && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onRetry}
                            className="text-warning border-warning/30 hover:bg-warning/10 bg-transparent font-semibold"
                        >
                            <RefreshCcw className="h-4 w-4 mr-2" />
                            Try Again
                        </Button>
                    )}
                    {backHref && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.location.href = backHref}
                            className="text-text-muted hover:text-text-main hover:bg-white/5"
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            {backLabel}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};
