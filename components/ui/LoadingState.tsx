'use client';

import { cn } from '@/lib/utils';

type LoadingStateProps = {
  title?: string;
  subtitle?: string;
  compact?: boolean;
  className?: string;
};

export function LoadingState({
  title = 'Loading',
  subtitle = 'Fetching the latest data...',
  compact = false,
  className = '',
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden border border-card-border bg-card/80 backdrop-blur-sm text-center flex items-center justify-center',
        compact ? 'rounded-xl p-4' : 'rounded-2xl p-6 min-h-[260px]',
        className
      )}
    >
      <div
        className="absolute inset-0 bg-gradient-to-br from-accent-blue/10 via-accent-purple-1/10 to-accent-cyan/5 blur-3xl opacity-60"
        style={{ animation: 'gradient-shift 12s ease-in-out infinite' }}
      />
      <div className="absolute inset-0 pointer-events-none opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(13,140,232,0.12), transparent 35%), radial-gradient(circle at 80% 10%, rgba(122,60,255,0.12), transparent 30%), radial-gradient(circle at 50% 80%, rgba(0,217,255,0.08), transparent 35%)' }} />

      <div className="relative flex flex-col items-center gap-3">
        <div className="relative flex items-center justify-center">
          <div
            className="h-16 w-16 rounded-full bg-gradient-to-tr from-accent-blue to-accent-purple-1 p-[3px]"
            style={{ animation: 'spin-slow 6s linear infinite' }}
          >
            <div className="h-full w-full rounded-full bg-bg-dark flex items-center justify-center">
              <div className="loading-spinner" />
            </div>
          </div>
          <div className="absolute -inset-3 rounded-full bg-accent-blue/15 blur-xl" />
        </div>

        <div className="space-y-1">
          <p className="text-lg font-semibold text-text-main">{title}</p>
          {subtitle && (
            <p className="text-sm text-text-muted max-w-[360px] mx-auto leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        <p className="text-xs text-text-muted/70">Hang tight — this usually takes just a moment.</p>
      </div>
    </div>
  );
}

export function InlineLoading({ text = 'Loading...' }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-text-muted">
      <span className="loading-spinner" />
      <span className="text-sm">{text}</span>
    </span>
  );
}

