import React, { useState } from "react";
import { loginAdmin } from "../api";

function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await loginAdmin(email, password);
      onLogin(data.token);
    } catch (err) {
      setError(err.message || "Credenciales invalidas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="form" onSubmit={handleSubmit}>
      <h2>Login Admin</h2>
      <p className="helper">Acceso solo para usuarios administradores.</p>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Contrasena"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
      />
      <button className="button" type="submit" disabled={loading}>
        {loading ? "Ingresando..." : "Ingresar"}
      </button>
      {error && <p className="auth-error">{error}</p>}
    </form>
  );
}

export default AdminLogin;
