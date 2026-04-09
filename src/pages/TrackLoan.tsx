import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronRight, BarChart3, AlertCircle, Loader2 } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { motion } from 'motion/react';
import { loansAPI } from '../lib/api';

export default function TrackLoan() {
  const navigate = useNavigate();
  const [refNo, setRefNo]       = useState('');
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const handleSearch = async () => {
    const ref = refNo.trim().toUpperCase();
    if (!ref) return;

    let user: any = null;
    try { user = JSON.parse(localStorage.getItem('user') || 'null'); } catch {}
    if (!user?.customer_id) {
      navigate('/login', { replace: true });
      return;
    }

    setSearching(true);
    setNotFound(false);

    try {
      // Fetch all loans for this customer and find by reference_no
      const loans = await loansAPI.getLoans(user.customer_id);
      const match = Array.isArray(loans)
        ? loans.find((l: any) => String(l.reference_no).toUpperCase() === ref)
        : null;

      if (match) {
        navigate(`/loan/${match.loan_id}`);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopBar title="Track Loan" rightElement={
        <button className="p-2 text-primary"><Search size={24} /></button>
      } />

      <main className="flex-grow flex flex-col items-center justify-center px-6 pt-16 py-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md space-y-12"
        >
          {/* Icon */}
          <div className="relative w-full flex justify-center">
            <div className="absolute -top-12 w-64 h-64 bg-primary/10 rounded-full blur-[100px]" />
            <div className="relative z-10 p-6 bg-surface-container-highest rounded-3xl shadow-2xl border border-white/5">
              <BarChart3 className="text-primary" size={64} strokeWidth={1.5} />
            </div>
          </div>

          {/* Headline */}
          <div className="text-center space-y-2">
            <h2 className="font-headline font-extrabold text-4xl tracking-tight text-on-surface">
              Track Application
            </h2>
            <p className="font-body text-on-surface-variant text-sm">
              Monitor your loan progress in real-time
            </p>
          </div>

          {/* Search */}
          <div className="space-y-6">
            <Input
              label="Reference Number"
              placeholder="e.g. LOAN-2026-0001"
              className="h-16 text-base"
              value={refNo}
              onChange={(e) => { setRefNo(e.target.value); setNotFound(false); }}
              onKeyDown={handleKeyDown}
            />

            {notFound && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl"
              >
                <AlertCircle size={16} className="text-red-500 shrink-0" />
                <p className="text-red-500 text-sm font-medium">
                  No loan found with that reference number.
                </p>
              </motion.div>
            )}

            <div className="flex flex-col gap-4">
              <Button onClick={handleSearch} disabled={searching || !refNo.trim()}>
                {searching
                  ? <><Loader2 size={18} className="animate-spin" /> Searching...</>
                  : <> SEARCH <ChevronRight size={20} /></>
                }
              </Button>
              <Button variant="outline" onClick={() => navigate(-1)}>
                Back
              </Button>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}