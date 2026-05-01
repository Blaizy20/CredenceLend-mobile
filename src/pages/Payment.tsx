import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Copy, Store, Landmark, Wallet, CreditCard, CheckCircle, ShieldCheck, Loader2, AlertCircle, CheckCircle2, LayoutDashboard, Receipt, AlertTriangle, ExternalLink } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { Button } from '../components/Button';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { loansAPI } from '../lib/api';

const METHODS = [
  { id: 'walkin',  label: 'Walk-in',       sub: 'Over-the-counter at the cooperative', icon: Store      },
  { id: 'bank',    label: 'Bank Transfer', sub: 'BPI, BDO, UnionBank & more',           icon: Landmark   },
  { id: 'wallet',  label: 'E-wallet',      sub: 'GCash, Maya, ShopeePay',              icon: Wallet,    isFast: true },
  { id: 'card',    label: 'Card',          sub: 'Visa, Mastercard, JCB',               icon: CreditCard },
];

const METHOD_INSTRUCTIONS: Record<string, { title: string; steps: string[] }> = {
  walkin: {
    title: 'Walk-in Payment Instructions',
    steps: [
      'Visit the cooperative office during business hours.',
      'Present your reference number to the cashier.',
      'Pay the exact amount and request an Official Receipt.',
      'Your account will be updated within 24 hours.',
    ],
  },
  bank: {
    title: 'Bank Transfer Instructions',
    steps: [
      'Log in to your online banking app.',
      'Transfer the exact amount to the cooperative\'s account.',
      'Use your reference number as the transaction remarks.',
      'Send your proof of payment to the cooperative.',
    ],
  },
  wallet: {
    title: 'E-wallet Payment Instructions',
    steps: [
      'Open your GCash, Maya, or ShopeePay app.',
      'Send the exact amount to the cooperative\'s registered number.',
      'Use your reference number as the message/note.',
      'Send your screenshot as proof of payment.',
    ],
  },
  card: {
    title: 'Card Payment Instructions',
    steps: [
      'Visit the cooperative office or accredited payment center.',
      'Present your card and reference number.',
      'Authorize the payment for the exact amount.',
      'Keep your transaction receipt for your records.',
    ],
  },
};

const METHOD_LABELS: Record<string, string> = {
  walkin: 'Preparing Walk-in Details',
  bank:   'Preparing Bank Transfer Details',
  wallet: 'Preparing E-wallet Details',
  card:   'Preparing Card Payment Details',
};

