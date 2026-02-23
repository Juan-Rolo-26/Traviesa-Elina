const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const { PrismaClient } = require("@prisma/client");
const { requireCustomer } = require("../middleware/auth");
const { JWT_SECRET } = require("../config/jwt");

const router = express.Router();
const prisma = new PrismaClient();
const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  process.env.VITE_GOOGLE_CLIENT_ID ||
  null;

if (!GOOGLE_CLIENT_ID) {
  console.warn("⚠️ GOOGLE_CLIENT_ID not defined at startup");
}
const DEFAULT_ADMIN_GOOGLE_EMAILS = ["eccomfyarg@gmail.com"];
const adminEmailSet = new Set(
  [
    ...DEFAULT_ADMIN_GOOGLE_EMAILS,
    ...String(process.env.ADMIN_GOOGLE_EMAILS || "").split(","),
  ]
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Missing credentials" });
  }

  const admin = await prisma.admin.findUnique({ where: { username } });
  if (!admin) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const ok = await bcrypt.compare(password, admin.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign(
    { id: admin.id, username: admin.username, role: "admin" },
    JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.json({ token, username: admin.username });
});

router.post("/google", async (req, res) => {
  const { idToken } = req.body || {};
  if (!idToken) {
    return res.status(400).json({ error: "Missing idToken" });
  }
  console.log("GOOGLE_CLIENT_ID resolved:", GOOGLE_CLIENT_ID);
  if (!GOOGLE_CLIENT_ID) {
    return res.status(500).json({ error: "Google client ID not configured" });
  }

  try {
    const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ error: "Invalid Google token" });
    }

    const existing = await prisma.customer.findUnique({ where: { email: payload.email } });
    const customer = await prisma.customer.upsert({
      where: { email: payload.email },
      update: {
        firstName: payload.given_name || undefined,
        lastName: payload.family_name || undefined,
      },
      create: {
        email: payload.email,
        firstName: payload.given_name || null,
        lastName: payload.family_name || null,
      },
    });

    const token = jwt.sign(
      { id: customer.id, email: customer.email, role: "customer" },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const isAdmin = adminEmailSet.has(payload.email.toLowerCase());
    res.json({
      token,
      customer: { ...customer, googlePicture: payload.picture || null },
      isNew: !existing,
      isAdmin,
    });
  } catch (error) {
    console.error("GOOGLE LOGIN ERROR:", error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

router.get("/admin-status", requireCustomer, (req, res) => {
  const email = String(req.customer.email || "").toLowerCase();
  res.json({ isAdmin: adminEmailSet.has(email) });
});

router.post("/google-admin", async (req, res) => {
  const { idToken } = req.body || {};
  if (!idToken) {
    return res.status(400).json({ error: "Missing idToken" });
  }
  if (!GOOGLE_CLIENT_ID) {
    return res.status(500).json({ error: "Google client ID not configured" });
  }
  try {
    const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload?.email?.toLowerCase();
    if (!email || !adminEmailSet.has(email)) {
      return res.status(403).json({ error: "Email not allowed" });
    }

    const token = jwt.sign(
      { id: email, email, role: "admin" },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({ token, email });
  } catch (error) {
    res.status(401).json({ error: "Google auth failed" });
  }
});

router.get("/me", requireCustomer, async (req, res) => {
  const customer = await prisma.customer.findUnique({ where: { id: req.customer.id } });
  res.json({ customer });
});

module.exports = router;
