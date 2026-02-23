import React, { useRef, useState } from "react";
import { createProduct, updateProduct } from "../api";
import { useNavigate } from "react-router-dom";

const initialState = {
  name: "",
  price: "",
  width: "",
  height: "",
  weight: "",
  stock: "1",
  description: "",
};

const GRID_COLS = 2;
const CELL_HEIGHT = 120;
const GRID_GAP = 10;

const API_URL = "";

function AdminPanel({ token, onLogout }) {
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
  const fileRef = useRef(null);
  const gridRef = useRef(null);
  const navigate = useNavigate();

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2000);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
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
      if (value !== "") data.append(key, value);
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
      if (String(error.message).toLowerCase().includes("invalid token")) {
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
      if (value !== "") data.append(key, value);
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
      if (String(error.message).toLowerCase().includes("invalid token")) {
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
    setDragPos((prev) => (prev ? { ...prev, x: event.clientX, y: event.clientY } : prev));

    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height + CELL_HEIGHT) return;

    const colWidth = (rect.width - GRID_GAP) / GRID_COLS;
    const col = x < colWidth ? 0 : 1;
    const row = Math.max(0, Math.floor(y / (CELL_HEIGHT + GRID_GAP)));
    const targetIndex = Math.min(media.length - 1, row * GRID_COLS + col);

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

  return (
    <div className="grid" style={{ gridTemplateColumns: "1.4fr 0.8fr" }}>
      <form className="form" onSubmit={handleCreate}>
        <h2>Completa los datos del producto</h2>
        <input name="name" placeholder="Nombre" value={form.name} onChange={handleChange} required />
        <input name="price" placeholder="Precio (ej: 14500)" value={form.price} onChange={handleChange} required />
        <input name="width" placeholder="Ancho (cm)" value={form.width} onChange={handleChange} required />
        <input name="height" placeholder="Alto (cm)" value={form.height} onChange={handleChange} required />
        <input name="weight" placeholder="Peso (gr)" value={form.weight} onChange={handleChange} required />
        <input name="stock" placeholder="Stock (default 1)" value={form.stock} onChange={handleChange} />
        <textarea
          name="description"
          placeholder="Descripcion (opcional)"
          value={form.description}
          onChange={handleChange}
        />
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
      </form>

      <div className="image-box">
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
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

export default AdminPanel;
