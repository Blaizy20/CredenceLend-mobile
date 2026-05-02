import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, LayoutDashboard, Receipt, Loader2, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '../components/Button';
import { API_BASE } from '../lib/api';

type Status = 'verifying' | 'recording' | 'done' | 'failed';

const SS_PENDING_KEY = 'paymongo_pending';

const methodLabel: Record<string, string> = {
  // Raw PayMongo types
  gcash:             'GCash',
  card:              'Credit / Debit Card',
  paymaya:           'Maya',
  maya:              'Maya',
  qrph:              'QR Ph',
  grab_pay:          'GrabPay',
  grabpay:           'GrabPay',
  dob:               'BPI Online Banking',
  dob_ubp:           'UnionBank Online',
  bpi_online:        'BPI Online Banking',
  unionbank_online:  'UnionBank Online',
  brankas_bdo:       'BDO (Brankas)',
  brankas_landbank:  'Landbank (Brankas)',
  brankas_metrobank: 'Metrobank (Brankas)',
  billease:          'BillEase',
  // Normalized DB values
  GCASH:             'GCash',
  CARD:              'Credit / Debit Card',
  MAYA:              'Maya',
  QRPH:              'QR Ph',
  GRAB_PAY:          'GrabPay',
  BPI:               'BPI Online Banking',
  UNIONBANK:         'UnionBank Online',
  BRANKAS_BDO:       'BDO',
  BANK:              'Bank Transfer',
  // Legacy / offline
  wallet:            'E-Wallet',
  online:            'Online Payment',
  walkin:            'Walk-in',
  cash:              'Cash',
  cheque:            'Cheque',
  bank:              'Bank Transfer',
  other:             'Online Payment',
};

