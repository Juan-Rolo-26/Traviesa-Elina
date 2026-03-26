import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { formatPrice } from "../utils/format";

function ProductCard({ product, onAdd, inCart, onDelete, showDelete }) {
  const [qty, setQty] = useState(1);
  const [showQty, setShowQty] = useState(false);
  const [warning, setWarning] = useState(null);
  const warningTimer = useRef(null);
  const stock = product.stock ?? 1;

  useEffect(() => {
    if (inCart?.quantity) {
      setQty(inCart.quantity);
    }
  }, [inCart]);

  const showWarning = () => {
    setWarning("no hay esa cantidad en el stock");
    if (warningTimer.current) clearTimeout(warningTimer.current);
    warningTimer.current = setTimeout(() => setWarning(null), 2000);
  };

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
    if (stock > 1 && !showQty) {
      setShowQty(true);
      return;
    }
    if (qty > stock) {
      showWarning();
      return;
    }
    setWarning(null);
    onAdd(product, qty, event);
  };

  return (
    <article className="card">
      {showDelete && (
        <button className="card-delete" type="button" onClick={() => onDelete?.(product)} aria-label="Eliminar">
          ×
        </button>
      )}
      <Link to={`/producto/${product.id}`} className="card-link">
        <img src={product.image} alt={product.name} />
      </Link>
      <div>
        <Link to={`/producto/${product.id}`} className="card-link">
          <strong>{product.name}</strong>
        </Link>
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
      </div>

      {showQty && (
        <div className="qty-control">
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

      <button className="button card-buy-btn" onClick={handleAdd}>
        Comprar
      </button>
    </article>
  );
}

export default ProductCard;
