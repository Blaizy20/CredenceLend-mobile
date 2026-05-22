import { loansAPI } from '../lib/api';
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle2,
  User, MapPin, FileText, LayoutDashboard, Upload, Camera,
} from 'lucide-react';
import { TopBar }  from '../components/TopBar';
import { Button }  from '../components/Button';
import { Input }   from '../components/Input';
import { motion, AnimatePresence } from 'motion/react';

// ─── Constants ────────────────────────────────────────────────────────────────

const COMAKER_DOCS = [
  { code: 'COMAKER_INFO', label: 'Co-maker Info Sheet', hint: 'Signed info / application form' },
  { code: 'COMAKER_ID',   label: 'Co-maker Valid ID',   hint: "Clear photo of co-maker's ID"  },
];

const TERM_LABELS: Record<string, string> = {
  daily:        'Daily',
  weekly:       'Weekly',
  semi_monthly: 'Semi-monthly',
  monthly:      'Monthly',
};

const TERM_PERIODS: Record<string, { periodsPerMonth: number; label: string }> = {
  daily:        { periodsPerMonth: 30,   label: 'Daily Payment'        },
  weekly:       { periodsPerMonth: 4.33, label: 'Weekly Payment'       },
  semi_monthly: { periodsPerMonth: 2,    label: 'Semi-monthly Payment' },
  monthly:      { periodsPerMonth: 1,    label: 'Monthly Payment'      },
};

