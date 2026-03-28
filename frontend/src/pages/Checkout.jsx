import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { initPayment } from "../api";

const CARD_SURCHARGE_PERCENT = 3.55;

function formatPrice(num) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(num);
}

function Checkout({ cart, onClear, customerToken, customerProfile, onAuthOpen, isGuest, guestData }) {
  const [step, setStep] = useState("cart"); // cart, payment_choice, card_form, transfer_done
  const [paymentType, setPaymentType] = useState(null); // 'card' or 'transfer'
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

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

  const currentProfile = customerProfile || guestData;

  const handleContinueFromCart = () => {
    if (!customerProfile && !isGuest) {
      onAuthOpen();
      return;
    }
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
      const payload = {
        items: cart,
        customerName: currentProfile?.customerName || "Cliente",
        phone: currentProfile?.phone || "",
        total: totalWithCard,
        method: "card"
      };
      const res = await initPayment(payload, customerToken);
      window.location.href = res.init_point;
    } catch (err) {
      setStatus("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const whatsappLink = useMemo(() => {
    const name = currentProfile?.customerName || "Cliente";
    const text = encodeURIComponent(
      `¡Hola Traviesa! Mi nombre es ${name}. Acabo de realizar un pedido por transferencia por un total de ${formatPrice(totalBase)}. 
Mi número de teléfono es ${currentProfile?.phone || ""}. 
Adjunto el comprobante de pago.`
    );
    return `https://wa.me/5493513749655?text=${text}`;
  }, [currentProfile, totalBase]);

  return (
    <div className="checkout-page container">
      {step === "cart" && (
        <div className="cart-view-container">
          <h2 className="cart-title">Mi carrito ({cart.length})</h2>
          {cart.length === 0 ? (
            <div className="cart-empty-state">
              <p>Tu carrito está vacío</p>
              <Link to="/" className="button secondary">Volver a la tienda</Link>
            </div>
          ) : (
            <div className="checkout-layout">
              <div className="items-section">
                {cart.map((item) => (
                  <div key={item.productId} className="checkout-item">
                    <img src={item.image} alt={item.name} className="checkout-item-img" />
                    <div className="checkout-item-details">
                      <h3>{item.name}</h3>
                      <div className="qty-control">
                        <button onClick={() => item.onQtyChange(item.productId, item.quantity - 1)} disabled={item.quantity <= 1}>-</button>
                        <span>{item.quantity}</span>
                        <button onClick={() => item.onQtyChange(item.productId, item.quantity + 1)}>+</button>
                      </div>
                    </div>
                    <div className="checkout-item-price">
                       <strong>{formatPrice(item.price * item.quantity)}</strong>
                       <button className="remove-item-link" onClick={() => item.onRemove(item.productId)}>Eliminar</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="summary-section">
                <div className="summary-card-pure">
                   <div className="summary-row">
                      <span>Subtotal</span>
                      <span>{formatPrice(totalBase)}</span>
                   </div>
                   <div className="summary-row total-big">
                      <span>TOTAL</span>
                      <strong>{formatPrice(totalBase)}</strong>
                   </div>
                   <button className="button pill-checkout-btn" onClick={handleContinueFromCart}>
                     CONTINUAR COMPRA
                   </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {step === "payment_choice" && (
        <div className="payment-choice-container">
           <h2>Elegí un medio de pago</h2>
           <p className="payment-welcome">Hola {currentProfile?.customerName?.split(" ")[0] || ""}, ¿Cómo preferís pagar?</p>
           
           <div className="payment-options-grid">
              <button className="payment-option-btn" onClick={() => handleSelectPayment("transfer")}>
                 <span className="p-icon">🏦</span>
                 <div className="p-texts">
                    <strong>Transferencia</strong>
                    <span>Pagás el precio normal</span>
                 </div>
                 <div className="p-amount">{formatPrice(totalBase)}</div>
              </button>

              <button className="payment-option-btn card-highlight" onClick={() => handleSelectPayment("card")}>
                 <span className="p-icon">💳</span>
                 <div className="p-texts">
                    <strong>Tarjeta de Débito / Crédito</strong>
                    <span className="p-surcharge">Con recargo del {CARD_SURCHARGE_PERCENT}%</span>
                 </div>
                 <div className="p-amount">{formatPrice(totalWithCard)}</div>
              </button>
           </div>
           
           <button className="back-btn-link" onClick={() => setStep("cart")}>Volver al carrito</button>
        </div>
      )}

      {step === "card_form" && (
        <div className="card-form-container">
           <h2>Pago Seguro con Tarjeta</h2>
           <div className="payment-summary-box">
              <p>Total a pagar con recargo: <strong>{formatPrice(totalWithCard)}</strong></p>
           </div>
           <form className="card-mock-form" onSubmit={handleFinalCardPayment}>
              <p className="security-notice">Serás redirigido a la plataforma segura de pagos.</p>
              <button type="submit" className="button pill-checkout-btn" disabled={loading}>
                 {loading ? "PROCESANDO..." : `PAGAR ${formatPrice(totalWithCard)}`}
              </button>
           </form>
           <button className="back-btn-link" onClick={() => setStep("payment_choice")}>Cambiar medio de pago</button>
           {status && <p className="status-info">{status}</p>}
        </div>
      )}

      {step === "transfer_done" && (
        <div className="transfer-details-container">
           <div className="transfer-header-status">
              <span className="wait-icon">⌛</span>
              <h2>En espera de pago</h2>
           </div>
           <p className="transfer-intro">¡Hola! ¿Cómo estás? Podés hacer transferencia bancaria a la siguiente cuenta dentro de las primeras 12hs:</p>
           
           <div className="bank-info-card">
              <h3>Mercado Pago</h3>
              <div className="info-line"><span>Alias:</span> <strong>Traviesa49</strong></div>
              <div className="info-line"><span>Titular:</span> <strong>Elina Zulma Velazque</strong></div>
           </div>

           <div className="warning-red-caps">
              SI NO RECIBIMOS EL PAGO DENTRO DE LAS PRIMERAS 12 HS DE HABER EFECTUADO LA COMPRA, LA MISMA SE CANCELARÁ PARA QUE LOS PRODUCTOS VUELVAN A STOCK Y PUEDAN SER ADQUIRIDOS POR OTRA PERSONA.
           </div>

           <p className="wa-instructions">
              Por favor envianos tu comprobante de pago por Whatsapp al <strong>+54 9 3513 74-9655</strong> e indicanos tu nombre.
           </p>

           <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="button whatsapp-success-btn">
              ENVIAR COMPROBANTE POR WHATSAPP
           </a>

           <Link to="/" className="home-exit-link" onClick={onClear}>Volver al inicio de la tienda</Link>
        </div>
      )}
    </div>
  );
}

export default Checkout;
