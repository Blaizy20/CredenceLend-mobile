import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronRight, Loader2, AlertCircle, Calculator,
  Wallet2, SplitSquareHorizontal, FastForward,
} from 'lucide-react';
import { TopBar }   from '../components/TopBar';
import { Button }   from '../components/Button';
import { motion, AnimatePresence } from 'motion/react';
import { cn }       from '@/src/lib/utils';
import { loansAPI } from '../lib/api';

function fmt(n: number) {
  return n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getTermCount(paymentTerm: string, termMonths: number): number {
  switch ((paymentTerm ?? '').toLowerCase().replace(/-/g, '_')) {
    case 'daily':        return termMonths * 30;
    case 'weekly':       return termMonths * 4;
    case 'semi_monthly': return termMonths * 2;
    case 'monthly':
    default:             return termMonths;
  }
}

// ✅ Safely derive amountPerTerm — reads DB first, falls back to computed
function getAmountPerTerm(loan: any): number {
  const stored = Number(loan.amount_per_term ?? 0);
  if (stored > 0) return stored;
  const total      = Number(loan.total_payable) || 0;
  const termMonths = Number(loan.term_months)   || 1;
  const termCount  = getTermCount(loan.payment_term ?? '', termMonths);
  if (termCount > 0 && total > 0) return Number((total / termCount).toFixed(2));
  return total;
}

// ✅ How many full terms have been paid
function computePeriodsPaid(loan: any): number {
  const amountPerTerm = getAmountPerTerm(loan);
  const total         = Number(loan.total_payable)     || 0;
  const remaining     = Number(loan.remaining_balance) || 0;
  const paidSoFar     = total - remaining;
  return amountPerTerm > 0 ? Math.floor(paidSoFar / amountPerTerm) : 0;
}

// ✅ Current installment due is always a flat amountPerTerm
//    UNLESS this is the last term — then it's the actual remaining balance
function computeInstallmentDue(loan: any): number {
  const total         = Number(loan.total_payable)     || 0;
  const remaining     = Number(loan.remaining_balance) || 0;
  const amountPerTerm = getAmountPerTerm(loan);
  const termMonths    = Number(loan.term_months) || 1;
  const totalTerms    = getTermCount(loan.payment_term ?? '', termMonths);
  const periodsPaid   = computePeriodsPaid(loan);
  const termsLeft     = totalTerms - periodsPaid;

  if (remaining <= 0) return 0;

  // Last term — pay exact remaining balance
  if (termsLeft === 1) return remaining;

  // All other terms — flat installment, capped at remaining
  return Math.min(amountPerTerm, remaining);
}

type Option = 'installment' | 'advance' | 'full' | 'custom';

export default function PaymentOptions() {
  const navigate = useNavigate();
  const { id }   = useParams();

  const [loan, setLoan]               = useState<any>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [selected, setSelected]       = useState<Option>('installment');
  const [customAmt, setCustomAmt]     = useState('');
  const [customError, setCustomError] = useState('');

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const data = await loansAPI.getLoan(Number(id));
        if (!data || data.success === false) {
          setError(data?.message || 'Loan not found.');
          return;
        }
        setLoan(data);
      } catch {
        setError('Unable to load loan details.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="text-primary animate-spin" size={48} />
      </div>
    );
  }

  if (error || !loan) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center space-y-4">
        <AlertCircle className="text-red-500" size={40} />
        <h2 className="text-xl font-bold text-on-surface">{error || 'Loan not found.'}</h2>
        <button
          onClick={() => navigate('/dashboard')}
          className="bg-primary text-on-primary px-6 py-3 rounded-full font-bold"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const total          = Number(loan.total_payable)     || 0;
  const remaining      = Number(loan.remaining_balance) || 0;
  const termMonths     = Number(loan.term_months)       || 1;
  const amountPerTerm  = getAmountPerTerm(loan);
  const paidSoFar      = parseFloat((total - remaining).toFixed(2));
  const progress       = total > 0 ? Math.min((paidSoFar / total) * 100, 100) : 0;
  const installmentDue = computeInstallmentDue(loan);
  const periodsPaid    = computePeriodsPaid(loan);

  // Current period is fully paid when installmentDue is 0
  const currentPeriodPaid = installmentDue <= 0;

  // Advance = next period's flat installment, capped at remaining
  const advanceAmount   = Math.min(amountPerTerm, remaining);
  const advancePeriodNo = periodsPaid + (currentPeriodPaid ? 2 : 1);

  const customValue = parseFloat(customAmt) || 0;

  const OPTIONS: {
    id: Option;
    icon: any;
    label: string;
    sub: string;
    amount: number | null;
    badge?: string;
    badgeClass?: string;
  }[] = [
    currentPeriodPaid
      ? {
          id:         'advance',
          icon:       FastForward,
          label:      'Advance Next Payment',
          sub:        `Pay ahead for period ${advancePeriodNo}`,
          amount:     advanceAmount,
          badge:      'Advance',
          badgeClass: 'bg-purple-500/10 text-purple-500',
        }
      : {
          id:         'installment',
          icon:       SplitSquareHorizontal,
          label:      'Pay Installment',
          sub:        `Period ${periodsPaid + 1} — current due`,
          amount:     installmentDue,
          badge:      'Due Now',
          badgeClass: 'bg-orange-500/10 text-orange-500',
        },
    {
      id:     'full',
      icon:   Wallet2,
      label:  'Full Settlement',
      sub:    'Clear entire remaining balance',
      amount: remaining,
    },
    {
      id:     'custom',
      icon:   Calculator,
      label:  'Custom Amount',
      sub:    `Min ₱1.00 · Max ₱${fmt(remaining)}`,
      amount: null,
    },
  ];

  const effectiveSelected =
    selected === 'installment' && currentPeriodPaid ? 'advance'     :
    selected === 'advance'     && !currentPeriodPaid ? 'installment' :
    selected;

  const AMOUNT_FOR: Record<string, number> = {
    installment: installmentDue,
    advance:     advanceAmount,
    full:        remaining,
    custom:      customValue,
  };

  const finalAmount = AMOUNT_FOR[effectiveSelected] ?? 0;

  const validateAndProceed = () => {
    if (effectiveSelected === 'custom') {
      if (!customAmt || isNaN(customValue) || customValue <= 0) {
        setCustomError('Please enter a valid amount.');
        return;
      }
      if (customValue > remaining) {
        setCustomError(`Cannot exceed remaining balance of ₱${fmt(remaining)}.`);
        return;
      }
    }

    const type =
      effectiveSelected === 'full'    ? 'full'        :
      effectiveSelected === 'custom'  ? 'custom'      :
      effectiveSelected === 'advance' ? 'advance'     :
      'installment';

    navigate(`/loan/${id}/pay/confirm?amount=${finalAmount}&type=${type}`);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      <TopBar title="Payment Options" onBack={() => navigate(`/loan/${id}`)} />

      <main className="w-full max-w-md px-6 pt-24 pb-36 flex-1 space-y-6">

        {/* ── Loan summary card ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-container-highest rounded-2xl p-5 shadow-lg border border-outline-variant/10 space-y-4"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-on-surface-variant text-[10px] uppercase tracking-widest mb-0.5">Loan Reference</p>
              <p className="font-mono text-sm font-bold text-on-surface">{loan.reference_no}</p>
            </div>
            <span className={cn(
              'text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full',
              loan.status?.toLowerCase() === 'active'
                ? 'bg-green-500/10 text-green-500'
                : 'bg-primary/10 text-primary'
            )}>
              {loan.status}
            </span>
          </div>

          <div>
            <div className="flex justify-between text-[10px] text-on-surface-variant mb-1.5">
              <span>₱{fmt(paidSoFar)} paid</span>
              <span>₱{fmt(remaining)} remaining</span>
            </div>
            <div className="h-2 rounded-full bg-surface-container-low overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full rounded-full bg-primary"
              />
            </div>
            <p className="text-[10px] text-on-surface-variant mt-1 text-right">{progress.toFixed(1)}% complete</p>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-1 border-t border-outline-variant/10">
            {[
              { label: 'Principal',   value: `₱${fmt(Number(loan.principal_amount))}` },
              { label: 'Per Term',    value: `₱${fmt(amountPerTerm)}` },
              { label: 'Term',        value: `${termMonths} mo${termMonths > 1 ? 's' : ''}` },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-[9px] uppercase tracking-wider text-on-surface-variant mb-0.5">{label}</p>
                <p className="text-xs font-bold text-on-surface">{value}</p>
              </div>
            ))}
          </div>

          {currentPeriodPaid && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 bg-green-500/8 border border-green-500/20 rounded-xl px-3 py-2.5"
            >
              <span className="text-green-500 text-base">✓</span>
              <div>
                <p className="text-xs font-bold text-green-500">Period {periodsPaid} is fully paid!</p>
                <p className="text-[10px] text-on-surface-variant">You can advance your next payment below.</p>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* ── Payment options ── */}
        <section className="space-y-3">
          <h3 className="font-headline font-bold text-on-surface-variant uppercase text-[10px] tracking-widest px-1">
            How much to pay?
          </h3>

          {OPTIONS.map((opt, i) => {
            const isSelected = effectiveSelected === opt.id;
            return (
              <motion.button
                key={opt.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => { setSelected(opt.id); setCustomError(''); }}
                className={cn(
                  'w-full text-left flex items-center justify-between p-4 rounded-2xl border transition-all active:scale-[0.98]',
                  isSelected
                    ? 'border-primary/30 bg-primary/5 ring-1 ring-primary/20'
                    : 'border-outline-variant/20 bg-surface-container-high hover:bg-surface-bright'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                    isSelected ? 'bg-primary/10' : 'bg-surface-container-highest'
                  )}>
                    <opt.icon
                      className={cn(isSelected ? 'text-primary' : 'text-on-surface-variant')}
                      size={20}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-on-surface">{opt.label}</p>
                      {opt.badge && (
                        <span className={cn('text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tight', opt.badgeClass)}>
                          {opt.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-on-surface-variant">{opt.sub}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  {opt.amount !== null
                    ? <p className={cn('font-bold text-sm tabular-nums', isSelected ? 'text-primary' : 'text-on-surface')}>
                        ₱{fmt(opt.amount)}
                      </p>
                    : <ChevronRight size={16} className="text-on-surface-variant" />
                  }
                </div>
              </motion.button>
            );
          })}

          <AnimatePresence>
            {effectiveSelected === 'custom' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl p-4 space-y-2">
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Enter Amount</p>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold text-sm">₱</span>
                    <input
                      type="number"
                      min={1}
                      max={remaining}
                      step="0.01"
                      value={customAmt}
                      onChange={(e) => { setCustomAmt(e.target.value); setCustomError(''); }}
                      placeholder="0.00"
                      className={cn(
                        'w-full pl-8 pr-4 py-3 rounded-xl text-sm font-semibold text-on-surface bg-surface-container-high border focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all',
                        customError ? 'border-red-500/50' : 'border-outline-variant/20'
                      )}
                    />
                  </div>
                  {customError && (
                    <p className="text-red-500 text-xs flex items-center gap-1">
                      <AlertCircle size={12} /> {customError}
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* ── Selected amount summary ── */}
        <AnimatePresence>
          {finalAmount > 0 && (
            <motion.div
              key={`${effectiveSelected}-${finalAmount}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="bg-primary/5 border border-primary/15 rounded-2xl p-4 flex justify-between items-center"
            >
              <div>
                <p className="text-sm font-semibold text-on-surface">You will pay</p>
                {effectiveSelected === 'advance' && (
                  <p className="text-[10px] text-on-surface-variant mt-0.5">
                    Advance payment for period {advancePeriodNo}
                  </p>
                )}
              </div>
              <p className="font-headline font-extrabold text-2xl text-primary tabular-nums">
                ₱{fmt(finalAmount)}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ── CTA ── */}
      <div className="fixed bottom-0 left-0 w-full bg-background/80 backdrop-blur-xl pt-4 pb-10 px-6 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.4)]">
        <div className="max-w-md mx-auto">
          <Button onClick={validateAndProceed} disabled={finalAmount <= 0}>
            Continue to Payment <ChevronRight size={18} />
          </Button>
        </div>
      </div>
    </div>
  );
}