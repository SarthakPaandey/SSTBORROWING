import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'success' | 'warning';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors border',
        {
          'bg-primary/10 text-primary border-primary/20': variant === 'default',
          'bg-secondary text-secondary-foreground border-border/50': variant === 'secondary',
          'bg-destructive/10 text-destructive border-destructive/20': variant === 'destructive',
          'bg-green-500/10 text-green-400 border-green-500/20': variant === 'success',
          'bg-yellow-500/10 text-yellow-400 border-yellow-500/20': variant === 'warning',
        },
        className
      )}
      {...props}
    />
  );
}
