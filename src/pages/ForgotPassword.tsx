import React from 'react';
import { Mail, ArrowLeft, ArrowRight, CheckCircle2, KeyRound, ShieldCheck, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { motion, AnimatePresence } from 'motion/react';
import { authAPI } from '../lib/api';

type Step = 'email' | 'otp' | 'password' | 'resetting' | 'done';

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [step, setStep]         = React.useState<Step>('email');
  const [email, setEmail]       = React.useState('');
  const [otp, setOtp]           = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm]   = React.useState('');
  const [loading, setLoading]   = React.useState(false);
  const [error, setError]       = React.useState('');
  const [resendCooldown, setResendCooldown] = React.useState(0);

  // Resend cooldown timer
  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // ── Step 1: Send OTP ──────────────────────────────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim())
      return setError('Please enter your email address.');

    setLoading(true);
    try {
      const res = await authAPI.sendOtp(email.trim().toLowerCase());
      if (!res.success)
        return setError(res.message || 'No account found with that email address.');
      setStep('otp');
      setResendCooldown(60);
    } catch {
      setError('Unable to send verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify OTP ────────────────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!otp.trim())
      return setError('Please enter the verification code.');

    setLoading(true);
    try {
      const res = await authAPI.verifyOtp(email, otp.trim());
      if (!res.success)
        return setError(res.message || 'Invalid or expired verification code.');
      setStep('password');
    } catch {
      setError('Unable to verify code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.sendOtp(email);
      if (!res.success) return setError(res.message || 'Failed to resend code.');
      setResendCooldown(60);
    } catch {
      setError('Unable to resend code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Reset Password ────────────────────────────────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password || password.length < 8)
      return setError('Password must be at least 8 characters.');
    if (password !== confirm)
      return setError('Passwords do not match.');

    setLoading(true);
    // Show resetting splash immediately
    setStep('resetting');
    try {
      const res = await authAPI.resetPassword(email, password);
      if (!res.success) {
        setStep('password');
        setError(res.message || 'Failed to reset password. Please try again.');
        return;
      }
      // Hold resetting screen for at least 1.8s for polish
      setTimeout(() => setStep('done'), 1800);
    } catch {
      setStep('password');
      setError('Unable to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Resetting Loading Screen ──────────────────────────────────────────────
  if (step === 'resetting') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-8 text-center"
      >
        {/* Ambient glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-primary/10 rounded-full blur-[100px]" />
        </div>

        {/* Icon */}
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 240, damping: 18 }}
          className="w-24 h-24 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-8 shadow-2xl shadow-primary/20"
        >
          <KeyRound className="text-primary" size={44} />
        </motion.div>

        {/* Text */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center"
        >
          <h2 className="font-headline font-bold text-2xl text-on-surface tracking-tight mb-2">
            Resetting Password…
          </h2>
          <p className="text-on-surface-variant text-sm">
            Please wait while we secure your account.
          </p>
        </motion.div>

        {/* Pulse dots */}
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
              className="w-1.5 h-1.5 rounded-full bg-primary"
            />
          ))}
        </motion.div>
      </motion.div>
    );
  }

  // ── Done Confirmation Screen ──────────────────────────────────────────────
  if (step === 'done') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-8 text-center"
      >
        {/* Ambient glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-green-500/10 rounded-full blur-[100px]" />
        </div>

        {/* Icon */}
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
          className="w-24 h-24 rounded-3xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-8 shadow-2xl shadow-green-500/10"
        >
          <CheckCircle2 className="text-green-500" size={48} />
        </motion.div>

        {/* Text */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="space-y-2 mb-10"
        >
          <p className="text-on-surface-variant text-sm font-bold uppercase tracking-widest">
            All done
          </p>
          <h1 className="font-headline font-extrabold text-4xl text-on-surface tracking-tight">
            Password Reset<span className="text-green-500">.</span>
          </h1>
          <p className="text-on-surface-variant text-sm mt-3 max-w-xs mx-auto">
            Your password has been updated. You can now sign in with your new credentials.
          </p>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="w-full max-w-xs"
        >
          <Button onClick={() => navigate('/login')}>
            Back to Login <ArrowRight size={20} />
          </Button>
        </motion.div>
      </motion.div>
    );
  }

  const steps: Step[] = ['email', 'otp', 'password'];
  const stepIndex = steps.indexOf(step as any);

  const stepMeta = {
    email:    { icon: <Mail size={24} />,        title: 'Reset Password',     subtitle: 'Enter your registered email address' },
    otp:      { icon: <ShieldCheck size={24} />, title: 'Verify Your Email',  subtitle: `Enter the 6-digit code sent to ${email}` },
    password: { icon: <KeyRound size={24} />,    title: 'New Password',       subtitle: 'Choose a strong new password' },
  };

  const meta = stepMeta[step as keyof typeof stepMeta];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md"
      >
        <button
          onClick={() => step === 'email' ? navigate('/login') : setStep(steps[stepIndex - 1] as Step)}
          className="flex items-center gap-2 text-primary font-bold mb-8 hover:opacity-80 transition-opacity"
        >
          <ArrowLeft size={20} />
          <span>{step === 'email' ? 'Back to Login' : 'Back'}</span>
        </button>

        <div className="w-full bg-surface-container-low rounded-[2rem] p-8 shadow-2xl border-t border-white/5">

          {/* Progress dots */}
          <div className="flex items-center gap-2 mb-8">
            {steps.map((s, i) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  i <= stepIndex ? 'bg-primary' : 'bg-surface-container-highest'
                }`}
              />
            ))}
          </div>

          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              {meta.icon}
            </div>
            <div>
              <h2 className="font-headline font-bold text-2xl text-on-surface">{meta.title}</h2>
              <p className="text-on-surface-variant text-xs mt-0.5">{meta.subtitle}</p>
            </div>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-5 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm font-medium"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step 1: Email */}
          {step === 'email' && (
            <form className="space-y-6" onSubmit={handleSendOtp}>
              <Input
                label="EMAIL ADDRESS"
                placeholder="your@email.com"
                type="email"
                icon={<Mail size={20} />}
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                required
              />
              <Button type="submit" disabled={loading}>
                {loading ? 'Sending Code...' : 'Send Verification Code'} <ArrowRight size={20} />
              </Button>
            </form>
          )}

          {/* Step 2: OTP */}
          {step === 'otp' && (
            <form className="space-y-6" onSubmit={handleVerifyOtp}>
              <Input
                label="VERIFICATION CODE"
                placeholder="6-digit code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                icon={<ShieldCheck size={20} />}
                value={otp}
                onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '')); setError(''); }}
                required
              />
              <Button type="submit" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify Code'} <ArrowRight size={20} />
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || loading}
                  className="text-sm text-primary font-semibold disabled:text-outline disabled:cursor-not-allowed transition-colors"
                >
                  {resendCooldown > 0
                    ? `Resend code in ${resendCooldown}s`
                    : 'Resend verification code'
                  }
                </button>
              </div>
            </form>
          )}

          {/* Step 3: New Password */}
          {step === 'password' && (
            <form className="space-y-6" onSubmit={handleResetPassword}>
              <Input
                label="NEW PASSWORD"
                placeholder="At least 8 characters"
                type="password"
                icon={<KeyRound size={20} />}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                required
              />
              <Input
                label="CONFIRM PASSWORD"
                placeholder="Re-enter your new password"
                type="password"
                icon={<KeyRound size={20} />}
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setError(''); }}
                required
              />
              <Button type="submit" disabled={loading}>
                {loading ? 'Resetting...' : 'Reset Password'} <ArrowRight size={20} />
              </Button>
            </form>
          )}

        </div>
      </motion.div>
    </div>
  );
}