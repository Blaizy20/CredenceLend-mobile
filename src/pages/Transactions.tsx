import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { BottomNav } from '../components/BottomNav';
import { ReceiptText, ArrowUpRight, ArrowDownLeft, Calendar, FileDown } from 'lucide-react';
import { motion } from 'motion/react';

interface Transaction {
  id: string;
  userId: string;
  loanId: string;
  type: 'Loan Received' | 'Loan Payment';
  amount: number | string;
  date: string;
  status: string;
}

export default function Transactions() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      fetchTransactions(parsedUser.username);
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const fetchTransactions = (username: string) => {
    try {
      let txns = [];
      try {
        txns = JSON.parse(localStorage.getItem('transactions') || '[]');
      } catch {}
      // Only show for this user
      const userTxns = txns.filter((t: any) => t.userId === username);
      // Sort by date descending
      const sortedData = userTxns.sort((a: Transaction, b: Transaction) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setTransactions(sortedData);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleRequestHistory = () => {
    alert('Your full transaction history request has been received. A PDF report will be sent to your registered email address within 24 hours.');
  };

  const groupTransactionsByDate = (txs: Transaction[]) => {
    const groups: { [key: string]: Transaction[] } = {};
    txs.forEach(tx => {
      const d = new Date(tx.date);
      const dateKey = d.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
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
        <div className="pt-24 px-6 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
        <BottomNav />
      </div>
    );
  }

  const displayedTransactions = transactions.slice(0, 20);
  const groupedTransactions = groupTransactionsByDate(displayedTransactions);
  const hasMore = transactions.length > 20;

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
            <p className="text-on-surface-variant text-sm mt-2">Your transaction history will appear here.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedTransactions).map(([date, txs], groupIndex) => (
              <div key={date} className="space-y-3">
                <div className="sticky top-16 bg-background/95 backdrop-blur-md py-3 z-20 border-b border-outline-variant/10">
                  <h3 className="text-[11px] font-bold text-primary uppercase tracking-[0.2em]">
                    {date}
                  </h3>
                </div>
                <div className="space-y-3">
                  {txs.map((transaction, index) => (
                    <motion.div
                      key={transaction.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: (groupIndex * 0.1) + (index * 0.05) }}
                      className="bg-surface-container-low rounded-2xl p-4 flex items-center justify-between border border-outline-variant/20 shadow-sm"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          transaction.type === 'Loan Received' 
                            ? 'bg-green-500/10 text-green-600' 
                            : 'bg-blue-500/10 text-blue-600'
                        }`}>
                          {transaction.type === 'Loan Received' ? (
                            <ArrowDownLeft size={20} />
                          ) : (
                            <ArrowUpRight size={20} />
                          )}
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
                              #{transaction.id.split('-').pop()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold text-sm ${
                          transaction.type === 'Loan Received' ? 'text-green-600' : 'text-on-surface'
                        }`}>
                          {transaction.type === 'Loan Received' ? '+' : '-'} ₱{Number(transaction.amount).toLocaleString()}
                        </p>
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          <span className="text-[9px] text-green-700 font-bold uppercase tracking-wider">
                            {transaction.status}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}

            {hasMore && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="pt-4 pb-8"
              >
                <div className="bg-surface-container-high/30 rounded-3xl p-8 text-center border border-dashed border-outline-variant/50">
                  <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileDown size={24} />
                  </div>
                  <h4 className="font-bold text-on-surface mb-2">Need more history?</h4>
                  <p className="text-xs text-on-surface-variant mb-6 leading-relaxed">
                    We only show your 20 most recent activities here. You can request a full PDF statement of your account.
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
