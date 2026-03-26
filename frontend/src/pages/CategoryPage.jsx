import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchProducts, deleteProduct } from "../api";
import ProductCard from "../components/ProductCard";

function CategoryPage({ onAdd, cart, isAdmin }) {
  const { categoryName } = useParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmProduct, setConfirmProduct] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadProducts = () => {
    setLoading(true);
    fetchProducts(categoryName)
      .then((data) => setProducts(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProducts();
  }, [categoryName]);

  const handleDelete = async () => {
    if (!confirmProduct) return;
    setDeleting(true);
    try {
      await deleteProduct(confirmProduct.id, localStorage.getItem("mabelToken"));
      setConfirmProduct(null);
      loadProducts();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="category-page">
      <header className="category-header">
        <div className="breadcrumb">Inicio {' > '} {categoryName}</div>
      </header>

      <div className="category-container">
        {/* Sidebar space for filters (as requested, but no price filter) */}
        <aside className="category-filters">
          <h3>Filtrar por</h3>
          <h2 className="category-title-sidebar">{categoryName}</h2>
        </aside>

        <section className="category-content">
          {loading && <p>Cargando productos de {categoryName}...</p>}
          {error && <p className="helper">{error}</p>}

          {!loading && products.length === 0 && (
            <p className="helper">No hay productos en esta categoria todavia.</p>
          )}

          <div className="grid category-grid">
            {products.map((p) => {
              const inCart = cart.find((it) => it.productId === p.id);
              return (
                <ProductCard
                  key={p.id}
                  product={p}
                  onAdd={onAdd}
                  inCart={inCart}
                  showDelete={isAdmin}
                  onDelete={(prod) => setConfirmProduct(prod)}
                />
              );
            })}
          </div>
        </section>
      </div>

      {confirmProduct && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>¿Eliminar producto?</h3>
            <p>Se borrara "{confirmProduct.name}" permanentemente.</p>
            <div className="modal-actions">
              <button className="button secondary" onClick={() => setConfirmProduct(null)}>Cancelar</button>
              <button className="button" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Borrando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default CategoryPage;
