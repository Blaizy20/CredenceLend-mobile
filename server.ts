import cors from "cors";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, "db.json");

// ── DB Helpers ────────────────────────────────────────────────────────────────
const DEFAULT_DB = { users: [], loans: [], transactions: [], otps: [] };

const getDB = () => {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
};
const saveDB = (data: any) => fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  app.use(cors({
    origin: [
      "https://localhost",
      "http://localhost:3000",
      "capacitor://localhost",
      "https://credencelend-mobile-production.up.railway.app", // 👈 replace with your actual Railway URL
    ],
    credentials: true,
  }));

  const transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: "placeholder@ethereal.email",
      pass: "placeholder_pass",
    },
  });

  // ── Health ──────────────────────────────────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // ── Auth: Send OTP ──────────────────────────────────────────────────────────
  app.post("/api/auth/send-otp", async (req, res) => {
    try {
      const { email } = req.body;
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 10 * 60 * 1000;

      const db = getDB();
      db.otps = (db.otps || []).filter((o: any) => o.email !== email);
      db.otps.push({ email, otp, expiresAt });
      saveDB(db);

      console.log(`[OTP] Sent to ${email}: ${otp}`);
      res.json({ success: true, message: "OTP sent successfully" });
    } catch (err: any) {
      console.error("Send OTP error:", err.message);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // ── Auth: Verify OTP ────────────────────────────────────────────────────────
  app.post("/api/auth/verify-otp", (req, res) => {
    try {
      const { email, otp } = req.body;
      const db = getDB();
      const otpEntry = (db.otps || []).find(
        (o: any) => o.email === email && o.otp === otp && o.expiresAt > Date.now()
      );

      if (otpEntry) {
        db.otps = db.otps.filter((o: any) => o !== otpEntry);
        saveDB(db);
        res.json({ success: true, message: "OTP verified" });
      } else {
        res.status(400).json({ success: false, message: "Invalid or expired OTP" });
      }
    } catch (err: any) {
      console.error("Verify OTP error:", err.message);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // ── Auth: Login ─────────────────────────────────────────────────────────────
  app.post("/api/auth/login", (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password)
        return res.status(400).json({ success: false, message: "Username and password required" });

      console.log(`Login attempt: ${username}`);
      const db = getDB();
      const user = db.users.find((u: any) => u.username === username && u.password === password);

      if (user) {
        console.log(`Login success: ${username}`);
        res.json({ success: true, user });
      } else {
        console.log(`Login failed: ${username}`);
        res.status(401).json({ success: false, message: "Invalid credentials" });
      }
    } catch (err: any) {
      console.error("Login error:", err.message);
      res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
  });

  // ── Auth: Register ──────────────────────────────────────────────────────────
  app.post("/api/auth/register", (req, res) => {
    try {
      console.log("Registration attempt:", req.body.username);
      const db = getDB();
      const customerNo = `CUST-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const newUser = {
        id: Math.random().toString(36).substr(2, 9),
        customerNo,
        ...req.body,
      };
      db.users.push(newUser);
      saveDB(db);
      console.log("Registration success:", newUser.username);
      res.json({
        success: true,
        user: {
          id: newUser.id,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          email: newUser.email,
          customerNo: newUser.customerNo,
        },
      });
    } catch (err: any) {
      console.error("Register error:", err.message);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // ── Loans ───────────────────────────────────────────────────────────────────
  app.get("/api/loans", (req, res) => {
    try {
      const db = getDB();
      res.json(db.loans);
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.get("/api/loans/:userId", (req, res) => {
    try {
      const db = getDB();
      const userLoans = db.loans.filter((l: any) => l.userId === req.params.userId);
      res.json(userLoans);
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.get("/api/loan/:id", (req, res) => {
    try {
      const db = getDB();
      const loan = db.loans.find((l: any) => l.id === req.params.id);
      if (loan) {
        res.json(loan);
      } else {
        res.status(404).json({ message: "Loan not found" });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.post("/api/loans/apply", (req, res) => {
    try {
      const db = getDB();
      const now = new Date();
      const dateStr = now.toISOString().split("T")[0].replace(/-/g, "");
      const todayLoans = db.loans.filter((l: any) => l.id.startsWith(`APP-${dateStr}-`));
      const sequence = (todayLoans.length + 1).toString().padStart(4, "0");
      const loanId = `APP-${dateStr}-${sequence}`;

      const newLoan = {
        id: loanId,
        status: "Pending",
        amount: Number(req.body.amount),
        balance: Number(req.body.amount),
        paidInstallments: 0,
        ...req.body,
      };

      const nextDate = new Date();
      const termStr = (newLoan.term || "").toLowerCase();
      if (termStr.includes("daily")) nextDate.setDate(nextDate.getDate() + 1);
      else if (termStr.includes("weekly")) nextDate.setDate(nextDate.getDate() + 7);
      else if (termStr.includes("semi-monthly")) nextDate.setDate(nextDate.getDate() + 15);
      else nextDate.setMonth(nextDate.getMonth() + 1);
      newLoan.nextPayment = nextDate.toISOString().split("T")[0];

      db.loans.push(newLoan);
      saveDB(db);
      res.json({ success: true, loan: newLoan });
    } catch (err: any) {
      console.error("Apply loan error:", err.message);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.post("/api/loans/status", (req, res) => {
    try {
      const { loanId, status } = req.body;
      const db = getDB();
      const loanIndex = db.loans.findIndex((l: any) => l.id === loanId);
      if (loanIndex === -1)
        return res.status(404).json({ success: false, message: "Loan not found" });

      const loan = db.loans[loanIndex];
      loan.status = status;

      if (status === "Active") {
        const amount = Number(loan.amount);
        const rate = Number(loan.interest || 3.5) / 100;
        const installments = Number(loan.installments || 12);
        loan.totalAmount = amount + amount * rate * installments;
        loan.balance = loan.totalAmount;
        loan.paidInstallments = 0;

        const nextDate = new Date();
        const termStr = (loan.term || "").toLowerCase();
        if (termStr.includes("daily")) nextDate.setDate(nextDate.getDate() + 1);
        else if (termStr.includes("weekly")) nextDate.setDate(nextDate.getDate() + 7);
        else if (termStr.includes("semi-monthly")) nextDate.setDate(nextDate.getDate() + 15);
        else nextDate.setMonth(nextDate.getMonth() + 1);
        loan.nextPayment = nextDate.toISOString().split("T")[0];

        db.transactions.push({
          id: `TRX-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
          userId: loan.userId,
          loanId: loan.id,
          type: "Loan Received",
          amount: loan.amount,
          date: new Date().toISOString(),
          status: "Success",
        });
      }

      saveDB(db);
      res.json({ success: true, loan });
    } catch (err: any) {
      console.error("Loan status error:", err.message);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.post("/api/loans/pay", (req, res) => {
    try {
      const { loanId, amount, type } = req.body;
      const db = getDB();
      const loanIndex = db.loans.findIndex((l: any) => l.id === loanId);
      if (loanIndex === -1)
        return res.status(404).json({ success: false, message: "Loan not found" });

      const loan = db.loans[loanIndex];
      const paymentAmount = Number(amount);

      if (type === "full") {
        loan.balance = 0;
        loan.status = "Paid";
        loan.paidInstallments = loan.installments;
      } else {
        const principal = Number(loan.amount);
        const rate = Number(loan.interest || 3.5) / 100;
        const installments = Number(loan.installments || 12);
        const totalAmountWithInterest = loan.totalAmount || principal + principal * rate * installments;
        const installmentAmount = totalAmountWithInterest / installments;

        const oldPaidInstallments = loan.paidInstallments || 0;
        loan.balance = Math.max(0, Number(loan.balance) - paymentAmount);

        const totalPaidAmount = totalAmountWithInterest - loan.balance;
        const totalPaidInstallments = Math.floor(totalPaidAmount / installmentAmount);
        const installmentsCovered = totalPaidInstallments - oldPaidInstallments;
        loan.paidInstallments = totalPaidInstallments;

        if (loan.balance <= 0) {
          loan.status = "Paid";
        } else if (installmentsCovered > 0) {
          const nextDate = new Date(loan.nextPayment || Date.now());
          for (let i = 0; i < installmentsCovered; i++) {
            const term = loan.term?.toLowerCase() || "";
            if (term.includes("daily")) nextDate.setDate(nextDate.getDate() + 1);
            else if (term.includes("weekly")) nextDate.setDate(nextDate.getDate() + 7);
            else if (term.includes("semi-monthly")) nextDate.setDate(nextDate.getDate() + 15);
            else nextDate.setMonth(nextDate.getMonth() + 1);
          }
          loan.nextPayment = nextDate.toISOString().split("T")[0];
        }
      }

      db.transactions.push({
        id: `TRX-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
        userId: loan.userId,
        loanId: loan.id,
        type: "Loan Payment",
        amount: paymentAmount,
        date: new Date().toISOString(),
        status: "Success",
      });

      saveDB(db);
      res.json({ success: true, loan });
    } catch (err: any) {
      console.error("Loan pay error:", err.message);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // ── Transactions ────────────────────────────────────────────────────────────
  app.get("/api/transactions/:userId", (req, res) => {
    try {
      const db = getDB();
      const userTransactions = (db.transactions || []).filter(
        (t: any) => t.userId === req.params.userId
      );
      res.json(userTransactions);
    } catch (err: any) {
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