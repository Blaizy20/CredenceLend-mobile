import cors from "cors";
import bcrypt from "bcryptjs";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import mysql, { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import multer from 'multer';
import { Upload } from '@aws-sdk/lib-storage';
import { s3, BUCKET } from './storage';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const upload     = multer({ storage: multer.memoryStorage() });

const PORT               = Number(process.env.PORT || 3000);
const FALLBACK_TENANT_ID = Number(process.env.DEFAULT_TENANT_ID || 1);

const pool = mysql.createPool({
  host:               process.env.DB_HOST,
  port:               Number(process.env.DB_PORT),
  database:           process.env.DB_NAME,
  user:               process.env.DB_USER,
  password:           process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  ssl:                { rejectUnauthorized: false },
});

type CustomerRow = RowDataPacket & {
  customer_id:  number;
  tenant_id:    number | null;
  user_id:      number | null;
  username:     string;
  password:     string;
  customer_no:  string;
  first_name:   string;
  last_name:    string;
  contact_no:   string | null;
  email:        string | null;
  province:     string | null;
  city:         string | null;
  barangay:     string | null;
  street:       string | null;
  created_at:   string;
  is_active:    number;
};

const METHOD_MAP: Record<string, string> = {
  walkin:            "CASH",
  cash:              "CASH",
  cheque:            "CHEQUE",
  bank:              "BANK",
  gcash:             "GCASH",
  paymaya:           "MAYA",
  maya:              "MAYA",
  card:              "CARD",
  qrph:              "QRPH",
  grab_pay:          "GRAB_PAY",
  grabpay:           "GRAB_PAY",
  bpi:               "BPI",
  bpi_online:        "BPI",
  unionbank:         "UNIONBANK",
  unionbank_online:  "UNIONBANK",
  brankas_bdo:       "BRANKAS_BDO",
  brankas_landbank:  "BANK",
  brankas_metrobank: "BANK",
  dob:               "BANK",
  dob_ubp:           "BANK",
  billease:          "OTHER",
  wallet:            "GCASH",
  digital:           "OTHER",
  online:            "OTHER",
  other:             "OTHER",
};

function normalizeMethod(method: string): string {
  return METHOD_MAP[method.toLowerCase().replace(/-/g, "_")] ?? "OTHER";
}

function getNextCustomerNo(lastNo: string | null, year: number): string {
  if (!lastNo) return `CUST-${year}-0001`;
  const seq = Number(lastNo.split("-")[2] || 0);
  return `CUST-${year}-${String(seq + 1).padStart(4, "0")}`;
}

function getNextReferenceNo(lastRef: string | null, year: number): string {
  if (!lastRef) return `LOAN-${year}-0001`;
  const seq = Number(lastRef.split("-")[2] || 0);
  return `LOAN-${year}-${String(seq + 1).padStart(4, "0")}`;
}

function getTermCount(paymentTerm: string, termMonths: number): number {
  switch ((paymentTerm ?? "").toLowerCase().replace(/-/g, "_")) {
    case "daily":        return termMonths * 30;
    case "weekly":       return termMonths * 4;
    case "semi_monthly": return termMonths * 2;
    case "monthly":
    default:             return termMonths;
  }
}

async function insertNotification(
  customerId: number,
  tenantId:   number,
  title:      string,
  message:    string,
  type:       string
): Promise<void> {
  try {
    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT notification_id FROM notifications
       WHERE customer_id = ? AND title = ? AND message = ?
       AND created_at > NOW() - INTERVAL 1 HOUR LIMIT 1`,
      [customerId, title, message]
    );
    if (existing.length > 0) return;
    await pool.query(
      `INSERT INTO notifications (customer_id, tenant_id, title, message, type) VALUES (?, ?, ?, ?, ?)`,
      [customerId, tenantId, title, message, type]
    );
  } catch (err: any) {
    console.warn("Notification insert skipped:", err.message);
  }
}

async function sendOtpEmail(toEmail: string, otp: string): Promise<void> {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "accept":       "application/json",
      "api-key":      process.env.BREVO_API_KEY ?? "",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: {
        name:  process.env.BREVO_SENDER_NAME  ?? "Loan Manager",
        email: process.env.BREVO_SENDER_EMAIL ?? "",
      },
      to: [{ email: toEmail }],
      subject: "Your Verification Code",
      htmlContent: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f9f8f5;border-radius:8px;">
          <h2 style="color:#01696f;">Verification Code</h2>
          <p>Use the code below to verify your identity. It expires in 10 minutes.</p>
          <div style="font-size:2rem;font-weight:700;letter-spacing:0.3em;color:#28251d;background:#fff;padding:16px 24px;border-radius:6px;text-align:center;margin:24px 0;">${otp}</div>
          <p style="color:#7a7974;font-size:0.875rem;">If you did not request this, please ignore this email.</p>
        </div>`,
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    console.error("Brevo send error:", err);
    throw new Error(`Brevo API error: ${response.status}`);
  }
}

async function sendPaymentEmail(
  toEmail:     string,
  firstName:   string,
  amount:      number,
  newBalance:  number,
  orNo:        string,
  method:      string,
  isFullyPaid: boolean
): Promise<void> {
  const formattedAmount  = amount.toLocaleString("en-PH", { minimumFractionDigits: 2 });
  const formattedBalance = newBalance.toLocaleString("en-PH", { minimumFractionDigits: 2 });

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "accept":       "application/json",
      "api-key":      process.env.BREVO_API_KEY ?? "",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: {
        name:  process.env.BREVO_SENDER_NAME  ?? "Loan Manager",
        email: process.env.BREVO_SENDER_EMAIL ?? "",
      },
      to: [{ email: toEmail }],
      subject: isFullyPaid ? "🎉 Your Loan is Fully Paid!" : "Payment Received – CredenceLend",
      htmlContent: isFullyPaid ? `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f9f8f5;border-radius:8px;">
          <h2 style="color:#16a34a;">Loan Fully Paid! 🎉</h2>
          <p>Hi <strong>${firstName}</strong>,</p>
          <p>Congratulations! Your loan has been <strong>fully paid</strong>. Thank you for settling your account on time.</p>
          <table style="width:100%;border-collapse:collapse;margin:24px 0;">
            <tr style="background:#f0fdf4;">
              <td style="padding:10px 14px;font-size:0.85rem;color:#374151;">Amount Paid</td>
              <td style="padding:10px 14px;font-weight:700;color:#16a34a;">₱${formattedAmount}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;font-size:0.85rem;color:#374151;">Payment Method</td>
              <td style="padding:10px 14px;font-weight:600;color:#28251d;">${method}</td>
            </tr>
            <tr style="background:#f0fdf4;">
              <td style="padding:10px 14px;font-size:0.85rem;color:#374151;">OR Number</td>
              <td style="padding:10px 14px;font-weight:600;color:#28251d;">${orNo}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;font-size:0.85rem;color:#374151;">Remaining Balance</td>
              <td style="padding:10px 14px;font-weight:700;color:#16a34a;">₱0.00 — CLOSED</td>
            </tr>
          </table>
          <p style="color:#7a7974;font-size:0.875rem;">This is an automated payment confirmation. Please keep this for your records.</p>
        </div>` : `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f9f8f5;border-radius:8px;">
          <h2 style="color:#01696f;">Payment Received</h2>
          <p>Hi <strong>${firstName}</strong>,</p>
          <p>We have successfully received your payment. Here are the details:</p>
          <table style="width:100%;border-collapse:collapse;margin:24px 0;">
            <tr style="background:#f0faf9;">
              <td style="padding:10px 14px;font-size:0.85rem;color:#374151;">Amount Paid</td>
              <td style="padding:10px 14px;font-weight:700;color:#01696f;">₱${formattedAmount}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;font-size:0.85rem;color:#374151;">Payment Method</td>
              <td style="padding:10px 14px;font-weight:600;color:#28251d;">${method}</td>
            </tr>
            <tr style="background:#f0faf9;">
              <td style="padding:10px 14px;font-size:0.85rem;color:#374151;">OR Number</td>
              <td style="padding:10px 14px;font-weight:600;color:#28251d;">${orNo}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;font-size:0.85rem;color:#374151;">Remaining Balance</td>
              <td style="padding:10px 14px;font-weight:700;color:#28251d;">₱${formattedBalance}</td>
            </tr>
          </table>
          <p style="color:#7a7974;font-size:0.875rem;">This is an automated payment confirmation. Please keep this for your records.</p>
        </div>`,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    console.error("Brevo payment email error:", err);
  }
}

