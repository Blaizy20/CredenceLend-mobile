import React, { useRef } from 'react';
import { User, Lock, ArrowRight, Sparkles, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button }  from '../components/Button';
import { Input }   from '../components/Input';
import { motion, AnimatePresence } from 'motion/react';
import { authAPI, API_BASE } from '../lib/api';

// ─── Constants ────────────────────────────────────────────────────────────────

const CODE_LENGTH = 6;

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 22) return 'Good evening';
  return 'Working late';
}

// ✅ sessionStorage first — most recent selection always wins
function getStoredTenant() {
  try {
    return JSON.parse(sessionStorage.getItem('tenant') || 'null')
        ?? JSON.parse(localStorage.getItem('tenant')   || 'null');
  } catch { return null; }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Login() {
  const navigate = useNavigate();

  // ── Splash ────────────────────────────────────────────────────────────────
  const [splashVisible, setSplashVisible] = React.useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => setSplashVisible(false), 1800);
    return () => clearTimeout(timer);
  }, []);

  // ── Tenant gate — skip if already verified ────────────────────────────────
  const existingTenant = React.useMemo(() => getStoredTenant(), []);

  type Screen = 'tenant' | 'login';
  const [screen, setScreen] = React.useState<Screen>(existingTenant ? 'login' : 'tenant');

  const [tenant, setTenant] = React.useState<{
    tenant_id:      number;
    tenant_name:    string;
    subdomain?:     string;
    logo_path?:     string | null;
    primary_color?: string | null;
  } | null>(existingTenant);

  // ── Tenant gate state ─────────────────────────────────────────────────────
  const [code, setCode]               = React.useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [codeLoading, setCodeLoading] = React.useState(false);
  const [codeError, setCodeError]     = React.useState('');
  const [codeSuccess, setCodeSuccess] = React.useState(false);
  const [rememberTenant, setRememberTenant] = React.useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  React.useEffect(() => {
    if (screen === 'tenant' && !splashVisible) {
      setTimeout(() => inputRefs.current[0]?.focus(), 400);
    }
  }, [screen, splashVisible]);

  const fullCode  = code.join('').toUpperCase();
  const codeReady = fullCode.length === CODE_LENGTH && !code.includes('');

  const handleCodeChange = (idx: number, value: string) => {
    const char = value.replace(/[^a-zA-Z0-9]/g, '').slice(-1).toUpperCase();
    setCodeError('');
    const next = [...code]; next[idx] = char; setCode(next);
    if (char && idx < CODE_LENGTH - 1) inputRefs.current[idx + 1]?.focus();
  };

  const handleCodeKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (code[idx]) {
        const next = [...code]; next[idx] = ''; setCode(next);
      } else if (idx > 0) {
        inputRefs.current[idx - 1]?.focus();
        const next = [...code]; next[idx - 1] = ''; setCode(next);
      }
    }
    if (e.key === 'Enter' && codeReady) handleVerifyCode();
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text')
      .replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, CODE_LENGTH);
    if (!pasted) return;
    const next = Array(CODE_LENGTH).fill('');
    pasted.split('').forEach((c, i) => { next[i] = c; });
    setCode(next);
    inputRefs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
  };

  const handleVerifyCode = async () => {
    if (!codeReady || codeLoading) return;
    setCodeLoading(true);
    setCodeError('');

    try {
      const res  = await fetch(`${API_BASE}/api/tenants/verify-code`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ code: fullCode }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setCodeError(data.message || 'Invalid code. Please check and try again.');
        setCode(Array(CODE_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
        return;
      }

      const tenantData = {
        tenant_id:     data.tenant_id,
        tenant_name:   data.tenant_name   ?? '',
        subdomain:     data.subdomain     ?? '',
        logo_path:     data.logo_path     ?? null,
        primary_color: data.primary_color ?? null,
        code:          fullCode,
      };

      const tenantPayload = JSON.stringify(tenantData);

      // ✅ Always clear both storages first so stale tenant never bleeds through
      localStorage.removeItem('tenant');
      sessionStorage.removeItem('tenant');

      // ✅ Always save to both — tenant is app-level context, not user-level
      // rememberTenant checkbox is kept for UX but storage is always persistent
      localStorage.setItem('tenant', tenantPayload);
      sessionStorage.setItem('tenant', tenantPayload);

      setTenant(tenantData);
      setCodeSuccess(true);
      setTimeout(() => setScreen('login'), 1000);

    } catch {
      setCodeError('Connection error. Please check your internet and try again.');
    } finally {
      setCodeLoading(false);
    }
  };

  // ── Login state ───────────────────────────────────────────────────────────
  const [username, setUsername]           = React.useState('');
  const [password, setPassword]           = React.useState('');
  const [showPassword, setShowPassword]   = React.useState(false);
  const [error, setError]                 = React.useState('');
  const [loading, setLoading]             = React.useState(false);
  const [usernameError, setUsernameError] = React.useState('');
  const [greeting, setGreeting]           = React.useState<{ name: string } | null>(null);

  const branchLabel = tenant?.subdomain
    ? tenant.subdomain.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : 'Main Branch';

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
      // ✅ Read tenant fresh at login time — sessionStorage first
      let tenant_id = 0;
      try {
        const t = JSON.parse(sessionStorage.getItem('tenant') || 'null')
               ?? JSON.parse(localStorage.getItem('tenant')   || 'null');
        tenant_id = t?.tenant_id ?? 0;
      } catch {}

      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          username: trimmedUsername,
          password: trimmedPassword,
          tenant_id,
        }),
      });
      const result = await res.json();

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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── App Launch Splash ── */}
      <AnimatePresence>
        {splashVisible && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            className="fixed inset-0 z-[60] bg-background flex flex-col items-center justify-center"
          >
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-[120px]" />
            </div>
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 18, delay: 0.1 }}
              className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary to-primary-dim flex items-center justify-center shadow-2xl shadow-primary/30 mb-8"
            >
              <User className="text-on-primary" size={48} />
            </motion.div>
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
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
              className="flex gap-2 mt-14"
            >
              {[0, 1, 2].map((i) => (
                <motion.div key={i}
                  animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
                  transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
                  className="w-1.5 h-1.5 rounded-full bg-primary"
                />
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Post-Login Greeting Splash ── */}
      <AnimatePresence>
        {greeting && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-8 text-center"
          >
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-primary/10 rounded-full blur-[100px]" />
            </div>
            <motion.div
              initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
              className="w-24 h-24 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-8 shadow-2xl shadow-primary/20"
            >
              <Sparkles className="text-primary" size={44} />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <p className="text-on-surface-variant text-sm font-bold uppercase tracking-widest mb-2">
                {getGreeting()}
              </p>
              <h1 className="font-headline font-extrabold text-4xl text-on-surface tracking-tight">
                {greeting.name}<span className="text-primary">.</span>
              </h1>
              <p className="text-on-surface-variant text-sm mt-3">
                Welcome back to{' '}
                <span className="text-primary font-semibold">
                  {tenant?.tenant_name || 'CredenceLend'}
                </span>
              </p>
              {tenant?.tenant_name && (
                <p className="text-on-surface-variant/60 text-xs mt-1">
                  {branchLabel}
                </p>
              )}
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
              className="flex gap-2 mt-12">
              {[0, 1, 2].map((i) => (
                <motion.div key={i}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  className="w-1.5 h-1.5 rounded-full bg-primary"
                />
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Screens ── */}
      <AnimatePresence mode="wait">

        {/* ── Tenant Gate Screen ── */}
        {screen === 'tenant' && !splashVisible && (
          <motion.div
            key="tenant"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="min-h-screen bg-background flex flex-col items-center justify-center px-8"
          >
            <div className="flex flex-col items-center mb-10">
              <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
                <ShieldCheck size={40} className="text-primary" />
              </div>
              <h1 className="font-headline font-extrabold text-2xl text-on-surface text-center">
                Enter Access Code
              </h1>
              <p className="text-on-surface-variant text-sm text-center mt-2 max-w-[260px] leading-relaxed">
                Enter the 6-character code provided by your cooperative to get started.
              </p>
            </div>

            {/* Code Boxes */}
            <div className="flex gap-3 mb-5" onPaste={handleCodePaste}>
              {Array(CODE_LENGTH).fill(null).map((_, idx) => (
                <input
                  key={idx}
                  ref={el => { inputRefs.current[idx] = el; }}
                  type="text"
                  inputMode="text"
                  maxLength={1}
                  value={code[idx]}
                  onChange={e => handleCodeChange(idx, e.target.value)}
                  onKeyDown={e => handleCodeKeyDown(idx, e)}
                  disabled={codeLoading || codeSuccess}
                  className={`
                    w-12 h-14 rounded-xl text-center text-lg font-bold font-mono uppercase
                    bg-surface-container-highest border-2 text-on-surface
                    transition-all outline-none caret-transparent
                    focus:border-primary focus:bg-surface-container disabled:opacity-60
                    ${codeError ? 'border-error/60 bg-error/5' :
                      code[idx] ? 'border-primary/50'          :
                                  'border-outline/20'}
                  `}
                />
              ))}
            </div>

            {/* Remember checkbox */}
            <label className="flex items-center gap-2 cursor-pointer mb-5">
              <input
                type="checkbox"
                checked={rememberTenant}
                onChange={(e) => setRememberTenant(e.target.checked)}
                className="w-4 h-4 rounded border-outline-variant bg-surface-container text-primary focus:ring-primary/30"
              />
              <span className="text-sm text-on-surface-variant font-medium">Remember this cooperative</span>
            </label>

            {/* Error */}
            <AnimatePresence>
              {codeError && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  className="flex items-center gap-2 mb-5 px-4 py-2.5 bg-error/10 border border-error/20 rounded-xl max-w-[300px]"
                >
                  <AlertCircle size={15} className="text-error shrink-0" />
                  <p className="text-xs text-error font-medium">{codeError}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Verify Button */}
            <div className="w-full max-w-[300px]">
              <button
                onClick={handleVerifyCode}
                disabled={!codeReady || codeLoading || codeSuccess}
                className={`
                  w-full py-4 rounded-full font-bold text-sm flex items-center justify-center gap-2
                  transition-all active:scale-95
                  ${codeReady && !codeLoading && !codeSuccess
                    ? 'bg-primary text-on-primary shadow-lg shadow-primary/20'
                    : 'bg-surface-container-highest text-on-surface-variant opacity-60'}
                `}
              >
                {codeLoading  ? <><Loader2 size={18} className="animate-spin" /> Verifying…</>
                : codeSuccess  ? <><ShieldCheck size={18} /> Verified!</>
                :                'Verify Code'}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Login Screen ── */}
        {screen === 'login' && !splashVisible && (
          <motion.div
            key="login"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="min-h-screen bg-background flex flex-col items-center justify-center px-6 relative overflow-hidden"
          >
            <div className="fixed inset-0 z-0 bg-gradient-to-b from-background via-background/95 to-background" />
            <div className="fixed top-0 right-0 w-64 h-64 bg-primary/5 blur-[120px] rounded-full -z-10" />

            <div className="relative z-10 w-full max-w-md flex flex-col items-center">

              {/* ── Brand ── */}
              <div className="mb-10 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-dim shadow-2xl shadow-primary/20 mb-5">
                  <User className="text-on-primary" size={32} />
                </div>

                {tenant?.tenant_name ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="flex flex-col items-center"
                  >
                    <h1 className="font-headline font-extrabold text-3xl tracking-tighter text-on-surface">
                      {tenant.tenant_name}
                    </h1>
                    <div className="inline-flex items-center gap-1.5 mt-2.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      <span className="text-primary text-xs font-semibold tracking-wide">
                        {branchLabel}
                      </span>
                    </div>
                    <p className="text-on-surface-variant text-xs mt-2.5 font-medium">
                      powered by{' '}
                      <span className="text-primary font-semibold">CredenceLend</span>
                    </p>
                  </motion.div>
                ) : (
                  <>
                    <h1 className="font-headline font-extrabold text-3xl tracking-tighter text-on-surface">
                      Credence<span className="text-primary">Lend</span>
                    </h1>
                    <p className="text-on-surface-variant text-sm mt-2 font-medium tracking-wide uppercase">
                      CUSTOMER PORTAL
                    </p>
                  </>
                )}
              </div>

              {/* ── Login Card ── */}
              <div className="w-full bg-surface-container-low rounded-[2rem] p-8 shadow-2xl shadow-black/60 border-t border-white/5 backdrop-blur-sm">
                <div className="mb-8">
                  <h2 className="font-headline font-bold text-2xl text-on-surface">Welcome Back</h2>
                  <p className="text-on-surface-variant text-sm mt-1 leading-relaxed">
                    {tenant?.tenant_name
                      ? `Sign in to access your ${tenant.tenant_name} loan account.`
                      : 'Sign in to your account to continue.'}
                  </p>
                </div>

                <form className="space-y-6" onSubmit={handleLogin}>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
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
                    <label className="flex items-center gap-2 cursor-pointer">
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
                    <button onClick={() => navigate('/register')} className="text-primary font-bold ml-1 hover:underline">
                      Register
                    </button>
                  </p>
                </div>
              </div>

              {/* ✅ Switch cooperative button */}
              <button
                onClick={() => {
                  localStorage.removeItem('tenant');
                  sessionStorage.removeItem('tenant');
                  setTenant(null);
                  setScreen('tenant');
                  setCode(Array(CODE_LENGTH).fill(''));
                  setCodeSuccess(false);
                }}
                className="mt-6 text-xs text-on-surface-variant hover:text-primary transition-colors font-medium"
              >
                Switch cooperative
              </button>

            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </>
  );
}