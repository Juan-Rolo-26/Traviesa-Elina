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
          price: product.discountPrice ? product.discountPrice : product.price,
          quantity: safeQty,
          image: product.image,
          stock: product.stock,
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
        item.productId === productId ? { ...item, quantity } : item
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
              <div className="ml-auth-circle">
                <svg viewBox="0 0 24 24">
                  <path d="M12 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V18h14v-1.5c0-2.33-4.67-3.5-7-3.5z" />
                </svg>
              </div>
              <div className="ml-auth-text">
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
            </div>

            <div>
              <NavLink
                ref={lotIconRef}
                className={({ isActive }) => `text-cart-link lot-icon ${isActive ? "active" : ""} ${lotPulse ? "pulse" : ""}`}
                to="/checkout"
                aria-label="Mi carrito"
              >
                <div className="text-cart-title">Carrito ({lotCount})</div>
                <div className="text-cart-total">{new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(previewTotal)}</div>
              </NavLink>
            </div>
            <button
              className="ml-hamburger"
              type="button"
              aria-label="Abrir menú"
              onClick={() => setDrawerOpen(true)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 6h18M3 12h18M3 18h18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </nav>
        </div>

        {/* Capa 3: Categorías Bar */}
        <div className="ml-categories-bar">
          <nav className="categories-nav">
            <Link to="/categoria/Blanqueria" className="category-link">Blanqueria</Link>
            <Link to="/categoria/Bazar" className="category-link">Bazar</Link>
            <Link to="/categoria/Deco" className="category-link">Deco</Link>
            <Link to="/categoria/Alfombras" className="category-link">Alfombras</Link>
            <Link to="/categoria/Cocina" className="category-link">Cocina</Link>
          </nav>
        </div>

        {isMabelMode && (
          <div className="mabel-actions-row">
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
        <Route path="/mis-compras" element={<PurchasesPage />} />
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
          <NavLink
            className={({ isActive }) => `ml-drawer-link${isActive ? ' active' : ''}`}
            to="/"
            onClick={() => setDrawerOpen(false)}
          >
            Tienda
          </NavLink>
          <NavLink
            className={({ isActive }) => `ml-drawer-link${isActive ? ' active' : ''}`}
            to="/mis-compras"
            onClick={() => setDrawerOpen(false)}
          >
            Mis compras
          </NavLink>
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
    </div>
  );
}

import AuthModal from "./components/AuthModal";
export default App;