async function sendLoanStatusEmail(
  toEmail:     string,
  firstName:   string,
  status:      string,
  referenceNo: string,
  amount:      number
): Promise<void> {
  const formattedAmount = amount.toLocaleString('en-PH', { minimumFractionDigits: 2 });

  const TEMPLATES: Record<string, { subject: string; heading: string; color: string; body: string }> = {
    active: {
      subject: `✅ Loan Approved – ${referenceNo}`,
      heading: 'Your Loan Has Been Approved!',
      color:   '#16a34a',
      body:    `Great news, <strong>${firstName}</strong>! Your loan application <strong>${referenceNo}</strong> for <strong>₱${formattedAmount}</strong> has been <strong>approved</strong>. Please log in to your CredenceLend app to view your payment schedule.`,
    },
    denied: {
      subject: `❌ Loan Application Update – ${referenceNo}`,
      heading: 'Loan Application Not Approved',
      color:   '#dc2626',
      body:    `Hi <strong>${firstName}</strong>, unfortunately your loan application <strong>${referenceNo}</strong> for <strong>₱${formattedAmount}</strong> was <strong>not approved</strong> at this time. Please contact your cooperative for more information or to discuss your options.`,
    },
    closed: {
      subject: `🎉 Loan Fully Paid – ${referenceNo}`,
      heading: 'Loan Fully Paid!',
      color:   '#01696f',
      body:    `Congratulations, <strong>${firstName}</strong>! Your loan <strong>${referenceNo}</strong> has been marked as <strong>fully paid</strong>. Thank you for settling your account. We hope to serve you again!`,
    },
  };

  const template = TEMPLATES[status.toLowerCase()];
  if (!template) return;

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept':       'application/json',
      'api-key':      process.env.BREVO_API_KEY ?? '',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name:  process.env.BREVO_SENDER_NAME  ?? 'Loan Manager',
        email: process.env.BREVO_SENDER_EMAIL ?? '',
      },
      to: [{ email: toEmail }],
      subject: template.subject,
      htmlContent: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f9f8f5;border-radius:8px;">
          <h2 style="color:${template.color};">${template.heading}</h2>
          <p>${template.body}</p>
          <div style="margin:24px 0;padding:16px;background:#fff;border-radius:6px;border-left:4px solid ${template.color};">
            <p style="margin:0;font-size:0.85rem;color:#374151;">Reference No: <strong>${referenceNo}</strong></p>
            <p style="margin:4px 0 0;font-size:0.85rem;color:#374151;">Amount: <strong>₱${formattedAmount}</strong></p>
            <p style="margin:4px 0 0;font-size:0.85rem;color:#374151;">Status: <strong style="color:${template.color};">${status.toUpperCase()}</strong></p>
          </div>
          <p style="color:#7a7974;font-size:0.875rem;">This is an automated notification from CredenceLend. Please do not reply to this email.</p>
        </div>`,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    console.warn('Loan status email skipped:', err);
  }
}

async function startServer() {
  const REQUIRED_ENV = [
    "DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD",
    "PAYMONGO_SECRET_KEY", "BREVO_API_KEY", "BREVO_SENDER_EMAIL",
  ];
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`[startup] Missing env vars: ${missing.join(", ")}`);
    process.exit(1);
  }

  const PAYMONGO_SECRET  = process.env.PAYMONGO_SECRET_KEY!;
  const PAYMONGO_AUTH    = Buffer.from(`${PAYMONGO_SECRET}:`).toString("base64");
  const PAYMONGO_HEADERS = {
    Authorization:  `Basic ${PAYMONGO_AUTH}`,
    "Content-Type": "application/json",
  };

  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  app.use(cors({
    origin: [
      "https://credencelend-mobile.up.railway.app",
      "capacitor://localhost",
      "https://localhost",
      "http://localhost",
      "http://localhost:3000",
      "http://localhost:5173",
    ],
    credentials: true,
  }));

  // ── Health ────────────────────────────────────────────────────────────────
  app.get("/api/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok", database: "connected ✅" });
    } catch (err: any) {
      res.status(500).json({ status: "error", database: "disconnected ❌", error: err.message });
    }
  });

  // ── Auth: Availability Checks ─────────────────────────────────────────────
  app.get("/api/auth/check-username", async (req, res) => {
    try {
      const username  = String(req.query.username  || "").trim();
      const tenant_id = Number(req.query.tenant_id || 0);
      if (!username)  return res.status(400).json({ taken: false, message: "Username is required." });
      if (!tenant_id) return res.status(400).json({ taken: false, message: "Cooperative is required." });
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT customer_id FROM customers WHERE username = ? AND tenant_id = ? LIMIT 1",
        [username, tenant_id]
      );
      res.json({ taken: rows.length > 0 });
    } catch { res.status(500).json({ taken: false, message: "An unexpected error occurred." }); }
  });

  app.get("/api/auth/check-email", async (req, res) => {
    try {
      const email     = String(req.query.email     || "").trim();
      const tenant_id = Number(req.query.tenant_id || 0);
      if (!email)     return res.status(400).json({ taken: false, message: "Email is required." });
      if (!tenant_id) return res.status(400).json({ taken: false, message: "Cooperative is required." });
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT customer_id FROM customers WHERE email = ? AND tenant_id = ? LIMIT 1",
        [email, tenant_id]
      );
      res.json({ taken: rows.length > 0 });
    } catch { res.status(500).json({ taken: false, message: "An unexpected error occurred." }); }
  });

  app.get("/api/auth/check-contact", async (req, res) => {
    try {
      const contactNo = String(req.query.contactNo || "").trim();
      const tenant_id = Number(req.query.tenant_id || 0);
      if (!contactNo) return res.status(400).json({ taken: false, message: "Contact number is required." });
      if (!tenant_id) return res.status(400).json({ taken: false, message: "Cooperative is required." });
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT customer_id FROM customers WHERE contact_no = ? AND tenant_id = ? LIMIT 1",
        [contactNo, tenant_id]
      );
      res.json({ taken: rows.length > 0 });
    } catch { res.status(500).json({ taken: false, message: "An unexpected error occurred." }); }
  });

  // ── Tenant: Verify Code ───────────────────────────────────────────────────
  app.post('/api/tenants/verify-code', async (req: any, res: any) => {
    const { code } = req.body;
    if (!code || typeof code !== 'string' || code.length !== 6)
      return res.status(400).json({ success: false, message: 'Invalid code format.' });

    try {
      const [rows]: any = await pool.query(
        `SELECT tenant_id, tenant_name, subdomain, display_name, logo_path, primary_color
         FROM tenants
         WHERE mobile_app_code = ?
           AND tenant_status = 'ACTIVE'
           AND is_active = 1
           AND subscription_status IN ('TRIAL', 'ACTIVE')
         LIMIT 1`,
        [code.toUpperCase()]
      );

      if (!rows.length)
        return res.status(404).json({
          success: false,
          message: 'Code not found or cooperative is inactive. Please contact your cooperative.',
        });

      return res.json({
        success:       true,
        tenant_id:     rows[0].tenant_id,
        tenant_name:   rows[0].tenant_name,
        display_name:  rows[0].display_name  ?? null,
        subdomain:     rows[0].subdomain     ?? '',
        logo_path:     rows[0].logo_path     ?? null,
        primary_color: rows[0].primary_color ?? null,
      });
    } catch (err) {
      console.error('[verify-code]', err);
      return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
  });

  // ── Auth: Send OTP ────────────────────────────────────────────────────────
  app.post("/api/auth/send-otp", async (req, res) => {
    try {
      const email     = String(req.body.email     ?? "").trim().toLowerCase();
      const tenant_id = Number(req.body.tenant_id ?? 0);

      if (!email)
        return res.status(400).json({ success: false, message: "Please provide your email address." });
      if (!tenant_id)
        return res.status(400).json({ success: false, message: "Cooperative verification is required." });

      const [customers] = await pool.query<RowDataPacket[]>(
        "SELECT customer_id FROM customers WHERE email = ? AND tenant_id = ? AND is_active = 1 LIMIT 1",
        [email, tenant_id]
      );
      if (customers.length === 0)
        return res.status(404).json({ success: false, message: "No account is associated with this email address in the selected cooperative." });

      const otp       = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 10 * 60 * 1000;
      await pool.query("REPLACE INTO otps (email, otp, expires_at) VALUES (?, ?, ?)", [email, otp, expiresAt]);
      await sendOtpEmail(email, otp);
      res.json({ success: true, message: "A verification code has been sent to your email." });
    } catch (err: any) {
      console.error("Send OTP error:", err.message);
      res.status(500).json({ success: false, message: "Failed to send verification code. Please try again." });
    }
  });

  // ── Auth: Verify OTP ──────────────────────────────────────────────────────
  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const email     = String(req.body.email     ?? "").trim().toLowerCase();
      const otp       = String(req.body.otp       ?? "").trim();
      const tenant_id = Number(req.body.tenant_id ?? 0);

      if (!email || !otp)
        return res.status(400).json({ success: false, message: "Email and verification code are required." });
      if (!tenant_id)
        return res.status(400).json({ success: false, message: "Cooperative verification is required." });

      const [customers] = await pool.query<RowDataPacket[]>(
        "SELECT customer_id FROM customers WHERE email = ? AND tenant_id = ? AND is_active = 1 LIMIT 1",
        [email, tenant_id]
      );
      if (customers.length === 0)
        return res.status(404).json({ success: false, message: "No account is associated with this email address in the selected cooperative." });

      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT * FROM otps WHERE email = ? AND otp = ? AND expires_at > ? LIMIT 1",
        [email, otp, Date.now()]
      );
      if (rows.length === 0)
        return res.status(400).json({ success: false, message: "The verification code is invalid or has expired." });

      await pool.query("DELETE FROM otps WHERE email = ?", [email]);
      res.json({ success: true, message: "Verification successful." });
    } catch (err: any) {
      console.error("Verify OTP error:", err.message);
      res.status(500).json({ success: false, message: "An unexpected error occurred." });
    }
  });

  // ── Auth: Reset Password ──────────────────────────────────────────────────
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const email       = String(req.body.email       ?? "").trim().toLowerCase();
      const newPassword = String(req.body.newPassword ?? "");
      const tenant_id   = Number(req.body.tenant_id   ?? 0);

      if (!email || !newPassword)
        return res.status(400).json({ success: false, message: "Email and new password are required." });
      if (!tenant_id)
        return res.status(400).json({ success: false, message: "Cooperative verification is required." });
      if (newPassword.length < 8)
        return res.status(400).json({ success: false, message: "Password must be at least 8 characters." });

      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT customer_id FROM customers WHERE email = ? AND tenant_id = ? AND is_active = 1 LIMIT 1",
        [email, tenant_id]
      );
      if (rows.length === 0)
        return res.status(404).json({ success: false, message: "No account found with this email address in the selected cooperative." });

      const hashed = await bcrypt.hash(newPassword, 10);
      await pool.query(
        "UPDATE customers SET password = ? WHERE email = ? AND tenant_id = ? AND is_active = 1",
        [hashed, email, tenant_id]
      );
      res.json({ success: true, message: "Your password has been reset successfully." });
    } catch (err: any) {
      console.error("Reset password error:", err.message);
      res.status(500).json({ success: false, message: "An unexpected error occurred." });
    }
  });

  // ── Auth: Register ────────────────────────────────────────────────────────
  app.post("/api/auth/register", async (req, res) => {
    try {
      const tenant_id  = Number(req.body.tenant_id  ?? FALLBACK_TENANT_ID);
      const first_name = String(req.body.first_name ?? req.body.firstName ?? "").trim();
      const last_name  = String(req.body.last_name  ?? req.body.lastName  ?? "").trim();
      const username   = String(req.body.username   ?? "").trim();
      const contact_no = String(req.body.contact_no ?? req.body.contactNo ?? "").trim();
      const email      = String(req.body.email      ?? "").trim().toLowerCase();
      const password   = String(req.body.password   ?? "");
      const province   = String(req.body.province   ?? "").trim();
      const city       = String(req.body.city       ?? "").trim();
      const barangay   = String(req.body.barangay   ?? "").trim();
      const street     = String(req.body.street     ?? "").trim();

      if (!first_name || !last_name || !username || !contact_no || !email || !password || !province || !city || !barangay || !street)
        return res.status(400).json({ success: false, message: "All fields are required." });
      if (!/^09\d{9}$/.test(contact_no))
        return res.status(400).json({ success: false, message: "Please enter a valid Philippine mobile number (e.g. 09XXXXXXXXX)." });
      if (!/\S+@\S+\.\S+/.test(email))
        return res.status(400).json({ success: false, message: "Please enter a valid email address." });

      const [duplicateRows] = await pool.query<RowDataPacket[]>(
        `SELECT customer_id, username, email, contact_no FROM customers
         WHERE tenant_id = ? AND (username = ? OR email = ? OR contact_no = ?) LIMIT 1`,
        [tenant_id, username, email, contact_no]
      );
      if (duplicateRows.length > 0) {
        const dup = duplicateRows[0];
        if (dup.username   === username)   return res.status(409).json({ success: false, message: "This username is already taken." });
        if (dup.email      === email)      return res.status(409).json({ success: false, message: "An account with this email already exists." });
        if (dup.contact_no === contact_no) return res.status(409).json({ success: false, message: "An account with this contact number already exists." });
      }

      const year = new Date().getFullYear();
      const [lastCustomerRows] = await pool.query<RowDataPacket[]>(
        `SELECT customer_no FROM customers WHERE customer_no LIKE ? ORDER BY customer_id DESC LIMIT 1`,
        [`CUST-${year}-%`]
      );
      const customer_no    = getNextCustomerNo(lastCustomerRows[0]?.customer_no ?? null, year);
      const hashedPassword = await bcrypt.hash(password, 10);

      const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO customers (tenant_id, username, password, customer_no, first_name, last_name, contact_no, email, province, city, barangay, street, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [tenant_id, username, hashedPassword, customer_no, first_name, last_name, contact_no, email, province, city, barangay, street]
      );
      res.status(201).json({
        success:  true,
        message:  "Your account has been created successfully.",
        customer: { customer_id: result.insertId, tenant_id, username, customer_no, first_name, last_name, contact_no, email, province, city, barangay, street, is_active: 1 },
      });
    } catch (err: any) {
      console.error("Register error:", err);
      res.status(500).json({ success: false, message: "Registration failed. Please try again.", error: err.message });
    }
  });

  // ── Auth: Login ───────────────────────────────────────────────────────────
  app.post("/api/auth/login", async (req, res) => {
    try {
      const usernameOrEmail = String(req.body.username ?? req.body.email ?? "").trim();
      const password        = String(req.body.password ?? "");
      const tenant_id       = Number(req.body.tenant_id ?? 0);

      if (!usernameOrEmail || !password)
        return res.status(400).json({ success: false, message: "Please enter your username and password." });
      if (!tenant_id)
        return res.status(400).json({ success: false, message: "Cooperative verification is required. Please restart the app and enter your cooperative code." });

      const [rows] = await pool.query<CustomerRow[]>(
        `SELECT customer_id, tenant_id, user_id, username, password, customer_no, first_name, last_name, contact_no, email, province, city, barangay, street, created_at, is_active
         FROM customers
         WHERE (username = ? OR email = ?) AND tenant_id = ? AND is_active = 1
         LIMIT 1`,
        [usernameOrEmail, usernameOrEmail, tenant_id]
      );

      if (rows.length === 0)
        return res.status(401).json({ success: false, message: "Incorrect username or password." });

      const customer = rows[0];
      const match    = await bcrypt.compare(password, customer.password);
      if (!match)
        return res.status(401).json({ success: false, message: "Incorrect username or password." });

      const { password: _pw, ...safeCustomer } = customer;
      res.json({ success: true, customer: safeCustomer });
    } catch (err: any) {
      console.error("Login error:", err.message);
      res.status(500).json({ success: false, message: "An unexpected error occurred." });
    }
  });

  // ── Profile ───────────────────────────────────────────────────────────────
  app.get("/api/profile/:customerId", async (req, res) => {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT customer_id, tenant_id, user_id, username, customer_no, first_name, last_name, contact_no, email, province, city, barangay, street, created_at, is_active
         FROM customers WHERE customer_id = ? AND is_active = 1 LIMIT 1`,
        [req.params.customerId]
      );
      if (rows.length === 0) return res.status(404).json({ success: false, message: "Customer not found." });
      res.json(rows[0]);
    } catch { res.status(500).json({ success: false, message: "An unexpected error occurred." }); }
  });

  // ── Profile: Update Credentials ───────────────────────────────────────────
  app.patch("/api/profile/update", async (req, res) => {
    try {
      const customer_id = Number(req.body.customer_id ?? 0);
      const tenant_id   = Number(req.body.tenant_id   ?? 0);
      const field       = String(req.body.field        ?? "");

      if (!customer_id || !tenant_id || !field)
        return res.status(400).json({ success: false, message: "Missing required fields." });

      if (field === "password") {
        const currentPassword = String(req.body.current_password ?? "");
        const newPassword     = String(req.body.new_password     ?? "");

        if (!currentPassword || !newPassword)
          return res.status(400).json({ success: false, message: "Current and new passwords are required." });
        if (newPassword.length < 8)
          return res.status(400).json({ success: false, message: "Password must be at least 8 characters." });

        const [rows] = await pool.query<RowDataPacket[]>(
          "SELECT password FROM customers WHERE customer_id = ? AND tenant_id = ? AND is_active = 1 LIMIT 1",
          [customer_id, tenant_id]
        );
        if (rows.length === 0)
          return res.status(404).json({ success: false, message: "Account not found." });

        const match = await bcrypt.compare(currentPassword, rows[0].password);
        if (!match)
          return res.status(401).json({ success: false, message: "Current password is incorrect." });

        const hashed = await bcrypt.hash(newPassword, 10);
        await pool.query(
          "UPDATE customers SET password = ? WHERE customer_id = ? AND tenant_id = ? AND is_active = 1",
          [hashed, customer_id, tenant_id]
        );
        return res.json({ success: true, message: "Password updated successfully." });
      }

      const ALLOWED_FIELDS: Record<string, string> = {
        username:   "username",
        email:      "email",
        contact_no: "contact_no",
      };
      const dbField = ALLOWED_FIELDS[field];
      if (!dbField)
        return res.status(400).json({ success: false, message: "Invalid field." });

      const value = String(req.body.value ?? "").trim();
      if (!value)
        return res.status(400).json({ success: false, message: "Value is required." });

      const [dupRows] = await pool.query<RowDataPacket[]>(
        `SELECT customer_id FROM customers WHERE ${dbField} = ? AND tenant_id = ? AND customer_id != ? AND is_active = 1 LIMIT 1`,
        [value, tenant_id, customer_id]
      );
      if (dupRows.length > 0)
        return res.status(409).json({ success: false, message: `This ${field.replace('_', ' ')} is already taken by another account.` });

      await pool.query(
        `UPDATE customers SET ${dbField} = ? WHERE customer_id = ? AND tenant_id = ? AND is_active = 1`,
        [value, customer_id, tenant_id]
      );
      return res.json({ success: true, message: `${field.replace('_', ' ')} updated successfully.` });

    } catch (err: any) {
      console.error("Profile update error:", err.message);
      res.status(500).json({ success: false, message: "An unexpected error occurred." });
    }
  });

  // ── Loans: Apply ──────────────────────────────────────────────────────────
  app.post("/api/loans/apply", async (req, res) => {
    try {
      const {
        customer_id, tenant_id, principal_amount, payment_term,
        interest_rate, term_months, id_type, collateral_type, co_maker,
      } = req.body;

      if (!customer_id || !principal_amount || !payment_term || !collateral_type)
        return res.status(400).json({ success: false, message: "Please complete all required fields." });

      const amount = Number(principal_amount);
      if (isNaN(amount) || amount < 1000 || amount > 500000)
        return res.status(400).json({ success: false, message: "Loan amount must be between ₱1,000 and ₱500,000." });

      const [activeLoans] = await pool.query<RowDataPacket[]>(
        `SELECT loan_id FROM loans
         WHERE customer_id = ? AND tenant_id = ?
         AND status NOT IN ('CLOSED', 'DENIED')
         AND is_active = 1`,
        [customer_id, tenant_id]
      );
      if (activeLoans.length > 0)
        return res.status(409).json({
          success:    false,
          error_code: "UNPAID_LOANS_EXIST",
          message:    "You already have an active loan. Please settle your current loan before applying for a new one.",
        });

      const year = new Date().getFullYear();
      const [lastLoanRows] = await pool.query<RowDataPacket[]>(
        `SELECT reference_no FROM loans WHERE reference_no LIKE ? ORDER BY loan_id DESC LIMIT 1`,
        [`LOAN-${year}-%`]
      );

      const reference_no     = getNextReferenceNo(lastLoanRows[0]?.reference_no ?? null, year);
      const rate             = Number(interest_rate) || 0;
      const months           = Number(term_months)   || 1;
      const resolvedTenantId = Number(tenant_id      ?? FALLBACK_TENANT_ID);

      const totalInterest   = amount * (rate / 100) * months;
      const total_payable   = Number((amount + totalInterest).toFixed(2));
      const termCount       = getTermCount(payment_term, months);
      const amount_per_term = Number((total_payable / termCount).toFixed(2));

      const [loanResult] = await pool.query<ResultSetHeader>(
        `INSERT INTO loans (tenant_id, customer_id, reference_no, principal_amount, interest_rate, payment_term, term_months, total_payable, amount_per_term, remaining_balance, id_type, collateral_type, status, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 1)`,
        [resolvedTenantId, customer_id, reference_no, amount, rate, payment_term, months, total_payable, amount_per_term, total_payable, id_type ?? null, collateral_type]
      );
      const loan_id = loanResult.insertId;

      if (co_maker?.first_name && co_maker?.last_name) {
        try {
          await pool.query(
            `INSERT INTO co_makers (loan_id, customer_id, first_name, last_name, contact_no, email, province, city, barangay, street)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [loan_id, customer_id, String(co_maker.first_name).trim(), String(co_maker.last_name).trim(),
             co_maker.contact_no || null, co_maker.email || null, co_maker.province || null,
             co_maker.city || null, co_maker.barangay || null, co_maker.street || null]
          );
        } catch (coMakerErr: any) { console.warn("Co-maker insert skipped:", coMakerErr.message); }
      }

      await insertNotification(
        customer_id, resolvedTenantId,
        "Loan Application Received",
        `Your application (${reference_no}) for ₱${amount.toLocaleString()} has been submitted and is pending review.`,
        "general"
      );

      try {
        const [custRows] = await pool.query<RowDataPacket[]>(
          `SELECT first_name, email FROM customers WHERE customer_id = ? LIMIT 1`,
          [customer_id]
        );
        if (custRows.length > 0 && custRows[0].email) {
          const formattedAmount = amount.toLocaleString('en-PH', { minimumFractionDigits: 2 });
          await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
              'accept':       'application/json',
              'api-key':      process.env.BREVO_API_KEY ?? '',
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              sender: {
                name:  process.env.BREVO_SENDER_NAME  ?? 'Loan Manager',
                email: process.env.BREVO_SENDER_EMAIL ?? '',
              },
              to: [{ email: custRows[0].email }],
              subject: `📋 Loan Application Received – ${reference_no}`,
              htmlContent: `
                <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f9f8f5;border-radius:8px;">
                  <h2 style="color:#01696f;">Application Received</h2>
                  <p>Hi <strong>${custRows[0].first_name}</strong>, we have received your loan application. Here are your details:</p>
                  <div style="margin:24px 0;padding:16px;background:#fff;border-radius:6px;border-left:4px solid #01696f;">
                    <p style="margin:0;font-size:0.85rem;color:#374151;">Reference No: <strong>${reference_no}</strong></p>
                    <p style="margin:4px 0 0;font-size:0.85rem;color:#374151;">Amount: <strong>₱${formattedAmount}</strong></p>
                    <p style="margin:4px 0 0;font-size:0.85rem;color:#374151;">Status: <strong style="color:#2563eb;">PENDING REVIEW</strong></p>
                  </div>
                  <p style="color:#7a7974;font-size:0.875rem;">You will receive another email once your application has been reviewed. This is an automated notification from CredenceLend.</p>
                </div>`,
            }),
          });
        }
      } catch (emailErr: any) {
        console.warn('Application email skipped:', emailErr.message);
      }

      try {
        await pool.query(
          `INSERT INTO loan_status_cache (loan_id, last_status) VALUES (?, 'PENDING')
           ON DUPLICATE KEY UPDATE last_status = 'PENDING'`,
          [loan_id]
        );
      } catch (cacheErr: any) { console.warn("Status cache seed skipped:", cacheErr.message); }

      res.status(201).json({
        success: true,
        message: "Your loan application has been submitted successfully.",
        loan:    { loan_id, reference_no, total_payable, amount_per_term, status: "PENDING" },
      });
    } catch (err: any) {
      console.error("Loan apply error:", err);
      res.status(500).json({ success: false, message: "Failed to submit loan application.", error: err.message });
    }
  });

  // ── Loans: List by Customer ───────────────────────────────────────────────
  app.get("/api/loans/:customerId", async (req, res) => {
    try {
      const customerId = req.params.customerId;
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT l.loan_id, l.reference_no, l.principal_amount, l.interest_rate,
                l.payment_term, l.term_months, l.total_payable, l.amount_per_term,
                l.remaining_balance, l.status, l.due_date, l.activated_at,
                l.created_at, l.is_active, c.tenant_id
         FROM loans l JOIN customers c ON c.customer_id = l.customer_id
         WHERE l.customer_id = ? AND l.is_active = 1 ORDER BY l.created_at DESC`,
        [customerId]
      );

      const NOTIF_MAP: Record<string, { title: string; message: (ref: string) => string; type: string }> = {
        active: { title: "Loan Approved",           message: (ref) => `Your loan (${ref}) has been approved. View your payment schedule now.`, type: "approved" },
        denied: { title: "Loan Application Denied", message: (ref) => `Your loan application (${ref}) was not approved. Please contact your cooperative.`, type: "denied" },
        closed: { title: "Loan Fully Paid",          message: (ref) => `Congratulations! Your loan (${ref}) has been fully paid.`, type: "payment" },
      };

      for (const loan of rows) {
        const newStatus  = String(loan.status ?? "").toLowerCase();
        const tenantId   = loan.tenant_id ?? FALLBACK_TENANT_ID;
        const [cached]   = await pool.query<RowDataPacket[]>(
          `SELECT last_status FROM loan_status_cache WHERE loan_id = ? LIMIT 1`, [loan.loan_id]
        );
        const lastStatus = cached[0] ? String(cached[0].last_status).toLowerCase() : null;

        if (!lastStatus) {
          await pool.query(
            `INSERT INTO loan_status_cache (loan_id, last_status) VALUES (?, ?) ON DUPLICATE KEY UPDATE last_status = VALUES(last_status)`,
            [loan.loan_id, loan.status]
          );
          continue;
        }

        if (lastStatus !== newStatus) {
          // ── Update cache FIRST before sending email/notification ──────────
          // This prevents duplicate triggers when the frontend polls rapidly
          await pool.query(
            `INSERT INTO loan_status_cache (loan_id, last_status) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE last_status = VALUES(last_status)`,
            [loan.loan_id, loan.status]
          );

          const notif = NOTIF_MAP[newStatus];
          if (notif) await insertNotification(Number(customerId), tenantId, notif.title, notif.message(loan.reference_no), notif.type);

          try {
            const [custRows] = await pool.query<RowDataPacket[]>(
              `SELECT first_name, email FROM customers WHERE customer_id = ? LIMIT 1`,
              [customerId]
            );
            if (custRows.length > 0 && custRows[0].email) {
              await sendLoanStatusEmail(
                custRows[0].email,
                custRows[0].first_name,
                newStatus,
                loan.reference_no,
                Number(loan.principal_amount)
              );
            }
          } catch (emailErr: any) {
            console.warn('Status change email skipped:', emailErr.message);
          }
        }
      }

      res.json(rows.map(({ tenant_id: _tid, ...rest }) => rest));
    } catch (err: any) {
      console.error("Loans error:", err.message);
      res.status(500).json({ success: false, message: "Unable to retrieve loan records." });
    }
  });

  // ── Loans: Single Loan ────────────────────────────────────────────────────
  app.get("/api/loan/:loanId", async (req, res) => {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT loan_id, reference_no, principal_amount, interest_rate, payment_term,
                term_months, total_payable, amount_per_term, remaining_balance,
                status, due_date, denial_reason, notes, activated_at, created_at, is_active
         FROM loans WHERE loan_id = ? LIMIT 1`,
        [req.params.loanId]
      );
      if (rows.length === 0) return res.status(404).json({ success: false, message: "Loan not found." });
      res.json(rows[0]);
    } catch { res.status(500).json({ success: false, message: "Unable to retrieve loan details." }); }
  });

  // ── Loan Documents: Get by Loan ───────────────────────────────────────────
  app.get("/api/loan/:loanId/documents", async (req, res) => {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT document_id, loan_id, code, label, file_url, file_key, uploaded_at
         FROM loan_documents WHERE loan_id = ? ORDER BY uploaded_at ASC`,
        [req.params.loanId]
      );
      res.json(rows);
    } catch (err: any) {
      console.error("Loan documents error:", err.message);
      res.status(500).json({ success: false, message: "Unable to retrieve loan documents." });
    }
  });

  // ── Upload: Document to Railway S3 ────────────────────────────────────────
  app.post('/api/upload/document', upload.single('file'), async (req: any, res: any) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ success: false, message: 'No file provided.' });

      const tenant_id   = req.body.tenant_id   ?? 'unknown';
      const customer_id = req.body.customer_id ?? 'unknown';
      const folder      = req.body.folder      ?? 'documents';
      const code        = req.body.code        ?? 'DOCUMENT';
      const label       = req.body.label       ?? file.originalname;

      const key = `${tenant_id}/${customer_id}/${folder}/${Date.now()}-${file.originalname}`;

      const uploader = new Upload({
        client: s3,
        params: {
          Bucket:      BUCKET,
          Key:         key,
          Body:        file.buffer,
          ContentType: file.mimetype,
        },
      });

      await uploader.done();

      const fileUrl = `https://${BUCKET}.t3.storageapi.dev/${key}`;

      const loanIdRaw = req.body.loan_id;
      if (loanIdRaw && !isNaN(Number(loanIdRaw))) {
        try {
          const [metaRows]: any = await pool.query(
            `SELECT c.customer_no, l.reference_no
             FROM loans l
             JOIN customers c ON c.customer_id = l.customer_id
             WHERE l.loan_id = ? LIMIT 1`,
            [Number(loanIdRaw)]
          );
          const customer_no  = metaRows[0]?.customer_no  ?? null;
          const reference_no = metaRows[0]?.reference_no ?? null;

          await pool.query(
            `INSERT INTO loan_documents (loan_id, tenant_id, customer_id, customer_no, reference_no, code, label, file_url, file_key)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [Number(loanIdRaw), tenant_id, customer_id, customer_no, reference_no, code, label, fileUrl, key]
          );
        } catch (dbErr: any) {
          console.warn('[upload] DB insert skipped:', dbErr.message);
        }
      }

      return res.json({ success: true, url: fileUrl, key });
    } catch (err) {
      console.error('[upload/document]', err);
      return res.status(500).json({ success: false, message: 'Upload failed. Please try again.' });
    }
  });

  // ── S3: Presigned URL ─────────────────────────────────────────────────────
  app.get('/api/documents/signed-url', async (req: any, res: any) => {
    try {
      const key = String(req.query.key ?? '').trim();
      if (!key) return res.status(400).json({ success: false, message: 'File key is required.' });

      const command   = new GetObjectCommand({ Bucket: BUCKET, Key: key });
      const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

      return res.json({ success: true, url: signedUrl });
    } catch (err) {
      console.error('[signed-url]', err);
      return res.status(500).json({ success: false, message: 'Failed to generate signed URL.' });
    }
  });

  // ── Payments: List by Loan ────────────────────────────────────────────────
  app.get("/api/payments/:loanId", async (req, res) => {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT payment_id, loan_id, amount, payment_date, method, or_no, notes,
                COALESCE(created_at, payment_date) AS created_at
         FROM payments WHERE loan_id = ?
         ORDER BY COALESCE(created_at, payment_date) DESC, payment_id DESC`,
        [req.params.loanId]
      );
      res.json(rows);
    } catch { res.status(500).json({ success: false, message: "Unable to retrieve payment records." }); }
  });

  // ── Payments: All by Customer ─────────────────────────────────────────────
  app.get("/api/payments/customer/:customerId", async (req, res) => {
    try {
      const tenant_id = Number(req.query.tenant_id || 0);
      if (!tenant_id) return res.status(400).json({ success: false, message: "Cooperative is required." });

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT p.payment_id, p.loan_id, p.amount, p.method, p.or_no,
                p.notes, l.reference_no,
                COALESCE(p.created_at, p.payment_date) AS created_at
         FROM payments p
         JOIN loans l ON l.loan_id = p.loan_id
         JOIN customers c ON c.customer_id = l.customer_id
         WHERE l.customer_id = ? AND c.tenant_id = ?
         ORDER BY COALESCE(p.created_at, p.payment_date) DESC, p.payment_id DESC
         LIMIT 50`,
        [req.params.customerId, tenant_id]
      );
      res.json(rows);
    } catch (err: any) {
      console.error("Customer payments error:", err.message);
      res.status(500).json({ success: false, message: "Unable to retrieve payment records." });
    }
  });

  // ── Notifications: List ───────────────────────────────────────────────────
  app.get("/api/notifications/:customerId", async (req, res) => {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT notification_id, title, message, type, is_read, created_at
         FROM notifications WHERE customer_id = ? ORDER BY created_at DESC LIMIT 50`,
        [req.params.customerId]
      );
      res.json(rows);
    } catch { res.status(500).json({ success: false, message: "Unable to retrieve notifications." }); }
  });

  // ── Notifications: Mark All Read ──────────────────────────────────────────
  app.patch("/api/notifications/:customerId/read-all", async (req, res) => {
    try {
      await pool.query(
        `UPDATE notifications SET is_read = 1 WHERE customer_id = ? AND is_read = 0`,
        [req.params.customerId]
      );
      res.json({ success: true });
    } catch { res.status(500).json({ success: false, message: "Unable to update notifications." }); }
  });

  // ── Transactions ──────────────────────────────────────────────────────────
  app.get("/api/transactions/:customerId", async (req, res) => {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, loan_id, type, amount, date, status FROM transactions WHERE customer_id = ? ORDER BY date DESC`,
        [req.params.customerId]
      );
      res.json(rows);
    } catch { res.status(500).json({ success: false, message: "Unable to retrieve transactions." }); }
  });

  // ── PayMongo: Create Checkout Session ─────────────────────────────────────
  app.post("/api/paymongo/checkout", async (req, res) => {
    try {
      const { amount, description, reference_no, success_url, cancel_url, billing_name, billing_email, billing_phone } = req.body;
      if (!amount || !success_url || !cancel_url)
        return res.status(400).json({ success: false, message: "amount, success_url and cancel_url are required." });

      const desc = description || "Loan Payment";
      const response = await fetch("https://api.paymongo.com/v1/checkout_sessions", {
        method: "POST",
        headers: PAYMONGO_HEADERS,
        body: JSON.stringify({
          data: {
            attributes: {
              send_email_receipt:   false,
              show_description:     true,
              show_line_items:      true,
              line_items: [{
                currency:    "PHP",
                amount:      Math.round(Number(amount) * 100),
                name:        desc,
                description: desc,
                quantity:    1,
              }],
              payment_method_types: [
                "card", "gcash", "paymaya", "qrph",
                "grab_pay", "dob", "dob_ubp",
                "brankas_bdo", "brankas_landbank", "brankas_metrobank",
              ],
              description:      desc,
              reference_number: reference_no || "",
              success_url,
              cancel_url,
              ...(billing_name || billing_email || billing_phone
                ? { billing: { name: billing_name || "", email: billing_email || "", phone: billing_phone || "" } }
                : {}),
            },
          },
        }),
      });

      const data = await response.json();
      if (!response.ok)
        return res.status(400).json({ success: false, message: data.errors?.[0]?.detail || "Failed to create checkout session." });

      res.json({ success: true, checkout_url: data.data.attributes.checkout_url, session_id: data.data.id });
    } catch (err: any) {
      console.error("PayMongo checkout error:", err.message);
      res.status(500).json({ success: false, message: "Payment service unavailable. Please try again." });
    }
  });

  // ── PayMongo: Get Checkout Session Status ─────────────────────────────────
  app.get("/api/paymongo/checkout-status/:sessionId", async (req, res) => {
    try {
      const response = await fetch(
        `https://api.paymongo.com/v1/checkout_sessions/${req.params.sessionId}`,
        { headers: PAYMONGO_HEADERS }
      );
      const data = await response.json();
      if (!response.ok)
        return res.status(400).json({ success: false, message: data.errors?.[0]?.detail || "Failed to retrieve session." });

      const attrs                = data.data.attributes;
      const sessionPaymentStatus = attrs.payment_status ?? "unpaid";
      const payment              = attrs.payments?.[0];
      const rawMethod            = payment?.attributes?.payment_method_type
        ?? payment?.attributes?.source?.type
        ?? payment?.payment_method_type
        ?? attrs.payment_method_type
        ?? "other";
      const normalizedMethod = normalizeMethod(rawMethod);

      const lineItemsTotal = Array.isArray(attrs.line_items)
        ? attrs.line_items.reduce((sum: number, item: any) => sum + (item.amount ?? 0), 0) / 100
        : null;
      const paymentAmount  = payment?.attributes?.amount
        ? payment.attributes.amount / 100
        : payment?.amount ? payment.amount / 100 : null;
      const resolvedAmount = lineItemsTotal ?? paymentAmount;

      res.json({
        success:             true,
        payment_status:      sessionPaymentStatus,
        session_status:      attrs.status,
        payment_method_type: rawMethod,
        method:              normalizedMethod,
        payment_id:          payment?.id ?? null,
        amount:              resolvedAmount,
      });
    } catch (err: any) {
      console.error("Checkout status error:", err.message);
      res.status(500).json({ success: false, message: "Payment service unavailable." });
    }
  });

  // ── PayMongo: Create Source (GCash QR in-app) ─────────────────────────────
  app.post("/api/paymongo/source", async (req, res) => {
    try {
      const { amount, type, reference_no, billing_name, billing_email, billing_phone, redirect_success, redirect_failed } = req.body;
      if (!amount || !type)
        return res.status(400).json({ success: false, message: "amount and type are required." });

      const response = await fetch("https://api.paymongo.com/v1/sources", {
        method: "POST",
        headers: PAYMONGO_HEADERS,
        body: JSON.stringify({
          data: {
            attributes: {
              amount:   Math.round(Number(amount) * 100),
              currency: "PHP",
              type,
              redirect: {
                success: redirect_success || "https://credencelend-mobile.up.railway.app/payment-success",
                failed:  redirect_failed  || "https://credencelend-mobile.up.railway.app/payment-failed",
              },
              billing: {
                name:  billing_name  || "",
                email: billing_email || "",
                phone: billing_phone || "",
              },
            },
          },
        }),
      });

      const data = await response.json();
      if (!response.ok)
        return res.status(400).json({ success: false, message: data.errors?.[0]?.detail || "Failed to create source." });

      res.json({ success: true, source: data.data });
    } catch (err: any) {
      console.error("PayMongo source error:", err.message);
      res.status(500).json({ success: false, message: "Payment service unavailable." });
    }
  });

  // ── PayMongo: Get Source Status ───────────────────────────────────────────
  app.get("/api/paymongo/source/:sourceId", async (req, res) => {
    try {
      const response = await fetch(
        `https://api.paymongo.com/v1/sources/${req.params.sourceId}`,
        { headers: PAYMONGO_HEADERS }
      );
      const data = await response.json();
      if (!response.ok)
        return res.status(400).json({ success: false, message: data.errors?.[0]?.detail || "Failed to retrieve source." });
      res.json({ success: true, source: data.data });
    } catch (err: any) {
      console.error("PayMongo source status error:", err.message);
      res.status(500).json({ success: false, message: "Payment service unavailable." });
    }
  });

  // ── PayMongo: Create Payment Intent (Card) ────────────────────────────────
  app.post("/api/paymongo/intent", async (req, res) => {
    try {
      const { amount, description } = req.body;
      if (!amount)
        return res.status(400).json({ success: false, message: "amount is required." });

      const response = await fetch("https://api.paymongo.com/v1/payment_intents", {
        method: "POST",
        headers: PAYMONGO_HEADERS,
        body: JSON.stringify({
          data: {
            attributes: {
              amount:                 Math.round(Number(amount) * 100),
              currency:               "PHP",
              payment_method_allowed: ["card"],
              description:            description || "Loan Payment",
              capture_type:           "automatic",
            },
          },
        }),
      });

      const data = await response.json();
      if (!response.ok)
        return res.status(400).json({ success: false, message: data.errors?.[0]?.detail || "Failed to create payment intent." });

      res.json({ success: true, intent: data.data });
    } catch (err: any) {
      console.error("PayMongo intent error:", err.message);
      res.status(500).json({ success: false, message: "Payment service unavailable." });
    }
  });

  // ── PayMongo: Create Payment Method (Card) ────────────────────────────────
  app.post("/api/paymongo/payment-method", async (req, res) => {
    try {
      const { card_number, exp_month, exp_year, cvc, name } = req.body;
      if (!card_number || !exp_month || !exp_year || !cvc)
        return res.status(400).json({ success: false, message: "Card details are required." });

      const response = await fetch("https://api.paymongo.com/v1/payment_methods", {
        method: "POST",
        headers: PAYMONGO_HEADERS,
        body: JSON.stringify({
          data: {
            attributes: {
              type: "card",
              details: {
                card_number: String(card_number).replace(/\s/g, ""),
                exp_month:   Number(exp_month),
                exp_year:    Number(exp_year),
                cvc:         String(cvc),
              },
              billing: { name: name || "" },
            },
          },
        }),
      });

      const data = await response.json();
      if (!response.ok)
        return res.status(400).json({ success: false, message: data.errors?.[0]?.detail || "Failed to create payment method." });

      res.json({ success: true, payment_method: data.data });
    } catch (err: any) {
      console.error("PayMongo payment method error:", err.message);
      res.status(500).json({ success: false, message: "Payment service unavailable." });
    }
  });

  // ── PayMongo: Attach Payment Method to Intent ─────────────────────────────
  app.post("/api/paymongo/attach", async (req, res) => {
    try {
      const { intent_id, payment_method_id, client_key, return_url } = req.body;
      if (!intent_id || !payment_method_id)
        return res.status(400).json({ success: false, message: "intent_id and payment_method_id are required." });

      const response = await fetch(
        `https://api.paymongo.com/v1/payment_intents/${intent_id}/attach`,
        {
          method: "POST",
          headers: PAYMONGO_HEADERS,
          body: JSON.stringify({
            data: {
              attributes: {
                payment_method: payment_method_id,
                client_key:     client_key || "",
                return_url:     return_url || "https://credencelend-mobile.up.railway.app/payment-success",
              },
            },
          }),
        }
      );

      const data = await response.json();
      if (!response.ok)
        return res.status(400).json({ success: false, message: data.errors?.[0]?.detail || "Failed to attach payment method." });

      res.json({ success: true, intent: data.data });
    } catch (err: any) {
      console.error("PayMongo attach error:", err.message);
      res.status(500).json({ success: false, message: "Payment service unavailable." });
    }
  });

  // ── PayMongo: Record Payment ──────────────────────────────────────────────
  app.post("/api/paymongo/record-payment", async (req, res) => {
    try {
      const {
        loan_id, amount, method,
        paymongo_source_id, paymongo_intent_id,
        paymongo_session_id, paymongo_method_type,
        paymongo_payment_id,
      } = req.body;

      if (!loan_id || !amount || !method)
        return res.status(400).json({ success: false, message: "Missing required fields." });

      const rawType          = paymongo_method_type ?? method;
      const normalizedMethod = normalizeMethod(String(rawType));

      const pmId  = paymongo_session_id ?? paymongo_source_id ?? paymongo_intent_id;
      const or_no = pmId ? `OR-PM-${String(pmId).slice(-8).toUpperCase()}` : `OR-${Date.now()}`;

      // ── Strong idempotency: check or_no first, then all PayMongo refs ─────
      const [existingByOrNo] = await pool.query<RowDataPacket[]>(
        `SELECT payment_id FROM payments WHERE or_no = ? LIMIT 1`, [or_no]
      );
      if (existingByOrNo.length > 0)
        return res.json({ success: true, payment_id: existingByOrNo[0].payment_id, message: "Payment already recorded." });

      for (const pmRef of [paymongo_session_id, paymongo_source_id, paymongo_intent_id, paymongo_payment_id].filter(Boolean)) {
        const [existing] = await pool.query<RowDataPacket[]>(
          `SELECT payment_id FROM payments WHERE notes LIKE ? LIMIT 1`, [`%${pmRef}%`]
        );
        if (existing.length > 0)
          return res.json({ success: true, payment_id: existing[0].payment_id, message: "Payment already recorded." });
      }

      const [loanRows] = await pool.query<RowDataPacket[]>(
        `SELECT l.loan_id, l.customer_id, l.remaining_balance, l.amount_per_term,
                COALESCE(l.tenant_id, c.tenant_id, ?) AS tenant_id
         FROM loans l JOIN customers c ON c.customer_id = l.customer_id
         WHERE l.loan_id = ? LIMIT 1`,
        [FALLBACK_TENANT_ID, loan_id]
      );
      if (loanRows.length === 0)
        return res.status(404).json({ success: false, message: "Loan not found." });

      const loan        = loanRows[0];
      const payAmount   = Number(amount);
      const newBalance  = Math.max(0, Number(loan.remaining_balance) - payAmount);
      const isFullyPaid = newBalance <= 0;

      const isGcashMethod      = normalizedMethod === "GCASH";
      const pmRef              = paymongo_payment_id ?? paymongo_session_id ?? paymongo_source_id ?? paymongo_intent_id ?? null;
      const gcash_reference_no = isGcashMethod ? pmRef : null;
      const bank_reference_no  = isGcashMethod ? null  : pmRef;
      const notes              = `Online Payment via PayMongo (${normalizedMethod})`;

      const [payResult] = await pool.query<ResultSetHeader>(
        `INSERT INTO payments (loan_id, amount, payment_date, method, status, notes, tenant_id, or_no, gcash_reference_no, bank_reference_no)
         VALUES (?, ?, CURDATE(), ?, 'Paid', ?, ?, ?, ?, ?)`,
        [loan_id, payAmount, normalizedMethod, notes, loan.tenant_id, or_no, gcash_reference_no, bank_reference_no]
      );

      await pool.query(
        `UPDATE loans
         SET remaining_balance = ?,
             status    = IF(? <= 0, 'CLOSED', status),
             closed_at = IF(? <= 0, NOW(), closed_at)
         WHERE loan_id = ?`,
        [newBalance, newBalance, newBalance, loan_id]
      );

      await insertNotification(
        loan.customer_id, Number(loan.tenant_id) || FALLBACK_TENANT_ID,
        isFullyPaid ? "Loan Fully Paid" : "Payment Received",
        isFullyPaid
          ? "Congratulations! Your loan has been fully paid. Thank you!"
          : `Your payment of ₱${payAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} has been received and is being processed.`,
        "payment"
      );

      // ── Only send payment email for partial payments ──────────────────────
      // Fully paid email is handled by sendLoanStatusEmail on status change
      if (!isFullyPaid) {
        try {
          const [customerRows] = await pool.query<RowDataPacket[]>(
            `SELECT first_name, email FROM customers WHERE customer_id = ? LIMIT 1`,
            [loan.customer_id]
          );
          if (customerRows.length > 0 && customerRows[0].email) {
            await sendPaymentEmail(
              customerRows[0].email,
              customerRows[0].first_name,
              payAmount,
              newBalance,
              or_no,
              normalizedMethod,
              false
            );
          }
        } catch (emailErr: any) {
          console.warn("Payment email skipped:", emailErr.message);
        }
      }

      res.json({
        success:         true,
        payment_id:      payResult.insertId,
        pm_payment_id:   paymongo_payment_id ?? null,
        new_balance:     newBalance,
        fully_paid:      isFullyPaid,
        method:          normalizedMethod,
        or_no,
        amount_per_term: Number(loan.amount_per_term) || null,
        message:         isFullyPaid ? "Loan fully paid!" : "Payment recorded successfully.",
      });
    } catch (err: any) {
      console.error("Record payment error:", err.message);
      res.status(500).json({ success: false, message: "Failed to record payment. Please contact support." });
    }
  });

  // ── Static / Vite ─────────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[server] Running on http://localhost:${PORT} (${process.env.NODE_ENV ?? "development"})`);
  });
}

startServer().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});