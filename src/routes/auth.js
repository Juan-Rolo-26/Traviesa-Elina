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
  if (!configuredKey) return false;
  const headerKey = trimString(req.headers["x-diag-key"]);
  const queryKey = trimString(req.query?.key);
  return configuredKey === headerKey || configuredKey === queryKey;
}

function smtpConfigFromEnv() {
  const host = trimString(process.env.SMTP_HOST);
  const portRaw = trimString(process.env.SMTP_PORT);
  const user = trimString(process.env.SMTP_USER);
  const pass = trimString(process.env.SMTP_PASS);
  const from = trimString(process.env.SMTP_FROM) || user;

  const port = Number(portRaw);
  if (!host || !port || !user || !pass || !from) {
    return null;
  }

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
    const password = String(req.body?.password || "");

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Email invalido" });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "La contrasena debe tener minimo 8 caracteres" });
    }

    if (username && username.length < 3) {
      return res.status(400).json({ error: "Nombre de usuario invalido" });
    }

    const existingByEmail = await prisma.customer.findUnique({ where: { email } });
    if (existingByEmail) {
      return res.status(409).json({ error: "El email ya existe" });
    }

    if (username) {
      const existingByUsername = await prisma.customer.findUnique({
        where: { username },
        select: { id: true },
      });
      if (existingByUsername) {
        return res.status(409).json({ error: "El nombre de usuario ya existe" });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const customer = await prisma.customer.create({
      data: {
        email,
        username: username || null,
        firstName: username || null,
        passwordHash,
        role: "customer",
      },
    });

    const token = signUserToken(customer);

    return res.status(201).json({
      token,
      user: {
        id: customer.id,
        email: customer.email,
        username: customer.username,
        role: customer.role,
      },
    });
  } catch (error) {
    console.error("[auth/register] error", {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      email: req.body?.email,
      username: req.body?.username,
    });

    if (error?.code === "P2002") {
      return res.status(409).json({ error: "El email o nombre de usuario ya existe" });
    }

    return res.status(500).json({ error: "No se pudo registrar el usuario" });
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
    console.error("[auth/login] error", {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      email: req.body?.email,
    });

    if (hasDiagAccess(req)) {
      return res.status(500).json({
        error: "No se pudo iniciar sesion",
        debug: {
          message: error?.message || "unknown",
          code: error?.code || null,
          meta: error?.meta || null,
          jwtSecretPresent: Boolean(trimString(process.env.JWT_SECRET)),
        },
      });
    }

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
