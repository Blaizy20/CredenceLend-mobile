import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Copy, Store, Landmark, Wallet, CreditCard, CheckCircle, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { Button } from '../components/Button';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { loansAPI } from '../lib/api';

const METHODS = [
  { id: 'walkin',  label: 'Walk-in',       sub: 'Over-the-counter at the cooperative',  icon: Store    },
  { id: 'bank',    label: 'Bank Transfer', sub: 'BPI, BDO, UnionBank & more',            icon: Landmark },
  { id: 'wallet',  label: 'E-wallet',      sub: 'GCash, Maya, ShopeePay',               icon: Wallet,  isFast: true },
  { id: 'card',    label: 'Card',          sub: 'Visa, Mastercard, JCB',                icon: CreditCard },
];

// Instructions shown per method after confirming
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

export default function Payment() {
  const navigate  = useNavigate();
  const { id }    = useParams();
  const location  = useLocation();

  const [loan, setLoan]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied]   = useState(false);

  const [selectedMethod, setSelectedMethod] = useState('walkin');

  const query       = new URLSearchParams(location.search);
  const dueAmount   = Number(query.get('amount') ?? 0);
  const paymentType = query.get('type') ?? 'installment';

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const loanData = await loansAPI.getLoan(Number(id));
        if (!loanData || loanData.success === false) {
          setError(loanData?.message || 'Loan not found.');
          return;
        }
        setLoan(loanData);
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

  const instructions = METHOD_INSTRUCTIONS[selectedMethod];

  // ── Confirmed state ───────────────────────────────────────────────────────
  if (confirmed) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center">
        <TopBar title="Payment Confirmed" onBack={() => navigate(`/loan/${id}`)} />
        <main className="w-full max-w-md px-6 pt-24 pb-32 flex-1 flex flex-col gap-6">

          {/* Success banner */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-green-500/10 border border-green-500/20 rounded-3xl p-6 flex flex-col items-center text-center gap-3"
          >
            <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center">
              <CheckCircle size={28} className="text-white" />
            </div>
            <h2 className="font-headline font-extrabold text-xl text-green-500">Payment Initiated</h2>
            <p className="text-on-surface-variant text-sm">
              Please complete your payment using the instructions below.
              Your balance will update once the cooperative confirms receipt.
            </p>
          </motion.div>

          {/* Amount summary */}
          <div className="bg-surface-container-high rounded-2xl p-5 flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">
                {paymentType === 'full' ? 'Full Settlement' : 'Installment Payment'}
              </p>
              <p className="font-headline font-extrabold text-2xl text-primary">
                ₱ {dueAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <button
              onClick={handleCopy}
              className="flex flex-col items-end gap-1"
            >
              <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Ref No.</p>
              <div className="flex items-center gap-1.5">
                <p className="font-mono text-sm font-semibold text-on-surface">{loan.reference_no}</p>
                <CheckCircle
                  size={14}
                  className={cn('transition-colors', copied ? 'text-green-500' : 'text-on-surface-variant')}
                />
              </div>
              {copied && <p className="text-[10px] text-green-500 font-bold">Copied!</p>}
            </button>
          </div>

          {/* Instructions */}
          <div className="bg-surface-container-low rounded-2xl p-5 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              {instructions.title}
            </p>
            <ol className="space-y-3">
              {instructions.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm text-on-surface leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
          </div>

        </main>

        <div className="fixed bottom-0 left-0 w-full bg-background/80 backdrop-blur-xl pt-4 pb-10 px-6 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.4)]">
          <div className="max-w-md mx-auto">
            <Button onClick={() => navigate(`/loan/${id}`)}>
              Back to Loan Details
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main payment screen ───────────────────────────────────────────────────
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
            <button onClick={handleCopy} className="flex items-center gap-1.5 text-on-surface-variant active:text-primary transition-colors">
              {copied
                ? <CheckCircle size={16} className="text-green-500" />
                : <Copy size={16} />
              }
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {copied ? 'Copied' : 'Copy'}
              </span>
            </button>
          </div>
        </motion.div>

        {/* Payment methods */}
        <section className="space-y-3">
          <h3 className="font-headline font-bold text-base tracking-tight px-1 text-on-surface-variant uppercase text-[10px] tracking-widest">
            Select Payment Method
          </h3>
          {METHODS.map((method) => {
            const isSelected = selectedMethod === method.id;
            return (
              <button
                key={method.id}
                onClick={() => setSelectedMethod(method.id)}
                className={cn(
                  'w-full flex items-center justify-between p-4 rounded-2xl transition-all border active:scale-[0.98]',
                  isSelected
                    ? 'border-primary/30 bg-primary/5 ring-1 ring-primary/20'
                    : 'border-outline-variant/20 bg-surface-container-high hover:bg-surface-bright'
                )}
              >
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

      <div className="fixed bottom-0 left-0 w-full bg-background/80 backdrop-blur-xl pt-4 pb-10 px-6 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.4)]">
        <div className="max-w-md mx-auto">
          <Button onClick={() => setConfirmed(true)}>
            Confirm Payment Method
          </Button>
        </div>
      </div>
    </div>
  );
}