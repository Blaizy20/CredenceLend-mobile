// src/server.ts
// Frontend API client — uses fetch() to talk to the Express backend
// DO NOT import mysql2 here — this runs in the browser/Capacitor, not Node.js

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface Customer {
  customer_id: number;
  tenant_id: number;
  user_id?: number;
  username: string;
  customer_no: string;
  first_name: string;
  last_name: string;
  contact_no?: string;
  email: string;
  province?: string;
  city?: string;
  barangay?: string;
  street?: string;
  is_active: number;
  created_at: string;
}

export interface Loan {
  loan_id: number;
  reference_no: string;
  principal_amount: number;
  interest_rate: number;
  payment_term: string;
  term_months: number;
  total_payable: number;
  remaining_balance: number;
  status: string;
  due_date: string;
  activated_at: string;
  created_at: string;
  is_active: number;
}

export interface Payment {
  payment_id: number;
  loan_id: number;
  amount: number;
  payment_date: string;
  method: string;
  or_no: string;
  notes?: string;
  created_at: string;
}

export interface Transaction {
  id: string;
  loan_id: string;
  type: string;
  amount: number;
  date: string;
  status: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || 'Request failed');
  }

  return data as T;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (username: string, password: string) =>
    request<{ success: boolean; customer: Customer }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  sendOTP: (email: string) =>
    request<{ success: boolean; message: string }>('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  verifyOTP: (email: string, otp: string) =>
    request<{ success: boolean; message: string }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    }),
};

// ── Customer ──────────────────────────────────────────────────────────────────
export const customerAPI = {
  getProfile: (customerId: number) =>
    request<Customer>(`/profile/${customerId}`),
};

// ── Loans ─────────────────────────────────────────────────────────────────────
export const loanAPI = {
  getAll: (customerId: number) =>
    request<Loan[]>(`/loans/${customerId}`),

  getOne: (loanId: number) =>
    request<Loan>(`/loan/${loanId}`),
};

// ── Payments ──────────────────────────────────────────────────────────────────
export const paymentAPI = {
  getByLoan: (loanId: number) =>
    request<Payment[]>(`/payments/${loanId}`),
};

// ── Transactions ──────────────────────────────────────────────────────────────
export const transactionAPI = {
  getAll: (customerId: number) =>
    request<Transaction[]>(`/transactions/${customerId}`),
};
