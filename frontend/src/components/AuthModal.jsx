import React, { useMemo, useState } from "react";
import { loginCustomer, registerCustomer, verifyRegistration, resendRegistration } from "../api";

function AuthModal({ open, onClose, onAuthSuccess, customerProfile, onLogout, showGuestOption, onGuestCheckout }) {
  const [tab, setTab] = useState("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1); // 1: form, 2: verification code

  const [registerForm, setRegisterForm] = useState({
    firstName: "",
    phone: "",
    email: "",
    password: "",
  });

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });

  const [verificationCode, setVerificationCode] = useState("");

  const resetState = () => {
    setError("");
    setLoading(false);
    setStep(1);
  };

  const switchTab = (nextTab) => {
    resetState();
    setTab(nextTab);
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await registerCustomer(registerForm);
      setStep(2);
    } catch (err) {
      setError(err.message || "No se pudo registrar");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await verifyRegistration({ email: registerForm.email, code: verificationCode });
      onAuthSuccess(data);
      onClose();
    } catch (err) {
      setError(err.message || "Codigo invalido. Intenta reenviar.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setLoading(true);
    try {
      await resendRegistration({ email: registerForm.email });
      setError("Te hemos enviado un nuevo código.");
    } catch (err) {
      setError(err.message || "No se pudo reenviar");
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
      onAuthSuccess(data);
      onClose();
    } catch (err) {
      if (err.message === "email_not_verified") {
        setRegisterForm({ ...registerForm, email: loginForm.email });
        setError("Tu cuenta no esta verificada. Te enviamos un codigo a tu email.");
        setStep(2);
      } else {
        setError(err.message || "Credenciales invalidas");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="auth-close-btn" onClick={onClose}>✕</button>

        <div className="auth-header">
          {tab === "login" && <h2>Ingresa a tu cuenta</h2>}
          {tab === "register" && <h2>Crea una cuenta</h2>}
          {tab === "guest" && <h2>Checkout Rápido</h2>}
        </div>

        <div className="auth-nav-tabs">
          <button 
            className={`auth-tab ${tab === "login" ? "active" : ""}`} 
            onClick={() => switchTab("login")}
          >
            Ingresar
          </button>
          <button 
            className={`auth-tab ${tab === "register" ? "active" : ""}`} 
            onClick={() => switchTab("register")}
          >
            Registrarme
          </button>
          {showGuestOption && (
            <button 
              className={`auth-tab ${tab === "guest" ? "active" : ""}`} 
              onClick={() => switchTab("guest")}
            >
              Invitado
            </button>
          )}
        </div>

        <div className="auth-body">
          {tab === "login" && (
            <form className="auth-form-pure" onSubmit={handleLogin}>
              <input 
                type="email" 
                placeholder="Correo Electrónico" 
                value={loginForm.email}
                onChange={e => setLoginForm({...loginForm, email: e.target.value})}
                required 
              />
              <input 
                type="password" 
                placeholder="Contraseña" 
                value={loginForm.password}
                onChange={e => setLoginForm({...loginForm, password: e.target.value})}
                required 
              />
              <button type="button" className="auth-forgot-link">Olvidé mi contraseña</button>
              <button type="submit" className="auth-main-btn" disabled={loading}>
                {loading ? "CARGANDO..." : "ENTRAR"}
              </button>
            </form>
          )}

          {tab === "register" && (
            <>
              {step === 1 ? (
                <form className="auth-form-pure" onSubmit={handleRegister}>
                  <input 
                    type="text" 
                    placeholder="Nombre Completo" 
                    value={registerForm.firstName}
                    onChange={e => setRegisterForm({...registerForm, firstName: e.target.value})}
                    required 
                  />
                  <input 
                    type="text" 
                    placeholder="Teléfono" 
                    value={registerForm.phone}
                    onChange={e => setRegisterForm({...registerForm, phone: e.target.value})}
                    required 
                  />
                  <input 
                    type="email" 
                    placeholder="Correo Electrónico" 
                    value={registerForm.email}
                    onChange={e => setRegisterForm({...registerForm, email: e.target.value})}
                    required 
                  />
                  <input 
                    type="password" 
                    placeholder="Contraseña" 
                    value={registerForm.password}
                    onChange={e => setRegisterForm({...registerForm, password: e.target.value})}
                    required 
                  />
                  <button type="submit" className="auth-main-btn" disabled={loading}>
                    {loading ? "PROCESANDO..." : "CREAR CUENTA"}
                  </button>
                </form>
              ) : (
                <form className="auth-form-pure" onSubmit={handleVerify}>
                  <div className="auth-verify-msg">
                    <strong>¡Estás a un paso de crear tu cuenta!</strong>
                    <span>Te enviamos un código a <strong>{registerForm.email}</strong> para que valides tu email.</span>
                  </div>
                  <input 
                    type="text" 
                    placeholder="Código de 6 dígitos" 
                    maxLength={6}
                    value={verificationCode}
                    onChange={e => setVerificationCode(e.target.value)}
                    required 
                  />
                  <div className="button-row">
                    <button type="submit" className="auth-main-btn" disabled={loading}>
                      {loading ? "VERIFICANDO..." : "VALIDAR CÓDIGO"}
                    </button>
                    <button type="button" className="auth-main-btn secondary" disabled={loading} onClick={handleResend} style={{background: 'transparent', color: '#000', border: '1px solid #ddd'}}>
                      {loading ? "..." : "REENVIAR CÓDIGO"}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {tab === "guest" && (
            <form className="auth-form-pure" onSubmit={(e) => { 
                e.preventDefault(); 
                onGuestCheckout({
                  customerName: e.target.elements.guestName.value,
                  phone: e.target.elements.guestPhone.value,
                  email: e.target.elements.guestEmail.value
                }); 
              }}>
              <input name="guestName" type="text" placeholder="Nombre Completo" required />
              <input name="guestPhone" type="text" placeholder="Teléfono" required />
              <input name="guestEmail" type="email" placeholder="Correo Electrónico" required />
              <button type="submit" className="auth-main-btn">
                CONTINUAR COMO INVITADO
              </button>
            </form>
          )}
          
          {error && <div className="auth-error-msg">{error}</div>}
        </div>
      </div>
    </div>
  );
}

export default AuthModal;