const REASON_MESSAGES: Record<string, string> = {
  AUTO_PASSED_AWAITING_REQUIREMENTS:   'Your application passed initial checks. Please complete your document uploads for manager review.',
  AUTO_PASSED_MANAGER_REVIEW_REQUIRED: 'Your application is now pending manager review.',
  AMOUNT_EXCEEDS_AFFORDABILITY:        'Your application was denied — the amount exceeds your income threshold.',
  CI_REVIEW_REQUIRED:                  'Your application has been routed to a credit investigator for review.',
};

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface UploadDoc {
  code:  string;
  label: string;
  file:  File;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ApplyLoanStep2() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const step1     = location.state?.step1;
  const uploadDocs: UploadDoc[] = location.state?.uploadDocs ?? [];

  React.useEffect(() => {
    if (!step1) navigate('/apply', { replace: true });
  }, [step1]);

  const [formData, setFormData] = useState<CoMakerForm>({
    first_name: '', last_name: '', contact_no: '',
    email: '', province: '', city: '', barangay: '', street: '',
  });

  const [comakerFiles, setComakerFiles] = useState<Record<string, File | null>>({
    COMAKER_INFO: null,
    COMAKER_ID:   null,
  });

  const [errors, setErrors]                 = useState<Record<string, string>>({});
  const [submitting, setSubmitting]         = useState(false);
  const [submitError, setSubmitError]       = useState('');
  const [showConfirm, setShowConfirm]       = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [successStep, setSuccessStep]       = useState<'idle' | 'loading' | 'done'>('idle');

  const [successData, setSuccessData] = useState<{
    instant_reason:       string;
    missing_requirements: string[];
    ci_required:          boolean;
  } | null>(null);

  // ── Payment breakdown ─────────────────────────────────────────────────────

  const paymentBreakdown = step1
    ? (() => {
        const { principal_amount, interest_rate, term_months, payment_term } = step1;
        const termInfo      = TERM_PERIODS[payment_term] ?? TERM_PERIODS['monthly'];
        const totalInterest = principal_amount * (interest_rate / 100) * term_months;
        const totalPayable  = principal_amount + totalInterest;
        const totalPeriods  = Math.round(term_months * termInfo.periodsPerMonth);
        const perPayment    = totalPeriods > 0 ? totalPayable / totalPeriods : 0;
        return { totalPayable, totalInterest, totalPeriods, perPayment, label: termInfo.label };
      })()
    : null;

  const fmt = (n: number) =>
    n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ── Helpers ───────────────────────────────────────────────────────────────

  const handleChange = (field: keyof CoMakerForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
    if (submitError)   setSubmitError('');
  };

  const handleComakerFile = (e: React.ChangeEvent<HTMLInputElement>, code: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('File size should not exceed 5MB.');
      e.target.value = '';
      return;
    }
    setComakerFiles(prev => ({ ...prev, [code]: file }));
  };

  // ── Validation ────────────────────────────────────────────────────────────

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

  const handleReview = () => {
    if (!validate()) return;
    setShowConfirm(true);
  };

  // ── Upload helper ─────────────────────────────────────────────────────────

  const uploadFile = async (
    loanId: number,
    code:   string,
    file:   File,
    label:  string,
  ): Promise<boolean> => {
    try {
      let user: any = null;
      try { user = JSON.parse(localStorage.getItem('user') || 'null'); } catch {}

      const fd = new FormData();
      fd.append('file',        file);
      fd.append('tenant_id',   String(user?.tenant_id   ?? ''));
      fd.append('customer_id', String(user?.customer_id ?? ''));
      fd.append('loan_id',     String(loanId));
      fd.append('folder',      `loan-docs/${loanId}`);
      fd.append('code',        code);
      fd.append('label',       label);

      const res  = await fetch('/api/upload/document', {
        method: 'POST',
        body:   fd,
      });
      const data = await res.json();
      return data.success ?? res.ok;
    } catch {
      return false;
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────

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
    setSuccessStep('loading');
    setUploadProgress('Submitting loan application…');

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
        collateral_notes: step1.collateral_notes,
        comakers: [{
          full_name:    `${formData.first_name} ${formData.last_name}`.trim(),
          phone_number: formData.contact_no,
          relationship: 'Co-maker',
          email:        formData.email || undefined,
          address:      `${formData.street}, ${formData.barangay}, ${formData.city}, ${formData.province}`,
        }],
        notes: 'Submitted from CredenceLend Mobile',
      });

      if (!result.success) {
        setSuccessStep('idle');
        setSubmitError(result.message || 'Submission failed. Please try again.');
        setSubmitting(false);
        return;
      }

      // ✅ Grab loan_id from result
      const loanId = result.loan?.loan_id;

      // ✅ Combine step1 docs + co-maker docs
      const allDocs: { code: string; label: string; file: File }[] = [
        ...uploadDocs.map(d => ({ code: d.code, label: d.label, file: d.file })),
        ...COMAKER_DOCS
          .filter(d => comakerFiles[d.code] !== null)
          .map(d => ({ code: d.code, label: d.label, file: comakerFiles[d.code]! })),
      ];

      // ✅ Upload each file to Railway S3
      if (loanId && allDocs.length > 0) {
        for (let i = 0; i < allDocs.length; i++) {
          setUploadProgress(`Uploading document ${i + 1} of ${allDocs.length}…`);
          await uploadFile(loanId, allDocs[i].code, allDocs[i].file, allDocs[i].label);
        }
      }

      setSuccessData({
        instant_reason:       result.data?.instant_reason       ?? '',
        missing_requirements: result.data?.missing_requirements ?? [],
        ci_required:          result.data?.ci_required          ?? false,
      });
      setUploadProgress('');
      setTimeout(() => setSuccessStep('done'), 600);

    } catch (err: any) {
      setSuccessStep('idle');
      setSubmitError(err?.message || 'An unexpected error occurred. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!step1) return null;

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
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Loan Summary</p>
          <div className="flex justify-between text-sm">
            <span className="text-on-surface-variant">Amount</span>
            <span className="font-bold text-on-surface">₱{fmt(Number(step1.principal_amount))}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-on-surface-variant">Term</span>
            <span className="font-bold text-on-surface">
              {TERM_LABELS[step1.payment_term] ?? step1.payment_term} · {step1.term_months} months
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-on-surface-variant">Interest Rate</span>
            <span className="font-bold text-primary">{step1.interest_rate}% / month</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-on-surface-variant">Total Interest</span>
            <span className="font-bold text-on-surface">
              ₱{paymentBreakdown ? fmt(paymentBreakdown.totalInterest) : '—'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-on-surface-variant">Collateral</span>
            <span className="font-bold text-on-surface">{step1.collateral_type}</span>
          </div>
          {step1.collateral_notes ? (
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-variant">Collateral Notes</span>
              <span className="font-bold text-on-surface text-right max-w-[55%]">{step1.collateral_notes}</span>
            </div>
          ) : null}
          <div className="border-t border-outline-variant/10 pt-2 flex justify-between text-sm">
            <span className="text-on-surface-variant">{paymentBreakdown?.label ?? 'Est. Payment'}</span>
            <span className="font-extrabold text-primary">
              ₱{paymentBreakdown ? fmt(paymentBreakdown.perPayment) : '—'}
            </span>
          </div>
        </div>

        {/* Personal Info */}
        <section className="space-y-6 mb-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-6 bg-primary rounded-full" />
            <h2 className="font-headline font-bold text-lg text-on-surface">Co-maker Personal Info</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" placeholder="Juan"
              value={formData.first_name} onChange={(e) => handleChange('first_name', e.target.value)} error={errors.first_name} />
            <Input label="Last Name" placeholder="Dela Cruz"
              value={formData.last_name} onChange={(e) => handleChange('last_name', e.target.value)} error={errors.last_name} />
          </div>
          <Input label="Contact No." placeholder="09XXXXXXXXX"
            value={formData.contact_no} onChange={(e) => handleChange('contact_no', e.target.value)} error={errors.contact_no} />
          <Input label="Email Address (Optional)" placeholder="juan@example.com" type="email"
            value={formData.email} onChange={(e) => handleChange('email', e.target.value)} error={errors.email} />
        </section>

        {/* Address */}
        <section className="space-y-6 mb-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-6 bg-primary rounded-full" />
            <h2 className="font-headline font-bold text-lg text-on-surface">Co-maker Address</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Province" placeholder="Enter Province"
              value={formData.province} onChange={(e) => handleChange('province', e.target.value)} error={errors.province} />
            <Input label="City" placeholder="Enter City"
              value={formData.city} onChange={(e) => handleChange('city', e.target.value)} error={errors.city} />
          </div>
          <Input label="Barangay" placeholder="Brgy. San Jose"
            value={formData.barangay} onChange={(e) => handleChange('barangay', e.target.value)} error={errors.barangay} />
          <Input label="Street" placeholder="House No., Building, Street Name"
            value={formData.street} onChange={(e) => handleChange('street', e.target.value)} error={errors.street} />
        </section>

        {/* Co-maker Documents */}
        <section className="space-y-4 mb-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-6 bg-primary rounded-full" />
            <h2 className="font-headline font-bold text-lg text-on-surface">
              Co-maker Documents
              <span className="ml-2 text-on-surface-variant text-sm font-normal">— optional</span>
            </h2>
          </div>
          {COMAKER_DOCS.map(doc => {
            const file = comakerFiles[doc.code];
            return (
              <div key={doc.code}
                className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                  file ? 'bg-primary/5 border-primary/25' : 'bg-surface-container-low border-white/5'
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0 mr-3">
                  <Camera className={file ? 'text-primary' : 'text-outline'} size={20} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{doc.label}</p>
                    <p className="text-xs text-on-surface-variant truncate">{doc.hint}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <input type="file" accept="image/*,application/pdf"
                    style={{ display: 'none' }} id={`comaker_${doc.code}`}
                    onChange={e => handleComakerFile(e, doc.code)} />
                  <label htmlFor={`comaker_${doc.code}`}
                    className="bg-primary text-on-primary text-[10px] font-bold px-3 py-2 rounded-lg uppercase tracking-wider cursor-pointer whitespace-nowrap">
                    {file ? 'REPLACE' : 'CHOOSE FILE'}
                  </label>
                  {file
                    ? <span className="text-[10px] text-green-600 max-w-[80px] truncate">✓ {file.name}</span>
                    : <span className="text-[10px] text-outline">No file</span>
                  }
                </div>
              </div>
            );
          })}
        </section>

        {submitError && (
          <div className="mb-6 p-4 bg-secondary-container border border-secondary rounded-xl">
            <p className="text-secondary text-sm font-medium">{submitError}</p>
          </div>
        )}

        <footer className="mt-4 mb-8 space-y-4">
          <Button onClick={handleReview} disabled={submitting}>
            {submitting ? 'Submitting…' : 'REVIEW & SUBMIT'}
          </Button>
          <div className="flex flex-col items-center">
            <button onClick={() => navigate('/apply')} disabled={submitting}
              className="text-on-surface-variant hover:text-primary transition-colors text-sm font-medium">
              Back to Step 1
            </button>
            <div className="w-12 h-1 bg-surface-container-highest rounded-full mt-2" />
          </div>
        </footer>
      </main>

      {/* ── Confirmation Bottom Sheet ── */}
      <AnimatePresence>
        {showConfirm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowConfirm(false)}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, y: 80 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 80 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-surface-container-low rounded-t-[2rem] shadow-2xl border-t border-outline-variant max-w-md mx-auto max-h-[85vh] overflow-y-auto">
              <div className="p-6">
                <div className="w-10 h-1 bg-outline-variant rounded-full mx-auto mb-6" />
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shrink-0">
                    <FileText size={24} className="text-on-primary" />
                  </div>
                  <div>
                    <h3 className="font-headline font-bold text-xl text-on-surface">Application Overview</h3>
                    <p className="text-on-surface-variant text-xs">Please review before submitting</p>
                  </div>
                </div>

                {/* Loan details */}
                <div className="mb-5 p-4 bg-surface-container-high border border-outline-variant rounded-2xl space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3">Loan Details</p>
                  {([
                    ['Principal Amount', `₱${fmt(Number(step1.principal_amount))}`],
                    ['Payment Term',     `${TERM_LABELS[step1.payment_term] ?? step1.payment_term} · ${step1.term_months} months`],
                    ['Interest Rate',    `${step1.interest_rate}% / month`],
                    ['Total Interest',   `₱${paymentBreakdown ? fmt(paymentBreakdown.totalInterest) : '—'}`],
                    ['Total Payable',    `₱${paymentBreakdown ? fmt(paymentBreakdown.totalPayable) : '—'}`],
                    ['Collateral',        step1.collateral_type],
                    ...(step1.collateral_notes ? [['Collateral Notes', step1.collateral_notes]] : []),
                  ] as [string, string][]).map(([label, value]) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span className="text-on-surface-variant">{label}</span>
                      <span className="font-bold text-on-surface text-right max-w-[55%]">{value}</span>
                    </div>
                  ))}
                  <div className="border-t border-outline-variant my-1" />
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">
                      Est. {paymentBreakdown?.label ?? 'Payment'}
                    </span>
                    <span className="font-extrabold text-primary text-base">
                      ₱{paymentBreakdown ? fmt(paymentBreakdown.perPayment) : '—'}
                    </span>
                  </div>
                </div>

                {/* Co-maker */}
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

                {/* Address */}
                <div className="mb-5 p-4 bg-surface-container-high rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin size={14} className="text-on-surface-variant" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Co-maker Address</p>
                  </div>
                  <p className="text-sm font-semibold text-on-surface leading-relaxed">
                    {formData.street}, {formData.barangay}, {formData.city}, {formData.province}
                  </p>
                </div>

                {/* Documents */}
                <div className="mb-5 p-4 bg-surface-container-high rounded-2xl">
                  <div className="flex items-center gap-2 mb-3">
                    <Upload size={14} className="text-on-surface-variant" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                      Documents to Upload ({uploadDocs.length + Object.values(comakerFiles).filter(Boolean).length})
                    </p>
                  </div>
                  {uploadDocs.map((d, i) => (
                    <p key={i} className="text-xs text-on-surface-variant py-0.5">✓ {d.label}</p>
                  ))}
                  {COMAKER_DOCS.filter(d => comakerFiles[d.code]).map(d => (
                    <p key={d.code} className="text-xs text-on-surface-variant py-0.5">✓ {d.label}</p>
                  ))}
                </div>

                <div className="flex gap-3 p-3 bg-surface-container-high border border-outline-variant rounded-xl mb-6">
                  <AlertTriangle size={16} className="text-secondary shrink-0 mt-0.5" />
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    By submitting, you confirm all information is accurate. Your application will be reviewed by the cooperative.
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <button onClick={handleSubmit} disabled={submitting}
                    className="w-full py-4 rounded-full bg-primary text-on-primary font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60">
                    <CheckCircle2 size={18} />
                    {submitting ? 'Submitting…' : 'Confirm & Submit'}
                  </button>
                  <button onClick={() => setShowConfirm(false)}
                    className="w-full py-4 rounded-full bg-surface-container-highest text-on-surface font-bold text-sm active:scale-95 transition-transform">
                    Go Back & Edit
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Loading / Success Screen ── */}
      <AnimatePresence>
        {successStep !== 'idle' && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-background flex flex-col items-center justify-center px-8"
          >
            {successStep === 'loading' && (
              <motion.div key="loading"
                initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
                className="flex flex-col items-center gap-6"
              >
                <div className="relative w-24 h-24 flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full animate-spin" viewBox="0 0 96 96">
                    <circle cx="48" cy="48" r="40" fill="none" stroke="currentColor" strokeWidth="4"
                      strokeLinecap="round" strokeDasharray="180 72" className="text-primary" />
                  </svg>
                  <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center">
                    <FileText size={26} className="text-on-primary" />
                  </div>
                </div>
                <div className="text-center space-y-1">
                  <p className="font-headline font-bold text-xl text-on-surface">Processing Application</p>
                  <p className="text-on-surface-variant text-sm">{uploadProgress || 'Please wait a moment…'}</p>
                </div>
                <div className="flex gap-2">
                  {[0, 1, 2].map(i => (
                    <motion.div key={i} className="w-2 h-2 rounded-full bg-primary"
                      animate={{ opacity: [0.3, 1, 0.3], y: [0, -6, 0] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
                  ))}
                </div>
              </motion.div>
            )}

            {successStep === 'done' && successData && (
              <motion.div key="done"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center gap-6 text-center max-w-xs w-full"
              >
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                  className="w-24 h-24 rounded-full bg-primary flex items-center justify-center shadow-2xl"
                >
                  <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.2 }}>
                    <CheckCircle2 size={48} className="text-on-primary" />
                  </motion.div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                  className="space-y-2 w-full">
                  <h2 className="font-headline font-extrabold text-2xl text-on-surface">
                    Application Submitted!
                  </h2>
                  {successData.instant_reason && (
                    <p className="text-on-surface-variant text-sm leading-relaxed mt-1">
                      {REASON_MESSAGES[successData.instant_reason] ?? successData.instant_reason}
                    </p>
                  )}
                </motion.div>

                {successData.missing_requirements.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
                    className="w-full p-4 bg-surface-container-high rounded-2xl text-left">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">
                      Still Required
                    </p>
                    {successData.missing_requirements.map(req => (
                      <div key={req} className="flex items-center gap-2 py-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-secondary flex-shrink-0" />
                        <p className="text-xs text-on-surface-variant">{req.replace(/_/g, ' ')}</p>
                      </div>
                    ))}
                    <p className="text-[10px] text-on-surface-variant mt-3 leading-relaxed">
                      You can upload these in the Loans section of your dashboard.
                    </p>
                  </motion.div>
                )}

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                  className="w-full flex flex-col gap-3 pt-2">
                  <button
                    onClick={() => navigate('/dashboard', { replace: true })}
                    className="w-full py-4 rounded-full bg-primary text-on-primary font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg">
                    <LayoutDashboard size={18} />
                    Go to Dashboard
                  </button>
                  <button
                    onClick={() => navigate('/loans', { replace: true })}
                    className="w-full py-4 rounded-full bg-surface-container-highest text-on-surface font-bold text-sm active:scale-95 transition-transform">
                    View My Loans
                  </button>
                </motion.div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}