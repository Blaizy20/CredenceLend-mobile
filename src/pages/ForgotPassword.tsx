import React from 'react';
import { Mail, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { motion } from 'motion/react';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    setLoading(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-surface-container-low rounded-[2rem] p-8 shadow-2xl border-t border-white/5 text-center"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 text-primary mb-6">
            <CheckCircle2 size={48} />
          </div>
          <h2 className="font-headline font-bold text-2xl text-on-surface mb-2">Check your email</h2>
          <p className="text-on-surface-variant text-sm mb-8">
            We've sent a password reset link to <span className="text-on-surface font-bold">{email}</span>
          </p>
          <Button onClick={() => navigate('/login')}>
            Back to Login
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-background via-background/95 to-background"></div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md"
      >
        <button 
          onClick={() => navigate('/login')}
          className="flex items-center gap-2 text-primary font-bold mb-8 hover:opacity-80 transition-opacity"
        >
          <ArrowLeft size={20} />
          <span>Back to Login</span>
        </button>

        <div className="w-full bg-surface-container-low rounded-[2rem] p-8 shadow-2xl border-t border-white/5">
          <div className="mb-8">
            <h2 className="font-headline font-bold text-2xl text-on-surface">Reset Password</h2>
            <p className="text-on-surface-variant text-sm mt-1">Enter your email to receive a reset link</p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <Input 
              label="EMAIL ADDRESS" 
              placeholder="your@email.com" 
              type="email"
              icon={<Mail size={20} />} 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Button type="submit" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'} <ArrowRight size={20} />
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
