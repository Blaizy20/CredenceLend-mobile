import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Loader2, AlertCircle, Calculator, Wallet2, SplitSquareHorizontal } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { Button } from '../components/Button';
import { motion } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { loansAPI } from '../lib/api';

// ── helpers ───────────────────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Compute the installment amount due for this period.
 *
 * Strategy:
 *   monthly_due = total_payable / term_months
 *   paid_so_far = total_payable - remaining_balance
 *   periods_paid = Math.floor(paid_so_far / monthly_due)
 *   If the current period is already fully paid → next period's due = monthly_due
 *   Cap at remaining_balance so we never over-charge
 */
function computeInstallmentDue(loan: any): number {
  const total     = Number(loan.total_payable)    || 0;
  const remaining = Number(loan.remaining_balance) || 0;
  const months    = Number(loan.term_months)       || 1;

  if (remaining <= 0) return 0;

  const monthly   = parseFloat((total / months).toFixed(2));
  const paidSoFar = parseFloat((total - remaining).toFixed(2));

  // How many full periods have been paid?
  const periodsPaid  = monthly > 0 ? Math.floor(paidSoFar / monthly) : 0;
  // Amount credited toward the current (unpaid) period
  const partialCredit = parseFloat((paidSoFar - periodsPaid * monthly).toFixed(2));
  // What's left for the current period
  const currentDue   = parseFloat((monthly - partialCredit).toFixed(2));

  // clamp so we never exceed actual remaining balance
  return Math.min(Math.max(currentDue, 0), remaining);
}

type Option = 'installment' | 'full' | 'custom';

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
        <button onClick={() => navigate('/dashboard')} className="bg-primary text-on-primary px-6 py-3 rounded-full font-bold">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const remaining     = Number(loan.remaining_balance) || 0;
  const total         = Number(loan.total_payable)     || 0;
  const months        = Number(loan.term_months)       || 1;
  const monthly       = parseFloat((total / months).toFixed(2));
  const installmentDue = computeInstallmentDue(loan);
  const paidSoFar     = parseFloat((total - remaining).toFixed(2));
  const progress      = total > 0 ? Math.min((paidSoFar / total) * 100, 100) : 0;

  const customValue = parseFloat(customAmt) || 0;

  const AMOUNT_FOR_TYPE: Record<Option, number> = {
    installment: installmentDue,
    full:        remaining,
    custom:      customValue,
  };

  const finalAmount = AMOUNT_FOR_TYPE[selected];

  // Validate custom amount
  const validateAndProceed = () => {
    if (selected === 'custom') {
      if (!customAmt || isNaN(customValue) || customValue <= 0) {
        setCustomError('Please enter a valid amount.');
        return;
      }
      if (customValue > remaining) {
        setCustomError(`Cannot exceed remaining balance of ₱${fmt(remaining)}.`);
        return;
      }
      if (customValue < 1) {
        setCustomError('Minimum payment is ₱1.00.');
        return;
      }
    }
    const type = selected === 'full' ? 'full' : selected === 'custom' ? 'custom' : 'installment';
    navigate(`/loan/${id}/pay/confirm?amount=${finalAmount}&type=${type}`);
  };

  const OPTIONS = [
    {
      id:      'installment' as Option,
      icon:    SplitSquareHorizontal,
      label:   'Pay Installment',
      sub:     `Current period due`,
      amount:  installmentDue,
      badge:   installmentDue <= 0 ? 'Paid' : 'Due Now',
      badgeOk: installmentDue <= 0,
    },
    {
      id:      'full' as Option,
      icon:    Wallet2,
      label:   'Full Settlement',
      sub:     'Clear entire remaining balance',
      amount:  remaining,
      badge:   null,
      badgeOk: false,
    },
    {
      id:      'custom' as Option,
      icon:    Calculator,
      label:   'Custom Amount',
      sub:     `Min ₱1.00 · Max ₱${fmt(remaining)}`,
      amount:  null,
      badge:   null,
      badgeOk: false,
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      <TopBar title="Payment Options" onBack={() => navigate(`/loan/${id}`)} />

      <main className="w-full max-w-md px-6 pt-24 pb-36 flex-1 space-y-6">

        {/* Loan summary card */}
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

          {/* Progress bar */}
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

          {/* Breakdown grid */}
          <div className="grid grid-cols-3 gap-3 pt-1 border-t border-outline-variant/10">
            {[
              { label: 'Principal',   value: `₱${fmt(Number(loan.principal_amount))}` },
              { label: 'Monthly Due', value: `₱${fmt(monthly)}` },
              { label: 'Term',        value: `${months} mo${months > 1 ? 's' : ''}` },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-[9px] uppercase tracking-wider text-on-surface-variant mb-0.5">{label}</p>
                <p className="text-xs font-bold text-on-surface">{value}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Amount options */}
        <section className="space-y-3">
          <h3 className="font-headline font-bold text-on-surface-variant uppercase text-[10px] tracking-widest px-1">
            How much to pay?
          </h3>

          {OPTIONS.map((opt, i) => {
            const isSelected = selected === opt.id;
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
                    <opt.icon className="text-primary" size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-on-surface">{opt.label}</p>
                      {opt.badge && (
                        <span className={cn(
                          'text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tight',
                          opt.badgeOk ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'
                        )}>
                          {opt.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-on-surface-variant">{opt.sub}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  {opt.amount !== null
                    ? <p className={cn('font-bold text-sm', isSelected ? 'text-primary' : 'text-on-surface')}>
                        ₱{fmt(opt.amount)}
                      </p>
                    : <ChevronRight size={16} className="text-on-surface-variant" />
                  }
                </div>
              </motion.button>
            );
          })}

          {/* Custom amount input */}
          {selected === 'custom' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
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
        </section>

        {/* Selected amount summary */}
        {(selected !== 'custom' || customValue > 0) && finalAmount > 0 && (
          <motion.div
            key={`${selected}-${finalAmount}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-primary/5 border border-primary/15 rounded-2xl p-4 flex justify-between items-center"
          >
            <p className="text-sm font-semibold text-on-surface">You will pay</p>
            <p className="font-headline font-extrabold text-2xl text-primary">₱{fmt(finalAmount)}</p>
          </motion.div>
        )}
      </main>

      {/* CTA */}
      <div className="fixed bottom-0 left-0 w-full bg-background/80 backdrop-blur-xl pt-4 pb-10 px-6 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.4)]">
        <div className="max-w-md mx-auto">
          <Button
            onClick={validateAndProceed}
            disabled={finalAmount <= 0 && selected !== 'custom'}
          >
            Continue to Payment <ChevronRight size={18} />
          </Button>
        </div>
      </div>
    </div>
  );
}
