import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { BottomNav } from '../components/BottomNav';
import {
  ReceiptText, FileDown, AlertCircle, RefreshCw,
  X, Banknote, CreditCard, Smartphone, QrCode, Building2,
  CheckCircle2, Hash, Calendar, FileText, BookOpen, ChevronRight,
  SlidersHorizontal, ArrowUpDown, ChevronDown, CalendarCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { API_BASE } from '../lib/api';
import {
  formatRelative, formatDate, formatFullDate, formatFullTime,
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

type SortOption   = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';
type FilterMethod = 'ALL' | string;

/* ─── Method config ──────────────────────────────────────────────────── */
interface MethodConfig { label: string; icon: React.ReactNode; bg: string; text: string; badge: string; }

const METHOD_CONFIG: Record<string, MethodConfig> = {
  GCASH:     { label: 'GCash',         icon: <Smartphone size={18} />, bg: 'bg-blue-500/10',            text: 'text-blue-500',          badge: 'bg-blue-500/10 text-blue-600'                      },
  MAYA:      { label: 'Maya',          icon: <Smartphone size={18} />, bg: 'bg-emerald-500/10',         text: 'text-emerald-500',       badge: 'bg-emerald-500/10 text-emerald-700'                },
  CASH:      { label: 'Cash',          icon: <Banknote   size={18} />, bg: 'bg-surface-container-high', text: 'text-on-surface-variant',badge: 'bg-surface-container-high text-on-surface-variant' },
  CARD:      { label: 'Card',          icon: <CreditCard size={18} />, bg: 'bg-violet-500/10',          text: 'text-violet-500',        badge: 'bg-violet-500/10 text-violet-700'                  },
  BANK:      { label: 'Bank Transfer', icon: <Building2  size={18} />, bg: 'bg-indigo-500/10',          text: 'text-indigo-500',        badge: 'bg-indigo-500/10 text-indigo-700'                  },
  BPI:       { label: 'BPI',           icon: <Building2  size={18} />, bg: 'bg-red-500/10',             text: 'text-red-500',           badge: 'bg-red-500/10 text-red-700'                        },
  UNIONBANK: { label: 'UnionBank',     icon: <Building2  size={18} />, bg: 'bg-orange-500/10',          text: 'text-orange-500',        badge: 'bg-orange-500/10 text-orange-700'                  },
  QRPH:      { label: 'QR Ph',         icon: <QrCode     size={18} />, bg: 'bg-teal-500/10',            text: 'text-teal-500',          badge: 'bg-teal-500/10 text-teal-700'                      },
  GRAB_PAY:  { label: 'GrabPay',       icon: <Smartphone size={18} />, bg: 'bg-lime-500/10',            text: 'text-lime-600',          badge: 'bg-lime-500/10 text-lime-700'                      },
  CHEQUE:    { label: 'Cheque',        icon: <FileText   size={18} />, bg: 'bg-amber-500/10',           text: 'text-amber-600',         badge: 'bg-amber-500/10 text-amber-700'                    },
  OTHER:     { label: 'Other',         icon: <ReceiptText size={18}/>, bg: 'bg-surface-container-high', text: 'text-on-surface-variant',badge: 'bg-surface-container-high text-on-surface-variant' },
};
const getMethodConfig = (method: string): MethodConfig =>
  METHOD_CONFIG[method?.toUpperCase()] ?? METHOD_CONFIG.OTHER;

/* ─── Helpers ────────────────────────────────────────────────────────── */
const toDateStr = (d: Date) => d.toISOString().slice(0, 10); // YYYY-MM-DD

const groupByDate = (txs: Transaction[]) => {
  const groups: Record<string, Transaction[]> = {};
  txs.forEach(tx => {
    const key = formatDate(tx.created_at);
    if (!groups[key]) groups[key] = [];
    groups[key].push(tx);
  });
  return groups;
};

/* ─── Skeleton ───────────────────────────────────────────────────────── */
function TransactionsSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-32">
      <TopBar title="Transactions" showBack={false} />
      <main className="pt-24 px-6 max-w-md mx-auto space-y-6">
        <div className="bg-surface-container-low rounded-2xl p-4 flex items-center justify-between border border-outline/15 animate-pulse">
          <div className="space-y-2">
            <div className="h-2.5 w-16 bg-surface-container-highest rounded-full" />
            <div className="h-6 w-32 bg-surface-container-highest rounded-full" />
          </div>
          <div className="space-y-2 items-end flex flex-col">
            <div className="h-2.5 w-16 bg-surface-container-highest rounded-full" />
            <div className="h-6 w-10 bg-surface-container-highest rounded-full" />
          </div>
        </div>
        <div className="flex gap-2 animate-pulse">
          <div className="h-9 w-24 bg-surface-container-highest rounded-full" />
          <div className="h-9 w-28 bg-surface-container-highest rounded-full" />
          <div className="h-9 w-20 bg-surface-container-highest rounded-full" />
        </div>
        <div className="space-y-6">
          {[1, 2].map(g => (
            <div key={g} className="space-y-3">
              <div className="h-3 w-24 bg-surface-container-highest rounded-full animate-pulse" />
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-surface-container-low rounded-2xl p-4 flex items-center gap-3 border border-outline/15 animate-pulse">
                  <div className="w-10 h-10 rounded-xl bg-surface-container-highest shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-32 bg-surface-container-highest rounded-full" />
                    <div className="h-2.5 w-48 bg-surface-container-highest rounded-full" />
                  </div>
                  <div className="space-y-1.5 items-end flex flex-col shrink-0">
                    <div className="h-3 w-20 bg-surface-container-highest rounded-full" />
                    <div className="h-2.5 w-12 bg-surface-container-highest rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

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
      <p className={`text-xs text-right text-on-surface font-semibold ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

/* ─── Floating Card Modal ─────────────────────────────────────────────── */
function FloatingModal({
  show, onBackdropClick, children,
}: {
  show: boolean; onBackdropClick: () => void; children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div
            key="fm-backdrop"
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onBackdropClick}
          />
          <motion.div
            key="fm-card"
            className="fixed inset-x-4 bottom-24 z-50 bg-surface rounded-3xl shadow-2xl max-w-md mx-auto overflow-hidden"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{    opacity: 0, y: 40,  scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
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
    <FloatingModal show={!!tx && !!cfg} onBackdropClick={onClose}>
      {tx && cfg && (
        <>
          <div className="flex items-center justify-between px-6 pt-5 pb-4">
            <h2 className="text-base font-headline font-bold text-on-surface">Payment Details</h2>
            <button onClick={onClose}
              className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center active:scale-90 transition-transform">
              <X size={16} className="text-on-surface-variant" />
            </button>
          </div>
          <div className="px-6 pb-4">
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
          <div className="px-6 pb-6 divide-y divide-outline-variant/10 max-h-64 overflow-y-auto">
            <DetailRow icon={<Calendar size={13} />} label="Date"         value={formatFullDate(tx.created_at)} />
            <DetailRow icon={<BookOpen size={13} />} label="Time"         value={formatFullTime(tx.created_at)} />
            <DetailRow icon={<Hash     size={13} />} label="Reference No" value={tx.reference_no} mono />
            <DetailRow icon={<BookOpen size={13} />} label="Loan ID"      value={`LOAN #${tx.loan_id}`} />
            {tx.or_no  && <DetailRow icon={<FileText size={13} />} label="OR Number" value={`#${tx.or_no}`} mono />}
            {tx.notes  && <DetailRow icon={<FileText size={13} />} label="Notes"     value={tx.notes} />}
          </div>
        </>
      )}
    </FloatingModal>
  );
}

/* ─── Filter / Sort Panel ────────────────────────────────────────────── */
function FilterPanel({
  show, onClose,
  sort, setSort,
  filterMethod, setFilterMethod,
  dateFrom, setDateFrom,
  dateTo, setDateTo,
  availableMethods,
  minDate, maxDate,
  onReset,
}: {
  show: boolean; onClose: () => void;
  sort: SortOption; setSort: (s: SortOption) => void;
  filterMethod: FilterMethod; setFilterMethod: (m: FilterMethod) => void;
  dateFrom: string; setDateFrom: (d: string) => void;
  dateTo: string; setDateTo: (d: string) => void;
  availableMethods: string[];
  minDate: string; // earliest transaction date
  maxDate: string; // latest transaction date (today cap)
  onReset: () => void;
}) {
  const SORT_OPTIONS: { value: SortOption; label: string }[] = [
    { value: 'date_desc',   label: 'Newest First'   },
    { value: 'date_asc',    label: 'Oldest First'   },
    { value: 'amount_desc', label: 'Highest Amount' },
    { value: 'amount_asc',  label: 'Lowest Amount'  },
  ];

  const today = toDateStr(new Date());

  // Quick preset ranges
  const setPreset = (preset: 'today' | 'week' | 'month' | 'all') => {
    const now = new Date();
    switch (preset) {
      case 'today':
        setDateFrom(today);
        setDateTo(today);
        break;
      case 'week': {
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 6);
        setDateFrom(toDateStr(weekAgo));
        setDateTo(today);
        break;
      }
      case 'month': {
        const monthAgo = new Date(now);
        monthAgo.setDate(now.getDate() - 29);
        setDateFrom(toDateStr(monthAgo));
        setDateTo(today);
        break;
      }
      case 'all':
        setDateFrom(minDate);
        setDateTo(maxDate);
        break;
    }
  };

  // Guard: From can't exceed To, To can't precede From
  const handleFromChange = (val: string) => {
    setDateFrom(val);
    if (dateTo && val > dateTo) setDateTo(val);
  };
  const handleToChange = (val: string) => {
    setDateTo(val);
    if (dateFrom && val < dateFrom) setDateFrom(val);
  };

  const isPresetActive = (preset: 'today' | 'week' | 'month' | 'all') => {
    const now = new Date();
    switch (preset) {
      case 'today':  return dateFrom === today && dateTo === today;
      case 'week': {
        const d = new Date(now); d.setDate(now.getDate() - 6);
        return dateFrom === toDateStr(d) && dateTo === today;
      }
      case 'month': {
        const d = new Date(now); d.setDate(now.getDate() - 29);
        return dateFrom === toDateStr(d) && dateTo === today;
      }
      case 'all':    return dateFrom === minDate && dateTo === maxDate;
      default:       return false;
    }
  };

  return (
    <FloatingModal show={show} onBackdropClick={onClose}>

      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-outline-variant/10">
        <h2 className="text-base font-headline font-bold text-on-surface">Sort & Filter</h2>
        <div className="flex items-center gap-3">
          <button onClick={onReset}
            className="text-xs font-bold text-primary uppercase tracking-widest active:opacity-60 transition-opacity">
            Reset
          </button>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center active:scale-90 transition-transform">
            <X size={16} className="text-on-surface-variant" />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="px-6 py-5 space-y-6 max-h-[60vh] overflow-y-auto overscroll-contain">

        {/* ── Sort ── */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">Sort By</p>
          <div className="grid grid-cols-2 gap-2.5">
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setSort(opt.value)}
                className={`py-4 px-3 rounded-2xl text-sm font-bold border transition-all active:scale-95 ${
                  sort === opt.value
                    ? 'bg-primary text-on-primary border-primary shadow-sm'
                    : 'bg-surface-container-low text-on-surface border-outline/15'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Payment Method ── */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">Payment Method</p>
          <div className="flex flex-wrap gap-2">
            {(['ALL', ...availableMethods] as string[]).map(m => {
              const cfg = m === 'ALL' ? null : getMethodConfig(m);
              return (
                <button
                  key={m}
                  onClick={() => setFilterMethod(m)}
                  className={`py-2.5 px-4 rounded-full text-sm font-bold border transition-all active:scale-95 ${
                    filterMethod === m
                      ? 'bg-primary text-on-primary border-primary shadow-sm'
                      : 'bg-surface-container-low text-on-surface border-outline/15'
                  }`}
                >
                  {m === 'ALL' ? 'All Methods' : cfg?.label ?? m}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Date Range ── */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">Date Range</p>

          {/* Quick presets */}
          <div className="flex flex-wrap gap-2 mb-4">
            {([
              { key: 'today', label: 'Today' },
              { key: 'week',  label: 'Last 7 Days' },
              { key: 'month', label: 'Last 30 Days' },
              { key: 'all',   label: 'All Time' },
            ] as { key: 'today' | 'week' | 'month' | 'all'; label: string }[]).map(p => (
              <button
                key={p.key}
                onClick={() => setPreset(p.key)}
                className={`flex items-center gap-1.5 py-2 px-3.5 rounded-full text-xs font-bold border transition-all active:scale-95 ${
                  isPresetActive(p.key)
                    ? 'bg-primary/10 text-primary border-primary/30'
                    : 'bg-surface-container-low text-on-surface-variant border-outline/15 hover:border-primary/30 hover:text-primary'
                }`}
              >
                {p.key === 'today' && <CalendarCheck size={11} />}
                {p.label}
              </button>
            ))}
          </div>

          {/* Manual pickers — clamped to transaction date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-on-surface-variant font-medium mb-1.5 block">From</label>
              <input
                type="date"
                value={dateFrom}
                min={minDate}
                max={dateTo || maxDate}
                onChange={e => handleFromChange(e.target.value)}
                className="w-full bg-surface-container-low border border-outline/20 rounded-2xl px-3 py-3 text-sm text-on-surface font-medium focus:outline-none focus:border-primary/50 transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] text-on-surface-variant font-medium mb-1.5 block">To</label>
              <input
                type="date"
                value={dateTo}
                min={dateFrom || minDate}
                max={maxDate}
                onChange={e => handleToChange(e.target.value)}
                className="w-full bg-surface-container-low border border-outline/20 rounded-2xl px-3 py-3 text-sm text-on-surface font-medium focus:outline-none focus:border-primary/50 transition-colors"
              />
            </div>
          </div>

          {/* Active range hint */}
          {(dateFrom || dateTo) && (
            <p className="mt-2 text-[10px] text-on-surface-variant text-center">
              Showing transactions from{' '}
              <span className="text-primary font-bold">{dateFrom || minDate}</span>
              {' '}to{' '}
              <span className="text-primary font-bold">{dateTo || maxDate}</span>
            </p>
          )}

          {/* Date range hint — shows the actual span of transactions */}
          {minDate && maxDate && (
            <p className="mt-1.5 text-[9px] text-outline/50 text-center">
              Your transactions span {minDate} — {maxDate}
            </p>
          )}
        </div>

      </div>

      {/* Apply button */}
      <div className="px-6 pt-4 pb-6 border-t border-outline-variant/10">
        <button
          onClick={onClose}
          className="w-full py-4 bg-primary text-on-primary font-bold rounded-full text-sm active:scale-95 transition-transform shadow-sm"
        >
          Apply Filters
        </button>
      </div>

    </FloatingModal>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────── */
export default function Transactions() {
  const navigate = useNavigate();

  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [loading, setLoading]           = React.useState(true);
  const [error, setError]               = React.useState('');
  const [selected, setSelected]         = React.useState<Transaction | null>(null);
  const [showFilter, setShowFilter]     = React.useState(false);

  const [sort,         setSort]         = React.useState<SortOption>('date_desc');
  const [filterMethod, setFilterMethod] = React.useState<FilterMethod>('ALL');
  const [dateFrom,     setDateFrom]     = React.useState('');
  const [dateTo,       setDateTo]       = React.useState('');

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

  const handleResetFilters = () => {
    setSort('date_desc');
    setFilterMethod('ALL');
    setDateFrom('');
    setDateTo('');
  };

  const availableMethods = React.useMemo(() =>
    [...new Set(transactions.map(t => t.method?.toUpperCase()).filter(Boolean))],
    [transactions]
  );

  // ── Derive transaction date bounds ────────────────────────────────────
  const { minDate, maxDate } = React.useMemo(() => {
    if (transactions.length === 0) return { minDate: '', maxDate: '' };
    const dates = transactions.map(t => t.created_at).sort();
    return {
      minDate: toDateStr(new Date(dates[0])),
      maxDate: toDateStr(new Date()),          // cap at today — can't filter beyond now
    };
  }, [transactions]);

  const processed = React.useMemo(() => {
    let result = [...transactions];
    if (filterMethod !== 'ALL')
      result = result.filter(t => t.method?.toUpperCase() === filterMethod);
    if (dateFrom)
      result = result.filter(t => new Date(t.created_at) >= new Date(dateFrom));
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      result = result.filter(t => new Date(t.created_at) <= end);
    }
    result.sort((a, b) => {
      switch (sort) {
        case 'date_asc':    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'amount_desc': return Number(b.amount) - Number(a.amount);
        case 'amount_asc':  return Number(a.amount) - Number(b.amount);
        case 'date_desc':
        default:            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    return result;
  }, [transactions, sort, filterMethod, dateFrom, dateTo]);

  const displayed = processed.slice(0, 20);
  const grouped   = groupByDate(displayed);
  const hasMore   = processed.length > 20;
  const totalPaid = processed.reduce((s, t) => s + Number(t.amount), 0);

  const activeFilterCount = [
    filterMethod !== 'ALL',
    dateFrom !== '',
    dateTo   !== '',
  ].filter(Boolean).length;

  const SORT_LABELS: Record<SortOption, string> = {
    date_desc:   'Newest',
    date_asc:    'Oldest',
    amount_desc: 'Highest',
    amount_asc:  'Lowest',
  };

  if (loading) return <TransactionsSkeleton />;

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
        <button onClick={handleRetry}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-full font-bold text-sm active:scale-95 transition-transform">
          <RefreshCw size={16} /> Try Again
        </button>
      </div>
      <BottomNav />
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopBar
        title="Transactions"
        showBack={false}
        rightElement={
          <button onClick={handleRequestHistory}
            className="p-2 text-primary hover:bg-primary/10 rounded-full transition-colors active:scale-90"
            title="Request History">
            <FileDown size={24} />
          </button>
        }
      />

      <main className="pt-24 px-6 max-w-md mx-auto">

        {/* ── Summary bar ── */}
        {transactions.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            className="mb-4 bg-primary/5 border border-primary/10 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-0.5">
                {processed.length < transactions.length ? 'Filtered Total' : 'Total Paid'}
              </p>
              <p className="text-xl font-headline font-extrabold text-on-surface tracking-tight">
                ₱{totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-0.5">Payments</p>
              <p className="text-xl font-headline font-extrabold text-on-surface">
                {processed.length}
                {processed.length < transactions.length && (
                  <span className="text-xs font-normal text-on-surface-variant ml-1">/ {transactions.length}</span>
                )}
              </p>
            </div>
          </motion.div>
        )}

        {/* ── Filter / Sort bar ── */}
        {transactions.length > 0 && (
          <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button onClick={() => setShowFilter(true)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full border text-xs font-bold shrink-0 transition-all ${
                activeFilterCount > 0
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-surface-container-low text-on-surface-variant border-outline/20'
              }`}>
              <SlidersHorizontal size={13} />
              Filters
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-on-primary/20 text-on-primary text-[9px] font-extrabold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <button onClick={() => setShowFilter(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-outline/20 bg-surface-container-low text-on-surface-variant text-xs font-bold shrink-0 transition-all">
              <ArrowUpDown size={13} />
              {SORT_LABELS[sort]}
              <ChevronDown size={12} />
            </button>

            {filterMethod !== 'ALL' && (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold shrink-0">
                {getMethodConfig(filterMethod).label}
                <button onClick={() => setFilterMethod('ALL')} className="hover:opacity-70 transition-opacity">
                  <X size={11} />
                </button>
              </div>
            )}

            {(dateFrom || dateTo) && (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold shrink-0">
                <Calendar size={11} />
                {dateFrom && dateTo
                  ? `${dateFrom} – ${dateTo}`
                  : dateFrom ? `From ${dateFrom}` : `To ${dateTo}`}
                <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="hover:opacity-70 transition-opacity">
                  <X size={11} />
                </button>
              </div>
            )}

            {(activeFilterCount > 0 || sort !== 'date_desc') && (
              <button onClick={handleResetFilters}
                className="flex items-center gap-1 px-3 py-2 rounded-full border border-outline/20 text-on-surface-variant text-xs font-bold shrink-0 hover:border-red-400/40 hover:text-red-400 transition-all">
                <X size={12} /> Reset
              </button>
            )}
          </div>
        )}

        {/* ── Empty: no transactions ── */}
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

        {/* ── Empty: filters returned nothing ── */}
        {transactions.length > 0 && processed.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center">
              <SlidersHorizontal className="text-outline/40" size={28} />
            </div>
            <div>
              <p className="font-headline font-bold text-on-surface">No results found</p>
              <p className="text-on-surface-variant text-sm mt-1">Try adjusting your filters.</p>
            </div>
            <button onClick={handleResetFilters}
              className="px-5 py-2.5 bg-primary text-on-primary rounded-full font-bold text-sm active:scale-95 transition-transform">
              Clear Filters
            </button>
          </div>
        )}

        {/* ── Grouped list ── */}
        {processed.length > 0 && (
          <div className="space-y-8">
            {Object.entries(grouped).map(([date, txs], groupIndex) => (
              <div key={date}>
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
                        transition={{ delay: (groupIndex * 0.06) + (index * 0.03) }}
                        onClick={() => setSelected(tx)}
                        className="w-full text-left bg-surface-container-low rounded-2xl p-4 flex items-center gap-3 border border-outline-variant/20 shadow-sm active:scale-[0.98] transition-transform"
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
                          <span className={cfg.text}>{cfg.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <p className="font-bold text-sm text-on-surface leading-tight">{cfg.label} Payment</p>
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

            {hasMore && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-2 pb-8">
                <div className="bg-surface-container-high/30 rounded-3xl p-8 text-center border border-dashed border-outline-variant/50">
                  <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileDown size={22} />
                  </div>
                  <h4 className="font-bold text-sm text-on-surface mb-1">Need more history?</h4>
                  <p className="text-xs text-on-surface-variant mb-5 leading-relaxed max-w-[22ch] mx-auto">
                    Showing your 20 most recent results. Request a full PDF statement.
                  </p>
                  <button onClick={handleRequestHistory}
                    className="w-full py-3.5 bg-primary text-on-primary font-bold rounded-full text-sm active:scale-95 transition-all shadow-lg shadow-primary/20">
                    Request Full Statement
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </main>

      <DetailSheet tx={selected} onClose={() => setSelected(null)} />

      <FilterPanel
        show={showFilter} onClose={() => setShowFilter(false)}
        sort={sort} setSort={setSort}
        filterMethod={filterMethod} setFilterMethod={setFilterMethod}
        dateFrom={dateFrom} setDateFrom={setDateFrom}
        dateTo={dateTo} setDateTo={setDateTo}
        availableMethods={availableMethods}
        minDate={minDate}
        maxDate={maxDate}
        onReset={handleResetFilters}
      />

      <BottomNav />
    </div>
  );
}