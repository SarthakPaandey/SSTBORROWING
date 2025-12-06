'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

const TabsContext = React.createContext<{
  value: string;
  onValueChange: (value: string) => void;
  variant: 'default' | 'pills' | 'underline';
}>({ value: '', onValueChange: () => {}, variant: 'default' });

interface TabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'pills' | 'underline';
}

export function Tabs({
  defaultValue,
  value: controlledValue,
  onValueChange: controlledOnValueChange,
  children,
  className,
  variant = 'default',
}: TabsProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue || '');

  const value = controlledValue !== undefined ? controlledValue : internalValue;
  const onValueChange = controlledOnValueChange || setInternalValue;

  return (
    <TabsContext.Provider value={{ value, onValueChange, variant }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { variant } = React.useContext(TabsContext);

  return (
    <div
      className={cn(
        'flex items-center gap-1 w-full sm:w-auto',
        'justify-start sm:justify-center',
        'overflow-x-auto sm:overflow-visible',
        // Variant styles - cleaner, more minimal
        variant === 'default' && 'min-h-[2.75rem] rounded-xl bg-bg-dark/80 border border-card-border/50 p-1 flex-wrap',
        variant === 'pills' && 'min-h-[2.75rem] rounded-xl bg-bg-dark/50 border border-card-border/50 p-1 flex-wrap',
        variant === 'underline' && 'border-b border-card-border pb-1 flex-nowrap',
        className
      )}
    >
      {children}
    </div>
  );
}

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

export function TabsTrigger({
  value,
  children,
  className,
  icon,
  badge,
}: TabsTriggerProps) {
  const { value: selectedValue, onValueChange, variant } = React.useContext(TabsContext);
  const isSelected = selectedValue === value;

  return (
    <button
      onClick={() => onValueChange(value)}
      className={cn(
        'relative inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium',
        'transition-all duration-200 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue/50',
        'disabled:pointer-events-none disabled:opacity-50',
        
        // Default variant - clean and professional
        variant === 'default' && [
          'rounded-lg px-4 py-2',
          isSelected
            ? 'bg-accent-blue text-white shadow-sm'
            : 'text-text-muted hover:text-text-main hover:bg-white/5',
        ],
        
        // Pills variant
        variant === 'pills' && [
          'rounded-lg px-4 py-2',
          isSelected
            ? 'bg-accent-blue text-white shadow-sm'
            : 'text-text-muted hover:text-text-main hover:bg-white/5',
        ],
        
        // Underline variant
        variant === 'underline' && [
          'px-4 py-2 border-b-2 -mb-[3px]',
          isSelected
            ? 'border-accent-blue text-accent-blue'
            : 'border-transparent text-text-muted hover:text-text-main hover:border-text-muted/30',
        ],
        
        className
      )}
    >
      {/* Icon */}
      {icon && (
        <span className={cn(
          'transition-colors duration-200',
          isSelected ? 'text-white' : 'text-text-muted'
        )}>
          {icon}
        </span>
      )}
      
      {/* Label */}
      <span>{children}</span>
      
      {/* Badge */}
      {badge !== undefined && (
        <span className={cn(
          'ml-1 px-1.5 py-0.5 rounded text-xs font-medium',
          isSelected 
            ? 'bg-white/20 text-white' 
            : 'bg-text-muted/20 text-text-muted'
        )}>
          {badge}
        </span>
      )}
    </button>
  );
}

export function TabsContent({
  value,
  children,
  className,
  forceMount = false,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
  forceMount?: boolean;
}) {
  const { value: selectedValue } = React.useContext(TabsContext);
  const isSelected = selectedValue === value;

  if (!isSelected && !forceMount) return null;

  return (
    <div
      className={cn(
        'mt-4 ring-offset-background',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'animate-fade-in-up',
        !isSelected && forceMount && 'hidden',
        className
      )}
      data-state={isSelected ? 'active' : 'inactive'}
    >
      {children}
    </div>
  );
}
