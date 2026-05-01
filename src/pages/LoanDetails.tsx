import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Percent, Clock, ChevronRight, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { BottomNav } from '../components/BottomNav';
import { cn } from '@/src/lib/utils';
import { motion } from 'motion/react';
import { loansAPI } from '../lib/api';

const statusStyle: Record<string, string> = {
  active:  'bg-green-500/10 text-green-500 border-green-500/20',
  pending: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  paid:    'bg-primary/10 text-primary border-primary/20',
  denied:  'bg-red-500/10 text-red-500 border-red-500/20',
  closed:  'bg-outline/10 text-outline border-outline/20',
};

const getStatusStyle = (status: string) =>
  statusStyle[status?.toLowerCase()] ?? 'bg-outline/10 text-outline border-outline/20';

export default function LoanDetails() {
  const navigate = useNavigate();
  const { id }   = useParams();

  const [loan, setLoan]               = useState<any>(null);
  const [payments, setPayments]       = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [showAllSchedule, setShowAllSchedule] = useState(false);

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

        if (!loanData || loanData.success === false || !loanData.loan) {
          setError(loanData?.message || 'Loan not found.');
          return;
        }

        setLoan(loanData.loan);
        setPayments(Array.isArray(paymentData.payments) ? paymentData.payments : []);
      } catch {
        setError('Unable to load loan details. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
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

  // ── Derived values ────────────────────────────────────────────────────────
  const principal      = Number(loan.principal_amount   ?? 0);
  const interestRate   = Number(loan.interest_rate      ?? 0);
  const termMonths     = Number(loan.term_months        ?? 1);
  const totalPayable   = Number(loan.total_payable      ?? principal);
  const remainingBal   = Number(loan.remaining_balance  ?? totalPayable);
  const paidAmount     = totalPayable - remainingBal;
  const progress       = totalPayable > 0 ? (paidAmount / totalPayable) * 100 : 0;
  const isFullyPaid    = loan.status?.toLowerCase() === 'paid' || remainingBal <= 0;
  const paymentTerm    = loan.payment_term ?? '';

  // ── Schedule generator ────────────────────────────────────────────────────
  const generateSchedule = () => {
    const startDate  = loan.activated_at
      ? new Date(loan.activated_at)
      : loan.created_at
        ? new Date(loan.created_at)
        : new Date();

    const installmentAmt = termMonths > 0 ? totalPayable / termMonths : totalPayable;

    // Figure out how many installments are paid from payments total
    const totalPaid      = payments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
    const paidCount      = installmentAmt > 0 ? Math.floor(totalPaid / installmentAmt) : 0;

    const schedule = [];
    for (let i = 0; i < termMonths; i++) {
      const date = new Date(startDate);
      const term = paymentTerm.toLowerCase();
      if (term.includes('daily'))        date.setDate(date.getDate() + i);
      else if (term.includes('weekly'))  date.setDate(date.getDate() + i * 7);
      else if (term.includes('semi'))    date.setDate(date.getDate() + i * 15);
      else                               date.setMonth(date.getMonth() + i);

      schedule.push({
        date:       date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        amount:     `₱ ${installmentAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        status:     i < paidCount ? 'PAID' : 'PENDING',
        isUpcoming: i === paidCount,
      });
    }

    return showAllSchedule ? schedule : schedule.slice(0, 6);
  };

  const schedule = generateSchedule();
  const nextPayment = schedule.find(s => s.status === 'PENDING');

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopBar
        title="Loan Details"
        onBack={() => navigate('/dashboard')}
      />

      <main className="pt-20 px-4 space-y-6 max-w-lg mx-auto">

        {/* Fully Paid Banner */}
        {isFullyPaid && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-green-500/10 border border-green-500/20 p-4 rounded-2xl flex items-center gap-3"
          >
            <div className="bg-green-500 rounded-full p-1">
              <CheckCircle size={16} className="text-white" />
            </div>
            <p className="text-green-500 font-headline font-bold text-sm tracking-tight">
              This loan is fully paid. Congratulations!
            </p>
          </motion.div>
        )}

        {/* Denial Reason */}
        {loan.status?.toLowerCase() === 'denied' && loan.denial_reason && (
          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-start gap-3">
            <AlertCircle className="text-red-500 mt-0.5 shrink-0" size={18} />
            <div>
              <p className="text-red-500 font-bold text-sm">Application Denied</p>
              <p className="text-red-400 text-xs mt-1">{loan.denial_reason}</p>
            </div>
          </div>
        )}

        {/* Pay Button — active loans only */}
        {loan.status?.toLowerCase() === 'active' && !isFullyPaid && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <button
              onClick={() => navigate(`/loan/${id}/pay`)}
              className="w-full py-4 rounded-2xl bg-primary text-on-primary font-headline font-extrabold text-base flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-transform"
            >
              Make a Payment
              <ChevronRight size={20} />
            </button>
          </motion.div>
        )}

        {/* Hero Card */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
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
              ₱ {remainingBal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
          </div>
          <div className="relative z-10 flex items-end justify-between">
            <div>
              <p className="text-on-surface-variant text-xs mb-1">Principal Amount</p>
              <p className="font-headline font-bold text-lg">
                ₱ {principal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
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

        {/* Reference & Term Info */}
        <section className="bg-surface-container-low p-5 rounded-2xl space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
            Loan Information
          </p>
          {[
            { label: 'Reference No.',  value: loan.reference_no    ?? '—' },
            { label: 'Payment Term',   value: paymentTerm          || '—' },
            { label: 'Collateral',     value: loan.collateral_type ?? '—' },
            { label: 'ID Type',        value: loan.id_type         ?? '—' },
            { label: 'Applied On',     value: loan.created_at
                ? new Date(loan.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                : '—'
            },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-on-surface-variant">{label}</span>
              <span className="font-semibold text-on-surface text-right max-w-[60%] truncate">{value}</span>
            </div>
          ))}
        </section>

        {/* Stats Grid */}
        <section className="grid grid-cols-2 gap-4">
          <div className="bg-surface-container p-5 rounded-2xl flex flex-col justify-between min-h-[110px]">
            <div className="flex items-center gap-2 text-on-surface-variant mb-4">
              <Percent size={14} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Interest</span>
            </div>
            <p className="font-headline font-bold text-xl">
              {interestRate}% <span className="text-xs font-normal text-on-surface-variant">Rate</span>
            </p>
          </div>
          <div className="bg-surface-container p-5 rounded-2xl flex flex-col justify-between min-h-[110px]">
            <div className="flex items-center gap-2 text-on-surface-variant mb-4">
              <Clock size={14} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Term</span>
            </div>
            <p className="font-headline font-bold text-xl">
              {termMonths} <span className="text-xs font-normal text-on-surface-variant">Installments</span>
            </p>
          </div>
        </section>

        {/* Progress */}
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
            <span>₱ {paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Paid</span>
            <span>₱ {totalPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Total</span>
          </div>
        </section>

        {/* Payment History */}
        {payments.length > 0 && (
          <section className="space-y-3">
            <h3 className="font-headline font-bold text-lg tracking-tight px-1">Payment History</h3>
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
                  {payments.map((p) => (
                    <tr key={p.payment_id} className="hover:bg-white/5 transition-colors">
                      <td className="px-5 py-4 text-sm font-semibold">
                        {new Date(p.payment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-4 text-sm font-headline font-bold text-primary">
                        ₱ {Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-surface-container text-on-surface-variant uppercase">
                          {p.method ?? 'Cash'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Loan Schedule */}
        {loan.status?.toLowerCase() === 'active' && schedule.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="font-headline font-bold text-lg tracking-tight">Loan Schedule</h3>
              {termMonths > 6 && (
                <button
                  onClick={() => setShowAllSchedule(!showAllSchedule)}
                  className="text-primary text-xs font-bold uppercase tracking-widest flex items-center gap-1"
                >
                  {showAllSchedule ? 'Show Less' : 'View All'}
                  <ChevronRight size={14} className={cn('transition-transform', showAllSchedule && 'rotate-90')} />
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
                <tbody className="divide-y divide-surface-bright/10">
                  {schedule.map((item, i) => (
                    <tr key={i} className="hover:bg-white/5 transition-colors">
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold">{item.date}</p>
                        {item.isUpcoming && (
                          <p className="text-[9px] text-primary font-bold uppercase mt-1">Upcoming</p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-headline font-bold">{item.amount}</p>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className={cn(
                          'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full',
                          item.status === 'PAID'
                            ? 'text-primary bg-primary/10 border border-primary/20'
                            : 'text-outline bg-white/5 border border-white/10'
                        )}>
                          {item.status === 'PAID' && <CheckCircle size={12} fill="currentColor" className="text-primary" />}
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Notes */}
        {loan.notes && (
          <section className="bg-surface-container-low p-5 rounded-2xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Notes</p>
            <p className="text-sm text-on-surface leading-relaxed">{loan.notes}</p>
          </section>
        )}
      </main>

      <BottomNav />
    </div>
  );
}