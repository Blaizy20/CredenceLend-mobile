import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MoreVertical, Percent, Clock, ChevronRight, CheckCircle, Loader2 } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { BottomNav } from '../components/BottomNav';
import { cn } from '@/src/lib/utils';
import { motion } from 'motion/react';

export default function LoanDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loan, setLoan] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [showAllSchedule, setShowAllSchedule] = useState(false);

  useEffect(() => {
    if (id) {
      // Load from localStorage
      let allLoans = [];
      try {
        allLoans = JSON.parse(localStorage.getItem('applications') || '[]');
      } catch {}
      const found = allLoans.find((l) => l.id === id);
      setLoan(found || null);
      setLoading(false);
    }
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="text-primary animate-spin" size={48} />
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold mb-4">Loan Not Found</h2>
        <button 
          onClick={() => navigate('/dashboard')}
          className="bg-primary text-on-primary px-6 py-2 rounded-full font-bold"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const rate = Number(loan.interest || 3.5) / 100;
  const installments = Number(loan.installments || 12);
  const totalAmountWithInterest = loan.totalAmount || (Number(loan.amount) + (Number(loan.amount) * rate * installments));
  const remainingBalance = loan.balance !== undefined ? Number(loan.balance) : totalAmountWithInterest;
  const paidAmount = totalAmountWithInterest - remainingBalance;
  const progress = (paidAmount / totalAmountWithInterest) * 100;
  const isFullyPaid = loan.status === 'Paid' || remainingBalance <= 0;

  const generateSchedule = () => {
    // Always generate a schedule based on loan start date
    let startDate = loan.nextPayment ? new Date(loan.nextPayment) : (loan.submittedAt ? new Date(loan.submittedAt) : new Date());
    const schedule = [];
    const installmentAmount = totalAmountWithInterest / loan.installments;
    const paidInstallments = loan.paidInstallments || 0;
    for (let i = 0; i < loan.installments; i++) {
      const date = new Date(startDate);
      const term = loan.term?.toLowerCase() || '';
      if (term.includes('daily')) {
        date.setDate(date.getDate() + i);
      } else if (term.includes('weekly')) {
        date.setDate(date.getDate() + (i * 7));
      } else if (term.includes('semi')) {
        date.setDate(date.getDate() + (i * 15));
      } else if (term.includes('month')) {
        date.setMonth(date.getMonth() + i);
      }
      const isPaid = i < paidInstallments;
      let displayAmount = installmentAmount;
      let status = isPaid ? 'PAID' : 'PENDING';
      schedule.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        amount: `P ${Number(displayAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        status: status,
        isUpcoming: i === paidInstallments
      });
    }
    if (showAllSchedule) return schedule;
    return schedule.slice(0, 6);
  };

  const schedule = generateSchedule();

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopBar 
        title="Loan Details" 
        onBack={() => navigate('/dashboard')}
        rightElement={<button className="p-2 text-outline"><MoreVertical size={24} /></button>} 
      />
      
      <main className="pt-20 px-4 space-y-6 max-w-lg mx-auto">
        {/* File Attachments Section */}
        {(loan.idFront || loan.idBack || loan.collateralProof || (loan.otherDocs && loan.otherDocs.length > 0)) && (
          <section className="bg-surface-container-low p-4 rounded-2xl mb-4">
            <h3 className="font-headline font-bold text-sm mb-2 text-primary">File Attachments</h3>
            <div className="flex flex-wrap gap-4">
              {loan.idFront && (
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-on-surface-variant mb-1">ID Front</span>
                  <img src={loan.idFront} alt="ID Front" className="w-20 h-14 object-contain rounded border border-green-200" />
                </div>
              )}
              {loan.idBack && (
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-on-surface-variant mb-1">ID Back</span>
                  <img src={loan.idBack} alt="ID Back" className="w-20 h-14 object-contain rounded border border-green-200" />
                </div>
              )}
              {loan.collateralProof && (
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-on-surface-variant mb-1">Collateral Proof</span>
                  <img src={loan.collateralProof} alt="Collateral Proof" className="w-20 h-14 object-contain rounded border border-green-200" />
                </div>
              )}
              {loan.otherDocs && loan.otherDocs.map && loan.otherDocs.map((doc: string, idx: number) => doc && (
                <div key={idx} className="flex flex-col items-center">
                  <span className="text-[10px] text-on-surface-variant mb-1">Other Doc {idx + 1}</span>
                  <img src={doc} alt={`Other Doc ${idx + 1}`} className="w-20 h-14 object-contain rounded border border-green-200" />
                </div>
              ))}
            </div>
          </section>
        )}
        {/* Fully Paid Message */}
        {isFullyPaid && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-green-500/10 border border-green-500/20 p-4 rounded-2xl flex items-center gap-3"
          >
            <div className="bg-green-500 rounded-full p-1">
              <CheckCircle size={16} className="text-white" />
            </div>
            <p className="text-green-500 font-headline font-bold text-sm tracking-tight">This loan is fully paid. Congratulations!</p>
          </motion.div>
        )}

        {/* Hero Section */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl bg-surface-container-high p-6 flex flex-col justify-between aspect-[16/10] shadow-xl"
        >
          <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-primary/10 blur-[80px] rounded-full"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-start">
              <span className="text-on-surface-variant font-medium tracking-wide uppercase text-xs">Remaining Balance</span>
              <span className={cn(
                "px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase border",
                loan.status === 'Active' ? "bg-green-500/10 text-green-500 border-green-500/20" : 
                loan.status === 'Pending' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                loan.status === 'Paid' ? "bg-primary/10 text-primary border-primary/20" :
                "bg-outline/10 text-outline border-outline/20"
              )}>{loan.status}</span>
            </div>
            <h2 className="font-headline font-extrabold text-4xl mt-2 tracking-tight">P {Number(remainingBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
          </div>
          <div className="relative z-10 flex items-end justify-between">
            <div>
              <p className="text-on-surface-variant text-xs mb-1">Total Loan Amount</p>
              <p className="font-headline font-bold text-lg">P {Number(loan.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="text-right">
              <p className="text-on-surface-variant text-xs mb-1">Next Payment</p>
              <p className="font-headline font-bold text-lg">
                {(() => {
                  // Find the next unpaid installment
                  const schedule = generateSchedule();
                  const next = schedule.find(item => item.status === 'PENDING');
                  return next ? next.date : '';
                })()}
              </p>
            </div>
          </div>
        </motion.section>

        {/* Stats Grid */}
        <section className="grid grid-cols-2 gap-4">
          <div className="bg-surface-container p-5 rounded-2xl flex flex-col justify-between min-h-[110px]">
            <div className="flex items-center gap-2 text-on-surface-variant mb-4">
              <Percent size={14} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Interest</span>
            </div>
            <p className="font-headline font-bold text-xl">{loan.interest}% <span className="text-xs font-normal text-on-surface-variant">Rate</span></p>
          </div>
          <div className="bg-surface-container p-5 rounded-2xl flex flex-col justify-between min-h-[110px]">
            <div className="flex items-center gap-2 text-on-surface-variant mb-4">
              <Clock size={14} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Term</span>
            </div>
            <p className="font-headline font-bold text-xl">{loan.installments} <span className="text-xs font-normal text-on-surface-variant">Installments</span></p>
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
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-primary-dim to-primary rounded-full shadow-[0_0_15px_rgba(132,173,255,0.4)]"
            />
          </div>
          <div className="mt-4 flex justify-between text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            <span>P {Number(paidAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Paid</span>
            <span>P {Number(totalAmountWithInterest).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Total</span>
          </div>
        </section>

        {/* Schedule */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-headline font-bold text-lg tracking-tight">Loan Schedule</h3>
            <button 
              onClick={() => setShowAllSchedule(!showAllSchedule)}
              className="text-primary text-xs font-bold uppercase tracking-widest flex items-center gap-1"
            >
              {showAllSchedule ? 'Show Less' : 'View All'} <ChevronRight size={14} className={cn("transition-transform", showAllSchedule && "rotate-90")} />
            </button>
          </div>
          <div className="bg-surface-container-low rounded-3xl overflow-hidden shadow-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-bright/30">
                  <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Due Date</th>
                  <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Amount Due</th>
                  <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-bright/10">
                {schedule.map((item, i) => (
                  <tr key={i} className="hover:bg-white/5 transition-colors">
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold">{item.date}</p>
                      {item.isUpcoming && <p className="text-[9px] text-primary font-bold uppercase mt-1">Upcoming</p>}
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-headline font-bold">{item.amount}</p>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className={cn(
                        "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full",
                        item.status === 'PAID' ? "text-primary bg-primary/10 border border-primary/20" : "text-outline bg-white/5 border border-white/10"
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

        {/* Actions */}
        <section className="space-y-3 pt-4">
          {loan.status === 'Active' && (
            <button 
              onClick={() => navigate(`/payment-options/${loan.id}`)}
              className="w-full bg-gradient-to-r from-primary-dim to-primary text-on-primary py-4 rounded-full font-headline font-bold text-sm tracking-wide shadow-[0_10px_30px_rgba(132,173,255,0.3)] active:scale-[0.98] transition-all"
            >
              PAY NOW
            </button>
          )}
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
