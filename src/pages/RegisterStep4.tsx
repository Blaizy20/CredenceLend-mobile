import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, MapPin, Fingerprint, CheckCircle, Loader2 } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { motion } from 'motion/react';


export default function RegisterStep4() {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [agreed, setAgreed] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Always reload the latest facePhoto from localStorage and show preview
    const savedData = localStorage.getItem('registerData');
    if (savedData) {
      const parsed = JSON.parse(savedData);
      // Always get the latest facePhoto
      const regData = JSON.parse(localStorage.getItem('registerData') || '{}');
      if (regData.facePhoto) parsed.facePhoto = regData.facePhoto;
      setData(parsed);
    }
  }, []);

  const handleComplete = async () => {
    if (!agreed) {
      alert('Please agree to the Terms and Conditions');
      return;
    }
    // Debug: Show which field is missing
    if (!data) {
      setError('Registration data is missing.');
      return;
    }
    const requiredFields = [
      'firstName', 'lastName', 'username', 'password', 'email', 'contactNo', 'province', 'city', 'barangay', 'street', 'facePhoto'
    ];
    const missing = requiredFields.filter(f => !data[f]);
    if (missing.length > 0) {
      setError('Registration data is incomplete. Missing: ' + missing.join(', '));
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Check for duplicate username or email
      let users = [];
      try {
        users = JSON.parse(localStorage.getItem('users') || '[]');
      } catch {}
      const usernameExists = users.some((u: any) => u.username === data.username);
      const emailExists = users.some((u: any) => u.email === data.email);
      const contactExists = users.some((u: any) => u.contactNo === data.contactNo);
      if (usernameExists || emailExists || contactExists) {
        let msg = 'Account already exists:';
        if (usernameExists) msg += ' Username';
        if (emailExists) msg += ' Email';
        if (contactExists) msg += ' Contact number';
        setError(msg + '. Please use different credentials.');
        setLoading(false);
        return;
      }
      const userProfile = {
        firstName: data.firstName,
        lastName: data.lastName,
        username: data.username,
        password: data.password || '',
        email: data.email,
        contactNo: data.contactNo,
        province: data.province,
        city: data.city,
        barangay: data.barangay,
        street: data.street,
        facePhoto: data.facePhoto || '',
        role: 'client',
        customerNo: `CUST-${Math.floor(100000 + Math.random() * 900000)}`,
        createdAt: new Date().toISOString(),
      };
      users.push(userProfile);
      localStorage.setItem('users', JSON.stringify(users));
      localStorage.removeItem('registerData');
      // Redirect to login after registration
      navigate('/login', { replace: true });
    } catch (err: any) {
      setError('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!data) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopBar title="Review Details" />
      
      <main className="pt-20 pb-32 px-6 max-w-lg mx-auto min-h-screen flex flex-col">
        <div className="mb-10">
          <div className="flex justify-between items-end mb-2">
            <span className="text-on-surface-variant font-body text-xs uppercase tracking-widest">Step 4 of 4</span>
            <span className="text-primary font-headline font-extrabold text-sm">100%</span>
          </div>
          <div className="h-1 w-full bg-surface-container-highest rounded-full overflow-hidden">
            <div className="h-full w-full bg-primary rounded-full"></div>
          </div>
        </div>

        <header className="mb-8">
          <h2 className="text-3xl font-headline font-extrabold tracking-tight mb-2">Confirm Identity</h2>
          <p className="text-on-surface-variant text-sm leading-relaxed">
            Please verify that all information provided is accurate before completing your registration.
          </p>
          {error && (
            <div className="mt-4 p-4 bg-error/10 border border-error/20 rounded-xl text-error text-xs font-bold text-center">
              {error}
            </div>
          )}
        </header>

        <div className="grid grid-cols-1 gap-6">
          {/* Face Photo Preview (always show if available) */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface-container-highest rounded-xl p-6 flex flex-col items-center mb-4"
          >
            {data.facePhoto ? (
              <>
                <img
                  src={data.facePhoto}
                  alt="Face"
                  className="w-32 h-32 rounded-full object-cover border-4 border-primary shadow-lg mb-2"
                />
                <div className="text-xs text-on-surface-variant">Face photo captured during verification</div>
              </>
            ) : (
              <div className="text-xs text-error font-bold">No face photo found. Please go back and capture your photo.</div>
            )}
          </motion.div>
          {/* Personal Details */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface-container-high rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <User className="text-primary" size={20} />
              </div>
              <h3 className="font-headline font-bold text-base tracking-tight">Personal Details</h3>
            </div>
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-body uppercase tracking-widest text-on-surface-variant mb-1">First Name</p>
                  <p className="text-sm font-semibold">{data.firstName}</p>
                </div>
                <div>
                  <p className="text-[10px] font-body uppercase tracking-widest text-on-surface-variant mb-1">Last Name</p>
                  <p className="text-sm font-semibold">{data.lastName}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-body uppercase tracking-widest text-on-surface-variant mb-1">Contact No.</p>
                <p className="text-sm font-semibold font-mono tracking-tighter">{data.contactNo}</p>
              </div>
              <div>
                <p className="text-[10px] font-body uppercase tracking-widest text-on-surface-variant mb-1">Email Address</p>
                <p className="text-sm font-semibold">{data.email}</p>
              </div>
              <div>
                <p className="text-[10px] font-body uppercase tracking-widest text-on-surface-variant mb-1">Username</p>
                <p className="text-sm font-semibold text-primary">@{data.username}</p>
              </div>
            </div>
          </motion.div>

          {/* Residence Details */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-surface-container-high rounded-xl p-6 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <MapPin className="text-primary" size={20} />
              </div>
              <h3 className="font-headline font-bold text-base tracking-tight">Residence Details</h3>
            </div>
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-body uppercase tracking-widest text-on-surface-variant mb-1">Province</p>
                  <p className="text-sm font-semibold">{data.province}</p>
                </div>
                <div>
                  <p className="text-[10px] font-body uppercase tracking-widest text-on-surface-variant mb-1">City</p>
                  <p className="text-sm font-semibold">{data.city}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-body uppercase tracking-widest text-on-surface-variant mb-1">Barangay</p>
                  <p className="text-sm font-semibold">{data.barangay}</p>
                </div>
                <div>
                  <p className="text-[10px] font-body uppercase tracking-widest text-on-surface-variant mb-1">Street / House No.</p>
                  <p className="text-sm font-semibold">{data.street}</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Biometrics Status */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-surface-container-highest rounded-xl p-5 flex items-center justify-between border border-primary/10"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(132,173,255,0.3)]">
                <Fingerprint className="text-on-primary" size={24} />
              </div>
              <div>
                <h4 className="font-headline font-bold text-sm">Biometrics</h4>
                <p className="text-[10px] font-body uppercase tracking-widest text-primary">Status: Verified</p>
              </div>
            </div>
            <CheckCircle className="text-primary" size={20} />
          </motion.div>
        </div>

        <div className="mt-auto pt-10 text-center">
          <div className="flex items-start gap-3 px-4 mb-6">
            <input 
              type="checkbox" 
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-outline-variant bg-surface-container-high text-primary focus:ring-primary/30" 
            />
            <label className="text-xs text-on-surface-variant leading-relaxed text-left">
              By clicking "Complete Registration", you agree to our <button onClick={() => setShowTerms(true)} className="text-primary font-medium hover:underline">Terms of Service</button> and <button onClick={() => setShowPrivacy(true)} className="text-primary font-medium hover:underline">Privacy Policy</button>.
            </label>
          </div>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-background via-background/95 to-transparent">
        <div className="max-w-lg mx-auto flex flex-col gap-4">
          <Button onClick={handleComplete} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Complete Registration'}
          </Button>
          <p className="text-center text-sm text-on-surface-variant">
            Already have an account? 
            <button onClick={() => navigate('/login')} className="text-primary font-bold ml-1 hover:underline">Login</button>
          </p>
        </div>
      </footer>

      {/* Terms of Service Modal */}
      <Modal 
        isOpen={showTerms} 
        onClose={() => setShowTerms(false)} 
        title="Terms of Service"
      >
        <section>
          <h4 className="font-bold text-on-surface mb-2">1. Eligibility</h4>
          <p>You must be at least 18 years old and a resident of the Philippines to use this service. You agree to provide accurate and complete information during the registration process.</p>
        </section>
        <section>
          <h4 className="font-bold text-on-surface mb-2">2. Loan Agreement</h4>
          <p>By applying for a loan, you agree to the specific terms, interest rates, and repayment schedules provided in the individual loan offer. CredenceLend reserves the right to approve or deny any loan application at its sole discretion.</p>
        </section>
        <section>
          <h4 className="font-bold text-on-surface mb-2">3. Interest and Fees</h4>
          <p>Interest rates and service fees vary based on the loan product and your credit profile. All fees will be clearly disclosed before you accept a loan offer.</p>
        </section>
        <section>
          <h4 className="font-bold text-on-surface mb-2">4. Repayment</h4>
          <p>You are responsible for making timely repayments. Late payments may result in additional charges and could negatively impact your credit score.</p>
        </section>
        <section>
          <h4 className="font-bold text-on-surface mb-2">5. Termination</h4>
          <p>CredenceLend may suspend or terminate your account if you violate these terms or engage in fraudulent activity.</p>
        </section>
      </Modal>

      {/* Privacy Policy Modal */}
      <Modal 
        isOpen={showPrivacy} 
        onClose={() => setShowPrivacy(false)} 
        title="Privacy Policy"
      >
        <section>
          <h4 className="font-bold text-on-surface mb-2">1. Data Collection</h4>
          <p>We collect personal information such as your name, contact details, address, and financial information to process your loan application and verify your identity.</p>
        </section>
        <section>
          <h4 className="font-bold text-on-surface mb-2">2. Use of Data</h4>
          <p>Your data is used to assess creditworthiness, facilitate loan disbursements, manage repayments, and improve our services. We also use biometrics for secure identity verification.</p>
        </section>
        <section>
          <h4 className="font-bold text-on-surface mb-2">3. Data Sharing</h4>
          <p>We do not sell your personal information. We may share data with trusted partners, credit bureaus, and regulatory authorities as required by law or to provide our services.</p>
        </section>
        <section>
          <h4 className="font-bold text-on-surface mb-2">4. Security</h4>
          <p>We implement industry-standard security measures, including encryption and secure servers, to protect your data from unauthorized access.</p>
        </section>
        <section>
          <h4 className="font-bold text-on-surface mb-2">5. Your Rights</h4>
          <p>You have the right to access, correct, or request the deletion of your personal data. Contact our support team for any privacy-related inquiries.</p>
        </section>
      </Modal>
    </div>
  );
}
