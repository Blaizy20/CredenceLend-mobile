import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Loader2, AlertCircle } from 'lucide-react';

const CODE_LENGTH = 6;
const API_BASE    = import.meta.env.VITE_API_URL ?? '';

export default function TenantGate() {
  const navigate = useNavigate();

  const [code, setCode]       = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);
  const inputRefs             = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { inputRefs.current[0]?.focus(); }, []);

  const fullCode = code.join('').toUpperCase();
  const isReady  = fullCode.length === CODE_LENGTH && !code.includes('');

  // ── Input handlers ──────────────────────────────────────────────────────────

  const handleChange = (idx: number, value: string) => {
    const char = value.replace(/[^a-zA-Z0-9]/g, '').slice(-1).toUpperCase();
    setError('');
    const next = [...code];
    next[idx]  = char;
    setCode(next);
    if (char && idx < CODE_LENGTH - 1) inputRefs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (code[idx]) {
        const next = [...code]; next[idx] = ''; setCode(next);
      } else if (idx > 0) {
        inputRefs.current[idx - 1]?.focus();
        const next = [...code]; next[idx - 1] = ''; setCode(next);
      }
    }
    if (e.key === 'Enter' && isReady) handleVerify();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text')
      .replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, CODE_LENGTH);
    if (!pasted) return;
    const next = Array(CODE_LENGTH).fill('');
    pasted.split('').forEach((c, i) => { next[i] = c; });
    setCode(next);
    inputRefs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
  };

  // ── Verify ──────────────────────────────────────────────────────────────────

  const handleVerify = async () => {
    if (!isReady || loading) return;
    setLoading(true);
    setError('');

    try {
      const res  = await fetch(`${API_BASE}/api/tenants/verify-code`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ code: fullCode }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || 'Invalid code. Please check and try again.');
        setCode(Array(CODE_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
        return;
      }

      localStorage.setItem('tenant', JSON.stringify({
        tenant_id:     data.tenant_id,
        tenant_name:   data.tenant_name   ?? '',
        logo_path:     data.logo_path     ?? null,
        primary_color: data.primary_color ?? null,
        code:          fullCode,
      }));

      setSuccess(true);
      setTimeout(() => navigate('/login', { replace: true }), 1200);

    } catch {
      setError('Connection error. Please check your internet and try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-8">

      {/* Icon + Heading */}
      <motion.div
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center mb-10"
      >
        <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
          <ShieldCheck size={40} className="text-primary" />
        </div>
        <h1 className="font-headline font-extrabold text-2xl text-on-surface text-center">
          Enter Access Code
        </h1>
        <p className="text-on-surface-variant text-sm text-center mt-2 max-w-[260px] leading-relaxed">
          Enter the 6-character code provided by your cooperative to get started.
        </p>
      </motion.div>

      {/* Code Boxes */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="flex gap-3 mb-6"
        onPaste={handlePaste}
      >
        {Array(CODE_LENGTH).fill(null).map((_, idx) => (
          <input
            key={idx}
            ref={el => { inputRefs.current[idx] = el; }}
            type="text"
            inputMode="text"
            maxLength={1}
            value={code[idx]}
            onChange={e => handleChange(idx, e.target.value)}
            onKeyDown={e => handleKeyDown(idx, e)}
            disabled={loading || success}
            className={`
              w-12 h-14 rounded-xl text-center text-lg font-bold font-mono uppercase
              bg-surface-container-highest border-2 text-on-surface
              transition-all outline-none caret-transparent
              focus:border-primary focus:bg-surface-container
              disabled:opacity-60
              ${error        ? 'border-error/60 bg-error/5'  :
                code[idx]    ? 'border-primary/50'            :
                               'border-outline/20'}
            `}
          />
        ))}
      </motion.div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-2 mb-5 px-4 py-2.5 bg-error/10 border border-error/20 rounded-xl max-w-[300px]"
          >
            <AlertCircle size={15} className="text-error shrink-0" />
            <p className="text-xs text-error font-medium">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[300px]"
      >
        <button
          onClick={handleVerify}
          disabled={!isReady || loading || success}
          className={`
            w-full py-4 rounded-full font-bold text-sm flex items-center justify-center gap-2
            transition-all active:scale-95
            ${isReady && !loading && !success
              ? 'bg-primary text-on-primary shadow-lg shadow-primary/20'
              : 'bg-surface-container-highest text-on-surface-variant opacity-60'}
          `}
        >
          {loading  ? <><Loader2 size={18} className="animate-spin" /> Verifying…</>
          : success  ? <><ShieldCheck size={18} /> Verified!</>
          :             'Verify Code'}
        </button>
      </motion.div>

    </div>
  );
}