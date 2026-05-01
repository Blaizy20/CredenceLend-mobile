import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCcw } from 'lucide-react';
import { motion } from 'motion/react';

export default function Offline() {
  const [isChecking, setIsChecking] = useState(false);

  const handleRetry = () => {
    setIsChecking(true);
    setTimeout(() => {
      if (window.navigator.onLine) {
        window.location.reload();
      } else {
        setIsChecking(false);
      }
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-8 text-center">
      {/* Background Decor */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 flex flex-col items-center"
      >
        <div className="w-24 h-24 rounded-3xl bg-secondary-container flex items-center justify-center mb-8 shadow-xl shadow-secondary/10">
          <WifiOff className="text-secondary" size={44} />
        </div>

        <h1 className="font-headline font-extrabold text-3xl text-on-surface tracking-tight mb-4">
          No Connection
        </h1>

        <p className="text-on-surface-variant text-base leading-relaxed mb-12 max-w-[280px]">
          Please check your internet settings or mobile data and try again.
        </p>

        <div className="w-full space-y-4">
          <button
            onClick={handleRetry}
            disabled={isChecking}
            className="w-full h-14 bg-primary text-on-primary rounded-full font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-3 active:scale-95 transition-all"
          >
            <RefreshCcw size={20} className={isChecking ? 'animate-spin' : ''} />
            {isChecking ? 'Checking Connection...' : 'Retry Connection'}
          </button>


        </div>
      </motion.div>
    </div>
  );
}
