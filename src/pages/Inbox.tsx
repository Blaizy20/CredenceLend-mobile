import { API_BASE } from '../lib/api';
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { BottomNav } from '../components/BottomNav';
import {
  Inbox as InboxIcon, Bell, CheckCircle2, XCircle,
  Clock, AlertCircle, RefreshCw, Trash2,
  CheckCheck, ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Notification {
  notification_id: number;
  title:           string;
  message:         string;
  type:            string;
  is_read:         number | boolean;
  loan_id:         number | null;
  created_at:      string;
}

type FilterTab = 'unread' | 'loans' | 'payments' | 'all';

// ─── Constants ────────────────────────────────────────────────────────────────

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'unread',   label: 'Unread'   },
  { key: 'loans',    label: 'Loans'    },
  { key: 'payments', label: 'Payments' },
  { key: 'all',      label: 'All'      },
];

const LOAN_TYPES    = new Set(['approved', 'denied', 'general']);
const PAYMENT_TYPES = new Set(['payment']);

const NOTIF_CONFIG: Record<string, {
  icon:   (size: number) => JSX.Element;
  bg:     string;
  border: string;
  iconBg: string;
}> = {
  approved: {
    icon:   (s) => <CheckCircle2 className="text-green-500"  size={s} />,
    bg:     'bg-green-500/8',
    border: 'border-green-500/15',
    iconBg: 'bg-green-500/12',
  },
  denied: {
    icon:   (s) => <XCircle className="text-red-500"         size={s} />,
    bg:     'bg-red-500/8',
    border: 'border-red-500/15',
    iconBg: 'bg-red-500/12',
  },
  payment: {
    icon:   (s) => <CheckCircle2 className="text-primary"    size={s} />,
    bg:     'bg-primary/8',
    border: 'border-primary/15',
    iconBg: 'bg-primary/12',
  },
  general: {
    icon:   (s) => <Bell className="text-on-surface-variant" size={s} />,
    bg:     'bg-surface-container-high',
    border: 'border-outline-variant/10',
    iconBg: 'bg-surface-container-highest',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getConfig = (type: string) =>
  NOTIF_CONFIG[type?.toLowerCase()] ?? NOTIF_CONFIG.general;

const getDestination = (notif: Notification): string | null => {
  if (notif.loan_id) return `/loan/${notif.loan_id}`;
  if (notif.type?.toLowerCase() === 'payment') return '/transactions';
  return null;
};

const getTapLabel = (notif: Notification): string => {
  const t = notif.type?.toLowerCase();
  if (t === 'approved') return 'View payment schedule';
  if (t === 'denied')   return 'View loan details';
  if (t === 'payment')  return notif.loan_id ? 'View loan' : 'View transactions';
  return 'View loan';
};

const parseMessage = (notif: Notification): { main: string; reason: string | null } => {
  const isDenied = notif.type?.toLowerCase() === 'denied';
  if (isDenied && notif.message.includes('Reason:')) {
    const [main, ...rest] = notif.message.split('Reason:');
    const reason = rest.join('Reason:').trim();
    return { main: main.trim(), reason: reason || null };
  }
  return { main: notif.message, reason: null };
};

const formatTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now  = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60)     return 'Just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function InboxSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-32">
      <TopBar title="Inbox" showBack={false} />
      <main className="pt-24 px-4 max-w-md mx-auto">

        {/* Header row */}
        <div className="flex items-center justify-between mb-4 px-1 animate-pulse">
          <div className="h-3 w-32 bg-surface-container-highest rounded-full" />
          <div className="h-3 w-24 bg-surface-container-highest rounded-full" />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-5 animate-pulse">
          {[72, 60, 80, 48].map((w, i) => (
            <div key={i} className="h-8 rounded-full bg-surface-container-highest shrink-0" style={{ width: w }} />
          ))}
        </div>

        {/* Notification cards */}
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i}
              className="rounded-2xl border border-outline-variant/10 bg-surface-container-high p-4 flex items-start gap-4 animate-pulse">
              {/* Icon placeholder */}
              <div className="w-10 h-10 rounded-xl bg-surface-container-highest shrink-0" />
              {/* Text lines */}
              <div className="flex-1 space-y-2.5 pr-8">
                <div className="flex justify-between items-start gap-2">
                  <div className="h-3.5 bg-surface-container-highest rounded-full"
                    style={{ width: `${55 + (i % 3) * 15}%` }} />
                  <div className="h-2.5 w-10 bg-surface-container-highest rounded-full shrink-0" />
                </div>
                <div className="h-2.5 bg-surface-container-highest rounded-full w-full" />
                <div className="h-2.5 bg-surface-container-highest rounded-full"
                  style={{ width: `${60 + (i % 2) * 20}%` }} />
                {/* Tap hint */}
                <div className="h-2.5 w-28 bg-surface-container-highest rounded-full mt-1" />
              </div>
            </div>
          ))}
        </div>

      </main>
      <BottomNav />
    </div>
  );
}

