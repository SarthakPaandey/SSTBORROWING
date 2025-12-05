import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'gradient' | 'success';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', loading = false, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(
          // Base styles with enhanced transitions
          'inline-flex items-center justify-center rounded-lg font-semibold',
          'transition-all duration-300 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          'active:scale-[0.98]',
          'relative overflow-hidden',
          // Variant styles
          {
            // Default - Blue with glow
            'bg-accent-blue text-white shadow-lg shadow-accent-blue/30 hover:shadow-glow-blue hover:shadow-accent-blue/50 hover:-translate-y-0.5 hover:brightness-110':
              variant === 'default',
            // Destructive - Red with shake on hover
            'bg-danger text-white shadow-lg shadow-danger/30 hover:shadow-glow-danger hover:shadow-danger/50 hover:-translate-y-0.5 hover:brightness-110':
              variant === 'destructive',
            // Success - Green with glow
            'bg-success text-white shadow-lg shadow-success/30 hover:shadow-glow-success hover:shadow-success/50 hover:-translate-y-0.5 hover:brightness-110':
              variant === 'success',
            // Outline - Subtle border animation
            'border border-card-border bg-bg-dark hover:bg-bg-surface-overlay hover:border-accent-blue/50 hover:shadow-[0_0_20px_rgba(13,140,232,0.15)]':
              variant === 'outline',
            // Secondary - Subtle background
            'bg-bg-dark text-text-main hover:bg-bg-surface-overlay hover:text-accent-blue':
              variant === 'secondary',
            // Ghost - Minimal
            'hover:bg-bg-surface-overlay hover:text-text-main': 
              variant === 'ghost',
            // Gradient - Purple with shimmer effect
            'bg-gradient-purple text-white shadow-glow-purple hover:shadow-glow-purple-lg hover:-translate-y-1 hover:scale-[1.02] btn-shiny':
              variant === 'gradient',
          },
          // Size styles
          {
            'h-10 px-4 py-2 gap-2': size === 'default',
            'h-9 rounded-lg px-3 text-sm gap-1.5': size === 'sm',
            'h-12 rounded-2xl px-8 text-base gap-2': size === 'lg',
            'h-10 w-10 p-0': size === 'icon',
          },
          variant === 'gradient' && 'rounded-full',
          loading && 'cursor-wait',
          className
        )}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {/* Loading spinner */}
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center bg-inherit">
            <svg 
              className="animate-spin h-5 w-5" 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24"
            >
              <circle 
                className="opacity-25" 
                cx="12" 
                cy="12" 
                r="10" 
                stroke="currentColor" 
                strokeWidth="4"
              />
              <path 
                className="opacity-75" 
                fill="currentColor" 
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </span>
        )}
        {/* Content with opacity when loading */}
        <span className={cn('inline-flex items-center gap-2', loading && 'opacity-0')}>
          {children}
        </span>
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
