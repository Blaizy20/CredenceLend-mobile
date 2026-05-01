import React from 'react';
import { Mail, ArrowLeft, ArrowRight, CheckCircle2, KeyRound, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { motion, AnimatePresence } from 'motion/react';
import { authAPI } from '../lib/api';

type Step = 'email' | 'otp' | 'password' | 'done';

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
    try {
      const res = await authAPI.resetPassword(email, password);
      if (!res.success)
        return setError(res.message || 'Failed to reset password. Please try again.');
      setStep('done');
    } catch {
      setError('Unable to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Done ──────────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-surface-container-low rounded-[2rem] p-8 shadow-2xl border-t border-white/5 text-center"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/10 text-green-500 mb-6">
            <CheckCircle2 size={48} />
          </div>
          <h2 className="font-headline font-bold text-2xl text-on-surface mb-2">Password Reset!</h2>
          <p className="text-on-surface-variant text-sm mb-8">
            Your password has been updated. You can now log in with your new password.
          </p>
          <Button onClick={() => navigate('/login')}>
            Back to Login <ArrowRight size={20} />
          </Button>
        </motion.div>
      </div>
    );
  }

  const steps: Step[] = ['email', 'otp', 'password'];
  const stepIndex = steps.indexOf(step);

  const stepMeta = {
    email:    { icon: <Mail size={24} />,       title: 'Reset Password',      subtitle: 'Enter your registered email address' },
    otp:      { icon: <ShieldCheck size={24} />, title: 'Verify Your Email',  subtitle: `Enter the 6-digit code sent to ${email}` },
    password: { icon: <KeyRound size={24} />,    title: 'New Password',        subtitle: 'Choose a strong new password' },
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
          onClick={() => step === 'email' ? navigate('/login') : setStep(steps[stepIndex - 1])}
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