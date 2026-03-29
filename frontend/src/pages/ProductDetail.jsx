import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useParams } from "react-router-dom";
import { fetchProduct, fetchProducts } from "../api";
import { formatPrice } from "../utils/format";
import ProductCard from "../components/ProductCard";

function ProductDetail({ onAdd, isMabelMode = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(0);
  const [qty, setQty] = useState(1);
  const [warning, setWarning] = useState(null);
  const [related, setRelated] = useState([]);
  const warningTimer = useRef(null);

  useEffect(() => {
    let active = true;
    fetchProduct(id)
      .then((data) => {
        if (active) setProduct(data);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    fetchProducts()
      .then((data) => {
        if (!active) return;
        const filtered = data.filter((item) => item.id !== id);
        const shuffled = [...filtered].sort(() => Math.random() - 0.5);
        setRelated(shuffled.slice(0, 5));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [id]);

  const showWarning = () => {
    setWarning("no hay esa cantidad en el stock");
    if (warningTimer.current) clearTimeout(warningTimer.current);
    warningTimer.current = setTimeout(() => setWarning(null), 2000);
  };

  if (loading) return <p>Cargando producto...</p>;
  if (error) return <p className="helper">{error}</p>;
  if (!product) return null;

  const media = product.media?.length
    ? product.media
    : product.image
    ? [{ url: product.image, type: "image", position: 0 }]
    : [];

  const selectedMedia = media[selected] || media[0];
  const stock = product.stock ?? 1;

  const handlePlus = () => {
    if (qty + 1 > stock) {
      showWarning();
      return;
    }
    setWarning(null);
    setQty((prev) => prev + 1);
  };

  const handleMinus = () => {
    if (qty <= 1) return;
    setWarning(null);
    setQty((prev) => prev - 1);
  };

  const handleAdd = (event) => {
    if (qty > stock) {
      showWarning();
      return;
    }
    onAdd?.(product, qty, event);
  };

  return (
    <div className="product-page">
      <div className="product-view">
        <div className="product-gallery">
          <div className="product-thumbs">
            {media.map((item, index) => (
              <button
                key={`${item.url}-${index}`}
                type="button"
                className={`thumb ${index === selected ? "active" : ""}`}
                onClick={() => setSelected(index)}
              >
                {item.type === "video" ? (
                  <video src={item.url} muted />
                ) : (
                  <img src={item.url} alt={product.name} />
                )}
              </button>
            ))}
          </div>
          <div className="product-main">
            {selectedMedia?.type === "video" ? (
              <video src={selectedMedia.url} controls />
            ) : (
              <img src={selectedMedia?.url} alt={product.name} />
            )}
            {product.isWholesale && <span className="wholesale-badge">Mayorista</span>}
          </div>
        </div>
        <div className="product-info">
          <h2>{product.name}</h2>
          <div className="price-display">
            {product.discountPrice ? (
              <>
                <div className="original-price-crossed">{formatPrice(product.price)}</div>
                <div className="discount-price-row">
                  <span className="price">{formatPrice(product.discountPrice)}</span>
                  <span className="discount-badge">{Math.ceil((1 - product.discountPrice / product.price) * 100)}% OFF</span>
                </div>
              </>
            ) : (
              <div className="price">{formatPrice(product.price)}</div>
            )}
          </div>

          {product.isWholesale && product.wholesaleOffers?.length > 0 && (
            <div className="wholesale-offers-box">
              <h3>Precios mayoristas:</h3>
              <table className="wholesale-table">
                <tbody>
                  {[...product.wholesaleOffers].sort((a, b) => a.quantity - b.quantity).map((offer, idx) => (
                    <tr key={idx}>
                      <td>Comprando {offer.quantity} o más unidades:</td>
                      <td><strong>{formatPrice(offer.price)}</strong> c/u</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {product.description && <p>{product.description}</p>}

          <div className="detail-actions-row">
            <div className="qty-control">
              <button type="button" onClick={handleMinus} disabled={qty <= 1}>
                −
              </button>
              <span>{qty}</span>
              <button type="button" onClick={handlePlus} disabled={qty >= stock}>
                +
              </button>
            </div>

            <button className="button product-add-btn" type="button" onClick={handleAdd}>
              Agregar al carrito
            </button>
          </div>

          {warning && <div className="helper">{warning}</div>}
          {isMabelMode && (
            <button
              className="button secondary product-add"
              type="button"
              onClick={() => navigate(`/admin?edit=${product.id}`)}
            >
              Editar producto
            </button>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="related">
          <h3>Quienes vieron este producto también compraron</h3>
          <div className="related-grid">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} onAdd={onAdd} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default ProductDetail;
