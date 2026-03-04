import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  deleteSavedPaymentMethod,
  fetchPaymentStatus,
  initPayment,
  processPayment,
} from "../api";
import { formatPrice } from "../utils/format";
import { fetchArgCitiesByProvince, fetchArgProvinces } from "../services/argGeo";

const MP_PUBLIC_KEY = import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY;
const DEVICE_SESSION_WAIT_ATTEMPTS = 12;
const DEVICE_SESSION_WAIT_MS = 200;

function hasStoredAddress(profile) {
  if (!profile) return false;
  return Boolean(
    profile.firstName &&
      profile.lastName &&
      profile.province &&
      profile.city &&
      profile.address1 &&
      profile.postalCode &&
      profile.phone
  );
}

function buildAddressText(profile) {
  if (!profile) return "";
  return [profile.address1, profile.city, profile.province, profile.postalCode]
    .filter(Boolean)
    .join(" · ");
}

function isValidArgentinaPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 13;
}

function Checkout({ cart, onClear, customerToken, customerProfile }) {
  const location = useLocation();
  const [step, setStep] = useState("cart");
  const [form, setForm] = useState({
    customerName: "",
    province: "",
    city: "",
    address1: "",
    address2: "",
    postalCode: "",
    phone: "",
    deliveryMethod: "PICKUP",
  });
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editingShipping, setEditingShipping] = useState(true);
  const [setAsNewLocation, setSetAsNewLocation] = useState(false);
  const [savePaymentMethod, setSavePaymentMethod] = useState(false);
  const [warnings, setWarnings] = useState({});
  const [paymentSession, setPaymentSession] = useState(null);
  const [savedMethods, setSavedMethods] = useState([]);
  const [selectedMethodId, setSelectedMethodId] = useState(null);
  const [paymentResult, setPaymentResult] = useState(null);
  const [brickReady, setBrickReady] = useState(false);
  const [deviceSessionId, setDeviceSessionId] = useState(null);
  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);

  const warningTimers = useRef({});
  const brickControllerRef = useRef(null);

  const waitForDeviceSessionId = async () => {
    const readId = () =>
      String(deviceSessionId || window.MP_DEVICE_SESSION_ID || "").trim();

    const immediate = readId();
    if (immediate) return immediate;

    for (let attempt = 0; attempt < DEVICE_SESSION_WAIT_ATTEMPTS; attempt += 1) {
      await new Promise((resolve) => {
        setTimeout(resolve, DEVICE_SESSION_WAIT_MS);
      });
      const value = readId();
      if (value) return value;
    }

    return undefined;
  };

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );

  const hasSavedLocation = Boolean(customerToken && hasStoredAddress(customerProfile));

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("step") === "checkout") {
      setStep("checkout");
    }
  }, [location.search]);

  useEffect(() => {
    if (!customerProfile) {
      setEditingShipping(true);
      return;
    }

    const fullName = [customerProfile.firstName, customerProfile.lastName]
      .filter(Boolean)
      .join(" ");

    setForm((prev) => ({
      ...prev,
      customerName: fullName || prev.customerName,
      province: customerProfile.province || prev.province,
      city: customerProfile.city || prev.city,
      address1: customerProfile.address1 || prev.address1,
      address2: customerProfile.address2 || prev.address2,
      postalCode: customerProfile.postalCode || prev.postalCode,
      phone: customerProfile.phone || prev.phone,
    }));

    setEditingShipping(!hasStoredAddress(customerProfile));
    setSavedMethods(customerProfile.savedPaymentMethods || []);
    setSelectedMethodId(customerProfile.savedPaymentMethods?.[0]?.id || null);
  }, [customerProfile]);

  useEffect(() => {
    if (!customerToken) {
      setSavedMethods([]);
      setSelectedMethodId(null);
      setSavePaymentMethod(false);
      setEditingShipping(true);
      setSetAsNewLocation(false);
    }
  }, [customerToken]);

  useEffect(() => {
    let active = true;
    fetchArgProvinces().then((items) => {
      if (active) setProvinces(items);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!form.province) {
      setCities([]);
      return () => {
        active = false;
      };
    }
    fetchArgCitiesByProvince(form.province).then((items) => {
      if (active) setCities(items);
    });
    return () => {
      active = false;
    };
  }, [form.province]);

  useEffect(() => {
    if (step !== "payment" || !paymentSession) return undefined;
    if (!MP_PUBLIC_KEY) {
      setStatus("Falta VITE_MERCADOPAGO_PUBLIC_KEY en frontend/.env");
      return undefined;
    }

    let cancelled = false;

    const mountBrick = async () => {
      try {
        setBrickReady(false);
        if (!window.MercadoPago) {
          await new Promise((resolve, reject) => {
            const existing = document.querySelector('script[data-mp-sdk="true"]');
            if (existing) {
              existing.addEventListener("load", resolve, { once: true });
              existing.addEventListener("error", reject, { once: true });
              return;
            }
            const script = document.createElement("script");
            script.src = "https://sdk.mercadopago.com/js/v2";
            script.dataset.mpSdk = "true";
            script.onload = resolve;
            script.onerror = reject;
            document.body.appendChild(script);
          });
        }

        if (cancelled) return;

        const mp = new window.MercadoPago(MP_PUBLIC_KEY, { locale: "es-AR" });
        const bricksBuilder = mp.bricks();

        if (brickControllerRef.current?.unmount) {
          await brickControllerRef.current.unmount();
        }

        brickControllerRef.current = await bricksBuilder.create(
          "cardPayment",
          "mp-card-payment-brick",
          {
            initialization: {
              amount: paymentSession.amount,
              payer: {
                email: customerProfile?.email || undefined,
              },
            },
            callbacks: {
              onReady: () => {
                if (!cancelled) setBrickReady(true);
              },
              onSubmit: async (cardFormData) => {
                setLoading(true);
                setStatus(null);
                setPaymentResult(null);
                try {
                  const resolvedDeviceSessionId = await waitForDeviceSessionId();
                  if (resolvedDeviceSessionId && resolvedDeviceSessionId !== deviceSessionId) {
                    setDeviceSessionId(resolvedDeviceSessionId);
                  }

                  const result = await processPayment(
                    {
                      ...cardFormData,
                      orderId: paymentSession.orderId,
                      transaction_amount: paymentSession.amount,
                      payer: {
                        ...(cardFormData?.payer || {}),
                        email:
                          cardFormData?.payer?.email ||
                          customerProfile?.email ||
                          undefined,
                      },
                      deviceSessionId: resolvedDeviceSessionId,
                      savePaymentMethod: Boolean(customerToken && savePaymentMethod),
                      selectedSavedMethodId: selectedMethodId,
                    },
                    customerToken
                  );

                  setPaymentResult(result);

                  if (result.paymentStatus === "approved") {
                    onClear?.();
                    setStatus("Pago aprobado. Pedido confirmado.");
                  } else if (result.paymentStatus === "pending" || result.paymentStatus === "in_process") {
                    setStatus("Pago pendiente. Te avisaremos cuando se confirme.");
                  } else {
                    setStatus("Pago rechazado. Puedes intentar con otra tarjeta.");
                  }
                } catch (error) {
                  setStatus(error.message);
                  throw error;
                } finally {
                  setLoading(false);
                }
              },
              onError: (error) => {
                setStatus(error?.message || "Error al cargar Mercado Pago Brick");
              },
            },
          }
        );
      } catch (error) {
        setStatus("No se pudo cargar Mercado Pago Brick");
      }
    };

    mountBrick();

    return () => {
      cancelled = true;
    };
  }, [
    step,
    paymentSession,
    customerProfile?.email,
    customerToken,
    savePaymentMethod,
    selectedMethodId,
    onClear,
  ]);

  useEffect(() => {
    if (step !== "payment") return undefined;

    let cancelled = false;
    const existing = document.querySelector('script[data-mp-security="true"]');

    const updateDeviceId = () => {
      const id = window.MP_DEVICE_SESSION_ID;
      if (!cancelled && id) {
        setDeviceSessionId(String(id));
      }
    };

    if (existing) {
      updateDeviceId();
      return () => {
        cancelled = true;
      };
    }

    const script = document.createElement("script");
    script.src = "https://www.mercadopago.com/v2/security.js";
    script.setAttribute("view", "checkout");
    script.dataset.mpSecurity = "true";
    script.onload = updateDeviceId;
    script.onerror = () => {};
    document.body.appendChild(script);

    const timer = setTimeout(updateDeviceId, 1200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [step]);

  useEffect(() => {
    if (step !== "payment" || !paymentSession?.orderId || !paymentResult?.paymentStatus) return;

    const currentStatus = String(paymentResult.paymentStatus);
    if (!["in_process", "pending", "authorized"].includes(currentStatus)) return;

    let cancelled = false;
    let timerId;
    let attempts = 0;
    const maxAttempts = 24; // ~2 minutes

    const poll = async () => {
      if (cancelled) return;
      attempts += 1;
      try {
        const latest = await fetchPaymentStatus(paymentSession.orderId, customerToken);
        if (cancelled || !latest) return;

        setPaymentResult((prev) => ({ ...(prev || {}), ...latest }));

        if (latest.paymentStatus === "approved") {
          onClear?.();
          setStatus("Pago aprobado. Pedido confirmado.");
          return;
        }

        if (["rejected", "cancelled"].includes(String(latest.paymentStatus || ""))) {
          setStatus("Pago rechazado. Puedes intentar con otra tarjeta.");
          return;
        }
      } catch (_) {
        // Continue polling silently for transient/network issues.
      }

      if (attempts < maxAttempts && !cancelled) {
        timerId = setTimeout(poll, 5000);
      }
    };

    timerId = setTimeout(poll, 5000);

    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [step, paymentSession?.orderId, paymentResult?.paymentStatus, customerToken, onClear]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => {
      if (name === "province") {
        return { ...prev, province: value, city: "" };
      }
      return { ...prev, [name]: value };
    });
  };

  const showWarning = (productId) => {
    setWarnings((prev) => ({ ...prev, [productId]: true }));
    if (warningTimers.current[productId]) clearTimeout(warningTimers.current[productId]);
    warningTimers.current[productId] = setTimeout(() => {
      setWarnings((prev) => ({ ...prev, [productId]: false }));
    }, 2000);
  };

  const getCheckoutCustomerData = () => {
    return {
      ...form,
      deliveryMethod: "PICKUP",
      province: form.province || customerProfile?.province || "CABA",
      city: form.city || customerProfile?.city || "CABA",
      address1: form.address1 || customerProfile?.address1 || "Retiro por local",
      address2: form.address2 || customerProfile?.address2 || "",
      postalCode: form.postalCode || customerProfile?.postalCode || "1000",
    };
  };

  const handleInitPayment = async (event) => {
    event.preventDefault();
    if (cart.length === 0) {
      setStatus("El lote esta vacio.");
      return;
    }

    const customerData = getCheckoutCustomerData();
    if (!isValidArgentinaPhone(customerData.phone)) {
      setStatus("Ingresa un telefono valido de Argentina (10 a 13 digitos).");
      return;
    }
    const saveCustomerData = false;

    setLoading(true);
    setStatus(null);
    setPaymentResult(null);

    try {
      const session = await initPayment(
        {
          customerData,
          items: cart.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
          totalAmount: total,
          saveCustomerData,
        },
        customerToken
      );

      setPaymentSession(session);
      setSavedMethods(session.savedPaymentMethods || []);
      setSelectedMethodId(session.savedPaymentMethods?.[0]?.id || null);
      setStep("payment");
      setStatus("Pedido creado. Completa el pago con Mercado Pago.");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSavedMethod = async (id) => {
    if (!customerToken) return;
    try {
      await deleteSavedPaymentMethod(customerToken, id);
      const nextMethods = savedMethods.filter((method) => method.id !== id);
      setSavedMethods(nextMethods);
      if (selectedMethodId === id) {
        setSelectedMethodId(nextMethods[0]?.id || null);
      }
      setStatus("Metodo de pago guardado eliminado.");
    } catch (error) {
      setStatus(error.message);
    }
  };

  return (
    <div className={`grid${step === "payment" ? " checkout-payment-grid" : ""}`} style={{ gridTemplateColumns: step === "cart" ? "1fr" : "1.2fr 1fr" }}>
      {(step === "cart" || step === "checkout") && (
        <div className="form">
          <h2>{step === "cart" ? "Mi paquete:" : "Checkout"}</h2>
          {cart.length === 0 && <p className="helper">No hay productos en el lote.</p>}
          <div className="table">
            {cart.map((item) => (
              <div className="cart-item" key={item.productId}>
                <img src={item.image} alt={item.name} />
                <div className="cart-item-info">
                  <strong>{item.name}</strong>
                  <span className="helper">
                    Ancho: {item.width} · Alto: {item.height} · Peso: {item.weight}
                  </span>
                  <div className="qty-control cart-qty">
                    <button
                      type="button"
                      onClick={() =>
                        item.onQtyChange?.(item.productId, Math.max(1, item.quantity - 1))
                      }
                      disabled={item.quantity <= 1}
                    >
                      -
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (item.stock && item.quantity + 1 > item.stock) {
                          showWarning(item.productId);
                          return;
                        }
                        item.onQtyChange?.(item.productId, item.quantity + 1);
                      }}
                    >
                      +
                    </button>
                  </div>
                  {warnings[item.productId] && (
                    <span className="helper">no hay esa cantidad en el stock</span>
                  )}
                </div>
                <strong>{formatPrice(item.price * item.quantity)}</strong>
                <button
                  className="cart-remove"
                  type="button"
                  onClick={() => item.onRemove?.(item.productId)}
                  aria-label="Eliminar"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="table-row">
            <span>Total</span>
            <strong>{formatPrice(total)}</strong>
          </div>

          {step === "cart" ? (
            <button
              className="button"
              type="button"
              disabled={cart.length === 0}
              onClick={() => setStep("checkout")}
            >
              Continuar compra
            </button>
          ) : (
            <form className="checkout-form" onSubmit={handleInitPayment}>
              <>
                <input
                  name="customerName"
                  placeholder="Nombre y apellido"
                  value={form.customerName}
                  onChange={handleChange}
                  required
                />
                <input
                  name="phone"
                  placeholder="Telefono"
                  value={form.phone}
                  onChange={handleChange}
                  inputMode="numeric"
                  required
                />
              </>

              <button className="button" type="submit" disabled={loading}>
                {loading ? "Preparando pago..." : "Finalizar compra"}
              </button>
            </form>
          )}

          {status && <p className="helper">{status}</p>}
        </div>
      )}

      {step === "payment" && (
        <>
          <div className="form">
            <h2>Pago seguro</h2>
            <p className="helper">
              Mercado Pago procesa la tarjeta de forma tokenizada. La tienda no almacena numero, CVV ni vencimiento.
            </p>

            {savedMethods.length > 0 && (
              <div className="saved-methods">
                <h3>Metodo guardado</h3>
                {savedMethods.map((method) => (
                  <label key={method.id} className="saved-method-row">
                    <input
                      type="radio"
                      name="saved-method"
                      checked={selectedMethodId === method.id}
                      onChange={() => setSelectedMethodId(method.id)}
                    />
                    <span>
                      {String(method.brand || "Tarjeta").toUpperCase()} terminada en {method.last4}
                    </span>
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => handleDeleteSavedMethod(method.id)}
                    >
                      Eliminar
                    </button>
                  </label>
                ))}
                <p className="helper">Puedes cambiar o eliminar metodos guardados.</p>
              </div>
            )}

            {customerToken && (
              <label className="helper checkbox-inline">
                <input
                  type="checkbox"
                  checked={savePaymentMethod}
                  onChange={(event) => setSavePaymentMethod(event.target.checked)}
                />
                Guardar este metodo de pago para futuras compras
              </label>
            )}

            <div id="mp-card-payment-brick" className="mp-brick-container" />
            {!brickReady && <p className="helper">Cargando formulario de tarjeta...</p>}

            {paymentResult && (
              <>
                <p className="helper">
                  Estado del pago: <strong>{paymentResult.paymentStatus}</strong>
                </p>
                {paymentResult.statusDetail && (
                  <p className="helper">Detalle: {paymentResult.statusDetail}</p>
                )}
              </>
            )}

            <button className="button secondary" type="button" onClick={() => setStep("checkout")}>
              Volver al checkout
            </button>
            {status && <p className="helper">{status}</p>}
          </div>

          <div className="form checkout-summary">
            <h2>Resumen</h2>
            <div className="table-row">
              <span>Total a pagar</span>
              <strong>{formatPrice(total)}</strong>
            </div>
            <p className="helper">Pedido: {paymentSession?.orderId || "-"}</p>
          </div>
        </>
      )}
    </div>
  );
}

export default Checkout;
