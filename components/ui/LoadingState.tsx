'use client';

import { cn } from '@/lib/utils';

type LoadingStateProps = {
  title?: string;
  subtitle?: string;
  compact?: boolean;
  className?: string;
  variant?: 'default' | 'galaxy';
};

export function LoadingState({
  title = 'Loading',
  subtitle = 'Fetching the latest data...',
  compact = false,
  className = '',
  variant = 'default',
}: LoadingStateProps) {
  const stars = [
    { top: '10%', left: '20%', size: 2, delay: '0s' },
    { top: '18%', left: '68%', size: 2.5, delay: '0.6s' },
    { top: '32%', left: '42%', size: 1.5, delay: '1.1s' },
    { top: '55%', left: '25%', size: 2, delay: '1.6s' },
    { top: '62%', left: '60%', size: 1.6, delay: '0.9s' },
    { top: '74%', left: '78%', size: 2.2, delay: '1.4s' },
    { top: '28%', left: '82%', size: 1.8, delay: '1.9s' },
    { top: '46%', left: '12%', size: 1.4, delay: '0.3s' },
  ];

  const isGalaxy = variant === 'galaxy';

  return (
    <div
      className={cn(
        'relative overflow-hidden border border-card-border bg-card/80 backdrop-blur-sm text-center flex items-center justify-center',
        compact ? 'rounded-xl p-4' : 'rounded-2xl p-6 min-h-[260px]',
        className
      )}
    >
      {isGalaxy ? (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-[#050915] via-[#060a12] to-[#030711]" />
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 30%, rgba(13,140,232,0.15), transparent 35%), radial-gradient(circle at 80% 20%, rgba(122,60,255,0.16), transparent 30%), radial-gradient(circle at 60% 75%, rgba(0,217,255,0.12), transparent 35%)',
            }}
          />
          <div
            className="absolute inset-0 opacity-60 blur-3xl"
            style={{
              background: 'radial-gradient(circle, rgba(13, 140, 232, 0.18) 0%, transparent 55%)',
              transform: 'translate(-10%, -10%)',
            }}
          />
          <div className="absolute inset-0">
            {stars.map((star, idx) => (
              <span
                key={idx}
                className="absolute rounded-full bg-white/80"
                style={{
                  top: star.top,
                  left: star.left,
                  width: `${star.size}px`,
                  height: `${star.size}px`,
                  animation: `star-twinkle 2.4s ease-in-out infinite`,
                  animationDelay: star.delay,
                  opacity: 0.6,
                }}
              />
            ))}
          </div>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.35) 100%)',
            }}
          />
        </>
      ) : (
        <>
          <div
            className="absolute inset-0 bg-gradient-to-br from-accent-blue/10 via-accent-purple-1/10 to-accent-cyan/5 blur-3xl opacity-60"
            style={{ animation: 'gradient-shift 12s ease-in-out infinite' }}
          />
          <div
            className="absolute inset-0 pointer-events-none opacity-30"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 20%, rgba(13,140,232,0.12), transparent 35%), radial-gradient(circle at 80% 10%, rgba(122,60,255,0.12), transparent 30%), radial-gradient(circle at 50% 80%, rgba(0,217,255,0.08), transparent 35%)',
            }}
          />
        </>
      )}

      <div className="relative flex flex-col items-center gap-3">
        <div className="relative flex items-center justify-center">
          {isGalaxy ? (
            <div className="relative h-24 w-24">
              <div className="absolute inset-[2px] rounded-full border border-accent-blue/15 blur-sm" />
              <div
                className="absolute inset-0.5 rounded-full border border-accent-purple-1/25 animate-spin-slow"
                style={{ animationDuration: '14s' }}
              >
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-base">🚀</div>
                <div className="absolute top-1/2 -right-2 -translate-y-1/2 text-base">🛰️</div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-base">🚀</div>
                <div className="absolute top-1/2 -left-2 -translate-y-1/2 text-base">🛰️</div>
              </div>
              <div
                className="absolute inset-4 rounded-full border border-accent-cyan/30 animate-spin-slow"
                style={{ animationDuration: '9s' }}
              />
              <div className="absolute inset-6 rounded-full bg-gradient-to-br from-accent-blue/40 via-accent-purple-1/30 to-accent-cyan/30 blur-md animate-pulse" />
              <div className="absolute inset-[24px] rounded-full bg-bg-dark flex items-center justify-center">
                <div
                  className="text-3xl drop-shadow-[0_0_14px_rgba(13,140,232,0.6)] animate-spin-slow"
                  style={{ animationDuration: '18s' }}
                >
                  🪐
                </div>
              </div>
            </div>
          ) : (
            <>
              <div
                className="h-16 w-16 rounded-full bg-gradient-to-tr from-accent-blue to-accent-purple-1 p-[3px]"
                style={{ animation: 'spin-slow 6s linear infinite' }}
              >
                <div className="h-full w-full rounded-full bg-bg-dark flex items-center justify-center">
                  <div className="loading-spinner" />
                </div>
              </div>
              <div className="absolute -inset-3 rounded-full bg-accent-blue/15 blur-xl" />
            </>
          )}
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

