/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import RegisterStep1 from './pages/RegisterStep1';
import RegisterStep2 from './pages/RegisterStep2';
import RegisterStep3 from './pages/RegisterStep3';
import RegisterStep4 from './pages/RegisterStep4';
import Dashboard from './pages/Dashboard';
import TrackLoan from './pages/TrackLoan';
import LoanDetails from './pages/LoanDetails';
import ApplyLoanStep1 from './pages/ApplyLoanStep1';
import ApplyLoanStep2 from './pages/ApplyLoanStep2';
import PaymentOptions from './pages/PaymentOptions';
import Payment from './pages/Payment';
import PaymentGateway from './pages/PaymentGateway';
import PaymentSuccess from './pages/PaymentSuccess';
import Profile from './pages/Profile';
import Inbox from './pages/Inbox';
import Transactions from './pages/Transactions';
import { ToastProvider } from './pages/ToastNotification';

export default function App() {
  return (
    <ToastProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/register" element={<RegisterStep1 />} />
          <Route path="/register/step2" element={<RegisterStep2 />} />
          <Route path="/register/step3" element={<RegisterStep3 />} />
          <Route path="/register/step4" element={<RegisterStep4 />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/track" element={<TrackLoan />} />
          <Route path="/loan/:id" element={<LoanDetails />} />
          <Route path="/apply" element={<ApplyLoanStep1 />} />
          <Route path="/apply/step2" element={<ApplyLoanStep2 />} />
          <Route path="/loan/:id/pay" element={<PaymentOptions />} />
          <Route path="/loan/:id/pay/confirm" element={<Payment />} />
          <Route path="/loan/:id/pay/success" element={<PaymentSuccess />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/loan/:id/pay/confirm" element={<PaymentGateway />} />
        </Routes>
      </Router>
    </ToastProvider>
  );
}