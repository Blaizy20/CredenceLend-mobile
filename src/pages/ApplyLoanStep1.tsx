import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ArrowRight, Camera, AlertTriangle } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { Button } from '../components/Button';
import { Input }  from '../components/Input';
import { loansAPI } from '../lib/api';

// ─── Constants ────────────────────────────────────────────────────────────────

const TERM_OPTIONS = [
  { label: 'Daily',        apiValue: 'daily',       rate: 2.75, periodsPerMonth: 25   },
  { label: 'Weekly',       apiValue: 'weekly',      rate: 3.0,  periodsPerMonth: 4.25 },
  { label: 'Semi-monthly', apiValue: 'semi_monthly',rate: 3.5,  periodsPerMonth: 2    },
  { label: 'Monthly',      apiValue: 'monthly',     rate: 4.0,  periodsPerMonth: 1    },
];

const FEE_RATES = {
  SERVICE_FEE:     0.0300, // 3.00% of principal
  NOTARIAL:        0.0100, // 1.00% of principal
  RISK_MANAGEMENT: 0.0050, // 0.50% of principal
  PAF:             0.0050, // 0.50% of principal
};

// Doc stamps rate is term-specific (reverse-engineered from disbursement vouchers)
const DOC_STAMPS_RATE: Record<string, number> = {
  daily:        0.152727, // ₱168/₱1,100 & ₱252/₱1,650 = 15.2727%
  weekly:       0.150000, // ₱180/₱1,200 = 15.0000%
  semi_monthly: 0.150000, // no voucher sample — defaulting to 15%
  monthly:      0.150000, // no voucher sample — defaulting to 15%
};

const COLLATERAL_TYPES = [
  'ORCR (Vehicle)',
  'Real Estate',
  'Jewelry',
  'Savings Deposit',
  'Equipment',
  'Other',
];

const ID_TYPES = [
  "Driver's License",
  'Passport',
  'National ID',
  'Postal ID',
  'PhilSys ID',
];

