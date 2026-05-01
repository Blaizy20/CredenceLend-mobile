import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { motion } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { loansAPI } from '../lib/api';

export default function PaymentOptions() {
  const navigate = useNavigate();
  const { id }   = useParams();

  const [loan, setLoan]         = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const [selectedOption, setSelectedOption] = useState<'installment' | 'full' | 'custom'>('installment');
  const [customAmount, setCustomAmount]     = useState('');
  const [customError, setCustomError]       = useState('');

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const [loanData, paymentData] = await Promise.all([
          loansAPI.getLoan(Number(id)),
          loansAPI.getPayments(Number(id)),
        ]);
        if (!loanData || loanData.success === false || !loanData.loan) {
          setError(loanData?.message || 'Loan not found.');
          return;
        }
        setLoan(loanData.loan);
        setPayments(Array.isArray(paymentData.payments) ? paymentData.payments : (Array.isArray(paymentData) ? paymentData : []));
      } catch {
        setError('Unable to load loan details. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
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
        <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
      </div>
    );
  }

  // ── Derived amounts ──────────────────────────────────────────────────────
  const totalPayable      = Number(loan.total_payable     ?? 0);
  const remainingBalance  = Number(loan.remaining_balance ?? totalPayable);
  const termMonths        = Number(loan.term_months       ?? 1);

  // Interest computation check: 2500 then 3.5% it's 4600?
  // If principal is 2500 and rate is 3.5% per month for 24 months:
  // 2500 + (2500 * 0.035 * 24) = 2500 + 2100 = 4600. Correct.

  const installmentAmount = termMonths > 0 ? totalPayable / termMonths : totalPayable;

  // Fix: amountDue logic
  // Calculate how much should have been paid by now based on schedule
  const activatedDate = loan.activated_at ? new Date(loan.activated_at) : new Date(loan.created_at);
  const now = new Date();

  let monthsPassed = 0;
  const term = (loan.payment_term || '').toLowerCase();
  if (term.includes('daily')) {
    monthsPassed = Math.floor((now.getTime() - activatedDate.getTime()) / (1000 * 60 * 60 * 24));
  } else if (term.includes('weekly')) {
    monthsPassed = Math.floor((now.getTime() - activatedDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
  } else if (term.includes('semi')) {
    monthsPassed = Math.floor((now.getTime() - activatedDate.getTime()) / (1000 * 60 * 60 * 24 * 15));
  } else {
    monthsPassed = (now.getFullYear() - activatedDate.getFullYear()) * 12 + (now.getMonth() - activatedDate.getMonth());
  }

  // We should have paid (monthsPassed + 1) installments by now (including current month)
  const targetPaid = Math.min(totalPayable, (Math.max(0, monthsPassed) + 1) * installmentAmount);
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);

  // Amount due is what we are "behind" on the schedule
  const amountDue = remainingBalance <= 0
    ? 0
    : Math.max(installmentAmount, targetPaid - totalPaid);

  // Ensure amountDue doesn't exceed remaining balance
  const finalAmountDue = Math.min(remainingBalance, amountDue);

  const handleContinue = () => {
    setCustomError('');
    let amount = 0;

    if (selectedOption === 'installment') {
      amount = finalAmountDue;
    } else if (selectedOption === 'full') {
      amount = remainingBalance;
    } else {
      const val = Number(customAmount);
      if (!customAmount || isNaN(val) || val <= 0) {
        setCustomError('Please enter a valid amount.');
        return;
      }
      // Allowed to pay any amount up to remaining balance,
      // but warn if it's less than amount due? user said "if they pay more than amount the next due is reduced"
      // so custom amount is fine.
      if (val > remainingBalance) {
        setCustomError(
          `Amount cannot exceed remaining balance of ₱ ${remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        );
        return;
      }
      amount = val;
    }

    // ✅ Fixed: matches the route /loan/:id/pay/confirm in App.tsx
    navigate(`/loan/${id}/pay/confirm?amount=${amount}&type=${selectedOption}`);
  };

  const radioClass = (active: boolean) => cn(
    'w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0',
    active ? 'border-primary bg-primary' : 'border-outline-variant'
  );

  const cardClass = (active: boolean) => cn(
    'w-full p-5 rounded-2xl border-2 transition-all flex items-center justify-between text-left',
    active ? 'border-primary bg-primary/5' : 'border-outline-variant/30 bg-surface-container-low'
  );

  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      <TopBar title="Payment Options" onBack={() => navigate(`/loan/${id}`)} />

      <main className="w-full max-w-md px-6 pt-24 pb-36 flex-1 space-y-4">
        <div className="mb-6">
          <h2 className="text-2xl font-headline font-extrabold text-on-surface mb-1">
            How do you want to pay?
          </h2>
          <p className="text-on-surface-variant text-sm">
            Choose a payment option below.
          </p>
        </div>

        {/* Installment */}
        <button
          onClick={() => { setSelectedOption('installment'); setCustomError(''); }}
          className={cardClass(selectedOption === 'installment')}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Amount Due</p>
            <p className="font-headline font-bold text-xl text-on-surface">
              ₱ {finalAmountDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-on-surface-variant mt-1">
              {totalPaid < targetPaid ? 'Pay overdue + current installment' : 'Next scheduled installment'}
            </p>
          </div>
          <div className={radioClass(selectedOption === 'installment')}>
            {selectedOption === 'installment' && <div className="w-2 h-2 bg-white rounded-full" />}
          </div>
        </button>

        {/* Full Settlement */}
        <button
          onClick={() => { setSelectedOption('full'); setCustomError(''); }}
          className={cardClass(selectedOption === 'full')}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Remaining Balance</p>
            <p className="font-headline font-bold text-xl text-on-surface">
              ₱ {remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-on-surface-variant mt-1">Pay off your entire loan</p>
          </div>
          <div className={radioClass(selectedOption === 'full')}>
            {selectedOption === 'full' && <div className="w-2 h-2 bg-white rounded-full" />}
          </div>
        </button>

        {/* Custom Amount */}
        <div className={cn(
          'w-full p-5 rounded-2xl border-2 transition-all',
          selectedOption === 'custom' ? 'border-primary bg-primary/5' : 'border-outline-variant/30 bg-surface-container-low'
        )}>
          <button
            onClick={() => { setSelectedOption('custom'); setCustomError(''); }}
            className="w-full flex items-center justify-between text-left mb-0"
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Custom Amount</p>
              <p className="text-xs text-on-surface-variant">Pay any amount you prefer</p>
            </div>
            <div className={radioClass(selectedOption === 'custom')}>
              {selectedOption === 'custom' && <div className="w-2 h-2 bg-white rounded-full" />}
            </div>
          </button>

          {selectedOption === 'custom' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4"
            >
              <Input
                placeholder="0.00"
                type="number"
                value={customAmount}
                onChange={(e) => { setCustomAmount(e.target.value); setCustomError(''); }}
                icon={<span className="font-bold">₱</span>}
                error={customError}
              />
              <p className="text-[10px] text-on-surface-variant mt-2 italic">
                Enter any amount you wish to pay.
              </p>
            </motion.div>
          )}
        </div>

        {customError && selectedOption !== 'custom' && (
          <div className="p-3 bg-red-500/10 rounded-xl flex items-center gap-2 text-red-500 text-xs font-medium">
            <AlertCircle size={16} />
            <span>{customError}</span>
          </div>
        )}
      </main>

      <div className="fixed bottom-0 left-0 w-full bg-background/80 backdrop-blur-xl pt-4 pb-10 px-6 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.4)]">
        <div className="max-w-md mx-auto">
          <Button onClick={handleContinue}>
            Continue to Payment <ChevronRight size={20} />
          </Button>
        </div>
      </div>
    </div>
  );
}