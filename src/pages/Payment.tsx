import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Copy, Store, Landmark, Wallet, CreditCard, CheckCircle, ShieldCheck, Loader2 } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { Button } from '../components/Button';
import { motion } from 'motion/react';
import { cn } from '@/src/lib/utils';

export default function Payment() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const [loan, setLoan] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [selectedMethod, setSelectedMethod] = useState('wallet');

  const queryParams = new URLSearchParams(location.search);
  const paymentType = queryParams.get('type') || 'installment';
  const queryAmount = queryParams.get('amount');

  useEffect(() => {
    if (id) {
      let allLoans = [];
      try {
        allLoans = JSON.parse(localStorage.getItem('applications') || '[]');
      } catch {}
      const found = allLoans.find((l) => l.id === id);
      setLoan(found || null);
      setLoading(false);
    }
  }, [id]);

  const methods = [
    { id: 'walkin', label: 'Walk-in', sub: 'Over-the-counter or Partners', icon: Store },
    { id: 'bank', label: 'Bank Transfer', sub: 'BPI, BDO, UnionBank & more', icon: Landmark },
    { id: 'wallet', label: 'E-wallet', sub: 'GCash, Maya, ShopeePay', icon: Wallet, isFast: true },
    { id: 'card', label: 'Card', sub: 'Visa, Mastercard, JCB', icon: CreditCard },
  ];

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
  const installmentAmount = totalAmountWithInterest / installments;
  const remainingBalance = Number(loan.balance || totalAmountWithInterest);
  
  const totalPaidAmount = totalAmountWithInterest - remainingBalance;
  const partialPayment = totalPaidAmount % installmentAmount;
  const calculatedAmountDue = Math.max(0, installmentAmount - (partialPayment > 0.01 ? partialPayment : 0));
  
  const dueAmount = queryAmount ? Number(queryAmount) : (paymentType === 'full' ? remainingBalance : calculatedAmountDue);

  const handlePayment = () => {
    setLoading(true);
    setTimeout(() => {
      // Update loan in localStorage
      let allLoans = [];
      try {
        allLoans = JSON.parse(localStorage.getItem('applications') || '[]');
      } catch {}
      const idx = allLoans.findIndex((l) => l.id === loan.id);
      if (idx !== -1) {
        let updatedLoan = { ...allLoans[idx] };
        // Update balance and paidInstallments
        let balance = updatedLoan.balance !== undefined ? Number(updatedLoan.balance) : totalAmountWithInterest;
        let paidInstallments = updatedLoan.paidInstallments || 0;
        if (paymentType === 'full' || dueAmount >= balance) {
          balance = 0;
          updatedLoan.status = 'Paid';
        } else {
          balance = Math.max(0, balance - dueAmount);
          paidInstallments = (paidInstallments || 0) + 1;
        }
        updatedLoan.balance = balance;
        updatedLoan.paidInstallments = paidInstallments;
        // Update nextPayment date
        if (updatedLoan.nextPayment) {
          const nextDate = new Date(updatedLoan.nextPayment);
          const term = updatedLoan.term?.toLowerCase() || '';
          if (term.includes('daily')) {
            nextDate.setDate(nextDate.getDate() + 1);
          } else if (term.includes('weekly')) {
            nextDate.setDate(nextDate.getDate() + 7);
          } else if (term.includes('semi-monthly')) {
            nextDate.setDate(nextDate.getDate() + 15);
          } else {
            nextDate.setMonth(nextDate.getMonth() + 1);
          }
          updatedLoan.nextPayment = nextDate.toISOString();
        }
        allLoans[idx] = updatedLoan;
        localStorage.setItem('applications', JSON.stringify(allLoans));
        // Add transaction
        let txns = [];
        try {
          txns = JSON.parse(localStorage.getItem('transactions') || '[]');
        } catch {}
        const storedUser = localStorage.getItem('user');
        let username = '';
        if (storedUser) {
          try { username = JSON.parse(storedUser).username; } catch {}
        }
        txns.push({
          id: 'TXN-' + Date.now(),
          userId: username,
          loanId: loan.id,
          type: 'Loan Payment',
          amount: dueAmount,
          date: new Date().toISOString(),
          status: 'Completed',
        });
        localStorage.setItem('transactions', JSON.stringify(txns));
      }
      setLoading(false);
      navigate(`/loan/${loan.id}`);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      <TopBar title="Loan Payment" />
      
      <main className="w-full max-w-md px-6 pt-24 pb-32 flex-1">
        {/* Loan Summary Card */}
        <section className="mb-8">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface-container-highest rounded-xl p-6 shadow-2xl border border-outline-variant/10"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-on-surface-variant text-xs font-medium uppercase tracking-widest mb-1">Due Amount</p>
                <h2 className="font-headline font-extrabold text-3xl text-primary tracking-tight">P {Number(dueAmount).toLocaleString()}</h2>
              </div>
              <div className="bg-primary/10 px-3 py-1 rounded-full">
                <p className="text-primary text-[10px] font-bold uppercase tracking-wider">
                  {paymentType === 'full' ? 'Full Settlement' : `Installment ${(loan.paidInstallments || 0) + 1}`}
                </p>
              </div>
            </div>
            <div className="pt-4 mt-4 border-t border-outline-variant/10 flex justify-between items-center">
              <div>
                <p className="text-on-surface-variant text-[10px] uppercase tracking-wider">Reference Number</p>
                <p className="font-mono text-sm text-on-surface">{loan.id}</p>
              </div>
              <Copy className="text-on-surface-variant" size={16} />
            </div>
          </motion.div>
        </section>

        {/* Payment Methods */}
        <section>
          <h3 className="font-headline font-bold text-lg text-on-surface mb-4 px-1">Payment Methods</h3>
          <div className="space-y-3">
            {methods.map((method) => (
              <button 
                key={method.id}
                onClick={() => setSelectedMethod(method.id)}
                className={cn(
                  "w-full flex items-center justify-between p-4 bg-surface-container-high rounded-xl transition-all border active:scale-[0.98]",
                  selectedMethod === method.id ? "border-primary/30 ring-1 ring-primary/20" : "border-transparent hover:bg-surface-bright"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center",
                    selectedMethod === method.id ? "bg-primary/10" : "bg-surface-container-highest"
                  )}>
                    <method.icon className="text-primary" size={24} />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-on-surface">{method.label}</p>
                      {method.isFast && (
                        <span className="bg-primary-container/20 text-primary text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter">Fast</span>
                      )}
                    </div>
                    <p className="text-xs text-on-surface-variant">{method.sub}</p>
                  </div>
                </div>
                {selectedMethod === method.id && <CheckCircle className="text-primary" size={20} fill="currentColor" />}
              </button>
            ))}
          </div>
        </section>

        {/* Security Card */}
        <section className="mt-8">
          <div className="relative overflow-hidden rounded-2xl h-32 bg-surface-container-low group">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-900/40 to-transparent z-10"></div>
            <img 
              src="https://picsum.photos/seed/security/600/200" 
              alt="Security" 
              className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-60"
              referrerPolicy="no-referrer"
            />
            <div className="relative z-20 p-5 h-full flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="text-primary" size={16} />
                <p className="text-primary font-headline font-bold text-sm">Security Guaranteed</p>
              </div>
              <p className="text-on-surface-variant text-xs max-w-[200px]">Your transactions are protected with military-grade encryption.</p>
            </div>
          </div>
        </section>
      </main>

      <div className="fixed bottom-0 left-0 w-full bg-background/80 backdrop-blur-xl pt-4 pb-10 px-6 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.4)]">
        <div className="max-w-md mx-auto">
          <Button onClick={handlePayment} disabled={loading}>
            {loading ? 'Processing...' : 'Confirm Payment'}
          </Button>
        </div>
      </div>
    </div>
  );
}
