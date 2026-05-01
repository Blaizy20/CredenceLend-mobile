import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Inbox, ReceiptText, User, ShieldCheck } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useEffect, useState } from 'react';
import { notificationsAPI } from '@/src/lib/api';

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let user: any = null;
    try { user = JSON.parse(localStorage.getItem('user') || 'null'); } catch {}
    if (!user?.customer_id) return;

    const fetchUnread = async () => {
      try {
        const data = await notificationsAPI.getAll(user.customer_id);
        if (Array.isArray(data)) {
          setUnreadCount(data.filter((n: any) => !n.is_read).length);
        }
      } catch {
        // silent fail — badge just won't show
      }
    };

    fetchUnread();

    const interval = setInterval(fetchUnread, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Clear badge immediately when navigating to inbox
  useEffect(() => {
    if (location.pathname === '/inbox') setUnreadCount(0);
  }, [location.pathname]);

  const navItems = [
    { icon: LayoutDashboard, label: 'Home',         path: '/dashboard'    },
    { icon: Inbox,           label: 'Inbox',        path: '/inbox'        },
    { icon: ReceiptText,     label: 'Transactions', path: '/transactions' },
    { icon: User,            label: 'Profile',      path: '/profile'      },
    { icon: ShieldCheck,     label: 'Admin',        path: '/admin/loans'  },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full h-20 bg-background/80 backdrop-blur-2xl flex justify-around items-center px-6 pb-safe z-50 rounded-t-3xl shadow-[0_-10px_30px_rgba(0,0,0,0.3)]">
      {navItems.map((item) => {
        const isActive  = location.pathname === item.path;
        const isInbox   = item.path === '/inbox';
        const showBadge = isInbox && unreadCount > 0;

        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={cn(
              "relative flex flex-col items-center justify-center p-2 transition-all rounded-2xl",
              isActive ? "bg-primary/10 text-primary" : "text-outline hover:text-primary/80"
            )}
          >
            <div className="relative">
              <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              {showBadge && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-extrabold flex items-center justify-center leading-none">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            <span className="font-body text-[10px] font-medium tracking-widest uppercase mt-1">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}