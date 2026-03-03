const express = require("express");
const prisma = require("../lib/prisma");
const { applyPaidOrder } = require("../services/orderService");
const {
  getPaymentById,
  normalizePaymentStatus,
  verifyWebhookSignature,
} = require("../services/mercadoPago");

const router = express.Router();

router.post("/mercadopago", async (req, res) => {
  try {
    const signatureOk = verifyWebhookSignature(req);

    const paymentId = req.query["data.id"] || req.body?.data?.id;
    const topic = req.query.type || req.query.topic || req.body?.type;

    if (!paymentId || (topic && topic !== "payment")) {
      return res.status(200).json({ ok: true });
    }

    const payment = await getPaymentById(paymentId);
    const orderId =
      payment?.external_reference ||
      payment?.metadata?.orderId ||
      null;

    if (!orderId) {
      return res.status(200).json({ ok: true });
    }

    const status = payment.status || "rejected";

    if (status === "approved") {
      await applyPaidOrder(orderId, String(payment.id), payment.status_detail || null);
    } else {
      const orderStatus = normalizePaymentStatus(status);
      await prisma.order.updateMany({
        where: { id: orderId },
        data: {
          paymentId: String(payment.id),
          paymentStatus: status,
          status: orderStatus,
          statusDetail: payment.status_detail || null,
        },
      });
    }

    res.status(200).json({ ok: true, signatureVerified: signatureOk });
  } catch (error) {
    res.status(200).json({ ok: true, error: error.message });
  }
});

module.exports = router;
