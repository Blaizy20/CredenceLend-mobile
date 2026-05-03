import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle2, User, MapPin, FileText,
  LayoutDashboard, Briefcase, Calendar, Wallet, ChevronDown,
  Upload, ClipboardList, XCircle, RefreshCw,
} from 'lucide-react';
import { TopBar }  from '../components/TopBar';
import { Button }  from '../components/Button';
import { Input }   from '../components/Input';
import { loansAPI } from '../lib/api';
import { motion, AnimatePresence } from 'motion/react';
import type { Step1Payload } from './ApplyLoanStep1';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CoMakerForm {
  full_name:     string;
  phone_number:  string;
  relationship:  string;
  email:         string;
  address:       string;
  notes:         string;
}

interface BorrowerForm {
  birthday:       string;
  occupation:     string;
  monthly_income: string;
  notes:          string;
}

// API contract response shape
interface LoanApplyResponse {
  success:               boolean;
  message:               string;
  data?: {
    loan_id:               number;
    reference_no:          string;
    status:                'PENDING' | 'DENIED' | 'ACTIVE';
    next_queue:            string;
    ci_required:           boolean;
    requires_collateral:   boolean;
    missing_requirements:  string[];
    instant_mode:          string;
    instant_reason:        string;
    message:               string;
  };
  error_code?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const INSTANT_REASON_MESSAGES: Record<string, { title: string; body: string; type: 'pending' | 'denied' }> = {
  AUTO_PASSED_AWAITING_REQUIREMENTS: {
    title: 'Application Received',
    body:  'Your application passed initial checks. Please upload the required documents below to proceed to manager review.',
    type:  'pending',
  },
  AUTO_PASSED_MANAGER_REVIEW_REQUIRED: {
    title: 'Pending Manager Review',
    body:  'Your application looks good and is now awaiting final review by the manager.',
    type:  'pending',
  },
  CI_REVIEW_REQUIRED: {
    title: 'Pending CI Review',
    body:  'Your application has been queued for credit investigation before manager review.',
    type:  'pending',
  },
  AMOUNT_EXCEEDS_AFFORDABILITY: {
    title: 'Application Denied',
    body:  'Unfortunately, the requested amount exceeds your estimated affordability based on the information provided.',
    type:  'denied',
  },
};

const REQUIREMENT_LABELS: Record<string, string> = {
  PROOF_OF_BILLING:  'Proof of Billing',
  PROOF_OF_INCOME:   'Proof of Income',
  VALID_ID:          'Valid ID',
  COMAKER_INFO:      'Co-maker Information',
  COMAKER_ID:        'Co-maker Valid ID',
  COLLATERAL_PROOF:  'Collateral Proof',
  COLLATERAL_TYPE:   'Collateral Type Document',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function ApplyLoanStep2() {
  const navigate = useNavigate();
  const location = useLocation();
  const step1    = location.state?.step1 as Step1Payload | undefined;

  React.useEffect(() => {
    if (!step1) navigate('/apply', { replace: true });
  }, [step1]);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [borrower, setBorrower] = useState<BorrowerForm>({
    birthday:       '',
    occupation:     '',
    monthly_income: '',
    notes:          '',
  });

  const [coMaker, setCoMaker] = useState<CoMakerForm>({
    full_name:    '',
    phone_number: '',
    relationship: '',
    email:        '',
    address:      '',
    notes:        '',
  });

  const [errors,      setErrors]      = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ── Post-submit state ────────────────────────────────────────────────────────
  type ScreenState = 'idle' | 'loading' | 'success' | 'denied' | 'error';
  const [screen,      setScreen]      = useState<ScreenState>('idle');
  const [loanResult,  setLoanResult]  = useState<LoanApplyResponse['data'] | null>(null);

  // ── Validation ───────────────────────────────────────────────────────────────
  const validate = () => {
    const e: Record<string, string> = {};

    // Borrower fields
    if (!borrower.birthday)
      e.birthday = 'Date of birth is required.';
    if (!borrower.occupation.trim())
      e.occupation = 'Occupation is required.';
    const income = Number(borrower.monthly_income);
    if (!borrower.monthly_income || isNaN(income) || income < 0)
      e.monthly_income = 'Please enter a valid monthly income.';

    // Co-maker fields
    if (!coMaker.full_name.trim())
      e.cm_full_name = 'Co-maker full name is required.';
    if (!coMaker.phone_number.trim())
      e.cm_phone_number = 'Co-maker contact number is required.';
    else if (!/^09\d{9}$/.test(coMaker.phone_number))
      e.cm_phone_number = 'Enter a valid PH number (09XXXXXXXXX).';
    if (!coMaker.relationship.trim())
      e.cm_relationship = 'Relationship is required.';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleBorrowerChange = (field: keyof BorrowerForm, value: string) => {
    setBorrower(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
    if (submitError)   setSubmitError('');
  };

  const handleCoMakerChange = (field: keyof CoMakerForm, value: string) => {
    setCoMaker(prev => ({ ...prev, [field]: value }));
    const eKey = `cm_${field}`;
    if (errors[eKey]) setErrors(prev => ({ ...prev, [eKey]: '' }));
    if (submitError)  setSubmitError('');
  };

  const handleReview = () => {
    if (!validate()) return;
    setShowConfirm(true);
  };

  const handleSubmit = async () => {
    if (!step1) return;

    let token: string | null = null;
    try { token = localStorage.getItem('token'); } catch {}
    if (!token) { navigate('/login', { replace: true }); return; }

    setSubmitting(true);
    setSubmitError('');
    setShowConfirm(false);
    setScreen('loading');

    try {
      // Build payload exactly matching the API contract
      const payload = {
        principal_amount:  step1.principal_amount,
        payment_term:      step1.payment_term,
        term_months:       step1.term_months,
        interest_rate:     step1.interest_rate,
        release_channel:   step1.release_channel,
        payout_method:     step1.payout_method,
        collateral_type:   step1.collateral_type,
        collateral_notes:  step1.collateral_notes,
        birthday:          borrower.birthday         || undefined,
        occupation:        borrower.occupation.trim() || undefined,
        monthly_income:    borrower.monthly_income ? Number(borrower.monthly_income) : undefined,
        notes:             borrower.notes.trim()     || undefined,
        comakers: [{
          full_name:    coMaker.full_name.trim(),
          phone_number: coMaker.phone_number.trim(),
          relationship: coMaker.relationship.trim(),
          email:        coMaker.email.trim()    || undefined,
          address:      coMaker.address.trim()  || undefined,
          notes:        coMaker.notes.trim()    || undefined,
        }],
      };

      const result: LoanApplyResponse = await loansAPI.applyLoan(payload);

      if (!result.success || !result.data) {
        // Handle specific error codes from API contract
        const code = result.error_code ?? '';
        if (code === 'UNPAID_LOANS_EXIST') {
          setSubmitError('You already have an active or pending loan. You cannot apply for a new one at this time.');
        } else if (code === 'INVALID_AMOUNT') {
          setSubmitError('The loan amount is invalid. Please go back to Step 1 and correct it.');
        } else if (code === 'INVALID_TERM') {
          setSubmitError('The loan term is invalid. Please go back to Step 1 and correct it.');
        } else if (code === 'CUSTOMER_NOT_FOUND') {
          setSubmitError('Your profile was not found. Please contact support.');
        } else if (code === 'TOKEN_MISSING' || code === 'AUTH_INVALID') {
          navigate('/login', { replace: true });
          return;
        } else {
          setSubmitError(result.message || 'Submission failed. Please try again.');
        }
        setScreen('error');
        setSubmitting(false);
        return;
      }

      setLoanResult(result.data);

      // Show correct screen based on status
      if (result.data.status === 'DENIED') {
        setScreen('denied');
      } else {
        setScreen('success');
      }
    } catch {
      setSubmitError('Unable to connect. Please check your internet connection and try again.');
      setScreen('error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!step1) return null;

  // ── Estimated payment for summary ─────────────────────────────────────────
  const estTotal   = step1.principal_amount * (1 + step1.interest_rate / 100);
  const estPayment = step1.term_months > 0 ? estTotal / step1.term_months : 0;
  const termLabel  = { daily: 'Day', weekly: 'Week', semi_monthly: 'Cycle', monthly: 'Month' }[step1.payment_term] ?? 'Period';

  // ── Instant reason message ───────────────────────────────────────────────
  const reasonMsg = loanResult
    ? INSTANT_REASON_MESSAGES[loanResult.instant_reason] ?? INSTANT_REASON_MESSAGES['AUTO_PASSED_AWAITING_REQUIREMENTS']
    : null;

  // ══════════════════════════════════════════════════════════════════════════
  // POST-SUBMIT SCREENS
  // ══════════════════════════════════════════════════════════════════════════

  if (screen === 'loading') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="fixed inset-0 z-[60] bg-background flex flex-col items-center justify-center px-8 gap-6">
        <div className="relative w-24 h-24 flex items-center justify-center">
          <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
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
          {[0, 1, 2].map(i => (
            <motion.div key={i} className="w-2 h-2 rounded-full bg-primary"
              animate={{ opacity: [0.3, 1, 0.3], y: [0, -6, 0] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
          ))}
        </div>
      </motion.div>
    );
  }

  if (screen === 'error') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="fixed inset-0 z-[60] bg-background flex flex-col items-center justify-center px-8 gap-6 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="w-24 h-24 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center">
          <XCircle size={48} className="text-red-500" />
        </motion.div>
        <div className="space-y-2 max-w-xs">
          <h2 className="font-headline font-extrabold text-2xl text-on-surface">Submission Failed</h2>
          <p className="text-on-surface-variant text-sm leading-relaxed">{submitError}</p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button onClick={() => { setScreen('idle'); setSubmitError(''); }}
            className="w-full py-4 rounded-full bg-primary text-on-primary font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform">
            <RefreshCw size={18} />
            Try Again
          </button>
          <button onClick={() => navigate('/apply', { replace: true })}
            className="w-full py-4 rounded-full bg-surface-container-highest text-on-surface font-bold text-sm active:scale-95 transition-transform">
            Back to Step 1
          </button>
        </div>
      </motion.div>
    );
  }

  if (screen === 'denied' && loanResult) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="fixed inset-0 z-[60] bg-background flex flex-col items-center justify-center px-8 gap-6 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="w-24 h-24 rounded-full bg-error/10 border-2 border-error/30 flex items-center justify-center">
          <XCircle size={48} className="text-error" />
        </motion.div>
        <div className="space-y-2 max-w-xs">
          <p className="text-[10px] font-bold tracking-widest uppercase text-error/70">{loanResult.reference_no}</p>
          <h2 className="font-headline font-extrabold text-2xl text-on-surface">Application Denied</h2>
          <p className="text-on-surface-variant text-sm leading-relaxed">
            {INSTANT_REASON_MESSAGES['AMOUNT_EXCEEDS_AFFORDABILITY']?.body ?? loanResult.message}
          </p>
        </div>
        <button onClick={() => navigate('/dashboard', { replace: true })}
          className="w-full max-w-xs py-4 rounded-full bg-primary text-on-primary font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform">
          <LayoutDashboard size={18} />
          Go to Dashboard
        </button>
      </motion.div>
    );
  }

  if (screen === 'success' && loanResult) {
    const missing = loanResult.missing_requirements ?? [];

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="min-h-screen bg-background pb-10">
        <div className="pt-16 px-6 max-w-md mx-auto">

          {/* Success icon */}
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
            className="mx-auto w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center mb-6">
            <CheckCircle2 size={40} className="text-primary" />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }} className="text-center mb-2">
            <h2 className="font-headline font-extrabold text-2xl text-on-surface">
              {reasonMsg?.title ?? 'Application Submitted!'}
            </h2>
            <p className="text-[10px] font-bold tracking-widest uppercase text-primary/60 mt-1">
              {loanResult.reference_no}
            </p>
          </motion.div>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="text-center text-on-surface-variant text-sm leading-relaxed mb-8 max-w-xs mx-auto">
            {reasonMsg?.body ?? loanResult.message}
          </motion.p>

          {/* Status badge */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="flex gap-3 p-4 bg-primary/5 border border-primary/10 rounded-2xl mb-8">
            <ClipboardList size={18} className="text-primary shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-primary uppercase tracking-wider">Application Status</p>
              <p className="text-sm font-semibold text-on-surface">{loanResult.status}</p>
              {loanResult.next_queue && (
                <p className="text-xs text-on-surface-variant">Next: {loanResult.next_queue.replace(/_/g, ' ')}</p>
              )}
            </div>
          </motion.div>

          {/* Required documents checklist */}
          {missing.length > 0 && (
            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }} className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-5 bg-primary rounded-full" />
                <h3 className="font-headline font-bold text-base text-on-surface">
                  Required Documents
                </h3>
              </div>
              <p className="text-xs text-on-surface-variant mb-4 leading-relaxed">
                Upload the following to complete your application. Manager approval is blocked until all required documents are submitted.
              </p>
              <div className="space-y-3">
                {missing.map((code, i) => (
                  <motion.div key={code}
                    initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.06 }}
                    className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl border border-outline-variant/10">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-warning shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-on-surface">
                          {REQUIREMENT_LABELS[code] ?? code}
                        </p>
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">{code}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`/loans/${loanResult.loan_id}/documents`, {
                        state: { requirement_code: code, loan_id: loanResult.loan_id }
                      })}
                      className="flex items-center gap-1.5 bg-primary/10 text-primary text-[10px] font-bold px-3 py-2 rounded-lg uppercase tracking-wider active:scale-95 transition-transform">
                      <Upload size={12} />
                      Upload
                    </button>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          )}

          {/* Actions */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }} className="flex flex-col gap-3">
            <button onClick={() => navigate('/dashboard', { replace: true })}
              className="w-full py-4 rounded-full bg-primary text-on-primary font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-primary/20">
              <LayoutDashboard size={18} />
              Go to Dashboard
            </button>
            <button onClick={() => navigate(`/loans/${loanResult.loan_id}`)}
              className="w-full py-4 rounded-full bg-surface-container-highest text-on-surface font-bold text-sm active:scale-95 transition-transform">
              View Loan Details
            </button>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN FORM (screen === 'idle')
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-background pb-12">
      <TopBar title="Borrower & Co-maker" />

      <main className="pt-24 px-6 max-w-md mx-auto">

        {/* ── Progress ───────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">STEP 2 OF 2</span>
            <div className="h-[2px] flex-grow bg-surface-container-highest overflow-hidden rounded-full">
              <div className="h-full w-full bg-primary rounded-full" />
            </div>
          </div>
          <h2 className="text-3xl font-headline font-extrabold text-on-surface">Your Details</h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Borrower information and co-maker details.
          </p>
        </div>

        {/* ── Loan Summary ───────────────────────────────────────────────── */}
        <div className="mb-8 p-4 bg-surface-container-high rounded-2xl space-y-2 border border-outline-variant/10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Loan Summary</p>
          <div className="flex justify-between text-sm">
            <span className="text-on-surface-variant">Amount</span>
            <span className="font-bold text-on-surface">
              ₱{step1.principal_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-on-surface-variant">Term</span>
            <span className="font-bold text-on-surface capitalize">
              {step1.payment_term.replace('_', '-')} · {step1.term_months} months
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-on-surface-variant">Interest</span>
            <span className="font-bold text-primary">{step1.interest_rate}%</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-on-surface-variant">Payout</span>
            <span className="font-bold text-on-surface">{step1.payout_method}</span>
          </div>
          <div className="border-t border-outline-variant/10 pt-2 flex justify-between text-sm">
            <span className="text-on-surface-variant">Est. per {termLabel}</span>
            <span className="font-extrabold text-primary">
              ₱{estPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* ── Borrower Information ───────────────────────────────────────── */}
        <section className="space-y-5 mb-10">
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 bg-primary rounded-full" />
            <h2 className="font-headline font-bold text-lg text-on-surface">
              Borrower Information
            </h2>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-bold tracking-widest text-on-surface-variant uppercase ml-1">
              DATE OF BIRTH
            </label>
            <div className="relative">
              <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
              <input
                type="date"
                value={borrower.birthday}
                onChange={e => handleBorrowerChange('birthday', e.target.value)}
                max={new Date(Date.now() - 18 * 365.25 * 86400000).toISOString().split('T')[0]}
                className="w-full bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/50 rounded-xl py-4 pl-10 pr-4 text-on-surface font-medium transition-all"
              />
            </div>
            {errors.birthday && <p className="text-xs text-error ml-1">{errors.birthday}</p>}
          </div>

          <Input
            label="OCCUPATION"
            placeholder="e.g. Store Clerk, Teacher, Driver"
            icon={<Briefcase size={16} className="text-on-surface-variant" />}
            value={borrower.occupation}
            onChange={e => handleBorrowerChange('occupation', e.target.value)}
            error={errors.occupation}
          />

          <Input
            label="MONTHLY INCOME"
            placeholder="0.00"
            type="number"
            inputMode="decimal"
            icon={<Wallet size={16} className="text-on-surface-variant" />}
            value={borrower.monthly_income}
            onChange={e => handleBorrowerChange('monthly_income', e.target.value)}
            error={errors.monthly_income}
          />
          <p className="text-xs text-on-surface-variant -mt-3 ml-1">
            Used for affordability assessment
          </p>

          <div className="space-y-2">
            <label className="block text-[10px] font-bold tracking-widest text-on-surface-variant uppercase ml-1">
              NOTES <span className="text-outline normal-case font-normal tracking-normal">— optional</span>
            </label>
            <textarea
              rows={2}
              placeholder="Any additional notes for this application…"
              value={borrower.notes}
              onChange={e => handleBorrowerChange('notes', e.target.value)}
              className="w-full bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/50 rounded-xl py-3 px-4 text-on-surface text-sm font-medium transition-all resize-none"
            />
          </div>
        </section>

        {/* ── Co-maker ───────────────────────────────────────────────────── */}
        <section className="space-y-5 mb-10">
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 bg-primary rounded-full" />
            <h2 className="font-headline font-bold text-lg text-on-surface">Co-maker Details</h2>
          </div>

          <Input
            label="FULL NAME"
            placeholder="e.g. Maria Santos"
            icon={<User size={16} className="text-on-surface-variant" />}
            value={coMaker.full_name}
            onChange={e => handleCoMakerChange('full_name', e.target.value)}
            error={errors.cm_full_name}
          />

          <Input
            label="CONTACT NUMBER"
            placeholder="09XXXXXXXXX"
            type="tel"
            inputMode="tel"
            value={coMaker.phone_number}
            onChange={e => handleCoMakerChange('phone_number', e.target.value)}
            error={errors.cm_phone_number}
          />

          <Input
            label="RELATIONSHIP TO BORROWER"
            placeholder="e.g. Sister, Spouse, Friend"
            value={coMaker.relationship}
            onChange={e => handleCoMakerChange('relationship', e.target.value)}
            error={errors.cm_relationship}
          />

          <Input
            label="EMAIL ADDRESS"
            placeholder="comaker@email.com"
            type="email"
            value={coMaker.email}
            onChange={e => handleCoMakerChange('email', e.target.value)}
          />
          <p className="text-xs text-on-surface-variant -mt-3 ml-1">Optional</p>

          <div className="space-y-2">
            <label className="block text-[10px] font-bold tracking-widest text-on-surface-variant uppercase ml-1">
              ADDRESS <span className="text-outline normal-case font-normal tracking-normal">— optional</span>
            </label>
            <div className="relative">
              <MapPin size={16} className="absolute left-4 top-3.5 text-on-surface-variant pointer-events-none" />
              <textarea
                rows={2}
                placeholder="House No., Street, Barangay, City, Province"
                value={coMaker.address}
                onChange={e => handleCoMakerChange('address', e.target.value)}
                className="w-full bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/50 rounded-xl py-3 pl-10 pr-4 text-on-surface text-sm font-medium transition-all resize-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-bold tracking-widest text-on-surface-variant uppercase ml-1">
              NOTES <span className="text-outline normal-case font-normal tracking-normal">— optional</span>
            </label>
            <textarea
              rows={2}
              placeholder="Any notes about the co-maker…"
              value={coMaker.notes}
              onChange={e => handleCoMakerChange('notes', e.target.value)}
              className="w-full bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/50 rounded-xl py-3 px-4 text-on-surface text-sm font-medium transition-all resize-none"
            />
          </div>
        </section>

        {submitError && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-red-500 text-sm font-medium">{submitError}</p>
          </div>
        )}

        {/* ── Actions ────────────────────────────────────────────────────── */}
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

      {/* ── Confirmation Bottom Sheet ──────────────────────────────────────── */}
      <AnimatePresence>
        {showConfirm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowConfirm(false)}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, y: 80 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 80 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-surface-container-low rounded-t-[2rem] shadow-2xl border-t border-white/5 max-w-md mx-auto max-h-[85vh] overflow-y-auto">
              <div className="p-6">
                <div className="w-10 h-1 bg-outline/30 rounded-full mx-auto mb-6" />

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
                  {[
                    ['Amount',    `₱${step1.principal_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
                    ['Term',      `${step1.payment_term.replace('_', '-')} · ${step1.term_months} months`],
                    ['Interest',  `${step1.interest_rate}%`],
                    ['Payout',    step1.payout_method],
                    ['Channel',   step1.release_channel],
                    ['Collateral',step1.collateral_type],
                    ['Est. per ' + termLabel, `₱${estPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-on-surface-variant">{k}</span>
                      <span className="font-bold text-on-surface">{v}</span>
                    </div>
                  ))}
                </div>

                {/* Borrower */}
                <div className="mb-5 p-4 bg-surface-container-high rounded-2xl space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">Borrower</p>
                  {[
                    ['Birthday',   borrower.birthday],
                    ['Occupation', borrower.occupation],
                    ['Income',     borrower.monthly_income ? `₱${Number(borrower.monthly_income).toLocaleString()}` : '—'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-on-surface-variant">{k}</span>
                      <span className="font-semibold text-on-surface">{v || '—'}</span>
                    </div>
                  ))}
                </div>

                {/* Co-maker */}
                <div className="mb-6 p-4 bg-surface-container-high rounded-2xl space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">Co-maker</p>
                  {[
                    ['Name',         coMaker.full_name],
                    ['Contact',      coMaker.phone_number],
                    ['Relationship', coMaker.relationship],
                    ['Email',        coMaker.email || '—'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-on-surface-variant">{k}</span>
                      <span className="font-semibold text-on-surface">{v}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 p-3 bg-orange-500/5 border border-orange-500/10 rounded-xl mb-6">
                  <AlertTriangle size={16} className="text-orange-500 shrink-0 mt-0.5" />
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
    </div>
  );
}
