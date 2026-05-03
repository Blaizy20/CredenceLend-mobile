import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BadgeCheck, CreditCard, PenTool, FileText, AlertTriangle,
  CheckCircle2, User, MapPin, LayoutDashboard, Receipt, UserCheck,
} from 'lucide-react';
import { TopBar }   from '../components/TopBar';
import { Button }   from '../components/Button';
import { Input }    from '../components/Input';
import { motion, AnimatePresence } from 'motion/react';
import type { Step1Payload } from './ApplyLoanStep1';

// ── Types ─────────────────────────────────────────────────────────────────────
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

interface DocFiles {
  idFront:         string;
  idBack:          string;
  proofOfBilling:  string;
  proofOfIncome:   string;
  comakerIdFront:  string;
  signatures:      string;
  collateralProof: string;
}

// ── Document config ────────────────────────────────────────────────────────────
const REQUIRED_DOCS: {
  key: keyof DocFiles; label: string; desc: string;
  icon: React.ReactNode; required: boolean;
}[] = [
  { key: 'idFront',        label: 'Valid ID — Front',      desc: 'Government-issued ID (front side)',         icon: <BadgeCheck size={18} className="text-primary" />, required: true  },
  { key: 'idBack',         label: 'Valid ID — Back',       desc: 'Government-issued ID (back side)',          icon: <CreditCard size={18} className="text-primary" />, required: true  },
  { key: 'proofOfBilling', label: 'Proof of Billing',      desc: 'Utility bill within the last 3 months',     icon: <Receipt    size={18} className="text-primary" />, required: true  },
  { key: 'proofOfIncome',  label: 'Proof of Income',       desc: 'Payslip, ITR, or certificate of employment',icon: <FileText   size={18} className="text-primary" />, required: true  },
  { key: 'comakerIdFront', label: 'Co-maker Valid ID',     desc: "Government-issued ID of your co-maker",     icon: <UserCheck  size={18} className="text-primary" />, required: true  },
  { key: 'signatures',     label: '3 Specimen Signatures', desc: 'On plain white paper',                      icon: <PenTool    size={18} className="text-primary" />, required: false },
  { key: 'collateralProof',label: 'Collateral Proof',      desc: 'Document proving ownership of collateral',  icon: <BadgeCheck size={18} className="text-primary" />, required: false },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Read customerid + tenantid from wherever the app stores the logged-in user.
 *  Checks localStorage under multiple common key patterns used by the original app. */
function getStoredCustomer(): { customerid: number; tenantid: number } | null {
  const keys = ['customer', 'user', 'auth', 'session'];
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const obj = JSON.parse(raw);
      const cid = obj?.customerid ?? obj?.customer?.customerid ?? obj?.id;
      const tid = obj?.tenantid  ?? obj?.customer?.tenantid  ?? 1;
      if (cid) return { customerid: Number(cid), tenantid: Number(tid) };
    } catch { /* skip */ }
  }
  return null;
}

