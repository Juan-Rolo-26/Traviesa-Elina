import React, { useMemo, useRef, useState } from "react";
import { Routes, Route, Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import Lottie from "lottie-react";
import Home from "./pages/Home";
import Checkout from "./pages/Checkout";
import AdminLogin from "./pages/AdminLogin";
import AdminPanel from "./pages/AdminPanel";
import ProductDetail from "./pages/ProductDetail";
import LocationPage from "./pages/LocationPage";
import PurchasesPage from "./pages/PurchasesPage";
import logo from "./assets/logo.png";
import routeLoaderAnimation from "./assets/route-loader.json";
import AuthModal from "./components/AuthModal";
import { fetchCustomer } from "./api";

function parseJwtPayload(token) {
  try {
    const [, payload] = String(token || "").split(".");
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch (_) {
    return null;
  }
}

function formatLocation(profile) {
  if (!profile?.address1) return "Agregar ubicacion";
  const line = [profile.address1, profile.city, profile.province].filter(Boolean).join(" · ");
  return line || "Agregar ubicacion";
}

function App() {
  const [cart, setCart] = useState([]);
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem("adminToken"));
  const [customerToken, setCustomerToken] = useState(
    () => localStorage.getItem("auth_token") || localStorage.getItem("customerToken")
  );
  const [customerProfile, setCustomerProfile] = useState(null);
  const [customerIsAdmin, setCustomerIsAdmin] = useState(() => localStorage.getItem("customerIsAdmin") === "true");
  const [authOpen, setAuthOpen] = useState(false);
  const [authToast, setAuthToast] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [lotPulse, setLotPulse] = useState(false);
  const [lotOpen, setLotOpen] = useState(false);
  const [lotPreviewOpen, setLotPreviewOpen] = useState(false);
  const [routeLoading, setRouteLoading] = useState(true);
  const lotIconRef = useRef(null);
  const routeTimerRef = useRef(null);
  const lotPreviewCloseTimerRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  const startRouteLoader = React.useCallback(() => {
    if (routeTimerRef.current) clearTimeout(routeTimerRef.current);
    setRouteLoading(true);
    routeTimerRef.current = setTimeout(() => setRouteLoading(false), 2000);
  }, []);

  const openLotPreview = React.useCallback(() => {
    if (lotPreviewCloseTimerRef.current) clearTimeout(lotPreviewCloseTimerRef.current);
    setLotPreviewOpen(true);
  }, []);

  const closeLotPreviewWithDelay = React.useCallback(() => {
    if (lotPreviewCloseTimerRef.current) clearTimeout(lotPreviewCloseTimerRef.current);
    lotPreviewCloseTimerRef.current = setTimeout(() => setLotPreviewOpen(false), 420);
  }, []);

  React.useEffect(() => {
    setAuthOpen(false);
  }, [location.pathname]);

  React.useEffect(() => {
    startRouteLoader();
    return () => {
      if (routeTimerRef.current) clearTimeout(routeTimerRef.current);
      if (lotPreviewCloseTimerRef.current) clearTimeout(lotPreviewCloseTimerRef.current);
    };
  }, [location.pathname, startRouteLoader]);

  React.useEffect(() => {
    if (!customerToken) {
      setCustomerProfile(null);
      setCustomerIsAdmin(false);
      localStorage.removeItem("customerIsAdmin");
      return;
    }
    fetchCustomer(customerToken)
      .then((data) => {
        const profile = data?.customer || null;
        const isAdmin = profile?.role === "admin";
        setCustomerProfile(profile);
        setCustomerIsAdmin(isAdmin);
        localStorage.setItem("customerIsAdmin", isAdmin ? "true" : "false");
        if (isAdmin) {
          localStorage.setItem("adminToken", customerToken);
          setAdminToken(customerToken);
        } else {
          localStorage.removeItem("adminToken");
          setAdminToken(null);
        }
      })
      .catch(() => {
        const jwtData = parseJwtPayload(customerToken);
        if (jwtData?.role === "admin") {
          const fallbackProfile = {
            id: jwtData.id || jwtData.sub || null,
            email: jwtData.email || "",
            username: jwtData.username || "",
            role: "admin",
          };
          setCustomerProfile(fallbackProfile);
          setCustomerIsAdmin(true);
          localStorage.setItem("customerIsAdmin", "true");
          localStorage.setItem("adminToken", customerToken);
          setAdminToken(customerToken);
          return;
        }
        localStorage.removeItem("auth_token");
        localStorage.removeItem("customerToken");
        localStorage.removeItem("customerIsAdmin");
        setCustomerToken(null);
        setCustomerProfile(null);
        setCustomerIsAdmin(false);
      });
  }, [customerToken]);

  const lotCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  const animateToLot = (product, event) => {
    if (!lotIconRef.current || !event) return;
    const lotRect = lotIconRef.current.getBoundingClientRect();
    const img = document.createElement("img");
    img.src = product.image;
    img.className = "lot-fly";
    const startX = event.clientX;
    const startY = event.clientY;
    img.style.left = `${startX}px`;
    img.style.top = `${startY}px`;
    document.body.appendChild(img);

    requestAnimationFrame(() => {
      const endX = lotRect.left + lotRect.width / 2;
      const endY = lotRect.top + lotRect.height / 2;
      img.style.transform = `translate(${endX - startX}px, ${endY - startY}px) scale(0.15)`;
      img.style.opacity = "0.3";
    });

    img.addEventListener(
      "transitionend",
      () => {
        img.remove();
      },
      { once: true }
    );

    setLotOpen(true);
    setLotPulse(true);
    setTimeout(() => setLotPulse(false), 900);
    setTimeout(() => setLotOpen(false), 1000);
  };

  const addToCart = (product, quantity, event) => {
    const safeQty = Math.max(1, Number(quantity) || 1);
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id ? { ...item, quantity: safeQty } : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: safeQty,
          image: product.image,
          width: product.width,
          height: product.height,
          weight: product.weight,
          stock: product.stock,
        },
      ];
    });
    animateToLot(product, event);
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const updateCartQuantity = (productId, quantity) => {
    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => setCart([]);
  const previewTotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);

  const handleLogin = (token) => {
    localStorage.setItem("adminToken", token);
    localStorage.setItem("auth_token", token);
    localStorage.setItem("customerToken", token);
    localStorage.setItem("customerIsAdmin", "true");
    setAdminToken(token);
    setCustomerToken(token);
    setCustomerIsAdmin(true);
    setAuthToast("Inicio de sesion exitoso");
    setTimeout(() => setAuthToast(null), 2500);
    navigate("/");
  };

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    setAdminToken(null);
  };

  const handleCustomerAuthSuccess = (data, message) => {
    localStorage.setItem("auth_token", data.token);
    localStorage.setItem("customerToken", data.token);
    setCustomerToken(data.token);
    setCustomerProfile(data.user || null);
    const isAdmin = data?.user?.role === "admin";
    if (isAdmin) {
      localStorage.setItem("adminToken", data.token);
      setAdminToken(data.token);
    } else {
      localStorage.removeItem("adminToken");
      setAdminToken(null);
    }
    setCustomerIsAdmin(isAdmin);
    localStorage.setItem("customerIsAdmin", isAdmin ? "true" : "false");
    setAuthToast(message || "Inicio de sesion exitoso");
    setTimeout(() => setAuthToast(null), 2500);
    navigate("/");
  };

  const handleCustomerLogout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("customerToken");
    localStorage.removeItem("customerIsAdmin");
    localStorage.removeItem("adminToken");
    setCustomerToken(null);
    setAdminToken(null);
    setCustomerProfile(null);
    setCustomerIsAdmin(false);
  };

  return (
    <div className="container">
      <header className="header ml-header">
        <div className="ml-top">
          <div className="ml-brand-block">
            <Link
              className="ml-logo-link"
              to="/"
              aria-label="Volver a tienda"
              onClick={() => {
                setSearchInput("");
                setSearchQuery("");
                startRouteLoader();
              }}
            >
              <img className="ml-logo-img" src={logo} alt="Bazar Velazquez" />
            </Link>
            <Link
              className="ml-location-link"
              to="/ubicacion"
              onClick={(event) => {
                if (!customerToken) {
                  event.preventDefault();
                  setAuthOpen(true);
                }
              }}
            >
              <img
                className="ml-pin-icon"
                src="https://cdn-icons-png.flaticon.com/512/2794/2794702.png"
                alt="Ubicacion"
              />
              <span>{formatLocation(customerProfile)}</span>
            </Link>
          </div>

          <div className="ml-search-wrap">
            <input
              className="ml-search-input"
              type="search"
              placeholder="Busca productos, marcas y mas...."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  const nextQuery = String(searchInput || "").trim();
                  setSearchQuery(nextQuery);
                  if (location.pathname !== "/") {
                    navigate("/");
                  }
                  startRouteLoader();
                }
              }}
            />
            <button className="ml-search-button" type="button" aria-label="Buscar">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <path d="M16 16l4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <nav className="ml-nav-row">
          <NavLink className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`} to="/">
            Tienda
          </NavLink>
          <NavLink className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`} to="/mis-compras">
            Mis compras
          </NavLink>
          <div
            className="lot-hover-wrap"
            onMouseEnter={openLotPreview}
            onMouseLeave={closeLotPreviewWithDelay}
          >
            <NavLink
              ref={lotIconRef}
              className={({ isActive }) => `ml-icon-link lot-icon ${isActive ? "active" : ""} ${lotPulse ? "pulse" : ""} ${lotOpen ? "open" : ""}`}
              to="/checkout"
              aria-label="Mi paquete"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path className="box-base" d="M4 9l8-4 8 4-8 4-8-4Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <path d="M4 9v7l8 4 8-4V9" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <path className="box-lid" d="M12 13V5" fill="none" stroke="currentColor" strokeWidth="1.6" />
              </svg>
              <span className="nav-badge">{lotCount}</span>
            </NavLink>
            {lotPreviewOpen && (
              <div
                className="lot-preview"
                onMouseEnter={openLotPreview}
                onMouseLeave={closeLotPreviewWithDelay}
              >
                <h4>Mi paquete:</h4>
                {cart.length === 0 ? (
                  <p className="helper">No hay productos en el lote.</p>
                ) : (
                  <>
                    <div className="lot-preview-list">
                      {cart.map((item) => (
                        <div key={item.productId} className="lot-preview-item">
                          <img src={item.image} alt={item.name} />
                          <div className="lot-preview-info">
                            <strong>{item.name}</strong>
                            <span>{new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(item.price * item.quantity)}</span>
                            <div className="lot-preview-qty">
                              <button
                                type="button"
                                onClick={() => updateCartQuantity(item.productId, Math.max(1, item.quantity - 1))}
                                disabled={item.quantity <= 1}
                              >
                                -
                              </button>
                              <span>{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  updateCartQuantity(item.productId, Math.min(Number(item.stock) || 1, item.quantity + 1))
                                }
                                disabled={item.quantity >= (Number(item.stock) || 1)}
                              >
                                +
                              </button>
                            </div>
                          </div>
                          <button className="lot-preview-remove" type="button" onClick={() => removeFromCart(item.productId)}>
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="lot-preview-footer">
                      <span>Total</span>
                      <strong>{new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(previewTotal)}</strong>
                    </div>
                    <Link className="button lot-preview-go" to="/checkout">
                      Ver mi paquete
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
          <button className="ml-icon-link" type="button" aria-label="Usuario" onClick={() => setAuthOpen(true)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path d="M4 20c1.6-3 4.3-4.5 8-4.5s6.4 1.5 8 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </nav>
      </header>

      <Routes>
        <Route
          path="/"
          element={<Home onAdd={addToCart} searchQuery={searchQuery} cart={cart} isAdmin={customerIsAdmin} />}
        />
        <Route path="/producto/:id" element={<ProductDetail onAdd={addToCart} />} />
        <Route path="/mis-compras" element={<PurchasesPage />} />
        <Route
          path="/ubicacion"
          element={
            <LocationPage
              customerToken={customerToken}
              customerProfile={customerProfile}
              onCustomerUpdate={setCustomerProfile}
              onRequireLogin={() => setAuthOpen(true)}
            />
          }
        />
        <Route
          path="/checkout"
          element={
            <Checkout
              cart={cart.map((item) => ({
                ...item,
                onRemove: removeFromCart,
                onQtyChange: updateCartQuantity,
              }))}
              onClear={clearCart}
              customerToken={customerToken}
              customerProfile={customerProfile}
              onCustomerUpdate={setCustomerProfile}
            />
          }
        />
        <Route
          path="/admin"
          element={
            adminToken ? (
              <AdminPanel token={adminToken} onLogout={handleLogout} />
            ) : (
              <AdminLogin onLogin={handleLogin} />
            )
          }
        />
      </Routes>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthSuccess={handleCustomerAuthSuccess}
        customerProfile={customerProfile}
        customerIsAdmin={customerIsAdmin}
        onLogout={handleCustomerLogout}
      />
      {authToast && <div className="toast">{authToast}</div>}

      {routeLoading && (
        <div className="route-loader-backdrop">
          <div className="route-loader" aria-label="Cargando">
            <Lottie animationData={routeLoaderAnimation} loop autoplay />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
