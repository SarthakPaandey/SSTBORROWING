import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'gradient';
  size?: 'default' | 'sm' | 'lg';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
          {
            'bg-accent-blue text-white hover:opacity-90 shadow-lg shadow-accent-blue/30':
              variant === 'default',
            'bg-danger text-white hover:opacity-90 shadow-lg shadow-danger/30':
              variant === 'destructive',
            'border border-card-border bg-bg-dark hover:bg-bg-surface-overlay hover:border-accent-blue/30':
              variant === 'outline',
            'bg-bg-dark text-text-main hover:bg-bg-surface-overlay':
              variant === 'secondary',
            'hover:bg-bg-surface-overlay hover:text-text-main': variant === 'ghost',
            'bg-gradient-purple text-white shadow-glow-purple hover:shadow-glow-purple-lg hover:-translate-y-0.5':
              variant === 'gradient',
          },
          {
            'h-10 px-4 py-2': size === 'default',
            'h-9 rounded-lg px-3 text-sm': size === 'sm',
            'h-11 rounded-2xl px-8 text-base': size === 'lg',
          },
          variant === 'gradient' && 'rounded-full',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button };
