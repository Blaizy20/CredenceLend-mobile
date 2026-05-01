import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar }    from '../components/TopBar';
import { BottomNav } from '../components/BottomNav';
import { Loader2, RefreshCw } from 'lucide-react';
import { API_BASE } from '../lib/api';

// ── types ─────────────────────────────────────────────────────────────────
interface Transaction {
  id:         number;
  loan_id:    number;
  loan_ref?:  string;
  or_no?:     string;
  type:       string;
  amount:     number | string;
  method?:    string;
  date:       string;
  status:     string;
}

// ── helpers ───────────────────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function groupByDate(txs: Transaction[]) {
  const groups: { [key: string]: Transaction[] } = {};
  const today     = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

  txs.forEach(tx => {
    const d = new Date(tx.date); d.setHours(0,0,0,0);
    let label: string;
    if (d.getTime() === today.getTime())     label = 'TODAY';
    else if (d.getTime() === yesterday.getTime()) label = 'YESTERDAY';
    else label = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
    if (!groups[label]) groups[label] = [];
    groups[label].push(tx);
  });
  return groups;
}

// Method → avatar config
function getMethodAvatar(method?: string, type?: string) {
  const m = (method ?? '').toLowerCase();
  const t = (type   ?? '').toLowerCase();

  if (m.includes('gcash'))     return { emoji: '💙', bg: 'bg-blue-50',   badge: 'GCash',   badgeColor: 'bg-blue-100 text-blue-700' };
  if (m.includes('maya'))      return { emoji: '💚', bg: 'bg-green-50',  badge: 'Maya',    badgeColor: 'bg-green-100 text-green-700' };
  if (m.includes('grabpay'))   return { emoji: '💚', bg: 'bg-green-50',  badge: 'GrabPay', badgeColor: 'bg-green-100 text-green-700' };
  if (m.includes('card') || m.includes('credit') || m.includes('debit'))
                               return { emoji: '💳', bg: 'bg-purple-50', badge: 'Card',    badgeColor: 'bg-purple-100 text-purple-700' };
  if (m.includes('qr'))        return { emoji: '📱', bg: 'bg-teal-50',   badge: 'QR Ph',   badgeColor: 'bg-teal-100 text-teal-700' };
  if (m.includes('bank') || m.includes('transfer') || m.includes('bpi') || m.includes('bdo') || m.includes('union'))
                               return { emoji: '🏦', bg: 'bg-amber-50',  badge: 'Bank',    badgeColor: 'bg-amber-100 text-amber-700' };
  if (m.includes('walkin') || m.includes('walk'))
                               return { emoji: '🏪', bg: 'bg-orange-50', badge: 'Walk-in', badgeColor: 'bg-orange-100 text-orange-700' };
  if (t.includes('loan received') || t.includes('disburs'))
                               return { emoji: '💰', bg: 'bg-green-50',  badge: 'Loan',    badgeColor: 'bg-green-100 text-green-700' };
  // default online
  return { emoji: '🌐', bg: 'bg-sky-50', badge: 'Online', badgeColor: 'bg-sky-100 text-sky-700' };
}

