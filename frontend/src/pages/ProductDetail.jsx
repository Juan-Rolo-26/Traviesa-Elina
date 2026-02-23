import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchProduct, fetchProducts } from "../api";
import { formatPrice } from "../utils/format";
import ProductCard from "../components/ProductCard";

function ProductDetail({ onAdd }) {
  const { id } = useParams();
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
          </div>
        </div>
        <div className="product-info">
          <h2>{product.name}</h2>
          <p className="price">{formatPrice(product.price)}</p>
          {product.description && <p>{product.description}</p>}
          <div className="helper">Ancho: {product.width} cm · Alto: {product.height} cm · Peso: {product.weight} gr</div>

          {stock > 1 && (
            <div className="qty-control product-qty">
              <button type="button" onClick={handleMinus} disabled={qty <= 1}>
                −
              </button>
              <span>{qty}</span>
              <button type="button" onClick={handlePlus}>
                +
              </button>
            </div>
          )}

          {warning && <div className="helper">{warning}</div>}

          <button className="button product-add" type="button" onClick={handleAdd}>
            Agregar al paquete
          </button>
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
