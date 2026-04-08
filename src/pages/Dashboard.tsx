import React from 'react';
import { LayoutDashboard, Wallet, ReceiptText, User, ArrowRight, ArrowDownLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { BottomNav } from '../components/BottomNav';
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

export default function Dashboard() {
  const navigate = useNavigate();
  const [applications, setApplications] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showAllApplications, setShowAllApplications] = React.useState(false);
  const [currentAmountReceived, setCurrentAmountReceived] = React.useState(0);

  // Always use localStorage for user
  const [parsedUser, setParsedUser] = React.useState<any>(null);

  React.useEffect(() => {
    let storedUser = localStorage.getItem('user');
    let user = null;
    try {
      user = storedUser ? JSON.parse(storedUser) : null;
    } catch {
      user = null;
    }
    // Always clear loan application data on login/dashboard load
    localStorage.removeItem('loanApplicationData');
    localStorage.removeItem('loanApplicationStep2');
    if (!user || typeof user !== 'object' || !user.username) {
      localStorage.removeItem('user');
      navigate('/login', { replace: true });
    } else {
      setParsedUser(user);
      fetchApplications(user.username);
      fetchCurrentAmountReceived(user.username);
    }
    // eslint-disable-next-line
  }, []);

  // Calculate current amount received for this user
  const fetchCurrentAmountReceived = (username: string) => {
    let txns: Transaction[] = [];
    try {
      txns = JSON.parse(localStorage.getItem('transactions') || '[]');
    } catch {}
    const userTxns = txns.filter((t: any) => t.userId === username && t.type === 'Loan Received');
    const total = userTxns.reduce((sum, t) => sum + Number(t.amount), 0);
    setCurrentAmountReceived(total);
  };



  // Use localStorage for applications (no backend)
  const fetchApplications = (userId: string) => {
    setLoading(true);
    if (!userId) {
      setApplications([]);
      setLoading(false);
      return;
    }
    // Try to get applications from localStorage
    let allApps = [];
    try {
      allApps = JSON.parse(localStorage.getItem('applications') || '[]');
    } catch {}
    // Filter for this user
    const userApps = allApps.filter((app: any) => app.username === userId);
    setApplications(userApps);
    setLoading(false);
  };

  if (!parsedUser || typeof parsedUser !== 'object' || !parsedUser.username) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-4 text-primary font-bold">Loading...</span>
      </div>
    );
  }

  const sortedApplications = [...applications].sort((a, b) => {
    if (a.status === 'Paid' && b.status !== 'Paid') return 1;
    if (a.status !== 'Paid' && b.status === 'Paid') return -1;
    return 0;
  });

  const displayedApplications = showAllApplications ? sortedApplications : sortedApplications.slice(0, 3);

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopBar title="Loan Manager" showBack={false} />
      <main className="mt-20 px-6 max-w-md mx-auto w-full">
        <motion.section 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-4"
        >
          <div className="space-y-1">
            <p className="text-primary font-headline text-sm font-bold tracking-widest uppercase">WELCOME, {parsedUser?.firstName?.toUpperCase()} {parsedUser?.lastName?.toUpperCase()}.</p>
            <p className="text-on-surface-variant text-sm font-headline">Customer No: <span className="text-primary">{parsedUser?.customerNo || 'N/A'}</span></p>
          </div>
        </motion.section>
        {/* Current Amount Section */}
        <motion.section
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-8"
        >
          <div className="flex flex-col items-center mb-2">
            <span className="text-on-surface-variant text-xs font-bold uppercase tracking-widest mb-1">Current Amount</span>
            <span className="font-headline font-extrabold text-5xl text-primary tracking-tight">₱{currentAmountReceived.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </motion.section>

        <motion.section 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className="relative overflow-hidden rounded-2xl bg-surface-container-high p-4 shadow-xl group flex flex-col items-center text-center">
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

        <section>
          <div className="flex justify-between items-center mb-6">
            <h4 className="font-headline text-xl font-bold text-on-surface">My Applications</h4>
            {applications.length > 3 && (
              <button 
                onClick={() => setShowAllApplications(!showAllApplications)}
                className="text-primary text-xs font-bold uppercase tracking-widest"
              >
                {showAllApplications ? 'Show Less' : 'View All'}
              </button>
            )}
          </div>

          <div className="bg-surface-container-low rounded-2xl overflow-hidden border border-outline-variant/10">
            <div className="grid grid-cols-3 px-6 py-4 bg-surface-container-highest/20">
              <span className="text-[10px] font-headline font-bold uppercase tracking-widest text-outline">REFERENCE NO</span>
              <span className="text-[10px] font-headline font-bold uppercase tracking-widest text-outline text-center">STATUS</span>
              <span className="text-[10px] font-headline font-bold uppercase tracking-widest text-outline text-right">SUBMITTED</span>
            </div>

            {loading ? (
              <div className="py-12 flex justify-center">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : applications.length > 0 ? (
              <div className="divide-y divide-outline-variant/10">
                {displayedApplications.map((app) => (
                    <div 
                      key={app.id} 
                      className="px-6 py-5 hover:bg-surface-container-highest/10 transition-colors cursor-pointer"
                      onClick={() => navigate(`/loan/${app.id}`)}
                    >
                      <div className="grid grid-cols-3 items-center mb-3">
                        <span className="text-xs font-mono font-bold text-on-surface truncate pr-2">{app.id}</span>
                        <div className="flex justify-center">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-tighter ${
                            app.status === 'Paid' ? 'bg-green-500/10 text-green-500' :
                            app.status === 'Active' ? 'bg-amber-500/10 text-amber-500' :
                            app.status === 'Pending' ? 'bg-red-500/10 text-red-500' :
                            'bg-outline/10 text-outline'
                          }`}>
                            {app.status}
                          </span>
                        </div>
                        <span className="text-xs text-on-surface-variant text-right">
                          {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      
                      {app.status === 'Active' && (
                        <div className="flex gap-2 mt-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/loan/${app.id}`);
                            }}
                            className="flex-1 py-2 bg-primary/10 text-primary text-[10px] font-bold rounded-lg uppercase tracking-wider border border-primary/20 active:scale-95 transition-all"
                          >
                            Check Loan
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
                  <p className="text-on-surface font-headline font-bold text-lg">No applications yet</p>
                  <p className="text-on-surface-variant text-sm mt-2 leading-relaxed">
                    Your recent loan requests will appear here once you start an application.
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
