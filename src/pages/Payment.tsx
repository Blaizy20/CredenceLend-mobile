import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  Copy, Store, Landmark, Wallet, CreditCard, CheckCircle,
  ShieldCheck, Loader2, AlertCircle, CheckCircle2, LayoutDashboard,
  Receipt, AlertTriangle, ExternalLink, Info,
} from 'lucide-react';
import { TopBar }   from '../components/TopBar';
import { Button }   from '../components/Button';
import { motion, AnimatePresence } from 'motion/react';
import { cn }       from '@/src/lib/utils';
import { loansAPI } from '../lib/api';

// ── helpers ───────────────────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function safeAmount(n: number) {
  return parseFloat(n.toFixed(2));
}

function getCustomerBilling() {
  try {
    const stored   = localStorage.getItem('user');
    const customer = stored ? JSON.parse(stored) : {};
    return {
      name:  `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim() || '',
      email: customer.email      ?? '',
      phone: customer.contact_no ?? '',
    };
  } catch {
    return { name: '', email: '', phone: '' };
  }
}

// ── constants ─────────────────────────────────────────────────────────────
const METHODS = [
  { id: 'walkin', label: 'Walk-in',       sub: 'Over-the-counter at the cooperative', icon: Store,       isOnline: false },
  { id: 'bank',   label: 'Bank Transfer', sub: 'BPI, BDO, UnionBank & more',           icon: Landmark,    isOnline: false },
  { id: 'wallet', label: 'E-wallet',      sub: 'GCash, Maya',                          icon: Wallet,      isOnline: true, isFast: true },
  { id: 'card',   label: 'Card',          sub: 'Visa, Mastercard, JCB',                icon: CreditCard,  isOnline: true },
];

const METHOD_INSTRUCTIONS: Record<string, { title: string; steps: string[] }> = {
  walkin: {
    title: 'Walk-in Instructions',
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
      "Transfer the exact amount to the cooperative's account.",
      'Use your reference number as the transaction remarks.',
      'Send your proof of payment to the cooperative.',
    ],
  },
  wallet: {
    title: 'E-wallet via PayMongo',
    steps: [
      'Tap "Proceed to Payment" below.',
      'You will be redirected to a secure PayMongo checkout.',
      'Choose GCash or Maya and authorize the payment.',
      'You will be automatically returned here when done.',
    ],
  },
  card: {
    title: 'Card Payment via PayMongo',
    steps: [
      'Tap "Proceed to Payment" below.',
      'You will be redirected to a secure PayMongo checkout.',
      'Enter your card details (3D Secure may be required).',
      'You will be automatically returned here when done.',
    ],
  },
};

type PayStatus = 'idle' | 'redirecting' | 'loading' | 'done' | 'failed';

// ── component ─────────────────────────────────────────────────────────────
export default function Payment() {
  const navigate = useNavigate();
  const { id }   = useParams();
  const location = useLocation();

  const [loan, setLoan]                     = useState<any>(null);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState('');
  const [copied, setCopied]                 = useState(false);
  const [selectedMethod, setSelectedMethod] = useState('walkin');
  const [showConfirm, setShowConfirm]       = useState(false);
  const [payStatus, setPayStatus]           = useState<PayStatus>('idle');
  const [payError, setPayError]             = useState('');

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const query       = new URLSearchParams(location.search);
  const dueAmount   = safeAmount(Number(query.get('amount') ?? 0));
  const paymentType = (query.get('type') ?? 'installment') as 'installment' | 'full' | 'custom';

  // ── load loan ──────────────────────────────────────────────────────────
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
        setError('Unable to load loan details. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [id]);

  const handleCopy = () => {
    if (!loan?.reference_no) return;
    navigator.clipboard.writeText(loan.reference_no).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── PayMongo Checkout ──────────────────────────────────────────────────
  const handleCheckoutPay = async () => {
    setPayStatus('redirecting');
    setPayError('');
    try {
      const amount  = safeAmount(dueAmount);
      const origin  = window.location.origin;
      const billing = getCustomerBilling();

      const res = await fetch('/api/paymongo/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          description:   `Loan payment – ${loan?.reference_no}`,
          reference_no:  loan?.reference_no,
          success_url:   `${origin}/loan/${id}/pay/success?method=${selectedMethod}&amount=${amount}`,
          cancel_url:    `${origin}/loan/${id}/pay?amount=${amount}&type=${paymentType}`,
          billing_name:  billing.name,
          billing_email: billing.email,
          billing_phone: billing.phone,
        }),
      });

      const data = await res.json();
      if (!data.success || !data.checkout_url) {
        setPayStatus('failed');
        setPayError(data.message || 'Failed to create checkout session. Please try again.');
        return;
      }
      window.location.href = data.checkout_url;
    } catch (err: any) {
      setPayStatus('failed');
      setPayError(err.message || 'Unable to connect to payment service. Please try again.');
    }
  };

  const handleConfirmed = async () => {
    setShowConfirm(false);
    if (selectedMethod === 'wallet' || selectedMethod === 'card') {
      await handleCheckoutPay();
    } else {
      setPayStatus('loading');
      setTimeout(() => setPayStatus('done'), 2200);
    }
  };

  // ── guards ──────────────────────────────────────────────────────────────
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

  // ── overlay screens ────────────────────────────────────────────────────
  if (payStatus === 'redirecting') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-8 text-center">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-primary/10 rounded-full blur-[100px]" />
        </div>
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 240, damping: 18 }}
          className="w-24 h-24 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-8 shadow-2xl shadow-primary/20">
          <ExternalLink className="text-primary" size={44} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h2 className="font-headline font-bold text-2xl text-on-surface mb-2">Redirecting…</h2>
          <p className="text-on-surface-variant text-sm">
            You're being sent to <span className="text-primary font-semibold">PayMongo Checkout</span> to complete your payment.
          </p>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="flex gap-2 mt-12">
          {[0,1,2].map(i => (
            <motion.div key={i} animate={{ opacity: [0.3,1,0.3], scale: [0.8,1,0.8] }}
              transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
              className="w-1.5 h-1.5 rounded-full bg-primary" />
          ))}
        </motion.div>
      </motion.div>
    );
  }

  if (payStatus === 'loading') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-8 text-center">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 240, damping: 18 }}
          className="w-24 h-24 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-8">
          <Receipt className="text-primary" size={44} />
        </motion.div>
        <h2 className="font-headline font-bold text-2xl text-on-surface mb-2">Recording Payment…</h2>
        <p className="text-on-surface-variant text-sm">Please wait while we log your payment details.</p>
        <div className="flex gap-2 mt-12">
          {[0,1,2].map(i => (
            <motion.div key={i} animate={{ opacity: [0.3,1,0.3], scale: [0.8,1,0.8] }}
              transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
              className="w-1.5 h-1.5 rounded-full bg-primary" />
          ))}
        </div>
      </motion.div>
    );
  }

  if (payStatus === 'done') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-8 text-center">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-green-500/10 rounded-full blur-[100px]" />
        </div>
        <motion.div
          initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
          className="w-24 h-24 rounded-3xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-8">
          <CheckCircle2 className="text-green-500" size={48} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="space-y-2 mb-10">
          <p className="text-on-surface-variant text-sm font-bold uppercase tracking-widest">Payment Submitted</p>
          <h1 className="font-headline font-extrabold text-4xl text-on-surface tracking-tight">All Done<span className="text-green-500">.</span></h1>
          <p className="text-on-surface-variant text-sm mt-3 max-w-xs mx-auto">
            Your payment has been recorded and is pending verification by the cooperative.
          </p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="w-full max-w-xs flex flex-col gap-3">
          <Button onClick={() => navigate('/dashboard')}><LayoutDashboard size={18} /> Back to Dashboard</Button>
          <button onClick={() => navigate(`/loan/${id}`)} className="text-primary font-semibold text-sm hover:underline">View Loan Details</button>
        </motion.div>
      </motion.div>
    );
  }

  if (payStatus === 'failed') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-8 text-center">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-red-500/10 rounded-full blur-[100px]" />
        </div>
        <motion.div
          initial={{ scale: 0, rotate: 20 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
          className="w-24 h-24 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-8">
          <AlertTriangle className="text-red-500" size={48} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="space-y-2 mb-10">
          <p className="text-on-surface-variant text-sm font-bold uppercase tracking-widest">Payment Failed</p>
          <h1 className="font-headline font-extrabold text-4xl text-on-surface tracking-tight">Try Again<span className="text-red-500">.</span></h1>
          <p className="text-on-surface-variant text-sm mt-3 max-w-xs mx-auto">{payError || 'Something went wrong processing your payment.'}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="w-full max-w-xs flex flex-col gap-3">
          <Button onClick={() => { setPayStatus('idle'); setPayError(''); }}>Try Again</Button>
          <button onClick={() => navigate('/dashboard')} className="text-on-surface-variant font-semibold text-sm hover:underline">Back to Dashboard</button>
        </motion.div>
      </motion.div>
    );
  }

  // ── derived values ─────────────────────────────────────────────────────
  const total     = Number(loan.total_payable)      || 0;
  const remaining = Number(loan.remaining_balance)  || 0;
  const months    = Number(loan.term_months)        || 1;
  const monthly   = parseFloat((total / months).toFixed(2));
  const paidSoFar = parseFloat((total - remaining).toFixed(2));
  const progress  = total > 0 ? Math.min((paidSoFar / total) * 100, 100) : 0;
  const newBalance = Math.max(0, safeAmount(remaining - dueAmount));
  const isFullPay  = newBalance <= 0;
  const instructions = METHOD_INSTRUCTIONS[selectedMethod];

  const PAYMENT_TYPE_LABEL: Record<string, string> = {
    installment: 'Installment Payment',
    full:        'Full Settlement',
    custom:      'Custom Payment',
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      <TopBar title="Loan Payment" onBack={() => navigate(`/loan/${id}/pay`)} />

      <main className="w-full max-w-md px-6 pt-24 pb-36 flex-1 space-y-6">

        {/* ── Payment Breakdown ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-surface-container-highest rounded-2xl overflow-hidden shadow-lg border border-outline-variant/10"
        >
          {/* Header */}
          <div className="px-5 pt-5 pb-4 border-b border-outline-variant/10">
            <div className="flex justify-between items-start mb-1">
              <div>
                <p className="text-on-surface-variant text-[10px] uppercase tracking-widest mb-0.5">
                  {PAYMENT_TYPE_LABEL[paymentType]}
                </p>
                <h2 className="font-headline font-extrabold text-3xl text-primary tracking-tight">
                  ₱{fmt(dueAmount)}
                </h2>
              </div>
              <div className="text-right">
                <p className="text-on-surface-variant text-[10px] uppercase tracking-wider mb-0.5">Reference</p>
                <div className="flex items-center gap-1.5 justify-end">
                  <p className="font-mono text-xs font-bold text-on-surface">{loan.reference_no}</p>
                  <button onClick={handleCopy} className="text-on-surface-variant active:text-primary transition-colors">
                    {copied ? <CheckCircle size={14} className="text-green-500" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Breakdown rows */}
          <div className="px-5 py-4 space-y-3">
            {[
              { label: 'Principal Amount',    value: `₱${fmt(Number(loan.principal_amount))}` },
              { label: 'Total Payable',       value: `₱${fmt(total)}` },
              { label: 'Monthly Installment', value: `₱${fmt(monthly)}` },
              { label: 'Amount Paid So Far',  value: `₱${fmt(paidSoFar)}` },
              { label: 'Current Balance',     value: `₱${fmt(remaining)}`, highlight: true },
            ].map(({ label, value, highlight }) => (
              <div key={label} className="flex justify-between items-center">
                <p className={cn('text-xs', highlight ? 'text-on-surface font-semibold' : 'text-on-surface-variant')}>{label}</p>
                <p className={cn('text-xs font-bold tabular-nums', highlight ? 'text-on-surface' : 'text-on-surface-variant')}>{value}</p>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="mx-5 border-t border-dashed border-outline-variant/20" />

          {/* After-payment preview */}
          <div className="px-5 py-4 space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-xs font-bold text-on-surface">You will pay</p>
              <p className="text-sm font-extrabold text-primary tabular-nums">₱{fmt(dueAmount)}</p>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-xs text-on-surface-variant">Remaining after payment</p>
              <p className={cn('text-xs font-bold tabular-nums', isFullPay ? 'text-green-500' : 'text-on-surface')}>
                {isFullPay ? '₱0.00 · Fully Paid 🎉' : `₱${fmt(newBalance)}`}
              </p>
            </div>
          </div>

          {/* Progress */}
          <div className="px-5 pb-5">
            <div className="h-1.5 rounded-full bg-surface-container-low overflow-hidden">
              <motion.div
                initial={{ width: `${progress}%` }}
                animate={{ width: `${Math.min(((paidSoFar + dueAmount) / total) * 100, 100)}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full rounded-full bg-primary"
              />
            </div>
            <div className="flex justify-between mt-1">
              <p className="text-[9px] text-on-surface-variant">Current: {progress.toFixed(1)}%</p>
              <p className="text-[9px] text-primary">After: {Math.min(((paidSoFar + dueAmount) / total) * 100, 100).toFixed(1)}%</p>
            </div>
          </div>
        </motion.div>

        {/* ── Payment Method ── */}
        <section className="space-y-3">
          <h3 className="font-headline font-bold text-on-surface-variant uppercase text-[10px] tracking-widest px-1">
            Payment Method
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
                <div className="flex items-center gap-3">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                    isSelected ? 'bg-primary/10' : 'bg-surface-container-highest')}>
                    <method.icon className="text-primary" size={20} />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-on-surface">{method.label}</p>
                      {method.isFast && (
                        <span className="bg-primary/10 text-primary text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tight">Fast</span>
                      )}
                      {method.isOnline && (
                        <span className="bg-blue-500/10 text-blue-500 text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tight">Online</span>
                      )}
                    </div>
                    <p className="text-xs text-on-surface-variant">{method.sub}</p>
                  </div>
                </div>
                {isSelected && <CheckCircle className="text-primary shrink-0" size={18} fill="currentColor" />}
              </button>
            );
          })}
        </section>

        {/* ── Instructions ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedMethod}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="bg-surface-container-low border border-outline-variant/10 rounded-2xl p-5 space-y-3"
          >
            <div className="flex items-center gap-2">
              <Info size={14} className="text-primary shrink-0" />
              <p className="text-xs font-bold text-primary uppercase tracking-widest">{instructions.title}</p>
            </div>
            <ol className="space-y-2">
              {instructions.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-xs text-on-surface-variant">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </motion.div>
        </AnimatePresence>

        {/* ── Security note ── */}
        <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl p-4 flex items-center gap-3">
          <ShieldCheck className="text-primary shrink-0" size={18} />
          <p className="text-xs text-on-surface-variant leading-relaxed">
            {selectedMethod === 'walkin' || selectedMethod === 'bank'
              ? 'Payment will be verified by the cooperative before your balance updates.'
              : 'Payments are processed securely through PayMongo. Card and wallet details are never stored on our servers.'}
          </p>
        </div>
      </main>

      {/* ── CTA ── */}
      <div className="fixed bottom-0 left-0 w-full bg-background/80 backdrop-blur-xl pt-4 pb-10 px-6 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.4)]">
        <div className="max-w-md mx-auto">
          <Button onClick={() => setShowConfirm(true)}>
            {selectedMethod === 'walkin' || selectedMethod === 'bank'
              ? 'Confirm Payment Method'
              : <><span>Proceed to Payment</span> <ExternalLink size={16} /></>}
          </Button>
        </div>
      </div>

      {/* ── Confirmation Sheet ── */}
      <AnimatePresence>
        {showConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowConfirm(false)}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 60, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 60, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed bottom-0 left-0 right-0 z-50 p-6 bg-surface-container-low rounded-t-[2rem] shadow-2xl border-t border-white/5 max-w-md mx-auto"
            >
              {/* Handle bar */}
              <div className="w-10 h-1 rounded-full bg-outline-variant/30 mx-auto mb-5" />

              <div className="flex justify-center mb-5">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <ShieldCheck className="text-primary" size={28} />
                </div>
              </div>

              <div className="text-center mb-6">
                <h3 className="font-headline font-bold text-xl text-on-surface mb-1">Confirm Payment</h3>
                <p className="text-on-surface-variant text-sm mb-4">
                  {selectedMethod === 'wallet' || selectedMethod === 'card'
                    ? `You will be redirected to PayMongo to complete this payment.`
                    : `Confirm your ${selectedMethod === 'bank' ? 'bank transfer' : 'walk-in'} payment.`}
                </p>
                {/* Summary rows */}
                <div className="bg-surface-container-high rounded-xl p-4 space-y-2.5 text-left">
                  {[
                    { label: 'Amount',        value: `₱${fmt(dueAmount)}`, accent: true },
                    { label: 'Method',        value: METHODS.find(m => m.id === selectedMethod)?.label ?? selectedMethod },
                    { label: 'Reference',     value: loan.reference_no },
                    { label: 'After Payment', value: isFullPay ? '₱0.00 (Fully Paid)' : `₱${fmt(newBalance)} remaining` },
                  ].map(({ label, value, accent }) => (
                    <div key={label} className="flex justify-between items-center">
                      <p className="text-xs text-on-surface-variant">{label}</p>
                      <p className={cn('text-xs font-bold', accent ? 'text-primary' : 'text-on-surface')}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Button onClick={handleConfirmed}>
                  {selectedMethod === 'walkin' || selectedMethod === 'bank'
                    ? 'Confirm'
                    : <><span>Continue to Payment</span> <ExternalLink size={16} /></>}
                </Button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="w-full py-4 rounded-full bg-surface-container-highest text-on-surface font-bold text-sm active:scale-95 transition-transform"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
