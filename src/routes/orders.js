const express = require("express");
const { optionalCustomer } = require("../middleware/auth");
const { createPendingOrder } = require("../services/orderService");
const { formatCentsToNumber } = require("../utils/pricing");
const prisma = require("../lib/prisma");

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
        
        const baseUrl = process.env.BASE_URL || "https://traviesa.online";
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
            <br/>
            <div style="margin-top: 20px;">
              <a href="${baseUrl}/api/orders/action/${order.id}?action=cancel" style="background-color: #d90429; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-right: 15px; display: inline-block;">Eliminar pedido</a>
              <a href="${baseUrl}/api/orders/action/${order.id}?action=confirm" style="background-color: #38b000; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Confirmar pedido</a>
            </div>
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

router.get("/action/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.query;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!order) {
      return res.status(404).send("<h1 style='color: red; text-align: center; margin-top: 50px;'>El pedido no existe o ya fue procesado/eliminado.</h1>");
    }

    if (action === "cancel") {
      await prisma.order.delete({ where: { id } });
      return res.send("<h1 style='color: #d90429; text-align: center; margin-top: 50px;'>✅ Pedido cancelado y eliminado con éxito.</h1>");
    }

    if (action === "confirm") {
      if (order.status === "paid" || order.status === "confirmed") {
         return res.send("<h1 style='color: orange; text-align: center; margin-top: 50px;'>El pedido ya estaba confirmado anteriormente.</h1>");
      }

      await prisma.$transaction(async (tx) => {
        // Actualizar el stock y borrar si llega a 0
        for (const item of order.items) {
          if (!item.productId) continue;
          const prod = await tx.product.findUnique({ where: { id: item.productId } });
          if (prod) {
            const newStock = prod.stock - item.quantity;
            if (newStock <= 0) {
              await tx.product.delete({ where: { id: item.productId } });
            } else {
              await tx.product.update({
                where: { id: item.productId },
                data: { stock: newStock }
              });
            }
          }
        }

        // Marcar la orden como pagada
        await tx.order.update({
          where: { id },
          data: { status: "paid", paymentStatus: "approved" }
        });
      });

      return res.send("<h1 style='color: #38b000; text-align: center; margin-top: 50px;'>✅ Pedido confirmado. ¡El stock fue descontado y actualizado exitosamente!</h1>");
    }

    return res.status(400).send("<h1>Acción inválida. Usa los botones del correo.</h1>");
  } catch (error) {
    console.error("Error en Order Action:", error);
    res.status(500).send("<h1 style='color: red; text-align: center; margin-top: 50px;'>Ocurrió un error al procesar el pedido.</h1>");
  }
});

module.exports = router;
