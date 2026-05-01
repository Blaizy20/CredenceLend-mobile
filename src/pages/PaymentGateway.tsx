import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  CreditCard, Wallet, Copy, CheckCircle, ShieldCheck,
  Loader2, AlertCircle, ChevronRight, RefreshCw,
  Smartphone, X, ExternalLink, QrCode
} from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { loansAPI } from '../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = 'ewallet' | 'card';
type EWallet = 'gcash' | 'maya';
type CardStep = 'form' | 'processing' | 'done';

interface CardForm {
  number:  string;
  name:    string;
  expiry:  string;
  cvv:     string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const API = import.meta.env.VITE_API_URL ?? '';

const formatCardNumber = (v: string) =>
  v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();

const formatExpiry = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

const EWALLET_OPTIONS: { id: EWallet; label: string; color: string; bg: string }[] = [
  { id: 'gcash', label: 'GCash', color: 'text-blue-600',  bg: 'bg-blue-50'   },
  { id: 'maya',  label: 'Maya',  color: 'text-green-600', bg: 'bg-green-50'  },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function PaymentGateway() {
  const navigate  = useNavigate();
  const { id }    = useParams();
  const location  = useLocation();

  const query       = new URLSearchParams(location.search);
  const dueAmount   = Number(query.get('amount') ?? 0);
  const paymentType = query.get('type') ?? 'installment';

  const [loan, setLoan]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [copied, setCopied]   = useState(false);

  // ── Tab & E-wallet state ──────────────────────────────────────────────────
  const [tab, setTab]                   = useState<Tab>('ewallet');
  const [selectedWallet, setSelectedWallet] = useState<EWallet>('gcash');

  // ── E-wallet flow state ───────────────────────────────────────────────────
  type EWalletStep = 'select' | 'loading' | 'qr' | 'polling' | 'success' | 'error';
  const [eStep, setEStep]       = useState<EWalletStep>('select');
  const [eError, setEError]     = useState('');
  const [source, setSource]     = useState<any>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Card flow state ───────────────────────────────────────────────────────
  const [cardStep, setCardStep] = useState<CardStep>('form');
  const [cardForm, setCardForm] = useState<CardForm>({ number: '', name: '', expiry: '', cvv: '' });
  const [cardErrors, setCardErrors] = useState<Partial<CardForm>>({});
  const [cardError, setCardError]   = useState('');

  // ── Load loan ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    loansAPI.getLoan(Number(id))
      .then((data) => {
        if (!data || data.success === false) { setPageError(data?.message || 'Loan not found.'); return; }
        setLoan(data);
      })
      .catch(() => setPageError('Unable to load loan details.'))
      .finally(() => setLoading(false));
  }, [id]);

