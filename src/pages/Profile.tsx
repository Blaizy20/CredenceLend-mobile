import { useNavigate } from 'react-router-dom';
import React from 'react';
import { User, Verified, MapPin, LogOut, AlertTriangle, Settings, Eye, EyeOff, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { BottomNav } from '../components/BottomNav';
import { motion, AnimatePresence } from 'motion/react';
import { API_BASE } from '../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────
type EditField = 'username' | 'email' | 'contact_no' | 'password';

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser]                   = React.useState<any>(null);
  const [showLogoutModal, setShowLogoutModal] = React.useState(false);
  const [loggingOut, setLoggingOut]       = React.useState(false);

  // ── Settings sheet state ──────────────────────────────────────────────────
  const [showSettings, setShowSettings]   = React.useState(false);
  const [editField, setEditField]         = React.useState<EditField | null>(null);
  const [fieldValue, setFieldValue]       = React.useState('');
  const [newPassword, setNewPassword]     = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [showPw, setShowPw]               = React.useState(false);
  const [showNewPw, setShowNewPw]         = React.useState(false);
  const [showConfirmPw, setShowConfirmPw] = React.useState(false);
  const [saving, setSaving]               = React.useState(false);
  const [saveResult, setSaveResult]       = React.useState<{ success: boolean; message: string } | null>(null);

  React.useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try { setUser(JSON.parse(storedUser)); }
      catch { navigate('/login'); }
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const handleLogout = () => {
    setShowLogoutModal(false);
    setLoggingOut(true);
    setTimeout(() => {
      localStorage.removeItem('user');
      navigate('/login', { replace: true });
    }, 2000);
  };

  // ── Open a specific edit field ────────────────────────────────────────────
  const openEdit = (field: EditField) => {
    setEditField(field);
    setSaveResult(null);
    setFieldValue(field !== 'password' ? (user[field] ?? '') : '');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPw(false);
    setShowNewPw(false);
    setShowConfirmPw(false);
  };

  const closeEdit = () => {
    setEditField(null);
    setSaveResult(null);
  };

  // ── Save handler ──────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!editField || !user) return;
    setSaving(true);
    setSaveResult(null);

    const tenant = (() => {
      try {
        return JSON.parse(sessionStorage.getItem('tenant') || 'null')
            ?? JSON.parse(localStorage.getItem('tenant')   || 'null');
      } catch { return null; }
    })();
    const tenant_id = tenant?.tenant_id ?? 0;

    try {
      // ── Client-side validation ────────────────────────────────────────────
      if (editField === 'contact_no' && !/^09\d{9}$/.test(fieldValue.trim()))
        return setSaveResult({ success: false, message: 'Please enter a valid Philippine mobile number (e.g. 09XXXXXXXXX).' });
      if (editField === 'email' && !/\S+@\S+\.\S+/.test(fieldValue.trim()))
        return setSaveResult({ success: false, message: 'Please enter a valid email address.' });
      if (editField === 'username' && fieldValue.trim().length < 4)
        return setSaveResult({ success: false, message: 'Username must be at least 4 characters.' });
      if (editField === 'password') {
        if (!currentPassword)
          return setSaveResult({ success: false, message: 'Please enter your current password.' });
        if (newPassword.length < 8)
          return setSaveResult({ success: false, message: 'New password must be at least 8 characters.' });
        if (newPassword !== confirmPassword)
          return setSaveResult({ success: false, message: 'Passwords do not match.' });
      }

      const body: Record<string, any> = {
        customer_id: user.customer_id,
        tenant_id,
        field:       editField,
      };

      if (editField === 'password') {
        body.current_password = currentPassword;
        body.new_password     = newPassword;
      } else {
        body.value = fieldValue.trim();
      }

      const res  = await fetch(`${API_BASE}/api/profile/update`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json();

      if (!data.success) {
        setSaveResult({ success: false, message: data.message || 'Update failed. Please try again.' });
        return;
      }

      // ✅ Update localStorage with new value
      const updatedUser = { ...user };
      if (editField !== 'password') updatedUser[editField] = fieldValue.trim();
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);

      setSaveResult({ success: true, message: data.message || 'Updated successfully.' });
      setTimeout(() => { closeEdit(); }, 1500);

    } catch (err: any) {
      setSaveResult({ success: false, message: 'Connection error. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const FIELD_LABELS: Record<EditField, string> = {
    username:   'Username',
    email:      'Email Address',
    contact_no: 'Contact Number',
    password:   'Password',
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background pb-32">

      {/* ── Logout Loading Screen ─────────────────────────────────────────── */}
      <AnimatePresence>
        {loggingOut && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-background flex flex-col items-center justify-center"
          >
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-red-500/10 rounded-full blur-[100px]" />
            </div>
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 240, damping: 18 }}
              className="w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-8 shadow-2xl shadow-red-500/10"
            >
              <LogOut className="text-red-500" size={38} />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-center"
            >
              <h2 className="font-headline font-bold text-2xl text-on-surface tracking-tight mb-2">
                Signing out…
              </h2>
              <p className="text-on-surface-variant text-sm">
                See you next time on <span className="text-primary font-semibold">CredenceLend</span>
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex gap-2 mt-12"
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
                  transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
                  className="w-1.5 h-1.5 rounded-full bg-red-500"
                />
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

        {/* ── Account Settings ──────────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Settings className="text-primary" size={18} />
            <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">
              Account Settings
            </h3>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
            className="bg-surface-container-high rounded-xl overflow-hidden shadow-xl divide-y divide-outline/10"
          >
            {(['username', 'email', 'contact_no', 'password'] as EditField[]).map((field) => (
              <button
                key={field}
                onClick={() => { setShowSettings(true); openEdit(field); }}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-surface-container active:bg-surface-container-highest transition-colors text-left"
              >
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-outline tracking-wider uppercase">{FIELD_LABELS[field]}</p>
                  <p className="text-on-surface text-sm">
                    {field === 'password' ? '••••••••' : (user[field] || 'N/A')}
                  </p>
                </div>
                <span className="text-primary text-xs font-bold">Edit</span>
              </button>
            ))}
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

      {/* ── Settings / Edit Bottom Sheet ──────────────────────────────────── */}
      <AnimatePresence>
        {showSettings && editField && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowSettings(false); closeEdit(); }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 80 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 80 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-surface-container-low rounded-t-[2rem] shadow-2xl border-t border-white/5 max-w-md mx-auto p-6 pb-10"
            >
              {/* Handle */}
              <div className="w-10 h-1 rounded-full bg-outline/30 mx-auto mb-6" />

              <h3 className="font-headline font-bold text-lg text-on-surface mb-6">
                Change {FIELD_LABELS[editField]}
              </h3>

              <div className="space-y-4">

                {/* ── Password fields ── */}
                {editField === 'password' ? (
                  <>
                    {/* Current Password */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-outline tracking-wider uppercase">Current Password</label>
                      <div className="relative">
                        <input
                          type={showPw ? 'text' : 'password'}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="Enter current password"
                          className="w-full bg-surface-container-highest border border-outline/20 rounded-xl px-4 py-3 pr-12 text-on-surface text-sm outline-none focus:border-primary transition-colors"
                        />
                        <button type="button" onClick={() => setShowPw(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
                          {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    {/* New Password */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-outline tracking-wider uppercase">New Password</label>
                      <div className="relative">
                        <input
                          type={showNewPw ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="At least 8 characters"
                          className="w-full bg-surface-container-highest border border-outline/20 rounded-xl px-4 py-3 pr-12 text-on-surface text-sm outline-none focus:border-primary transition-colors"
                        />
                        <button type="button" onClick={() => setShowNewPw(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
                          {showNewPw ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-outline tracking-wider uppercase">Confirm New Password</label>
                      <div className="relative">
                        <input
                          type={showConfirmPw ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Re-enter new password"
                          className="w-full bg-surface-container-highest border border-outline/20 rounded-xl px-4 py-3 pr-12 text-on-surface text-sm outline-none focus:border-primary transition-colors"
                        />
                        <button type="button" onClick={() => setShowConfirmPw(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
                          {showConfirmPw ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  /* ── Single field ── */
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-outline tracking-wider uppercase">{FIELD_LABELS[editField]}</label>
                    <input
                      type={editField === 'email' ? 'email' : editField === 'contact_no' ? 'tel' : 'text'}
                      value={fieldValue}
                      onChange={(e) => { setFieldValue(e.target.value); setSaveResult(null); }}
                      placeholder={
                        editField === 'contact_no' ? '09XXXXXXXXX' :
                        editField === 'email'      ? 'email@example.com' :
                                                     `Enter new ${FIELD_LABELS[editField].toLowerCase()}`
                      }
                      className="w-full bg-surface-container-highest border border-outline/20 rounded-xl px-4 py-3 text-on-surface text-sm outline-none focus:border-primary transition-colors"
                    />
                  </div>
                )}

                {/* ── Result feedback ── */}
                <AnimatePresence>
                  {saveResult && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
                        saveResult.success
                          ? 'bg-green-500/10 border border-green-500/20 text-green-500'
                          : 'bg-red-500/10 border border-red-500/20 text-red-500'
                      }`}
                    >
                      {saveResult.success
                        ? <CheckCircle size={16} className="shrink-0" />
                        : <XCircle    size={16} className="shrink-0" />}
                      {saveResult.message}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ── Action buttons ── */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => { setShowSettings(false); closeEdit(); }}
                    className="flex-1 py-3.5 rounded-full bg-surface-container-highest text-on-surface font-bold text-sm active:scale-95 transition-transform"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || saveResult?.success === true}
                    className="flex-1 py-3.5 rounded-full bg-primary text-on-primary font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60"
                  >
                    {saving
                      ? <><Loader2 size={16} className="animate-spin" /> Saving…</>
                      : 'Save Changes'}
                  </button>
                </div>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Logout Confirmation Modal ─────────────────────────────────────── */}
      <AnimatePresence>
        {showLogoutModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLogoutModal(false)}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 60, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 60, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed bottom-0 left-0 right-0 z-50 p-6 bg-surface-container-low rounded-t-[2rem] shadow-2xl border-t border-white/5 max-w-md mx-auto"
            >
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle className="text-red-500" size={28} />
                </div>
              </div>
              <div className="text-center mb-8">
                <h3 className="font-headline font-bold text-xl text-on-surface mb-2">Log out?</h3>
                <p className="text-on-surface-variant text-sm">
                  You'll be returned to the login screen. Any unsaved progress will be lost.
                </p>
              </div>
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