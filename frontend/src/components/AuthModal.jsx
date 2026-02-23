import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  forgotPassword,
  loginCustomer,
  registerCustomer,
  verifyResetCode,
} from "../api";

function AuthModal({ open, onClose, onAuthSuccess, customerProfile, customerIsAdmin, onLogout }) {
  const [tab, setTab] = useState("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [registerForm, setRegisterForm] = useState({
    email: "",
    username: "",
    password: "",
  });

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });

  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [forgotEmailSent, setForgotEmailSent] = useState(false);

  const displayName = useMemo(() => {
    if (!customerProfile) return "";
    return customerProfile.firstName || customerProfile.username || customerProfile.email?.split("@")[0] || "";
  }, [customerProfile]);

  const resetForgotState = () => {
    setForgotCode("");
    setForgotEmailSent(false);
  };

  const switchTab = (nextTab) => {
    setError("");
    setTab(nextTab);
    if (nextTab !== "forgot") {
      resetForgotState();
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await registerCustomer(registerForm);
      onAuthSuccess(data, "Registro exitoso");
      onClose();
    } catch (err) {
      console.error("[auth/register] failed", {
        message: err?.message,
        email: registerForm.email,
        username: registerForm.username,
      });
      setError(err.message || "No se pudo registrar");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await loginCustomer(loginForm);
      onAuthSuccess(data, "Inicio de sesion exitoso");
      onClose();
    } catch (err) {
      console.error("[auth/login] failed", {
        message: err?.message,
        email: loginForm.email,
      });
      setError(err.message || "No se pudo iniciar sesion");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotEmail = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await forgotPassword({ email: forgotEmail });
      setForgotEmailSent(true);
    } catch (err) {
      setError(err.message || "No se pudo enviar el codigo");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotVerify = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await verifyResetCode({ email: forgotEmail, code: forgotCode });
      onAuthSuccess(data, "Inicio de sesion exitoso");
      onClose();
    } catch (err) {
      setError(err.message || "Codigo invalido o vencido");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="Cerrar">
          ✕
        </button>

        {customerProfile ? (
          <div className="profile-view">
            <h2>Hola {displayName}</h2>
            <div className="profile-list">
              <div><strong>Email:</strong> {customerProfile.email}</div>
              <div><strong>Usuario:</strong> {customerProfile.username || customerProfile.firstName || ""}</div>
              <div><strong>Nombre:</strong> {customerProfile.firstName || ""}</div>
              <div><strong>Apellido:</strong> {customerProfile.lastName || ""}</div>
              <div><strong>Provincia:</strong> {customerProfile.province || ""}</div>
              <div><strong>Ciudad:</strong> {customerProfile.city || ""}</div>
              <div><strong>Direccion 1:</strong> {customerProfile.address1 || ""}</div>
              <div><strong>Direccion 2:</strong> {customerProfile.address2 || ""}</div>
              <div><strong>Codigo postal:</strong> {customerProfile.postalCode || ""}</div>
              <div><strong>Telefono:</strong> {customerProfile.phone || ""}</div>
            </div>
            {customerIsAdmin && (
              <Link className="button secondary" to="/admin" onClick={onClose}>
                Agregar productos
              </Link>
            )}
            <button
              className="button"
              type="button"
              onClick={() => {
                onLogout();
                onClose();
              }}
            >
              Cerrar sesion
            </button>
          </div>
        ) : (
          <>
            <h2>Tu cuenta</h2>

            <div className="auth-tabs">
              <button
                type="button"
                className={`button secondary ${tab === "register" ? "active" : ""}`}
                onClick={() => switchTab("register")}
              >
                Registrarse
              </button>
              <button
                type="button"
                className={`button secondary ${tab === "login" ? "active" : ""}`}
                onClick={() => switchTab("login")}
              >
                Iniciar sesion
              </button>
            </div>

            {tab === "register" && (
              <form className="auth-form" onSubmit={handleRegister}>
                <input
                  type="email"
                  placeholder="Email"
                  value={registerForm.email}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, email: event.target.value }))}
                  required
                />
                <input
                  type="text"
                  placeholder="Nombre de usuario"
                  value={registerForm.username}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, username: event.target.value }))}
                  required
                />
                <input
                  type="password"
                  placeholder="Contrasena (minimo 8)"
                  value={registerForm.password}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, password: event.target.value }))}
                  minLength={8}
                  required
                />
                <button className="button" type="submit" disabled={loading}>
                  {loading ? "Procesando..." : "Registrarse"}
                </button>
              </form>
            )}

            {tab === "login" && (
              <form className="auth-form" onSubmit={handleLogin}>
                <input
                  type="email"
                  placeholder="Email"
                  value={loginForm.email}
                  onChange={(event) => setLoginForm((prev) => ({ ...prev, email: event.target.value }))}
                  required
                />
                <input
                  type="password"
                  placeholder="Contrasena"
                  value={loginForm.password}
                  onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))}
                  required
                />
                <button className="button" type="submit" disabled={loading}>
                  {loading ? "Procesando..." : "Iniciar sesion"}
                </button>
                <button className="auth-link" type="button" onClick={() => switchTab("forgot")}>
                  Olvide mi contrasena
                </button>
              </form>
            )}

            {tab === "forgot" && (
              <>
                {!forgotEmailSent ? (
                  <form className="auth-form" onSubmit={handleForgotEmail}>
                    <input
                      type="email"
                      placeholder="Email"
                      value={forgotEmail}
                      onChange={(event) => setForgotEmail(event.target.value)}
                      required
                    />
                    <button className="button" type="submit" disabled={loading}>
                      {loading ? "Enviando..." : "Enviar codigo"}
                    </button>
                    <button className="auth-link" type="button" onClick={() => switchTab("login")}>
                      Volver a iniciar sesion
                    </button>
                  </form>
                ) : (
                  <form className="auth-form" onSubmit={handleForgotVerify}>
                    <p className="helper">Ingresa el codigo de 6 digitos que enviamos a tu email.</p>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Codigo"
                      value={forgotCode}
                      onChange={(event) => setForgotCode(event.target.value)}
                      required
                    />
                    <button className="button" type="submit" disabled={loading}>
                      {loading ? "Verificando..." : "Verificar codigo"}
                    </button>
                  </form>
                )}
              </>
            )}

            {error && <p className="auth-error">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}

export default AuthModal;
