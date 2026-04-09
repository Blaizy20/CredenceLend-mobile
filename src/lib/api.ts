const BASE = import.meta.env.VITE_API_URL ?? '';

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
    const res = await fetch(`${BASE}/api/profile/${customerId}`);
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

export const loansAPI = {
  getLoans: async (customerId: number) => {
    const res = await fetch(`${BASE}/api/loans/${customerId}`);
    return res.json();
  },

  getLoan: async (loanId: number) => {
    const res = await fetch(`${BASE}/api/loan/${loanId}`);
    return res.json();
  },

  getPayments: async (loanId: number) => {
    const res = await fetch(`${BASE}/api/payments/${loanId}`);
    return res.json();
  },

  getTransactions: async (customerId: number) => {
    const res = await fetch(`${BASE}/api/transactions/${customerId}`);
    return res.json();
  },

  applyLoan: async (data: {
    customer_id:     number;
    tenant_id:       number;
    principal_amount: number;
    payment_term:    string;
    interest_rate:   number;
    term_months:     number;
    id_type:         string;
    collateral_type: string;
    co_maker: {
      first_name:  string;
      last_name:   string;
      contact_no:  string;
      email:       string;
      province:    string;
      city:        string;
      barangay:    string;
      street:      string;
    };
  }) => {
    const res = await fetch(`${BASE}/api/loans/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    let result: any = {};
    try { result = await res.json(); } catch {
      throw new Error(`Server error (${res.status}). Please try again.`);
    }
    return result;
  },
};

export const notificationsAPI = {
  getAll: async (customerId: number) => {
    const res = await fetch(`${BASE}/api/notifications/${customerId}`);
    return res.json();
  },

  markAllRead: async (customerId: number) => {
    const res = await fetch(`${BASE}/api/notifications/${customerId}/read-all`, {
      method: 'PATCH',
    });
    return res.json();
  },
};