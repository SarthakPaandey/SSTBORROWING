import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glow' | 'gradient-border' | 'interactive';
  hoverEffect?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', hoverEffect = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'card-glass text-card-foreground',
        'transition-all duration-400 ease-out',
        // Variant styles
        {
          // Default - subtle hover
          '': variant === 'default',
          // Glow - blue glow on hover
          'hover:shadow-card-glow hover:border-accent-blue/30': variant === 'glow',
          // Gradient border - animated border
          'card-animated-border': variant === 'gradient-border',
          // Interactive - scale and lift
          'cursor-pointer hover:scale-[1.02] hover:-translate-y-1 hover:shadow-card-glow active:scale-[0.99]': variant === 'interactive',
        },
        // Optional hover effect
        hoverEffect && 'card-scale-hover cursor-pointer',
        className
      )}
      {...props}
    />
  )
);
Card.displayName = 'Card';

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col space-y-1.5 p-6', className)}
      {...props}
    />
  )
);
CardHeader.displayName = 'CardHeader';

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  emoji?: string;
  gradient?: boolean;
}

const CardTitle = forwardRef<HTMLParagraphElement, CardTitleProps>(
  ({ className, emoji, gradient = false, children, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        'text-2xl font-bold leading-none tracking-tight',
        gradient ? 'text-gradient' : 'text-text-main',
        className
      )}
      {...props}
    >
      {emoji && <span className="mr-2 inline-block animate-bounce-subtle">{emoji}</span>}
      {children}
    </h3>
  )
);
CardTitle.displayName = 'CardTitle';

const CardDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-text-muted', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  )
);
CardContent.displayName = 'CardContent';

const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center p-6 pt-0', className)}
      {...props}
    />
  )
);
CardFooter.displayName = 'CardFooter';

// New: Stat Card for dashboards
interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  emoji?: string;
  value: string | number;
  label: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

const StatCard = forwardRef<HTMLDivElement, StatCardProps>(
  ({ className, icon, emoji, value, label, trend, trendValue, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'card-glass p-6 group hover:shadow-card-glow transition-all duration-400',
        'hover:border-accent-blue/30 hover:-translate-y-1',
        className
      )}
      {...props}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-text-muted">{label}</p>
          <p className="text-3xl font-bold text-text-main group-hover:text-accent-blue transition-colors">
            {value}
          </p>
          {trend && trendValue && (
            <p className={cn(
              'text-xs font-medium flex items-center gap-1',
              trend === 'up' && 'text-success',
              trend === 'down' && 'text-danger',
              trend === 'neutral' && 'text-text-muted'
            )}>
              {trend === 'up' && '↑'}
              {trend === 'down' && '↓'}
              {trendValue}
            </p>
          )}
        </div>
        <div className="p-3 rounded-xl bg-accent-blue/10 group-hover:bg-accent-blue/20 transition-colors">
          {emoji ? (
            <span className="text-2xl group-hover:animate-wiggle">{emoji}</span>
          ) : (
            <div className="text-accent-blue group-hover:scale-110 transition-transform">
              {icon}
            </div>
          )}
        </div>
      </div>
    </div>
  )
);
StatCard.displayName = 'StatCard';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, StatCard };
