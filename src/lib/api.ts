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
    fetch(`${BASE}/api/auth/check-username?username=${username}`).then(r => r.json()),

  checkEmail: (email: string) =>
    fetch(`${BASE}/api/auth/check-email?email=${email}`).then(r => r.json()),

  checkContact: (contactNo: string) =>
    fetch(`${BASE}/api/auth/check-contact?contactNo=${contactNo}`).then(r => r.json()),

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
};