import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, MapPin, Loader2, CheckCircle2, AlertTriangle, LogIn, ArrowLeft } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { motion, AnimatePresence } from 'motion/react';
import { authAPI } from '../lib/api';

export default function RegisterStep4() {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [agreed, setAgreed] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [successStep, setSuccessStep] = useState<'idle' | 'loading' | 'done'>('idle');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('registerData');
      if (saved) {
        setData(JSON.parse(saved));
      } else {
        setError('No registration data found. Please go back to Step 1.');
      }
    } catch (err) {
      console.error('Error parsing registerData:', err);
      setError('Failed to load registration data.');
    }
  }, []);

  const handleReview = () => {
    if (!agreed) {
      alert('Please agree to the Terms and Conditions');
      return;
    }
    if (!data) {
      setError('Registration data is missing.');
      return;
    }

    const requiredFields = [
      'firstName', 'lastName', 'username', 'password',
      'email', 'contactNo', 'province', 'city', 'barangay', 'street'
    ];

    const missing = requiredFields.filter(f => !data[f]);
    if (missing.length > 0) {
      setError('Incomplete data. Missing: ' + missing.join(', '));
      return;
    }

    setError('');
    setShowConfirm(true);
  };

  const handleComplete = async () => {
    setShowConfirm(false);
    setLoading(true);
    setError('');

    try {
      const payload = {
        firstName:  data.firstName,
        lastName:   data.lastName,
        username:   data.username,
        password:   data.password,
        email:      data.email,
        contactNo:  data.contactNo,
        province:   data.province,
        city:       data.city,
        barangay:   data.barangay,
        street:     data.street,
        facePhoto:  data.facePhoto,
      };

      const result = await authAPI.register(payload);

      if (!result.success) {
        setError(result.message || 'Registration failed.');
        setLoading(false);
        return;
      }

      localStorage.removeItem('registerData');
      setSuccessStep('loading');
      setTimeout(() => setSuccessStep('done'), 2000);

    } catch (err: any) {
      setError(err.message || 'Connection error. Please check your internet.');
    } finally {
      setLoading(false);
    }
  };

  // If no data and no error yet, show a small loader instead of white screen
  if (!data && !error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopBar title="Review Details" />

      <main className="pt-20 pb-32 px-6 max-w-lg mx-auto w-full flex-1">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between items-end mb-2">
            <span className="text-on-surface-variant font-body text-xs uppercase tracking-widest">Step 4 of 4</span>
            <span className="text-primary font-headline font-extrabold text-sm">100%</span>
          </div>
          <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
            <div className="h-full w-full bg-primary rounded-full" />
          </div>
        </div>

        {error ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-error/10 text-error rounded-full flex items-center justify-center mb-4">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-xl font-bold mb-2">Registration Issue</h3>
            <p className="text-on-surface-variant mb-8">{error}</p>

            <div className="flex flex-col gap-4 w-full px-8">
              <Button onClick={() => navigate('/register/step1')}>
                <ArrowLeft size={18} className="mr-2" /> Start Over
              </Button>

              <button
                onClick={handleComplete}
                className="text-primary text-sm font-bold py-2 hover:underline"
              >
                Retry Registration
              </button>
            </div>
          </div>
        ) : (
          <>
            <header className="mb-8">
              <h2 className="text-3xl font-headline font-extrabold tracking-tight mb-2">Confirm Identity</h2>
              <p className="text-on-surface-variant text-sm leading-relaxed">
                Please verify that all information provided is accurate.
              </p>
            </header>

            <div className="space-y-6">
              {/* Face Photo Preview */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-surface-container-highest rounded-2xl p-6 flex flex-col items-center"
              >
                {data.facePhoto ? (
                  <img src={data.facePhoto} alt="Face"
                    className="w-32 h-32 rounded-full object-cover border-4 border-primary shadow-xl" />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-surface-container-high flex items-center justify-center border-2 border-dashed border-outline">
                    <User size={40} className="text-outline" />
                  </div>
                )}
                <p className="text-xs text-on-surface-variant mt-4 font-medium uppercase tracking-wider">Identity Photo</p>
              </motion.div>

              {/* Personal Details */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-surface-container-high rounded-2xl p-6"
              >
                <div className="flex items-center gap-3 mb-6">
                  <User className="text-primary" size={20} />
                  <h3 className="font-headline font-bold text-base">Personal Details</h3>
                </div>
                <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                  <div className="col-span-1">
                    <p className="text-[10px] uppercase font-bold text-on-surface-variant mb-1">First Name</p>
                    <p className="text-sm font-semibold">{data.firstName}</p>
                  </div>
                  <div className="col-span-1">
                    <p className="text-[10px] uppercase font-bold text-on-surface-variant mb-1">Last Name</p>
                    <p className="text-sm font-semibold">{data.lastName}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] uppercase font-bold text-on-surface-variant mb-1">Email</p>
                    <p className="text-sm font-semibold">{data.email}</p>
                  </div>
                  <div className="col-span-1">
                    <p className="text-[10px] uppercase font-bold text-on-surface-variant mb-1">Contact No.</p>
                    <p className="text-sm font-semibold">{data.contactNo}</p>
                  </div>
                  <div className="col-span-1">
                    <p className="text-[10px] uppercase font-bold text-on-surface-variant mb-1">Username</p>
                    <p className="text-sm font-semibold text-primary">@{data.username}</p>
                  </div>
                </div>
              </motion.div>

              {/* Residence Details */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-surface-container-high rounded-2xl p-6"
              >
                <div className="flex items-center gap-3 mb-6">
                  <MapPin className="text-primary" size={20} />
                  <h3 className="font-headline font-bold text-base">Residence</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-on-surface-variant mb-1">Full Address</p>
                    <p className="text-sm font-semibold leading-relaxed">
                      {data.street}, {data.barangay}, {data.city}, {data.province}
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Terms and Privacy */}
            <div className="mt-8 mb-4">
              <div className="flex items-start gap-3 p-4 bg-surface-container-low rounded-xl border border-outline/10">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-1 h-5 w-5 rounded border-outline bg-surface-container-high text-primary focus:ring-primary/30"
                />
                <label className="text-xs text-on-surface-variant leading-relaxed">
                  I agree to the{' '}
                  <button onClick={() => setShowTerms(true)} className="text-primary font-bold">Terms of Service</button>
                  {' '}and{' '}
                  <button onClick={() => setShowPrivacy(true)} className="text-primary font-bold">Privacy Policy</button>.
                </label>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Footer CTA */}
      {!error && (
        <footer className="fixed bottom-0 left-0 w-full p-6 bg-background/80 backdrop-blur-md border-t border-outline/5">
          <div className="max-w-lg mx-auto">
            <Button onClick={handleReview} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Complete Registration'}
            </Button>
          </div>
        </footer>
      )}

      {/* Confirmation Bottom Sheet */}
      <AnimatePresence>
        {showConfirm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowConfirm(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-surface-container-low rounded-t-[2.5rem] p-8 max-w-lg mx-auto shadow-2xl"
            >
              <div className="w-12 h-1.5 bg-outline/20 rounded-full mx-auto mb-8" />
              <h3 className="font-headline font-bold text-2xl mb-2">Create Account?</h3>
              <p className="text-on-surface-variant text-sm mb-8 leading-relaxed">
                By clicking confirm, you certify that all provided details are correct and legally binding.
              </p>

              <div className="flex flex-col gap-3">
                <button onClick={handleComplete} disabled={loading}
                  className="w-full py-4 rounded-full bg-primary text-on-primary font-bold shadow-lg shadow-primary/20 active:scale-[0.98] transition-all">
                  {loading ? 'Processing...' : 'Yes, Confirm & Create'}
                </button>
                <button onClick={() => setShowConfirm(false)}
                  className="w-full py-4 rounded-full bg-surface-container-highest text-on-surface font-bold active:scale-[0.98] transition-all">
                  Review Again
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Success/Loading Overlay */}
      <AnimatePresence>
        {successStep !== 'idle' && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-background flex flex-col items-center justify-center px-8 text-center"
          >
            {successStep === 'loading' ? (
              <div className="flex flex-col items-center">
                <div className="relative w-20 h-20 mb-6">
                   <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                   <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                </div>
                <h2 className="text-xl font-bold">Creating Account</h2>
                <p className="text-on-surface-variant text-sm">Finishing up your profile...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center max-w-xs">
                <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle2 size={48} className="text-primary" />
                </div>
                <h2 className="text-3xl font-extrabold mb-3 tracking-tight">Success! 🎉</h2>
                <p className="text-on-surface-variant text-sm leading-relaxed mb-8">
                  Your account is ready. Welcome to CredenceLend!
                </p>
                <Button onClick={() => navigate('/login', { replace: true })}>
                  <LogIn size={20} className="mr-2" /> Continue to Login
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <Modal isOpen={showTerms} onClose={() => setShowTerms(false)} title="Terms of Service">
        <p className="text-sm leading-relaxed">By using CredenceLend, you agree to comply with our financial regulations and repayment schedules. Late payments may affect your credit score...</p>
      </Modal>

      <Modal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} title="Privacy Policy">
        <p className="text-sm leading-relaxed">We protect your data with bank-level encryption. Your biometrics and personal info are used solely for identity verification and loan processing...</p>
      </Modal>
    </div>
  );
}
