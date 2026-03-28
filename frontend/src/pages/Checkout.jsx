import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { processPayment, initPayment } from "../api";

const CARD_SURCHARGE_PERCENT = 3.55;

function formatPrice(num) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(num);
}

function Checkout({ cart, onClear, customerToken, customerProfile, onAuthOpen, isGuest }) {
  const [step, setStep] = useState("cart"); // cart, contact, payment_choice, card_form, transfer_done
  const [paymentType, setPaymentType] = useState(null); // 'card' or 'transfer'
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [orderId, setOrderId] = useState(null);
  const [editingShipping, setEditingShipping] = useState(false);

  const [form, setForm] = useState({
    customerName: "",
    phone: "",
    // ... possibly other fields if needed for shipping in future
  });

  const totalBase = useMemo(() => {
    return cart.reduce((sum, item) => {
      const sortedOffers = [...(item.wholesaleOffers || [])].sort((a, b) => b.quantity - a.quantity);
      const match = sortedOffers.find((o) => Number(item.quantity) >= Number(o.quantity));
      if (match) return sum + Number(match.price) * Number(item.quantity);
      return sum + item.price * item.quantity;
    }, 0);
  }, [cart]);

  const cardSurcharge = (totalBase * CARD_SURCHARGE_PERCENT) / 100;
  const totalWithCard = totalBase + cardSurcharge;

  useEffect(() => {
     if (customerProfile) {
       setForm({
         customerName: customerProfile.firstName + (customerProfile.lastName ? (" " + customerProfile.lastName) : ""),
         phone: customerProfile.phone || "",
       });
     }
  }, [customerProfile]);

  const handleContinueFromCart = () => {
    if (!customerProfile && !isGuest) {
      onAuthOpen();
      return;
    }
    // Si logueado saltamos contacto
    if (customerProfile && customerProfile.phone) {
      setStep("payment_choice");
    } else {
      setStep("contact");
    }
  };

  const handleFinishContact = (e) => {
    e.preventDefault();
    setStep("payment_choice");
  };

  const handleSelectPayment = (type) => {
    setPaymentType(type);
    if (type === "transfer") {
      setStep("transfer_done");
    } else {
       setStep("card_form");
    }
  };

  const handleFinalCardPayment = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus("Procesando pago con tarjeta...");
    try {
      // Reutiliza logica existente de initPayment pero con el recargo
      const payload = {
        items: cart.map(i => ({ ...i, price: i.price * 1.0355 })), // Simulación de recargo simple
        customerName: form.customerName,
        phone: form.phone,
        total: totalWithCard,
        method: "card"
      };
      const res = await initPayment(payload, customerToken);
      // Aqui normalmente abriria MP o similar
      window.location.href = res.init_point;
    } catch (err) {
      setStatus("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const currentTotal = paymentType === "card" ? totalWithCard : totalBase;

  const whatsappLink = useMemo(() => {
    const text = encodeURIComponent(
      `¡Hola Traviesa! Mi nombre es ${form.customerName}. Acabo de realizar un pedido por transferencia por un total de ${formatPrice(totalBase)}. 
Mi número de teléfono es ${form.phone}. 
Adjunto el comprobante de pago.`
    );
    return `https://wa.me/5493513749655?text=${text}`;
  }, [form, totalBase]);

  return (
    <div className="checkout-page container">
      {step === "cart" && (
        <div className="cart-view">
          <h2>Mi carrito ({cart.length})</h2>
          {cart.length === 0 ? (
            <div className="cart-empty">
              <p>Tu carrito está vacío</p>
              <Link to="/" className="button secondary">Volver a la tienda</Link>
            </div>
          ) : (
            <div className="cart-grid">
              <div className="cart-items-col">
                {cart.map((item) => (
                  <div key={item.productId} className="cart-item-row">
                    <img src={item.image} alt={item.name} className="cart-item-thumb" />
                    <div className="cart-item-info">
                      <h3>{item.name}</h3>
                      <div className="cart-item-qty-row">
                        <button onClick={() => item.onQtyChange(item.productId, item.quantity - 1)} disabled={item.quantity <= 1}>-</button>
                        <span>{item.quantity}</span>
                        <button onClick={() => item.onQtyChange(item.productId, item.quantity + 1)}>+</button>
                      </div>
                    </div>
                    <div className="cart-item-price-col">
                       <strong>{formatPrice(item.price * item.quantity)}</strong>
                       <button className="cart-item-remove" onClick={() => item.onRemove(item.productId)}>Eliminar</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="cart-summary-col">
                <div className="cart-totals">
                   <div className="total-row">
                      <span>Subtotal</span>
                      <span>{formatPrice(totalBase)}</span>
                   </div>
                   <div className="total-row main">
                      <span>TOTAL</span>
                      <strong>{formatPrice(totalBase)}</strong>
                   </div>
                   <button className="button main-checkout-btn" onClick={handleContinueFromCart}>
                     CONTINUAR COMPRA
                   </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {step === "contact" && (
        <div className="form-view">
           <h2>Datos de contacto</h2>
           <form className="checkout-form-styled" onSubmit={handleFinishContact}>
              <input 
                type="text" 
                placeholder="Nombre completo" 
                value={form.customerName}
                onChange={e => setForm({...form, customerName: e.target.value})}
                required 
              />
              <input 
                type="text" 
                placeholder="Teléfono" 
                value={form.phone}
                onChange={e => setForm({...form, phone: e.target.value})}
                required 
              />
              <button type="submit" className="button main-checkout-btn">CONTINUAR</button>
           </form>
           <button className="back-link" onClick={() => setStep("cart")}>Volver al carrito</button>
        </div>
      )}

      {step === "payment_choice" && (
        <div className="payment-choice-view">
           <h2>Elegí un medio de pago</h2>
           <p className="helper">Hola {form.customerName.split(" ")[0]}, ¿Cómo preferís pagar?</p>
           
           <div className="payment-grid">
              <div className="payment-card-option" onClick={() => handleSelectPayment("transfer")}>
                 <div className="payment-icon">🏦</div>
                 <h3>Transferencia</h3>
                 <p>Pagás el precio normal</p>
                 <div className="payment-price">{formatPrice(totalBase)}</div>
              </div>

              <div className="payment-card-option highlight" onClick={() => handleSelectPayment("card")}>
                 <div className="payment-icon">💳</div>
                 <h3>Tarjeta de Débito / Crédito</h3>
                 <p className="fee-warning">Tiene un recargo del {CARD_SURCHARGE_PERCENT}%</p>
                 <div className="payment-price">{formatPrice(totalWithCard)}</div>
              </div>
           </div>
           
           <button className="back-link" onClick={() => customerProfile ? setStep("cart") : setStep("contact")}>Volver atrás</button>
        </div>
      )}

      {step === "card_form" && (
        <div className="form-view">
           <h2>Pago con Tarjeta</h2>
           <p className="helper">Vas a pagar {formatPrice(totalWithCard)}</p>
           <form className="checkout-form-styled" onSubmit={handleFinalCardPayment}>
              {/* Aquí se integraria el SDK de MP, por ahora simulamos con el boton principal */}
              <button type="submit" className="button main-checkout-btn" disabled={loading}>
                 {loading ? "CARGANDO..." : `PAGAR ${formatPrice(totalWithCard)}`}
              </button>
           </form>
           <button className="back-link" onClick={() => setStep("payment_choice")}>Cambiar medio de pago</button>
           {status && <p className="error-msg">{status}</p>}
        </div>
      )}

      {step === "transfer_done" && (
        <div className="transfer-done-view">
           <div className="transfer-header">
              <div className="check-icon">⌛</div>
              <h2>En espera de pago</h2>
           </div>
           <p>¡Hola! ¿Cómo estás? Podés hacer transferencia bancaria a la siguiente cuenta dentro de las primeras 12hs:</p>
           
           <div className="bank-details-box">
              <h3>Mercado Pago</h3>
              <p><strong>Alias:</strong> Traviesa49</p>
              <p><strong>Titular:</strong> Elina Zulma Velazque</p>
           </div>

           <div className="transfer-notice">
              SI NO RECIBIMOS EL PAGO DENTRO DE LAS PRIMERAS 12 HS DE HABER EFECTUADO LA COMPRA, LA MISMA SE CANCELARÁ PARA QUE LOS PRODUCTOS VUELVAN A STOCK.
           </div>

           <p className="whatsapp-help">
              Por favor envianos tu comprobante de pago por Whatsapp al <strong>+54 9 3513 74-9655</strong> e indicanos tu nombre.
           </p>

           <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="button whatsapp-btn">
              ENVIAR COMPROBANTE POR WHATSAPP
           </a>

           <Link to="/" className="back-to-home" onClick={onClear}>Cerrar y volver a la tienda</Link>
        </div>
      )}
    </div>
  );
}

export default Checkout;
