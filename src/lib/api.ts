import { Capacitor } from '@capacitor/core';

const RAILWAY_URL = 'https://credencelend-mobile.up.railway.app';

const BASE = Capacitor.isNativePlatform()
  ? RAILWAY_URL
  : (import.meta.env.VITE_API_URL ?? '');

export { BASE as API_BASE };

// ─── Tenant helper ────────────────────────────────────────────────────────────
// Reads the verified tenant from whichever storage has it.
function getStoredTenantId(): number {
  try {
    const t = JSON.parse(localStorage.getItem('tenant')   || 'null')
           ?? JSON.parse(sessionStorage.getItem('tenant') || 'null');
    return Number(t?.tenant_id ?? 0);
  } catch {
    return 0;
  }
}

// ─── Auth token helper ────────────────────────────────────────────────────────
function authHeaders(): Record<string, string> {
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (user?.token) return { Authorization: `Bearer ${user.token}` };
  } catch {}
  return {};
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ComakerPayload {
  full_name:    string;
  phone_number: string;
  relationship: string;
  email?:       string;
  address?:     string;
  notes?:       string;
}

export interface LoanApplyPayload {
  customer_id:       number;
  tenant_id:         number;
  principal_amount:  number;
  payment_term:      string;   // 'daily' | 'weekly' | 'semi_monthly' | 'monthly'
  interest_rate:     number;
  term_months:       number;
  id_type:           string;
  collateral_type:   string;
  collateral_notes?: string;
  comakers?:         ComakerPayload[];
  notes?:            string;
}

export interface LoanApplyResponse {
  success:     boolean;
  message?:    string;
  error_code?: string;
  data?: {
    loan_id:              number;
    reference_no:         string;
    status:               string;
    next_queue:           string;
    ci_required:          boolean;
    requires_collateral:  boolean;
    missing_requirements: string[];
    instant_mode:         string;
    instant_reason:       string;
    message:              string;
  };
}

// ─── Auth API ─────────────────────────────────────────────────────────────────

export const authAPI = {
  login: async (username: string, password: string) => {
    const tenant_id = getStoredTenantId();

    const res = await fetch(`${BASE}/api/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password, tenant_id }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Invalid username or password.');
    return data;
  },

  register: async (data: Record<string, string | number>) => {
    const tenant_id = getStoredTenantId();

    const res = await fetch(`${BASE}/api/auth/register`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...data, tenant_id }),
    });
    return res.json();
  },

  getProfile: async (customerId: number) => {
    const res = await fetch(`${BASE}/api/profile/${customerId}`, {
      headers: authHeaders(),
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
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email }),
    });
    return res.json();
  },

  verifyOtp: async (email: string, otp: string) => {
    const res = await fetch(`${BASE}/api/auth/verify-otp`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, otp }),
    });
    return res.json();
  },

  resetPassword: async (email: string, newPassword: string) => {
    const res = await fetch(`${BASE}/api/auth/reset-password`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, newPassword }),
    });
    let result: any = {};
    try { result = await res.json(); } catch {
      throw new Error(`Server error (${res.status}). Please try again.`);
    }
    return result;
  },
};

// ─── Loans API ────────────────────────────────────────────────────────────────

export const loansAPI = {
  getLoans: async (customerId: number) => {
    const res = await fetch(`${BASE}/api/loans/${customerId}`, {
      headers: authHeaders(),
    });
    return res.json();
  },

  getLoan: async (loanId: number) => {
    const res = await fetch(`${BASE}/api/loan/${loanId}`, {
      headers: authHeaders(),
    });
    return res.json();
  },

  getPayments: async (loanId: number) => {
    const res = await fetch(`${BASE}/api/payments/${loanId}`, {
      headers: authHeaders(),
    });
    return res.json();
  },

  getTransactions: async (customerId: number) => {
    const res = await fetch(`${BASE}/api/transactions/${customerId}`, {
      headers: authHeaders(),
    });
    return res.json();
  },

  applyLoan: async (data: LoanApplyPayload): Promise<LoanApplyResponse> => {
    const res = await fetch(`${BASE}/api/loans/apply`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify(data),
    });
    let result: any = {};
    try {
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        result = await res.json();
      } else {
        throw new Error(`Server error (${res.status}). Please try again.`);
      }
    } catch (e: any) {
      throw new Error(e.message || `Server error (${res.status}). Please try again.`);
    }

    if (!result.success) {
      const friendlyMessages: Record<string, string> = {
        UNPAID_LOANS_EXIST: 'You have an existing active loan. Please settle it before applying for a new one.',
        INVALID_AMOUNT:     'The loan amount entered is invalid.',
        INVALID_TERM:       'The loan term entered is invalid.',
        CUSTOMER_NOT_FOUND: 'Your account could not be found. Please log in again.',
        TENANT_REQUIRED:    'Cooperative configuration error. Please contact support.',
        AUTH_INVALID:       'Your session has expired. Please log in again.',
        TOKEN_MISSING:      'Authentication required. Please log in again.',
      };
      const code     = result.error_code ?? '';
      result.message = friendlyMessages[code] || result.message || 'Submission failed. Please try again.';
    }

    return result;
  },

  uploadDocument: async (loanId: number, requirementCode: string, file: File): Promise<boolean> => {
    try {
      const form = new FormData();
      form.append('loan_id',          String(loanId));
      form.append('requirement_code', requirementCode);
      form.append('file',             file);

      const res = await fetch(`${BASE}/api/loans/requirements/upload`, {
        method:  'POST',
        headers: authHeaders(),
        body:    form,
      });

      return res.ok;
    } catch {
      return false;
    }
  },
};

// ─── Notifications API ────────────────────────────────────────────────────────

export const notificationsAPI = {
  getAll: async (customerId: number) => {
    const res = await fetch(`${BASE}/api/notifications/${customerId}`, {
      headers: authHeaders(),
    });
    return res.json();
  },

  markAllRead: async (customerId: number) => {
    const res = await fetch(`${BASE}/api/notifications/${customerId}/read-all`, {
      method:  'PATCH',
      headers: authHeaders(),
    });
    return res.json();
  },
};