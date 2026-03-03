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

function splitName(fullName) {
  const [firstName, ...rest] = String(fullName || "").trim().split(/\s+/);
  return {
    firstName: firstName || undefined,
    lastName: rest.join(" ") || undefined,
  };
}

function splitArgPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return {};
  if (digits.length <= 10) return { area_code: digits.slice(0, 3), number: digits.slice(3) };
  return { area_code: digits.slice(0, 4), number: digits.slice(4) };
}

function parseAddress(address1) {
  const raw = String(address1 || "").trim();
  if (!raw) return {};
  const match = raw.match(/^(.*?)(?:\s+(\d+))?$/);
  const streetName = (match?.[1] || raw).trim();
  const streetNumber = (match?.[2] || "").trim();
  return {
    street_name: streetName || undefined,
    street_number: streetNumber || undefined,
  };
}

function hasAnyValue(values) {
  return values.some((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

function buildAdditionalInfo(order) {
  const names = splitName(order.customerName);
  const phone = splitArgPhone(order.phone);
  const address = parseAddress(order.address1);

  const items = (order.items || []).map((item) => ({
    id: String(item.productId || item.id || ""),
    title: String(item.productName || "Producto"),
    description: item.productName || undefined,
    picture_url: item.productImage ? `${process.env.BASE_URL || ""}${item.productImage}` : undefined,
    category_id: "fashion",
    quantity: Number(item.quantity) || 1,
    unit_price: formatCentsToNumber(item.productPrice || 0),
  }));

  return {
    payer: {
      first_name: names.firstName,
      last_name: names.lastName,
      phone: phone.number ? phone : undefined,
      address: {
        zip_code: String(order.postalCode || ""),
        ...address,
      },
    },
    shipments: {
      receiver_address: {
        zip_code: String(order.postalCode || ""),
        ...address,
        city_name: order.city || undefined,
        state_name: order.province || undefined,
      },
    },
    items,
  };
}

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
      deviceSessionId,
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

    const orderNames = splitName(order.customerName);
    const orderPhone = splitArgPhone(order.phone);
    const orderAddress = parseAddress(order.address1);

    const mpPayer = {
      email: String(payer.email),
      first_name: payer?.first_name || orderNames.firstName,
      last_name: payer?.last_name || orderNames.lastName,
      type: "customer",
      entity_type: "individual",
    };

    const effectivePhone = payer?.phone?.number
      ? {
          area_code: String(payer.phone.area_code || ""),
          number: String(payer.phone.number || ""),
        }
      : orderPhone.number
        ? orderPhone
        : undefined;
    if (effectivePhone?.number) {
      mpPayer.phone = effectivePhone;
    }

    const payerAddress = {
      zip_code: String(order.postalCode || "").trim() || undefined,
      street_name: orderAddress.street_name,
      street_number: orderAddress.street_number,
    };
    if (hasAnyValue([payerAddress.zip_code, payerAddress.street_name, payerAddress.street_number])) {
      mpPayer.address = payerAddress;
    }

    if (payer?.identification?.type && payer?.identification?.number) {
      mpPayer.identification = {
        type: String(payer.identification.type),
        number: String(payer.identification.number),
      };
    }

    const requestOptions =
      deviceSessionId && String(deviceSessionId).trim()
        ? {
            headers: {
              "X-meli-session-id": String(deviceSessionId).trim(),
            },
          }
        : undefined;

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
      additional_info: buildAdditionalInfo(order),
      metadata: {
        orderId: order.id,
      },
    }, requestOptions);

    const paymentStatus = mpPayment.status || "rejected";
    let orderStatus;

    if (paymentStatus === "approved") {
      const settledOrder = await applyPaidOrder(
        order.id,
        String(mpPayment.id),
        mpPayment.status_detail || null
      );
      orderStatus = settledOrder.status;
    } else {
      orderStatus = normalizePaymentStatus(paymentStatus);
      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentId: String(mpPayment.id),
          paymentStatus,
          status: orderStatus,
          statusDetail: mpPayment.status_detail || null,
        },
      });
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

router.get("/status/:orderId", optionalCustomer, async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) {
      return res.status(400).json({ error: "Missing order id" });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        customerId: true,
        status: true,
        paymentId: true,
        paymentStatus: true,
        statusDetail: true,
      },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (req.customer?.id && order.customerId && order.customerId !== req.customer.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return res.json({
      orderId: order.id,
      orderStatus: order.status,
      paymentId: order.paymentId,
      paymentStatus: order.paymentStatus,
      statusDetail: order.statusDetail,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "No se pudo consultar el estado del pago" });
  }
});

module.exports = router;
