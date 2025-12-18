import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from './Button';

interface AccessRestrictedProps {
  message: string;
  className?: string;
}

export const AccessRestricted: React.FC<AccessRestrictedProps> = ({ message, className = '' }) => {
  return (
    <div className={`rounded-xl bg-danger/10 border border-danger/30 p-6 text-sm text-danger flex items-start gap-4 animate-fade-in ${className}`}>
      <div className="p-3 rounded-full bg-danger/20 flex-shrink-0">
        <AlertCircle className="h-6 w-6 text-danger" />
      </div>
      <div className="flex-1">
        <h3 className="text-lg font-bold text-danger mb-1">Access Restricted</h3>
        <p className="text-text-main text-base leading-relaxed opacity-90">{message}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.href = '/user/penalties'}
            className="text-danger border-danger/30 hover:bg-danger/10 bg-transparent font-semibold"
          >
            View My Penalties
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.href = '/user/dashboard'}
            className="text-text-muted hover:text-text-main hover:bg-white/5"
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};

