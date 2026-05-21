import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { BottomNav } from '../components/BottomNav';
import { ReceiptText, ArrowUpRight, Calendar, FileDown, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { API_BASE } from '../lib/api';

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

export default function Transactions() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [loading, setLoading]           = React.useState(true);
  const [error, setError]               = React.useState('');

  React.useEffect(() => {
    let user: any   = null;
    let tenant: any = null;

    try { user = JSON.parse(localStorage.getItem('user') || 'null'); } catch {}

    // ✅ sessionStorage first, localStorage fallback
    try {
      tenant = JSON.parse(sessionStorage.getItem('tenant') || 'null')
            ?? JSON.parse(localStorage.getItem('tenant')   || 'null');
    } catch {}

    if (!user?.customer_id) {
      navigate('/login', { replace: true });
      return;
    }
    if (!tenant?.tenant_id) {
      navigate('/enter-code', { replace: true });
      return;
    }
    fetchTransactions(user.customer_id, tenant.tenant_id);
  }, [navigate]);

  const fetchTransactions = async (customerId: number, tenantId: number) => {
    try {
      const res  = await fetch(`${API_BASE}/api/payments/customer/${customerId}?tenant_id=${tenantId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message || 'Failed to load transactions.');
        return;
      }
      setTransactions(Array.isArray(data) ? data : []);
    } catch {
      setError('Unable to load transactions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const handleRequestHistory = () => {
    alert('Your full transaction history request has been received. A PDF report will be sent to your registered email address within 24 hours.');
  };

  const groupByDate = (txs: Transaction[]) => {
    const groups: { [key: string]: Transaction[] } = {};
    txs.forEach(tx => {
      const dateKey = new Date(tx.created_at).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(tx);
    });
    return groups;
  };

  const METHOD_LABELS: Record<string, string> = {
    CASH: 'Cash', GCASH: 'GCash', MAYA: 'Maya', CARD: 'Card',
    BANK: 'Bank Transfer', CHEQUE: 'Cheque', QRPH: 'QR Ph',
    GRAB_PAY: 'GrabPay', BPI: 'BPI', UNIONBANK: 'UnionBank', OTHER: 'Other',
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
        <div className="pt-24 px-6 flex flex-col items-center gap-4 text-center">
          <p className="text-red-500 text-sm font-medium">{error}</p>
          <button
            onClick={() => { setLoading(true); setError(''); }}
            className="text-primary text-sm font-bold hover:underline"
          >
            Try again
          </button>
        </div>
        <BottomNav />
      </div>
    );
  }

  const displayedTransactions = transactions.slice(0, 20);
  const groupedTransactions   = groupByDate(displayedTransactions);
  const hasMore               = transactions.length > 20;

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

      <main className="pt-24 px-6">
        <div className="mb-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Activity Log</p>
          <h2 className="text-xl font-headline font-extrabold text-on-surface">
            As of {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </h2>
        </div>

        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
            <div className="w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center mb-6">
              <ReceiptText className="text-outline/40" size={40} />
            </div>
            <h2 className="text-xl font-headline font-bold text-on-surface">No transactions</h2>
            <p className="text-on-surface-variant text-sm mt-2">
              Your payment history will appear here once your loan is active.
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
                  {txs.map((tx, index) => (
                    <motion.div
                      key={tx.payment_id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: (groupIndex * 0.1) + (index * 0.05) }}
                      className="bg-surface-container-low rounded-2xl p-4 flex items-center justify-between border border-outline-variant/20 shadow-sm"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500/10 text-blue-600">
                          <ArrowUpRight size={20} />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-on-surface">
                            {METHOD_LABELS[tx.method] ?? tx.method} Payment
                          </h4>
                          <div className="flex items-center gap-2 text-on-surface-variant text-[10px] mt-0.5">
                            <span className="flex items-center gap-1">
                              <Calendar size={10} className="text-outline/40" />
                              {formatTime(tx.created_at)}
                            </span>
                            <span className="text-outline/20">|</span>
                            <span className="font-mono bg-surface-container-high px-1.5 rounded text-outline">
                              {tx.reference_no}
                            </span>
                          </div>
                          {tx.or_no && (
                            <p className="text-[9px] text-on-surface-variant mt-0.5">OR #{tx.or_no}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm text-on-surface">
                          − ₱{Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          <span className="text-[9px] text-green-700 font-bold uppercase tracking-wider">Paid</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}

            {hasMore && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-4 pb-8">
                <div className="bg-surface-container-high/30 rounded-3xl p-8 text-center border border-dashed border-outline-variant/50">
                  <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileDown size={24} />
                  </div>
                  <h4 className="font-bold text-on-surface mb-2">Need more history?</h4>
                  <p className="text-xs text-on-surface-variant mb-6 leading-relaxed">
                    We only show your 20 most recent payments here. Request a full PDF statement of your account.
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

      <BottomNav />
    </div>
  );
}