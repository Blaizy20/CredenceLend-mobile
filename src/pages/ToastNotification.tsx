// src/components/ToastNotification.tsx
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle2, XCircle, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ToastPayload {
  id:        number;
  title:     string;
  message:   string;
  type:      'approved' | 'denied' | 'payment' | 'general';
  loan_id?:  number | null;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TOAST_CONFIG: Record<string, {
  icon:   React.ReactNode;
  bar:    string;
  bg:     string;
  border: string;
  iconBg: string;
}> = {
  approved: {
    icon:   <CheckCircle2 size={18} className="text-green-500" />,
    bar:    'bg-green-500',
    bg:     'bg-surface-container-high',
    border: 'border-green-500/25',
    iconBg: 'bg-green-500/12',
  },
  denied: {
    icon:   <XCircle size={18} className="text-red-500" />,
    bar:    'bg-red-500',
    bg:     'bg-surface-container-high',
    border: 'border-red-500/25',
    iconBg: 'bg-red-500/12',
  },
  payment: {
    icon:   <CheckCircle2 size={18} className="text-primary" />,
    bar:    'bg-primary',
    bg:     'bg-surface-container-high',
    border: 'border-primary/25',
    iconBg: 'bg-primary/12',
  },
  general: {
    icon:   <Bell size={18} className="text-on-surface-variant" />,
    bar:    'bg-on-surface-variant',
    bg:     'bg-surface-container-high',
    border: 'border-outline/20',
    iconBg: 'bg-surface-container-highest',
  },
};

const getToastConfig = (type: string) =>
  TOAST_CONFIG[type?.toLowerCase()] ?? TOAST_CONFIG.general;

const getDestination = (toast: ToastPayload): string | null => {
  if (toast.loan_id) return `/loan/${toast.loan_id}`;
  if (toast.type === 'payment') return '/transactions';
  return '/inbox';
};

// ─── Duration ─────────────────────────────────────────────────────────────────
const DURATION_MS = 4500;

// ─── Single Toast ─────────────────────────────────────────────────────────────

function Toast({
  toast,
  onDismiss,
}: {
  toast:     ToastPayload;
  onDismiss: (id: number) => void;
}) {
  const navigate  = useNavigate();
  const cfg       = getToastConfig(toast.type);
  const dest      = getDestination(toast);

  // Controls the width of the drain bar (100 → 0)
  const [barWidth, setBarWidth] = useState(100);
  const [paused,   setPaused]   = useState(false);

  const startTimeRef   = useRef<number>(Date.now());
  const elapsedRef     = useRef<number>(0);
  const rafRef         = useRef<number | null>(null);

  // ── Drain animation via rAF so pausing works correctly ───────────────────
  useEffect(() => {
    const tick = () => {
      if (!paused) {
        const now     = Date.now();
        const elapsed = elapsedRef.current + (now - startTimeRef.current);
        const pct     = Math.max(0, 100 - (elapsed / DURATION_MS) * 100);
        setBarWidth(pct);
        if (pct <= 0) { onDismiss(toast.id); return; }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [paused]);

  // ── Pause on hover / press ────────────────────────────────────────────────
  const handlePauseStart = () => {
    elapsedRef.current += Date.now() - startTimeRef.current;
    setPaused(true);
  };
  const handlePauseEnd = () => {
    startTimeRef.current = Date.now();
    setPaused(false);
  };

  const handleTap = () => {
    onDismiss(toast.id);
    if (dest) navigate(dest);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -72, scale: 0.94 }}
      animate={{ opacity: 1, y: 0,   scale: 1     }}
      exit={{    opacity: 0, y: -24,  scale: 0.96, transition: { duration: 0.22 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className={cn(
        'w-full rounded-2xl border shadow-[0_8px_32px_rgba(0,0,0,0.14),0_2px_8px_rgba(0,0,0,0.08)]',
        'overflow-hidden cursor-pointer select-none',
        cfg.bg, cfg.border
      )}
      onMouseEnter={handlePauseStart}
      onMouseLeave={handlePauseEnd}
      onTouchStart={handlePauseStart}
      onTouchEnd={handlePauseEnd}
      onClick={handleTap}
    >
      {/* Content row */}
      <div className="flex items-center gap-3 px-4 pt-3.5 pb-3">

        {/* Icon */}
        <div className={cn(
          'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
          cfg.iconBg
        )}>
          {cfg.icon}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-on-surface leading-tight truncate">
            {toast.title}
          </p>
          <p className="text-xs text-on-surface-variant leading-snug mt-0.5 line-clamp-2">
            {toast.message}
          </p>
        </div>

        {/* Dismiss */}
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(toast.id); }}
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0
            bg-surface-container-highest hover:bg-outline/10
            active:scale-90 transition-all"
        >
          <X size={13} className="text-on-surface-variant" />
        </button>
      </div>

      {/* Drain bar */}
      <div className="h-[3px] bg-outline/10 w-full">
        <div
          className={cn('h-full rounded-full transition-none', cfg.bar)}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </motion.div>
  );
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface ToastContextValue {
  showToast: (payload: Omit<ToastPayload, 'id'>) => void;
}

const ToastContext = React.createContext<ToastContextValue>({ showToast: () => {} });

export const useToast = () => React.useContext(ToastContext);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastPayload[]>([]);
  const counterRef          = useRef(0);

  const showToast = (payload: Omit<ToastPayload, 'id'>) => {
    const id = ++counterRef.current;
    setToasts(prev => [{ ...payload, id }, ...prev].slice(0, 3)); // max 3 stacked
  };

  const dismiss = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast portal — fixed top, safe area aware */}
      <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none
        px-4 pt-[env(safe-area-inset-top,16px)] max-w-md mx-auto">
        <div className="mt-4 space-y-2.5 pointer-events-auto">
          <AnimatePresence mode="sync">
            {toasts.map(t => (
              <Toast key={t.id} toast={t} onDismiss={dismiss} />
            ))}
          </AnimatePresence>
        </div>
      </div>

    </ToastContext.Provider>
  );
}