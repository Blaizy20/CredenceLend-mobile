import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ArrowRight, ChevronDown } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { Button } from '../components/Button';
import { Input } from '../components/Input';

// ── API-contract enums ────────────────────────────────────────────────────────
const TERM_OPTIONS: { label: string; value: string; rate: number }[] = [
  { label: 'Daily',        value: 'daily',        rate: 2.75 },
  { label: 'Weekly',       value: 'weekly',       rate: 3.0  },
  { label: 'Semi-monthly', value: 'semi_monthly', rate: 3.5  },
  { label: 'Monthly',      value: 'monthly',      rate: 4.0  },
];

const PAYOUT_METHODS = ['GCASH', 'BANK', 'CASH'];

// ── Types ─────────────────────────────────────────────────────────────────────
export interface Step1Payload {
  principal_amount:  number;
  payment_term:      string;   // 'daily' | 'weekly' | 'semi_monthly' | 'monthly'
  term_months:       number;
  interest_rate:     number;
  release_channel:   'ONLINE' | 'WALK_IN';
  payout_method:     string;
  collateral_type:   string;
  collateral_notes:  string;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ApplyLoanStep1() {
  const navigate = useNavigate();

  const [termValue,       setTermValue]       = useState('semi_monthly');
  const [releaseChannel,  setReleaseChannel]  = useState<'ONLINE' | 'WALK_IN'>('ONLINE');
  const [payoutMethod,    setPayoutMethod]    = useState('GCASH');

  const [formData, setFormData] = useState({
    amount:           '',
    term_months:      '',
    collateral_type:  '',
    collateral_notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedTerm = TERM_OPTIONS.find(t => t.value === termValue) ?? TERM_OPTIONS[2];

  // Live estimated payment preview
  const amt      = Number(formData.amount)     || 0;
  const months   = Number(formData.term_months) || 0;
  const estTotal = amt * (1 + selectedTerm.rate / 100);
  const estPayment = months > 0 ? estTotal / months : 0;

  const validate = () => {
    const newErrors: Record<string, string> = {};
    const amt = Number(formData.amount);

    if (!formData.amount || isNaN(amt) || amt <= 0)
      newErrors.amount = 'Please enter a valid loan amount.';
    else if (amt < 1000)
      newErrors.amount = 'Minimum loan amount is ₱1,000.';
    else if (amt > 500000)
      newErrors.amount = 'Maximum loan amount is ₱500,000.';

    const mo = Number(formData.term_months);
    if (!formData.term_months || isNaN(mo) || mo < 1)
      newErrors.term_months = 'Please enter the number of months (minimum 1).';
    else if (mo > 360)
      newErrors.term_months = 'Maximum term is 360 months.';

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
    <div className="min-h-screen bg-background pb-36">
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

        {/* ── Progress ─────────────────────────────────────────────────────── */}
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

        {/* ── Loan Amount & Term ────────────────────────────────────────────── */}
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
            onChange={(e) => setFormData(f => ({ ...f, amount: e.target.value }))}
            error={errors.amount}
          />
          <p className="text-xs text-on-surface-variant -mt-3 ml-1">
            Minimum: ₱1,000 · Maximum: ₱500,000
          </p>

          {/* Payment Term */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold tracking-widest text-on-surface-variant uppercase ml-1">
              PAYMENT TERM
            </label>
            <div className="relative">
              <select
                value={termValue}
                onChange={(e) => setTermValue(e.target.value)}
                className="w-full bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/50 rounded-xl py-4 px-4 pr-10 text-on-surface font-medium transition-all appearance-none"
              >
                {TERM_OPTIONS.map(t => (
                  <option key={t.value} value={t.value}>
                    {t.label} ({t.rate}% interest rate)
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            </div>
          </div>

          {/* Term Months — user controlled per API contract */}
          <Input
            label="LOAN DURATION (MONTHS)"
            placeholder="e.g. 12"
            type="number"
            inputMode="numeric"
            value={formData.term_months}
            onChange={(e) => setFormData(f => ({ ...f, term_months: e.target.value }))}
            error={errors.term_months}
          />
          <p className="text-xs text-on-surface-variant -mt-3 ml-1">
            Enter number of months (1–360)
          </p>

          {/* Estimated payment preview */}
          {estPayment > 0 && (
            <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl flex justify-between items-center">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70">
                  Est. Payment per {selectedTerm.label === 'Daily' ? 'Day' : selectedTerm.label === 'Weekly' ? 'Week' : selectedTerm.label === 'Semi-monthly' ? 'Cycle' : 'Month'}
                </p>
                <p className="text-2xl font-headline font-extrabold text-primary mt-0.5">
                  ₱{estPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Total</p>
                <p className="text-sm font-bold text-on-surface mt-0.5">
                  ₱{estTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-on-surface-variant">{formData.term_months} months</p>
              </div>
            </div>
          )}
        </section>

        {/* ── Payout & Release ─────────────────────────────────────────────── */}
        <section className="space-y-5 mb-10">
          <h3 className="text-xs font-bold tracking-wider text-primary/80 uppercase">
            Payout & Release
          </h3>

          {/* Payout Method */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold tracking-widest text-on-surface-variant uppercase ml-1">
              PAYOUT METHOD
            </label>
            <div className="flex gap-3">
              {PAYOUT_METHODS.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPayoutMethod(m)}
                  className={[
                    'flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all',
                    payoutMethod === m
                      ? 'bg-primary text-on-primary border-primary shadow-lg shadow-primary/20'
                      : 'bg-surface-container-highest text-on-surface-variant border-transparent hover:border-primary/30',
                  ].join(' ')}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Release Channel */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold tracking-widest text-on-surface-variant uppercase ml-1">
              RELEASE CHANNEL
            </label>
            <div className="flex gap-3">
              {(['ONLINE', 'WALK_IN'] as const).map(ch => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setReleaseChannel(ch)}
                  className={[
                    'flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all',
                    releaseChannel === ch
                      ? 'bg-primary text-on-primary border-primary shadow-lg shadow-primary/20'
                      : 'bg-surface-container-highest text-on-surface-variant border-transparent hover:border-primary/30',
                  ].join(' ')}
                >
                  {ch === 'WALK_IN' ? 'Walk-in' : 'Online'}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── Collateral ───────────────────────────────────────────────────── */}
        <section className="space-y-5 mb-10">
          <h3 className="text-xs font-bold tracking-wider text-primary/80 uppercase">
            Collateral Information
          </h3>

          <Input
            label="COLLATERAL TYPE"
            placeholder="e.g. ORCR, Real Estate, Jewelry"
            value={formData.collateral_type}
            onChange={(e) => setFormData(f => ({ ...f, collateral_type: e.target.value }))}
            error={errors.collateral_type}
          />

          <Input
            label="COLLATERAL DESCRIPTION"
            placeholder="e.g. Honda Click 125, 2022 model"
            value={formData.collateral_notes}
            onChange={(e) => setFormData(f => ({ ...f, collateral_notes: e.target.value }))}
          />
          <p className="text-xs text-on-surface-variant -mt-3 ml-1">
            Optional — describe your collateral item
          </p>
        </section>

        {/* ── Info note: no file uploads here ──────────────────────────────── */}
        <div className="mb-10 p-4 bg-surface-container-high rounded-2xl border border-outline-variant/10 flex gap-3">
          <span className="text-primary text-lg leading-none">ℹ</span>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Required documents (Valid ID, Collateral Proof, etc.) will be uploaded{' '}
            <span className="font-semibold text-on-surface">after your application is submitted</span>{' '}
            in the next screen.
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
