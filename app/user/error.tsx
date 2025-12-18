'use client';

import { useEffect } from 'react';
import { AlertCircle, ArrowLeft, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { AccessRestricted } from '@/components/ui/AccessRestricted';

export default function UserError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('User Layout Error:', error);
  }, [error]);

  // Check if it's an AuthorizationError (blocked/suspended)
  const isAuthError = error.message.includes('blocked') || error.message.includes('suspended');

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {isAuthError ? (
          <AccessRestricted message={error.message} />
        ) : (
          <div className="rounded-2xl border border-card-border bg-card/50 p-8 text-center space-y-6 backdrop-blur-sm">
            <div className="mx-auto w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-danger" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-text-main">Something went wrong</h2>
              <p className="text-text-muted">
                We encountered an unexpected error while loading this page.
              </p>
              {process.env.NODE_ENV === 'development' && (
                <div className="mt-4 p-3 rounded-lg bg-bg-dark border border-card-border text-left">
                  <p className="text-xs font-mono text-danger break-all">{error.message}</p>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button onClick={() => reset()} variant="gradient" className="gap-2">
                <RefreshCcw className="h-4 w-4" />
                Try Again
              </Button>
              <Button onClick={() => window.location.href = '/user/dashboard'} variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

