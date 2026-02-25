const crypto = require("crypto");
const express = require("express");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/jwt");

const router = express.Router();

function trimString(value) {
  return String(value || "").trim();
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""), "utf8");
  const right = Buffer.from(String(b || ""), "utf8");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function resolveMabelPassword() {
  const primary = trimString(process.env.MABEL_PASSWORD);
  if (primary) return primary;

  const fallbackEnv = trimString(process.env.MABEL_PASSWORD_FALLBACK);
  if (fallbackEnv) return fallbackEnv;

  // Temporary emergency fallback for hosts that fail to inject runtime env vars.
  return "Mabel2026";
}

router.post("/unlock", (req, res) => {
  const expected = resolveMabelPassword();
  const provided = trimString(req.body?.password);

  if (!provided || !safeEqual(provided, expected)) {
    return res.status(401).json({ error: "Contrasena incorrecta" });
  }

  const token = jwt.sign({ mode: "mabel" }, JWT_SECRET, { expiresIn: "30d" });
  return res.json({ token });
});

module.exports = router;