export default function Payment() {
  const navigate = useNavigate();
  const { id }   = useParams();
  const location = useLocation();

  const [loan, setLoan]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [copied, setCopied]   = useState(false);

  const [selectedMethod, setSelectedMethod] = useState('walkin');
  const [showConfirm, setShowConfirm]       = useState(false);

  // 'idle' | 'loading' | 'done'
  const [successStep, setSuccessStep] = useState<'idle' | 'loading' | 'done'>('idle');

  const query       = new URLSearchParams(location.search);
  const dueAmount   = Number(query.get('amount') ?? 0);
  const paymentType = query.get('type') ?? 'installment';

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const loanData = await loansAPI.getLoan(Number(id));
        if (!loanData || loanData.success === false || !loanData.loan) {
          setError(loanData?.message || 'Loan not found.');
          return;
        }
        setLoan(loanData.loan);
      } catch {
        setError('Unable to load loan details. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleCopy = () => {
    if (!loan?.reference_no) return;
    navigator.clipboard.writeText(loan.reference_no).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleConfirmed = async () => {
    // If it's a "live" method (wallet/card), we would normally call Paymongo here
    // For now, let's just record the payment in our system
    setSuccessStep('loading');

    try {
      const customer = JSON.parse(localStorage.getItem('customer') || '{}');
      const customerId = customer.customer_id || loan.customer_id;

      // If it's GCash, Maya, or Card, use Paymongo
      if (['wallet', 'card'].includes(selectedMethod)) {
        const checkoutRes = await loansAPI.createPaymongoCheckout(
          dueAmount,
          `Loan Payment for ${loan.reference_no}`,
          `${loan.reference_no}-${Date.now()}`,
          {
            loan_id: id,
            customer_id: customerId,
            payment_type: paymentType
          }
        );

        if (checkoutRes.success && checkoutRes.checkout_url) {
          // Open the Paymongo checkout URL
          window.location.href = checkoutRes.checkout_url;
          return;
        } else {
          setError(checkoutRes.message || 'Failed to initialize payment gateway.');
          setSuccessStep('idle');
          return;
        }
      }

      const res = await loansAPI.recordPayment(
        Number(id),
        customerId,
        dueAmount,
        selectedMethod
      );

      if (res.success) {
        setTimeout(() => setSuccessStep('done'), 1500);
      } else {
        setError(res.message || 'Payment failed.');
        setSuccessStep('idle');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
      setSuccessStep('idle');
    }
    setShowConfirm(false);
  };

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
        <button onClick={() => navigate('/dashboard')}
          className="bg-primary text-on-primary px-6 py-3 rounded-full font-bold">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const instructions = METHOD_INSTRUCTIONS[selectedMethod];
  const activeMethod = METHODS.find(m => m.id === selectedMethod)!;
  const MethodIcon   = activeMethod.icon;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      <TopBar title="Loan Payment" onBack={() => navigate(`/loan/${id}/pay`)} />

      <main className="w-full max-w-md px-6 pt-24 pb-36 flex-1 space-y-6">

        {/* Amount card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-container-highest rounded-2xl p-6 shadow-xl border border-outline-variant/10"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-on-surface-variant text-xs font-medium uppercase tracking-widest mb-1">
                Due Amount
              </p>
              <h2 className="font-headline font-extrabold text-3xl text-primary tracking-tight">
                ₱ {dueAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
            </div>
            <span className="bg-primary/10 px-3 py-1 rounded-full text-primary text-[10px] font-bold uppercase tracking-wider">
              {paymentType === 'full' ? 'Full Settlement' : 'Installment'}
            </span>
          </div>
          <div className="pt-4 border-t border-outline-variant/10 flex justify-between items-center">
            <div>
              <p className="text-on-surface-variant text-[10px] uppercase tracking-wider mb-0.5">Reference Number</p>
              <p className="font-mono text-sm text-on-surface font-semibold">{loan.reference_no}</p>
            </div>
            <button onClick={handleCopy}
              className="flex items-center gap-1.5 text-on-surface-variant active:text-primary transition-colors">
              {copied
                ? <CheckCircle size={16} className="text-green-500" />
                : <Copy size={16} />}
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {copied ? 'Copied' : 'Copy'}
              </span>
            </button>
          </div>
        </motion.div>

        {/* Payment methods */}
        <section className="space-y-3">
          <h3 className="font-headline font-bold text-on-surface-variant uppercase text-[10px] tracking-widest px-1">
            Select Payment Method
          </h3>
          {METHODS.map((method) => {
            const isSelected = selectedMethod === method.id;
            return (
              <button key={method.id} onClick={() => setSelectedMethod(method.id)}
                className={cn(
                  'w-full flex items-center justify-between p-4 rounded-2xl transition-all border active:scale-[0.98]',
                  isSelected
                    ? 'border-primary/30 bg-primary/5 ring-1 ring-primary/20'
                    : 'border-outline-variant/20 bg-surface-container-high hover:bg-surface-bright'
                )}>
                <div className="flex items-center gap-4">
                  <div className={cn(
                    'w-11 h-11 rounded-xl flex items-center justify-center',
                    isSelected ? 'bg-primary/10' : 'bg-surface-container-highest'
                  )}>
                    <method.icon className="text-primary" size={22} />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-on-surface">{method.label}</p>
                      {method.isFast && (
                        <span className="bg-primary/10 text-primary text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tight">
                          Fast
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-on-surface-variant">{method.sub}</p>
                  </div>
                </div>
                {isSelected && <CheckCircle className="text-primary shrink-0" size={20} fill="currentColor" />}
              </button>
            );
          })}
        </section>

        {/* Security note */}
        <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl p-4 flex items-center gap-3">
          <ShieldCheck className="text-primary shrink-0" size={20} />
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Your transactions are secured. Payment will be verified by the cooperative before updating your balance.
          </p>
        </div>
      </main>

      {/* CTA */}
      <div className="fixed bottom-0 left-0 w-full bg-background/80 backdrop-blur-xl pt-4 pb-10 px-6 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.4)]">
        <div className="max-w-md mx-auto">
          <Button onClick={() => setShowConfirm(true)}>
            Confirm Payment Method
          </Button>
        </div>
      </div>

      {/* ── Confirmation Bottom Sheet ── */}
      <AnimatePresence>
        {showConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowConfirm(false)}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 80 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 80 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-surface-container-low rounded-t-[2rem] shadow-2xl border-t border-white/5 max-w-md mx-auto"
            >
              <div className="p-6">
                {/* Handle */}
                <div className="w-10 h-1 bg-outline/30 rounded-full mx-auto mb-6" />

                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <MethodIcon size={24} />
                  </div>
                  <div>
                    <h3 className="font-headline font-bold text-xl text-on-surface">Confirm Payment</h3>
                    <p className="text-on-surface-variant text-xs">Review your payment details before proceeding</p>
                  </div>
                </div>

                {/* Payment summary */}
                <div className="mb-4 p-4 bg-primary/5 border border-primary/10 rounded-2xl space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3">Payment Summary</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">Amount</span>
                    <span className="font-extrabold text-primary text-base">
                      ₱ {dueAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">Type</span>
                    <span className="font-bold text-on-surface capitalize">
                      {paymentType === 'full' ? 'Full Settlement' : 'Installment'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">Reference No.</span>
                    <span className="font-bold text-on-surface font-mono">{loan.reference_no}</span>
                  </div>
                  <div className="border-t border-primary/10 my-1" />
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">Payment Method</span>
                    <div className="flex items-center gap-1.5">
                      <MethodIcon size={14} className="text-primary" />
                      <span className="font-bold text-on-surface">{activeMethod.label}</span>
                    </div>
                  </div>
                </div>

                {/* Disclaimer */}
                <div className="flex gap-3 p-3 bg-orange-500/5 border border-orange-500/10 rounded-xl mb-6">
                  <AlertTriangle size={16} className="text-orange-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    This will initiate your payment. Your balance will only update once the cooperative verifies your payment.
                  </p>
                </div>

                {/* Buttons */}
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleConfirmed}
                    className="w-full py-4 rounded-full bg-primary text-on-primary font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-primary/20"
                  >
                    <CheckCircle2 size={18} />
                    Yes, Proceed with Payment
                  </button>
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="w-full py-4 rounded-full bg-surface-container-highest text-on-surface font-bold text-sm active:scale-95 transition-transform"
                  >
                    Go Back & Edit
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Loading / Success overlay ── */}
      <AnimatePresence>
        {successStep !== 'idle' && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-background flex flex-col items-center justify-center px-8"
          >
            {successStep === 'loading' && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                className="flex flex-col items-center gap-6"
              >
                <div className="relative w-24 h-24 flex items-center justify-center">
                  <motion.div
                    animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute inset-0 rounded-full bg-primary/20"
                  />
                  <svg className="absolute inset-0 w-full h-full animate-spin" viewBox="0 0 96 96">
                    <circle cx="48" cy="48" r="40"
                      fill="none" stroke="currentColor" strokeWidth="4"
                      strokeLinecap="round" strokeDasharray="180 72"
                      className="text-primary" />
                  </svg>
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <MethodIcon size={26} className="text-primary" />
                  </div>
                </div>
                <div className="text-center space-y-1">
                  <p className="font-headline font-bold text-xl text-on-surface">
                    {METHOD_LABELS[selectedMethod]}
                  </p>
                  <p className="text-on-surface-variant text-sm">Please wait a moment…</p>
                </div>
                <div className="flex gap-2">
                  {[0, 1, 2].map(i => (
                    <motion.div key={i} className="w-2 h-2 rounded-full bg-primary"
                      animate={{ opacity: [0.3, 1, 0.3], y: [0, -6, 0] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
                  ))}
                </div>
              </motion.div>
            )}

            {successStep === 'done' && (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center gap-6 text-center max-w-xs w-full"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                  className="w-24 h-24 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center"
                >
                  <motion.div
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.2 }}
                  >
                    <CheckCircle2 size={48} className="text-primary" />
                  </motion.div>
                </motion.div>

                {/* Amount pill */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                  className="bg-primary/10 border border-primary/20 rounded-2xl px-6 py-3"
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">
                    {paymentType === 'full' ? 'Full Settlement' : 'Installment Payment'}
                  </p>
                  <p className="font-headline font-extrabold text-2xl text-primary">
                    ₱ {dueAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="space-y-2"
                >
                  <h2 className="font-headline font-extrabold text-2xl text-on-surface">
                    Payment Initiated!
                  </h2>
                  <p className="text-on-surface-variant text-sm leading-relaxed">
                    Please follow the instructions below to complete your payment.
                    Your balance will update once the cooperative confirms receipt.
                  </p>
                </motion.div>

                {/* Instructions */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                  className="w-full bg-surface-container-low rounded-2xl p-4 text-left space-y-2"
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">
                    {instructions.title}
                  </p>
                  <ol className="space-y-2">
                    {instructions.steps.map((step, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <p className="text-xs text-on-surface leading-relaxed">{step}</p>
                      </li>
                    ))}
                  </ol>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="w-full flex flex-col gap-3 pt-2"
                >
                  <button onClick={() => navigate(`/loan/${id}`)}
                    className="w-full py-4 rounded-full bg-primary text-on-primary font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-primary/20"
                  >
                    <Receipt size={18} />
                    View Loan Details
                  </button>
                  <button onClick={() => navigate('/dashboard')}
                    className="w-full py-4 rounded-full bg-surface-container-highest text-on-surface font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  >
                    <LayoutDashboard size={18} />
                    Go to Dashboard
                  </button>
                </motion.div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}