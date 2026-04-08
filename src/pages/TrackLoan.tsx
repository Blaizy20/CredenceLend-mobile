import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronRight, BarChart3 } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { motion } from 'motion/react';

export default function TrackLoan() {
  const navigate = useNavigate();
  const [refNo, setRefNo] = useState('');

  const handleSearch = () => {
    if (refNo.trim()) {
      navigate(`/loan/${refNo.trim()}`);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopBar title="Track Loan" rightElement={<button className="p-2 text-primary"><Search size={24} /></button>} />
      
      <main className="flex-grow flex flex-col items-center justify-center px-6 pt-16 py-16">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md space-y-12"
        >
          {/* Abstract Brand Element */}
          <div className="relative w-full flex justify-center">
            <div className="absolute -top-12 w-64 h-64 bg-primary/10 rounded-full blur-[100px]"></div>
            <div className="relative z-10 p-6 bg-surface-container-highest rounded-3xl shadow-2xl border border-white/5">
              <BarChart3 className="text-primary" size={64} strokeWidth={1.5} />
            </div>
          </div>

          {/* Headline Section */}
          <div className="text-center space-y-2">
            <h2 className="font-headline font-extrabold text-4xl tracking-tight text-on-surface">Track Application</h2>
            <p className="font-body text-on-surface-variant text-sm">Monitor your loan progress in real-time</p>
          </div>

          {/* Search Section */}
          <div className="space-y-6">
            <Input 
              label="Reference Number" 
              placeholder="Enter Reference Number (e.g. APP-20260401-0001)" 
              className="h-16 text-base"
              value={refNo}
              onChange={(e) => setRefNo(e.target.value)}
            />

            <div className="flex flex-col gap-4">
              <Button onClick={handleSearch}>
                SEARCH <ChevronRight size={20} />
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
