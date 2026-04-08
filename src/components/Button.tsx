import React from 'react';
import { cn } from '@/src/lib/utils';

type ButtonProps = React.ComponentPropsWithoutRef<'button'> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  fullWidth?: boolean;
};

export function Button({ 
  variant = 'primary', 
  fullWidth = true, 
  className, 
  children, 
  ...props 
}: ButtonProps) {
  const variants = {
    primary: "bg-gradient-to-r from-primary to-primary-dim text-on-primary shadow-lg shadow-primary/20 hover:shadow-primary/40",
    secondary: "bg-secondary-container text-on-secondary-container",
    outline: "border border-outline-variant/30 text-on-surface hover:bg-white/5",
    ghost: "text-primary hover:bg-primary/10"
  };

  return (
    <button
      className={cn(
        "h-14 px-6 rounded-full font-headline font-bold text-base transition-all active:scale-[0.98] flex items-center justify-center gap-2",
        fullWidth && "w-full",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
