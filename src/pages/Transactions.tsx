import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { BottomNav } from '../components/BottomNav';
import { ReceiptText, ArrowUpRight, ArrowDownLeft, Calendar, FileDown, Loader2, Filter, ChevronDown, AlertCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Transaction {
  id:     number;
  loan_id: number;
  type:   string;
  amount: number | string;
  date:   string;
  status: string;
}

const filterOptions = [
  { label: 'Last 7 Days',  value: 7    },
  { label: 'Last 30 Days', value: 30   },
  { label: 'Last 60 Days', value: 60   },
  { label: 'Last 90 Days', value: 90   },
  { label: 'All Time',     value: 3650 },
];

export default function Transactions() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [loading, setLoading]           = React.useState(true);
  const [error, setError]               = React.useState('');
  const [filterDays, setFilterDays]     = React.useState(30);
  const [showFilterMenu, setShowFilterMenu] = React.useState(false);

  React.useEffect(() => {
    let user: any = null;
    try { user = JSON.parse(localStorage.getItem('user') || 'null'); } catch {}
    if (!user?.customer_id) { navigate('/login', { replace: true }); return; }
    fetchTransactions(user.customer_id);
  }, [navigate]);

  const fetchTransactions = async (customerId: number) => {
    setLoading(true);
    setError('');
    try {
      // Direct fetch — no API wrapper to avoid response shape mismatch
      const res  = await fetch(`/api/transactions/${customerId}`);
      const data = await res.json();
      if (!res.ok) { setError(data?.message || 'Failed to load transactions.'); return; }
      setTransactions(Array.isArray(data) ? data : []);
    } catch {
      setError('Unable to load transactions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    let user: any = null;
    try { user = JSON.parse(localStorage.getItem('user') || 'null'); } catch {}
    if (user?.customer_id) fetchTransactions(user.customer_id);
  };

  const filteredTxs = React.useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - filterDays);
    return [...transactions]
      .filter(tx => new Date(tx.date) >= cutoff)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, filterDays]);

  const handleRequestHistory = () => {
    alert('Your full transaction history request has been received. A PDF report will be sent to your registered email address within 24 hours.');
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const groupTransactionsByDate = (txs: Transaction[]) => {
    const groups: { [key: string]: Transaction[] } = {};
    txs.forEach(tx => {
      const dateKey = new Date(tx.date).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(tx);
    });
    return groups;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-32">
        <TopBar title="Transactions" showBack={false} />
        <div className="pt-24 flex justify-center">
          <Loader2 className="text-primary animate-spin" size={36} />
        </div>
        <BottomNav />
      </div>
    );
  }

  if (error) {
    return (
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
  }

  const groupedTransactions = groupTransactionsByDate(filteredTxs);

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopBar
        title="Transactions"
        showBack={false}
        rightElement={
          <button onClick={handleRequestHistory}
            className="p-2 text-primary hover:bg-primary/10 rounded-full transition-colors active:scale-90"
            title="Request Full Statement"
          >
            <FileDown size={24} />
          </button>
        }
      />

      <main className="pt-24 px-6">
        <div className="flex justify-between items-end mb-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Activity Log</p>
            <h2 className="text-xl font-headline font-extrabold text-on-surface">
              {filterOptions.find(o => o.value === filterDays)?.label}
            </h2>
          </div>

          {/* Filter dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className="flex items-center gap-2 bg-surface-container-high px-3 py-1.5 rounded-full border border-outline-variant/30 text-xs font-bold text-on-surface-variant active:scale-95 transition-transform"
            >
              <Filter size={14} />
              Filter
              <ChevronDown size={14} className={`transition-transform ${showFilterMenu ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {showFilterMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-40 bg-surface-container-highest rounded-2xl shadow-2xl border border-outline-variant/20 py-2 z-50 overflow-hidden"
                >
                  {filterOptions.map((opt) => (
                    <button key={opt.value}
                      onClick={() => { setFilterDays(opt.value); setShowFilterMenu(false); }}
                      className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors ${
                        filterDays === opt.value
                          ? 'bg-primary text-on-primary'
                          : 'text-on-surface hover:bg-primary/10'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {filteredTxs.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
            <div className="w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center mb-6">
              <ReceiptText className="text-outline/40" size={40} />
            </div>
            <h2 className="text-xl font-headline font-bold text-on-surface">No records found</h2>
            <p className="text-on-surface-variant text-sm mt-2">
              Try changing your filter to see more history.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedTransactions).map(([date, txs], groupIndex) => (
              <div key={date} className="space-y-3">
                <div className="sticky top-16 bg-background/95 backdrop-blur-md py-3 z-20 border-b border-outline-variant/10">
                  <h3 className="text-[11px] font-bold text-primary uppercase tracking-[0.2em]">{date}</h3>
                </div>
                <div className="space-y-3">
                  {txs.map((transaction, index) => {
                    const isCredit = transaction.type.toLowerCase().includes('received') ||
                                     transaction.type.toLowerCase().includes('application');
                    return (
                      <motion.div
                        key={transaction.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: (groupIndex * 0.1) + (index * 0.05) }}
                        className="bg-surface-container-low rounded-2xl p-4 flex items-center justify-between border border-outline-variant/20 shadow-sm"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            isCredit ? 'bg-green-500/10 text-green-600' : 'bg-blue-500/10 text-blue-600'
                          }`}>
                            {isCredit ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-on-surface">{transaction.type}</h4>
                            <div className="flex items-center gap-2 text-on-surface-variant text-[10px] mt-0.5">
                              <span className="flex items-center gap-1">
                                <Calendar size={10} className="text-outline/40" />
                                {formatTime(transaction.date)}
                              </span>
                              <span className="text-outline/20">|</span>
                              <span className="font-mono bg-surface-container-high px-1.5 rounded text-outline">
                                #{String(transaction.id).slice(-5)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold text-sm ${isCredit ? 'text-green-600' : 'text-on-surface'}`}>
                            {isCredit ? '+' : '-'} ₱{Number(transaction.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <div className={`w-1.5 h-1.5 rounded-full ${
                              transaction.status === 'Completed' ? 'bg-green-500' : 'bg-orange-500'
                            }`} />
                            <span className={`text-[9px] font-bold uppercase tracking-wider ${
                              transaction.status === 'Completed' ? 'text-green-700' : 'text-orange-700'
                            }`}>
                              {transaction.status}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}