import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { BottomNav } from '../components/BottomNav';
import {
  ReceiptText, FileDown, Loader2, AlertCircle, RefreshCw,
  X, Banknote, CreditCard, Smartphone, QrCode, Building2,
  CheckCircle2, Hash, Calendar, FileText, BookOpen, ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { API_BASE } from '../lib/api';
import {
  formatRelative,
  formatDate,
  formatFullDate,
  formatFullTime,
} from '../lib/dateutils';

/* ─── Types ──────────────────────────────────────────────────────────── */
interface Transaction {
  payment_id:   number;
  loan_id:      number;
  reference_no: string;
  amount:       number | string;
  method:       string;
  or_no:        string | null;
  notes:        string | null;
  created_at:   string;
}

/* ─── Per-method config ──────────────────────────────────────────────── */
interface MethodConfig {
  label: string;
  icon:  React.ReactNode;
  bg:    string;
  text:  string;
  badge: string;
}

const METHOD_CONFIG: Record<string, MethodConfig> = {
  GCASH:     { label: 'GCash',         icon: <Smartphone size={18} />, bg: 'bg-blue-500/10',    text: 'text-blue-500',    badge: 'bg-blue-500/10 text-blue-600'    },
  MAYA:      { label: 'Maya',          icon: <Smartphone size={18} />, bg: 'bg-emerald-500/10', text: 'text-emerald-500', badge: 'bg-emerald-500/10 text-emerald-700' },
  CASH:      { label: 'Cash',          icon: <Banknote   size={18} />, bg: 'bg-surface-container-high', text: 'text-on-surface-variant', badge: 'bg-surface-container-high text-on-surface-variant' },
  CARD:      { label: 'Card',          icon: <CreditCard size={18} />, bg: 'bg-violet-500/10',  text: 'text-violet-500',  badge: 'bg-violet-500/10 text-violet-700'  },
  BANK:      { label: 'Bank Transfer', icon: <Building2  size={18} />, bg: 'bg-indigo-500/10',  text: 'text-indigo-500',  badge: 'bg-indigo-500/10 text-indigo-700'  },
  BPI:       { label: 'BPI',           icon: <Building2  size={18} />, bg: 'bg-red-500/10',     text: 'text-red-500',     badge: 'bg-red-500/10 text-red-700'        },
  UNIONBANK: { label: 'UnionBank',     icon: <Building2  size={18} />, bg: 'bg-orange-500/10',  text: 'text-orange-500',  badge: 'bg-orange-500/10 text-orange-700'  },
  QRPH:      { label: 'QR Ph',         icon: <QrCode     size={18} />, bg: 'bg-teal-500/10',    text: 'text-teal-500',    badge: 'bg-teal-500/10 text-teal-700'      },
  GRAB_PAY:  { label: 'GrabPay',       icon: <Smartphone size={18} />, bg: 'bg-lime-500/10',    text: 'text-lime-600',    badge: 'bg-lime-500/10 text-lime-700'      },
  CHEQUE:    { label: 'Cheque',        icon: <FileText   size={18} />, bg: 'bg-amber-500/10',   text: 'text-amber-600',   badge: 'bg-amber-500/10 text-amber-700'    },
  OTHER:     { label: 'Other',         icon: <ReceiptText size={18}/>, bg: 'bg-surface-container-high', text: 'text-on-surface-variant', badge: 'bg-surface-container-high text-on-surface-variant' },
};

const getMethodConfig = (method: string): MethodConfig =>
  METHOD_CONFIG[method?.toUpperCase()] ?? METHOD_CONFIG.OTHER;

/* ─── Helpers ────────────────────────────────────────────────────────── */
// Groups by PHT-correct date label (e.g. "May 27, 2026")
const groupByDate = (txs: Transaction[]) => {
  const groups: Record<string, Transaction[]> = {};
  txs.forEach(tx => {
    const key = formatDate(tx.created_at); // ✅ PHT-aware via dateUtils
    if (!groups[key]) groups[key] = [];
    groups[key].push(tx);
  });
  return groups;
};

/* ─── Detail Row ─────────────────────────────────────────────────────── */
function DetailRow({ icon, label, value, mono = false }: {
  icon: React.ReactNode; label: string; value: string; mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5">
      <div className="flex items-center gap-2 text-on-surface-variant shrink-0">
        <span className="text-outline/60">{icon}</span>
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className={`text-xs text-right text-on-surface font-semibold ${mono ? 'font-mono' : ''}`}>
        {value}
      </p>
    </div>
  );
}

/* ─── Detail Sheet ───────────────────────────────────────────────────── */
function DetailSheet({ tx, onClose }: { tx: Transaction | null; onClose: () => void }) {
  React.useEffect(() => {
    if (!tx) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tx, onClose]);

  const cfg = tx ? getMethodConfig(tx.method) : null;

  return (
    <AnimatePresence>
      {tx && cfg && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            key="sheet"
            className="fixed bottom-0 left-0 right-0 z-50 bg-surface rounded-t-3xl shadow-2xl max-w-md mx-auto"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-outline/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-2 pb-4">
              <h2 className="text-base font-headline font-bold text-on-surface">Payment Details</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center active:scale-90 transition-transform"
              >
                <X size={16} className="text-on-surface-variant" />
              </button>
            </div>

            {/* Amount hero */}
            <div className="px-6 pb-5">
              <div className="bg-surface-container-low rounded-2xl p-4 flex items-center gap-4 border border-outline-variant/20">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
                  <span className={cfg.text}>{cfg.icon}</span>
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-0.5">
                    {cfg.label} Payment
                  </p>
                  <p className="text-2xl font-headline font-extrabold text-on-surface tracking-tight">
                    −&thinsp;₱{Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <CheckCircle2 size={14} className="text-green-500" />
                  <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Paid</span>
                </div>
              </div>
            </div>

            {/* Info rows — all using PHT-correct dateUtils functions */}
            <div className="px-6 pb-8 divide-y divide-outline-variant/10">
              <DetailRow icon={<Calendar  size={13} />} label="Date"         value={formatFullDate(tx.created_at)} />
              <DetailRow icon={<BookOpen  size={13} />} label="Time"         value={formatFullTime(tx.created_at)} />
              <DetailRow icon={<Hash      size={13} />} label="Reference No" value={tx.reference_no} mono />
              <DetailRow icon={<BookOpen  size={13} />} label="Loan ID"      value={`LOAN #${tx.loan_id}`} />
              {tx.or_no  && <DetailRow icon={<FileText size={13} />} label="OR Number" value={`#${tx.or_no}`} mono />}
              {tx.notes  && <DetailRow icon={<FileText size={13} />} label="Notes"     value={tx.notes} />}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────── */
export default function Transactions() {
  const navigate = useNavigate();

  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [loading, setLoading]           = React.useState(true);
  const [error, setError]               = React.useState('');
  const [selected, setSelected]         = React.useState<Transaction | null>(null);

  const customerRef = React.useRef<number | null>(null);
  const tenantRef   = React.useRef<number | null>(null);

  React.useEffect(() => {
    let user: any   = null;
    let tenant: any = null;

    try { user   = JSON.parse(localStorage.getItem('user')   || 'null'); } catch {}
    try {
      tenant = JSON.parse(sessionStorage.getItem('tenant') || 'null')
            ?? JSON.parse(localStorage.getItem('tenant')   || 'null');
    } catch {}

    if (!user?.customer_id)  { navigate('/login',      { replace: true }); return; }
    if (!tenant?.tenant_id)  { navigate('/enter-code', { replace: true }); return; }

    customerRef.current = user.customer_id;
    tenantRef.current   = tenant.tenant_id;
    fetchTransactions(user.customer_id, tenant.tenant_id);
  }, [navigate]);

  const fetchTransactions = async (customerId: number, tenantId: number) => {
    setLoading(true);
    setError('');
    try {
      const res  = await fetch(`${API_BASE}/api/payments/customer/${customerId}?tenant_id=${tenantId}`);
      const data = await res.json();
      if (!res.ok) { setError(data?.message || 'Failed to load transactions.'); return; }
      setTransactions(Array.isArray(data) ? data : []);
    } catch {
      setError('Unable to load transactions. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    if (customerRef.current && tenantRef.current)
      fetchTransactions(customerRef.current, tenantRef.current);
  };

  const handleRequestHistory = () =>
    alert('Your full transaction history request has been received. A PDF report will be sent to your registered email address within 24 hours.');

  /* ── Derived state ── */
  const displayed = transactions.slice(0, 20);
  const grouped   = groupByDate(displayed);
  const hasMore   = transactions.length > 20;
  const totalPaid = transactions.reduce((s, t) => s + Number(t.amount), 0);

  /* ── Loading ── */
  if (loading) return (
    <div className="min-h-screen bg-background pb-32">
      <TopBar title="Transactions" showBack={false} />
      <div className="pt-24 flex justify-center items-center min-h-[60vh]">
        <Loader2 className="text-primary animate-spin" size={36} />
      </div>
      <BottomNav />
    </div>
  );

  /* ── Error ── */
  if (error) return (
    <div className="min-h-screen bg-background pb-32">
      <TopBar title="Transactions" showBack={false} />
      <div className="pt-24 px-6 flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
        <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
          <AlertCircle className="text-red-500" size={36} />
        </div>
        <div>
          <h2 className="text-lg font-headline font-bold text-on-surface">Something went wrong</h2>
          <p className="text-on-surface-variant text-sm mt-1 max-w-xs">{error}</p>
        </div>
        <button
          onClick={handleRetry}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-full font-bold text-sm active:scale-95 transition-transform"
        >
          <RefreshCw size={16} />
          Try Again
        </button>
      </div>
      <BottomNav />
    </div>
  );

  /* ── Main ── */
  return (
    <div className="min-h-screen bg-background pb-32">
      <TopBar
        title="Transactions"
        showBack={false}
        rightElement={
          <button
            onClick={handleRequestHistory}
            className="p-2 text-primary hover:bg-primary/10 rounded-full transition-colors active:scale-90"
            title="Request History"
          >
            <FileDown size={24} />
          </button>
        }
      />

      <main className="pt-24 px-6 max-w-md mx-auto">

        {/* Summary bar */}
        {transactions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-primary/5 border border-primary/10 rounded-2xl p-4 flex items-center justify-between"
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-0.5">Total Paid</p>
              <p className="text-xl font-headline font-extrabold text-on-surface tracking-tight">
                ₱{totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-0.5">Payments</p>
              <p className="text-xl font-headline font-extrabold text-on-surface">{transactions.length}</p>
            </div>
          </motion.div>
        )}

        {/* Empty state */}
        {transactions.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center mb-6">
              <ReceiptText className="text-outline/40" size={40} />
            </div>
            <h2 className="text-xl font-headline font-bold text-on-surface">No transactions yet</h2>
            <p className="text-on-surface-variant text-sm mt-2 max-w-[22ch] mx-auto">
              Your payment history will appear here once your loan is active.
            </p>
          </div>
        )}

        {/* Grouped list */}
        {transactions.length > 0 && (
          <div className="space-y-8">
            {Object.entries(grouped).map(([date, txs], groupIndex) => (
              <div key={date}>
                {/* Sticky date header */}
                <div className="sticky top-16 bg-background/95 backdrop-blur-md py-2.5 z-20 border-b border-outline-variant/10 mb-3">
                  <h3 className="text-[10px] font-bold text-primary uppercase tracking-[0.18em]">{date}</h3>
                </div>

                <div className="space-y-2.5">
                  {txs.map((tx, index) => {
                    const cfg = getMethodConfig(tx.method);
                    return (
                      <motion.button
                        key={tx.payment_id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: (groupIndex * 0.08) + (index * 0.04) }}
                        onClick={() => setSelected(tx)}
                        className="w-full text-left bg-surface-container-low rounded-2xl p-4 flex items-center gap-3 border border-outline-variant/20 shadow-sm active:scale-[0.98] transition-transform"
                      >
                        {/* Method icon */}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
                          <span className={cfg.text}>{cfg.icon}</span>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <p className="font-bold text-sm text-on-surface leading-tight">
                              {cfg.label} Payment
                            </p>
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${cfg.badge}`}>
                              {cfg.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-on-surface-variant">
                            <span>{formatRelative(tx.created_at)}</span>
                            <span className="text-outline/30">·</span>
                            <span className="font-mono truncate max-w-[110px]">{tx.reference_no}</span>
                          </div>
                          {tx.or_no && (
                            <p className="text-[9px] text-on-surface-variant/60 mt-0.5">OR #{tx.or_no}</p>
                          )}
                        </div>

                        {/* Amount + chevron */}
                        <div className="shrink-0 flex items-center gap-1.5">
                          <div className="text-right">
                            <p className="font-bold text-sm text-on-surface">
                              −₱{Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                            <div className="flex items-center justify-end gap-1 mt-0.5">
                              <CheckCircle2 size={10} className="text-green-500" />
                              <span className="text-[9px] text-green-600 font-bold uppercase tracking-wider">Paid</span>
                            </div>
                          </div>
                          <ChevronRight size={14} className="text-outline/30" />
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* "Has more" card */}
            {hasMore && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-2 pb-8">
                <div className="bg-surface-container-high/30 rounded-3xl p-8 text-center border border-dashed border-outline-variant/50">
                  <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileDown size={22} />
                  </div>
                  <h4 className="font-bold text-sm text-on-surface mb-1">Need more history?</h4>
                  <p className="text-xs text-on-surface-variant mb-5 leading-relaxed max-w-[22ch] mx-auto">
                    Showing your 20 most recent payments. Request a full PDF statement.
                  </p>
                  <button
                    onClick={handleRequestHistory}
                    className="w-full py-3.5 bg-primary text-on-primary font-bold rounded-full text-sm active:scale-95 transition-all shadow-lg shadow-primary/20"
                  >
                    Request Full Statement
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </main>

      {/* Bottom sheet */}
      <DetailSheet tx={selected} onClose={() => setSelected(null)} />

      <BottomNav />
    </div>
  );
}
