import React from 'react';
import { User, Lock, ArrowRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { motion, AnimatePresence } from 'motion/react';
import { authAPI } from '../lib/api';

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 22) return 'Good evening';
  return 'Working late';
}

export default function Login() {
  const navigate = useNavigate();

  const [username, setUsername]           = React.useState('');
  const [password, setPassword]           = React.useState('');
  const [showPassword, setShowPassword]   = React.useState(false);
  const [error, setError]                 = React.useState('');
  const [loading, setLoading]             = React.useState(false);
  const [usernameError, setUsernameError] = React.useState('');
  const [greeting, setGreeting]           = React.useState<{ name: string } | null>(null);
  const [splashVisible, setSplashVisible] = React.useState(true);

  // App launch splash — shown briefly before the login form appears
  React.useEffect(() => {
    const timer = setTimeout(() => setSplashVisible(false), 1800);
    return () => clearTimeout(timer);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setUsernameError('');

    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!trimmedUsername) { setUsernameError('Username is required'); return; }
    if (!trimmedPassword) { setError('Password is required'); return; }

    setLoading(true);

    try {
      const result = await authAPI.login(trimmedUsername, trimmedPassword);

      if (result.success && result.customer) {
        localStorage.setItem('user', JSON.stringify(result.customer));
        setGreeting({ name: result.customer.first_name });
        setTimeout(() => navigate('/dashboard', { replace: true }), 2200);
      } else {
        localStorage.removeItem('user');
        setError(result.message || 'Invalid username or password.');
      }
    } catch (err: any) {
      localStorage.removeItem('user');
      setError(err.message || 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* ── App Launch Splash ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {splashVisible && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            className="fixed inset-0 z-[60] bg-background flex flex-col items-center justify-center"
          >
            {/* Ambient glow */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-[120px]" />
            </div>

            {/* Logo */}
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 18, delay: 0.1 }}
              className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary to-primary-dim flex items-center justify-center shadow-2xl shadow-primary/30 mb-8"
            >
              <User className="text-on-primary" size={48} />
            </motion.div>

            {/* Brand name */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-center"
            >
              <h1 className="font-headline font-extrabold text-4xl tracking-tighter text-on-surface">
                Credence<span className="text-primary">Lend</span>
              </h1>
              <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest mt-2">
                Customer Portal
              </p>
            </motion.div>

            {/* Pulse dots */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex gap-2 mt-14"
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
                  transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
                  className="w-1.5 h-1.5 rounded-full bg-primary"
                />
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Post-Login Greeting Splash ────────────────────────────────────── */}
      <AnimatePresence>
        {greeting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-8 text-center"
          >
            {/* Ambient glow */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-primary/10 rounded-full blur-[100px]" />
            </div>

            {/* Icon */}
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
              className="w-24 h-24 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-8 shadow-2xl shadow-primary/20"
            >
              <Sparkles className="text-primary" size={44} />
            </motion.div>

            {/* Greeting text */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <p className="text-on-surface-variant text-sm font-bold uppercase tracking-widest mb-2">
                {getGreeting()}
              </p>
              <h1 className="font-headline font-extrabold text-4xl text-on-surface tracking-tight">
                {greeting.name}<span className="text-primary">.</span>
              </h1>
              <p className="text-on-surface-variant text-sm mt-3">
                Welcome back to <span className="text-primary font-semibold">CredenceLend</span>
              </p>
            </motion.div>

            {/* Animated progress dots */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex gap-2 mt-12"
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  className="w-1.5 h-1.5 rounded-full bg-primary"
                />
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Login Form ───────────────────────────────────────────────────── */}
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 relative overflow-hidden">
        <div className="fixed inset-0 z-0 bg-gradient-to-b from-background via-background/95 to-background"></div>
        <div className="fixed top-0 right-0 w-64 h-64 bg-primary/5 blur-[120px] rounded-full -z-10"></div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: splashVisible ? 0 : 1, y: splashVisible ? 20 : 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="relative z-10 w-full max-w-md flex flex-col items-center"
        >
          {/* Brand Identity */}
          <div className="mb-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-dim shadow-2xl shadow-primary/20 mb-6">
              <User className="text-on-primary" size={32} />
            </div>
            <h1 className="font-headline font-extrabold text-3xl tracking-tighter text-on-surface">
              Credence<span className="text-primary">Lend</span>
            </h1>
            <p className="text-on-surface-variant text-sm mt-2 font-medium tracking-wide uppercase">CUSTOMER PORTAL</p>
          </div>

          {/* Login Container */}
          <div className="w-full bg-surface-container-low rounded-[2rem] p-8 shadow-2xl shadow-black/60 border-t border-white/5 backdrop-blur-sm">
            <div className="mb-8">
              <h2 className="font-headline font-bold text-2xl text-on-surface">Welcome Back</h2>
              <p className="text-on-surface-variant text-sm mt-1">Sign in to your account</p>
            </div>

            <form className="space-y-6" onSubmit={handleLogin}>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs font-bold text-center"
                >
                  {error}
                </motion.div>
              )}
              <Input
                label="USERNAME"
                placeholder="Enter your username"
                type="text"
                icon={<User size={20} />}
                value={username}
                onChange={(e) => { setUsername(e.target.value); if (usernameError) setUsernameError(''); }}
                error={usernameError}
                required
              />
              <Input
                label="PASSWORD"
                placeholder="••••••••"
                type={showPassword ? 'text' : 'password'}
                icon={<Lock size={20} />}
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                required
              />

              <div className="flex items-center justify-between px-1">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(e) => setShowPassword(e.target.checked)}
                    className="w-4 h-4 rounded border-outline-variant bg-surface-container text-primary focus:ring-primary/30"
                  />
                  <span className="text-sm text-on-surface-variant font-medium">Show Password</span>
                </label>
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  Forgot Password?
                </button>
              </div>

              <Button type="submit" disabled={loading || !!greeting}>
                {loading ? 'Signing in...' : 'Login'} <ArrowRight size={20} />
              </Button>
            </form>

            <div className="mt-8 pt-8 border-t border-outline-variant/10 text-center">
              <p className="text-on-surface-variant text-sm">
                Don't have an account?
                <button onClick={() => navigate('/register')} className="text-primary font-bold ml-1 hover:underline">Register</button>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}