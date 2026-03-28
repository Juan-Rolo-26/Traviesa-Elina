const crypto = require("crypto");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const prisma = require("../lib/prisma");
const { requireCustomer } = require("../middleware/auth");
const { JWT_SECRET } = require("../config/jwt");

const router = express.Router();
const RESET_CODE_TTL_MS = 10 * 60 * 1000;
const forgotPasswordRate = new Map();

const DEFAULT_ADMIN_USER = {
  email: "eccomfyarg@gmail.com",
  password: "belgrano23",
  role: "admin",
};

function trimString(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return trimString(value).toLowerCase();
}

function isValidEmail(email) {
  return /^\S+@\S+\.\S+$/.test(email);
}

function hashCode(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

function createSixDigitCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

function signUserToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      id: user.id,
      role: user.role,
      username: user.username || null,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: user.role === "admin" ? "8h" : "7d" }
  );
}

function hasDiagAccess(req) {
  const configuredKey = trimString(process.env.DIAG_KEY);
  const headerKey = trimString(req.headers["x-diag-key"]);
  const queryKey = trimString(req.query?.key);
  const providedKey = headerKey || queryKey;
  return Boolean(providedKey && configuredKey === providedKey);
}

function smtpConfigFromEnv() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT) || 465;
  const user = process.env.SMTP_USER || "traviesabazar@gmail.com";
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!pass) return null;

  return {
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    from,
  };
}

function isForgotRateLimited(ip, email) {
  const key = `${ip || "unknown"}:${email}`;
  const now = Date.now();
  const last = forgotPasswordRate.get(key);
  if (last && now - last < 60 * 1000) {
    return true;
  }
  forgotPasswordRate.set(key, now);
  return false;
}

async function ensureDefaultAdminUser() {
  try {
    const existingAdmin = await prisma.customer.findFirst({
      where: { role: "admin" },
      select: { id: true },
    });

    if (existingAdmin) {
      return;
    }

    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_USER.password, 10);
    const existingByEmail = await prisma.customer.findUnique({
      where: { email: DEFAULT_ADMIN_USER.email },
    });

    if (existingByEmail) {
      await prisma.customer.update({
        where: { email: DEFAULT_ADMIN_USER.email },
        data: {
          role: "admin",
          passwordHash,
          username: existingByEmail.username || "FranYRolo",
          firstName: existingByEmail.firstName || "FranYRolo",
        },
      });
      return;
    }

    await prisma.customer.create({
      data: {
        email: DEFAULT_ADMIN_USER.email,
        username: "FranYRolo",
        firstName: "FranYRolo",
        role: "admin",
        passwordHash,
      },
    });
  } catch (error) {
    console.error("[auth] ensureDefaultAdminUser warning", {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
    });
  }
}

void ensureDefaultAdminUser();

router.post("/register", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const username = trimString(req.body?.username);
    const firstName = trimString(req.body?.firstName);
    const phone = trimString(req.body?.phone);
    const password = String(req.body?.password || "");

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Email invalido" });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "La contrasena debe tener minimo 8 caracteres" });
    }

    const existingByEmail = await prisma.customer.findUnique({ where: { email } });
    if (existingByEmail) {
      if (existingByEmail.isVerified) {
        return res.status(409).json({ error: "El email ya existe" });
      }
      // If not verified, we'll recreate or update it later (for simplicity, we delete and recreate if not verified)
      await prisma.customer.delete({ where: { email } });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationCode = createSixDigitCode();

    const customer = await prisma.customer.create({
      data: {
        email,
        username: username || firstName || null,
        firstName: firstName || null,
        phone: phone || null,
        passwordHash,
        isVerified: false,
        verificationCode,
        role: "customer",
      },
    });

    const smtp = smtpConfigFromEnv();
    if (smtp) {
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: smtp.auth,
      });

      await transporter.sendMail({
        from: smtp.from,
        to: email,
        subject: "Codigo de verificacion - Traviesa",
        text: `Tu codigo de verificacion es: ${verificationCode}`,
      });
    }

    return res.status(201).json({
      message: "Codigo enviado",
      email: customer.email,
    });
  } catch (error) {
    console.error("[auth/register] error", error);
    return res.status(500).json({ error: "No se pudo registrar el usuario" });
  }
});

router.post("/verify-registration", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const code = trimString(req.body?.code);

    if (!email || !code) {
      return res.status(400).json({ error: "Faltan datos" });
    }

    const user = await prisma.customer.findUnique({ where: { email } });
    if (!user || user.verificationCode !== code) {
      return res.status(400).json({ error: "Codigo invalido" });
    }

    const updated = await prisma.customer.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verificationCode: null,
      },
    });

    const token = signUserToken(updated);

    return res.json({
      token,
      user: {
        id: updated.id,
        email: updated.email,
        username: updated.username,
        firstName: updated.firstName,
        role: updated.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: "Error al verificar" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!isValidEmail(email) || !password) {
      return res.status(400).json({ error: "Faltan credenciales" });
    }

    const user = await prisma.customer.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    if (!user.isVerified) {
      return res.status(403).json({ error: "email_not_verified" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    const token = signUserToken(user);

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("[auth/login] error", error);
    return res.status(500).json({ error: "No se pudo iniciar sesion" });
  }
});

router.post("/admin/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!isValidEmail(email) || !password) {
      return res.status(400).json({ error: "Faltan credenciales" });
    }

    const user = await prisma.customer.findUnique({ where: { email } });
    if (!user || user.role !== "admin" || !user.passwordHash) {
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    const token = signUserToken(user);

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("[auth/admin/login] error", {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      email: req.body?.email,
    });

    return res.status(500).json({ error: "No se pudo iniciar sesion de admin" });
  }
});

