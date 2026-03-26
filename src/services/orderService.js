const prisma = require("../lib/prisma");

const allowedDeliveryMethods = new Set(["PICKUP", "HOME_DELIVERY", "BRANCH_DELIVERY"]);

function normalizeDelivery(method) {
  const normalized = String(method || "").toUpperCase();
  if (!allowedDeliveryMethods.has(normalized)) {
    throw new Error("Invalid delivery method");
  }
  return normalized;
}

function splitName(fullName) {
  const [firstName, ...rest] = String(fullName || "").trim().split(" ");
  return {
    firstName: firstName || null,
    lastName: rest.join(" ") || null,
  };
}

function isValidArgentinaPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 13;
}

async function createPendingOrder({ customer, customerData, items, saveCustomerData }) {
  const {
    customerName,
    province,
    city,
    address1,
    address2,
    postalCode,
    phone,
    deliveryMethod,
  } = customerData || {};

  if (!customerName || !province || !city || !address1 || !postalCode || !phone || !deliveryMethod) {
    throw new Error("Missing customer data");
  }
  if (!isValidArgentinaPhone(phone)) {
    throw new Error("Invalid phone");
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Cart is empty");
  }

  const normalizedDelivery = normalizeDelivery(deliveryMethod);
  const quantityById = new Map();

  for (const item of items) {
    if (!item?.productId) throw new Error("Invalid cart item");
    const qty = Math.max(1, Number(item.quantity) || 1);
    quantityById.set(item.productId, (quantityById.get(item.productId) || 0) + qty);
  }

  const productIds = Array.from(quantityById.keys());

  return prisma.$transaction(async (tx) => {
    const products = await tx.product.findMany({
      where: { id: { in: productIds } },
      include: { wholesaleOffers: true },
    });

    if (products.length !== productIds.length) {
      throw new Error("One or more products are missing");
    }

    for (const product of products) {
      const requested = quantityById.get(product.id) || 1;
      if (product.stock < requested) {
        throw new Error(`Insufficient stock for ${product.name}`);
      }
    }

    const totalAmount = products.reduce((sum, product) => {
      const qty = quantityById.get(product.id) || 1;
      const sortedOffers = [...(product.wholesaleOffers || [])].sort((a, b) => b.quantity - a.quantity);
      const match = sortedOffers.find((o) => qty >= o.quantity);
      const unitPrice = match ? match.price : (product.discountPrice ?? product.price);
      return sum + unitPrice * qty;
    }, 0);

    const order = await tx.order.create({
      data: {
        customerId: customer?.id || null,
        customerName,
        province,
        city,
        address1,
        address2: address2 || null,
        postalCode,
        phone,
        deliveryMethod: normalizedDelivery,
        totalAmount,
        status: "pending",
        items: {
          create: products.map((product) => {
            const qty = quantityById.get(product.id) || 1;
            const sortedOffers = [...(product.wholesaleOffers || [])].sort((a, b) => b.quantity - a.quantity);
            const match = sortedOffers.find((o) => qty >= o.quantity);
            const unitPrice = match ? match.price : (product.discountPrice ?? product.price);
            return {
              productId: product.id,
              productName: product.name,
              productPrice: unitPrice,
              productImage: product.image,
              quantity: qty,
            };
          }),
        },
      },
      include: { items: true, customer: true },
    });

    if (customer?.id && saveCustomerData) {
      const names = splitName(customerName);
      await tx.customer.update({
        where: { id: customer.id },
        data: {
          firstName: names.firstName,
          lastName: names.lastName,
          province,
          city,
          address1,
          address2: address2 || null,
          postalCode,
          phone,
        },
      });
    }

    return order;
  });
}

async function applyPaidOrder(orderId, paymentId, statusDetail) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new Error("Order not found");
    }

    if (order.status === "paid") {
      return order;
    }

    const productIds = order.items.map((item) => item.productId).filter(Boolean);
    const products = await tx.product.findMany({ where: { id: { in: productIds } } });
    const productMap = new Map(products.map((product) => [product.id, product]));

    for (const item of order.items) {
      if (!item.productId) continue;
      const product = productMap.get(item.productId);
      if (!product || product.stock < item.quantity) {
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: "rejected",
            paymentId: paymentId || order.paymentId,
            paymentStatus: "rejected",
            statusDetail: "insufficient_stock_after_payment",
          },
        });
        throw new Error("Insufficient stock to settle paid order");
      }
    }

    for (const item of order.items) {
      if (!item.productId) continue;
      const product = productMap.get(item.productId);
      if (!product) continue;
      const remaining = product.stock - item.quantity;
      if (remaining <= 0) {
        await tx.product.delete({ where: { id: product.id } });
      } else {
        await tx.product.update({
          where: { id: product.id },
          data: { stock: remaining },
        });
      }
    }

    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        status: "paid",
        paymentId: paymentId || order.paymentId,
        paymentStatus: "approved",
        statusDetail: statusDetail || null,
      },
      include: { items: true },
    });

    return updated;
  });
}

module.exports = {
  createPendingOrder,
  applyPaidOrder,
};
