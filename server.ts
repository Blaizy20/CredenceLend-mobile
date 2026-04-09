import cors from "cors";
import bcrypt from "bcrypt";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import mysql, { ResultSetHeader, RowDataPacket } from "mysql2/promise";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const DEFAULT_TENANT_ID = Number(process.env.DEFAULT_TENANT_ID || 1);

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: { rejectUnauthorized: false },
});

type CustomerRow = RowDataPacket & {
  customer_id: number;
  tenant_id: number | null;
  user_id: number | null;
  username: string;
  password: string;
  customer_no: string;
  first_name: string;
  last_name: string;
  contact_no: string | null;
  email: string | null;
  province: string | null;
  city: string | null;
  barangay: string | null;
  street: string | null;
  created_at: string;
  is_active: number;
};

function getNextCustomerNo(lastCustomerNo: string | null, year: number) {
  if (!lastCustomerNo) return `CUST-${year}-0001`;
  const parts = lastCustomerNo.split("-");
  const lastSeq = Number(parts[2] || 0);
  return `CUST-${year}-${String(lastSeq + 1).padStart(4, "0")}`;
}

async function startServer() {
  const app = express();

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.use(cors({ origin: true, credentials: true }));

  // ── Health ────────────────────────────────────────────────────────────────
  app.get("/api/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok", database: "connected ✅" });
    } catch (err: any) {
      console.error("Health error:", err.message);
      res.status(500).json({
        status: "error",
        database: "disconnected ❌",
        error: err.message,
      });
    }
  });

  // ── Availability Checks ───────────────────────────────────────────────────
  app.get("/api/auth/check-username", async (req, res) => {
    try {
      const username = String(req.query.username || "").trim();
      if (!username)
        return res.status(400).json({ taken: false, message: "Username is required." });
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT customer_id FROM customers WHERE username = ? LIMIT 1",
        [username]
      );
      res.json({ taken: rows.length > 0 });
    } catch (err: any) {
      console.error("Check username error:", err.message);
      res.status(500).json({ taken: false, message: "An unexpected error occurred. Please try again." });
    }
  });

  app.get("/api/auth/check-email", async (req, res) => {
    try {
      const email = String(req.query.email || "").trim();
      if (!email)
        return res.status(400).json({ taken: false, message: "Email address is required." });
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT customer_id FROM customers WHERE email = ? LIMIT 1",
        [email]
      );
      res.json({ taken: rows.length > 0 });
    } catch (err: any) {
      console.error("Check email error:", err.message);
      res.status(500).json({ taken: false, message: "An unexpected error occurred. Please try again." });
    }
  });

  app.get("/api/auth/check-contact", async (req, res) => {
    try {
      const contactNo = String(req.query.contactNo || "").trim();
      if (!contactNo)
        return res.status(400).json({ taken: false, message: "Contact number is required." });
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT customer_id FROM customers WHERE contact_no = ? LIMIT 1",
        [contactNo]
      );
      res.json({ taken: rows.length > 0 });
    } catch (err: any) {
      console.error("Check contact error:", err.message);
      res.status(500).json({ taken: false, message: "An unexpected error occurred. Please try again." });
    }
  });

  // ── Auth: Send OTP ────────────────────────────────────────────────────────
  app.post("/api/auth/send-otp", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email)
        return res.status(400).json({ success: false, message: "Please provide your email address." });

      const [customers] = await pool.query<RowDataPacket[]>(
        "SELECT customer_id FROM customers WHERE email = ? AND is_active = 1 LIMIT 1",
        [email]
      );
      if (customers.length === 0)
        return res.status(404).json({
          success: false,
          message: "No account is associated with this email address.",
        });

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 10 * 60 * 1000;

      await pool.query(
        "REPLACE INTO otps (email, otp, expires_at) VALUES (?, ?, ?)",
        [email, otp, expiresAt]
      );

      console.log(`[OTP] ${email} → ${otp}`);
      res.json({ success: true, message: "A verification code has been sent to your email." });
    } catch (err: any) {
      console.error("Send OTP error:", err.message);
      res.status(500).json({ success: false, message: "An unexpected error occurred. Please try again." });
    }
  });

  // ── Auth: Verify OTP ──────────────────────────────────────────────────────
  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const { email, otp } = req.body;
      if (!email || !otp)
        return res.status(400).json({
          success: false,
          message: "Email address and verification code are required.",
        });

      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT * FROM otps WHERE email = ? AND otp = ? AND expires_at > ? LIMIT 1",
        [email, otp, Date.now()]
      );
      if (rows.length === 0)
        return res.status(400).json({
          success: false,
          message: "The verification code is invalid or has already expired. Please request a new one.",
        });

      await pool.query("DELETE FROM otps WHERE email = ?", [email]);
      res.json({ success: true, message: "Verification successful." });
    } catch (err: any) {
      console.error("Verify OTP error:", err.message);
      res.status(500).json({ success: false, message: "An unexpected error occurred. Please try again." });
    }
  });

  // ── Auth: Register ────────────────────────────────────────────────────────
  app.post("/api/auth/register", async (req, res) => {
    try {
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

      if (!first_name || !last_name || !username || !contact_no ||
          !email || !password || !province || !city || !barangay || !street)
        return res.status(400).json({
          success: false,
          message: "All fields are required. Please complete the registration form.",
        });

      if (!/^09\d{9}$/.test(contact_no))  // 👈 fixed regex (was \\d)
        return res.status(400).json({
          success: false,
          message: "Please enter a valid Philippine mobile number (e.g. 09XXXXXXXXX).",
        });

      if (!/\S+@\S+\.\S+/.test(email))    // 👈 fixed regex (was \\S)
        return res.status(400).json({
          success: false,
          message: "Please enter a valid email address.",
        });

      const [duplicateRows] = await pool.query<RowDataPacket[]>(
        `SELECT customer_id, username, email, contact_no
         FROM customers
         WHERE username = ? OR email = ? OR contact_no = ?
         LIMIT 1`,
        [username, email, contact_no]
      );

      if (duplicateRows.length > 0) {
        const dup = duplicateRows[0];
        if (dup.username === username)
          return res.status(409).json({
            success: false,
            message: "This username is already taken. Please choose a different one.",
          });
        if (dup.email === email)
          return res.status(409).json({
            success: false,
            message: "An account with this email address already exists.",
          });
        if (dup.contact_no === contact_no)
          return res.status(409).json({
            success: false,
            message: "An account with this contact number already exists.",
          });
      }

      const year = new Date().getFullYear();
      const [lastCustomerRows] = await pool.query<RowDataPacket[]>(
        `SELECT customer_no FROM customers
         WHERE customer_no LIKE ?
         ORDER BY customer_id DESC LIMIT 1`,
        [`CUST-${year}-%`]
      );

      const lastCustomerNo = lastCustomerRows.length > 0
        ? String(lastCustomerRows[0].customer_no)
        : null;

      const customer_no    = getNextCustomerNo(lastCustomerNo, year);
      const hashedPassword = await bcrypt.hash(password, 10);

      const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO customers
          (tenant_id, username, password, customer_no, first_name, last_name,
           contact_no, email, province, city, barangay, street, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [DEFAULT_TENANT_ID, username, hashedPassword, customer_no,
         first_name, last_name, contact_no, email,
         province, city, barangay, street]
      );

      res.status(201).json({
        success: true,
        message: "Your account has been successfully created.",
        customer: {
          customer_id: result.insertId,
          tenant_id: DEFAULT_TENANT_ID,
          username, customer_no, first_name, last_name,
          contact_no, email, province, city, barangay, street,
          is_active: 1,
        },
      });
    } catch (err: any) {
      console.error("Register error:", err);
      res.status(500).json({
        success: false,
        message: "An unexpected error occurred during registration. Please try again.",
        error: err.message,
        code: err.code,
      });
    }
  });

  // ── Auth: Login ───────────────────────────────────────────────────────────
  app.post("/api/auth/login", async (req, res) => {
    try {
      const usernameOrEmail = String(req.body.username ?? req.body.email ?? "").trim();
      const password        = String(req.body.password ?? "");

      if (!usernameOrEmail || !password)
        return res.status(400).json({
          success: false,
          message: "Please enter your username and password to continue.",
        });

      const [rows] = await pool.query<CustomerRow[]>(
        `SELECT customer_id, tenant_id, user_id, username, password,
                customer_no, first_name, last_name, contact_no, email,
                province, city, barangay, street, created_at, is_active
         FROM customers
         WHERE (username = ? OR email = ?) AND is_active = 1
         LIMIT 1`,
        [usernameOrEmail, usernameOrEmail]
      );

      if (rows.length === 0)
        return res.status(401).json({
          success: false,
          message: "The username or password you entered is incorrect. Please try again.",
        });

      const customer = rows[0];
      const match    = await bcrypt.compare(password, customer.password);

      if (!match)
        return res.status(401).json({
          success: false,
          message: "The username or password you entered is incorrect. Please try again.",
        });

      const { password: _pw, ...safeCustomer } = customer;
      res.json({ success: true, customer: safeCustomer });
    } catch (err: any) {
      console.error("Login error:", err.message);
      res.status(500).json({
        success: false,
        message: "An unexpected error occurred. Please try again later.",
        error: err.message,
      });
    }
  });

  // ── Profile ───────────────────────────────────────────────────────────────
  app.get("/api/profile/:customerId", async (req, res) => {
    try {
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
        return res.status(404).json({ success: false, message: "Customer account not found." });
      res.json(rows[0]);
    } catch (err: any) {
      console.error("Profile error:", err.message);
      res.status(500).json({ success: false, message: "An unexpected error occurred. Please try again." });
    }
  });

  // ── Loans ─────────────────────────────────────────────────────────────────
  app.get("/api/loans/:customerId", async (req, res) => {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT loan_id, reference_no, principal_amount, interest_rate,
                payment_term, term_months, total_payable, remaining_balance,
                status, due_date, activated_at, created_at, is_active
         FROM loans
         WHERE customer_id = ? AND is_active = 1
         ORDER BY created_at DESC`,
        [req.params.customerId]
      );
      res.json(rows);
    } catch (err: any) {
      console.error("Loans error:", err.message);
      res.status(500).json({ success: false, message: "Unable to retrieve loan records. Please try again." });
    }
  });

  app.get("/api/loan/:loanId", async (req, res) => {
    try {
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
        return res.status(404).json({ success: false, message: "Loan record not found." });
      res.json(rows[0]);
    } catch (err: any) {
      console.error("Loan error:", err.message);
      res.status(500).json({ success: false, message: "Unable to retrieve loan details. Please try again." });
    }
  });

  // ── Payments ──────────────────────────────────────────────────────────────
  app.get("/api/payments/:loanId", async (req, res) => {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT payment_id, loan_id, amount, payment_date, method,
                or_no, notes, created_at
         FROM payments
         WHERE loan_id = ?
         ORDER BY payment_date DESC`,
        [req.params.loanId]
      );
      res.json(rows);
    } catch (err: any) {
      console.error("Payments error:", err.message);
      res.status(500).json({ success: false, message: "Unable to retrieve payment records. Please try again." });
    }
  });

  // ── Transactions ──────────────────────────────────────────────────────────
  app.get("/api/transactions/:customerId", async (req, res) => {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, loan_id, type, amount, date, status
         FROM transactions
         WHERE customer_id = ?
         ORDER BY date DESC`,
        [req.params.customerId]
      );
      res.json(rows);
    } catch (err: any) {
      console.error("Transactions error:", err.message);
      res.status(500).json({ success: false, message: "Unable to retrieve transaction history. Please try again." });
    }
  });

  // ── Static / Vite ─────────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});