import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'info' | 'premium';
  pulse?: boolean;
  glow?: boolean;
  icon?: string;
}

export function Badge({ 
  className, 
  variant = 'default', 
  pulse = false,
  glow = false,
  icon,
  children,
  ...props 
}: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
        'transition-all duration-300 whitespace-nowrap',
        'animate-fade-in',
        // Variant styles with gradients
        {
          // Default - Blue
          'bg-gradient-to-r from-badge-blue to-accent-blue text-white shadow-sm shadow-badge-blue/30': 
            variant === 'default',
          // Secondary - Subtle
          'bg-bg-dark text-text-muted border border-card-border hover:border-accent-blue/30': 
            variant === 'secondary',
          // Destructive - Red
          'bg-gradient-to-r from-danger to-red-400 text-white shadow-sm shadow-danger/30': 
            variant === 'destructive',
          // Success - Green
          'bg-gradient-to-r from-success to-emerald-400 text-white shadow-sm shadow-success/30': 
            variant === 'success',
          // Warning - Yellow/Orange
          'bg-gradient-to-r from-warning to-amber-400 text-white shadow-sm shadow-warning/30': 
            variant === 'warning',
          // Info - Cyan
          'bg-gradient-to-r from-accent-cyan to-accent-teal text-white shadow-sm shadow-accent-cyan/30':
            variant === 'info',
          // Premium - Purple gradient with shimmer
          'bg-gradient-to-r from-accent-purple-1 via-accent-purple-2 to-accent-pink text-white shadow-sm shadow-accent-purple-1/30 animate-shimmer bg-[length:200%_100%]':
            variant === 'premium',
        },
        // Pulse effect
        pulse && 'badge-pulse',
        // Glow effect
        glow && {
          'shadow-glow-blue': variant === 'default' || variant === 'info',
          'shadow-glow-danger': variant === 'destructive',
          'shadow-glow-success': variant === 'success',
          'shadow-glow-purple': variant === 'premium',
        },
        className
      )}
      {...props}
    >
      {icon && (
        <span className="text-sm leading-none opacity-90" aria-hidden>
          {icon}
        </span>
      )}
      {children}
    </div>
  );
}

// Status Badge with built-in icons/emojis
interface StatusBadgeProps extends Omit<BadgeProps, 'variant'> {
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed' | 'checked_in' | 'no_show' | 'late' | 'approved' | 'rejected';
}

export function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  const statusConfig = {
    confirmed: { variant: 'success' as const, icon: '✅', label: 'Confirmed' },
    pending: { variant: 'warning' as const, icon: '⏳', label: 'Pending' },
    cancelled: { variant: 'destructive' as const, icon: '❌', label: 'Cancelled' },
    completed: { variant: 'secondary' as const, icon: '✔️', label: 'Completed' },
    checked_in: { variant: 'info' as const, icon: '📍', label: 'Checked In' },
    no_show: { variant: 'destructive' as const, icon: '👻', label: 'No Show' },
    late: { variant: 'destructive' as const, icon: '⚠️', label: 'Late' },
    approved: { variant: 'success' as const, icon: '👍', label: 'Approved' },
    rejected: { variant: 'destructive' as const, icon: '👎', label: 'Rejected' },
  };

  const config = statusConfig[status];

  return (
    <Badge 
      variant={config.variant} 
      icon={config.icon}
      className={className}
      {...props}
    >
      {config.label}
    </Badge>
  );
}
