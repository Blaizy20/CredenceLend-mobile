import React, { useEffect, useState, useCallback } from "react";
import {
  IonPage, IonContent, IonHeader, IonToolbar, IonTitle,
  IonRefresher, IonRefresherContent, IonSpinner, IonRippleEffect,
} from "@ionic/react";

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
const METHOD_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  GCASH:       { label: "GCash",       icon: "💙", color: "#0070ba", bg: "#e8f4ff" },
  MAYA:        { label: "Maya",        icon: "💚", color: "#00a651", bg: "#e6f7ed" },
  CARD:        { label: "Card",        icon: "💳", color: "#5b4fcf", bg: "#f0eeff" },
  QRPH:        { label: "QR Ph",       icon: "📱", color: "#c0392b", bg: "#fdecea" },
  GRAB_PAY:    { label: "GrabPay",     icon: "🟢", color: "#00b14f", bg: "#e6f8ee" },
  BPI:         { label: "BPI",         icon: "🏦", color: "#c0392b", bg: "#fdecea" },
  UNIONBANK:   { label: "UnionBank",   icon: "🏛️", color: "#003087", bg: "#e6ecf8" },
  BRANKAS_BDO: { label: "BDO",         icon: "🏦", color: "#0056a2", bg: "#e6eef8" },
  CASH:        { label: "Cash",        icon: "💵", color: "#27ae60", bg: "#eafaf1" },
  CHEQUE:      { label: "Cheque",      icon: "📝", color: "#7f8c8d", bg: "#f4f4f4" },
  BANK:        { label: "Bank Transfer",icon: "🏦", color: "#2c3e50", bg: "#ecf0f1" },
  OTHER:       { label: "Other",       icon: "💸", color: "#7f8c8d", bg: "#f4f4f4" },
};

function getMethodConfig(method: string) {
  return METHOD_CONFIG[method?.toUpperCase()] ?? METHOD_CONFIG.OTHER;
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function groupByDate(payments: PaymentRecord[]) {
  const groups: Record<string, PaymentRecord[]> = {};
  for (const p of payments) {
    const key = formatDate(p.created_at);
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }
  return groups;
}

function isToday(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function isYesterday(dateStr: string) {
  const d = new Date(dateStr);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth() && d.getFullYear() === yesterday.getFullYear();
}

function friendlyDateLabel(dateStr: string) {
  if (isToday(dateStr)) return "Today";
  if (isYesterday(dateStr)) return "Yesterday";
  return dateStr;
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
      <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#e8e8e8", flexShrink: 0, animation: "shimmer 1.4s ease-in-out infinite" }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ height: 13, width: "55%", borderRadius: 6, background: "#e8e8e8", animation: "shimmer 1.4s ease-in-out infinite" }} />
        <div style={{ height: 11, width: "35%", borderRadius: 6, background: "#efefef", animation: "shimmer 1.4s ease-in-out infinite 0.1s" }} />
      </div>
      <div style={{ height: 16, width: 72, borderRadius: 6, background: "#e8e8e8", animation: "shimmer 1.4s ease-in-out infinite 0.2s" }} />
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 32px", gap: 12, textAlign: "center" }}>
      <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, marginBottom: 4 }}>
        🧾
      </div>
      <p style={{ margin: 0, fontWeight: 600, fontSize: 16, color: "#1a1a1a" }}>No payments yet</p>
      <p style={{ margin: 0, fontSize: 13, color: "#9e9e9e", maxWidth: 240, lineHeight: 1.5 }}>
        Once you make a payment on any of your loans, it will appear here.
      </p>
    </div>
  );
}

