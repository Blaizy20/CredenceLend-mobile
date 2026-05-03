import { Capacitor } from '@capacitor/core';

const RAILWAY_URL = 'https://credencelend-mobile.up.railway.app';

// Web (browser/Railway) → relative URLs (same origin)
// Android/iOS native   → absolute Railway URL (no origin on device)
const BASE = Capacitor.isNativePlatform()
  ? RAILWAY_URL
  : (import.meta.env.VITE_API_URL ?? '');

// Export for direct-fetch files (Inbox.tsx, Transactions.tsx, etc.)
export { BASE as API_BASE };

// ── Auth header helper ────────────────────────────────────────────────────────
// Reads the Bearer token from localStorage and returns the headers object.
// Falls back gracefully when no token is stored (public endpoints).
function getAuthHeaders(): Record<string, string> {
  let token = '';
  try { token = localStorage.getItem('token') ?? ''; } catch { /* ignore */ }
  return token
    ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };
}

// ── Comaker shape (matches API contract exactly) ──────────────────────────────
export interface ComakerPayload {
  full_name:    string;
  phone_number: string;
  relationship: string;
  email?:       string;
  address?:     string;
  notes?:       string;
}

// ── Loan apply request body (API contract v1.1-ci-optional) ───────────────────
export interface LoanApplyPayload {
  // Required
  principal_amount: number;
  payment_term:     'daily' | 'weekly' | 'semi_monthly' | 'monthly';
  term_months:      number;
  interest_rate:    number;
  // Optional — borrower profile
  birthday?:        string;         // YYYY-MM-DD
  occupation?:      string;
  monthly_income?:  number;
  notes?:           string;
  // Optional — payout & release
  release_channel?: 'ONLINE' | 'WALK_IN';
  payout_method?:   string;         // 'GCASH' | 'BANK' | 'CASH'
  // Optional — collateral
  collateral_type?:  string;
  collateral_notes?: string;
  // Optional — co-makers
  comakers?: ComakerPayload[];
}

// ── Loan apply response (API contract success envelope) ───────────────────────
export interface LoanApplyResponse {
  success:   boolean;
  message:   string;
  timestamp?: string;
  version?:   string;
  error_code?: string;
  data?: {
    loan_id:              number;
    reference_no:         string;
    status:               'PENDING' | 'DENIED' | 'ACTIVE';
    next_queue:           string;
    ci_required:          boolean;
    requires_collateral:  boolean;
    missing_requirements: string[];
    instant_mode:         string;
    instant_reason:       string;
    message:              string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
export const authAPI = {
  login: async (username: string, password: string) => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Invalid username or password.');
    return data;
  },

  register: async (data: Record<string, string>) => {
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  getProfile: async (customerId: number) => {
    const res = await fetch(`${BASE}/api/profile/${customerId}`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  checkUsername: (username: string) =>
    fetch(`${BASE}/api/auth/check-username?username=${encodeURIComponent(username)}`).then(r => r.json()),

  checkEmail: (email: string) =>
    fetch(`${BASE}/api/auth/check-email?email=${encodeURIComponent(email)}`).then(r => r.json()),

  checkContact: (contactNo: string) =>
    fetch(`${BASE}/api/auth/check-contact?contactNo=${encodeURIComponent(contactNo)}`).then(r => r.json()),

  sendOtp: async (email: string) => {
    const res = await fetch(`${BASE}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return res.json();
  },

  verifyOtp: async (email: string, otp: string) => {
    const res = await fetch(`${BASE}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    });
    return res.json();
  },

  resetPassword: async (email: string, newPassword: string) => {
    const res = await fetch(`${BASE}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, newPassword }),
    });
    let result: any = {};
    try { result = await res.json(); } catch {
      throw new Error(`Server error (${res.status}). Please try again.`);
    }
    return result;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
export const loansAPI = {
  getLoans: async (customerId: number) => {
    const res = await fetch(`${BASE}/api/loans/${customerId}`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  getLoan: async (loanId: number) => {
    const res = await fetch(`${BASE}/api/loan/${loanId}`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  getPayments: async (loanId: number) => {
    const res = await fetch(`${BASE}/api/payments/${loanId}`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  getTransactions: async (customerId: number) => {
    const res = await fetch(`${BASE}/api/transactions/${customerId}`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  // ── Apply for a loan ───────────────────────────────────────────────────────
  // Endpoint: POST /api/v1/loans.php?action=apply
  // Auth:     Authorization: Bearer <token>  (resolved from localStorage)
  // Backend resolves customer & tenant from the token — do NOT send customer_id/tenant_id.
  applyLoan: async (payload: LoanApplyPayload): Promise<LoanApplyResponse> => {
    let res: Response;
    try {
      res = await fetch(`${BASE}/api/v1/loans.php?action=apply`, {
        method:  'POST',
        headers: getAuthHeaders(),
        body:    JSON.stringify(payload),
      });
    } catch {
      // Network-level failure (no connectivity, DNS, etc.)
      throw new Error('Unable to reach the server. Please check your connection.');
    }

    let result: LoanApplyResponse = { success: false, message: '' };
    try {
      result = await res.json();
    } catch {
      throw new Error(`Server error (${res.status}). Please try again.`);
    }

    // Bubble up error_code so callers can handle specific cases
    // (UNPAID_LOANS_EXIST, INVALID_AMOUNT, AUTH_INVALID, etc.)
    return result;
  },

  // ── Upload a requirement document for a loan ───────────────────────────────
  // Used by the post-submit requirements checklist in ApplyLoanStep2.
  // Backend supports multiple files per requirement code (slot-based storage).
  uploadDocument: async (loanId: number, requirementCode: string, file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('loan_id',          String(loanId));
    formData.append('requirement_code', requirementCode);
    formData.append('file',             file);

    let token = '';
    try { token = localStorage.getItem('token') ?? ''; } catch { /* ignore */ }

    let res: Response;
    try {
      res = await fetch(`${BASE}/api/v1/loans.php?action=upload_document`, {
        method:  'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        // Do NOT set Content-Type — browser sets it automatically with boundary for FormData
        body: formData,
      });
    } catch {
      throw new Error('Unable to reach the server. Please check your connection.');
    }

    let result: any = {};
    try { result = await res.json(); } catch {
      throw new Error(`Upload failed (${res.status}). Please try again.`);
    }
    return result;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
export const notificationsAPI = {
  getAll: async (customerId: number) => {
    const res = await fetch(`${BASE}/api/notifications/${customerId}`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  markAllRead: async (customerId: number) => {
    const res = await fetch(`${BASE}/api/notifications/${customerId}/read-all`, {
      method:  'PATCH',
      headers: getAuthHeaders(),
    });
    return res.json();
  },
};
