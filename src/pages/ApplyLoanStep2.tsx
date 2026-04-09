import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BadgeCheck, CreditCard, PenTool, AlertTriangle, CheckCircle2, User, MapPin, FileText } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { loansAPI } from '../lib/api';
import { motion, AnimatePresence } from 'motion/react';

interface CoMakerForm {
  first_name: string;
  last_name:  string;
  contact_no: string;
  email:      string;
  province:   string;
  city:       string;
  barangay:   string;
  street:     string;
}

export default function ApplyLoanStep2() {
  const navigate = useNavigate();
  const location = useLocation();
  const step1    = location.state?.step1;

  React.useEffect(() => {
    if (!step1) navigate('/apply', { replace: true });
  }, [step1]);

  const [formData, setFormData] = useState<CoMakerForm>({
    first_name: '',
    last_name:  '',
    contact_no: '',
    email:      '',
    province:   '',
    city:       '',
    barangay:   '',
    street:     '',
  });

  const [files, setFiles]                   = useState<Record<string, string>>({});
  const [errors, setErrors]                 = useState<Record<string, string>>({});
  const [submitting, setSubmitting]         = useState(false);
  const [submitError, setSubmitError]       = useState('');
  const [showConfirm, setShowConfirm]       = useState(false);

  const handleChange = (field: keyof CoMakerForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field])  setErrors(prev => ({ ...prev, [field]: '' }));
    if (submitError)    setSubmitError('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('File size should not exceed 5MB.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFiles(prev => ({ ...prev, [field]: ev.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.first_name.trim()) newErrors.first_name = 'First name is required.';
    if (!formData.last_name.trim())  newErrors.last_name  = 'Last name is required.';
    if (!formData.contact_no.trim()) newErrors.contact_no = 'Contact number is required.';
    else if (!/^09\d{9}$/.test(formData.contact_no))
      newErrors.contact_no = 'Please enter a valid PH number (09XXXXXXXXX).';
    if (!formData.province.trim()) newErrors.province = 'Province is required.';
    if (!formData.city.trim())     newErrors.city     = 'City is required.';
    if (!formData.barangay.trim()) newErrors.barangay = 'Barangay is required.';
    if (!formData.street.trim())   newErrors.street   = 'Street is required.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Opens confirmation modal only if form is valid
  const handleReview = () => {
    if (!validate()) return;
    setShowConfirm(true);
  };

  const handleSubmit = async () => {
    if (!step1) return;

    let user: any = null;
    try { user = JSON.parse(localStorage.getItem('user') || 'null'); } catch {}
    if (!user?.customer_id) {
      navigate('/login', { replace: true });
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    setShowConfirm(false);

    try {
      const result = await loansAPI.applyLoan({
        customer_id:      user.customer_id,
        tenant_id:        user.tenant_id ?? 1,
        principal_amount: step1.principal_amount,
        payment_term:     step1.payment_term,
        interest_rate:    step1.interest_rate,
        term_months:      step1.term_months,
        id_type:          step1.id_type,
        collateral_type:  step1.collateral_type,
        co_maker:         formData,
      });

      if (!result.success) {
        setSubmitError(result.message || 'Submission failed. Please try again.');
        return;
      }

      navigate('/dashboard', { replace: true });
    } catch {
      setSubmitError('An unexpected error occurred. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!step1) return null;

  const idFields = [
    { key: 'idFront',    label: 'Valid ID (Front)',       icon: <BadgeCheck className="text-primary" size={20} /> },
    { key: 'idBack',     label: 'Valid ID (Back)',        icon: <CreditCard className="text-primary" size={20} /> },
    { key: 'signatures', label: '3 Specimen Signatures', icon: <PenTool    className="text-primary" size={20} /> },
  ];

  // Computed monthly payment estimate for the overview
  const monthlyPayment = step1.term_months > 0
    ? ((step1.principal_amount * (1 + step1.interest_rate / 100)) / step1.term_months)
    : 0;

  return (
    <div className="min-h-screen bg-background pb-12">
      <TopBar title="Co-maker Details" />

      <main className="pt-24 px-6 max-w-md mx-auto">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between items-end mb-2">
            <span className="font-headline font-extrabold text-2xl tracking-tight text-on-surface">
              Step 2 <span className="text-primary/60 text-lg font-medium">of 2</span>
            </span>
            <span className="text-xs uppercase tracking-widest text-primary font-bold">Co-maker</span>
          </div>
          <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
            <div className="h-full w-full bg-primary rounded-full" />
          </div>
        </div>

        {/* Loan Summary */}
        <div className="mb-8 p-4 bg-surface-container-high rounded-xl space-y-2 border border-outline-variant/10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
            Loan Summary
          </p>
          <div className="flex justify-between text-sm">
            <span className="text-on-surface-variant">Amount</span>
            <span className="font-bold text-on-surface">
              ₱{Number(step1.principal_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-on-surface-variant">Term</span>
            <span className="font-bold text-on-surface">{step1.payment_term}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-on-surface-variant">Interest Rate</span>
            <span className="font-bold text-primary">{step1.interest_rate}%</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-on-surface-variant">Collateral</span>
            <span className="font-bold text-on-surface">{step1.collateral_type}</span>
          </div>
        </div>

        {/* Personal Info */}
        <section className="space-y-6 mb-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-6 bg-primary rounded-full" />
            <h2 className="font-headline font-bold text-lg text-on-surface">Personal Info</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name"
              placeholder="Juan"
              value={formData.first_name}
              onChange={(e) => handleChange('first_name', e.target.value)}
              error={errors.first_name}
            />
            <Input
              label="Last Name"
              placeholder="Dela Cruz"
              value={formData.last_name}
              onChange={(e) => handleChange('last_name', e.target.value)}
              error={errors.last_name}
            />
          </div>
          <Input
            label="Contact No."
            placeholder="09XXXXXXXXX"
            value={formData.contact_no}
            onChange={(e) => handleChange('contact_no', e.target.value)}
            error={errors.contact_no}
          />
          <Input
            label="Email Address (Optional)"
            placeholder="juan@example.com"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            error={errors.email}
          />
        </section>

        {/* Address */}
        <section className="space-y-6 mb-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-6 bg-primary rounded-full" />
            <h2 className="font-headline font-bold text-lg text-on-surface">Address</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Province"
              placeholder="Enter Province"
              value={formData.province}
              onChange={(e) => handleChange('province', e.target.value)}
              error={errors.province}
            />
            <Input
              label="City"
              placeholder="Enter City"
              value={formData.city}
              onChange={(e) => handleChange('city', e.target.value)}
              error={errors.city}
            />
          </div>
          <Input
            label="Barangay"
            placeholder="Brgy. San Jose"
            value={formData.barangay}
            onChange={(e) => handleChange('barangay', e.target.value)}
            error={errors.barangay}
          />
          <Input
            label="Street"
            placeholder="House No., Building, Street Name"
            value={formData.street}
            onChange={(e) => handleChange('street', e.target.value)}
            error={errors.street}
          />
        </section>

        {/* Identification — Optional */}
        <section className="space-y-6 mb-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-6 bg-primary rounded-full" />
            <h2 className="font-headline font-bold text-lg text-on-surface">
              Identification
              <span className="ml-2 text-on-surface-variant text-sm font-normal">— optional</span>
            </h2>
          </div>
          <div className="space-y-4">
            {idFields.map(({ key, label, icon }) => (
              <div key={key} className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl border border-white/5">
                <div className="flex items-center gap-3">
                  {icon}
                  <span className="text-sm font-medium">{label}</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    style={{ display: 'none' }}
                    id={`${key}Upload`}
                    onChange={e => handleFileChange(e, key)}
                  />
                  <label htmlFor={`${key}Upload`} className="bg-primary text-on-primary-container text-[10px] font-bold px-4 py-2 rounded-lg uppercase tracking-wider shadow-lg shadow-primary/20 cursor-pointer">
                    CHOOSE FILE
                  </label>
                  {files[key]
                    ? <span className="text-xs text-green-600">Attached ✓</span>
                    : <span className="text-xs text-outline">No file selected</span>
                  }
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Submit Error */}
        {submitError && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-red-500 text-sm font-medium">{submitError}</p>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-4 mb-8 space-y-4">
          <Button onClick={handleReview} disabled={submitting}>
            {submitting ? 'Submitting...' : 'REVIEW & SUBMIT'}
          </Button>
          <div className="flex flex-col items-center">
            <button
              onClick={() => navigate('/apply')}
              disabled={submitting}
              className="text-on-surface-variant hover:text-primary transition-colors text-sm font-medium"
            >
              Back to Step 1
            </button>
            <div className="w-12 h-1 bg-surface-container-highest rounded-full mt-2" />
          </div>
        </footer>
      </main>

      {/* ── Confirmation Bottom Sheet ───────────────────────────────────────── */}
      <AnimatePresence>
        {showConfirm && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirm(false)}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            />

            {/* Sheet */}
            <motion.div
              initial={{ opacity: 0, y: 80 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 80 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-surface-container-low rounded-t-[2rem] shadow-2xl border-t border-white/5 max-w-md mx-auto max-h-[85vh] overflow-y-auto"
            >
              <div className="p-6">
                {/* Handle */}
                <div className="w-10 h-1 bg-outline/30 rounded-full mx-auto mb-6" />

                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h3 className="font-headline font-bold text-xl text-on-surface">Application Overview</h3>
                    <p className="text-on-surface-variant text-xs">Please review before submitting</p>
                  </div>
                </div>

                {/* Loan Details */}
                <div className="mb-5 p-4 bg-primary/5 border border-primary/10 rounded-2xl space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3">Loan Details</p>

                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">Principal Amount</span>
                    <span className="font-bold text-on-surface text-base">
                      ₱{Number(step1.principal_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">Payment Term</span>
                    <span className="font-bold text-on-surface">{step1.payment_term}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">Interest Rate</span>
                    <span className="font-bold text-primary">{step1.interest_rate}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">Duration</span>
                    <span className="font-bold text-on-surface">{step1.term_months} months</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">ID Type</span>
                    <span className="font-bold text-on-surface">{step1.id_type}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">Collateral</span>
                    <span className="font-bold text-on-surface">{step1.collateral_type}</span>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-primary/10 my-1" />

                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">Est. Monthly Payment</span>
                    <span className="font-extrabold text-primary text-base">
                      ₱{monthlyPayment.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Co-maker Details */}
                <div className="mb-5 p-4 bg-surface-container-high rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 mb-3">
                    <User size={14} className="text-on-surface-variant" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Co-maker</p>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">Full Name</span>
                    <span className="font-bold text-on-surface">{formData.first_name} {formData.last_name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">Contact No.</span>
                    <span className="font-bold text-on-surface font-mono">{formData.contact_no}</span>
                  </div>
                  {formData.email && (
                    <div className="flex justify-between text-sm">
                      <span className="text-on-surface-variant">Email</span>
                      <span className="font-bold text-on-surface">{formData.email}</span>
                    </div>
                  )}
                </div>

                {/* Co-maker Address */}
                <div className="mb-6 p-4 bg-surface-container-high rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin size={14} className="text-on-surface-variant" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Co-maker Address</p>
                  </div>
                  <p className="text-sm font-semibold text-on-surface leading-relaxed">
                    {formData.street}, {formData.barangay}, {formData.city}, {formData.province}
                  </p>
                </div>

                {/* Disclaimer */}
                <div className="flex gap-3 p-3 bg-orange-500/5 border border-orange-500/10 rounded-xl mb-6">
                  <AlertTriangle size={16} className="text-orange-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    By submitting, you confirm that all provided information is accurate. Your application will be reviewed by the cooperative.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="w-full py-4 rounded-full bg-primary text-on-primary font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
                  >
                    <CheckCircle2 size={18} />
                    {submitting ? 'Submitting...' : 'Confirm & Submit'}
                  </button>
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="w-full py-4 rounded-full bg-surface-container-highest text-on-surface font-bold text-sm active:scale-95 transition-transform"
                  >
                    Go Back & Edit
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}