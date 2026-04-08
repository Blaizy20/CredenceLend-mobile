import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, DollarSign, CreditCard, Wallet, Loader2, AlertCircle } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { motion } from 'motion/react';
import { cn } from '@/src/lib/utils';

export default function PaymentOptions() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loan, setLoan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOption, setSelectedOption] = useState<'installment' | 'full' | 'custom'>('installment');
  const [customAmount, setCustomAmount] = useState('');
  const [error, setError] = useState('');

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
        <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
      </div>
    );
  }

  const rate = Number(loan.interest || 3.5) / 100;
  const installments = Number(loan.installments || 12);
  const totalAmountWithInterest = loan.totalAmount || (Number(loan.amount) + (Number(loan.amount) * rate * installments));
  const installmentAmount = totalAmountWithInterest / installments;
  const remainingBalance = Number(loan.balance || totalAmountWithInterest);
  
  // Calculate partial payment for the upcoming installment
  const totalPaidAmount = totalAmountWithInterest - remainingBalance;
  const partialPayment = totalPaidAmount % installmentAmount;
  const amountDue = remainingBalance <= 0 ? 0 : Math.max(0, installmentAmount - (partialPayment > 0.01 ? partialPayment : 0));

  const handleContinue = () => {
    let amount = 0;
    let type = selectedOption;

    if (selectedOption === 'installment') {
      amount = amountDue;
    } else if (selectedOption === 'full') {
      amount = remainingBalance;
    } else {
      const val = Number(customAmount);
      if (!customAmount || isNaN(val) || val < amountDue) {
        setError(`Amount must be at least P ${Number(amountDue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        return;
      }
      if (val > remainingBalance) {
        setError(`Amount cannot exceed the remaining balance of P ${Number(remainingBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        return;
      }
      amount = val;
    }

    navigate(`/payment/${id}?amount=${amount}&type=${type}`);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      <TopBar title="Payment Options" />
      
      <main className="w-full max-w-md px-6 pt-24 pb-32 flex-1">
        <div className="mb-8">
          <h2 className="text-2xl font-headline font-extrabold text-on-surface mb-2">How do you want to pay?</h2>
          <p className="text-on-surface-variant text-sm">Choose from the payment options or enter amount below.</p>
        </div>

        <div className="space-y-4">
          {/* Option 1: Installment */}
          <button 
            onClick={() => { setSelectedOption('installment'); setError(''); }}
            className={cn(
              "w-full p-5 rounded-2xl border-2 transition-all flex items-center justify-between text-left",
              selectedOption === 'installment' ? "border-primary bg-primary/5" : "border-outline-variant/30 bg-surface-container-low"
            )}
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Amount Due</p>
              <p className="font-headline font-bold text-xl text-on-surface">P {Number(amountDue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-xs text-on-surface-variant mt-1">
                {partialPayment > 0.01 ? 'Remaining for this installment' : 'Regular monthly installment'}
              </p>
            </div>
            <div className={cn(
              "w-6 h-6 rounded-full border-2 flex items-center justify-center",
              selectedOption === 'installment' ? "border-primary bg-primary" : "border-outline-variant"
            )}>
              {selectedOption === 'installment' && <div className="w-2 h-2 bg-white rounded-full" />}
            </div>
          </button>

          {/* Option 2: Full Settlement */}
          <button 
            onClick={() => { setSelectedOption('full'); setError(''); }}
            className={cn(
              "w-full p-5 rounded-2xl border-2 transition-all flex items-center justify-between text-left",
              selectedOption === 'full' ? "border-primary bg-primary/5" : "border-outline-variant/30 bg-surface-container-low"
            )}
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Remaining Balance</p>
              <p className="font-headline font-bold text-xl text-on-surface">P {Number(remainingBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-xs text-on-surface-variant mt-1">Pay off your entire loan</p>
            </div>
            <div className={cn(
              "w-6 h-6 rounded-full border-2 flex items-center justify-center",
              selectedOption === 'full' ? "border-primary bg-primary" : "border-outline-variant"
            )}>
              {selectedOption === 'full' && <div className="w-2 h-2 bg-white rounded-full" />}
            </div>
          </button>

          {/* Option 3: Custom Amount */}
          <div className={cn(
            "w-full p-5 rounded-2xl border-2 transition-all",
            selectedOption === 'custom' ? "border-primary bg-primary/5" : "border-outline-variant/30 bg-surface-container-low"
          )}>
            <button 
              onClick={() => { setSelectedOption('custom'); setError(''); }}
              className="w-full flex items-center justify-between text-left mb-4"
            >
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Enter Amount</p>
                <p className="text-xs text-on-surface-variant">Pay any amount you prefer</p>
              </div>
              <div className={cn(
                "w-6 h-6 rounded-full border-2 flex items-center justify-center",
                selectedOption === 'custom' ? "border-primary bg-primary" : "border-outline-variant"
              )}>
                {selectedOption === 'custom' && <div className="w-2 h-2 bg-white rounded-full" />}
              </div>
            </button>
            
            {selectedOption === 'custom' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
              >
                <Input 
                  placeholder="0.00"
                  type="number"
                  value={customAmount}
                  onChange={(e) => { setCustomAmount(e.target.value); setError(''); }}
                  icon={<span className="font-bold">P</span>}
                  error={error}
                />
                <p className="text-[10px] text-on-surface-variant mt-2 italic">Note: Amount must not be less than the amount due (P {Number(installmentAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</p>
              </motion.div>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-error/10 rounded-xl flex items-center gap-2 text-error text-xs font-medium">
            <AlertCircle size={16} />
            <span>{error}</span>
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
