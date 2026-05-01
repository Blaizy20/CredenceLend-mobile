import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Mail, RefreshCcw } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { motion } from 'motion/react';

export default function RegisterOtp() {
  const navigate = useNavigate();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('registerData') || '{}');
      if (!saved.email) {
        navigate('/register');
        return;
      }
      setEmail(saved.email);
    } catch {
      navigate('/register');
    }
  }, [navigate]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError('Please enter the 6-digit code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });
      const data = await res.json();

      if (data.success) {
        navigate('/register/step2');
      } else {
        setError(data.message || 'Invalid verification code.');
      }
    } catch (err) {
      setError('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (data.success) {
        alert('A new code has been sent to your email.');
      } else {
        setError(data.message || 'Failed to resend code.');
      }
    } catch {
      setError('Failed to resend code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      <TopBar title="Verification" />

      <main className="pt-24 px-6 max-w-lg mx-auto w-full">
        <div className="mb-10">
          <div className="flex justify-between items-end mb-2">
            <span className="text-on-surface-variant font-body text-xs uppercase tracking-widest">Verification</span>
            <span className="text-primary font-headline font-extrabold text-sm">35%</span>
          </div>
          <div className="h-1 w-full bg-surface-container-highest rounded-full overflow-hidden">
            <div className="h-full w-[35%] bg-primary rounded-full"></div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <header>
            <h2 className="font-headline text-[32px] font-extrabold tracking-tight text-on-surface mb-2">Verify Email</h2>
            <p className="text-on-surface-variant text-sm leading-relaxed opacity-80">
              We've sent a 6-digit verification code to <span className="text-primary font-bold">{email}</span>.
            </p>
          </header>

          <form className="space-y-6" onSubmit={handleVerify}>
            <Input
              label="Verification Code"
              placeholder="000000"
              type="number"
              icon={<Mail size={20} />}
              value={otp}
              onChange={(e) => {
                setOtp(e.target.value.slice(0, 6));
                if (error) setError('');
              }}
              error={error}
            />

            <div className="pt-4">
              <Button type="submit" disabled={loading || otp.length !== 6}>
                {loading ? 'Verifying...' : <> Verify & Continue <ArrowRight size={20} /> </>}
              </Button>
            </div>
          </form>

          <div className="text-center pt-4">
            <p className="text-on-surface-variant text-sm mb-4">Didn't receive the code?</p>
            <button
              onClick={handleResend}
              disabled={resending}
              className="inline-flex items-center gap-2 text-primary font-bold hover:underline disabled:opacity-50"
            >
              <RefreshCcw size={16} className={resending ? 'animate-spin' : ''} />
              {resending ? 'Resending...' : 'Resend Code'}
            </button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
