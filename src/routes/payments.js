const express = require("express");
const prisma = require("../lib/prisma");
const { optionalCustomer } = require("../middleware/auth");
const { createPendingOrder, applyPaidOrder } = require("../services/orderService");
const {
  createPayment,
  normalizePaymentStatus,
} = require("../services/mercadoPago");
const { formatCentsToNumber, parsePriceToCents } = require("../utils/pricing");

const router = express.Router();

function serializeSavedMethod(method) {
  return {
    id: method.id,
    brand: method.brand,
    last4: method.last4,
    expirationMonth: method.expirationMonth,
    expirationYear: method.expirationYear,
    cardholderName: method.cardholderName,
    isDefault: method.isDefault,
  };
}

router.post("/init", optionalCustomer, async (req, res) => {
  try {
    const { customerData, items, totalAmount, saveCustomerData } = req.body || {};

    const order = await createPendingOrder({
      customer: req.customer || null,
      customerData,
      items,
      saveCustomerData: Boolean(saveCustomerData),
    });

    const computedTotal = formatCentsToNumber(order.totalAmount);
    const requestedTotal = Number(totalAmount);
    if (requestedTotal && Math.abs(requestedTotal - computedTotal) > 0.01) {
      return res.status(400).json({ error: "Total mismatch" });
    }

    let savedPaymentMethods = [];
    if (req.customer?.id) {
      const methods = await prisma.savedPaymentMethod.findMany({
        where: { customerId: req.customer.id },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      });
      savedPaymentMethods = methods.map(serializeSavedMethod);
    }

    res.status(201).json({
      orderId: order.id,
      amount: computedTotal,
      payer: {
        email: req.customer?.email || null,
        firstName: req.customer?.firstName || null,
        lastName: req.customer?.lastName || null,
      },
      savedPaymentMethods,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/process", optionalCustomer, async (req, res) => {
  try {
    const {
      orderId,
      token,
      payment_method_id,
      issuer_id,
      installments,
      transaction_amount,
      payer,
      savePaymentMethod,
      selectedSavedMethodId,
    } = req.body || {};

    if (!orderId || !payment_method_id || !transaction_amount || !payer?.email) {
      return res.status(400).json({ error: "Missing payment data" });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, items: true },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.status === "paid") {
      return res.json({ status: "approved", orderStatus: "paid" });
    }

    const amountInCents = parsePriceToCents(transaction_amount);
    if (amountInCents !== order.totalAmount) {
      return res.status(400).json({ error: "Amount mismatch" });
    }

    let effectiveToken = token;
    if (!effectiveToken && selectedSavedMethodId && req.customer?.id) {
      const saved = await prisma.savedPaymentMethod.findUnique({
        where: { id: selectedSavedMethodId },
      });
      if (saved && saved.customerId === req.customer.id && saved.mercadoPagoToken) {
        effectiveToken = saved.mercadoPagoToken;
      }
    }

    if (!effectiveToken) {
      return res.status(400).json({ error: "Missing card token" });
    }

    const notificationUrl = process.env.BASE_URL
      ? `${process.env.BASE_URL}/api/webhooks/mercadopago`
      : undefined;

    const mpPayer = {
      email: payer.email,
    };

    if (payer?.identification?.type && payer?.identification?.number) {
      mpPayer.identification = {
        type: String(payer.identification.type),
        number: String(payer.identification.number),
      };
    }

    const mpPayment = await createPayment({
      transaction_amount: Number(transaction_amount),
      token: effectiveToken,
      description: `Pedido ${order.id}`,
      installments: Number(installments) || 1,
      payment_method_id,
      issuer_id: issuer_id || undefined,
      payer: mpPayer,
      notification_url: notificationUrl,
      external_reference: order.id,
      metadata: {
        orderId: order.id,
      },
    });

    const paymentStatus = mpPayment.status || "rejected";
    const orderStatus = normalizePaymentStatus(paymentStatus);

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentId: String(mpPayment.id),
        paymentStatus,
        status: orderStatus,
        statusDetail: mpPayment.status_detail || null,
      },
    });

    if (paymentStatus === "approved") {
      await applyPaidOrder(order.id, String(mpPayment.id), mpPayment.status_detail || null);
    }

    if (
      Boolean(savePaymentMethod) &&
      req.customer?.id &&
      mpPayment.card?.last_four_digits
    ) {
      await prisma.savedPaymentMethod.create({
        data: {
          customerId: req.customer.id,
          mercadoPagoToken: effectiveToken,
          brand: mpPayment.payment_method_id || payment_method_id,
          last4: mpPayment.card.last_four_digits,
          expirationMonth: mpPayment.card.expiration_month || null,
          expirationYear: mpPayment.card.expiration_year || null,
          cardholderName: mpPayment.card?.cardholder?.name || null,
          issuerId: issuer_id ? String(issuer_id) : null,
          paymentMethodId: mpPayment.payment_method_id || payment_method_id,
          isDefault: false,
        },
      });
    }

    res.json({
      paymentId: String(mpPayment.id),
      paymentStatus,
      statusDetail: mpPayment.status_detail || null,
      orderStatus,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
