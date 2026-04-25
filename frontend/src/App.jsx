import React, { useMemo, useRef, useState } from "react";
import { Navigate, Routes, Route, Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import Lottie from "lottie-react";
import Home from "./pages/Home";
import Checkout from "./pages/Checkout";
import AdminPanel from "./pages/AdminPanel";
import MabelAccess from "./pages/MabelAccess";
import CategoryPage from "./pages/CategoryPage";
import ProductDetail from "./pages/ProductDetail";
import PurchasesPage from "./pages/PurchasesPage";
import logo from "./assets/logo-blanqueria.png";
import routeLoaderAnimation from "./assets/route-loader.json";

function App() {
  const [cart, setCart] = useState([]);
  const [mabelToken, setMabelToken] = useState(() => localStorage.getItem("mabelToken"));
  const [customerToken, setCustomerToken] = useState(() => localStorage.getItem("customerToken"));
  const [customerProfile, setCustomerProfile] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("customerProfile") || "null");
    } catch (_) {
      return null;
    }
  });
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [guestData, setGuestData] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [lotPulse, setLotPulse] = useState(false);
  const [lotOpen, setLotOpen] = useState(false);
  const [lotPreviewOpen, setLotPreviewOpen] = useState(false);
  const [routeLoading, setRouteLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const lotIconRef = useRef(null);
  const routeTimerRef = useRef(null);
  const lotPreviewCloseTimerRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  const isMabelMode = Boolean(mabelToken);

  const startRouteLoader = React.useCallback(() => {
    if (routeTimerRef.current) clearTimeout(routeTimerRef.current);
    setRouteLoading(true);
    routeTimerRef.current = setTimeout(() => setRouteLoading(false), 1500);
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
    startRouteLoader();
    return () => {
      if (routeTimerRef.current) clearTimeout(routeTimerRef.current);
      if (lotPreviewCloseTimerRef.current) clearTimeout(lotPreviewCloseTimerRef.current);
    };
  }, [location.pathname, startRouteLoader]);

  React.useEffect(() => {
    if (!drawerOpen) {
      document.body.style.overflow = '';
      return;
    }
    document.body.style.overflow = 'hidden';
    const handleKey = (e) => { if (e.key === 'Escape') setDrawerOpen(false); };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  React.useEffect(() => {
    const handleResize = () => { if (window.innerWidth > 860) setDrawerOpen(false); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    const maxQty = product.stock ?? 1;
    const safeQty = Math.min(Math.max(1, Number(quantity) || 1), maxQty);
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id ? { ...item, quantity: Math.min(item.quantity + safeQty, maxQty) } : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          price: product.discountPrice ? product.discountPrice : product.price,
          quantity: safeQty,
          image: product.image,
          stock: maxQty,
          wholesaleOffers: product.wholesaleOffers || [],
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
        item.productId === productId ? { ...item, quantity: Math.min(Math.max(1, quantity), item.stock ?? 1) } : item
      )
    );
  };

  const clearCartAndGuest = () => {
    setCart([]);
    setGuestData(null);
  };

  const previewTotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const sortedOffers = [...(item.wholesaleOffers || [])].sort((a, b) => b.quantity - a.quantity);
      const match = sortedOffers.find((o) => Number(item.quantity) >= Number(o.quantity));
      if (match) return sum + Number(match.price) * Number(item.quantity);
      return sum + item.price * item.quantity;
    }, 0);
  }, [cart]);

  const handleMabelUnlock = (token) => {
    localStorage.setItem("mabelToken", token);
    setMabelToken(token);
  };

  const handleMabelLogout = () => {
    localStorage.removeItem("mabelToken");
    setMabelToken(null);
  };

  const handleAuthSuccess = (data) => {
    setCustomerToken(data.token);
    setCustomerProfile(data.user);
    setGuestData(null);
    localStorage.setItem("customerToken", data.token);
    localStorage.setItem("customerProfile", JSON.stringify(data.user));
  };

  const handleLogout = () => {
    setCustomerToken(null);
    setCustomerProfile(null);
    setGuestData(null);
    localStorage.removeItem("customerToken");
    localStorage.removeItem("customerProfile");
  };

  const displayName = useMemo(() => {
    if (!customerProfile) return "";
    const fullName = customerProfile.firstName || customerProfile.username || "";
    return fullName.split(" ")[0] || "";
  }, [customerProfile]);

  return (
    <div className="container">
      <header className={`header ml-header ${isScrolled ? "header-scrolled" : ""}`}>
        {/* Capa 1: Top Bar */}
        <div className="ml-top-bar">
          <div className="top-bar-container">
            <div className="top-bar-marquee">
              <span className="top-bar-marquee-content">
                ¡Encontra lo mejor con nosotros! &nbsp;&nbsp;&nbsp;&nbsp;•&nbsp;&nbsp;&nbsp;&nbsp; 4% DE DESCUENTO PAGANDO CON TRANSFERENCIA
              </span>
            </div>
          </div>
        </div>

        {/* Capa 2: Main Bar */}
        <div className="ml-main-bar">
          <button
            className="ml-hamburger"
            type="button"
            aria-label="Abrir menú"
            onClick={() => setDrawerOpen(true)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>

          <div className="ml-main-left">
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

          <div className="ml-main-center">
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
              <img className="ml-logo-img" src={logo} alt="Traviesa" />
            </Link>
          </div>

          <nav className="ml-nav-row">
            <NavLink className={({ isActive }) => `nav-link ml-nav-page-link ${isActive ? "active" : ""}`} to="/">
              Tienda
            </NavLink>
            <NavLink className={({ isActive }) => `nav-link ml-nav-page-link ${isActive ? "active" : ""}`} to="/mis-compras">
              Mis compras
            </NavLink>

            <div className="ml-auth-trigger" onClick={() => setAuthModalOpen(true)}>
              <div className="ml-auth-circle m-hide">
                <svg viewBox="0 0 24 24">
                  <path d="M12 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V18h14v-1.5c0-2.33-4.67-3.5-7-3.5z" />
                </svg>
              </div>
              <div className="ml-auth-text m-hide">
                {!customerProfile ? (
                  <>
                    <strong>Entrá /</strong>
                    <span>Registráte</span>
                  </>
                ) : (
                  <>
                    <strong>¡Hola, {displayName}!</strong>
                    <span onClick={(e) => {
                      e.stopPropagation();
                      handleLogout();
                    }}>Cerrar sesión</span>
                  </>
                )}
              </div>
              <div className="ml-auth-mobile-icon d-hide">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: '26px', height: '26px' }}>
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
            </div>

            <div>
              <NavLink
                ref={lotIconRef}
                className={({ isActive }) => `text-cart-link lot-icon ${isActive ? "active" : ""} ${lotPulse ? "pulse" : ""}`}
                to="/checkout"
                aria-label="Mi carrito"
              >
                <div className="m-hide" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="text-cart-title">Carrito ({lotCount})</div>
                  <div className="text-cart-total">{new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(previewTotal)}</div>
                </div>

                <div className="d-hide" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: '26px', height: '26px' }}>
                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <path d="M16 10a4 4 0 0 1-8 0" />
                  </svg>
                  <span style={{
                    position: 'absolute', top: '0', right: '-4px', transform: 'translate(30%, -30%)',
                    background: '#000', color: '#fff', fontSize: '11px', fontWeight: 'bold',
                    borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {lotCount}
                  </span>
                </div>
              </NavLink>
            </div>
          </nav>
        </div>

        {/* Capa 3: Categorías Bar */}
        <div className="ml-categories-bar m-hide">
          <nav className="categories-nav">
            <Link to="/categoria/Blanqueria" className="category-link">Blanqueria</Link>
            <Link to="/categoria/Bazar" className="category-link">Bazar</Link>
            <Link to="/categoria/Deco" className="category-link">Deco</Link>
            <Link to="/categoria/Alfombras" className="category-link">Alfombras</Link>
            <Link to="/categoria/Cocina" className="category-link">Cocina</Link>

            {isMabelMode && (
              <div style={{ display: 'flex', gap: '15px' }}>
                <NavLink className="mabel-action-btn" to="/admin">
                  Agregar producto
                </NavLink>
                <button className="mabel-action-btn" type="button" onClick={handleMabelLogout}>
                  Salir modo Elina
                </button>
              </div>
            )}
          </nav>
        </div>

        {isMabelMode && (
          <div className="mabel-actions-row d-hide">
            <NavLink className="mabel-action-btn" to="/admin">
              Agregar producto
            </NavLink>
            <button className="mabel-action-btn" type="button" onClick={handleMabelLogout}>
              Salir modo Elina
            </button>
          </div>
        )}
      </header>

      <Routes>
        <Route
          path="/"
          element={<Home onAdd={addToCart} searchQuery={searchQuery} cart={cart} isAdmin={isMabelMode} mabelToken={mabelToken} />}
        />
        <Route
          path="/categoria/:categoryName"
          element={<CategoryPage onAdd={addToCart} cart={cart} isAdmin={isMabelMode} />}
        />
        <Route path="/producto/:id" element={<ProductDetail onAdd={addToCart} isMabelMode={isMabelMode} />} />
        <Route path="/mis-compras" element={<PurchasesPage customerProfile={customerProfile} />} />
        <Route
          path="/checkout"
          element={
            <Checkout
              cart={cart}
              onClear={clearCartAndGuest}
              customerToken={customerToken}
              customerProfile={customerProfile}
              onAuthOpen={() => setAuthModalOpen(true)}
              onRemove={removeFromCart}
              onQtyChange={updateCartQuantity}
              isGuest={!!guestData}
              guestData={guestData}
            />
          }
        />
        <Route
          path="/admin"
          element={
            isMabelMode ? (
              <AdminPanel token={mabelToken} onLogout={handleMabelLogout} />
            ) : (
              <Navigate to="/mabel-acceso" replace />
            )
          }
        />
        <Route path="/mabel-acceso" element={<MabelAccess onUnlock={handleMabelUnlock} />} />
      </Routes>

      {routeLoading && (
        <div className="route-loader-backdrop">
          <div className="route-loader" aria-label="Cargando">
            <div className="lds-heart"><div></div></div>
          </div>
        </div>
      )}

      {/* ===== FOOTER ===== */}
      <footer className="site-footer">
        <div className="footer-main">
          <div className="footer-left">
            <div className="footer-section">
              <h4>MEDIOS DE PAGO</h4>
              <div className="footer-logos">
                <span className="fl-text">Mercado Pago</span>
                <span className="fl-text">Ualá</span>
                <span className="fl-text">Mastercard</span>
                <span className="fl-text">Visa</span>
                <span className="fl-text">Naranja</span>
                <span className="fl-text">Cabal</span>
                <span className="fl-text">Maestro</span>
                <span className="fl-text">Diners</span>
                <span className="fl-text">Nativa</span>
                <span className="fl-text">Argencard</span>
                <span className="fl-text">Rapipago</span>
              </div>
            </div>
            <div className="footer-section">
              <h4>MEDIOS DE ENVÍO</h4>
              <p className="footer-subtitle">Coordinamos todo por whatsapp</p>
              <div className="footer-logos">
                <span className="fl-text">Andreani</span>
                <span className="fl-text">Correo Argentino</span>
                <span className="fl-text">Envío a domicilio</span>
              </div>
            </div>
          </div>

          <div className="footer-right">
            <div className="footer-section">
              <h4>NUESTRAS REDES SOCIALES</h4>
              <div className="footer-social-icons">
                <a href="#" onClick={(e) => e.preventDefault()} aria-label="Facebook" className="footer-social-link">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28"><path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879v-6.988h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12z" /></svg>
                </a>
                <a href="https://www.instagram.com/traviesa_ev/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="footer-social-link">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
                </a>
              </div>
            </div>

            <div className="footer-section">
              <h4>CONTACTO</h4>
              <p className="footer-contact-line">
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" /></svg>
                traviesabazar@gmail.com
              </p>
              <p className="footer-contact-line">
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1.003 1.003 0 011.01-.24c1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.24 1.02l-2.2 2.2z" /></svg>
                +54 9 3513 74-9655
              </p>

            </div>


          </div>
        </div>
        <div className="footer-bottom">
          <p>2026. Todos los derechos reservados.</p>
        </div>
      </footer>

      <div
        className={`ml-drawer-backdrop${drawerOpen ? ' open' : ''}`}
        onClick={() => setDrawerOpen(false)}
      />
      <aside className={`ml-drawer${drawerOpen ? ' open' : ''}`}>
        <button
          className="ml-drawer-close"
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setDrawerOpen(false)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <nav className="ml-drawer-nav">
          <NavLink className={({ isActive }) => `ml-drawer-link${isActive ? ' active' : ''}`} to="/" onClick={() => setDrawerOpen(false)}>Tienda</NavLink>
          <NavLink className={({ isActive }) => `ml-drawer-link${isActive ? ' active' : ''}`} to="/categoria/Blanqueria" onClick={() => setDrawerOpen(false)}>Blanqueria</NavLink>
          <NavLink className={({ isActive }) => `ml-drawer-link${isActive ? ' active' : ''}`} to="/categoria/Bazar" onClick={() => setDrawerOpen(false)}>Bazar</NavLink>
          <NavLink className={({ isActive }) => `ml-drawer-link${isActive ? ' active' : ''}`} to="/categoria/Deco" onClick={() => setDrawerOpen(false)}>Deco</NavLink>
          <NavLink className={({ isActive }) => `ml-drawer-link${isActive ? ' active' : ''}`} to="/categoria/Alfombras" onClick={() => setDrawerOpen(false)}>Alfombras</NavLink>
          <NavLink className={({ isActive }) => `ml-drawer-link${isActive ? ' active' : ''}`} to="/categoria/Cocina" onClick={() => setDrawerOpen(false)}>Cocina</NavLink>
          <div style={{ height: '1px', background: '#e0e0e0', margin: '15px 0' }} />
          <NavLink className={({ isActive }) => `ml-drawer-link${isActive ? ' active' : ''}`} to="/mis-compras" onClick={() => setDrawerOpen(false)}>Mis compras</NavLink>
        </nav>
      </aside>
      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        customerProfile={customerProfile}
        onAuthSuccess={handleAuthSuccess}
        onLogout={handleLogout}
        onGuestCheckout={(data) => {
          setGuestData(data);
          setAuthModalOpen(false);
          navigate("/checkout");
        }}
        showGuestOption={location.pathname === "/checkout" && !customerProfile}
      />

      {/* Botón flotante WhatsApp */}
      <a
        href="https://wa.me/5493513749655?text=Hola%20buenas!%20Te%20consulto%20por...."
        target="_blank"
        rel="noopener noreferrer"
        className="whatsapp-float"
        aria-label="Contactar por WhatsApp"
      >
        <svg viewBox="0 0 32 32" fill="currentColor"><path d="M16.004 0C7.164 0 .004 7.16.004 15.998c0 2.82.737 5.573 2.137 7.998L.015 32l8.2-2.15a15.94 15.94 0 007.79 1.985C24.843 31.835 32 24.675 32 15.998 32 7.16 24.843 0 16.004 0zm0 29.318a13.27 13.27 0 01-7.13-2.065l-.51-.305-5.29 1.388 1.41-5.155-.334-.53A13.27 13.27 0 012.52 15.998c0-7.44 6.046-13.48 13.484-13.48 7.44 0 13.48 6.04 13.48 13.48 0 7.442-6.04 13.32-13.48 13.32zm7.396-10.095c-.405-.203-2.398-1.184-2.77-1.32-.372-.134-.643-.2-.914.203-.27.405-1.047 1.32-1.285 1.59-.236.27-.474.304-.88.102-.405-.203-1.71-.63-3.26-2.01-1.205-1.074-2.018-2.4-2.254-2.806-.236-.405-.025-.624.178-.826.182-.182.405-.474.608-.71.203-.237.27-.406.406-.677.134-.27.067-.508-.034-.71-.1-.203-.914-2.203-1.252-3.014-.33-.793-.665-.686-.914-.698l-.778-.014a1.49 1.49 0 00-1.082.508c-.372.405-1.42 1.388-1.42 3.384 0 1.997 1.454 3.926 1.657 4.198.203.27 2.862 4.37 6.935 6.126.97.418 1.726.668 2.316.855.973.31 1.858.266 2.558.162.78-.117 2.398-.98 2.737-1.928.338-.948.338-1.76.236-1.928-.1-.17-.37-.27-.776-.474z" /></svg>
      </a>
    </div>
  );
}

import AuthModal from "./components/AuthModal";
export default App;
