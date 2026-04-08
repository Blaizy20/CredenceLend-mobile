import cors from "cors";
import bcrypt from "bcrypt";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import mysql, { RowDataPacket } from "mysql2/promise";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── MySQL Pool ────────────────────────────────────────────────────────────────
const pool = mysql.createPool({
  host:               process.env.DB_HOST,
  port:               Number(process.env.DB_PORT),
  database:           process.env.DB_NAME,
  user:               process.env.DB_USER,
  password:           process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit:    10,
  ssl:                { rejectUnauthorized: false },
});

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  app.use(cors({
    origin: [
      "https://localhost",
      "http://localhost:3000",
      "capacitor://localhost",
      "https://your-app.up.railway.app", // 👈 replace with your actual Railway URL
    ],
    credentials: true,
  }));

  // ── Health ──────────────────────────────────────────────────────────────────
  app.get("/api/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok", database: "connected ✅" });
    } catch (err: any) {
      res.status(500).json({ status: "error", database: "disconnected ❌", error: err.message });
    }
  });

  // ── Auth: Login ─────────────────────────────────────────────────────────────
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password)
        return res.status(400).json({ success: false, message: "Username and password required" });

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT customer_id, tenant_id, user_id, username, password,
                customer_no, first_name, last_name, contact_no, email,
                province, city, barangay, street, created_at, is_active
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

      const { password: _pw, ...safeCustomer } = customer;
      res.json({ success: true, customer: safeCustomer });

    } catch (err: any) {
      console.error("Login error:", err.message);
      res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
  });

  // ── Auth: Send OTP ──────────────────────────────────────────────────────────
  app.post("/api/auth/send-otp", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email)
        return res.status(400).json({ success: false, message: "Email is required" });

      const [customers] = await pool.query<RowDataPacket[]>(
        "SELECT customer_id FROM customers WHERE email = ? AND is_active = 1 LIMIT 1",
        [email]
      );

      if (customers.length === 0)
        return res.status(404).json({ success: false, message: "Email not found" });

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 10 * 60 * 1000;

      await pool.query(
        "REPLACE INTO otps (email, otp, expires_at) VALUES (?, ?, ?)",
        [email, otp, expiresAt]
      );

      console.log(`[OTP] ${email} → ${otp}`);
      res.json({ success: true, message: "OTP sent successfully" });

    } catch (err: any) {
      console.error("Send OTP error:", err.message);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // ── Auth: Verify OTP ────────────────────────────────────────────────────────
  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const { email, otp } = req.body;

      if (!email || !otp)
        return res.status(400).json({ success: false, message: "Email and OTP are required" });

      const now = Date.now();

      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT * FROM otps WHERE email = ? AND otp = ? AND expires_at > ? LIMIT 1",
        [email, otp, now]
      );

      if (rows.length === 0)
        return res.status(400).json({ success: false, message: "Invalid or expired OTP" });

      await pool.query("DELETE FROM otps WHERE email = ?", [email]);
      res.json({ success: true, message: "OTP verified" });

    } catch (err: any) {
      console.error("Verify OTP error:", err.message);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // ── Profile ─────────────────────────────────────────────────────────────────
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
        return res.status(404).json({ message: "Customer not found" });

      res.json(rows[0]);

    } catch (err: any) {
      console.error("Profile error:", err.message);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // ── Loans ───────────────────────────────────────────────────────────────────
  app.get("/api/loans/:customerId", async (req, res) => {
    try {
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

    } catch (err: any) {
      console.error("Loans error:", err.message);
      res.status(500).json({ success: false, message: "Server error" });
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
        return res.status(404).json({ message: "Loan not found" });

      res.json(rows[0]);

    } catch (err: any) {
      console.error("Loan error:", err.message);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // ── Payments ─────────────────────────────────────────────────────────────────
  app.get("/api/payments/:loanId", async (req, res) => {
    try {
      const [rows] = await pool.query(
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
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // ── Transactions ─────────────────────────────────────────────────────────────
  app.get("/api/transactions/:customerId", async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT id, loan_id, type, amount, date, status
         FROM transactions
         WHERE customer_id = ?
         ORDER BY date DESC`,
        [req.params.customerId]
      );
      res.json(rows);

    } catch (err: any) {
      console.error("Transactions error:", err.message);
      res.status(500).json({ success: false, message: "Server error" });
    }
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