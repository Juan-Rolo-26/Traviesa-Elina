import React, { useRef, useState } from "react";
import { createProduct, fetchProduct, updateProduct } from "../api";
import { useNavigate, useSearchParams } from "react-router-dom";

const initialState = {
  name: "",
  price: "",
  discountPrice: "",
  category: "Blanqueria",
  isWholesale: false,
  wholesaleOffers: [],
  stock: "1",
  description: "",
};

const GRID_COLS = 2;
const CELL_HEIGHT = 120;
const GRID_GAP = 10;

const API_URL = "";

function AdminPanel({ token, onLogout }) {
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  const [form, setForm] = useState(initialState);
  const [media, setMedia] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPos, setDragPos] = useState(null);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [toast, setToast] = useState(null);
  const [lightboxItem, setLightboxItem] = useState(null);
  const fileRef = useRef(null);
  const gridRef = useRef(null);
  const draggedRef = useRef(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!editId) return;
    let active = true;
    setLoading(true);
    setStatus(null);
    fetchProduct(editId)
      .then((product) => {
        if (!active) return;
        setCurrentProduct(product);
        setForm({
          name: product.name || "",
          price: String(product.price || ""),
          discountPrice: product.discountPrice ? String(product.discountPrice) : "",
          category: product.category || "Blanqueria",
          isWholesale: product.isWholesale || false,
          wholesaleOffers: (product.wholesaleOffers || []).map((o) => ({ quantity: String(o.quantity), price: String(o.price) })),
          stock: String(product.stock ?? "1"),
          description: product.description || "",
        });
        const productMedia = (product.media || []).length
          ? [...product.media].sort((a, b) => a.position - b.position)
          : product.image
            ? [{ url: product.image, type: "image", position: 0 }]
            : [];
        const mapped = productMedia.map((item) => ({
          id: crypto.randomUUID(),
          file: null,
          preview: `${API_URL}${item.url}`,
          remote: true,
          url: item.url,
          type: item.type || "image",
        }));
        setMedia(mapped);
        setIsDirty(false);
      })
      .catch((error) => {
        if (!active) return;
        setStatus(error.message || "No se pudo cargar el producto para editar");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [editId]);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2000);
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    if (currentProduct) setIsDirty(true);
  };

  const handleOfferChange = (index, field, value) => {
    const next = [...form.wholesaleOffers];
    next[index] = { ...next[index], [field]: value };
    setForm((prev) => ({ ...prev, wholesaleOffers: next }));
    if (currentProduct) setIsDirty(true);
  };

  const addOffer = () => {
    setForm((prev) => ({ ...prev, wholesaleOffers: [...prev.wholesaleOffers, { quantity: "", price: "" }] }));
  };

  const removeOffer = (index) => {
    setForm((prev) => ({ ...prev, wholesaleOffers: prev.wholesaleOffers.filter((_, i) => i !== index) }));
    if (currentProduct) setIsDirty(true);
  };

  const addFiles = (files) => {
    const current = media.length;
    const available = Math.max(0, 10 - current);
    const nextFiles = files.slice(0, available).map((file) => {
      const type = file.type.startsWith("video/") ? "video" : "image";
      return {
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        remote: false,
        url: null,
        type,
      };
    });

    if (current === 0 && nextFiles[0] && nextFiles[0].type === "video") {
      showToast("No se puede agregar un video de portada");
      return;
    }

    setMedia((prev) => [...prev, ...nextFiles]);
    if (currentProduct) setIsDirty(true);
  };

  const removeMedia = (id) => {
    setMedia((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.preview && !target.remote) URL.revokeObjectURL(target.preview);
      return prev.filter((item) => item.id !== id);
    });
    if (currentProduct) setIsDirty(true);
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (media.length === 0) {
      setStatus("Falta la imagen.");
      return;
    }
    if (media[0].type !== "image") {
      showToast("No se puede agregar un video de portada");
      return;
    }

    const data = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (key === "wholesaleOffers") {
        data.append(key, JSON.stringify(value));
      } else if (value !== "" || key === "discountPrice" || key === "category" || key === "description" || key === "isWholesale") {
        data.append(key, value);
      }
    });
    media.forEach((item) => item.file && data.append("media", item.file));

    setLoading(true);
    setStatus(null);
    try {
      const created = await createProduct(data, token);
      setStatus("Producto cargado.");
      setCurrentProduct(created);
      setIsDirty(false);
      const mapped = (created.media || []).map((item) => ({
        id: crypto.randomUUID(),
        file: null,
        preview: `${API_URL}${item.url}`,
        remote: true,
        url: item.url,
        type: item.type,
      }));
      setMedia(mapped);
    } catch (error) {
      const msg = String(error.message || "").toLowerCase();
      if (msg.includes("invalid") || msg.includes("missing mabel token")) {
        onLogout?.();
      }
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!currentProduct) return;
    if (media[0] && media[0].type !== "image") {
      showToast("No se puede agregar un video de portada");
      return;
    }
    const data = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (key === "wholesaleOffers") {
        data.append(key, JSON.stringify(value));
      } else if (value !== "" || key === "discountPrice" || key === "category" || key === "description" || key === "isWholesale") {
        data.append(key, value);
      }
    });

    const existingMedia = media
      .filter((item) => item.remote && item.url)
      .map((item) => ({ url: item.url, type: item.type }));
    data.append("existingMedia", JSON.stringify(existingMedia));

    media.filter((item) => item.file).forEach((item) => data.append("media", item.file));

    setLoading(true);
    setStatus(null);
    try {
      const updated = await updateProduct(currentProduct.id, data, token);
      setCurrentProduct(updated);
      setIsDirty(false);
      const mapped = (updated.media || []).map((item) => ({
        id: crypto.randomUUID(),
        file: null,
        preview: `${API_URL}${item.url}`,
        remote: true,
        url: item.url,
        type: item.type,
      }));
      setMedia(mapped);
      setStatus("Producto actualizado.");
    } catch (error) {
      const msg = String(error.message || "").toLowerCase();
      if (msg.includes("invalid") || msg.includes("missing mabel token")) {
        onLogout?.();
      }
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  };

  const moveMedia = (from, to) => {
    setMedia((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      const target = Math.max(0, Math.min(to, next.length));
      next.splice(target, 0, moved);
      return next;
    });
    setDragIndex(to);
    if (currentProduct) setIsDirty(true);
  };

  const handlePointerDown = (event, index) => {
    if (event.target.closest(".image-delete")) return;
    event.preventDefault();
    draggedRef.current = false;
    const rect = event.currentTarget.getBoundingClientRect();
    setIsDragging(true);
    setDragIndex(index);
    setDragPos({
      x: event.clientX,
      y: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    });
    gridRef.current?.setPointerCapture(event.pointerId);
  };

  const handlePointerUp = (event) => {
    gridRef.current?.releasePointerCapture(event.pointerId);
    setIsDragging(false);
    setDragIndex(null);
    setDragPos(null);
  };

  const handlePointerMove = (event) => {
    if (!isDragging || dragIndex === null) return;
    draggedRef.current = true;
    setDragPos((prev) => (prev ? { ...prev, x: event.clientX, y: event.clientY } : prev));

    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const cols = window.innerWidth <= 600 ? 3 : GRID_COLS;
    const cellH = window.innerWidth <= 600 ? 100 : CELL_HEIGHT;

    if (x < 0 || y < 0 || x > rect.width || y > rect.height + cellH) return;

    const colWidth = (rect.width - GRID_GAP) / cols;
    const col = Math.min(Math.max(0, Math.floor(x / colWidth)), cols - 1);
    const row = Math.max(0, Math.floor(y / (cellH + GRID_GAP)));
    const targetIndex = Math.min(media.length - 1, row * cols + col);

    if (targetIndex !== dragIndex && targetIndex >= 0) {
      const moving = media[dragIndex];
      if (targetIndex === 0 && moving?.type === "video") {
        showToast("No se puede agregar un video de portada");
        return;
      }
      moveMedia(dragIndex, targetIndex);
    }
  };

  const getDragStyle = (index) => {
    if (!isDragging || dragIndex !== index || !dragPos) return undefined;
    return {
      position: "fixed",
      top: dragPos.y - dragPos.offsetY,
      left: dragPos.x - dragPos.offsetX,
      width: dragPos.width,
      height: dragPos.height,
      zIndex: 5,
      pointerEvents: "none",
    };
  };

  const handleThumbClick = (event, item) => {
    if (event.target.closest(".image-delete")) return;
    if (draggedRef.current) return;
    setLightboxItem(item);
  };

  return (
    <div className="admin-panel-wrap">
      <form className="form admin-form-grid" onSubmit={currentProduct ? (e) => e.preventDefault() : handleCreate}>
        {/* Columna izquierda (desktop) / Sección superior (mobile): campos del formulario */}
        <div className="admin-fields">
          <h2>Completa los datos del producto</h2>
          <input name="name" placeholder="Nombre" value={form.name} onChange={handleChange} required />
          <input name="price" placeholder="Precio (ej: 14500)" value={form.price} onChange={handleChange} required />
          <input name="discountPrice" placeholder="Precio descuento (opcional)" value={form.discountPrice} onChange={handleChange} />
          <div style={{ marginBottom: '-8px', fontSize: '14px', color: '#666', fontWeight: '500' }}>Categoría:</div>
          <select name="category" value={form.category} onChange={handleChange} required>
            <option value="Blanqueria">Blanqueria</option>
            <option value="Bazar">Bazar</option>
            <option value="Deco">Deco</option>
            <option value="Alfombras">Alfombras</option>
            <option value="Cocina">Cocina</option>
          </select>

          <div className="wholesale-toggle-section">
            <span style={{ fontSize: '14px', fontWeight: '500' }}>Producto Mayorista:</span>
            <label className="switch">
              <input type="checkbox" name="isWholesale" checked={form.isWholesale} onChange={handleChange} />
              <span className="slider round"></span>
            </label>
            <span style={{ fontSize: '13px' }}>{form.isWholesale ? "Activado" : "Desactivado"}</span>
          </div>

          {form.isWholesale && (
            <div className="wholesale-offers-list">
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>Ofertas mayoristas (Precios x unidad):</div>
              <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>Si el cliente compra "X" o más unidades, el precio unitario cambia.</div>
              {(form.wholesaleOffers || []).map((offer, idx) => (
                <div key={idx} className="offer-row" style={{ alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#666' }}>+</span>
                  <input placeholder="Cant." value={offer.quantity} onChange={(e) => handleOfferChange(idx, 'quantity', e.target.value)} style={{ width: '60px', flex: 'none' }} />
                  <span style={{ fontSize: '12px', color: '#666' }}>unid. : $</span>
                  <input placeholder="Precio u." value={offer.price} onChange={(e) => handleOfferChange(idx, 'price', e.target.value)} />
                  <button type="button" className="remove-offer" onClick={() => removeOffer(idx)}>×</button>
                </div>
              ))}
              <button type="button" className="add-offer-btn" onClick={addOffer}>Agregar nueva escala (+unid. / precio x u.)</button>
            </div>
          )}

          <input name="stock" placeholder="Stock (default 1)" value={form.stock} onChange={handleChange} />
          <textarea
            name="description"
            placeholder="Descripcion (opcional)"
            value={form.description}
            onChange={handleChange}
          />
        </div>

        {/* Columna derecha (desktop) / Sección media (mobile): imágenes y videos */}
        <div className={`image-box admin-media${media.length > 0 ? " has-media" : ""}`}>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              addFiles(files);
              e.target.value = "";
            }}
            style={{ display: "none" }}
          />
          <button className="image-upload-card" type="button" onClick={() => fileRef.current?.click()}>
            {media.length === 0 ? "Agregar imagen o video" : "Agregar mas fotos o videos"}
          </button>
          <p className="helper">{media.length} / 10 archivos seleccionados</p>

          <div
            ref={gridRef}
            className={`image-grid ${isDragging ? "dragging" : ""}`}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            {media.map((item, index) => (
              <div
                key={item.id}
                data-index={index}
                className={`image-thumb ${isDragging && dragIndex === index ? "dragging" : ""}`}
                onPointerDown={(event) => handlePointerDown(event, index)}
                onClick={(event) => handleThumbClick(event, item)}
                style={getDragStyle(index)}
              >
                {item.type === "video" ? (
                  <video src={item.preview} muted />
                ) : (
                  <img src={item.preview} alt={`Media ${index + 1}`} />
                )}
                <button
                  className="image-delete"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeMedia(item.id);
                  }}
                  aria-label="Eliminar"
                >
                  ×
                </button>
              </div>
            ))}
            {/* Botón "+" dentro de la grilla: visible solo en mobile cuando hay imágenes */}
            {media.length > 0 && media.length < 10 && (
              <button
                className="admin-upload-plus"
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-label="Agregar más archivos"
              >
                +
              </button>
            )}
          </div>
        </div>

        {/* Parte inferior izquierda (desktop) / Sección inferior (mobile): botones de acción */}
        <div className="admin-actions">
          {!currentProduct && (
            <button className="button" type="submit" disabled={loading}>
              {loading ? "Guardando..." : "Guardar producto"}
            </button>
          )}
          {currentProduct && (
            <div className="button-row">
              <button className="button" type="button" onClick={handleUpdate} disabled={!isDirty || loading}>
                {loading ? "Actualizando..." : "Actualizar producto"}
              </button>
              <button className="button secondary" type="button" onClick={() => navigate(`/producto/${currentProduct.id}`)}>
                Ver producto
              </button>
            </div>
          )}
          {status && <p className="helper">{status}</p>}
        </div>
      </form>

      {/* Lightbox: preview en grande al tocar una imagen/video */}
      {lightboxItem && (
        <div className="admin-lightbox-backdrop" onClick={() => setLightboxItem(null)}>
          <div className="admin-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="admin-lightbox-close" type="button" onClick={() => setLightboxItem(null)}>
              ×
            </button>
            {lightboxItem.type === "video" ? (
              <video src={lightboxItem.preview} controls autoPlay />
            ) : (
              <img src={lightboxItem.preview} alt="Vista previa" />
            )}
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

export default AdminPanel;
