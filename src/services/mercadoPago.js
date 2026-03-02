const crypto = require("crypto");
const { MercadoPagoConfig, Payment } = require("mercadopago");

function getClient() {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN not configured");
  }
  return new MercadoPagoConfig({ accessToken });
}

async function createPayment(payload, requestOptions) {
  const payment = new Payment(getClient());
  return payment.create({ body: payload, requestOptions });
}

async function getPaymentById(id) {
  const payment = new Payment(getClient());
  return payment.get({ id });
}

function normalizePaymentStatus(status) {
  if (status === "approved") return "paid";
  if (status === "pending" || status === "in_process" || status === "authorized") return "pending";
  return "rejected";
}

function verifyWebhookSignature(req) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return true;

  const signature = req.headers["x-signature"];
  if (!signature) return false;

  // Best-effort verification compatible with MP header format: ts=...,v1=...
  const parts = String(signature)
    .split(",")
    .map((entry) => entry.trim())
    .reduce((acc, entry) => {
      const [k, v] = entry.split("=");
      if (k && v) acc[k] = v;
      return acc;
    }, {});

  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const requestId = req.headers["x-request-id"] || "";
  const dataId = req.query["data.id"] || req.body?.data?.id || "";
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;

  const digest = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  return digest === v1;
}

module.exports = {
  createPayment,
  getPaymentById,
  normalizePaymentStatus,
  verifyWebhookSignature,
};