async function postApplyLoan(payload: Record<string, unknown>): Promise<{
  success: boolean; message?: string; loan?: { loanid: number; referenceno: string; totalpayable: number; status: string };
}> {
  const res = await fetch('/api/loans/apply', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });

  // Handle non-JSON error pages (nginx 404, Railway 502, etc.)
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Server error (${res.status}). The API endpoint may be unavailable.`);
  }

  const data = await res.json();

  // Propagate HTTP-level errors with the server's own message when available
  if (!res.ok) {
    throw new Error(data?.message ?? `Server responded with ${res.status}.`);
  }

  return data;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ApplyLoanStep2() {
  const navigate = useNavigate();
  const location = useLocation();
  const step1 = location.state?.step1 as Step1Payload | undefined;

  React.useEffect(() => {
    if (!step1) navigate('/apply', { replace: true });
  }, [step1]);

  const [formData, setFormData] = useState<CoMakerForm>({
    first_name: '', last_name: '', contact_no: '', email: '',
    province: '', city: '', barangay: '', street: '',
  });

  const [files,       setFiles]       = useState<Partial<DocFiles>>({});
  const [errors,      setErrors]      = useState<Record<string, string>>({});
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [successStep, setSuccessStep] = useState<'idle' | 'loading' | 'done'>('idle');
  const [loanResult,  setLoanResult]  = useState<{ referenceno: string; totalpayable: number } | null>(null);

  const handleChange = (field: keyof CoMakerForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field])  setErrors(prev => ({ ...prev, [field]: '' }));
    if (submitError)    setSubmitError('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof DocFiles) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must not exceed 5MB.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setFiles(prev => ({ ...prev, [field]: ev.target?.result as string }));
    reader.readAsDataURL(file);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formData.first_name.trim()) e.first_name = 'First name is required.';
    if (!formData.last_name.trim())  e.last_name  = 'Last name is required.';
    if (!formData.contact_no.trim()) e.contact_no = 'Contact number is required.';
    else if (!/^09\d{9}$/.test(formData.contact_no))
      e.contact_no = 'Please enter a valid PH number (09XXXXXXXXX).';
    if (!formData.province.trim()) e.province = 'Province is required.';
    if (!formData.city.trim())     e.city     = 'City is required.';
    if (!formData.barangay.trim()) e.barangay = 'Barangay is required.';
    if (!formData.street.trim())   e.street   = 'Street is required.';

    for (const doc of REQUIRED_DOCS.filter(d => d.required)) {
      if (!files[doc.key]) e[`file_${doc.key}`] = `${doc.label} is required.`;
    }
    // Also require collateral proof if borrower provided a collateral type
    if (step1?.collateral_type && !files.collateralProof)
      e.file_collateralProof = 'Collateral Proof is required when collateral is specified.';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleReview = () => {
    if (!validate()) return;
    setShowConfirm(true);
  };

  const handleSubmit = async () => {
    if (!step1) return;
    setSubmitting(true);
    setSubmitError('');
    setShowConfirm(false);

    // ── Retrieve the logged-in customer's IDs ──────────────────────────────
    const stored = getStoredCustomer();
    if (!stored) {
      setSubmitError('Session expired. Please log in again.');
      setSubmitting(false);
      navigate('/login', { replace: true });
      return;
    }

    // ── Build the exact payload the backend expects ────────────────────────
    // Backend route: POST /api/loans/apply
    // Required: customerid, principalamount, paymentterm, collateraltype
    // comaker uses the OLD db shape: firstname, lastname, contactno, ...
    const payload: Record<string, unknown> = {
      customerid:      stored.customerid,
      tenantid:        stored.tenantid,
      principalamount: step1.principal_amount,
      paymentterm:     step1.payment_term,          // 'daily'|'weekly'|'semi_monthly'|'monthly'
      interestrate:    step1.interest_rate,
      termmonths:      step1.term_months,
      collateraltype:  step1.collateral_type || '',  // backend requires this field even if empty
      comaker: {
        firstname:  formData.first_name.trim(),
        lastname:   formData.last_name.trim(),
        contactno:  formData.contact_no.trim(),
        email:      formData.email.trim()     || null,
        province:   formData.province.trim()  || null,
        city:       formData.city.trim()      || null,
        barangay:   formData.barangay.trim()  || null,
        street:     formData.street.trim()    || null,
      },
    };

    // Optional fields — only add if present
    if (step1.collateral_notes) payload.collateralnotes = step1.collateral_notes;
    if (step1.release_channel)  payload.releasechannel  = step1.release_channel;
    if (step1.payout_method)    payload.payoutmethod    = step1.payout_method;

    try {
      const result = await postApplyLoan(payload);

      if (!result.success) {
        setSubmitError(result.message ?? 'Submission failed. Please try again.');
        setSubmitting(false);
        return;
      }

      if (result.loan) {
        setLoanResult({ referenceno: result.loan.referenceno, totalpayable: result.loan.totalpayable });
      }

      setSuccessStep('loading');
      setTimeout(() => setSuccessStep('done'), 2200);
    } catch (err: any) {
      setSubmitError(err?.message ?? 'An unexpected error occurred. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!step1) return null;

  // Payment estimates (simple interest — same formula as Step1 breakdown)
  const estTotal      = step1.principal_amount * (1 + (step1.interest_rate / 100) * step1.term_months);
  const perPeriod     = step1.term_months > 0 ? estTotal / step1.term_months : 0;
  const termLabel     = ({ daily: 'Day', weekly: 'Week', semi_monthly: 'Cycle', monthly: 'Month' } as Record<string, string>)[step1.payment_term] ?? 'Period';
  const hasCollateral = !!step1.collateral_type;

  const visibleDocs   = REQUIRED_DOCS.filter(d => d.key !== 'collateralProof' || hasCollateral);
  const requiredCount = visibleDocs.filter(d => d.required || (d.key === 'collateralProof' && hasCollateral)).length;
  const attachedCount = visibleDocs.filter(d => !!files[d.key]).length;

  return (
    <div className="min-h-screen bg-background pb-12">
      <TopBar title="Co-maker & Documents" />

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
          {[
            ['Principal',    `₱${step1.principal_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
            ['Term',         `${step1.payment_term.replace('_', '-')} · ${step1.term_months} months`],
            ['Rate',         `${step1.interest_rate}% / ${termLabel.toLowerCase()}`],
            ['Est. Total',   `₱${estTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
            [`Est. / ${termLabel}`, `₱${perPeriod.toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm">
              <span className="text-on-surface-variant">{k}</span>
              <span className={`font-bold ${k === 'Est. Total' ? 'text-primary' : 'text-on-surface'}`}>{v}</span>
            </div>
          ))}
        </div>

        {/* Co-maker Personal Info */}
        <section className="space-y-5 mb-8">
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 bg-primary rounded-full" />
            <h2 className="font-headline font-bold text-lg text-on-surface">Co-maker Info</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" placeholder="Juan" value={formData.first_name}
              onChange={e => handleChange('first_name', e.target.value)} error={errors.first_name} />
            <Input label="Last Name" placeholder="Dela Cruz" value={formData.last_name}
              onChange={e => handleChange('last_name', e.target.value)} error={errors.last_name} />
          </div>
          <Input label="Contact No." placeholder="09XXXXXXXXX" value={formData.contact_no}
            onChange={e => handleChange('contact_no', e.target.value)} error={errors.contact_no} />
          <Input label="Email (Optional)" placeholder="juan@example.com" type="email"
            value={formData.email} onChange={e => handleChange('email', e.target.value)} />
        </section>

        {/* Co-maker Address */}
        <section className="space-y-5 mb-8">
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 bg-primary rounded-full" />
            <h2 className="font-headline font-bold text-lg text-on-surface">Co-maker Address</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Province" placeholder="Province" value={formData.province}
              onChange={e => handleChange('province', e.target.value)} error={errors.province} />
            <Input label="City" placeholder="City" value={formData.city}
              onChange={e => handleChange('city', e.target.value)} error={errors.city} />
          </div>
          <Input label="Barangay" placeholder="Brgy. San Jose" value={formData.barangay}
            onChange={e => handleChange('barangay', e.target.value)} error={errors.barangay} />
          <Input label="Street" placeholder="House No., Street" value={formData.street}
            onChange={e => handleChange('street', e.target.value)} error={errors.street} />
        </section>

        {/* Required Documents */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-6 bg-primary rounded-full" />
              <h2 className="font-headline font-bold text-lg text-on-surface">Documents</h2>
            </div>
            <span className="text-xs font-bold text-primary tabular-nums">
              {attachedCount}/{requiredCount} attached
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mb-4 leading-relaxed">
            Clear photos or scans. Max 5MB per file. JPG, PNG, or PDF.
          </p>
          <div className="space-y-3">
            {visibleDocs.map(({ key, label, desc, icon, required }) => {
              const isRequired = required || (key === 'collateralProof' && hasCollateral);
              const attached   = !!files[key];
              const fieldError = errors[`file_${key}`];
              return (
                <div key={key} className={[
                  'p-4 rounded-2xl border transition-all',
                  attached   ? 'bg-primary/5 border-primary/20' :
                  fieldError ? 'bg-red-500/5 border-red-500/20' :
                               'bg-surface-container-low border-outline-variant/10',
                ].join(' ')}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${attached ? 'bg-primary/10' : 'bg-surface-container-high'}`}>
                        {icon}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-on-surface">{label}</p>
                          {isRequired
                            ? <span className="text-[9px] font-bold uppercase tracking-wider text-error bg-error/10 px-1.5 py-0.5 rounded-full">Required</span>
                            : <span className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant bg-surface-container-high px-1.5 py-0.5 rounded-full">Optional</span>
                          }
                        </div>
                        <p className="text-[11px] text-on-surface-variant mt-0.5">{desc}</p>
                        {fieldError && <p className="text-[11px] text-red-500 mt-1 font-medium">{fieldError}</p>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <input type="file" accept="image/*,application/pdf"
                        style={{ display: 'none' }} id={`${key}Upload`}
                        onChange={e => handleFileChange(e, key)} />
                      <label htmlFor={`${key}Upload`} className={[
                        'text-[10px] font-bold px-3 py-2 rounded-lg uppercase tracking-wider cursor-pointer transition-all',
                        attached ? 'bg-primary text-on-primary shadow-md shadow-primary/20' : 'bg-primary/10 text-primary',
                      ].join(' ')}>
                        {attached ? 'CHANGE' : 'UPLOAD'}
                      </label>
                      {attached && <span className="text-[10px] text-primary font-semibold">✓ Attached</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {submitError && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-red-500 text-sm font-medium">{submitError}</p>
          </div>
        )}

        <footer className="mt-4 mb-8 space-y-4">
          <Button onClick={handleReview} disabled={submitting}>
            {submitting ? 'Submitting…' : 'REVIEW & SUBMIT'}
          </Button>
          <div className="flex flex-col items-center">
            <button onClick={() => navigate('/apply')} disabled={submitting}
              className="text-on-surface-variant hover:text-primary transition-colors text-sm font-medium">
              ← Back to Step 1
            </button>
            <div className="w-12 h-1 bg-surface-container-highest rounded-full mt-2" />
          </div>
        </footer>
      </main>

      {/* Confirmation bottom sheet */}
      <AnimatePresence>
        {showConfirm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowConfirm(false)}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, y: 80 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 80 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-surface-container-low rounded-t-[2rem] shadow-2xl border-t border-white/5 max-w-md mx-auto max-h-[85vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="w-10 h-1 bg-outline/30 rounded-full mx-auto mb-6" />
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <FileText size={24} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-headline font-bold text-xl text-on-surface">Application Overview</h3>
                    <p className="text-on-surface-variant text-xs">Please review before submitting</p>
                  </div>
                </div>

                {/* Loan row list */}
                <div className="mb-4 p-4 bg-primary/5 border border-primary/10 rounded-2xl space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">Loan Details</p>
                  {[
                    ['Principal',    `₱${step1.principal_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
                    ['Term',         `${step1.payment_term.replace('_', '-')} · ${step1.term_months} months`],
                    ['Rate',         `${step1.interest_rate}% / ${termLabel.toLowerCase()}`],
                    ['Collateral',   step1.collateral_type || 'None'],
                    ['Payout via',   step1.payout_method],
                    ['Release',      step1.release_channel],
                    ['Interest',     `+₱${(estTotal - step1.principal_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
                    ['Total Payable',`₱${estTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
                    [`Est. / ${termLabel}`, `₱${perPeriod.toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-on-surface-variant">{k}</span>
                      <span className={`font-bold ${k === 'Total Payable' ? 'text-primary text-base' : k === 'Interest' ? 'text-warning' : 'text-on-surface'}`}>{v}</span>
                    </div>
                  ))}
                </div>

                {/* Co-maker */}
                <div className="mb-4 p-4 bg-surface-container-high rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <User size={13} className="text-on-surface-variant" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Co-maker</p>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">Name</span>
                    <span className="font-bold text-on-surface">{formData.first_name} {formData.last_name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">Contact</span>
                    <span className="font-bold font-mono text-on-surface">{formData.contact_no}</span>
                  </div>
                </div>

                {/* Address */}
                <div className="mb-4 p-4 bg-surface-container-high rounded-2xl">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin size={13} className="text-on-surface-variant" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Address</p>
                  </div>
                  <p className="text-sm font-semibold text-on-surface leading-relaxed">
                    {formData.street}, {formData.barangay}, {formData.city}, {formData.province}
                  </p>
                </div>

                {/* Documents checklist */}
                <div className="mb-4 p-4 bg-surface-container-high rounded-2xl">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                    Documents ({attachedCount} attached)
                  </p>
                  <div className="space-y-1.5">
                    {visibleDocs.map(d => (
                      <div key={d.key} className="flex items-center gap-2 text-sm">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${files[d.key] ? 'bg-primary' : 'bg-outline/40'}`} />
                        <span className={files[d.key] ? 'text-on-surface font-medium' : 'text-on-surface-variant'}>{d.label}</span>
                        {files[d.key] && <span className="ml-auto text-[10px] text-primary font-semibold">✓</span>}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 p-3 bg-orange-500/5 border border-orange-500/10 rounded-xl mb-5">
                  <AlertTriangle size={15} className="text-orange-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    By submitting, you confirm all provided information is accurate and agree to the cooperative's loan terms.
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

      {/* Loading / Success overlay */}
      <AnimatePresence>
        {successStep !== 'idle' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-background flex flex-col items-center justify-center px-8">

            {successStep === 'loading' && (
              <motion.div key="loading"
                initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
                className="flex flex-col items-center gap-6">
                <div className="relative w-24 h-24 flex items-center justify-center">
                  <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
                    transition={{ duration: 1.6, repeat: Infinity }}
                    className="absolute inset-0 rounded-full bg-primary/20" />
                  <svg className="absolute inset-0 w-full h-full animate-spin" viewBox="0 0 96 96">
                    <circle cx="48" cy="48" r="40" fill="none" stroke="currentColor" strokeWidth="4"
                      strokeLinecap="round" strokeDasharray="180 72" className="text-primary" />
                  </svg>
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <FileText size={26} className="text-primary" />
                  </div>
                </div>
                <div className="text-center space-y-1">
                  <p className="font-headline font-bold text-xl text-on-surface">Submitting Application</p>
                  <p className="text-on-surface-variant text-sm">Please wait a moment…</p>
                </div>
                <div className="flex gap-2">
                  {[0,1,2].map(i => (
                    <motion.div key={i} className="w-2 h-2 rounded-full bg-primary"
                      animate={{ opacity: [0.3,1,0.3], y: [0,-6,0] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
                  ))}
                </div>
              </motion.div>
            )}

            {successStep === 'done' && (
              <motion.div key="done"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center gap-6 text-center max-w-xs">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                  className="w-24 h-24 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center">
                  <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.2 }}>
                    <CheckCircle2 size={48} className="text-primary" />
                  </motion.div>
                </motion.div>
                <div className="space-y-2">
                  <h2 className="font-headline font-extrabold text-2xl text-on-surface">Application Submitted!</h2>
                  {loanResult && (
                    <p className="text-xs font-mono text-primary/80 bg-primary/5 px-3 py-1.5 rounded-lg inline-block">
                      Ref: {loanResult.referenceno}
                    </p>
                  )}
                  <p className="text-on-surface-variant text-sm leading-relaxed mt-2">
                    Your loan application is now pending review by the cooperative. You'll be notified once a decision is made.
                  </p>
                </div>
                <div className="w-full flex flex-col gap-3 pt-2">
                  <button onClick={() => navigate('/dashboard', { replace: true })}
                    className="w-full py-4 rounded-full bg-primary text-on-primary font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-primary/20">
                    <LayoutDashboard size={18} /> Go to Dashboard
                  </button>
                  <button onClick={() => navigate('/loans', { replace: true })}
                    className="w-full py-4 rounded-full bg-surface-container-highest text-on-surface font-bold text-sm active:scale-95 transition-transform">
                    View My Loans
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
