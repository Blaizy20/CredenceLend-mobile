import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { BottomNav } from '../components/BottomNav';
import { Inbox as InboxIcon, Bell, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface Notification {
  notification_id: number;
  title:      string;
  message:    string;
  type:       string;  // 'approved' | 'denied' | 'payment' | 'general'
  is_read:    boolean;
  created_at: string;
}

const notifIcon: Record<string, JSX.Element> = {
  approved: <CheckCircle2 className="text-green-500"  size={20} />,
  denied:   <XCircle      className="text-red-500"    size={20} />,
  payment:  <CheckCircle2 className="text-primary"    size={20} />,
  general:  <Bell         className="text-on-surface-variant" size={20} />,
};

const notifBg: Record<string, string> = {
  approved: 'bg-green-500/10 border-green-500/10',
  denied:   'bg-red-500/10   border-red-500/10',
  payment:  'bg-primary/10   border-primary/10',
  general:  'bg-surface-container-high border-outline-variant/10',
};

export default function Inbox() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading]             = useState(true);

  useEffect(() => {
    let user: any = null;
    try { user = JSON.parse(localStorage.getItem('user') || 'null'); } catch {}
    if (!user?.customer_id) { navigate('/login', { replace: true }); return; }

    const fetchNotifications = async () => {
      setLoading(true);
      try {
        const res  = await fetch(`/api/notifications/${user.customer_id}`);
        const data = await res.json();
        setNotifications(Array.isArray(data) ? data : []);

        // Mark all as read silently
        await fetch(`/api/notifications/${user.customer_id}/read-all`, { method: 'PATCH' });
      } catch {
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, []);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now  = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60)                    return 'Just now';
    if (diff < 3600)                  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400)                 return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800)                return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopBar title="Inbox" showBack={false} />

      <main className="pt-24 px-6 max-w-md mx-auto">
        {loading ? (
          <div className="flex justify-center items-center py-24">
            <Loader2 className="text-primary animate-spin" size={36} />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center mb-6">
              <InboxIcon className="text-outline/40" size={40} />
            </div>
            <h2 className="text-xl font-headline font-bold text-on-surface">No messages</h2>
            <p className="text-on-surface-variant text-sm mt-2">
              Your notifications and messages will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-4">
              {notifications.length} Notification{notifications.length > 1 ? 's' : ''}
            </p>
            {notifications.map((notif, i) => {
              const type = notif.type?.toLowerCase() ?? 'general';
              return (
                <motion.div
                  key={notif.notification_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`relative p-4 rounded-2xl border flex items-start gap-4 ${notifBg[type] ?? notifBg.general}`}
                >
                  {/* Unread dot */}
                  {!notif.is_read && (
                    <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary" />
                  )}

                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl bg-background/40 flex items-center justify-center shrink-0">
                    {notifIcon[type] ?? notifIcon.general}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-bold text-on-surface leading-tight">{notif.title}</p>
                      <div className="flex items-center gap-1 text-on-surface-variant shrink-0">
                        <Clock size={10} />
                        <span className="text-[10px]">{formatTime(notif.created_at)}</span>
                      </div>
                    </div>
                    <p className="text-xs text-on-surface-variant leading-relaxed">{notif.message}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}