import React, { useEffect, useState } from "react";
import { deleteProduct, fetchProducts } from "../api";
import ProductCard from "../components/ProductCard";
import HeroCarousel from "../components/HeroCarousel";

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getWordVariants(word) {
  const variants = new Set([word]);
  if (word.endsWith("es") && word.length > 3) variants.add(word.slice(0, -2));
  if (word.endsWith("s") && word.length > 2) variants.add(word.slice(0, -1));
  return Array.from(variants);
}

function matchesSearch(name, query) {
  const normalizedName = normalizeSearchText(name);
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  if (normalizedName.includes(normalizedQuery)) return true;

  const productWords = normalizedName.split(" ").filter(Boolean);
  const queryWords = normalizedQuery.split(" ").filter(Boolean);

  return queryWords.every((queryWord) => {
    const queryVariants = getWordVariants(queryWord);
    return productWords.some((productWord) => {
      const productVariants = getWordVariants(productWord);
      return queryVariants.some((qv) =>
        productVariants.some((pv) => pv.includes(qv) || qv.includes(pv))
      );
    });
  });
}

function Home({ onAdd, searchQuery, cart, isAdmin }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmProduct, setConfirmProduct] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadProducts = () => {
    setLoading(true);
    fetchProducts()
      .then((data) => setProducts(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProducts();
  }, []);

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

  const normalizedQuery = normalizeSearchText(searchQuery);

  const displayProducts = React.useMemo(() => {
    if (normalizedQuery) {
      // When searching, show all matching results
      return products.filter((product) => matchesSearch(product.name, normalizedQuery));
    }

    // Homepage: sort by best discount first, cap at 25
    const withDiscount = products
      .filter((p) => p.discountPrice != null && p.discountPrice > 0 && p.price > p.discountPrice)
      .map((p) => ({
        ...p,
        _discountPct: ((p.price - p.discountPrice) / p.price) * 100,
      }))
      .sort((a, b) => b._discountPct - a._discountPct);

    const withoutDiscount = products.filter(
      (p) => !(p.discountPrice != null && p.discountPrice > 0 && p.price > p.discountPrice)
    );

    const combined = [...withDiscount, ...withoutDiscount];
    return combined.slice(0, 25);
  }, [products, normalizedQuery]);

  return (
    <div>
      {!normalizedQuery && (
        <HeroCarousel />
      )}

      <section className="hero">
        <span className="badge">Mayorista · Productos unicos</span>
        <h1>Tu proveedor textil mas barato y confiable</h1>
        <p>Prendas importadas unicas, ideales para la reventa o el uso personal.</p>
      </section>

      {loading && <p>Cargando productos...</p>}
      {error && <p className="helper">{error}</p>}

      {!loading && displayProducts.length === 0 && (
        <p className="helper">La tienda esta vacia por ahora. Vuelve en unos dias.</p>
      )}

      <div className="grid home-grid">
        {displayProducts.map((product) => {
          const inCart = cart?.find((item) => item.productId === product.id);
          return (
            <ProductCard
              key={product.id}
              product={product}
              onAdd={onAdd}
              inCart={inCart}
              showDelete={Boolean(isAdmin)}
              onDelete={(p) => setConfirmProduct(p)}
            />
          );
        })}
      </div>

      {confirmProduct && (
        <div className="modal-backdrop" onClick={() => setConfirmProduct(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>¿Esta seguro que quiere eliminar el producto?</h3>
            <div className="button-row">
              <button className="button danger" type="button" onClick={() => setConfirmProduct(null)}>
                No
              </button>
              <button className="button success" type="button" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Eliminando..." : "Si"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
