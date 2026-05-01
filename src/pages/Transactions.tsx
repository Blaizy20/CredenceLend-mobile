import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { BottomNav } from '../components/BottomNav';
import { ReceiptText, ArrowUpRight, ArrowDownLeft, Calendar, FileDown, Loader2, Filter, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { loansAPI } from '../lib/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Transaction {
  id?:            number; // Server uses id
  transaction_id?: number; // Mock uses transaction_id
  customer_id:    number;
  type:           string;
  amount:         number | string;
  date:           string;
  status:         string;
  reference_no?:  string;
}

export default function Transactions() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [filteredTxs, setFilteredTxs]   = React.useState<Transaction[]>([]);
  const [loading, setLoading]           = React.useState(true);
  const [error, setError]               = React.useState('');
  const [filterDays, setFilterDays]     = React.useState(30);
  const [showFilterMenu, setShowFilterMenu] = React.useState(false);

  const filterOptions = [
    { label: 'Last 7 Days', value: 7 },
    { label: 'Last 30 Days', value: 30 },
    { label: 'Last 60 Days', value: 60 },
    { label: 'Last 90 Days', value: 90 },
    { label: 'All Time', value: 3650 },
  ];

  React.useEffect(() => {
    let user: any = null;
    try {
      user = JSON.parse(localStorage.getItem('customer') || localStorage.getItem('user') || 'null');
    } catch {}

    if (!user?.customer_id) {
      navigate('/login', { replace: true });
      return;
    }
    fetchTransactions(user.customer_id);
  }, [navigate]);

  React.useEffect(() => {
    applyFilter();
  }, [transactions, filterDays]);

  const fetchTransactions = async (customerId: number) => {
    try {
      const data = await loansAPI.getTransactions(customerId);
      if (data.success) {
        setTransactions(data.transactions || []);
      } else {
        setError(data.message || 'Failed to load transactions.');
      }
    } catch {
      setError('Unable to load transactions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const applyFilter = () => {
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(now.getDate() - filterDays);

    const filtered = transactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate >= cutoff;
    });

    setFilteredTxs(filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const user = JSON.parse(localStorage.getItem('customer') || '{}');
    const dateStr = new Date().toLocaleDateString();

    // Header
    doc.setFontSize(20);
    doc.setTextColor(1, 105, 111); // Brand color #01696F
    doc.text('CredenceLend Statement', 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Account Holder: ${user.first_name} ${user.last_name}`, 14, 30);
    doc.text(`Customer No: ${user.customer_no || 'N/A'}`, 14, 35);
    doc.text(`Report Period: ${filterOptions.find(o => o.value === filterDays)?.label}`, 14, 40);
    doc.text(`Generated on: ${dateStr}`, 14, 45);

    const tableData = filteredTxs.map(tx => [
      new Date(tx.date).toLocaleDateString(),
      tx.type,
      tx.status,
      `PHP ${Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
    ]);

    autoTable(doc, {
      startY: 55,
      head: [['Date', 'Description', 'Status', 'Amount']],
      body: tableData,
      headStyles: { fillColor: [1, 105, 111] },
      alternateRowStyles: { fillColor: [240, 247, 248] },
    });

    doc.save(`CredenceLend_Statement_${dateStr.replace(/\//g, '-')}.pdf`);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
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

  const groupedTransactions = groupTransactionsByDate(filteredTxs);

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopBar
        title="Transactions"
        showBack={false}
        rightElement={
          <button
            onClick={generatePDF}
            className="p-2 text-primary hover:bg-primary/10 rounded-full transition-colors active:scale-90"
            title="Download PDF Statement"
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

          <div className="relative">
            <button
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className="flex items-center gap-2 bg-surface-container-high px-3 py-1.5 rounded-full border border-outline-variant/30 text-xs font-bold text-on-surface-variant active:scale-95 transition-transform"
            >
              <Filter size={14} />
              Filter
              <ChevronDown size={14} className={showFilterMenu ? 'rotate-180 transition-transform' : 'transition-transform'} />
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
                    <button
                      key={opt.value}
                      onClick={() => {
                        setFilterDays(opt.value);
                        setShowFilterMenu(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors ${
                        filterDays === opt.value ? 'bg-primary text-on-primary' : 'text-on-surface hover:bg-primary/10'
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
                    const isCredit = transaction.type.toLowerCase().includes('received') || transaction.type.toLowerCase().includes('application');
                    const txId = transaction.id || transaction.transaction_id || Math.random();
                    return (
                      <motion.div
                        key={txId}
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
                                #{String(txId).slice(-5)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold text-sm ${isCredit ? 'text-green-600' : 'text-on-surface'}`}>
                            {isCredit ? '+' : '-'} ₱{Number(transaction.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <div className={`w-1.5 h-1.5 rounded-full ${transaction.status === 'Completed' ? 'bg-green-500' : 'bg-orange-500'}`} />
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