router.get("/debug-users", async (req, res) => {
  if (!hasDiagAccess(req)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    const users = await prisma.customer.findMany({
      select: { id: true, email: true, role: true, username: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return res.json({ count: users.length, users });
  } catch (error) {
    console.error("[auth/debug-users] error", {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
    });
    return res.status(500).json({
      error: "No se pudo listar usuarios",
      debug: {
        message: error?.message || "unknown",
        code: error?.code || null,
        meta: error?.meta || null,
      },
    });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Email invalido" });
    }

    const user = await prisma.customer.findUnique({ where: { email } });
    if (!user || user.role !== "customer") {
      return res.status(404).json({ error: "El email no existe" });
    }

    if (isForgotRateLimited(req.ip, email)) {
      return res.status(429).json({ error: "Espera un minuto antes de volver a intentar" });
    }

    const smtp = smtpConfigFromEnv();
    if (!smtp) {
      return res.status(503).json({ error: "Email service not configured" });
    }

    const code = createSixDigitCode();
    const codeHash = hashCode(code);
    const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MS);

    await prisma.customer.update({
      where: { email },
      data: {
        resetCodeHash: codeHash,
        resetCodeExpiresAt: expiresAt,
        resetCodeUsed: false,
      },
    });

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.auth,
    });

    await transporter.sendMail({
      from: smtp.from,
      to: email,
      subject: "Codigo de recuperacion",
      text: `Tu codigo de recuperacion es: ${code}. Vence en 10 minutos.`,
    });

    return res.json({ ok: true, message: "Codigo enviado" });
  } catch (error) {
    return res.status(500).json({ error: "No se pudo enviar el codigo" });
  }
});

router.post("/reset-password/verify", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const code = trimString(req.body?.code);

    if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: "Datos invalidos" });
    }

    const user = await prisma.customer.findUnique({ where: { email } });
    if (!user || user.role !== "customer") {
      return res.status(400).json({ error: "Codigo invalido o vencido" });
    }

    const expired = !user.resetCodeExpiresAt || user.resetCodeExpiresAt.getTime() < Date.now();
    const used = Boolean(user.resetCodeUsed);
    const expectedHash = user.resetCodeHash;

    if (!expectedHash || used || expired || hashCode(code) !== expectedHash) {
      return res.status(400).json({ error: "Codigo invalido o vencido" });
    }

    await prisma.customer.update({
      where: { email },
      data: {
        resetCodeUsed: true,
        resetCodeHash: null,
        resetCodeExpiresAt: null,
      },
    });

    const token = signUserToken(user);
    return res.json({
      ok: true,
      message: "Inicio de sesion exitoso",
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: "No se pudo verificar el codigo" });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const code = trimString(req.body?.code);
    const newPassword = String(req.body?.newPassword || "");

    if (!isValidEmail(email) || !/^\d{6}$/.test(code) || newPassword.length < 8) {
      return res.status(400).json({ error: "Datos invalidos" });
    }

    const user = await prisma.customer.findUnique({ where: { email } });
    if (!user || user.role !== "customer") {
      return res.status(400).json({ error: "Codigo invalido o vencido" });
    }

    const expired = !user.resetCodeExpiresAt || user.resetCodeExpiresAt.getTime() < Date.now();
    const used = Boolean(user.resetCodeUsed);
    const expectedHash = user.resetCodeHash;

    if (!expectedHash || used || expired || hashCode(code) !== expectedHash) {
      return res.status(400).json({ error: "Codigo invalido o vencido" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.customer.update({
      where: { email },
      data: {
        passwordHash,
        resetCodeUsed: true,
        resetCodeHash: null,
        resetCodeExpiresAt: null,
      },
    });

    const refreshedUser = await prisma.customer.findUnique({ where: { email } });
    if (!refreshedUser) {
      return res.status(400).json({ error: "Usuario no encontrado" });
    }

    const token = signUserToken(refreshedUser);
    return res.json({
      ok: true,
      message: "Inicio de sesion exitoso",
      token,
      user: {
        id: refreshedUser.id,
        email: refreshedUser.email,
        username: refreshedUser.username,
        role: refreshedUser.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: "No se pudo restablecer la contrasena" });
  }
});

router.get("/admin-status", requireCustomer, (req, res) => {
  return res.json({ isAdmin: req.customer?.role === "admin" });
});

router.get("/me", requireCustomer, async (req, res) => {
  const customerId = req.customer?.sub || req.customer?.id;
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  return res.json({
    customer: {
      ...customer,
      username: customer.username || customer.firstName || null,
    },
  });
});

module.exports = router;