// ─── Notification Card ────────────────────────────────────────────────────────

function NotifCard({
  notif,
  index,
  onDismiss,
  onClick,
}: {
  notif:     Notification;
  index:     number;
  onDismiss: (id: number) => void;
  onClick:   (notif: Notification) => void;
}) {
  const config   = getConfig(notif.type);
  const isUnread = notif.is_read === 0 || notif.is_read === false;
  const dest     = getDestination(notif);
  const { main, reason } = parseMessage(notif);

  const startX                        = useRef(0);
  const didSwipe                      = useRef(false);
  const [swipeDx, setSwipeDx]         = useState(0);
  const [swiping, setSwiping]         = useState(false);
  const [dismissed, setDismissed]     = useState(false);

  const DISMISS_THRESHOLD = -80;

  const triggerDismiss = () => {
    setDismissed(true);
    setTimeout(() => onDismiss(notif.notification_id), 300);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current   = e.touches[0].clientX;
    didSwipe.current = false;
    setSwiping(true);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - startX.current;
    if (dx < 0) {
      setSwipeDx(Math.max(dx, -120));
      if (Math.abs(dx) > 5) didSwipe.current = true;
    }
  };
  const handleTouchEnd = () => {
    setSwiping(false);
    if (swipeDx < DISMISS_THRESHOLD) triggerDismiss();
    else setSwipeDx(0);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    startX.current   = e.clientX;
    didSwipe.current = false;
    setSwiping(true);
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!swiping) return;
    const dx = e.clientX - startX.current;
    if (dx < 0) {
      setSwipeDx(Math.max(dx, -120));
      if (Math.abs(dx) > 5) didSwipe.current = true;
    }
  };
  const handleMouseUp = () => {
    setSwiping(false);
    if (swipeDx < DISMISS_THRESHOLD) triggerDismiss();
    else setSwipeDx(0);
  };

  return (
    <motion.div
      key={notif.notification_id}
      initial={{ opacity: 0, y: 10 }}
      animate={dismissed
        ? { opacity: 0, x: -40, height: 0, marginBottom: 0, paddingBottom: 0 }
        : { opacity: 1, y: 0 }
      }
      transition={{
        delay:    dismissed ? 0 : index * 0.04,
        duration: dismissed ? 0.25 : 0.3,
      }}
      className="relative overflow-hidden rounded-2xl select-none"
    >
      {swipeDx < -10 && (
        <div className="absolute inset-y-0 right-0 flex items-center justify-end px-5 bg-red-500/15 rounded-2xl pointer-events-none">
          <Trash2 size={20} className="text-red-500" />
        </div>
      )}

      <div
        style={{
          transform:  `translateX(${swipeDx}px)`,
          transition: swiping ? 'none' : 'transform 0.3s ease',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { if (swiping) { setSwiping(false); setSwipeDx(0); } }}
        className={`relative p-4 rounded-2xl border flex items-start gap-4
          ${config.bg} ${config.border}`}
      >
        {isUnread && (
          <span className="absolute top-3.5 right-10 w-2 h-2 rounded-full bg-primary" />
        )}

        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); triggerDismiss(); }}
          className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center
            bg-red-500/10 hover:bg-red-500/20 active:scale-90 transition-all"
          aria-label="Dismiss notification"
        >
          <Trash2 size={13} className="text-red-400" />
        </button>

        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${config.iconBg}`}>
          {config.icon(20)}
        </div>

        <div
          className="flex-1 min-w-0 pr-8 cursor-pointer"
          onClick={() => {
            if (didSwipe.current) { didSwipe.current = false; return; }
            onClick(notif);
          }}
        >
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className={`text-sm leading-tight
              ${isUnread
                ? 'font-bold text-on-surface'
                : 'font-semibold text-on-surface-variant'
              }`}>
              {notif.title}
            </p>
            <div className="flex items-center gap-1 text-on-surface-variant shrink-0">
              <Clock size={10} />
              <span className="text-[10px]">{formatTime(notif.created_at)}</span>
            </div>
          </div>

          <p className="text-xs text-on-surface-variant leading-relaxed">{main}</p>

          {reason && (
            <div className="mt-2 px-3 py-2 bg-red-500/8 border border-red-500/15 rounded-xl">
              <p className="text-[11px] font-semibold text-red-500 leading-relaxed">{reason}</p>
            </div>
          )}

          {dest && (
            <div className="flex items-center gap-1 mt-2">
              <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">
                {getTapLabel(notif)}
              </span>
              <ChevronRight size={10} className="text-primary" />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Inbox() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');
  const [activeTab, setActiveTab]         = useState<FilterTab>('unread');
  const [customerId, setCustomerId]       = useState<number | null>(null);

  useEffect(() => {
    let user: any = null;
    try { user = JSON.parse(localStorage.getItem('user') || 'null'); } catch {}
    if (!user?.customer_id) { navigate('/login', { replace: true }); return; }
    setCustomerId(user.customer_id);
    loadNotifications(user.customer_id);
  }, []);

  useEffect(() => {
    return () => {
      try {
        const stored = localStorage.getItem('user');
        if (!stored) return;
        const user = JSON.parse(stored);
        if (user?.customer_id) {
          fetch(`${API_BASE}/api/notifications/${user.customer_id}/read-all`, {
            method: 'PATCH',
          }).catch(() => {});
        }
      } catch {}
    };
  }, []);

  const loadNotifications = async (cid: number) => {
    setLoading(true);
    setError('');
    try {
      const res  = await fetch(`${API_BASE}/api/notifications/${cid}`);
      const data = await res.json();
      if (!res.ok) { setError(data?.message || 'Failed to load notifications.'); return; }
      const notifs: Notification[] = Array.isArray(data) ? data : [];
      notifs.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setNotifications(notifs);
    } catch {
      setError('Unable to load notifications. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async (notifId: number) => {
    setNotifications(prev => prev.filter(n => n.notification_id !== notifId));
    fetch(`${API_BASE}/api/notifications/${notifId}`, { method: 'DELETE' }).catch(() => {});
  };

  const handleMarkAllRead = () => {
    if (!customerId) return;
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    fetch(`${API_BASE}/api/notifications/${customerId}/read-all`, {
      method: 'PATCH',
    }).catch(() => {});
  };

  const handleNotifClick = (notif: Notification) => {
    const dest = getDestination(notif);
    if (dest) navigate(dest);
  };

  const filtered = notifications.filter(n => {
    const type = n.type?.toLowerCase() ?? 'general';
    if (activeTab === 'unread')   return n.is_read === 0 || n.is_read === false;
    if (activeTab === 'loans')    return LOAN_TYPES.has(type);
    if (activeTab === 'payments') return PAYMENT_TYPES.has(type);
    return true;
  });

  const unreadCount = notifications.filter(
    n => n.is_read === 0 || n.is_read === false
  ).length;

  const getTabCount = (key: FilterTab): number => {
    if (key === 'unread')   return notifications.filter(n => n.is_read === 0 || n.is_read === false).length;
    if (key === 'loans')    return notifications.filter(n => LOAN_TYPES.has(n.type?.toLowerCase())).length;
    if (key === 'payments') return notifications.filter(n => PAYMENT_TYPES.has(n.type?.toLowerCase())).length;
    return notifications.length;
  };

  // ── Skeleton ────────────────────────────────────────────────────────────────
  if (loading) return <InboxSkeleton />;

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopBar title="Inbox" showBack={false} />

      <main className="pt-24 px-4 max-w-md mx-auto">

        {/* ── Header Row ── */}
        {!error && notifications.length > 0 && (
          <div className="flex items-center justify-between mb-4 px-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              {notifications.length} Notification{notifications.length !== 1 ? 's' : ''}
              {unreadCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-primary text-on-primary rounded-full text-[9px]">
                  {unreadCount} unread
                </span>
              )}
            </p>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1.5 text-[10px] font-bold text-primary uppercase tracking-wider active:scale-95 transition-transform"
              >
                <CheckCheck size={12} />
                Mark all read
              </button>
            )}
          </div>
        )}

        {/* ── Filter Tabs ── */}
        {!error && notifications.length > 0 && (
          <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-hide">
            {FILTER_TABS.map(tab => {
              const isActive = activeTab === tab.key;
              const count    = getTabCount(tab.key);
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all active:scale-95
                    ${isActive
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'bg-surface-container-high text-on-surface-variant'
                    }`}
                >
                  {tab.label}
                  {count > 0 && (
                    <span className={`text-[9px] font-extrabold px-1 rounded-full
                      ${isActive
                        ? 'bg-on-primary/20 text-on-primary'
                        : 'bg-outline/20 text-on-surface-variant'
                      }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
            <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertCircle className="text-red-500" size={36} />
            </div>
            <div>
              <h2 className="text-lg font-headline font-bold text-on-surface">Something went wrong</h2>
              <p className="text-on-surface-variant text-sm mt-1 max-w-xs">{error}</p>
            </div>
            <button
              onClick={() => { if (customerId) loadNotifications(customerId); }}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-full font-bold text-sm active:scale-95 transition-transform"
            >
              <RefreshCw size={16} />
              Try Again
            </button>
          </div>
        )}

        {/* ── Empty (no notifications at all) ── */}
        {!error && notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center mb-6">
              <InboxIcon className="text-outline/40" size={40} />
            </div>
            <h2 className="text-xl font-headline font-bold text-on-surface">No messages yet</h2>
            <p className="text-on-surface-variant text-sm mt-2">
              Loan updates and notifications will appear here.
            </p>
          </div>
        )}

        {/* ── Empty (filtered tab has nothing) ── */}
        {!error && notifications.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center mb-4">
              <InboxIcon className="text-outline/40" size={28} />
            </div>
            <p className="text-on-surface font-semibold text-sm">
              No {activeTab === 'all' ? '' : activeTab} notifications
            </p>
            <p className="text-on-surface-variant text-xs mt-1">
              {activeTab === 'unread'
                ? "You're all caught up."
                : 'Switch to "All" to see everything.'
              }
            </p>
          </div>
        )}

        {/* ── Notifications List ── */}
        {!error && filtered.length > 0 && (
          <div className="space-y-3">
            <p className="text-[9px] text-on-surface-variant/50 text-center mb-2">
              Swipe left or tap the trash icon to dismiss
            </p>
            <AnimatePresence>
              {filtered.map((notif, i) => (
                <NotifCard
                  key={notif.notification_id}
                  notif={notif}
                  index={i}
                  onDismiss={handleDismiss}
                  onClick={handleNotifClick}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

      </main>

      <BottomNav />
    </div>
  );
}