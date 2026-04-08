import React from 'react';
import { cn } from '@/src/lib/utils';

type InputProps = React.ComponentPropsWithoutRef<'input'> & {
  label?: string;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
  error?: string;
};

export function Input({ label, icon, rightElement, error, className, ...props }: InputProps) {
  return (
    <div className="space-y-2 w-full">
      {label && (
        <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-[1.5px] ml-1">
          {label}
        </label>
      )}
      <div className="relative group">
        {icon && (
          <div className={cn(
            "absolute left-4 top-1/2 -translate-y-1/2 transition-colors",
            error ? "text-error" : "text-outline/40 group-focus-within:text-primary"
          )}>
            {icon}
          </div>
        )}
        <input
          className={cn(
            "w-full bg-surface-container-highest border-0 focus:ring-2 text-on-surface rounded-xl py-4 placeholder:text-outline/40 text-sm transition-all outline-none",
            error ? "focus:ring-error/50 border border-error/50" : "focus:ring-primary/50",
            icon ? "pl-12" : "pl-4",
            rightElement ? "pr-12" : "pr-4",
            className
          )}
          {...props}
        />
        {rightElement && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            {rightElement}
          </div>
        )}
      </div>
      {error && (
        <p className="text-[10px] text-error font-bold ml-1 uppercase tracking-wider">{error}</p>
      )}
    </div>
  );
}
