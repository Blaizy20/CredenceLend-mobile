import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ArrowRight, ChevronDown } from 'lucide-react';
import { TopBar }  from '../components/TopBar';
import { Button }  from '../components/Button';
import { Input }   from '../components/Input';

// ── API-contract enums ────────────────────────────────────────────────────────
const TERM_OPTIONS: {
  label: string; sublabel: string; value: string; rate: number; period: string;
}[] = [
  { label: 'Daily',        sublabel: '2.75% flat interest rate per day',   value: 'daily',        rate: 2.75, period: 'Day'   },
  { label: 'Weekly',       sublabel: '3% flat interest rate per week',      value: 'weekly',       rate: 3.0,  period: 'Week'  },
  { label: 'Semi-monthly', sublabel: '3.5% flat interest rate per cycle',   value: 'semi_monthly', rate: 3.5,  period: 'Cycle' },
  { label: 'Monthly',      sublabel: '4% flat interest rate per month',     value: 'monthly',      rate: 4.0,  period: 'Month' },
];

const PAYOUT_METHODS = ['GCASH', 'BANK', 'CASH'];
const MAX_TERM_MONTHS = 60; // 5 years max — reasonable for cooperative lending

// ── Types ─────────────────────────────────────────────────────────────────────
export interface Step1Payload {
  principal_amount: number;
  payment_term:     string;
  term_months:      number;
  interest_rate:    number;
  release_channel:  'ONLINE' | 'WALK_IN';
  payout_method:    string;
  collateral_type:  string;
  collateral_notes: string;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ApplyLoanStep1() {
  const navigate = useNavigate();

  const [termValue,      setTermValue]      = useState('semi_monthly');
  const [releaseChannel, setReleaseChannel] = useState<'ONLINE' | 'WALK_IN'>('ONLINE');
  const [payoutMethod,   setPayoutMethod]   = useState('GCASH');
  const [termOpen,       setTermOpen]       = useState(false);

  const [formData, setFormData] = useState({
    amount:           '',
    term_months:      '',
    collateral_type:  '',
    collateral_notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedTerm = TERM_OPTIONS.find(t => t.value === termValue) ?? TERM_OPTIONS[2];

  // Simple interest: total = principal × (1 + rate/100 × months)
  const amt        = Number(formData.amount)      || 0;
  const months     = Number(formData.term_months) || 0;
  const estTotal   = months > 0 && amt > 0 ? amt * (1 + (selectedTerm.rate / 100) * months) : 0;
  const estPayment = months > 0 ? estTotal / months : 0;
  const estInterest = estTotal - amt;

  const validate = () => {
    const newErrors: Record<string, string> = {};
    const a  = Number(formData.amount);
    const mo = Number(formData.term_months);

    if (!formData.amount || isNaN(a) || a <= 0)
      newErrors.amount = 'Please enter a valid loan amount.';
    else if (a < 1000)
      newErrors.amount = 'Minimum loan amount is ₱1,000.';
    else if (a > 500000)
      newErrors.amount = 'Maximum loan amount is ₱500,000.';

    if (!formData.term_months || isNaN(mo) || mo < 1)
      newErrors.term_months = 'Please enter the number of months (minimum 1).';
    else if (mo > MAX_TERM_MONTHS)
      newErrors.term_months = `Maximum loan term is ${MAX_TERM_MONTHS} months (5 years).`;

    if (!formData.collateral_type.trim())
      newErrors.collateral_type = 'Please specify a collateral type.';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validate()) return;
    const payload: Step1Payload = {
      principal_amount: Number(formData.amount),
      payment_term:     termValue,
      term_months:      Number(formData.term_months),
      interest_rate:    selectedTerm.rate,
      release_channel:  releaseChannel,
      payout_method:    payoutMethod,
      collateral_type:  formData.collateral_type.trim(),
      collateral_notes: formData.collateral_notes.trim(),
    };
    navigate('/apply/step2', { state: { step1: payload } });
  };

  return (
    <div
      className="min-h-screen bg-background pb-36"
      onClick={() => termOpen && setTermOpen(false)}
    >
      <TopBar
        title=""
        showBack={false}
        rightElement={
          <button onClick={() => navigate('/dashboard')} className="p-2 text-primary">
            <X size={24} />
          </button>
        }
      />

      <main className="pt-24 px-6 max-w-md mx-auto">

        {/* ── Progress ───────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">STEP 1 OF 2</span>
            <div className="h-[2px] flex-grow bg-surface-container-highest overflow-hidden rounded-full">
              <div className="h-full w-1/2 bg-primary rounded-full" />
            </div>
          </div>
          <h2 className="text-3xl font-headline font-extrabold text-on-surface">Loan Details</h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Fill in your loan details. Documents will be uploaded after submission.
          </p>
        </div>

        {/* ── Loan Amount & Term ─────────────────────────────────────────── */}
        <section className="space-y-5 mb-10">
          <h3 className="text-xs font-bold tracking-wider text-primary/80 uppercase">
            Loan Amount & Term
          </h3>

          <Input
            label="REQUESTED AMOUNT"
            placeholder="0.00"
            type="number"
            inputMode="decimal"
            icon={<span className="font-bold text-lg">₱</span>}
            className="text-xl font-bold"
            value={formData.amount}
            onChange={(e) => {
              setFormData(f => ({ ...f, amount: e.target.value }));
              if (errors.amount) setErrors(p => ({ ...p, amount: '' }));
            }}
            error={errors.amount}
          />
          <p className="text-xs text-on-surface-variant -mt-3 ml-1">
            Minimum: ₱1,000 · Maximum: ₱500,000
          </p>

          {/* ── Custom Payment Term Dropdown ─────────────────────────────── */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold tracking-widest text-on-surface-variant uppercase ml-1">
              PAYMENT TERM
            </label>

            {/* FIX: relative wrapper so the panel is scoped to THIS element */}
            <div className="relative" onClick={e => e.stopPropagation()}>
              {/* Trigger */}
              <button
                type="button"
                onClick={() => setTermOpen(o => !o)}
                className="w-full flex items-center justify-between bg-surface-container-highest rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/50 transition-all"
              >
                <div className="text-left">
                  <p className="font-bold text-on-surface text-sm">{selectedTerm.label}</p>
                  <p className="text-[11px] text-primary font-semibold mt-0.5">{selectedTerm.sublabel}</p>
                </div>
                <ChevronDown
                  size={16}
                  className={`text-on-surface-variant transition-transform duration-200 shrink-0 ml-2 ${termOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Dropdown panel — now correctly anchored below the trigger */}
              {termOpen && (
                <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-surface-container-low rounded-2xl shadow-2xl border border-outline-variant/10 overflow-hidden">
                  {TERM_OPTIONS.map((t, i) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => { setTermValue(t.value); setTermOpen(false); }}
                      className={[
                        'w-full flex items-center justify-between px-5 py-4 transition-colors text-left',
                        i < TERM_OPTIONS.length - 1 ? 'border-b border-outline-variant/10' : '',
                        t.value === termValue ? 'bg-primary/[0.08]' : 'hover:bg-surface-container-high',
                      ].join(' ')}
                    >
                      <div>
                        <p className={`text-sm font-bold ${t.value === termValue ? 'text-primary' : 'text-on-surface'}`}>
                          {t.label}
                        </p>
                        <p className={`text-[11px] mt-0.5 font-medium ${t.value === termValue ? 'text-primary/70' : 'text-on-surface-variant'}`}>
                          {t.sublabel}
                        </p>
                      </div>
                      {t.value === termValue && (
                        <div className="w-2 h-2 rounded-full bg-primary shrink-0 ml-3" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Term Months — max 60 */}
          <Input
            label="LOAN DURATION (MONTHS)"
            placeholder="e.g. 12"
            type="number"
            inputMode="numeric"
            value={formData.term_months}
            onChange={(e) => {
              setFormData(f => ({ ...f, term_months: e.target.value }));
              if (errors.term_months) setErrors(p => ({ ...p, term_months: '' }));
            }}
            error={errors.term_months}
          />
          <p className="text-xs text-on-surface-variant -mt-3 ml-1">
            Maximum: {MAX_TERM_MONTHS} months (5 years)
          </p>

          {/* Payment breakdown preview */}
          {estTotal > 0 && (
            <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70">
                Payment Breakdown
              </p>
              <div className="flex justify-between text-sm">
                <span className="text-on-surface-variant">Principal</span>
                <span className="font-semibold text-on-surface">
                  ₱{amt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-on-surface-variant">
                  Interest ({selectedTerm.rate}% × {months} {months === 1 ? 'month' : 'months'})
                </span>
                <span className="font-semibold text-warning">
                  +₱{estInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="border-t border-primary/10 pt-3 flex justify-between">
                <span className="text-sm font-bold text-on-surface">Total Payable</span>
                <span className="text-base font-extrabold text-primary">
                  ₱{estTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-sm pt-1">
                <span className="text-on-surface-variant">Est. per {selectedTerm.period}</span>
                <span className="font-bold text-on-surface">
                  ₱{estPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}
        </section>

        {/* ── Payout & Release ──────────────────────────────────────────────── */}
        <section className="space-y-5 mb-10">
          <h3 className="text-xs font-bold tracking-wider text-primary/80 uppercase">
            Payout & Release
          </h3>

          <div className="space-y-2">
            <label className="block text-[10px] font-bold tracking-widest text-on-surface-variant uppercase ml-1">
              PAYOUT METHOD
            </label>
            <div className="flex gap-3">
              {PAYOUT_METHODS.map(m => (
                <button key={m} type="button" onClick={() => setPayoutMethod(m)}
                  className={[
                    'flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all',
                    payoutMethod === m
                      ? 'bg-primary text-on-primary border-primary shadow-lg shadow-primary/20'
                      : 'bg-surface-container-highest text-on-surface-variant border-transparent hover:border-primary/30',
                  ].join(' ')}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-bold tracking-widest text-on-surface-variant uppercase ml-1">
              RELEASE CHANNEL
            </label>
            <div className="flex gap-3">
              {(['ONLINE', 'WALK_IN'] as const).map(ch => (
                <button key={ch} type="button" onClick={() => setReleaseChannel(ch)}
                  className={[
                    'flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all',
                    releaseChannel === ch
                      ? 'bg-primary text-on-primary border-primary shadow-lg shadow-primary/20'
                      : 'bg-surface-container-highest text-on-surface-variant border-transparent hover:border-primary/30',
                  ].join(' ')}>
                  {ch === 'WALK_IN' ? 'Walk-in' : 'Online'}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── Collateral (Optional) ──────────────────────────────────────────── */}
        <section className="space-y-5 mb-10">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold tracking-wider text-primary/80 uppercase">Collateral</h3>
            <span className="text-[10px] text-on-surface-variant font-normal">— optional, for higher loan amount</span>
          </div>

          <Input
            label="COLLATERAL TYPE"
            placeholder="e.g. ORCR, Real Estate, Jewelry"
            value={formData.collateral_type}
            onChange={(e) => {
              setFormData(f => ({ ...f, collateral_type: e.target.value }));
              if (errors.collateral_type) setErrors(p => ({ ...p, collateral_type: '' }));
            }}
            error={errors.collateral_type}
          />

          <Input
            label="COLLATERAL DESCRIPTION"
            placeholder="e.g. Honda Click 125, 2022 model"
            value={formData.collateral_notes}
            onChange={(e) => setFormData(f => ({ ...f, collateral_notes: e.target.value }))}
          />
        </section>

        {/* ── Note ──────────────────────────────────────────────────────────── */}
        <div className="mb-10 p-4 bg-surface-container-high rounded-2xl border border-outline-variant/10 flex gap-3">
          <span className="text-primary text-lg leading-none">ℹ</span>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Required documents (Valid ID, Proof of Billing, Co-maker ID, etc.) will be
            uploaded <span className="font-semibold text-on-surface">in the next step</span>.
          </p>
        </div>

        {/* ── Next Button ───────────────────────────────────────────────────── */}
        <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-background via-background/95 to-transparent flex justify-center">
          <div className="w-full max-w-md">
            <Button onClick={handleNext}>
              Next <ArrowRight size={20} />
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
