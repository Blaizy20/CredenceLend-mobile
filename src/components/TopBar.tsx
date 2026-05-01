import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface TopBarProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  rightElement?: React.ReactNode;
  className?: string;
}

export function TopBar({ title, showBack = true, onBack, rightElement, className }: TopBarProps) {
  const navigate = useNavigate();

  return (
    <nav className={cn(
      "fixed top-0 w-full z-50 flex items-center px-6 h-16 bg-background/60 backdrop-blur-xl border-b border-outline-variant/10",
      className
    )}>
      <div className="flex items-center gap-4 w-full">
        {showBack && (
          <button 
            onClick={() => onBack ? onBack() : navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors active:scale-95 text-primary"
          >
            <ChevronLeft size={24} />
          </button>
        )}
        <h1 className="font-headline font-bold text-lg tracking-tight text-primary flex-grow">
          {title}
        </h1>
        {rightElement}
      </div>
    </nav>
  );
}
