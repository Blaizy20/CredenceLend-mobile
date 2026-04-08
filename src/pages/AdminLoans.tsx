import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Check, X, Loader2, User, DollarSign, Percent, Clock } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { BottomNav } from '../components/BottomNav';
import { motion } from 'motion/react';

export default function AdminLoans() {
  const navigate = useNavigate();
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.username !== 'admin') {
      // navigate('/dashboard');
    }
    fetchLoans();
  }, []);

  const fetchLoans = () => {
    try {
      let data = JSON.parse(localStorage.getItem('applications') || '[]');
      // Sort: Pending first, then others
      data = data.sort((a, b) => {
        if (a.status === 'Pending' && b.status !== 'Pending') return -1;
        if (a.status !== 'Pending' && b.status === 'Pending') return 1;
        return 0;
      });
      setLoans(data);
    } catch (error) {
      setLoans([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = (loanId: string, status: string) => {
    setLoans(prev => {
      const updated = prev.map(l => {
        if (l.id === loanId) {
          // Add transaction if accepted
          if (status === 'Active') {
            let transactions = [];
            try {
              transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
            } catch {}
            transactions.push({
              id: 'TXN-' + Date.now(),
              userId: l.username,
              loanId: l.id,
              type: 'Loan Received',
              amount: l.amount,
              date: new Date().toISOString(),
              status: 'Completed',
            });
            localStorage.setItem('transactions', JSON.stringify(transactions));
          }
          return { ...l, status };
        }
        return l;
      });
      localStorage.setItem('applications', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopBar title="Loan Management" showBack={false} />
      
      <main className="mt-20 px-6 max-w-lg mx-auto w-full">
        <motion.section 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <ShieldCheck className="text-primary" size={24} />
            <h2 className="font-headline text-xl font-bold text-on-surface">Pending Approvals</h2>
          </div>
          <p className="text-on-surface-variant text-sm">Review and manage loan applications from all users.</p>
        </motion.section>

        {loading ? (
          <div className="py-24 flex justify-center">
            <Loader2 className="text-primary animate-spin" size={48} />
          </div>
        ) : (
          <div className="space-y-4">
            {loans.length > 0 ? (
              loans.map((loan) => (
                <motion.div 
                  key={loan.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 shadow-lg"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-[10px] font-bold text-primary uppercase tracking-widest">REF: {loan.id}</span>
                      <h3 className="font-headline font-bold text-lg mt-1">P {Number(loan.amount).toLocaleString()}</h3>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${
                      loan.status === 'Active' ? 'bg-green-500/10 text-green-500' :
                      loan.status === 'Pending' ? 'bg-amber-500/10 text-amber-500' :
                      'bg-red-500/10 text-red-500'
                    }`}>
                      {loan.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="flex items-center gap-2 text-on-surface-variant">
                      <User size={14} />
                      <span className="text-xs truncate">User: {loan.userId}</span>
                    </div>
                    <div className="flex items-center gap-2 text-on-surface-variant">
                      <DollarSign size={14} />
                      <span className="text-xs">{loan.term}</span>
                    </div>
                    <div className="flex items-center gap-2 text-on-surface-variant">
                      <Percent size={14} />
                      <span className="text-xs">{loan.interest}% Int.</span>
                    </div>
                    <div className="flex items-center gap-2 text-on-surface-variant">
                      <Clock size={14} />
                      <span className="text-xs">{loan.installments} Inst.</span>
                    </div>
                  </div>

                  {loan.coMaker && (
                    <div className="mb-6 p-3 bg-surface-container rounded-xl border border-outline-variant/5">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">Co-maker</p>
                      <p className="text-xs font-semibold">{loan.coMaker.firstName} {loan.coMaker.lastName}</p>
                      <p className="text-[10px] text-on-surface-variant">{loan.coMaker.contactNo}</p>
                    </div>
                  )}

                  {loan.status === 'Pending' && (
                    <div className="flex gap-3">
                      <button 
                        onClick={() => handleStatusUpdate(loan.id, 'Active')}
                        className="flex-1 bg-primary text-on-primary py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all"
                      >
                        <Check size={16} /> ACCEPT
                      </button>
                      <button 
                        onClick={() => handleStatusUpdate(loan.id, 'Rejected')}
                        className="flex-1 bg-surface-container-highest text-on-surface py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all"
                      >
                        <X size={16} /> REJECT
                      </button>
                    </div>
                  )}
                </motion.div>
              ))
            ) : (
              <div className="py-24 text-center">
                <p className="text-on-surface-variant">No loan applications found.</p>
              </div>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
