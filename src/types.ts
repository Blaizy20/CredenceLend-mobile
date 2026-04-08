export interface UserProfile {
  firstName: string;
  lastName: string;
  contactNo: string;
  email: string;
  username: string;
  province: string;
  city: string;
  barangay: string;
  street: string;
}

export interface LoanApplication {
  id: string;
  requestedAmount: number;
  paymentTerm: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Active';
  submittedAt: string;
  remainingBalance: number;
  totalAmount: number;
}

export interface PaymentSchedule {
  dueDate: string;
  amount: number;
  status: 'Paid' | 'Pending' | 'Upcoming';
}
