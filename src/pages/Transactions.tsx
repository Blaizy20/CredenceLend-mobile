import React, { useEffect, useState, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface PaymentRecord {
  payment_id: number;
  loan_id: number;
  reference_no: string;
  amount: number;
  method: string;
  or_no: string | null;
  notes: string | null;
  created_at: string;
}

// ── Method display config ─────────────────────────────────────────────────────
const METHOD_CONFIG: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  GCASH:       { label: "GCash",        emoji: "💙", color: "#0070ba", bg: "#e8f4ff" },
  MAYA:        { label: "Maya",         emoji: "💚", color: "#00a651", bg: "#e6f7ed" },
  CARD:        { label: "Card",         emoji: "💳", color: "#5b4fcf", bg: "#f0eeff" },
  QRPH:        { label: "QR Ph",        emoji: "📱", color: "#c0392b", bg: "#fdecea" },
  GRAB_PAY:    { label: "GrabPay",      emoji: "🟢", color: "#00b14f", bg: "#e6f8ee" },
  BPI:         { label: "BPI",          emoji: "🏦", color: "#c0392b", bg: "#fdecea" },
  UNIONBANK:   { label: "UnionBank",    emoji: "🏛️", color: "#003087", bg: "#e6ecf8" },
  BRANKAS_BDO: { label: "BDO Online",   emoji: "🏦", color: "#0056a2", bg: "#e6eef8" },
  CASH:        { label: "Cash",         emoji: "💵", color: "#27ae60", bg: "#eafaf1" },
  CHEQUE:      { label: "Cheque",       emoji: "📝", color: "#7f8c8d", bg: "#f4f4f4" },
  BANK:        { label: "Bank Transfer",emoji: "🏦", color: "#2c3e50", bg: "#ecf0f1" },
  OTHER:       { label: "Online",       emoji: "💸", color: "#7f8c8d", bg: "#f4f4f4" },
};

function getMethodCfg(method: string) {
  return METHOD_CONFIG[(method ?? "").toUpperCase()] ?? METHOD_CONFIG.OTHER;
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}
function fmtTime(s: string) {
  return new Date(s).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", hour12: true });
}
function friendlyLabel(dateKey: string) {
  const now  = new Date();
  const d    = new Date(dateKey);
  const diff = Math.floor((now.setHours(0,0,0,0) - d.setHours(0,0,0,0)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return dateKey;
}
function groupByDate(list: PaymentRecord[]) {
  const g: Record<string, PaymentRecord[]> = {};
  for (const p of list) {
    const k = fmtDate(p.created_at);
    if (!g[k]) g[k] = [];
    g[k].push(p);
  }
  return g;
}

// ── Get customer from storage ─────────────────────────────────────────────────
function getCustomerId(): number | null {
  try {
    const raw =
      localStorage.getItem("customer") ??
      sessionStorage.getItem("customer") ??
      localStorage.getItem("user") ??
      sessionStorage.getItem("user") ?? "{}";
    return JSON.parse(raw)?.customer_id ?? null;
  } catch { return null; }
}

// ── Shimmer skeleton ──────────────────────────────────────────────────────────
const SkeletonRow: React.FC = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
    <div className="tx-shimmer" style={{ width: 44, height: 44, borderRadius: "50%", background: "#e8e8e8", flexShrink: 0 }} />
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
      <div className="tx-shimmer" style={{ height: 13, width: "52%", borderRadius: 6, background: "#e8e8e8" }} />
      <div className="tx-shimmer" style={{ height: 11, width: "34%", borderRadius: 6, background: "#efefef" }} />
    </div>
    <div className="tx-shimmer" style={{ height: 15, width: 70, borderRadius: 6, background: "#e8e8e8" }} />
  </div>
);

// ── Empty state ───────────────────────────────────────────────────────────────
const EmptyState: React.FC = () => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "72px 32px", gap: 10, textAlign: "center" }}>
    <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, marginBottom: 4 }}>
      🧾
    </div>
    <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: "#1a1a1a" }}>No payments yet</p>
    <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9e9e9e", maxWidth: 240, lineHeight: 1.55 }}>
      Once you make a payment on any loan, your history will appear here.
    </p>
  </div>
);

