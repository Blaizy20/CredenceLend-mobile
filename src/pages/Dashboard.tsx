import React from 'react';
import { Wallet, ReceiptText, ChevronDown } from 'lucide-react';
import loginLogo from '../assets/logo.png';
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

const statusStyle: Record<string, string> = {
  paid:    'bg-emerald-100 text-emerald-700',
  active:  'bg-green-100 text-green-700',
  pending: 'bg-blue-100 text-blue-700',
  denied:  'bg-red-100 text-red-700',
  closed:  'bg-slate-100 text-slate-600',
};

const getStatusStyle = (status: string) =>
  statusStyle[status?.toLowerCase()] ?? 'bg-outline/10 text-outline';

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
      // data is { success: true, loans: [...] }
      const loanList = data.loans || [];
      setLoans(loanList);

      // Only include 'Active' loans in outstanding balance
      const total = loanList
        .filter((l: Loan) => l.status?.toLowerCase() === 'active')
        .reduce((sum: number, l: Loan) => sum + Number(l.remaining_balance ?? l.principal_amount ?? 0), 0);
      setTotalBalance(total);
    } catch (err) {
      console.error("Dashboard fetchLoans error:", err);
      setLoans([]);
      setTotalBalance(0);
    } finally {
      setLoading(false);
    }
  };

  if (!parsedUser) return null;

  const sortedLoans = [...loans].sort((a, b) => {
    const aPaid = a.status?.toLowerCase() === 'paid';
    const bPaid = b.status?.toLowerCase() === 'paid';
    if (aPaid && !bPaid) return 1;
    if (!aPaid && bPaid) return -1;
    return 0;
  });

  const PREVIEW_COUNT = 3;
  const hiddenCount = sortedLoans.length - PREVIEW_COUNT;
  const hasMore = !showAllLoans && hiddenCount > 0;
  const displayedLoans = showAllLoans ? sortedLoans : sortedLoans.slice(0, PREVIEW_COUNT);

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopBar title={<span className="flex items-center gap-2"><img src={loginLogo} alt="Logo" className="w-7 h-7 rounded-lg" /> Loan Manager</span>} showBack={false} />
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

        {/* Outstanding Balance */}
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

            {/* ── Count badge + View All ── */}
            {loans.length > PREVIEW_COUNT && (
              <button
                onClick={() => setShowAllLoans(!showAllLoans)}
                className="flex items-center gap-1.5 text-primary text-xs font-bold uppercase tracking-widest"
              >
                {showAllLoans ? 'Show Less' : (
                  <>
                    View All
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-on-primary text-[10px] font-extrabold">
                      {loans.length}
                    </span>
                  </>
                )}
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
              <>
                {/* ── Loan rows ── */}
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
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-tighter ${getStatusStyle(loan.status)}`}>
                            {loan.status}
                          </span>
                        </div>
                        <span className="text-xs text-on-surface-variant text-right">
                          {new Date(loan.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* ── Fade-out hint when there are more loans ── */}
                {hasMore && (
                  <div className="relative">
                    {/* Ghost row — blurred/faded preview */}
                    <div className="px-6 py-5 opacity-30 pointer-events-none select-none">
                      <div className="grid grid-cols-3 items-center">
                        <div className="h-3 w-24 bg-on-surface/20 rounded-full" />
                        <div className="flex justify-center">
                          <div className="h-5 w-14 bg-on-surface/20 rounded-full" />
                        </div>
                        <div className="flex justify-end">
                          <div className="h-3 w-10 bg-on-surface/20 rounded-full" />
                        </div>
                      </div>
                    </div>

                    {/* Gradient fade overlay */}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-surface-container-low/80 to-surface-container-low pointer-events-none" />

                    {/* "X more" pill button */}
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                      <button
                        onClick={() => setShowAllLoans(true)}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-surface-container-highest border border-outline-variant/20 text-primary text-[11px] font-bold shadow-lg active:scale-95 transition-transform"
                      >
                        <ChevronDown size={13} />
                        {hiddenCount} more loan{hiddenCount > 1 ? 's' : ''}
                      </button>
                    </div>
                  </div>
                )}
              </>
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