const STEP1_DOCS = [
  { code: 'VALID_ID',         label: 'Valid ID — Front',    hint: 'Clear photo of front side',       required: true,  collateralOnly: false },
  { code: 'VALID_ID',         label: 'Valid ID — Back',     hint: 'Clear photo of back side',        required: true,  collateralOnly: false },
  { code: 'PROOF_OF_BILLING', label: 'Proof of Billing',    hint: 'Utility bill or bank statement',  required: true,  collateralOnly: false },
  { code: 'PROOF_OF_INCOME',  label: 'Proof of Income',     hint: 'Payslip, ITR, or certificate',    required: true,  collateralOnly: false },
  { code: 'COLLATERAL_PROOF', label: 'Collateral Proof',    hint: 'Photo or document of collateral', required: false, collateralOnly: true  },
  { code: 'COLLATERAL_TYPE',  label: 'Collateral Type Doc', hint: 'e.g. OR/CR, title, appraisal',    required: false, collateralOnly: true  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface DocSlot {
  code:     string;
  label:    string;
  file:     File | null;
  required: boolean;
}

interface Step1Data {
  amount:           string;
  term:             string;
  term_months:      string;
  id_type:          string;
  collateral_type:  string;
  collateral_notes: string;
  docs:             DocSlot[];
}

export interface LoanBreakdown {
  rate:            number;
  totalInterest:   number;
  serviceFee:      number;
  notarial:        number;
  riskManagement:  number;
  paf:             number;
  docStamps:       number;
  totalFees:       number;
  loansReceivable: number;
  cashReleased:    number;
  totalPeriods:    number;
  amortization:    number;
  periodLabel:     string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ApplyLoanStep1() {
  const navigate = useNavigate();

  // ── Block Check ─────────────────────────────────────────────────────────────
  const [blockCheck, setBlockCheck] = useState<'loading' | 'blocked' | 'allowed'>('loading');
  const [blockedStatus, setBlockedStatus] = useState('');

  useEffect(() => {
    let user: any = null;
    try { user = JSON.parse(localStorage.getItem('user') || 'null'); } catch {}
    if (!user?.customer_id) {
      navigate('/login', { replace: true });
      return;
    }

    loansAPI.getLoans(user.customer_id).then((data) => {
      const loans = Array.isArray(data) ? data : [];
      const blocked = loans.find((l: any) =>
        ['active', 'pending', 'under_review'].includes(l.status?.toLowerCase())
      );
      if (blocked) {
        setBlockedStatus(blocked.status);
        setBlockCheck('blocked');
      } else {
        setBlockCheck('allowed');
      }
    }).catch(() => setBlockCheck('allowed'));
  }, []);

  // ── Form State ───────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState<Step1Data>({
    amount:           '',
    term:             'Monthly',
    term_months:      '12',
    id_type:          "Driver's License",
    collateral_type:  '',
    collateral_notes: '',
    docs: STEP1_DOCS.map(d => ({ code: d.code, label: d.label, file: null, required: d.required })),
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (field: keyof Omit<Step1Data, 'docs'>, value: string) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  // ── Live Breakdown ──────────────────────────────────────────────────────────

  const breakdown = useMemo((): LoanBreakdown | null => {
    const principal  = Number(formData.amount);
    const months     = parseInt(formData.term_months, 10);
    const termOption = TERM_OPTIONS.find(t => t.label === formData.term) ?? TERM_OPTIONS[3];

    if (!principal || principal <= 0 || !months || months <= 0) return null;

    // Core flat-rate interest — whole peso
    const totalInterest  = Math.round(principal * (termOption.rate / 100) * months);

    // One-time upfront fees — whole peso each
    const serviceFee     = Math.round(principal * FEE_RATES.SERVICE_FEE);
    const notarial       = Math.round(principal * FEE_RATES.NOTARIAL);
    const riskManagement = Math.round(principal * FEE_RATES.RISK_MANAGEMENT);
    const paf            = Math.round(principal * FEE_RATES.PAF);

    // Doc stamps: term-specific rate on total interest — whole peso
    const docStampsRate  = DOC_STAMPS_RATE[termOption.apiValue] ?? 0.15;
    const docStamps      = Math.round(totalInterest * docStampsRate);

    const totalFees       = serviceFee + notarial + riskManagement + paf + docStamps;
    const loansReceivable = principal + totalInterest + totalFees;
    const cashReleased    = principal;

    // Amortization: ceiled to nearest whole peso (matches voucher convention)
    const totalPeriods  = Math.round(months * termOption.periodsPerMonth);
    const amortization  = totalPeriods > 0
      ? Math.ceil(loansReceivable / totalPeriods)
      : 0;

    const periodLabel =
      formData.term === 'Daily'        ? 'day'           :
      formData.term === 'Weekly'       ? 'week'          :
      formData.term === 'Semi-monthly' ? '15-day period' : 'month';

    return {
      rate: termOption.rate,
      totalInterest,
      serviceFee,
      notarial,
      riskManagement,
      paf,
      docStamps,
      totalFees,
      loansReceivable,
      cashReleased,
      totalPeriods,
      amortization,
      periodLabel,
    };
  }, [formData.amount, formData.term, formData.term_months]);

  // ── File Handling ───────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('File size should not exceed 5MB.');
      e.target.value = '';
      return;
    }
    setFormData(f => {
      const docs = [...f.docs];
      docs[idx]  = { ...docs[idx], file };
      return { ...f, docs };
    });
  };

  // ── Validation ──────────────────────────────────────────────────────────────

  const validate = () => {
    const newErrors: Record<string, string> = {};
    const amt    = Number(formData.amount);
    const months = parseInt(formData.term_months, 10);

    if (!formData.amount || isNaN(amt) || amt <= 0)
      newErrors.amount = 'Please enter a valid loan amount.';
    else if (amt < 1000)
      newErrors.amount = 'Minimum loan amount is ₱1,000.';
    else if (amt > 500000)
      newErrors.amount = 'Maximum loan amount is ₱500,000.';

    if (!formData.term_months || isNaN(months) || months < 1)
      newErrors.term_months = 'Please enter a valid number of months.';
    else if (months > 180)
      newErrors.term_months = 'Maximum term is 180 months (15 years).';

    if (!formData.collateral_type)
      newErrors.collateral_type = 'Please select a collateral type.';

    const missingDocs = formData.docs.filter((d, idx) => {
      const def = STEP1_DOCS[idx];
      if (def.collateralOnly && !formData.collateral_type) return false;
      return d.required && !d.file;
    }).map(d => d.label);

    if (missingDocs.length > 0)
      newErrors.docs = `Missing required documents: ${missingDocs.join(', ')}`;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Navigation ──────────────────────────────────────────────────────────────

  const handleNext = () => {
    if (!validate()) return;

    const termOption = TERM_OPTIONS.find(t => t.label === formData.term) ?? TERM_OPTIONS[3];
    const months     = parseInt(formData.term_months, 10);

    navigate('/apply/step2', {
      state: {
        step1: {
          principal_amount:   Number(formData.amount),
          payment_term:       termOption.apiValue,
          payment_term_label: formData.term,
          interest_rate:      termOption.rate,
          term_months:        months,
          id_type:            formData.id_type,
          collateral_type:    formData.collateral_type,
          collateral_notes:   formData.collateral_notes.trim(),
          breakdown,
        },
        uploadDocs: formData.docs
          .filter((d, idx) => {
            const def = STEP1_DOCS[idx];
            if (def.collateralOnly && !formData.collateral_type) return false;
            return d.file !== null;
          })
          .map(d => ({ code: d.code, label: d.label, file: d.file! })),
      },
    });
  };

  // Whole-peso formatter — used for all breakdown card values
  const fmtW = (n: number) =>
    Math.round(n).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  // ── Block States ─────────────────────────────────────────────────────────────

  if (blockCheck === 'loading') return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (blockCheck === 'blocked') return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-8 text-center">
      <div className="w-20 h-20 rounded-full bg-secondary/10 flex items-center justify-center mb-6">
        <AlertTriangle size={40} className="text-secondary" />
      </div>
      <h2 className="font-headline font-bold text-2xl text-on-surface mb-3">
        Application Not Allowed
      </h2>
      <p className="text-on-surface-variant text-sm leading-relaxed mb-8 max-w-xs">
        You currently have a{' '}
        <span className="font-bold text-on-surface capitalize">{blockedStatus}</span>{' '}
        loan that must be settled or resolved before applying for a new one.
      </p>
      <button
        onClick={() => navigate('/dashboard', { replace: true })}
        className="w-full max-w-xs py-4 rounded-full bg-primary text-on-primary font-bold text-sm active:scale-95 transition-transform"
      >
        Back to Dashboard
      </button>
    </div>
  );

  // ── Main Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background pb-32">
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

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">STEP 1 OF 2</span>
            <div className="h-[2px] flex-grow bg-surface-container-highest overflow-hidden rounded-full">
              <div className="h-full w-1/2 bg-primary rounded-full" />
            </div>
          </div>
          <h2 className="text-3xl font-headline font-extrabold text-on-surface">Loan Details</h2>
        </div>

        {/* ── Loan Amount & Term ── */}
        <section className="space-y-5 mb-10">

          <Input
            label="REQUESTED AMOUNT"
            placeholder="0.00"
            type="number"
            icon={<span className="font-bold text-lg">₱</span>}
            className="text-xl font-bold"
            value={formData.amount}
            onChange={(e) => {
              const raw = e.target.value;
              const num = Number(raw);
              if (raw === '' || raw === '-') { set('amount', raw); return; }
              set('amount', num > 500000 ? '500000' : raw);
              if (errors.amount) setErrors(prev => ({ ...prev, amount: '' }));
            }}
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
            <select
              value={formData.term}
              onChange={(e) => set('term', e.target.value)}
              className="w-full bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/50 rounded-xl py-4 px-4 text-on-surface font-medium transition-all appearance-none"
            >
              {TERM_OPTIONS.map(t => (
                <option key={t.label} value={t.label}>{t.label}</option>
              ))}
            </select>
          </div>

          <Input
            label="LOAN DURATION (MONTHS)"
            placeholder="e.g. 12"
            type="number"
            value={formData.term_months}
            onChange={(e) => {
              const raw = e.target.value;
              const num = Number(raw);
              if (raw === '') { set('term_months', raw); return; }
              set('term_months', num > 180 ? '180' : raw);
              if (errors.term_months) setErrors(prev => ({ ...prev, term_months: '' }));
            }}
            error={errors.term_months}
          />
          <p className="text-xs text-on-surface-variant -mt-3 ml-1">
            1 month minimum · 180 months (15 years) maximum
          </p>

          {/* ── Live Breakdown Card ── */}
          {breakdown ? (
            <div className="rounded-2xl bg-primary/8 border border-primary/20 p-5 space-y-4">
              <p className="text-[10px] font-bold tracking-widest text-primary uppercase">
                Loan Breakdown
              </p>

              {/* Rate + Periods */}
              <div className="grid grid-cols-2 gap-y-3">
                <div>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Interest Rate</p>
                  <p className="text-sm font-semibold text-on-surface">{breakdown.rate}% / month</p>
                </div>
                <div>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Total Periods</p>
                  <p className="text-sm font-semibold text-on-surface">
                    {breakdown.totalPeriods} {breakdown.periodLabel}{breakdown.totalPeriods !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Fee Line Items */}
              <div className="border-t border-primary/15 pt-3 space-y-2">
                <p className="text-[10px] font-bold tracking-widest text-on-surface-variant uppercase mb-2">
                  Fees (Deducted from Proceeds)
                </p>
                {[
                  { label: 'Interest Income',        value: breakdown.totalInterest   },
                  { label: 'Service Fee (3%)',        value: breakdown.serviceFee      },
                  { label: 'Notarial Fee (1%)',       value: breakdown.notarial        },
                  { label: 'Risk Management (0.5%)',  value: breakdown.riskManagement  },
                  { label: 'PAF (0.5%)',              value: breakdown.paf             },
                  { label: 'Documentary Stamps',      value: breakdown.docStamps       },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center">
                    <p className="text-xs text-on-surface-variant">{label}</p>
                    <p className="text-xs font-medium text-on-surface">₱{fmtW(value)}</p>
                  </div>
                ))}
              </div>

              {/* Loans Receivable + Cash Released */}
              <div className="border-t border-primary/15 pt-3 space-y-2">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                    Loans Receivable
                  </p>
                  <p className="text-sm font-extrabold text-on-surface">₱{fmtW(breakdown.loansReceivable)}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-xs text-on-surface-variant">Net Proceeds (Cash Released)</p>
                  <p className="text-xs font-semibold text-green-600">₱{fmtW(breakdown.cashReleased)}</p>
                </div>
              </div>

              {/* Amortization highlight */}
              <div className="rounded-xl bg-primary/10 px-4 py-3 flex justify-between items-center">
                <div>
                  <p className="text-[10px] text-primary font-bold uppercase tracking-wider">
                    Amortization per {breakdown.periodLabel}
                  </p>
                  <p className="text-[10px] text-on-surface-variant mt-0.5">
                    Based on Loans Receivable ÷ {breakdown.totalPeriods} payments
                  </p>
                </div>
                <p className="text-lg font-extrabold text-primary">₱{fmtW(breakdown.amortization)}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-surface-container-low border border-outline-variant/20 p-5">
              <p className="text-xs text-on-surface-variant text-center">
                Enter an amount and duration to see your loan breakdown.
              </p>
            </div>
          )}
        </section>

        {/* ── Applicant ID Information ── */}
        <section className="space-y-5 mb-10">
          <h3 className="text-sm font-bold tracking-wider text-primary/80 uppercase">
            Applicant ID Information
          </h3>
          <div className="space-y-2">
            <label className="block text-[10px] font-bold tracking-widest text-on-surface-variant uppercase ml-1">
              ID TYPE
            </label>
            <select
              value={formData.id_type}
              onChange={(e) => set('id_type', e.target.value)}
              className="w-full bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/50 rounded-xl py-4 px-4 text-on-surface font-medium transition-all appearance-none"
            >
              {ID_TYPES.map(id => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </div>
        </section>

        {/* ── Collateral Information ── */}
        <section className="space-y-5 mb-10">
          <h3 className="text-sm font-bold tracking-wider text-primary/80 uppercase">
            Collateral Information
          </h3>
          <div className="space-y-2">
            <label className="block text-[10px] font-bold tracking-widest text-on-surface-variant uppercase ml-1">
              COLLATERAL TYPE <span className="text-error">*</span>
            </label>
            <select
              value={formData.collateral_type}
              onChange={(e) => set('collateral_type', e.target.value)}
              className={`w-full bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/50 rounded-xl py-4 px-4 text-on-surface font-medium transition-all appearance-none ${
                errors.collateral_type ? 'ring-2 ring-error/50' : ''
              }`}
            >
              <option value="">Select collateral type…</option>
              {COLLATERAL_TYPES.map(ct => (
                <option key={ct} value={ct}>{ct}</option>
              ))}
            </select>
            {errors.collateral_type && (
              <p className="text-xs text-error ml-1">{errors.collateral_type}</p>
            )}
          </div>
          <Input
            label="COLLATERAL NOTES"
            placeholder="e.g. Honda Click 125, 2022 model"
            value={formData.collateral_notes}
            onChange={(e) => set('collateral_notes', e.target.value)}
          />
          <p className="text-xs text-on-surface-variant -mt-3 ml-1">
            Describe the collateral (brand, model, address, etc.)
          </p>
        </section>

        {/* ── Required Documents ── */}
        <section className="space-y-4 mb-10">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-bold tracking-wider text-primary/80 uppercase">
              Required Documents
            </h3>
            <span className="text-[10px] text-on-surface-variant">* = required</span>
          </div>

          {errors.docs && (
            <div className="rounded-xl bg-error/10 border border-error/30 px-4 py-3">
              <p className="text-xs text-error font-medium">{errors.docs}</p>
            </div>
          )}

          {STEP1_DOCS.map((docDef, idx) => {
            if (docDef.collateralOnly && !formData.collateral_type) return null;
            const doc = formData.docs[idx];
            return (
              <div
                key={`${docDef.code}-${idx}`}
                className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                  doc.file
                    ? 'bg-primary/5 border-primary/25'
                    : docDef.required
                    ? 'bg-surface-container-low border-error/20'
                    : 'bg-surface-container-low border-white/5'
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0 mr-3">
                  <Camera
                    className={doc.file ? 'text-primary' : docDef.required ? 'text-error/60' : 'text-outline'}
                    size={20}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {docDef.label}
                      {docDef.required && <span className="text-error ml-1">*</span>}
                    </p>
                    <p className="text-xs text-on-surface-variant truncate">{docDef.hint}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    style={{ display: 'none' }}
                    id={`docUpload_${idx}`}
                    onChange={e => handleFileChange(e, idx)}
                  />
                  <label
                    htmlFor={`docUpload_${idx}`}
                    className="bg-primary text-on-primary-container text-[10px] font-bold px-3 py-2 rounded-lg uppercase tracking-wider cursor-pointer whitespace-nowrap"
                  >
                    {doc.file ? 'REPLACE' : 'CHOOSE FILE'}
                  </label>
                  {doc.file
                    ? <span className="text-[10px] text-green-600 max-w-[80px] truncate">✓ {doc.file.name}</span>
                    : <span className="text-[10px] text-outline">No file</span>
                  }
                </div>
              </div>
            );
          })}
        </section>

        {/* ── Next Button ── */}
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