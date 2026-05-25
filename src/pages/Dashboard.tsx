import React from 'react';
import { Wallet, ReceiptText, ChevronDown, AlertTriangle, X, TrendingUp, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { BottomNav } from '../components/BottomNav';
import { motion, AnimatePresence } from 'motion/react';
import { loansAPI } from '../lib/api';
import { cn } from '@/src/lib/utils';

interface Loan {
  loan_id: number;
  reference_no: string;
  principal_amount: number;
  remaining_balance: number;
  status: string;
  due_date: string;
  created_at: string;
}

const BLOCKED_STATUSES = ['active', 'pending', 'under_review', 'overdue'];

const statusStyle: Record<string, { badge: string; dot: string }> = {
  paid:         { badge: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',  dot: 'bg-emerald-400' },
  active:       { badge: 'bg-green-500/15 text-green-500 border border-green-500/20',        dot: 'bg-green-500' },
  pending:      { badge: 'bg-blue-500/15 text-blue-400 border border-blue-500/20',           dot: 'bg-blue-400' },
  denied:       { badge: 'bg-red-500/15 text-red-400 border border-red-500/20',              dot: 'bg-red-400' },
  closed:       { badge: 'bg-outline/10 text-outline border border-outline/20',              dot: 'bg-outline' },
  under_review: { badge: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20',    dot: 'bg-yellow-400' },
  overdue:      { badge: 'bg-orange-500/15 text-orange-400 border border-orange-500/20',    dot: 'bg-orange-400' }, // ✅ ADDED
};

const getStatusStyle = (status: string) =>
  statusStyle[status?.toLowerCase()]?.badge ?? 'bg-outline/10 text-outline border border-outline/20';

const getDotStyle = (status: string) =>
  statusStyle[status?.toLowerCase()]?.dot ?? 'bg-outline';

const STATUS_LABEL: Record<string, string> = {
  active:       'Active Loan',
  pending:      'Pending Application',
  under_review: 'Under Review',
  overdue:      'Overdue Loan',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [loans, setLoans] = React.useState<Loan[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showAllLoans, setShowAllLoans] = React.useState(false);
  const [totalBalance, setTotalBalance] = React.useState(0);
  const [parsedUser, setParsedUser] = React.useState<any>(null);
  const [blockedLoan, setBlockedLoan] = React.useState<Loan | null>(null);

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

      const total = loanList
        .filter((l: Loan) => ['active', 'overdue'].includes(l.status?.toLowerCase()))
        .reduce((sum: number, l: Loan) => sum + Number(l.remaining_balance ?? 0), 0);
      setTotalBalance(total);
    } catch {
      setLoans([]);
      setTotalBalance(0);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyClick = () => {
    const blocked = loans.find(l => BLOCKED_STATUSES.includes(l.status?.toLowerCase()));
    if (blocked) {
      setBlockedLoan(blocked);
      return;
    }
    navigate('/apply');
  };

  if (!parsedUser) return null;

  // ── Sort: overdue first, then active, then others, paid last
  const sortedLoans = [...loans].sort((a, b) => {
    const order: Record<string, number> = { overdue: 0, active: 1, under_review: 2, pending: 3, denied: 4, closed: 5, paid: 6 };
    const aOrder = order[a.status?.toLowerCase()] ?? 4;
    const bOrder = order[b.status?.toLowerCase()] ?? 4;
    return aOrder - bOrder;
  });

  const overdueLoans  = loans.filter(l => l.status?.toLowerCase() === 'overdue');
  const activeLoans   = loans.filter(l => l.status?.toLowerCase() === 'active');
  const hasOverdue    = overdueLoans.length > 0;

  const PREVIEW_COUNT = 3;
  const hiddenCount   = sortedLoans.length - PREVIEW_COUNT;
  const hasMore       = !showAllLoans && hiddenCount > 0;
  const displayedLoans = showAllLoans ? sortedLoans : sortedLoans.slice(0, PREVIEW_COUNT);

  const fmt = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopBar title="Loan Manager" showBack={false} />

      <main className="mt-20 px-6 max-w-md mx-auto w-full space-y-6">

        {/* ── Welcome ── */}
        <motion.section
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="space-y-0.5">
            <p className="text-primary font-headline text-sm font-bold tracking-widest uppercase">
              Welcome back,
            </p>
            <p className="text-on-surface font-headline text-xl font-extrabold tracking-tight">
              {parsedUser?.first_name} {parsedUser?.last_name}
            </p>
            <p className="text-on-surface-variant text-xs font-headline pt-0.5">
              Customer No:{' '}
              <span className="text-primary font-bold">{parsedUser?.customer_no || 'N/A'}</span>
            </p>
          </div>
        </motion.section>

        {/* ── Overdue Alert Banner ── */}
        <AnimatePresence>
          {hasOverdue && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 flex items-start gap-3"
            >
              <div className="bg-orange-500 rounded-full p-1 shrink-0 mt-0.5">
                <AlertTriangle size={14} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-orange-500 font-headline font-bold text-sm">
                  {overdueLoans.length} overdue loan{overdueLoans.length > 1 ? 's' : ''} require attention
                </p>
                <p className="text-orange-400 text-xs mt-0.5 leading-relaxed">
                  Late fees are accumulating daily. Tap a loan below to pay now.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Balance + Stats Row ── */}
        <motion.section
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          {/* Main balance card */}
          <div className={cn(
            "relative overflow-hidden rounded-3xl p-6 shadow-xl mb-4",
            hasOverdue
              ? "bg-gradient-to-br from-orange-500/20 via-surface-container-high to-surface-container-high border border-orange-500/20"
              : "bg-gradient-to-br from-primary/10 via-surface-container-high to-surface-container-high border border-primary/10"
          )}>
            <div className={cn(
              "absolute top-0 right-0 -mr-8 -mt-8 w-40 h-40 rounded-full blur-[60px]",
              hasOverdue ? "bg-orange-500/20" : "bg-primary/15"
            )} />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">
                  Outstanding Balance
                </span>
                <div className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                  hasOverdue
                    ? "bg-orange-500/15 text-orange-400 border border-orange-500/20"
                    : "bg-primary/10 text-primary border border-primary/20"
                )}>
                  {hasOverdue ? (
                    <><Clock size={10} /> {overdueLoans.length} Overdue</>
                  ) : (
                    <><TrendingUp size={10} /> {activeLoans.length} Active</>
                  )}
                </div>
              </div>
              <p className={cn(
                "font-headline font-extrabold text-5xl tracking-tight",
                hasOverdue ? "text-orange-400" : "text-primary"
              )}>
                ₱{fmt(totalBalance)}
              </p>
              {hasOverdue && (
                <p className="text-orange-400/70 text-xs mt-1.5 font-medium">
                  Includes late fees on overdue loans
                </p>
              )}
            </div>
          </div>

          {/* Quick stat pills */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: 'Total Loans',
                value: loans.length,
                color: 'text-on-surface',
                bg: 'bg-surface-container',
              },
              {
                label: 'Active',
                value: activeLoans.length,
                color: 'text-green-500',
                bg: 'bg-green-500/10',
              },
              {
                label: 'Overdue',
                value: overdueLoans.length,
                color: overdueLoans.length > 0 ? 'text-orange-400' : 'text-on-surface-variant',
                bg: overdueLoans.length > 0 ? 'bg-orange-500/10' : 'bg-surface-container',
              },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={cn("rounded-2xl p-3 flex flex-col items-center gap-1", bg)}>
                <span className={cn("font-headline font-extrabold text-2xl tabular-nums", color)}>
                  {value}
                </span>
                <span className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest text-center">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── Apply Card ── */}
        <motion.section
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className="relative overflow-hidden rounded-2xl bg-surface-container-high p-5 shadow-xl flex items-center gap-4">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />
            <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
              <Wallet className="text-primary" size={24} />
            </div>
            <div className="flex-1 min-w-0 relative z-10">
              <h3 className="font-headline text-base font-bold text-on-surface leading-tight">
                Need a funding boost?
              </h3>
              <p className="text-on-surface-variant text-xs leading-relaxed mt-0.5">
                Competitive rates, flexible repayment plans.
              </p>
            </div>
            <button
              onClick={handleApplyClick}
              className="relative z-10 shrink-0 py-2.5 px-5 bg-primary text-on-primary font-headline font-extrabold text-sm rounded-full shadow-lg shadow-primary/20 active:scale-95 transition-all duration-200"
            >
              Apply
            </button>
          </div>
        </motion.section>

        {/* ── Loans List ── */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-headline text-xl font-bold text-on-surface">My Loans</h4>
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
            {/* Table header */}
            <div className="grid grid-cols-3 px-5 py-3.5 bg-surface-container-highest/20 border-b border-outline-variant/10">
              <span className="text-[10px] font-headline font-bold uppercase tracking-widest text-outline">Reference</span>
              <span className="text-[10px] font-headline font-bold uppercase tracking-widest text-outline text-center">Status</span>
              <span className="text-[10px] font-headline font-bold uppercase tracking-widest text-outline text-right">Date</span>
            </div>

            {loading ? (
              <div className="py-12 flex justify-center">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : loans.length > 0 ? (
              <>
                <div className="divide-y divide-outline-variant/10">
                  {displayedLoans.map((loan, index) => {
                    const isOverdueRow = loan.status?.toLowerCase() === 'overdue';
                    return (
                      <motion.div
                        key={loan.loan_id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.04 }}
                        className={cn(
                          "px-5 py-4 transition-colors cursor-pointer",
                          isOverdueRow
                            ? "hover:bg-orange-500/5 bg-orange-500/[0.03]"
                            : "hover:bg-surface-container-highest/10"
                        )}
                        onClick={() => navigate(`/loan/${loan.loan_id}`)}
                      >
                        <div className="grid grid-cols-3 items-center">
                          {/* Reference */}
                          <div className="flex items-center gap-2 pr-2 min-w-0">
                            <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", getDotStyle(loan.status))} />
                            <span className="text-xs font-mono font-bold text-on-surface truncate">
                              {loan.reference_no}
                            </span>
                          </div>

                          {/* Status badge */}
                          <div className="flex justify-center">
                            <span className={cn(
                              "text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-tighter",
                              getStatusStyle(loan.status)
                            )}>
                              {loan.status}
                            </span>
                          </div>

                          {/* Date */}
                          <span className="text-xs text-on-surface-variant text-right">
                            {new Date(loan.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>

                        {/* Overdue sub-row — remaining balance */}
                        {isOverdueRow && (
                          <div className="mt-2 ml-3.5 flex items-center gap-1.5">
                            <span className="text-orange-400/70 text-[10px] font-medium">Balance due:</span>
                            <span className="text-orange-400 text-[11px] font-headline font-bold tabular-nums">
                              ₱{fmt(Number(loan.remaining_balance))}
                            </span>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                {hasMore && (
                  <div className="relative">
                    <div className="px-5 py-4 opacity-30 pointer-events-none select-none">
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
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-surface-container-low/80 to-surface-container-low pointer-events-none" />
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

      {/* ── Blocked Loan Modal ── */}
      <AnimatePresence>
        {blockedLoan && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setBlockedLoan(null)}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 80 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 80 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-surface-container-low rounded-t-[2rem] shadow-2xl border-t border-outline-variant max-w-md mx-auto"
            >
              <div className="p-6">
                <div className="w-10 h-1 bg-outline-variant rounded-full mx-auto mb-6" />

                {/* Icon + Title */}
                <div className="flex flex-col items-center text-center mb-6">
                  <div className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center mb-4",
                    blockedLoan.status?.toLowerCase() === 'overdue'
                      ? "bg-orange-500/10"
                      : "bg-secondary/10"
                  )}>
                    <AlertTriangle size={32} className={
                      blockedLoan.status?.toLowerCase() === 'overdue'
                        ? "text-orange-400"
                        : "text-secondary"
                    } />
                  </div>
                  <h3 className="font-headline font-bold text-xl text-on-surface">
                    Application Not Allowed
                  </h3>
                  <p className="text-on-surface-variant text-sm mt-2 leading-relaxed">
                    You currently have a{' '}
                    <span className="font-bold text-on-surface">
                      {STATUS_LABEL[blockedLoan.status?.toLowerCase()] ?? blockedLoan.status}
                    </span>{' '}
                    that must be settled or resolved before you can apply for a new loan.
                  </p>
                </div>

                {/* Loan Info */}
                <div className="p-4 bg-surface-container-high rounded-2xl space-y-2 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">Reference No.</span>
                    <span className="font-bold font-mono text-on-surface">{blockedLoan.reference_no}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">Status</span>
                    <span className={cn(
                      "text-[11px] font-bold px-2 py-0.5 rounded-full uppercase",
                      getStatusStyle(blockedLoan.status)
                    )}>
                      {blockedLoan.status}
                    </span>
                  </div>
                  {blockedLoan.remaining_balance > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-on-surface-variant">Remaining Balance</span>
                      <span className={cn(
                        "font-bold",
                        blockedLoan.status?.toLowerCase() === 'overdue'
                          ? "text-orange-400"
                          : "text-on-surface"
                      )}>
                        ₱{Number(blockedLoan.remaining_balance).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      setBlockedLoan(null);
                      navigate(`/loan/${blockedLoan.loan_id}`);
                    }}
                    className={cn(
                      "w-full py-4 rounded-full font-bold text-sm active:scale-95 transition-transform",
                      blockedLoan.status?.toLowerCase() === 'overdue'
                        ? "bg-orange-500 text-white"
                        : "bg-primary text-on-primary"
                    )}
                  >
                    {blockedLoan.status?.toLowerCase() === 'overdue' ? 'Pay Now (Overdue)' : 'View Existing Loan'}
                  </button>
                  <button
                    onClick={() => setBlockedLoan(null)}
                    className="w-full py-4 rounded-full bg-surface-container-highest text-on-surface font-bold text-sm active:scale-95 transition-transform"
                  >
                    Go Back
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}