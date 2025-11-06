import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'success' | 'warning';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap',
        {
          'bg-badge-blue text-white': variant === 'default',
          'bg-bg-dark text-text-muted border border-card-border': variant === 'secondary',
          'bg-danger text-white': variant === 'destructive',
          'bg-success text-white': variant === 'success',
          'bg-yellow-500 text-white': variant === 'warning',
        },
        className
      )}
      {...props}
    />
  );
}