// ── Summary bar ───────────────────────────────────────────────────────────────
function SummaryBar({ payments }: { payments: PaymentRecord[] }) {
  const total = payments.reduce((s, p) => s + Number(p.amount), 0);
  const count = payments.length;
  const thisMonth = payments.filter(p => {
    const d = new Date(p.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthTotal = thisMonth.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div style={{ display: "flex", gap: 10, padding: "12px 16px 4px", overflowX: "auto" }}>
      {[
        { label: "Total Paid",    value: `₱${total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`, accent: "#1976d2" },
        { label: "This Month",   value: `₱${monthTotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`, accent: "#27ae60" },
        { label: "Transactions", value: String(count), accent: "#7c3aed" },
      ].map(({ label, value, accent }) => (
        <div key={label} style={{ flex: "0 0 auto", minWidth: 110, background: "#fff", borderRadius: 14, padding: "12px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)", border: "1px solid #f0f0f0" }}>
          <p style={{ margin: 0, fontSize: 11, color: "#9e9e9e", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</p>
          <p style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 700, color: accent, fontVariantNumeric: "tabular-nums" }}>{value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Payment card ──────────────────────────────────────────────────────────────
function PaymentCard({ payment }: { payment: PaymentRecord }) {
  const cfg = getMethodConfig(payment.method);
  return (
    <div
      className="ion-activatable ripple-parent"
      style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", background: "#fff", borderBottom: "1px solid #f5f5f5", overflow: "hidden", cursor: "default" }}
    >
      <IonRippleEffect />
      {/* Method icon bubble */}
      <div style={{ width: 44, height: 44, borderRadius: "50%", background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
        {cfg.icon}
      </div>

      {/* Middle info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "#1a1a1a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {cfg.label} Payment
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9e9e9e" }}>
          {payment.reference_no}
          {payment.or_no ? ` · ${payment.or_no}` : ""}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 11, color: "#bdbdbd" }}>
          {formatTime(payment.created_at)}
        </p>
      </div>

      {/* Amount */}
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#27ae60", fontVariantNumeric: "tabular-nums" }}>
          −₱{Number(payment.amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
        </p>
        <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 20, background: cfg.bg, color: cfg.color }}>
          {cfg.label}
        </span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
const Transactions: React.FC = () => {
  const [payments, setPayments]   = useState<PaymentRecord[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const getCustomerId = () => {
    try {
      const raw = localStorage.getItem("customer") ?? sessionStorage.getItem("customer") ?? "{}";
      return JSON.parse(raw)?.customer_id ?? null;
    } catch { return null; }
  };

  const fetchPayments = useCallback(async () => {
    const customerId = getCustomerId();
    if (!customerId) { setLoading(false); setError("Not logged in."); return; }
    try {
      const res  = await fetch(`/api/payments/customer/${customerId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load payments.");
      setPayments(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const handleRefresh = async (e: CustomEvent) => {
    await fetchPayments();
    (e.target as HTMLIonRefresherElement).complete();
  };

  const grouped = groupByDate(payments);

  return (
    <IonPage>
      <style>{`
        @keyframes shimmer {
          0%   { opacity: 1; }
          50%  { opacity: 0.45; }
          100% { opacity: 1; }
        }
        .tx-date-label {
          font-size: 11px;
          font-weight: 700;
          color: #9e9e9e;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding: 10px 16px 4px;
          background: #fafafa;
          border-bottom: 1px solid #f0f0f0;
        }
      `}</style>

      <IonHeader>
        <IonToolbar>
          <IonTitle>Payment History</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen style={{ "--background": "#f7f7f7" } as React.CSSProperties}>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {/* Summary cards */}
        {!loading && payments.length > 0 && <SummaryBar payments={payments} />}

        {/* States */}
        {loading && (
          <div style={{ background: "#fff", margin: "12px 16px", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            {[...Array(6)].map((_, i) => <SkeletonRow key={i} />)}
          </div>
        )}

        {!loading && error && (
          <div style={{ margin: "24px 16px", padding: "20px", background: "#fff3f3", borderRadius: 14, textAlign: "center" }}>
            <p style={{ margin: 0, color: "#c0392b", fontWeight: 600, fontSize: 14 }}>Failed to load</p>
            <p style={{ margin: "4px 0 0", color: "#e57373", fontSize: 13 }}>{error}</p>
            <button
              onClick={fetchPayments}
              style={{ marginTop: 12, padding: "8px 20px", background: "#c0392b", color: "#fff", border: "none", borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && payments.length === 0 && <EmptyState />}

        {/* Grouped payment list */}
        {!loading && !error && payments.length > 0 && (
          <div style={{ margin: "12px 0 24px", display: "flex", flexDirection: "column", gap: 8 }}>
            {Object.entries(grouped).map(([date, items]) => (
              <div key={date} style={{ background: "#fff", borderRadius: 16, overflow: "hidden", margin: "0 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                <div className="tx-date-label">{friendlyDateLabel(date)}</div>
                {items.map(p => <PaymentCard key={p.payment_id} payment={p} />)}
              </div>
            ))}
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default Transactions;
