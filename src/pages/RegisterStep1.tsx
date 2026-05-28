import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Mail, Phone, Lock, Eye, EyeOff } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { motion } from 'motion/react';

export default function RegisterStep1() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      // ✅ Check username/email against MySQL via API
      const checkUsername = await fetch(`/api/auth/check-username?username=${encodeURIComponent(formData.username)}`);
      const usernameResult = await checkUsername.json();
      if (usernameResult.taken) {
        setErrors(prev => ({ ...prev, username: 'Username is already taken' }));
        setLoading(false);
        return;
      }

      const checkEmail = await fetch(`/api/auth/check-email?email=${encodeURIComponent(formData.email)}`);
      const emailResult = await checkEmail.json();
      if (emailResult.taken) {
        setErrors(prev => ({ ...prev, email: 'Email is already registered' }));
        setLoading(false);
        return;
      }

      // Save to localStorage and proceed
      localStorage.setItem('registerData', JSON.stringify({
        ...JSON.parse(localStorage.getItem('registerData') || '{}'),
        ...formData
      }));
      navigate('/register/step2');

    } catch (err) {
      // If API check fails, still allow proceeding — backend will catch duplicates on submit
      localStorage.setItem('registerData', JSON.stringify({
        ...JSON.parse(localStorage.getItem('registerData') || '{}'),
        ...formData
      }));
      navigate('/register/step2');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (errors[e.target.name]) setErrors({ ...errors, [e.target.name]: '' });
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
              Please provide your legal information to begin your loan application journey.
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
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                setFormData(prev => ({ ...prev, contactNo: digits }));
                if (errors.contactNo) setErrors(prev => ({ ...prev, contactNo: '' }));
              }}
              error={errors.contactNo}
            />

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