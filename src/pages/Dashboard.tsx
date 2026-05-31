import React from 'react';
import {
  Wallet, ReceiptText, ChevronDown, AlertTriangle,
  TrendingUp, Clock, X, CheckCircle2, Ban,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { BottomNav } from '../components/BottomNav';
import { motion, AnimatePresence } from 'motion/react';
import { loansAPI } from '../lib/api';
import { cn } from '@/src/lib/utils';

interface Loan {
  loan_id:           number;
  reference_no:      string;
  principal_amount:  number;
  remaining_balance: number;
  status:            string;
  due_date:          string;
  created_at:        string;
}

const BLOCKED_STATUSES = ['active', 'pending', 'under_review', 'overdue'];

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { badge: string; dot: string; row: string }> = {
  active:       { badge: 'bg-green-500/12 text-green-600 border border-green-500/30',                          dot: 'bg-green-500',  row: 'hover:bg-green-500/[0.03]'                              },
  pending:      { badge: 'bg-blue-500/12 text-blue-600 border border-blue-500/30',                             dot: 'bg-blue-500',   row: 'hover:bg-blue-500/[0.03]'                               },
  under_review: { badge: 'bg-yellow-500/12 text-yellow-600 border border-yellow-500/30',                       dot: 'bg-yellow-500', row: 'hover:bg-yellow-500/[0.03]'                             },
  overdue:      { badge: 'bg-orange-500/12 text-orange-600 border border-orange-500/30',                       dot: 'bg-orange-500', row: 'bg-orange-500/[0.03] hover:bg-orange-500/[0.06]'        },
  closed:       { badge: 'bg-surface-container-highest text-on-surface-variant border border-outline/25',      dot: 'bg-outline',    row: 'hover:bg-surface-container-highest/30'                  },
  denied:       { badge: 'bg-red-500/12 text-red-500 border border-red-500/30',                                dot: 'bg-red-400',    row: 'hover:bg-red-500/[0.03]'                                },
  paid:         { badge: 'bg-emerald-500/12 text-emerald-600 border border-emerald-500/30',                    dot: 'bg-emerald-500',row: 'hover:bg-emerald-500/[0.03]'                            },
};

const getStatusConfig = (status: string) =>
  STATUS_CONFIG[status?.toLowerCase()] ?? STATUS_CONFIG.closed;

const STATUS_LABEL: Record<string, string> = {
  active:       'Active Loan',
  pending:      'Pending Application',
  under_review: 'Under Review',
  overdue:      'Overdue Loan',
};

// ── Sort: urgent/active first, then by date descending within each tier ───────
const STATUS_TIER: Record<string, number> = {
  overdue:      0,
  active:       1,
  under_review: 2,
  pending:      3,
  // closed and denied both fall to tier 4 — sorted purely by date after this
};

// ── Skeleton ──────────────────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-32">
      <TopBar title="Loan Manager" showBack={false} />
      <main className="mt-20 px-6 max-w-md mx-auto w-full space-y-6">

        {/* Welcome */}
        <div className="space-y-2">
          <div className="h-3 w-24 bg-surface-container-highest rounded-full animate-pulse" />
          <div className="h-6 w-48 bg-surface-container-highest rounded-full animate-pulse" />
          <div className="h-3 w-32 bg-surface-container-highest rounded-full animate-pulse" />
        </div>

        {/* Balance card */}
        <div className="rounded-3xl bg-surface-container-high border border-outline/15 p-6 space-y-4
          shadow-[0_4px_16px_rgba(0,0,0,0.07)]">
          <div className="flex justify-between items-center">
            <div className="h-3 w-32 bg-surface-container-highest rounded-full animate-pulse" />
            <div className="h-6 w-20 bg-surface-container-highest rounded-full animate-pulse" />
          </div>
          <div className="h-12 w-48 bg-surface-container-highest rounded-full animate-pulse" />
        </div>

        {/* Stat pills */}
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-2xl bg-surface-container border border-outline/15 p-3 flex flex-col items-center gap-2">
              <div className="h-7 w-8 bg-surface-container-highest rounded-full animate-pulse" />
              <div className="h-2.5 w-12 bg-surface-container-highest rounded-full animate-pulse" />
            </div>
          ))}
        </div>

        {/* Apply card */}
        <div className="rounded-2xl bg-surface-container-high border border-outline/15 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-surface-container-highest animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-36 bg-surface-container-highest rounded-full animate-pulse" />
            <div className="h-3 w-48 bg-surface-container-highest rounded-full animate-pulse" />
          </div>
          <div className="h-9 w-16 bg-surface-container-highest rounded-full animate-pulse shrink-0" />
        </div>

        {/* Loans list */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="h-6 w-24 bg-surface-container-highest rounded-full animate-pulse" />
            <div className="h-4 w-16 bg-surface-container-highest rounded-full animate-pulse" />
          </div>
          <div className="bg-surface-container-low rounded-2xl overflow-hidden border border-outline/15">
            <div className="grid grid-cols-3 px-5 py-3.5 bg-surface-container-highest/25 border-b border-outline/12 gap-4">
              <div className="h-2.5 w-16 bg-surface-container-highest rounded-full animate-pulse" />
              <div className="h-2.5 w-12 bg-surface-container-highest rounded-full animate-pulse mx-auto" />
              <div className="h-2.5 w-10 bg-surface-container-highest rounded-full animate-pulse ml-auto" />
            </div>
            {[1, 2, 3].map(i => (
              <div key={i} className="px-5 py-4 border-b border-outline/10 last:border-b-0">
                <div className="grid grid-cols-3 items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-surface-container-highest animate-pulse shrink-0" />
                    <div className="h-3 w-24 bg-surface-container-highest rounded-full animate-pulse" />
                  </div>
                  <div className="flex justify-center">
                    <div className="h-5 w-14 bg-surface-container-highest rounded-full animate-pulse" />
                  </div>
                  <div className="flex justify-end">
                    <div className="h-3 w-10 bg-surface-container-highest rounded-full animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>
      <BottomNav />
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const [loans, setLoans]               = React.useState<Loan[]>([]);
  const [loading, setLoading]           = React.useState(true);
  const [showAllLoans, setShowAllLoans] = React.useState(false);
  const [totalBalance, setTotalBalance] = React.useState(0);
  const [parsedUser, setParsedUser]     = React.useState<any>(null);
  const [blockedLoan, setBlockedLoan]   = React.useState<Loan | null>(null);

  React.useEffect(() => {
    let user = null;
    try { user = JSON.parse(localStorage.getItem('user') || 'null'); } catch {}

    localStorage.removeItem('loanApplicationData');
    localStorage.removeItem('loanApplicationStep2');

    if (!user?.customer_id) {
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
      const data     = await loansAPI.getLoans(customerId);
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
    if (blocked) { setBlockedLoan(blocked); return; }
    navigate('/apply');
  };

  if (!parsedUser) return null;
  if (loading)     return <DashboardSkeleton />;

  // ── Sort: tier first (urgent on top), then purely by date desc within tier ──
  const sortedLoans = [...loans].sort((a, b) => {
    const aTier = STATUS_TIER[a.status?.toLowerCase()] ?? 4;
    const bTier = STATUS_TIER[b.status?.toLowerCase()] ?? 4;
    if (aTier !== bTier) return aTier - bTier;
    // Same tier (including all closed/denied) → newest first
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const overdueLoans = loans.filter(l => l.status?.toLowerCase() === 'overdue');
  const activeLoans  = loans.filter(l => l.status?.toLowerCase() === 'active');
  const hasOverdue   = overdueLoans.length > 0;

  const PREVIEW_COUNT  = 3;
  const hiddenCount    = sortedLoans.length - PREVIEW_COUNT;
  const hasMore        = !showAllLoans && hiddenCount > 0;
  const displayedLoans = showAllLoans ? sortedLoans : sortedLoans.slice(0, PREVIEW_COUNT);

  const fmt = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopBar title="Loan Manager" showBack={false} />

      <main className="mt-20 px-6 max-w-md mx-auto w-full space-y-6">

        {/* ── Welcome ── */}
        <motion.section initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
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
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="bg-orange-500/10 border border-orange-500/25 rounded-2xl p-4 flex items-start gap-3"
            >
              <div className="bg-orange-500 rounded-full p-1 shrink-0 mt-0.5">
                <AlertTriangle size={14} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-orange-600 font-headline font-bold text-sm">
                  {overdueLoans.length} overdue loan{overdueLoans.length > 1 ? 's' : ''} require attention
                </p>
                <p className="text-orange-500/80 text-xs mt-0.5 leading-relaxed">
                  Late fees are accumulating daily. Tap a loan below to pay now.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Balance Card ── */}
        <motion.section
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        >
          <div className={cn(
            "relative overflow-hidden rounded-3xl p-6 mb-4",
            hasOverdue
              ? "bg-surface-container-high border border-orange-500/20 shadow-[0_4px_16px_rgba(0,0,0,0.07),0_2px_4px_rgba(0,0,0,0.04)]"
              : "bg-surface-container-high border border-primary/15 shadow-[0_4px_16px_rgba(0,0,0,0.07),0_2px_4px_rgba(0,0,0,0.04)]"
          )}>
            <div className={cn(
              "absolute top-0 right-0 -mr-10 -mt-10 w-36 h-36 rounded-full blur-[56px] pointer-events-none",
              hasOverdue ? "bg-orange-500/15" : "bg-primary/12"
            )} />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">
                  Outstanding Balance
                </span>
                <div className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                  hasOverdue
                    ? "bg-orange-500/10 text-orange-600 border-orange-500/25"
                    : "bg-primary/10 text-primary border-primary/20"
                )}>
                  {hasOverdue
                    ? <><Clock size={10} /> {overdueLoans.length} Overdue</>
                    : <><TrendingUp size={10} /> {activeLoans.length} Active</>
                  }
                </div>
              </div>
              <p className={cn(
                "font-headline font-extrabold text-5xl tracking-tight",
                hasOverdue ? "text-orange-500" : "text-primary"
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

          {/* Stat pills */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Loans', value: loans.length,          color: 'text-on-surface',          bg: 'bg-surface-container border border-outline/15'          },
              { label: 'Active',      value: activeLoans.length,    color: 'text-green-600',            bg: 'bg-green-500/8 border border-green-500/20'              },
              { label: 'Overdue',     value: overdueLoans.length,   color: overdueLoans.length > 0 ? 'text-orange-500' : 'text-on-surface-variant',
                bg: overdueLoans.length > 0 ? 'bg-orange-500/8 border border-orange-500/20' : 'bg-surface-container border border-outline/15' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={cn("rounded-2xl p-3 flex flex-col items-center gap-1", bg)}>
                <span className={cn("font-headline font-extrabold text-2xl tabular-nums", color)}>{value}</span>
                <span className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest text-center">{label}</span>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── Apply Card ── */}
        <motion.section
          initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
        >
          <div className="relative overflow-hidden rounded-2xl bg-surface-container-high border border-outline/15 p-5
            shadow-[0_2px_8px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.03)]
            flex items-center gap-4
            transition-shadow duration-200 hover:shadow-[0_4px_16px_rgba(0,0,0,0.07),0_2px_4px_rgba(0,0,0,0.04)]">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
              <Wallet className="text-primary" size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-headline text-base font-bold text-on-surface leading-tight">Need a funding boost?</h3>
              <p className="text-on-surface-variant text-xs leading-relaxed mt-0.5">Competitive rates, flexible repayment plans.</p>
            </div>
            <button
              onClick={handleApplyClick}
              className="shrink-0 py-2.5 px-5 bg-primary text-on-primary font-headline font-extrabold text-sm rounded-full
                shadow-[0_2px_8px_rgba(0,0,0,0.05)] transition-all duration-150
                hover:scale-[1.02] hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)] active:scale-95"
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
                className="flex items-center gap-1.5 text-primary text-xs font-bold uppercase tracking-widest
                  transition-opacity duration-150 hover:opacity-70"
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

          <div className="bg-surface-container-low rounded-2xl overflow-hidden border border-outline/15
            shadow-[0_2px_8px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.03)]">

            {/* Table header */}
            <div className="grid grid-cols-3 px-5 py-3.5 bg-surface-container-highest/25 border-b border-outline/12">
              <span className="text-[10px] font-headline font-bold uppercase tracking-widest text-on-surface-variant">Reference</span>
              <span className="text-[10px] font-headline font-bold uppercase tracking-widest text-on-surface-variant text-center">Status</span>
              <span className="text-[10px] font-headline font-bold uppercase tracking-widest text-on-surface-variant text-right">Date</span>
            </div>

            {loans.length > 0 ? (
              <>
                <div className="divide-y divide-outline/10">
                  {displayedLoans.map((loan, index) => {
                    const config       = getStatusConfig(loan.status);
                    const isOverdueRow = loan.status?.toLowerCase() === 'overdue';
                    const isClosedRow  = loan.status?.toLowerCase() === 'closed';
                    const isDeniedRow  = loan.status?.toLowerCase() === 'denied';

                    return (
                      <motion.div
                        key={loan.loan_id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.04 }}
                        onClick={() => navigate(`/loan/${loan.loan_id}`)}
                        className={cn(
                          "px-5 py-4 cursor-pointer transition-all duration-180",
                          (isClosedRow || isDeniedRow) && "opacity-70",
                          config.row
                        )}
                        whileHover={{ translateY: -1 }}
                      >
                        <div className="grid grid-cols-3 items-center">
                          <div className="flex items-center gap-2 pr-2 min-w-0">
                            <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", config.dot)} />
                            <span className="text-xs font-mono font-bold text-on-surface truncate">
                              {loan.reference_no}
                            </span>
                          </div>
                          <div className="flex justify-center">
                            <span className={cn(
                              "text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-tighter",
                              config.badge
                            )}>
                              {loan.status}
                            </span>
                          </div>
                          <span className="text-xs text-on-surface-variant text-right tabular-nums">
                            {new Date(loan.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>

                        {isOverdueRow && (
                          <div className="mt-2 ml-3.5 flex items-center gap-1.5">
                            <span className="text-orange-400/70 text-[10px] font-medium">Balance due:</span>
                            <span className="text-orange-500 text-[11px] font-headline font-bold tabular-nums">
                              ₱{fmt(Number(loan.remaining_balance))}
                            </span>
                          </div>
                        )}
                        {isClosedRow && (
                          <div className="mt-2 ml-3.5 flex items-center gap-1.5">
                            <CheckCircle2 size={10} className="text-outline/50" />
                            <span className="text-on-surface-variant/60 text-[10px] font-medium">Fully settled</span>
                          </div>
                        )}
                        {isDeniedRow && (
                          <div className="mt-2 ml-3.5 flex items-center gap-1.5">
                            <Ban size={10} className="text-red-400/50" />
                            <span className="text-red-400/60 text-[10px] font-medium">Application not approved</span>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                {hasMore && (
                  <div className="relative">
                    <div className="px-5 py-4 opacity-25 pointer-events-none select-none">
                      <div className="grid grid-cols-3 items-center">
                        <div className="h-3 w-24 bg-on-surface/15 rounded-full" />
                        <div className="flex justify-center">
                          <div className="h-5 w-14 bg-on-surface/15 rounded-full" />
                        </div>
                        <div className="flex justify-end">
                          <div className="h-3 w-10 bg-on-surface/15 rounded-full" />
                        </div>
                      </div>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-surface-container-low/70 to-surface-container-low pointer-events-none" />
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                      <button
                        onClick={() => setShowAllLoans(true)}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-full
                          bg-surface-container-highest border border-outline/20
                          text-primary text-[11px] font-bold
                          shadow-[0_2px_8px_rgba(0,0,0,0.05)]
                          transition-all duration-150
                          hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)] hover:scale-[1.02] active:scale-95"
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
              className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto
                bg-surface-container-low rounded-t-[2rem]
                shadow-[0_8px_24px_rgba(0,0,0,0.09),0_4px_8px_rgba(0,0,0,0.05)]
                border-t border-outline/15"
            >
              <div className="p-6">
                <div className="w-10 h-1 bg-outline-variant rounded-full mx-auto mb-6" />
                <div className="flex flex-col items-center text-center mb-6">
                  <div className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center mb-4",
                    blockedLoan.status?.toLowerCase() === 'overdue' ? "bg-orange-500/10" : "bg-primary/10"
                  )}>
                    <AlertTriangle size={28} className={
                      blockedLoan.status?.toLowerCase() === 'overdue' ? "text-orange-500" : "text-primary"
                    } />
                  </div>
                  <h3 className="font-headline font-bold text-xl text-on-surface">Application Not Allowed</h3>
                  <p className="text-on-surface-variant text-sm mt-2 leading-relaxed">
                    You currently have a{' '}
                    <span className="font-bold text-on-surface">
                      {STATUS_LABEL[blockedLoan.status?.toLowerCase()] ?? blockedLoan.status}
                    </span>{' '}
                    that must be settled or resolved before applying for a new loan.
                  </p>
                </div>

                <div className="p-4 bg-surface-container-high rounded-2xl border border-outline/15 space-y-2 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">Reference No.</span>
                    <span className="font-bold font-mono text-on-surface">{blockedLoan.reference_no}</span>
                  </div>
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-on-surface-variant">Status</span>
                    <span className={cn(
                      "text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase border",
                      getStatusConfig(blockedLoan.status).badge
                    )}>
                      {blockedLoan.status}
                    </span>
                  </div>
                  {blockedLoan.remaining_balance > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-on-surface-variant">Remaining Balance</span>
                      <span className={cn(
                        "font-bold tabular-nums",
                        blockedLoan.status?.toLowerCase() === 'overdue' ? "text-orange-500" : "text-on-surface"
                      )}>
                        ₱{Number(blockedLoan.remaining_balance).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => { setBlockedLoan(null); navigate(`/loan/${blockedLoan.loan_id}`); }}
                    className={cn(
                      "w-full py-4 rounded-full font-bold text-sm",
                      "transition-all duration-150 hover:scale-[1.01] active:scale-95",
                      "shadow-[0_2px_8px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)]",
                      blockedLoan.status?.toLowerCase() === 'overdue'
                        ? "bg-orange-500 text-white"
                        : "bg-primary text-on-primary"
                    )}
                  >
                    {blockedLoan.status?.toLowerCase() === 'overdue' ? 'Pay Now (Overdue)' : 'View Existing Loan'}
                  </button>
                  <button
                    onClick={() => setBlockedLoan(null)}
                    className="w-full py-4 rounded-full bg-surface-container-highest border border-outline/20
                      text-on-surface font-bold text-sm
                      transition-all duration-150 hover:scale-[1.01] active:scale-95"
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