// ── component ─────────────────────────────────────────────────────────────
export default function Transactions() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [loading, setLoading]           = React.useState(true);
  const [refreshing, setRefreshing]     = React.useState(false);
  const [error, setError]               = React.useState('');

  const customerIdRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    let user: any = null;
    try { user = JSON.parse(localStorage.getItem('user') || 'null'); } catch {}
    if (!user?.customer_id) { navigate('/login', { replace: true }); return; }
    customerIdRef.current = user.customer_id;
    fetchTransactions(user.customer_id);
  }, [navigate]);

  const fetchTransactions = async (customerId: number, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res  = await fetch(`${API_BASE}/api/transactions/${customerId}`);
      const data = await res.json();
      if (!res.ok) { setError(data?.message || 'Failed to load transactions.'); return; }
      setTransactions(Array.isArray(data) ? data : []);
    } catch {
      setError('Unable to load transactions. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    if (!customerIdRef.current || refreshing) return;
    fetchTransactions(customerIdRef.current, true);
  };

  // ── Summary stats ─────────────────────────────────────────────────────
  const totalPaid = transactions
    .filter(t => t.type !== 'Loan Received')
    .reduce((s, t) => s + Number(t.amount), 0);

  const now          = new Date();
  const thisMonthPaid = transactions
    .filter(t => {
      const d = new Date(t.date);
      return t.type !== 'Loan Received' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s, t) => s + Number(t.amount), 0);

  // ── Render ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f5f7] pb-32">
        <TopBar title="Transactions" showBack={false} />
        <div className="pt-24 flex justify-center">
          <Loader2 className="text-primary animate-spin" size={36} />
        </div>
        <BottomNav />
      </div>
    );
  }

  const grouped = groupByDate(transactions);

  return (
    <div className="min-h-screen bg-[#f4f5f7] pb-32">
      {/* Header */}
      <div className="bg-white shadow-sm px-5 pt-14 pb-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">ACTIVITY LOG</p>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-white text-xs font-bold active:scale-95 transition-all disabled:opacity-60"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
        <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Payment History</h1>

        {/* Summary pills */}
        <div className="flex gap-3 mt-4 overflow-x-auto pb-1 scrollbar-hide">
          <div className="shrink-0 bg-[#f4f5f7] rounded-xl px-4 py-3 min-w-[110px]">
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Total Paid</p>
            <p className="text-base font-extrabold text-primary tabular-nums">₱{fmt(totalPaid)}</p>
          </div>
          <div className="shrink-0 bg-[#f4f5f7] rounded-xl px-4 py-3 min-w-[110px]">
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">This Month</p>
            <p className="text-base font-extrabold text-primary tabular-nums">₱{fmt(thisMonthPaid)}</p>
          </div>
          <div className="shrink-0 bg-[#f4f5f7] rounded-xl px-4 py-3 min-w-[90px]">
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Transactions</p>
            <p className="text-base font-extrabold text-gray-900 tabular-nums">{transactions.length}</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <main className="px-4 pt-4">
        {error && (
          <div className="text-center py-8">
            <p className="text-red-500 text-sm mb-3">{error}</p>
            <button onClick={handleRefresh} className="text-primary text-sm font-bold">Try again</button>
          </div>
        )}

        {!error && transactions.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
            <div className="text-5xl mb-4">🧾</div>
            <h2 className="text-base font-bold text-gray-800">No transactions yet</h2>
            <p className="text-gray-400 text-sm mt-1">Your payment history will appear here.</p>
          </div>
        )}

        {!error && Object.entries(grouped).map(([dateLabel, txs]) => (
          <div key={dateLabel} className="mb-6">
            {/* Date group header */}
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 px-1">
              {dateLabel}
            </p>

            {/* Transaction rows */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100">
              {txs.map(tx => {
                const isCredit = tx.type === 'Loan Received';
                const amount   = Number(tx.amount);
                const avatar   = getMethodAvatar(tx.method, tx.type);

                return (
                  <div key={tx.id} className="flex items-center px-4 py-3.5 active:bg-gray-50 transition-colors">
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-full ${avatar.bg} flex items-center justify-center text-xl shrink-0 mr-3`}>
                      {avatar.emoji}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{tx.type}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {(tx.loan_ref || tx.loan_id) && (
                          <span className="text-[10px] text-gray-400 font-mono truncate">
                            {tx.loan_ref ?? `LOAN-${tx.loan_id}`}
                          </span>
                        )}
                        {tx.or_no && (
                          <>
                            <span className="text-[10px] text-gray-300">·</span>
                            <span className="text-[10px] text-gray-400 font-mono truncate">{tx.or_no}</span>
                          </>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">{formatTime(tx.date)}</p>
                    </div>

                    {/* Amount + badge */}
                    <div className="text-right shrink-0 ml-2">
                      <p className={`text-sm font-bold tabular-nums ${isCredit ? 'text-green-600' : 'text-red-500'}`}>
                        {isCredit ? '+' : '−'}₱{fmt(amount)}
                      </p>
                      <span className={`inline-block mt-1 text-[9px] font-bold px-2 py-0.5 rounded-full ${avatar.badgeColor}`}>
                        {avatar.badge}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </main>

      <BottomNav />
    </div>
  );
}
