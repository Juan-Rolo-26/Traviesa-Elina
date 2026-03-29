const express = require("express");
const { optionalCustomer } = require("../middleware/auth");
const { createPendingOrder } = require("../services/orderService");
const { formatCentsToNumber } = require("../utils/pricing");

const router = express.Router();

function serializeOrder(order) {
  return {
    ...order,
    totalAmount: formatCentsToNumber(order.totalAmount),
    items: (order.items || []).map((item) => ({
      ...item,
      productPrice: formatCentsToNumber(item.productPrice),
    })),
  };
}

router.post("/", optionalCustomer, async (req, res) => {
  try {
    const order = await createPendingOrder({
      customer: req.customer || null,
      customerData: req.body,
      items: req.body?.items,
      saveCustomerData: Boolean(req.body?.saveCustomerData),
    });

    res.status(201).json(serializeOrder(order));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

const nodemailer = require("nodemailer");

function smtpConfigFromEnv() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT) || 465;
  const user = process.env.SMTP_USER || "traviesabazar@gmail.com";
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;
  if (!pass) return null;
  return { host, port, secure: port === 465, auth: { user, pass }, from };
}

router.post("/transfer", optionalCustomer, async (req, res) => {
  try {
    const { customerData, items, saveCustomerData } = req.body || {};
    const order = await createPendingOrder({
      customer: req.customer || null,
      customerData,
      items,
      saveCustomerData: Boolean(saveCustomerData),
      surchargePercent: 0,
    });

    const formattedOrder = serializeOrder(order);
    
    // Envio de mail al admin
    const smtp = smtpConfigFromEnv();
    if (smtp) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtp.host, port: smtp.port, secure: smtp.secure, auth: smtp.auth,
          tls: { rejectUnauthorized: false }
        });
        
        let itemsHtml = (formattedOrder.items || []).map(i => 
          `<li>${i.quantity}x ${i.productName} ($${i.productPrice})</li>`
        ).join('');
        
        await transporter.sendMail({
          from: smtp.from,
          to: "traviesabazar@gmail.com",
          subject: `Nuevo Pedido #${order.id} (Transferencia) - ${customerData?.customerName || 'Cliente'}`,
          html: `
            <h2>Nuevo Pedido por Transferencia</h2>
            <p><strong>Número de pedido:</strong> #${order.id}</p>
            <p><strong>Cliente:</strong> ${customerData?.customerName || 'Cliente'}</p>
            <p><strong>Email:</strong> ${customerData?.email || 'N/A'}</p>
            <p><strong>Teléfono:</strong> ${customerData?.phone || 'N/A'}</p>
            <p><strong>Total:</strong> $${formattedOrder.totalAmount}</p>
            <h3>Productos:</h3>
            <ul>${itemsHtml}</ul>
          `
        });
      } catch (err) {
        console.error("Error enviando mail de orden por transferencia", err);
      }
    }

    res.status(201).json(formattedOrder);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