// ── Summary cards ─────────────────────────────────────────────────────────────
const SummaryBar: React.FC<{ payments: PaymentRecord[] }> = ({ payments }) => {
  const total      = payments.reduce((s, p) => s + Number(p.amount), 0);
  const now        = new Date();
  const monthTotal = payments
    .filter(p => { const d = new Date(p.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })
    .reduce((s, p) => s + Number(p.amount), 0);

  const cards = [
    { label: "Total Paid",    value: `₱${total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,      color: "#1976d2" },
    { label: "This Month",   value: `₱${monthTotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`, color: "#27ae60" },
    { label: "Transactions", value: String(payments.length),                                                  color: "#7c3aed" },
  ];

  return (
    <div style={{ display: "flex", gap: 10, padding: "14px 16px 6px", overflowX: "auto", WebkitOverflowScrolling: "touch" as any }}>
      {cards.map(({ label, value, color }) => (
        <div key={label} style={{ flex: "0 0 auto", minWidth: 112, background: "#fff", borderRadius: 14, padding: "12px 14px", boxShadow: "0 1px 5px rgba(0,0,0,0.07)", border: "1px solid #f0f0f0" }}>
          <p style={{ margin: 0, fontSize: 10, color: "#aaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
          <p style={{ margin: "5px 0 0", fontSize: 15, fontWeight: 800, color, fontVariantNumeric: "tabular-nums" }}>{value}</p>
        </div>
      ))}
    </div>
  );
};

// ── Single payment row ────────────────────────────────────────────────────────
const PaymentRow: React.FC<{ payment: PaymentRecord }> = ({ payment }) => {
  const cfg = getMethodCfg(payment.method);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderBottom: "1px solid #f5f5f5" }}>
      {/* Bubble */}
      <div style={{ width: 44, height: 44, borderRadius: "50%", background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
        {cfg.emoji}
      </div>
      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "#1a1a1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {cfg.label} Payment
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9e9e9e" }}>
          {payment.reference_no}
          {payment.or_no ? ` · ${payment.or_no}` : ""}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 11, color: "#bdbdbd" }}>{fmtTime(payment.created_at)}</p>
      </div>
      {/* Amount + badge */}
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#27ae60", fontVariantNumeric: "tabular-nums" }}>
          −₱{Number(payment.amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
        </p>
        <span style={{ display: "inline-block", marginTop: 3, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: cfg.bg, color: cfg.color, letterSpacing: "0.02em" }}>
          {cfg.label}
        </span>
      </div>
    </div>
  );
};

// ── Main ─────────────────────────────────────────────────────────────────────
const Transactions: React.FC = () => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const cid = getCustomerId();
    if (!cid) { setLoading(false); setError("Not logged in."); return; }
    try {
      const res  = await fetch(`/api/payments/customer/${cid}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed to load.");
      setPayments(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const grouped = groupByDate(payments);

  return (
    <div style={{ minHeight: "100dvh", background: "#f7f7f7", display: "flex", flexDirection: "column" }}>
      {/* Inject keyframes */}
      <style>{`
        @keyframes tx-shimmer { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .tx-shimmer { animation: tx-shimmer 1.4s ease-in-out infinite; }
      `}</style>

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", padding: "16px 16px 14px", position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, color: "#aaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Activity Log</p>
          <h1 style={{ margin: "2px 0 0", fontSize: 18, fontWeight: 800, color: "#1a1a1a" }}>Payment History</h1>
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{ padding: "8px 16px", background: loading ? "#e0e0e0" : "#1976d2", color: loading ? "#aaa" : "#fff", border: "none", borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: loading ? "default" : "pointer", transition: "background 0.2s" }}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* Summary */}
      {!loading && payments.length > 0 && <SummaryBar payments={payments} />}

      {/* Skeleton */}
      {loading && (
        <div style={{ margin: "12px 16px", background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
          {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div style={{ margin: "24px 16px", padding: 20, background: "#fff3f3", borderRadius: 14, textAlign: "center" }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#c0392b" }}>Could not load payments</p>
          <p style={{ margin: "4px 0 12px", fontSize: 13, color: "#e57373" }}>{error}</p>
          <button onClick={load} style={{ padding: "8px 20px", background: "#c0392b", color: "#fff", border: "none", borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Try Again
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && payments.length === 0 && <EmptyState />}

      {/* Grouped list */}
      {!loading && !error && payments.length > 0 && (
        <div style={{ padding: "8px 16px 32px", display: "flex", flexDirection: "column", gap: 10 }}>
          {Object.entries(grouped).map(([dateKey, items]) => (
            <div key={dateKey} style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 5px rgba(0,0,0,0.05)" }}>
              {/* Date label */}
              <div style={{ padding: "9px 16px 7px", background: "#fafafa", borderBottom: "1px solid #f0f0f0", fontSize: 11, fontWeight: 700, color: "#9e9e9e", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {friendlyLabel(dateKey)}
              </div>
              {items.map(p => <PaymentRow key={p.payment_id} payment={p} />)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Transactions;
