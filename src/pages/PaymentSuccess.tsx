import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, LayoutDashboard, Receipt, Loader2, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '../components/Button';

type Status = 'verifying' | 'recording' | 'done' | 'failed';

export default function PaymentSuccess() {
  const navigate                  = useNavigate();
  const { id }                    = useParams();
  const [searchParams]            = useSearchParams();
  const [status, setStatus]       = useState<Status>('verifying');
  const [error, setError]         = useState('');
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const hasRun                    = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    handleSuccess();
  }, []);

  async function handleSuccess() {
    try {
      // FIX: Read session_id from URL (PayMongo replaces {CHECKOUT_SESSION_ID} automatically)
      const sessionId   = searchParams.get('session_id')        ?? '';
      const sourceId    = searchParams.get('id')                ?? '';
      const intentId    = searchParams.get('payment_intent_id') ?? '';
      const amountParam = searchParams.get('amount')            ?? '0';
      let   amount      = Number(amountParam) || 0;

      if (!id) {
        setError('Payment details are missing. Please go back and try again.');
        setStatus('failed');
        return;
      }

      let resolvedMethod = 'other';

      // ── Checkout Session flow (PayMongo hosted page — card/gcash/qrph/etc.) ──
      if (sessionId) {
        setStatus('verifying');
        const statusRes  = await fetch(`/api/paymongo/checkout-status/${sessionId}`);
        const statusData = await statusRes.json();

        if (!statusData.success || statusData.payment_status !== 'paid') {
          setError('Payment could not be verified. If money was deducted, please contact support.');
          setStatus('failed');
          return;
        }

        // FIX: Use the REAL PayMongo method (e.g. "gcash", "card", "qrph", "grab_pay")
        resolvedMethod = statusData.payment_method_type ?? 'other';
        if (statusData.amount) amount = statusData.amount;
      }

      // ── Source flow (in-app GCash QR from PaymentGateway.tsx) ─────────────
      else if (sourceId) {
        setStatus('verifying');
        const verified = await pollSourceStatus(sourceId);
        if (!verified) {
          setError('Payment could not be verified with the provider. If money was deducted, please contact support.');
          setStatus('failed');
          return;
        }
        resolvedMethod = 'gcash';
      }

      // ── Card Payment Intent flow (3DS redirect) ────────────────────────────
      else if (intentId) {
        resolvedMethod = 'card';
      }

      if (!amount) {
        setError('Payment amount is missing. Please contact support.');
        setStatus('failed');
        return;
      }

      // ── Record in database ─────────────────────────────────────────────────
      setStatus('recording');

      const res = await fetch('/api/paymongo/record-payment', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loan_id:               Number(id),
          amount,
          method:                resolvedMethod,         // real PayMongo type
          paymongo_method_type:  resolvedMethod,         // server normalizes → GCASH/CARD/etc.
          paymongo_source_id:    sourceId  || undefined,
          paymongo_intent_id:    intentId  || undefined,
          paymongo_session_id:   sessionId || undefined, // used for dedup guard
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.message || 'Failed to record payment. Please contact support.');
        setStatus('failed');
        return;
      }

      setPaymentId(data.payment_id);
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
        const res  = await fetch(`/api/paymongo/source/${sourceId}`);
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
  const resolvedMethodDisplay = searchParams.get('session_id')
    ? 'online'  // will be overridden by methodLabel below using stored data
    : (searchParams.get('method') ?? 'other');
  const amount = Number(searchParams.get('amount') ?? 0);

  // FIX: Expanded methodLabel to cover all PayMongo payment_method_type values
  const methodLabel: Record<string, string> = {
    // Raw PayMongo types returned by checkout-status
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
    // Normalized DB values (fallback)
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
        {amount > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">Amount Paid</span>
            <span className="font-mono font-bold text-on-surface text-sm">
              ₱{amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">Method</span>
          <span className="text-on-surface text-sm font-medium">
            {methodLabel[resolvedMethodDisplay] ?? resolvedMethodDisplay}
          </span>
        </div>
        {paymentId && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">Payment ID</span>
            <span className="font-mono text-on-surface text-xs">#{paymentId}</span>
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
