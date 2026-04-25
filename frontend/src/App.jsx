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
          element={<Home onAdd={addToCart} searchQuery={searchQuery} cart={cart} isAdmin={isMabelMode} />}
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
