'use client';

import { ReactNode, useEffect, useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  titleEmoji?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

export function Modal({ 
  isOpen, 
  onClose, 
  title, 
  titleEmoji,
  children, 
  size = 'md',
  variant = 'default'
}: ModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Trigger animation after mount
      requestAnimationFrame(() => {
        setIsVisible(true);
        setIsAnimating(true);
      });
    } else {
      setIsVisible(false);
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
      setIsAnimating(false);
    }, 200);
  };

  if (!isOpen && !isAnimating) return null;

  const variantStyles = {
    default: 'border-card-border',
    success: 'border-success/30 shadow-[0_0_30px_rgba(39,196,106,0.15)]',
    warning: 'border-warning/30 shadow-[0_0_30px_rgba(245,158,11,0.15)]',
    danger: 'border-danger/30 shadow-[0_0_30px_rgba(255,107,107,0.15)]',
  };

  const titleColors = {
    default: 'text-foreground',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-300',
          isVisible ? 'opacity-100' : 'opacity-0'
        )}
        onClick={handleClose}
      />
      
      {/* Modal container */}
      <div
        className={cn(
          'relative z-50 w-full rounded-2xl bg-bg-dark border shadow-2xl max-h-[90vh] flex flex-col',
          'transition-all duration-300 ease-out',
          isVisible 
            ? 'opacity-100 scale-100 translate-y-0' 
            : 'opacity-0 scale-95 translate-y-4',
          variantStyles[variant],
          {
            'max-w-sm': size === 'sm',
            'max-w-md': size === 'md',
            'max-w-2xl': size === 'lg',
            'max-w-4xl': size === 'xl',
            'max-w-[95vw] max-h-[95vh]': size === 'full',
          }
        )}
      >
        {/* Animated gradient border effect */}
        <div className="absolute -inset-[1px] bg-gradient-to-r from-accent-blue/20 via-accent-purple-1/20 to-accent-blue/20 rounded-2xl opacity-50 blur-sm -z-10 animate-gradient-shift" style={{ backgroundSize: '200% 200%' }} />
        
        {/* Header */}
        {title && (
          <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-card-border/50">
            <h2 className={cn(
              'text-xl font-bold flex items-center gap-2',
              titleColors[variant]
            )}>
              {titleEmoji && (
                <span className="text-2xl animate-bounce-subtle">{titleEmoji}</span>
              )}
              {title}
            </h2>
            <button
              onClick={handleClose}
              className="text-muted-foreground hover:text-foreground transition-all duration-200 rounded-lg hover:bg-secondary/50 p-2 hover:rotate-90 group"
            >
              <X className="h-5 w-5 transition-transform group-hover:scale-110" />
            </button>
          </div>
        )}
        
        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
}

// Confirmation Modal for common actions
interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'default';
  loading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  loading = false,
}: ConfirmModalProps) {
  const variantConfig = {
    danger: { emoji: '⚠️', buttonClass: 'bg-danger hover:bg-danger/90' },
    warning: { emoji: '⚡', buttonClass: 'bg-warning hover:bg-warning/90' },
    default: { emoji: '❓', buttonClass: 'bg-accent-blue hover:bg-accent-blue/90' },
  };

  const config = variantConfig[variant];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} titleEmoji={config.emoji} size="sm" variant={variant}>
      <div className="space-y-6">
        <p className="text-text-muted">{message}</p>
        
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl border border-card-border bg-bg-dark text-text-main hover:bg-secondary/50 transition-all duration-200 font-medium disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'flex-1 px-4 py-2.5 rounded-xl text-white font-medium transition-all duration-200 disabled:opacity-50',
              config.buttonClass
            )}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </span>
            ) : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