  // ── Cleanup poll on unmount ───────────────────────────────────────────────
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ── Copy reference ────────────────────────────────────────────────────────
  const handleCopy = () => {
    if (!loan?.reference_no) return;
    navigator.clipboard.writeText(loan.reference_no).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ────────────────────────────────────────────────────────────────────────────
  // E-WALLET FLOW
  // ────────────────────────────────────────────────────────────────────────────
  const handleGenerateSource = async () => {
    setEStep('loading');
    setEError('');
    try {
      const origin = window.location.origin;
      const res = await fetch(`${API}/api/paymongo/source`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount:           dueAmount,
          type:             selectedWallet,
          reference_no:     loan?.reference_no,
          billing_name:     loan ? `${loan.first_name ?? ''} ${loan.last_name ?? ''}`.trim() || 'Customer' : 'Customer',
          billing_email:    loan?.email    ?? '',
          billing_phone:    loan?.contact_no ?? '',
          redirect_success: `${origin}/loan/${id}/pay/success?method=${selectedWallet}&amount=${dueAmount}`,
          redirect_failed:  `${origin}/loan/${id}/pay/failed`,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to create payment source.');

      const src = data.source;
      setSource(src);

      // Build QR data URL from base64 if available, else use checkout URL as QR text
      const qrBase64 = src.attributes?.qr_code;
      if (qrBase64) {
        setQrDataUrl(`data:image/png;base64,${qrBase64}`);
      } else {
        // Fallback: generate QR from checkout URL using a CDN
        const checkoutUrl = src.attributes?.redirect?.checkout_url ?? '';
        setQrDataUrl(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(checkoutUrl)}`);
      }

      setEStep('qr');
      startPolling(src.id);
    } catch (err: any) {
      setEError(err.message || 'Something went wrong.');
      setEStep('error');
    }
  };

  const startPolling = (sourceId: string) => {
    setEStep('polling');
    let attempts = 0;
    const MAX    = 60; // 5 minutes at 5s intervals

    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const res  = await fetch(`${API}/api/paymongo/source/${sourceId}`);
        const data = await res.json();
        const status = data.source?.attributes?.status;

        if (status === 'chargeable' || status === 'paid') {
          clearInterval(pollRef.current!);
          await recordPayment(sourceId, null);
        } else if (status === 'cancelled' || status === 'expired' || attempts >= MAX) {
          clearInterval(pollRef.current!);
          setEError('Payment was cancelled or expired. Please try again.');
          setEStep('error');
        }
      } catch {
        // network blip — keep polling
      }
    }, 5000);
  };

  const recordPayment = async (sourceId: string | null, intentId: string | null) => {
    try {
      const user  = JSON.parse(localStorage.getItem('user') || '{}');
      const res   = await fetch(`${API}/api/paymongo/record-payment`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loan_id:            id,
          amount:             dueAmount,
          method:             tab === 'ewallet' ? selectedWallet : 'card',
          paymongo_source_id: sourceId,
          paymongo_intent_id: intentId,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setEStep('success');
      // Navigate to success after brief delay
      setTimeout(() => navigate(`/loan/${id}/pay/success?method=${tab === 'ewallet' ? selectedWallet : 'card'}&amount=${dueAmount}`), 1500);
    } catch (err: any) {
      setEError(err.message || 'Failed to record payment.');
      setEStep('error');
    }
  };

  const resetEWallet = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setEStep('select');
    setEError('');
    setSource(null);
    setQrDataUrl('');
  };

  // ────────────────────────────────────────────────────────────────────────────
  // CARD FLOW
  // ────────────────────────────────────────────────────────────────────────────
  const validateCard = (): boolean => {
    const errs: Partial<CardForm> = {};
    const num = cardForm.number.replace(/\s/g, '');
    if (!num || num.length < 13)          errs.number  = 'Enter a valid card number.';
    if (!cardForm.name.trim())            errs.name    = 'Cardholder name is required.';
    if (!/^\d{2}\/\d{2}$/.test(cardForm.expiry)) errs.expiry = 'Enter expiry as MM/YY.';
    if (!cardForm.cvv || cardForm.cvv.length < 3) errs.cvv  = 'Enter a valid CVV.';
    setCardErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCardPay = async () => {
    if (!validateCard()) return;
    setCardStep('processing');
    setCardError('');

    try {
      // 1. Create payment intent
      const intentRes  = await fetch(`${API}/api/paymongo/intent`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: dueAmount, description: `Loan payment – ${loan?.reference_no}` }),
      });
      const intentData = await intentRes.json();
      if (!intentData.success) throw new Error(intentData.message);
      const intentId       = intentData.intent.id;
      const intentClientKey = intentData.intent.attributes.client_key;

      // 2. Create payment method
      const [month, year] = cardForm.expiry.split('/');
      const pmRes = await fetch('https://api.paymongo.com/v1/payment_methods', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Basic ${btoa(import.meta.env.VITE_PAYMONGO_PUBLIC_KEY + ':')}` },
        body: JSON.stringify({
          data: {
            attributes: {
              type: 'card',
              details: {
                card_number: cardForm.number.replace(/\s/g, ''),
                exp_month:   Number(month),
                exp_year:    Number(`20${year}`),
                cvc:         cardForm.cvv,
              },
              billing: { name: cardForm.name },
            },
          },
        }),
      });
      const pmData = await pmRes.json();
      if (pmData.errors) throw new Error(pmData.errors[0]?.detail || 'Invalid card details.');
      const pmId = pmData.data.id;

      // 3. Attach payment method to intent
      const attachRes = await fetch(`https://api.paymongo.com/v1/payment_intents/${intentId}/attach`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Basic ${btoa(import.meta.env.VITE_PAYMONGO_PUBLIC_KEY + ':')}` },
        body: JSON.stringify({
          data: {
            attributes: {
              payment_method:   pmId,
              client_key:       intentClientKey,
              return_url:       `${window.location.origin}/loan/${id}/pay/success?method=card&amount=${dueAmount}`,
            },
          },
        }),
      });
      const attachData = await attachRes.json();
      if (attachData.errors) throw new Error(attachData.errors[0]?.detail || 'Card payment failed.');

      const attachedIntent = attachData.data;
      const status         = attachedIntent.attributes?.status;

      if (status === 'succeeded') {
        await recordPayment(null, intentId);
        setCardStep('done');
      } else if (status === 'awaiting_next_action') {
        // 3DS redirect
        const redirectUrl = attachedIntent.attributes?.next_action?.redirect?.url;
        if (redirectUrl) window.location.href = redirectUrl;
        else throw new Error('3D Secure redirect URL missing.');
      } else {
        throw new Error('Card payment was not successful. Please try again.');
      }
    } catch (err: any) {
      setCardError(err.message || 'Card payment failed. Please try again.');
      setCardStep('form');
    }
  };

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER GUARDS
  // ────────────────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="text-primary animate-spin" size={48} />
    </div>
  );

  if (pageError || !loan) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center space-y-4">
      <AlertCircle className="text-red-500" size={40} />
      <h2 className="text-xl font-bold text-on-surface">{pageError || 'Loan not found.'}</h2>
      <button onClick={() => navigate('/dashboard')}
        className="bg-primary text-on-primary px-6 py-3 rounded-full font-bold">
        Back to Dashboard
      </button>
    </div>
  );

  const checkoutUrl = source?.attributes?.redirect?.checkout_url ?? '';

  // ────────────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      <TopBar title="Payment Gateway" onBack={() => navigate(`/loan/${id}/pay`)} />

      <main className="w-full max-w-md px-6 pt-24 pb-36 flex-1 space-y-6">

        {/* ── Amount card ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-container-highest rounded-2xl p-6 shadow-xl border border-outline-variant/10"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-on-surface-variant text-xs font-medium uppercase tracking-widest mb-1">
                Amount to Pay
              </p>
              <h2 className="font-headline font-extrabold text-3xl text-primary tracking-tight">
                ₱{dueAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
            </div>
            <span className="bg-primary/10 px-3 py-1 rounded-full text-primary text-[10px] font-bold uppercase tracking-wider">
              {paymentType === 'full' ? 'Full Settlement' : 'Installment'}
            </span>
          </div>
          <div className="pt-4 border-t border-outline-variant/10 flex justify-between items-center">
            <div>
              <p className="text-on-surface-variant text-[10px] uppercase tracking-wider mb-0.5">Reference No.</p>
              <p className="font-mono text-sm text-on-surface font-semibold">{loan.reference_no}</p>
            </div>
            <button onClick={handleCopy}
              className="flex items-center gap-1.5 text-on-surface-variant active:text-primary transition-colors">
              {copied ? <CheckCircle size={16} className="text-green-500" /> : <Copy size={16} />}
              <span className="text-[10px] font-bold uppercase tracking-wider">{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </motion.div>

        {/* ── Tab switcher ── */}
        <div className="flex bg-surface-container-high rounded-2xl p-1 gap-1">
          {([
            { id: 'ewallet', label: 'E-Wallet',    Icon: Wallet     },
            { id: 'card',    label: 'Credit / Debit Card', Icon: CreditCard },
          ] as const).map(({ id: tabId, label, Icon }) => (
            <button
              key={tabId}
              onClick={() => { setTab(tabId); resetEWallet(); setCardStep('form'); setCardError(''); }}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all',
                tab === tabId
                  ? 'bg-primary text-on-primary shadow-md'
                  : 'text-on-surface-variant hover:text-on-surface'
              )}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {/* ── E-WALLET PANEL ── */}
        <AnimatePresence mode="wait">
        {tab === 'ewallet' && (
          <motion.div
            key="ewallet"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            className="space-y-4"
          >
            {/* Step: Select wallet */}
            {eStep === 'select' && (
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">
                  Choose E-Wallet
                </p>
                {EWALLET_OPTIONS.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => setSelectedWallet(w.id)}
                    className={cn(
                      'w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all active:scale-[0.98]',
                      selectedWallet === w.id
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'border-outline-variant/20 bg-surface-container-high'
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center font-extrabold text-sm', w.bg, w.color)}>
                        {w.label.slice(0, 1)}
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-sm text-on-surface">{w.label}</p>
                        <p className="text-xs text-on-surface-variant">Scan QR or tap to open app</p>
                      </div>
                    </div>
                    {selectedWallet === w.id && <CheckCircle className="text-primary shrink-0" size={20} fill="currentColor" />}
                  </button>
                ))}
              </div>
            )}

            {/* Step: Loading */}
            {eStep === 'loading' && (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <Loader2 className="text-primary animate-spin" size={40} />
                <p className="text-on-surface-variant text-sm font-medium">Generating payment QR...</p>
              </div>
            )}

            {/* Step: QR + Redirect */}
            {(eStep === 'qr' || eStep === 'polling') && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4"
              >
                {/* QR Card */}
                <div className="bg-surface-container-high rounded-2xl p-6 flex flex-col items-center gap-4 border border-outline-variant/10">
                  <div className="flex items-center gap-2 mb-1">
                    <QrCode className="text-primary" size={18} />
                    <p className="text-sm font-bold text-on-surface">Scan with {selectedWallet === 'gcash' ? 'GCash' : 'Maya'}</p>
                  </div>

                  {qrDataUrl ? (
                    <div className="bg-white p-3 rounded-xl shadow-md">
                      <img src={qrDataUrl} alt="Payment QR Code" width={180} height={180} className="rounded-lg" />
                    </div>
                  ) : (
                    <div className="w-[180px] h-[180px] bg-surface-container-highest rounded-xl flex items-center justify-center">
                      <Loader2 className="text-primary animate-spin" size={32} />
                    </div>
                  )}

                  {eStep === 'polling' && (
                    <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                      <RefreshCw size={12} className="animate-spin" />
                      <span>Waiting for payment confirmation…</span>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-outline-variant/20" />
                  <span className="text-xs text-on-surface-variant font-medium">or</span>
                  <div className="flex-1 h-px bg-outline-variant/20" />
                </div>

                {/* Open App button */}
                {checkoutUrl && (
                  <a
                    href={checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-full bg-primary text-on-primary font-bold text-sm active:scale-95 transition-transform"
                  >
                    <Smartphone size={18} />
                    Open {selectedWallet === 'gcash' ? 'GCash' : 'Maya'} App
                    <ExternalLink size={14} />
                  </a>
                )}

                {/* Cancel */}
                <button
                  onClick={resetEWallet}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-full border border-outline-variant/30 text-on-surface-variant text-sm font-semibold active:scale-95 transition-transform"
                >
                  <X size={16} />
                  Cancel Payment
                </button>
              </motion.div>
            )}

            {/* Step: Success */}
            {eStep === 'success' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center py-12 gap-4"
              >
                <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="text-green-500" size={44} />
                </div>
                <p className="font-bold text-lg text-on-surface">Payment Confirmed!</p>
                <p className="text-sm text-on-surface-variant">Redirecting you now...</p>
              </motion.div>
            )}

            {/* Step: Error */}
            {eStep === 'error' && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 flex flex-col items-center gap-3 text-center"
              >
                <AlertCircle className="text-red-500" size={32} />
                <p className="text-sm text-red-600 font-medium">{eError}</p>
                <button
                  onClick={resetEWallet}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-500 text-white text-sm font-bold active:scale-95 transition-transform"
                >
                  <RefreshCw size={15} />
                  Try Again
                </button>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ── CARD PANEL ── */}
        {tab === 'card' && (
          <motion.div
            key="card"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            className="space-y-4"
          >
            {cardStep === 'form' && (
              <>
                <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">
                  Card Details
                </p>

                {/* Card number */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider px-1">Card Number</label>
                  <div className="relative">
                    <input
                      type="tel"
                      inputMode="numeric"
                      placeholder="0000 0000 0000 0000"
                      value={cardForm.number}
                      onChange={(e) => setCardForm(p => ({ ...p, number: formatCardNumber(e.target.value) }))}
                      className={cn(
                        'w-full bg-surface-container-high rounded-xl px-4 py-3.5 text-on-surface font-mono text-base tracking-widest border transition-all outline-none focus:ring-2 focus:ring-primary/30',
                        cardErrors.number ? 'border-red-400' : 'border-outline-variant/20 focus:border-primary'
                      )}
                    />
                    <CreditCard className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={18} />
                  </div>
                  {cardErrors.number && <p className="text-xs text-red-500 px-1">{cardErrors.number}</p>}
                </div>

                {/* Cardholder name */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider px-1">Cardholder Name</label>
                  <input
                    type="text"
                    placeholder="As it appears on the card"
                    value={cardForm.name}
                    onChange={(e) => setCardForm(p => ({ ...p, name: e.target.value.toUpperCase() }))}
                    className={cn(
                      'w-full bg-surface-container-high rounded-xl px-4 py-3.5 text-on-surface text-base border transition-all outline-none focus:ring-2 focus:ring-primary/30',
                      cardErrors.name ? 'border-red-400' : 'border-outline-variant/20 focus:border-primary'
                    )}
                  />
                  {cardErrors.name && <p className="text-xs text-red-500 px-1">{cardErrors.name}</p>}
                </div>

                {/* Expiry + CVV */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider px-1">Expiry</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      placeholder="MM/YY"
                      value={cardForm.expiry}
                      onChange={(e) => setCardForm(p => ({ ...p, expiry: formatExpiry(e.target.value) }))}
                      className={cn(
                        'w-full bg-surface-container-high rounded-xl px-4 py-3.5 text-on-surface font-mono text-base border transition-all outline-none focus:ring-2 focus:ring-primary/30',
                        cardErrors.expiry ? 'border-red-400' : 'border-outline-variant/20 focus:border-primary'
                      )}
                    />
                    {cardErrors.expiry && <p className="text-xs text-red-500 px-1">{cardErrors.expiry}</p>}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider px-1">CVV</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      placeholder="•••"
                      maxLength={4}
                      value={cardForm.cvv}
                      onChange={(e) => setCardForm(p => ({ ...p, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                      className={cn(
                        'w-full bg-surface-container-high rounded-xl px-4 py-3.5 text-on-surface font-mono text-base border transition-all outline-none focus:ring-2 focus:ring-primary/30',
                        cardErrors.cvv ? 'border-red-400' : 'border-outline-variant/20 focus:border-primary'
                      )}
                    />
                    {cardErrors.cvv && <p className="text-xs text-red-500 px-1">{cardErrors.cvv}</p>}
                  </div>
                </div>

                {cardError && (
                  <div className="p-3 bg-red-500/10 rounded-xl flex items-center gap-2 text-red-500 text-xs font-medium">
                    <AlertCircle size={16} />
                    <span>{cardError}</span>
                  </div>
                )}
              </>
            )}

            {cardStep === 'processing' && (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <Loader2 className="text-primary animate-spin" size={40} />
                <p className="text-on-surface-variant text-sm font-medium">Processing card payment...</p>
                <p className="text-on-surface-variant/60 text-xs">Please do not close this screen.</p>
              </div>
            )}

            {cardStep === 'done' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center py-12 gap-4"
              >
                <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="text-green-500" size={44} />
                </div>
                <p className="font-bold text-lg text-on-surface">Payment Confirmed!</p>
                <p className="text-sm text-on-surface-variant">Redirecting you now...</p>
              </motion.div>
            )}
          </motion.div>
        )}
        </AnimatePresence>

        {/* ── Security note ── */}
        {(eStep === 'select' || cardStep === 'form') && (
          <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl p-4 flex items-center gap-3">
            <ShieldCheck className="text-primary shrink-0" size={20} />
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Payments are encrypted and secured via PayMongo. Your card details are never stored on our servers.
            </p>
          </div>
        )}
      </main>

      {/* ── Sticky CTA ── */}
      <AnimatePresence>
        {((tab === 'ewallet' && eStep === 'select') || (tab === 'card' && cardStep === 'form')) && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-0 left-0 w-full bg-background/80 backdrop-blur-xl pt-4 pb-10 px-6 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.08)]"
          >
            <div className="max-w-md mx-auto">
              <Button
                onClick={tab === 'ewallet' ? handleGenerateSource : handleCardPay}
                className="w-full"
              >
                {tab === 'ewallet'
                  ? `Pay with ${selectedWallet === 'gcash' ? 'GCash' : 'Maya'}`
                  : `Pay ₱${dueAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                <ChevronRight size={18} />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
