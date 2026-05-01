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

  const fetchLoans = async () => {
    setLoading(true);
    try {
      // Try to fetch from API first if possible, or just use mocks for now
      // Since it's an admin view, we'd normally fetch all loans
      // For this demo/test environment, let's use the same 'mock_loans'
      const data = JSON.parse(localStorage.getItem('mock_loans') || '[]');

      // Sort: Pending first, then newest
      const sorted = data.sort((a: any, b: any) => {
        if (a.status === 'Pending' && b.status !== 'Pending') return -1;
        if (a.status !== 'Pending' && b.status === 'Pending') return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setLoans(sorted);
    } catch (error) {
      setLoans([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = (loanId: number, status: string) => {
    const allLoans = JSON.parse(localStorage.getItem('mock_loans') || '[]');
    const updated = allLoans.map((l: any) => {
      if (l.loan_id === loanId) {
        // Only update status, do not auto-approve or auto-pay
        if (status === 'Active' || status === 'Approved') {
          // Only add transaction and notification if admin explicitly approves
          const transactions = JSON.parse(localStorage.getItem('mock_transactions') || '[]');
          transactions.push({
            transaction_id: Date.now(),
            customer_id: l.customer_id,
            type: 'Loan Disbursement',
            amount: l.principal_amount || l.amount,
            status: 'Completed',
            reference_no: l.reference_no,
            date: new Date().toISOString()
          });
          localStorage.setItem('mock_transactions', JSON.stringify(transactions));

          // Add notification
          const notifications = JSON.parse(localStorage.getItem('mock_notifications') || '[]');
          notifications.unshift({
            notification_id: Date.now(),
            customer_id: l.customer_id,
            title: 'Loan Approved!',
            message: `Your loan application ${l.reference_no} has been approved.`,
            type: 'success',
            is_read: false,
            created_at: new Date().toISOString()
          });
          localStorage.setItem('mock_notifications', JSON.stringify(notifications));
          // Set status to 'Active' only, not 'Paid'
          return { ...l, status: 'Active' };
        }
        // If not approved, just update status
        return { ...l, status };
      }
      return l;
    });

    localStorage.setItem('mock_loans', JSON.stringify(updated));
    setLoans(updated);
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
                  key={loan.loan_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 shadow-lg"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-[10px] font-bold text-primary uppercase tracking-widest">REF: {loan.reference_no}</span>
                      <h3 className="font-headline font-bold text-lg mt-1">₱ {Number(loan.principal_amount || loan.amount).toLocaleString()}</h3>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${
                      loan.status?.toLowerCase() === 'active' ? 'bg-green-500/10 text-green-500' :
                      loan.status?.toLowerCase() === 'pending' ? 'bg-amber-500/10 text-amber-500' :
                      'bg-red-500/10 text-red-500'
                    }`}>
                      {loan.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="flex items-center gap-2 text-on-surface-variant">
                      <User size={14} />
                      <span className="text-xs truncate">Cust ID: {loan.customer_id}</span>
                    </div>
                    <div className="flex items-center gap-2 text-on-surface-variant">
                      <DollarSign size={14} />
                      <span className="text-xs">{loan.payment_term || loan.term}</span>
                    </div>
                    <div className="flex items-center gap-2 text-on-surface-variant">
                      <Percent size={14} />
                      <span className="text-xs">{loan.interest_rate || loan.interest}% Int.</span>
                    </div>
                    <div className="flex items-center gap-2 text-on-surface-variant">
                      <Clock size={14} />
                      <span className="text-xs">{loan.term_months || loan.installments} Months</span>
                    </div>
                  </div>

                  {loan.co_maker && (
                    <div className="mb-6 p-3 bg-surface-container rounded-xl border border-outline-variant/5">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">Co-maker</p>
                      <p className="text-xs font-semibold">{loan.co_maker.first_name} {loan.co_maker.last_name}</p>
                      <p className="text-[10px] text-on-surface-variant">{loan.co_maker.contact_no}</p>
                    </div>
                  )}

                  {loan.status?.toLowerCase() === 'pending' && (
                    <div className="flex gap-3">
                      <button 
                        onClick={() => handleStatusUpdate(loan.loan_id, 'Active')}
                        className="flex-1 bg-primary text-on-primary py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all"
                      >
                        <Check size={16} /> ACCEPT
                      </button>
                      <button 
                        onClick={() => handleStatusUpdate(loan.loan_id, 'Denied')}
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
