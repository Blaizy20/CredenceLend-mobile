import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Inbox, ReceiptText, User, ShieldCheck } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: LayoutDashboard, label: 'Home', path: '/dashboard' },
    { icon: Inbox, label: 'Inbox', path: '/inbox' },
    { icon: ShieldCheck, label: 'Admin', path: '/admin/loans' },
    { icon: ReceiptText, label: 'Transactions', path: '/transactions' },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full h-20 bg-background/80 backdrop-blur-2xl flex justify-around items-center px-6 pb-safe z-50 rounded-t-3xl shadow-[0_-10px_30px_rgba(0,0,0,0.3)]">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={cn(
              "flex flex-col items-center justify-center p-2 transition-all rounded-2xl",
              isActive ? "bg-primary/10 text-primary" : "text-outline hover:text-primary/80"
            )}
          >
            <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
            <span className="font-body text-[10px] font-medium tracking-widest uppercase mt-1">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
