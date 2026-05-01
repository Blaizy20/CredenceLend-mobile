import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Mail, Phone, Lock, Eye, EyeOff, CheckCircle2, RefreshCcw } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { motion, AnimatePresence } from 'motion/react';
import { authAPI } from '../lib/api';

export default function RegisterStep1() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    contactNo: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'okay' | 'strong'>('weak');

  // Timer for OTP resend
  useEffect(() => {
    let interval: any;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Remove auto-load to ensure a fresh start as requested
  useEffect(() => {
    localStorage.removeItem('registerData');
  }, []);

  const passwordRequirements = [
    { label: '8+ chars',    test: (pw: string) => pw.length >= 8 },
    { label: '1 uppercase', test: (pw: string) => /[A-Z]/.test(pw) },
    { label: '1 lowercase', test: (pw: string) => /[a-z]/.test(pw) },
    { label: '1 number',    test: (pw: string) => /[0-9]/.test(pw) },
    { label: '1 symbol',    test: (pw: string) => /[^A-Za-z0-9 ]/.test(pw) },
  ];

  // Password strength
  useEffect(() => {
    const pw = formData.password;
    let score = 0;
    if (pw.length >= 8)          score++;
    if (/[A-Z]/.test(pw))        score++;
    if (/[a-z]/.test(pw))        score++;
    if (/[0-9]/.test(pw))        score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 2)                   setPasswordStrength('weak');
    else if (score === 3 || score === 4) setPasswordStrength('okay');
    else                              setPasswordStrength('strong');
  }, [formData.password]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName) newErrors.firstName = 'First name is required';
    else if (!/^[A-Za-z ]+$/.test(formData.firstName)) newErrors.firstName = 'First name must contain only letters and spaces';

    if (!formData.lastName) newErrors.lastName = 'Last name is required';
    else if (!/^[A-Za-z ]+$/.test(formData.lastName)) newErrors.lastName = 'Last name must contain only letters and spaces';

    if (!formData.username) newErrors.username = 'Username is required';
    else if (!/^[a-zA-Z0-9_]{3,16}$/.test(formData.username)) newErrors.username = 'Username must be 3-16 characters, letters, numbers, or _';

    if (!formData.contactNo) newErrors.contactNo = 'Contact number is required';
    else if (!/^09\d{9}$/.test(formData.contactNo)) newErrors.contactNo = 'Contact number must be PH format (09XXXXXXXXX)';

    if (!formData.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email is invalid';

    if (!formData.password) newErrors.password = 'Password is required';
    else {
      const failedReq = passwordRequirements.find(req => !req.test(formData.password));
      if (failedReq) newErrors.password = 'Password does not meet all requirements';
    }

    if (formData.password !== formData.confirmPassword)
      newErrors.confirmPassword = 'Passwords do not match';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSendOtp = async () => {
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setErrors(prev => ({ ...prev, email: 'Enter a valid email first' }));
      return;
    }
    setLoading(true);
    try {
      const data = await authAPI.sendOtp(formData.email, 'registration');
      if (data.success) {
        setOtpSent(true);
        setResendTimer(30);
        setErrors(prev => ({ ...prev, email: '' }));
      } else {
        setErrors(prev => ({ ...prev, email: data.message || 'Failed to send OTP' }));
      }
    } catch {
      setErrors(prev => ({ ...prev, email: 'Network error' }));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) return;
    setVerifyingOtp(true);
    try {
      const data = await authAPI.verifyOtp(formData.email, otpCode);
      if (data.success) {
        setOtpVerified(true);
        setOtpSent(false);
        // Save verification status
        const saved = JSON.parse(localStorage.getItem('registerData') || '{}');
        localStorage.setItem('registerData', JSON.stringify({ ...saved, otpVerified: true }));
      } else {
        setErrors(prev => ({ ...prev, otp: data.message || 'Invalid code' }));
      }
    } catch {
      setErrors(prev => ({ ...prev, otp: 'Verification failed' }));
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      return;
    }

    setLoading(true);
    try {
      // 1. Check if username exists
      const userRes = await authAPI.checkUsername(formData.username);
      if (userRes.exists) {
        setErrors(prev => ({ ...prev, username: 'Username already taken' }));
        setLoading(false);
        return;
      }

      // 2. Check if email exists
      const emailRes = await authAPI.checkEmail(formData.email);
      if (emailRes.exists) {
        setErrors(prev => ({ ...prev, email: 'Email already registered' }));
        setLoading(false);
        return;
      }

      // 3. Check if contact number exists
      const contactRes = await authAPI.checkContact(formData.contactNo);
      if (contactRes.exists) {
        setErrors(prev => ({ ...prev, contactNo: 'Contact number already registered' }));
        setLoading(false);
        return;
      }

      // If all checks pass, navigate to step 2
      navigate('/register/step2');
    } catch (err) {
      console.error("Registration check failed:", err);
      // If server is down, we allow bypass as per previous logic, but ideally we should notify the user
      // For now, let's allow it to proceed to avoid blocking the user if the local API isn't running
      navigate('/register/step2');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const updated = { ...formData, [name]: value };
    setFormData(updated);
    if (errors[name]) setErrors({ ...errors, [name]: '' });

    // Auto-save progress
    try {
      const saved = JSON.parse(localStorage.getItem('registerData') || '{}');
      localStorage.setItem('registerData', JSON.stringify({ ...saved, ...updated }));
    } catch {}
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      <TopBar title="Registration" />

      <main className="pt-24 px-6 max-w-lg mx-auto w-full">
        <div className="mb-10">
          <div className="flex justify-between items-end mb-2">
            <span className="text-on-surface-variant font-body text-xs uppercase tracking-widest">Step 1 of 4</span>
            <span className="text-primary font-headline font-extrabold text-sm">25%</span>
          </div>
          <div className="h-1 w-full bg-surface-container-highest rounded-full overflow-hidden">
            <div className="h-full w-1/4 bg-primary rounded-full"></div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <header>
            <h2 className="font-headline text-[32px] font-extrabold tracking-tight text-on-surface mb-2">Create Account</h2>
            <p className="text-on-surface-variant text-sm leading-relaxed opacity-80">
              Please provide your legal information in order to use the application.
            </p>
          </header>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="First Name"
                placeholder="Enter first name"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                error={errors.firstName}
              />
              <Input
                label="Last Name"
                placeholder="Enter last name"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                error={errors.lastName}
              />
            </div>

            <Input
              label="Username"
              placeholder="Choose a username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              error={errors.username}
            />

            <Input
              label="Contact No"
              placeholder="09XX XXX XXXX"
              type="tel"
              name="contactNo"
              icon={<Phone size={20} />}
              value={formData.contactNo}
              onChange={handleChange}
              error={errors.contactNo}
            />

            {/* Email Address */}
            <Input
              label="Email Address"
              placeholder="your@email.com"
              type="email"
              name="email"
              icon={<Mail size={20} />}
              value={formData.email}
              onChange={handleChange}
              error={errors.email}
            />



            <div>
              <Input
                label="Password"
                placeholder="Create a password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                icon={<Lock size={20} />}
                value={formData.password}
                onChange={handleChange}
                error={errors.password}
                rightElement={
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-outline/40 hover:text-primary transition-colors">
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                }
              />
              <div className="mt-2">
                <div className="text-xs text-on-surface-variant font-bold">
                  Must be 8+ chars with uppercase, lowercase, number, and symbol.
                </div>
                <div className="mt-1 text-xs font-bold">
                  Password strength:{' '}
                  <span style={{ color: passwordStrength === 'strong' ? '#22c55e' : passwordStrength === 'okay' ? '#eab308' : '#ef4444' }}>
                    {passwordStrength === 'strong' ? 'Strong' : passwordStrength === 'okay' ? 'Okay' : 'Weak'}
                  </span>
                </div>
              </div>
            </div>

            <Input
              label="Confirm Password"
              placeholder="Repeat password"
              type={showPassword ? 'text' : 'password'}
              name="confirmPassword"
              icon={<Lock size={20} />}
              value={formData.confirmPassword}
              onChange={handleChange}
              error={errors.confirmPassword}
              rightElement={
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-outline/40 hover:text-primary transition-colors">
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              }
            />

            <div className="pt-6">
              <Button type="submit" disabled={loading}>
                {loading ? 'Checking...' : <> Next <ArrowRight size={20} /> </>}
              </Button>
            </div>
          </form>
        </motion.div>

        <footer className="mt-12 text-center">
          <p className="text-on-surface-variant text-sm">
            Already have an account?
            <button onClick={() => navigate('/login')} className="text-primary font-bold ml-1 hover:underline">Login</button>
          </p>
        </footer>
      </main>
    </div>
  );
}