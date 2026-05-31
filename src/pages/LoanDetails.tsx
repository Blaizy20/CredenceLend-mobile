import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Percent, Clock, ChevronRight, CheckCircle, AlertCircle, X, ArrowRight, CalendarClock } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { BottomNav } from '../components/BottomNav';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { loansAPI } from '../lib/api';
import LoanDocuments from './LoanDocuments';

// ── Status styles ─────────────────────────────────────────────────────────────
const statusStyle: Record<string, string> = {
  active:  'bg-green-500/10 text-green-500 border-green-500/20',
  pending: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  paid:    'bg-primary/10 text-primary border-primary/20',
  denied:  'bg-red-500/10 text-red-500 border-red-500/20',
  closed:  'bg-outline/10 text-outline border-outline/20',
  overdue: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
};
const getStatusStyle = (status: string) =>
  statusStyle[status?.toLowerCase()] ?? 'bg-outline/10 text-outline border-outline/20';

function getTermCount(paymentTerm: string, termMonths: number): number {
  switch ((paymentTerm ?? '').toLowerCase().replace(/-/g, '_')) {
    case 'daily':        return termMonths * 30;
    case 'weekly':       return termMonths * 4;
    case 'semi_monthly': return termMonths * 2;
    case 'monthly':
    default:             return termMonths;
  }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function LoanDetailsSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-32">
      <TopBar title="Loan Details" />
      <main className="pt-20 px-4 space-y-6 max-w-lg mx-auto">
        <div className="rounded-3xl bg-surface-container-high p-6 aspect-[16/10] flex flex-col justify-between shadow-xl animate-pulse">
          <div className="flex justify-between items-start">
            <div className="h-3 w-32 bg-surface-container-highest rounded-full" />
            <div className="h-6 w-20 bg-surface-container-highest rounded-full" />
          </div>
          <div className="space-y-2">
            <div className="h-10 w-48 bg-surface-container-highest rounded-full" />
          </div>
          <div className="flex justify-between items-end">
            <div className="space-y-1.5">
              <div className="h-2.5 w-24 bg-surface-container-highest rounded-full" />
              <div className="h-5 w-28 bg-surface-container-highest rounded-full" />
            </div>
            <div className="space-y-1.5 items-end flex flex-col">
              <div className="h-2.5 w-20 bg-surface-container-highest rounded-full" />
              <div className="h-5 w-24 bg-surface-container-highest rounded-full" />
            </div>
          </div>
        </div>
        <div className="bg-surface-container-low p-5 rounded-2xl space-y-4 animate-pulse">
          <div className="h-2.5 w-28 bg-surface-container-highest rounded-full" />
          {[1,2,3,4].map(i => (
            <div key={i} className="flex justify-between">
              <div className="h-3 w-24 bg-surface-container-highest rounded-full" />
              <div className="h-3 w-28 bg-surface-container-highest rounded-full" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[1,2].map(i => (
            <div key={i} className="bg-surface-container p-5 rounded-2xl space-y-4 min-h-[110px] animate-pulse">
              <div className="h-2.5 w-16 bg-surface-container-highest rounded-full" />
              <div className="h-6 w-20 bg-surface-container-highest rounded-full" />
            </div>
          ))}
        </div>
        <div className="bg-surface-container-low p-6 rounded-3xl space-y-4 animate-pulse">
          <div className="flex justify-between">
            <div className="h-3 w-28 bg-surface-container-highest rounded-full" />
            <div className="h-3 w-16 bg-surface-container-highest rounded-full" />
          </div>
          <div className="h-2 w-full bg-surface-container-highest rounded-full" />
          <div className="flex justify-between">
            <div className="h-2.5 w-24 bg-surface-container-highest rounded-full" />
            <div className="h-2.5 w-24 bg-surface-container-highest rounded-full" />
          </div>
        </div>
        <div className="space-y-3 animate-pulse">
          <div className="h-5 w-32 bg-surface-container-highest rounded-full" />
          <div className="bg-surface-container-low rounded-3xl overflow-hidden">
            <div className="grid grid-cols-3 px-5 py-4 gap-4 border-b border-surface-bright/10">
              {[1,2,3].map(i => (
                <div key={i} className="h-2.5 bg-surface-container-highest rounded-full" />
              ))}
            </div>
            {[1,2,3,4,5].map(i => (
              <div key={i} className="grid grid-cols-3 px-5 py-4 gap-4 border-b border-surface-bright/10 last:border-b-0">
                <div className="h-3 w-20 bg-surface-container-highest rounded-full" />
                <div className="h-3 w-16 bg-surface-container-highest rounded-full" />
                <div className="h-5 w-14 bg-surface-container-highest rounded-full ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function LoanDetails() {
  const navigate = useNavigate();
  const { id }   = useParams();

  const [loan, setLoan]                       = useState<any>(null);
  const [payments, setPayments]               = useState<any[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState('');
  const [showAllSchedule, setShowAllSchedule] = useState(false);
  const [showAllPayments, setShowAllPayments] = useState(false);

  const SCHEDULE_PAGE_SIZE = 5;

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const [loanData, paymentData] = await Promise.all([
          loansAPI.getLoan(Number(id)),
          loansAPI.getPayments(Number(id)),
        ]);
        if (!loanData || loanData.success === false) {
          setError(loanData?.message || 'Loan not found.');
          return;
        }
        setLoan(loanData);
        setPayments(Array.isArray(paymentData) ? paymentData : []);
      } catch {
        setError('Unable to load loan details. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) return <LoanDetailsSkeleton />;

  if (error || !loan) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
          <AlertCircle className="text-red-500" size={32} />
        </div>
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
  const principal    = Number(loan.principal_amount  ?? 0);
  const interestRate = Number(loan.interest_rate     ?? 0);
  const termMonths   = Number(loan.term_months       ?? 1);
  const totalPayable = Number(loan.total_payable     ?? principal);
  const remainingBal = Number(loan.remaining_balance ?? totalPayable);
  const paidAmount   = totalPayable - remainingBal;
  const progress     = totalPayable > 0 ? Math.min((paidAmount / totalPayable) * 100, 100) : 0;
  const isFullyPaid  = loan.status?.toLowerCase() === 'closed' || remainingBal <= 0;
  const isOverdue    = loan.status?.toLowerCase() === 'overdue';
  const isClosed     = loan.status?.toLowerCase() === 'closed';
  const paymentTerm  = loan.payment_term ?? '';

  const totalTermCount = getTermCount(paymentTerm, termMonths);

  const amountPerTerm = (() => {
    const stored = Number(loan.amount_per_term ?? 0);
    if (stored > 0) return stored;
    if (totalTermCount > 0 && totalPayable > 0)
      return Number((totalPayable / totalTermCount).toFixed(2));
    return totalPayable;
  })();

  // ── Late fee ───────────────────────────────────────────────────────────────
  const lateFee = (() => {
    if (!isOverdue || !loan.due_date) return 0;
    const DAILY_RATES: Record<string, number> = {
      daily:        0.005,
      weekly:       0.0075 / 7,
      semi_monthly: 0.01   / 15,
      monthly:      0.0125 / 30,
    };
    const term      = (loan.payment_term ?? '').toLowerCase().replace(/-/g, '_');
    const dailyRate = DAILY_RATES[term] ?? DAILY_RATES['monthly'];
    const dueDate   = new Date(loan.due_date);
    const today     = new Date();
    const daysLate  = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
    if (daysLate === 0) return 0;
    return Number((principal * dailyRate * daysLate).toFixed(2));
  })();

  // ── Schedule generator ─────────────────────────────────────────────────────
  const generateFullSchedule = () => {
    const startDate = loan.activated_at
      ? new Date(loan.activated_at)
      : loan.created_at ? new Date(loan.created_at) : new Date();

    // Use base totalPayable (without late fee) for schedule math
    const basePaid        = Math.max(0, Math.min(paidAmount, totalPayable));
    const paidTerms       = amountPerTerm > 0
      ? Math.min(Math.floor(basePaid / amountPerTerm), totalTermCount) : 0;
    const creditTowardCurrent = parseFloat((basePaid - paidTerms * amountPerTerm).toFixed(2));
    const upcomingTermDue     = parseFloat(Math.max(0, amountPerTerm - creditTowardCurrent).toFixed(2));
    const allPaid             = isClosed || remainingBal <= 0;

    // Overpay only valid when loan is fully closed
    const expectedTotal = amountPerTerm * totalTermCount;
    const overpay       = isClosed
      ? parseFloat(Math.max(0, basePaid - expectedTotal).toFixed(2))
      : 0;

    const schedule = [];

    for (let i = 0; i < totalTermCount; i++) {
      const date = new Date(startDate);
      const term = paymentTerm.toLowerCase().replace(/-/g, '_');
      if      (term.includes('daily'))  date.setDate(date.getDate() + i);
      else if (term.includes('weekly')) date.setDate(date.getDate() + i * 7);
      else if (term.includes('semi'))   date.setDate(date.getDate() + i * 15);
      else                              date.setMonth(date.getMonth() + i);

      const isPaid     = allPaid || i < paidTerms;
      const isUpcoming = !allPaid && i === paidTerms;

      let termAmount: number;
      if (isPaid) {
        termAmount = amountPerTerm;
      } else if (isUpcoming) {
        termAmount = paidTerms === totalTermCount - 1
          ? remainingBal
          : upcomingTermDue > 0 ? upcomingTermDue : amountPerTerm;
      } else {
        termAmount = amountPerTerm;
      }

      schedule.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        amount:    `₱ ${termAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        rawAmount: termAmount,
        status:    isPaid ? 'PAID' : 'PENDING',
        isUpcoming,
        isOverpay: false,
        termIndex: i + 1,
      });
    }

    // Overpay row — only appended when loan is closed and overpay > 0
    if (overpay > 0) {
      schedule.push({
        date:      '—',
        amount:    `₱ ${overpay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        rawAmount: overpay,
        status:    'OVERPAY',
        isUpcoming: false,
        isOverpay:  true,
        termIndex:  totalTermCount + 1,
      });
    }

    return schedule;
  };

  const fullSchedule = generateFullSchedule();

  // ── Schedule display logic ─────────────────────────────────────────────────
  const getDisplayedSchedule = () => {
    const regularRows = fullSchedule.filter(s => !s.isOverpay);
    const upcomingIdx = regularRows.findIndex(s => s.isUpcoming);

    if (showAllSchedule) {
      // Expanded: show 1 paid row for context + upcoming + all future pending
      if (upcomingIdx === -1) return regularRows.slice(-SCHEDULE_PAGE_SIZE);
      const start = Math.max(0, upcomingIdx - 1);
      return regularRows.slice(start);
    }

    // Collapsed: show 2 paid + upcoming + next few pending
    if (upcomingIdx === -1) return regularRows.slice(-SCHEDULE_PAGE_SIZE);
    const start = Math.max(0, upcomingIdx - 2);
    const end   = Math.min(regularRows.length, upcomingIdx + SCHEDULE_PAGE_SIZE - 1);
    return regularRows.slice(start, end);
  };

  const displayedSchedule = getDisplayedSchedule();
  const overpayRow         = fullSchedule.find(s => s.isOverpay);
  const nextPayment        = fullSchedule.find(s => s.isUpcoming);
  const regularRows        = fullSchedule.filter(s => !s.isOverpay);
  const paidCount          = regularRows.filter(s => s.status === 'PAID').length;
  const pendingCount       = regularRows.filter(s => s.status === 'PENDING').length;
  const hiddenCount        = regularRows.length - displayedSchedule.length;

  // ── Helpers ────────────────────────────────────────────────────────────────
  const fmt = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopBar title="Loan Details" onBack={() => navigate('/dashboard')} />

      <main className="pt-20 px-4 space-y-6 max-w-lg mx-auto">

        {/* ── Fully Paid Banner ── */}
        {isFullyPaid && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-green-500/10 border border-green-500/20 p-4 rounded-2xl flex items-center gap-3">
            <div className="bg-green-500 rounded-full p-1">
              <CheckCircle size={16} className="text-white" />
            </div>
            <p className="text-green-500 font-headline font-bold text-sm tracking-tight">
              This loan has been fully settled.
            </p>
          </motion.div>
        )}

        {/* ── Overdue Warning ── */}
        {isOverdue && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-2xl flex items-start gap-3">
            <div className="bg-orange-500 rounded-full p-1 shrink-0 mt-0.5">
              <AlertCircle size={16} className="text-white" />
            </div>
            <div>
              <p className="text-orange-500 font-headline font-bold text-sm tracking-tight">This loan is overdue</p>
              <p className="text-orange-400 text-xs mt-1 leading-relaxed">
                A late fee has been added to your remaining balance. Please settle your payment as soon as possible.
              </p>
            </div>
          </motion.div>
        )}

        {/* ── Denial Reason ── */}
        {loan.status?.toLowerCase() === 'denied' && loan.denial_reason && (
          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-start gap-3">
            <AlertCircle className="text-red-500 mt-0.5 shrink-0" size={18} />
            <div>
              <p className="text-red-500 font-bold text-sm">Application Denied</p>
              <p className="text-red-400 text-xs mt-1">{loan.denial_reason}</p>
            </div>
          </div>
        )}

        {/* ── Pay Button ── */}
        {(loan.status?.toLowerCase() === 'active' || isOverdue) && !isFullyPaid && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <button
              onClick={() => navigate(`/loan/${id}/pay`)}
              className={cn(
                "w-full py-4 rounded-2xl font-headline font-extrabold text-base flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform",
                isOverdue
                  ? "bg-orange-500 text-white shadow-orange-500/20"
                  : "bg-primary text-on-primary shadow-primary/20"
              )}
            >
              {isOverdue ? 'Pay Now (Overdue)' : 'Make a Payment'}
              <ChevronRight size={20} />
            </button>
          </motion.div>
        )}

        {/* ── Hero Card ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl bg-surface-container-high p-6 flex flex-col justify-between aspect-[16/10] shadow-xl"
        >
          <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-primary/10 blur-[80px] rounded-full" />
          <div className="relative z-10">
            <div className="flex justify-between items-start">
              <span className="text-on-surface-variant font-medium tracking-wide uppercase text-xs">
                Remaining Balance
              </span>
              <span className={cn(
                'px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase border',
                getStatusStyle(loan.status)
              )}>
                {loan.status}
              </span>
            </div>
            <h2 className="font-headline font-extrabold text-4xl mt-2 tracking-tight">
              ₱ {fmt(remainingBal)}
            </h2>
            {isOverdue && lateFee > 0 && (
              <p className="text-orange-400 text-xs mt-1 font-semibold">
                Includes ₱{fmt(lateFee)} late fee
              </p>
            )}
          </div>
          <div className="relative z-10 flex items-end justify-between">
            <div>
              <p className="text-on-surface-variant text-xs mb-1">Principal Amount</p>
              <p className="font-headline font-bold text-lg">₱ {fmt(principal)}</p>
            </div>
            <div className="text-right">
              <p className="text-on-surface-variant text-xs mb-1">
                {nextPayment ? 'Next Payment' : 'Due Date'}
              </p>
              <p className="font-headline font-bold text-lg">
                {nextPayment?.date ?? (loan.due_date
                  ? new Date(loan.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : '—'
                )}
              </p>
            </div>
          </div>
        </motion.section>

        {/* ── Loan Information ── */}
        <section className="bg-surface-container-low p-5 rounded-2xl space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
            Loan Information
          </p>
          {[
            { label: 'Reference No.',  value: loan.reference_no    ?? '—' },
            { label: 'Payment Term',   value: paymentTerm          || '—' },
            { label: 'Collateral',     value: loan.collateral_type ?? '—' },
            { label: 'ID Type',        value: loan.id_type         ?? '—' },
            ...(isOverdue && lateFee > 0
              ? [{ label: 'Late Fee Added', value: `+ ₱${fmt(lateFee)}` }] : []),
            {
              label: 'Applied On',
              value: loan.created_at
                ? new Date(loan.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                : '—',
            },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-on-surface-variant">{label}</span>
              <span className={cn(
                'font-semibold text-right max-w-[60%] truncate',
                label === 'Late Fee Added' ? 'text-orange-500' : 'text-on-surface'
              )}>
                {value}
              </span>
            </div>
          ))}
        </section>

        {/* ── Stats Grid ── */}
        <section className="grid grid-cols-2 gap-4">
          <div className="bg-surface-container p-5 rounded-2xl flex flex-col justify-between min-h-[110px]">
            <div className="flex items-center gap-2 text-on-surface-variant mb-4">
              <Percent size={14} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Interest</span>
            </div>
            <p className="font-headline font-bold text-xl">
              {interestRate}%{' '}
              <span className="text-xs font-normal text-on-surface-variant">Rate</span>
            </p>
          </div>
          <div className="bg-surface-container p-5 rounded-2xl flex flex-col justify-between min-h-[110px]">
            <div className="flex items-center gap-2 text-on-surface-variant mb-4">
              <Clock size={14} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Term</span>
            </div>
            <p className="font-headline font-bold text-xl">
              {totalTermCount}{' '}
              <span className="text-xs font-normal text-on-surface-variant">Installments</span>
            </p>
          </div>
        </section>

        {/* ── Progress ── */}
        <section className="bg-surface-container-low p-6 rounded-3xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-headline font-bold text-sm tracking-tight">Payment Progress</h3>
            <span className="text-primary font-bold text-xs">{progress.toFixed(1)}% Paid</span>
          </div>
          <div className="w-full h-2 bg-surface-bright rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(progress, 100)}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full bg-primary rounded-full"
            />
          </div>
          <div className="mt-4 flex justify-between text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            <span>₱ {fmt(paidAmount)} Paid</span>
            <span>₱ {fmt(totalPayable)} Total</span>
          </div>
          {/* ── Additional: paid/pending installment counter ── */}
          <div className="mt-3 flex gap-3">
            <span className="text-[10px] text-green-500 font-bold bg-green-500/10 px-2.5 py-1 rounded-full">
              {paidCount} paid
            </span>
            <span className="text-[10px] text-on-surface-variant font-bold bg-surface-bright/20 px-2.5 py-1 rounded-full">
              {pendingCount} remaining
            </span>
          </div>
        </section>

        {/* ── Payment History ── */}
        {payments.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-headline font-bold text-lg tracking-tight">Payment History</h3>
              {payments.length > 3 && (
                <button
                  onClick={() => setShowAllPayments(true)}
                  className="text-primary text-xs font-bold uppercase tracking-widest flex items-center gap-1"
                >
                  View All <ArrowRight size={12} />
                </button>
              )}
            </div>
            <div className="bg-surface-container-low rounded-3xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-bright/30">
                    <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Date</th>
                    <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Amount</th>
                    <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-bright/10">
                  {payments.slice(0, 3).map((p) => (
                    <tr key={p.payment_id} className="hover:bg-white/5 transition-colors">
                      <td className="px-5 py-4 text-sm font-semibold">{fmtDate(p.payment_date ?? p.created_at)}</td>
                      <td className="px-5 py-4 text-sm font-headline font-bold text-primary">₱ {fmt(Number(p.amount))}</td>
                      <td className="px-5 py-4 text-right">
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-surface-container text-on-surface-variant uppercase">
                          {p.method ?? 'Cash'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {payments.length > 3 && (
                <button
                  onClick={() => setShowAllPayments(true)}
                  className="w-full py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest text-center
                    hover:bg-white/5 transition-colors border-t border-surface-bright/10"
                >
                  +{payments.length - 3} more payment{payments.length - 3 !== 1 ? 's' : ''} — View All
                </button>
              )}
            </div>
          </section>
        )}

        {/* ── Loan Schedule ── */}
        {(loan.status?.toLowerCase() === 'active' || isOverdue || isClosed) && fullSchedule.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <div>
                <h3 className="font-headline font-bold text-lg tracking-tight">Loan Schedule</h3>
                <p className="text-[10px] text-on-surface-variant mt-0.5">
                  {showAllSchedule
                    ? `Showing ${displayedSchedule.length} upcoming of ${pendingCount} remaining`
                    : `Showing ${displayedSchedule.length} of ${totalTermCount} installments`
                  }
                </p>
              </div>
              {pendingCount > 0 && (
                <button
                  onClick={() => setShowAllSchedule(!showAllSchedule)}
                  className="text-primary text-xs font-bold uppercase tracking-widest flex items-center gap-1"
                >
                  {showAllSchedule
                    ? 'Show Less'
                    : `View Pending (${pendingCount})`
                  }
                  <ChevronRight
                    size={14}
                    className={cn('transition-transform', showAllSchedule && 'rotate-90')}
                  />
                </button>
              )}
            </div>

            <div className="bg-surface-container-low rounded-3xl overflow-hidden shadow-lg">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-bright/30">
                    <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Due Date</th>
                    <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Amount</th>
                    <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Status</th>
                  </tr>
                </thead>
                <AnimatePresence initial={false}>
                  <tbody className="divide-y divide-surface-bright/10">
                    {displayedSchedule.map((item, i) => (
                      <motion.tr
                        key={`${item.termIndex}-${item.status}`}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18, delay: i * 0.03 }}
                        className={cn(
                          'transition-colors',
                          item.status === 'PAID'
                            ? 'bg-green-500/5 opacity-60'
                            : item.isUpcoming && isOverdue
                              ? 'bg-orange-500/5'
                              : item.isUpcoming
                                ? 'bg-primary/5'
                                : 'hover:bg-white/5'
                        )}
                      >
                        <td className="px-5 py-4">
                          <p className={cn(
                            'text-sm font-semibold',
                            item.status === 'PAID' ? 'line-through text-on-surface-variant' : 'text-on-surface'
                          )}>
                            {item.date}
                          </p>
                          {item.isUpcoming && (
                            <p className={cn(
                              'text-[9px] font-bold uppercase tracking-widest mt-1',
                              isOverdue ? 'text-orange-500' : 'text-primary'
                            )}>
                              {isOverdue ? 'Overdue' : 'Upcoming'}
                            </p>
                          )}
                          {/* ── Additional: show term number ── */}
                          {item.status !== 'PAID' && (
                            <p className="text-[9px] text-on-surface-variant mt-0.5">
                              #{item.termIndex} of {totalTermCount}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <p className={cn(
                            'text-sm font-headline font-bold tabular-nums',
                            item.status === 'PAID'
                              ? 'line-through text-on-surface-variant'
                              : item.isUpcoming && isOverdue
                                ? 'text-orange-500'
                                : item.isUpcoming
                                  ? 'text-primary'
                                  : 'text-on-surface'
                          )}>
                            {item.amount}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className={cn(
                            'inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border tracking-widest uppercase',
                            item.status === 'PAID'
                              ? 'text-green-600 bg-green-500/10 border-green-500/20'
                              : item.isUpcoming && isOverdue
                                ? 'text-orange-500 bg-orange-500/10 border-orange-500/20'
                                : item.isUpcoming
                                  ? 'text-primary bg-primary/10 border-primary/20'
                                  : 'text-outline bg-transparent border-outline/20'
                          )}>
                            {item.status === 'PAID' && (
                              <CheckCircle size={11} fill="currentColor" className="text-green-600" />
                            )}
                            {item.isUpcoming && isOverdue ? 'OVERDUE' : item.status}
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </AnimatePresence>
              </table>

              {/* ── Show more/less controls ── */}
              {!showAllSchedule && hiddenCount > 0 && (
                <button
                  onClick={() => setShowAllSchedule(true)}
                  className="w-full py-3 text-[11px] font-bold text-primary uppercase tracking-widest text-center
                    hover:bg-white/5 transition-colors border-t border-surface-bright/10 flex items-center justify-center gap-1"
                >
                  <ChevronRight size={13} className="rotate-90" />
                  {pendingCount - 1} more upcoming installment{pendingCount - 1 !== 1 ? 's' : ''}
                </button>
              )}
              {showAllSchedule && pendingCount > SCHEDULE_PAGE_SIZE && (
                <button
                  onClick={() => setShowAllSchedule(false)}
                  className="w-full py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest text-center
                    hover:bg-white/5 transition-colors border-t border-surface-bright/10"
                >
                  Show Less
                </button>
              )}
            </div>

            {/* ── Next payment reminder chip ── */}
            {nextPayment && !isOverdue && (
              <div className="flex items-center gap-2 px-1">
                <CalendarClock size={13} className="text-primary shrink-0" />
                <p className="text-[11px] text-on-surface-variant">
                  Next installment of{' '}
                  <span className="text-primary font-bold">{nextPayment.amount}</span>{' '}
                  due on <span className="font-semibold text-on-surface">{nextPayment.date}</span>
                </p>
              </div>
            )}

            {/* ── Overpay row — only shown when loan is closed ── */}
            {overpayRow && isClosed && (
              <div className="bg-primary/5 border border-primary/20 rounded-2xl px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-primary uppercase tracking-widest">Overpayment Credit</p>
                  <p className="text-[10px] text-on-surface-variant mt-0.5 leading-relaxed">
                    Excess payment above total payable — to be refunded or applied to next loan.
                  </p>
                </div>
                <p className="font-headline font-extrabold text-primary text-base shrink-0 ml-4">
                  {overpayRow.amount}
                </p>
              </div>
            )}
          </section>
        )}

        {/* ── Notes ── */}
        {loan.notes && (
          <section className="bg-surface-container-low p-5 rounded-2xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Notes</p>
            <p className="text-sm text-on-surface leading-relaxed">{loan.notes}</p>
          </section>
        )}

        {/* ── Loan Documents ── */}
        <section className="bg-surface-container-low rounded-2xl overflow-hidden">
          <div className="px-5 pt-5 pb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              Submitted Documents
            </p>
          </div>
          <LoanDocuments loanId={Number(id)} />
        </section>

      </main>

      <BottomNav />

      {/* ── Payment History Modal ── */}
      {showAllPayments && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowAllPayments(false)}
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative bg-background rounded-t-3xl max-h-[80vh] flex flex-col shadow-2xl"
          >
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-outline-variant" />
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20 shrink-0">
              <div>
                <h3 className="text-base font-headline font-bold text-on-surface">Payment History</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {payments.length} total payment{payments.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => setShowAllPayments(false)}
                className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center active:scale-90 transition-transform"
              >
                <X size={16} className="text-on-surface-variant" />
              </button>
            </div>
            <div className="grid grid-cols-3 px-6 py-3 bg-surface-container-low shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Date</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-center">Amount</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Method</span>
            </div>
            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
              {payments.map((p) => (
                <div key={p.payment_id}
                  className="grid grid-cols-3 py-3 px-4 rounded-2xl bg-surface-container-low items-center">
                  <div>
                    <p className="text-xs font-semibold text-on-surface">
                      {new Date(p.payment_date ?? p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                    <p className="text-[10px] text-on-surface-variant">
                      {new Date(p.payment_date ?? p.created_at).getFullYear()}
                    </p>
                  </div>
                  <p className="text-xs font-headline font-bold text-primary text-center">
                    ₱ {fmt(Number(p.amount))}
                  </p>
                  <div className="flex justify-end">
                    <span className="text-[10px] font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full uppercase tracking-wider">
                      {p.method ?? 'Cash'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="h-6 shrink-0" />
          </motion.div>
        </div>
      )}

    </div>
  );
}