import React from 'react';
import { User, Lock, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { motion } from 'motion/react';
import { authAPI } from '../lib/api';

export default function Login() {
  const navigate = useNavigate();

  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [usernameError, setUsernameError] = React.useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setUsernameError('');

    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!trimmedUsername) {
      setUsernameError('Username is required');
      return;
    }

    if (!trimmedPassword) {
      setError('Password is required');
      return;
    }

    setLoading(true);

    try {
      const result = await authAPI.login(trimmedUsername, trimmedPassword);

      if (result.success && result.customer) {
        // Store customer in localStorage — same key as before so other pages still work
        localStorage.setItem('user', JSON.stringify(result.customer));
        navigate('/dashboard', { replace: true });
      }
    } catch (err: any) {
      // authAPI throws with the server's message (e.g. "Invalid credentials")
      localStorage.removeItem('user');
      setError(err.message || 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Background Mesh */}
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-background via-background/95 to-background"></div>
      <div className="fixed top-0 right-0 w-64 h-64 bg-primary/5 blur-[120px] rounded-full -z-10"></div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
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
              <div className="p-4 bg-error/10 border border-error/20 rounded-xl text-error text-xs font-bold text-center">
                {error}
              </div>
            )}
            <Input 
              label="USERNAME" 
              placeholder="Enter your username" 
              type="text"
              icon={<User size={20} />} 
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (usernameError) setUsernameError('');
              }}
              error={usernameError}
              required
            />
            <Input 
              label="PASSWORD" 
              placeholder="••••••••" 
              type={showPassword ? "text" : "password"}
              icon={<Lock size={20} />} 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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

            <Button type="submit" disabled={loading}>
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
  );
}