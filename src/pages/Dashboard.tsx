import React from 'react';
import { Wallet, ReceiptText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { BottomNav } from '../components/BottomNav';
import { motion } from 'motion/react';
import { loansAPI } from '../lib/api';

interface Loan {
  loan_id: number;
  reference_no: string;
  principal_amount: number;
  remaining_balance: number;
  status: string;
  due_date: string;
  created_at: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [loans, setLoans] = React.useState<Loan[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showAllLoans, setShowAllLoans] = React.useState(false);
  const [totalBalance, setTotalBalance] = React.useState(0);
  const [parsedUser, setParsedUser] = React.useState<any>(null);

  React.useEffect(() => {
    let user = null;
    try {
      user = JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      user = null;
    }

    localStorage.removeItem('loanApplicationData');
    localStorage.removeItem('loanApplicationStep2');

    if (!user || !user.customer_id) {
      localStorage.removeItem('user');
      navigate('/login', { replace: true });
      return;
    }

    setParsedUser(user);
    fetchLoans(user.customer_id);
  }, []);

  const fetchLoans = async (customerId: number) => {
    setLoading(true);
    try {
      const data = await loansAPI.getLoans(customerId);
      const loanList = Array.isArray(data) ? data : [];
      setLoans(loanList);

      // Sum remaining balances of active loans for "Current Amount"
      const total = loanList
        .filter((l: Loan) => l.status === 'Active')
        .reduce((sum: number, l: Loan) => sum + Number(l.remaining_balance ?? 0), 0);
      setTotalBalance(total);
    } catch {
      setLoans([]);
      setTotalBalance(0);
    } finally {
      setLoading(false);
    }
  };

  if (!parsedUser) return null;

  const sortedLoans = [...loans].sort((a, b) => {
    if (a.status === 'Paid' && b.status !== 'Paid') return 1;
    if (a.status !== 'Paid' && b.status === 'Paid') return -1;
    return 0;
  });

  const displayedLoans = showAllLoans ? sortedLoans : sortedLoans.slice(0, 3);

  const statusStyle: Record<string, string> = {
    Paid:    'bg-green-500/10 text-green-500',
    Active:  'bg-amber-500/10 text-amber-500',
    Pending: 'bg-red-500/10 text-red-500',
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopBar title="Loan Manager" showBack={false} />
      <main className="mt-20 px-6 max-w-md mx-auto w-full">

        {/* Welcome */}
        <motion.section
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-4"
        >
          <div className="space-y-1">
            <p className="text-primary font-headline text-sm font-bold tracking-widest uppercase">
              WELCOME, {parsedUser?.first_name?.toUpperCase()} {parsedUser?.last_name?.toUpperCase()}.
            </p>
            <p className="text-on-surface-variant text-sm font-headline">
              Customer No: <span className="text-primary">{parsedUser?.customer_no || 'N/A'}</span>
            </p>
          </div>
        </motion.section>

        {/* Current Balance */}
        <motion.section
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-8"
        >
          <div className="flex flex-col items-center mb-2">
            <span className="text-on-surface-variant text-xs font-bold uppercase tracking-widest mb-1">
              Outstanding Balance
            </span>
            <span className="font-headline font-extrabold text-5xl text-primary tracking-tight">
              ₱{totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </motion.section>

        {/* Apply Card */}
        <motion.section
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className="relative overflow-hidden rounded-2xl bg-surface-container-high p-4 shadow-xl flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center mb-4">
              <Wallet className="text-primary" size={28} />
            </div>
            <div className="space-y-2 mb-4">
              <h3 className="font-headline text-lg font-bold text-on-surface">Need a funding boost?</h3>
              <p className="text-on-surface-variant max-w-xs mx-auto text-xs leading-relaxed">
                Access competitive rates and flexible repayment plans tailored to your needs.
              </p>
            </div>
            <button
              onClick={() => navigate('/apply')}
              className="w-full py-3 px-6 bg-primary text-on-primary font-headline font-extrabold text-base rounded-full shadow-lg shadow-primary/20 active:scale-95 transition-all duration-200"
            >
              Apply for Loan
            </button>
          </div>
        </motion.section>

        {/* Loans List */}
        <section>
          <div className="flex justify-between items-center mb-6">
            <h4 className="font-headline text-xl font-bold text-on-surface">My Loans</h4>
            {loans.length > 3 && (
              <button
                onClick={() => setShowAllLoans(!showAllLoans)}
                className="text-primary text-xs font-bold uppercase tracking-widest"
              >
                {showAllLoans ? 'Show Less' : 'View All'}
              </button>
            )}
          </div>

          <div className="bg-surface-container-low rounded-2xl overflow-hidden border border-outline-variant/10">
            <div className="grid grid-cols-3 px-6 py-4 bg-surface-container-highest/20">
              <span className="text-[10px] font-headline font-bold uppercase tracking-widest text-outline">REFERENCE NO</span>
              <span className="text-[10px] font-headline font-bold uppercase tracking-widest text-outline text-center">STATUS</span>
              <span className="text-[10px] font-headline font-bold uppercase tracking-widest text-outline text-right">DATE</span>
            </div>

            {loading ? (
              <div className="py-12 flex justify-center">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : loans.length > 0 ? (
              <div className="divide-y divide-outline-variant/10">
                {displayedLoans.map((loan) => (
                  <div
                    key={loan.loan_id}
                    className="px-6 py-5 hover:bg-surface-container-highest/10 transition-colors cursor-pointer"
                    onClick={() => navigate(`/loan/${loan.loan_id}`)}
                  >
                    <div className="grid grid-cols-3 items-center mb-3">
                      <span className="text-xs font-mono font-bold text-on-surface truncate pr-2">
                        {loan.reference_no}
                      </span>
                      <div className="flex justify-center">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-tighter ${statusStyle[loan.status] ?? 'bg-outline/10 text-outline'}`}>
                          {loan.status}
                        </span>
                      </div>
                      <span className="text-xs text-on-surface-variant text-right">
                        {new Date(loan.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>

                    {loan.status === 'Active' && (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/loan/${loan.loan_id}`); }}
                          className="flex-1 py-2 bg-primary/10 text-primary text-[10px] font-bold rounded-lg uppercase tracking-wider border border-primary/20 active:scale-95 transition-all"
                        >
                          View Loan
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 px-8 text-center space-y-6">
                <div className="w-24 h-24 bg-surface-container-highest/30 rounded-full flex items-center justify-center">
                  <ReceiptText className="text-outline/40" size={48} />
                </div>
                <div>
                  <p className="text-on-surface font-headline font-bold text-lg">No loans yet</p>
                  <p className="text-on-surface-variant text-sm mt-2 leading-relaxed">
                    Your active and past loans will appear here once you submit an application.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}