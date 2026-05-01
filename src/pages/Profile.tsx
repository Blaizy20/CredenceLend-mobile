import { useNavigate } from 'react-router-dom';
import React from 'react';
import { User, Verified, MapPin, LogOut, AlertTriangle } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { BottomNav } from '../components/BottomNav';
import { motion, AnimatePresence } from 'motion/react';

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = React.useState<any>(null);
  const [showLogoutModal, setShowLogoutModal] = React.useState(false);

  React.useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        navigate('/login');
      }
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopBar title="My Profile" />

      <main className="pt-24 pb-12 px-6 max-w-md mx-auto space-y-8">

        {/* Profile Header */}
        <section className="flex flex-col items-center text-center space-y-4">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-tr from-primary to-primary-container rounded-full blur opacity-25"></div>
            <div className="relative w-28 h-28 rounded-full flex items-center justify-center border-2 border-primary-container/30 bg-surface-container-high">
              <User className="text-primary" size={60} strokeWidth={1.5} />
            </div>
            <div className="absolute bottom-1 right-1 bg-primary text-on-primary p-1.5 rounded-full shadow-lg">
              <Verified size={18} fill="currentColor" />
            </div>
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl font-extrabold tracking-tight text-on-surface">
              {user.first_name} {user.last_name}
            </h2>
            <p className="text-primary font-medium tracking-wide text-sm bg-primary/10 px-3 py-0.5 rounded-full inline-block">
              PREMIUM MEMBER
            </p>
          </div>
        </section>

        {/* Personal Info */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <User className="text-primary" size={18} />
            <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">
              Personal Information
            </h3>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-surface-container-high rounded-xl p-6 space-y-6 shadow-xl"
          >
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-outline tracking-wider uppercase">Customer No.</p>
                <p className="text-on-surface font-mono text-base">{user.customer_no || 'N/A'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-outline tracking-wider uppercase">Contact No.</p>
                <p className="text-on-surface text-base">{user.contact_no || 'N/A'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-outline tracking-wider uppercase">Email Address</p>
                <p className="text-on-surface text-base">{user.email || 'N/A'}</p>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Address */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <MapPin className="text-primary" size={18} />
            <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">
              Residential Address
            </h3>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-surface-container-high rounded-xl p-6 relative overflow-hidden shadow-xl"
          >
            <div className="relative z-10 grid grid-cols-1 gap-6">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-outline tracking-wider uppercase">Street / House No.</p>
                <p className="text-on-surface text-base leading-relaxed">{user.street || 'N/A'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-outline tracking-wider uppercase">Barangay</p>
                <p className="text-on-surface text-base">{user.barangay || 'N/A'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-outline tracking-wider uppercase">City</p>
                <p className="text-on-surface text-base">{user.city || 'N/A'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-outline tracking-wider uppercase">Province</p>
                <p className="text-on-surface text-base">{user.province || 'N/A'}</p>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Logout */}
        <section className="pt-6">
          <button
            onClick={() => setShowLogoutModal(true)}
            className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 transition-all duration-300 font-bold active:scale-95"
          >
            <LogOut size={20} />
            <span>Logout from Credence</span>
          </button>
        </section>

      </main>

      <BottomNav />

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLogoutModal(false)}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, y: 60, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 60, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed bottom-0 left-0 right-0 z-50 p-6 bg-surface-container-low rounded-t-[2rem] shadow-2xl border-t border-white/5 max-w-md mx-auto"
            >
              {/* Icon */}
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle className="text-red-500" size={28} />
                </div>
              </div>

              {/* Text */}
              <div className="text-center mb-8">
                <h3 className="font-headline font-bold text-xl text-on-surface mb-2">
                  Log out?
                </h3>
                <p className="text-on-surface-variant text-sm">
                  You'll be returned to the login screen. Any unsaved progress will be lost.
                </p>
              </div>

              {/* Buttons */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleLogout}
                  className="w-full py-4 rounded-full bg-red-500 hover:bg-red-600 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all duration-300"
                >
                  <LogOut size={18} />
                  Yes, Log Me Out
                </button>
                <button
                  onClick={() => setShowLogoutModal(false)}
                  className="w-full py-4 rounded-full bg-surface-container-highest text-on-surface font-bold text-sm active:scale-95 transition-transform"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}