import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import mysql, { RowDataPacket } from "mysql2/promise";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── MySQL Connection Pool ─────────────────────────────────────────────────────
const pool = mysql.createPool({
  host:               process.env.DB_HOST,
  port:               Number(process.env.DB_PORT),
  database:           process.env.DB_NAME,
  user:               process.env.DB_USER,
  password:           process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
});

// ── Server ────────────────────────────────────────────────────────────────────
async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Nodemailer — replace with real SMTP when ready
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.ethereal.email",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER || "placeholder@ethereal.email",
      pass: process.env.SMTP_PASS || "placeholder_pass",
    },
  });

  // ── Health ──────────────────────────────────────────────────────────────────
  app.get("/api/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok", database: "connected" });
    } catch {
      res.status(500).json({ status: "error", database: "disconnected" });
    }
  });

  // ── Auth: Login ─────────────────────────────────────────────────────────────
  // Uses: customers table
  // Columns confirmed: customer_id, tenant_id, username, password, first_name,
  //   last_name, email, contact_no, customer_no, is_active
  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password)
      return res.status(400).json({ success: false, message: "Username and password required" });

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT customer_id, tenant_id, username, password, first_name, last_name,
              email, contact_no, customer_no, is_active
       FROM customers
       WHERE username = ? AND is_active = 1
       LIMIT 1`,
      [username]
    );

    if (rows.length === 0)
      return res.status(401).json({ success: false, message: "Invalid credentials" });

    const customer = rows[0];
    const match = await bcrypt.compare(password, customer.password);

    if (!match)
      return res.status(401).json({ success: false, message: "Invalid credentials" });

    // Never send password back to the client
    const { password: _pw, ...safeCustomer } = customer;
    res.json({ success: true, customer: safeCustomer });
  });

  // ── Auth: Send OTP ──────────────────────────────────────────────────────────
  // ✅ CONFIRMED: otps → email (PK), otp, expires_at (BIGINT ms)
  app.post("/api/auth/send-otp", async (req, res) => {
    const { email } = req.body;

    const [customers] = await pool.query<RowDataPacket[]>(
      "SELECT customer_id FROM customers WHERE email = ? AND is_active = 1 LIMIT 1",
      [email]
    );

    if (customers.length === 0)
      return res.status(404).json({ success: false, message: "Email not found" });

    const otp        = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAtMs = Date.now() + 10 * 60 * 1000; // bigint milliseconds

    // REPLACE INTO handles email PK — replaces existing OTP if one exists
    await pool.query(
      "REPLACE INTO otps (email, otp, expires_at) VALUES (?, ?, ?)",
      [email, otp, expiresAtMs]
    );

    console.log(`[OTP] ${email} → ${otp}`);

    // Uncomment to actually send email:
    // await transporter.sendMail({
    //   from: '"LoanApp" <no-reply@loanapp.com>',
    //   to: email,
    //   subject: "Your Verification Code",
    //   text: `Your verification code is: ${otp}. It expires in 10 minutes.`,
    // });

    res.json({ success: true, message: "OTP sent successfully" });
  });

  // ── Auth: Verify OTP ────────────────────────────────────────────────────────
  // ✅ CONFIRMED: otps → email (PK), otp, expires_at (BIGINT ms)
  app.post("/api/auth/verify-otp", async (req, res) => {
    const { email, otp } = req.body;

    const [customers] = await pool.query<RowDataPacket[]>(
      "SELECT customer_id FROM customers WHERE email = ? AND is_active = 1 LIMIT 1",
      [email]
    );

    if (customers.length === 0)
      return res.status(404).json({ success: false, message: "Email not found" });

    const now = Date.now(); // compare bigint milliseconds

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM otps WHERE email = ? AND otp = ? AND expires_at > ? LIMIT 1`,
      [email, otp, now]
    );

    if (rows.length === 0)
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });

    // Delete after use — email is PK, no is_used column
    await pool.query("DELETE FROM otps WHERE email = ?", [email]);

    res.json({ success: true, message: "OTP verified" });
  });

  // ── Profile ─────────────────────────────────────────────────────────────────
  // Columns confirmed: all customers columns except password
  app.get("/api/profile/:customerId", async (req, res) => {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT customer_id, tenant_id, user_id, username, customer_no,
              first_name, last_name, contact_no, email,
              province, city, barangay, street, created_at, is_active
       FROM customers
       WHERE customer_id = ? AND is_active = 1
       LIMIT 1`,
      [req.params.customerId]
    );

    if (rows.length === 0)
      return res.status(404).json({ message: "Customer not found" });

    res.json(rows[0]);
  });

  // ── Loans ───────────────────────────────────────────────────────────────────
  // Columns confirmed: loan_id, tenant_id, reference_no, customer_id,
  //   principal_amount, interest_rate, payment_term, term_months,
  //   total_payable, remaining_balance, status, due_date,
  //   activated_at, created_at, updated_at, is_active
  app.get("/api/loans/:customerId", async (req, res) => {
    const [rows] = await pool.query(
      `SELECT loan_id, reference_no, principal_amount, interest_rate,
              payment_term, term_months, total_payable, remaining_balance,
              status, due_date, activated_at, created_at, is_active
       FROM loans
       WHERE customer_id = ? AND is_active = 1
       ORDER BY created_at DESC`,
      [req.params.customerId]
    );
    res.json(rows);
  });

  app.get("/api/loan/:loanId", async (req, res) => {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT loan_id, reference_no, principal_amount, interest_rate,
              payment_term, term_months, total_payable, remaining_balance,
              status, due_date, denial_reason, notes,
              activated_at, created_at, is_active
       FROM loans
       WHERE loan_id = ?
       LIMIT 1`,
      [req.params.loanId]
    );

    if (rows.length === 0)
      return res.status(404).json({ message: "Loan not found" });

    res.json(rows[0]);
  });

  // ── Payments ────────────────────────────────────────────────────────────────
  // Columns confirmed: payment_id, tenant_id, loan_id, amount,
  //   payment_date, method, or_no, notes, created_at, updated_at
  app.get("/api/payments/:loanId", async (req, res) => {
    const [rows] = await pool.query(
      `SELECT payment_id, loan_id, amount, payment_date, method,
              or_no, notes, created_at
       FROM payments
       WHERE loan_id = ?
       ORDER BY payment_date DESC`,
      [req.params.loanId]
    );
    res.json(rows);
  });

  // ── Transactions ────────────────────────────────────────────────────────────
  // ✅ CONFIRMED: transactions → id, customer_id, loan_id, type, amount, date, status
  app.get("/api/transactions/:customerId", async (req, res) => {
    const [rows] = await pool.query(
      `SELECT id, loan_id, type, amount, date, status
       FROM transactions
       WHERE customer_id = ?
       ORDER BY date DESC`,
      [req.params.customerId]
    );
    res.json(rows);
  });

  // ── Vite / Static ───────────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