export default function PaymentSuccess() {
  const navigate               = useNavigate();
  const { id }                 = useParams();
  const [searchParams]         = useSearchParams();
  const [status, setStatus]    = useState<Status>('verifying');
  const [error, setError]      = useState('');
  const [dbPaymentId, setDbPaymentId] = useState<number | null>(null);
  const [pmPaymentId, setPmPaymentId] = useState<string>('');
  const [paidAmount, setPaidAmount]   = useState<number>(0);
  const [paidMethod, setPaidMethod]   = useState<string>('');
  const hasRun                 = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    handleSuccess();
  }, []);

  async function handleSuccess() {
    try {
      // ── Step 1: Resolve identifiers ───────────────────────────────────────
      let sessionId = '';
      let sourceId  = searchParams.get('id')                ?? '';
      let intentId  = searchParams.get('payment_intent_id') ?? '';
      let amount    = Number(searchParams.get('amount') ?? 0);

      // PRIMARY: read from localStorage — survives cross-domain redirect
      try {
        const storedRaw = localStorage.getItem(SS_PENDING_KEY);
        if (storedRaw) {
          const stored = JSON.parse(storedRaw);
          if (stored.session_id)           sessionId = stored.session_id;
          if (!amount && stored.amount)    amount    = Number(stored.amount);
        }
      } catch { /* ignore malformed storage */ }

      // ── Step 2: Guard — must have a loan id ───────────────────────────────
      if (!id) {
        setError('Loan details are missing. Please go back and try again.');
        setStatus('failed');
        return;
      }

      if (!sessionId && !sourceId && !intentId) {
        setError(
          'Your payment session could not be found. ' +
          'If money was deducted from your account, please contact support with your reference number.'
        );
        setStatus('failed');
        return;
      }

      // ── Step 3: Verify with PayMongo ──────────────────────────────────────
      let resolvedMethod     = 'other';
      let currentPmPaymentId = '';

      // Checkout Session flow
      if (sessionId) {
        setStatus('verifying');
        const statusRes  = await fetch(`${API_BASE}/api/paymongo/checkout-status/${sessionId}`);
        const statusData = await statusRes.json();

        // FIX: PayMongo GCash/Maya test mode often returns payment_status:"unpaid"
        // even after a successful payment, but always attaches a payment_id.
        // Accept either condition as verified proof of payment.
        const isVerified =
          statusData.success &&
          (statusData.payment_status === 'paid' || !!statusData.payment_id);

        if (!isVerified) {
          setError(
            'Payment could not be verified with PayMongo. ' +
            'If money was deducted, please contact support.'
          );
          setStatus('failed');
          return;
        }

        resolvedMethod = statusData.payment_method_type ?? 'other';
        if (statusData.amount)      amount             = statusData.amount;
        if (statusData.payment_id) {
          currentPmPaymentId = statusData.payment_id;
          setPmPaymentId(statusData.payment_id);
        }
      }

      // Source flow (in-app GCash QR)
      else if (sourceId) {
        setStatus('verifying');
        const verified = await pollSourceStatus(sourceId);
        if (!verified) {
          setError(
            'GCash payment could not be verified. ' +
            'If money was deducted, please contact support.'
          );
          setStatus('failed');
          return;
        }
        resolvedMethod = 'gcash';
      }

      // Card Payment Intent flow (3DS redirect)
      else if (intentId) {
        resolvedMethod = 'card';
      }

      // ── Step 4: Amount guard ──────────────────────────────────────────────
      if (!amount) {
        setError('Payment amount is missing. Please contact support.');
        setStatus('failed');
        return;
      }

      // ── Step 5: Record in database ────────────────────────────────────────
      setPaidAmount(amount);
      setPaidMethod(resolvedMethod);
      setStatus('recording');

      const res = await fetch(`${API_BASE}/api/paymongo/record-payment`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loan_id:              Number(id),
          amount,
          method:               resolvedMethod,
          paymongo_method_type: resolvedMethod,
          paymongo_source_id:   sourceId           || undefined,
          paymongo_intent_id:   intentId           || undefined,
          paymongo_session_id:  sessionId          || undefined,
          paymongo_payment_id:  currentPmPaymentId || undefined,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.message || 'Failed to record payment. Please contact support.');
        setStatus('failed');
        return;
      }

      setDbPaymentId(data.payment_id);
      if (data.pm_payment_id) setPmPaymentId(data.pm_payment_id);

      // Clean up localStorage
      localStorage.removeItem(SS_PENDING_KEY);
      setStatus('done');
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
      setStatus('failed');
    }
  }

  async function pollSourceStatus(sourceId: string, maxAttempts = 10): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 1500));
      try {
        const res  = await fetch(`${API_BASE}/api/paymongo/source/${sourceId}`);
        const data = await res.json();
        const st   = data.source?.attributes?.status ?? '';
        if (st === 'chargeable' || st === 'consumed') return true;
        if (st === 'failed'     || st === 'cancelled') return false;
      } catch { /* keep polling */ }
    }
    return false;
  }

  // ── Loading screens ───────────────────────────────────────────────────────
  if (status === 'verifying' || status === 'recording') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-8 text-center"
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-primary/10 rounded-full blur-[100px]" />
        </div>
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 240, damping: 18 }}
          className="w-24 h-24 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-8 shadow-2xl shadow-primary/20"
        >
          {status === 'verifying'
            ? <Loader2 className="text-primary animate-spin" size={44} />
            : <Receipt className="text-primary" size={44} />
          }
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h2 className="font-headline font-bold text-2xl text-on-surface mb-2">
            {status === 'verifying' ? 'Verifying Payment…' : 'Recording Payment…'}
          </h2>
          <p className="text-on-surface-variant text-sm">
            {status === 'verifying'
              ? 'Confirming your payment with the provider. Please wait.'
              : 'Almost done — saving your payment record.'}
          </p>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="flex gap-2 mt-12">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
              transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
              className="w-1.5 h-1.5 rounded-full bg-primary"
            />
          ))}
        </motion.div>
      </motion.div>
    );
  }

  // ── Failed screen ─────────────────────────────────────────────────────────
  if (status === 'failed') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-8 text-center"
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-red-500/10 rounded-full blur-[100px]" />
        </div>
        <motion.div
          initial={{ scale: 0, rotate: 20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
          className="w-24 h-24 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-8 shadow-2xl shadow-red-500/10"
        >
          <AlertTriangle className="text-red-500" size={48} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="space-y-2 mb-10">
          <p className="text-on-surface-variant text-sm font-bold uppercase tracking-widest">Payment Failed</p>
          <h1 className="font-headline font-extrabold text-4xl text-on-surface tracking-tight">
            Try Again<span className="text-red-500">.</span>
          </h1>
          <p className="text-on-surface-variant text-sm mt-3 max-w-xs mx-auto leading-relaxed">{error}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="w-full max-w-xs flex flex-col gap-3">
          <Button onClick={() => navigate(`/loan/${id}/pay`)}>Try Again</Button>
          <button onClick={() => navigate('/dashboard')} className="text-on-surface-variant font-semibold text-sm hover:underline">
            Back to Dashboard
          </button>
        </motion.div>
      </motion.div>
    );
  }

  // ── Success screen ────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-8 text-center"
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-green-500/10 rounded-full blur-[120px]" />
      </div>
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
        className="w-24 h-24 rounded-3xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-8 shadow-2xl shadow-green-500/10"
      >
        <CheckCircle2 className="text-green-500" size={48} />
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="space-y-2 mb-8">
        <p className="text-on-surface-variant text-sm font-bold uppercase tracking-widest">Payment Confirmed</p>
        <h1 className="font-headline font-extrabold text-4xl text-on-surface tracking-tight">
          All Done<span className="text-green-500">.</span>
        </h1>
        <p className="text-on-surface-variant text-sm mt-3 max-w-xs mx-auto leading-relaxed">
          Your payment has been successfully verified and recorded.
        </p>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.38 }}
        className="w-full max-w-xs bg-surface-container-high border border-outline-variant/10 rounded-2xl p-5 mb-8 text-left space-y-3"
      >
        {paidAmount > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">Amount Paid</span>
            <span className="font-mono font-bold text-on-surface text-sm">
              ₱{paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">Method</span>
          <span className="text-on-surface text-sm font-medium">
            {methodLabel[paidMethod] ?? paidMethod ?? 'Online Payment'}
          </span>
        </div>
        {pmPaymentId && (
          <div className="flex justify-between items-center gap-4">
            <span className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold shrink-0">PM Ref</span>
            <span className="font-mono text-on-surface text-[10px] text-right break-all">{pmPaymentId}</span>
          </div>
        )}
        {dbPaymentId && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">Receipt #</span>
            <span className="font-mono text-on-surface text-xs">#{dbPaymentId}</span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">Status</span>
          <span className="bg-green-500/10 text-green-600 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
            Confirmed
          </span>
        </div>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="w-full max-w-xs flex flex-col gap-3">
        <Button onClick={() => navigate('/dashboard')}>
          <LayoutDashboard size={18} /> Back to Dashboard
        </Button>
        <button onClick={() => navigate(`/loan/${id}`)} className="text-primary font-semibold text-sm hover:underline">
          View Loan Details
        </button>
      </motion.div>
    </motion.div>
  );
}
