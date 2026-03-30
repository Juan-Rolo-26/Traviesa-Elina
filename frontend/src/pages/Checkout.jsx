import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { initPayment, processPayment, submitTransferOrder } from "../api";

const CARD_SURCHARGE_PERCENT = 3.55;
const MP_PUBLIC_KEY = "APP_USR-fe20fb80-4632-4ce1-b6c7-2be026e4d938";

function formatPrice(num) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(num);
}

function Checkout({ cart, onClear, customerToken, customerProfile, onAuthOpen, isGuest, guestData, onRemove, onQtyChange }) {
  const [step, setStep] = useState("cart"); 
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [paymentType, setPaymentType] = useState(null); 
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [orderId, setOrderId] = useState(null);
  const bricksBuilderRef = useRef(null);

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
    setShowPaymentOptions(true);
  };

  const handleSelectPayment = (type) => {
    setPaymentType(type);
  };

  const handleFinalizePurchase = () => {
    if (!paymentType) {
      setStatus("Falta seleccionar un medio de pago.");
      return;
    }
    if (paymentType === "transfer") {
      initTransferFlow();
    } else {
      initCardPaymentFlow();
    }
  };

  const initTransferFlow = async () => {
    setLoading(true);
    setStatus("");
    try {
      const payload = {
        items: cart.map(i => ({ 
          productId: i.productId, 
          quantity: i.quantity,
          productName: i.name,
          productPrice: i.price
        })),
        customerData: {
          customerName: currentProfile?.customerName || (currentProfile?.firstName ? `${currentProfile.firstName} ${currentProfile.lastName || ""}` : "Cliente"),
          phone: currentProfile?.phone || "0000000000",
          email: currentProfile?.email || "test@test.com",
          province: "CÓRDOBA",
          city: "CÓRDOBA",
          address1: "RETIRO EN LOCAL",
          postalCode: "5000",
          deliveryMethod: "PICKUP"
        },
      };
      const res = await submitTransferOrder(payload, customerToken);
      setOrderId(res.id);
      setStep("transfer_success");
      onClear();
    } catch (err) {
      setStatus("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const initCardPaymentFlow = async () => {
    setLoading(true);
    setStatus("");
    try {
      const payload = {
        items: cart.map(i => ({ 
          productId: i.productId, 
          quantity: i.quantity,
          productName: i.name,
          productPrice: i.price
        })),
        customerData: {
          customerName: currentProfile?.customerName || (currentProfile?.firstName ? `${currentProfile.firstName} ${currentProfile.lastName || ""}` : "Cliente"),
          phone: currentProfile?.phone || "0000000000",
          email: currentProfile?.email || "test@test.com",
          province: "CÓRDOBA",
          city: "CÓRDOBA",
          address1: "RETIRO EN LOCAL",
          postalCode: "5000",
          deliveryMethod: "PICKUP"
        },
        totalAmount: totalWithCard,
        surchargePercent: CARD_SURCHARGE_PERCENT
      };
      const res = await initPayment(payload, customerToken);
      setOrderId(res.orderId);
      setStep("card_form");
    } catch (err) {
      setStatus("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Efecto para montar el Brick de Mercado Pago
  useEffect(() => {
    if (step === "card_form" && orderId && !bricksBuilderRef.current) {
      const mp = new window.MercadoPago(MP_PUBLIC_KEY, { locale: 'es-AR' });
      const bricksBuilder = mp.bricks();
      bricksBuilderRef.current = bricksBuilder;

      const renderCardPaymentBrick = async (bricksBuilder) => {
        const settings = {
          initialization: {
            amount: totalWithCard,
            payer: {
              email: currentProfile?.email || "test@test.com",
            },
          },
          customization: {
            visual: {
              style: {
                theme: 'default', // o 'bootstrap', 'dark'
              },
            },
          },
          callbacks: {
            onReady: () => {
              console.log("Brick Ready");
              setLoading(false);
            },
            onSubmit: async (formData) => {
              setLoading(true);
              setStatus("Procesando pago seguro...");
              try {
                const payload = {
                  orderId,
                  token: formData.token,
                  payment_method_id: formData.payment_method_id,
                  issuer_id: formData.issuer_id,
                  installments: formData.installments,
                  transaction_amount: totalWithCard,
                  payer: {
                    email: formData.payer.email,
                    identification: formData.payer.identification
                  }
                };
                const res = await processPayment(payload, customerToken);
                if (res.paymentStatus === "approved") {
                  setStep("success");
                  onClear();
                } else {
                  setStatus("El pago fue rechazado. Reintente con otra tarjeta.");
                  setLoading(false);
                }
              } catch (err) {
                setStatus("Error: " + err.message);
                setLoading(false);
              }
            },
            onError: (error) => {
              console.error(error);
              setStatus("Error en el procesador de pagos.");
              setLoading(false);
            },
          },
        };
        await bricksBuilder.create('cardPayment', 'cardPaymentBrick_container', settings);
      };

      renderCardPaymentBrick(bricksBuilder);
    }
    
    return () => {
      // Limpieza si el componente se desmonta o cambia de paso
    };
  }, [step, orderId, totalWithCard, currentProfile, customerToken]);

  const whatsappLink = useMemo(() => {
    const name = currentProfile?.customerName || currentProfile?.firstName || "Cliente";
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
                         <button onClick={() => onQtyChange(item.productId, item.quantity - 1)} disabled={item.quantity <= 1}>-</button>
                        <span>{item.quantity}</span>
                         <button onClick={() => onQtyChange(item.productId, item.quantity + 1)} disabled={item.quantity >= (item.stock ?? 1)}>+</button>
                      </div>
                    </div>
                    <div className="checkout-item-price">
                       <strong>{formatPrice(item.price * item.quantity)}</strong>
                        <button className="remove-item-link" onClick={() => onRemove(item.productId)}>Eliminar</button>
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
                      <strong>{formatPrice(paymentType === 'card' ? totalWithCard : totalBase)}</strong>
                   </div>

                   {!showPaymentOptions ? (
                     <button className="button pill-checkout-btn" onClick={handleContinueFromCart}>
                       CONTINUAR COMPRA
                     </button>
                   ) : (
                     <div className="inline-payment-options">
                        <h3 style={{ marginTop: '20px', marginBottom: '10px' }}>Medios de pago</h3>
                        <div className="payment-options-list">
                          <button className={`payment-option-list-item ${paymentType === 'transfer' ? 'selected' : ''}`} onClick={() => handleSelectPayment("transfer")}>
                             <div className="po-radio"></div>
                             <div className="po-content">
                                <span className="po-title">Transferencia</span>
                                <span className="po-desc">Pagás el precio normal</span>
                             </div>
                             <div className="po-extra">Normal</div>
                          </button>

                          <button className={`payment-option-list-item ${paymentType === 'card' ? 'selected' : ''}`} onClick={() => handleSelectPayment("card")}>
                             <div className="po-radio"></div>
                             <div className="po-content">
                                <span className="po-title">Tarjeta de Débito / Crédito</span>
                                <span className="po-desc">Con recargo del {CARD_SURCHARGE_PERCENT}%</span>
                             </div>
                             <div className="po-extra surcharge">+ {CARD_SURCHARGE_PERCENT}%</div>
                          </button>
                        </div>
                        {status && <p className="status-info error" style={{marginTop: '10px'}}>{status}</p>}
                        <button className="button pill-checkout-btn" style={{ marginTop: '15px' }} onClick={handleFinalizePurchase} disabled={loading}>
                          {loading ? "PROCESANDO..." : "FINALIZAR COMPRA"}
                        </button>
                     </div>
                   )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {step === "card_form" && (
        <div className="card-form-container">
           <h2>Pago Seguro con Tarjeta</h2>
           <div className="payment-summary-box">
              <p>Total a pagar con recargo: <strong>{formatPrice(totalWithCard)}</strong></p>
           </div>
           
           {/* Contenedor del Brick de Mercado Pago */}
           <div id="cardPaymentBrick_container"></div>
           
           <button className="back-btn-link" onClick={() => { setStep("payment_choice"); bricksBuilderRef.current = null; }}>Cambiar medio de pago</button>
           {status && <p className="status-info">{status}</p>}
           {loading && <p className="status-info">Procesando...</p>}
        </div>
      )}

      {step === "success" && (
        <div className="success-container">
           <div className="check-circle-anim">✓</div>
           <h2>¡Tu pago fue aprobado exitosamente!</h2>
           <p>Gracias por tu compra. Te llegará una confirmación a tu email.</p>
           <Link to="/" className="button pill-checkout-btn">Volver al inicio</Link>
        </div>
      )}

      {step === "transfer_success" && (
        <div className="transfer-success-wrapper">
           <div className="transfer-success-top">
             <div className="ts-circle">
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
             </div>
             <p className="ts-subtitle">PEDIDO CONFIRMADO</p>
             <h2 className="ts-title">Gracias por tu compra</h2>
             <p className="ts-text">
                {currentProfile?.customerName?.split(" ")[0] || currentProfile?.firstName || "Cliente"}, recibimos tu pedido y en breve nos comunicaremos para darte mas informacion sobre el estado, medios de pago y coordinacion de entrega.
             </p>
           </div>
           
           <div className="transfer-success-bottom">
              <div className="ts-card">
                 <p className="ts-card-subtitle">NUMERO DE PEDIDO</p>
                 <h3 className="ts-card-value">#{String(orderId).replace(/\D/g, '').slice(-5).padStart(5, String(orderId).slice(-1).toUpperCase() || 'A')}</h3>
                 <p className="ts-card-text">
                   Guardalo para futuras consultas.<br/>
                   Tambien podremos identificar tu compra<br/>con este numero si nos escribis.
                 </p>
              </div>

              <div className="ts-card">
                 <p className="ts-card-subtitle">PROXIMO PASO</p>
                 <p className="ts-card-text" style={{marginBottom: '30px'}}>
                   Nuestro equipo va a revisar tu pedido y te contactaremos para confirmar disponibilidad, formas de pago y envio.
                 </p>
                 <div className="ts-btn-wrap">
                   <Link to="/" className="ts-btn">
                      Seguir viendo productos <span>→</span>
                   </Link>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

export default Checkout;
