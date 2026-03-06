import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { unlockMabelMode } from "../api";

function MabelAccess({ onUnlock }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await unlockMabelMode(password);
      onUnlock?.(data.token);
      navigate("/");
    } catch (err) {
      setError(err.message || "No se pudo activar el modo Mabel");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="form">
      <h2>Acceso Modo Elina</h2>
      <p className="helper">Ingresa la contrasena para habilitar gestion de productos.</p>
      <form className="auth-form" onSubmit={handleSubmit}>
        <input
          type="password"
          placeholder="Contrasena"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <button className="button" type="submit" disabled={loading}>
          {loading ? "Verificando..." : "Activar modo Mabel"}
        </button>
      </form>
      {error && <p className="auth-error">{error}</p>}
    </section>
  );
}

export default MabelAccess;
