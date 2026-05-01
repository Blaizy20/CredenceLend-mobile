import React from 'react';
import { Mail, ArrowLeft, ArrowRight, CheckCircle2, KeyRound, ShieldCheck, RefreshCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { motion, AnimatePresence } from 'motion/react';
import { authAPI } from '../lib/api';

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [email, setEmail]       = React.useState('');
  const [otp, setOtp]           = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm]   = React.useState('');
  const [loading, setLoading]   = React.useState(false);
  const [verifying, setVerifying] = React.useState(false);
  const [error, setError]       = React.useState('');
  const [otpSent, setOtpSent]   = React.useState(false);
  const [otpVerified, setOtpVerified] = React.useState(false);
  const [resendTimer, setResendTimer] = React.useState(0);
  const [isDone, setIsDone] = React.useState(false);

  // Timer for OTP resend
  React.useEffect(() => {
    let interval: any;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    if (!email.trim()) return setError('Please enter your email address.');

    setLoading(true);
    try {
      const res = await authAPI.sendOtp(email.trim().toLowerCase(), 'reset');
      if (res.success) {
        setOtpSent(true);
        setResendTimer(30);
      } else {
        setError(res.message || 'No account found with that email.');
      }
    } catch {
      setError('Network error. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!otp.trim()) return setError('Enter code.');

    setVerifying(true);
    try {
      const res = await authAPI.verifyOtp(email, otp.trim());
      if (res.success) {
        setOtpVerified(true);
      } else {
        setError(res.message || 'Invalid code.');
      }
    } catch {
      setError('Verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) return setError('Password must be 8+ chars.');
    if (password !== confirm) return setError('Passwords do not match.');

    setLoading(true);
    try {
      const res = await authAPI.resetPassword(email, password);
      if (res.success) {
        setIsDone(true);
      } else {
        setError(res.message || 'Failed to reset.');
      }
    } catch {
      setError('Error resetting password.');
    } finally {
      setLoading(false);
    }
  };

  if (isDone) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full">
          <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={48} />
          </div>
          <h2 className="text-2xl font-bold mb-2">Password Reset!</h2>
          <p className="text-on-surface-variant mb-8">Your password has been successfully updated.</p>
          <Button onClick={() => navigate('/login')}>Back to Login</Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-md">
        <button onClick={() => navigate('/login')} className="flex items-center gap-2 text-primary font-bold mb-8">
          <ArrowLeft size={20} /> Back to Login
        </button>

        <div className="bg-surface-container-low rounded-[2rem] p-8 shadow-xl border border-white/5">
          <header className="mb-8 flex items-center gap-4">
             <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
                {otpVerified ? <KeyRound size={24}/> : <Mail size={24} />}
             </div>
             <div>
                <h2 className="text-2xl font-bold">{otpVerified ? 'New Password' : 'Forgot Password'}</h2>
                <p className="text-xs text-on-surface-variant">
                  {otpVerified ? 'Create a strong new password' : 'Enter email to receive code'}
                </p>
             </div>
          </header>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mb-4 p-3 bg-red-500/10 text-red-500 rounded-xl text-sm">
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {!otpVerified ? (
            <div className="space-y-6">
              {/* Row 1: Email + Confirm */}
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <Input
                    label="EMAIL ADDRESS"
                    placeholder="your@email.com"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    icon={<Mail size={20} />}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleSendOtp()}
                  disabled={loading || resendTimer > 0}
                  className="h-[56px] px-6 bg-primary text-on-primary rounded-xl font-bold text-xs disabled:opacity-50 transition-all active:scale-95"
                >
                  {loading ? <RefreshCcw size={16} className="animate-spin" /> : 'Confirm'}
                </button>
              </div>

              {/* Row 2: Code + Resend (Only if sent) */}
              <AnimatePresence>
                {otpSent && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-6 pt-2">
                    <div className="flex gap-3 items-end">
                      <div className="flex-1">
                        <Input
                          label="VERIFICATION CODE"
                          placeholder="000000"
                          type="number"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.slice(0, 6))}
                          icon={<ShieldCheck size={20} />}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSendOtp()}
                        disabled={loading || resendTimer > 0}
                        className="h-[56px] px-4 border border-primary text-primary rounded-xl font-bold text-xs disabled:opacity-50"
                      >
                        {resendTimer > 0 ? `${resendTimer}s` : 'Resend'}
                      </button>
                    </div>
                    <Button onClick={handleVerifyOtp} disabled={verifying || otp.length !== 6}>
                       {verifying ? 'Verifying...' : 'Verify Code'}
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <Input
                label="NEW PASSWORD"
                placeholder="At least 8 characters"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={<KeyRound size={20} />}
              />
              <Input
                label="CONFIRM PASSWORD"
                placeholder="Repeat new password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                icon={<KeyRound size={20} />}
              />
              <Button type="submit" disabled={loading}>
                {loading ? 'Resetting...' : 'Reset Password'} <ArrowRight size={20} />
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
