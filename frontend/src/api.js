const API_URL = "";

export async function loginAdmin(username, password) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error("Credenciales invalidas");
  return res.json();
}

export async function loginAdminWithGoogle(idToken) {
  const res = await fetch(`${API_URL}/api/auth/google-admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) throw new Error("No autorizado");
  return res.json();
}

export async function loginWithGoogle(idToken) {
  const res = await fetch(`${API_URL}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "No se pudo iniciar sesion con Google");
  }
  return res.json();
}

export async function fetchAdminStatus(token) {
  const res = await fetch(`${API_URL}/api/auth/admin-status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("No se pudo validar admin");
  return res.json();
}

export async function fetchCustomer(token) {
  const res = await fetch(`${API_URL}/api/customers/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("No se pudo cargar el perfil");
  return res.json();
}

export async function updateCustomerProfile(token, payload) {
  const res = await fetch(`${API_URL}/api/customers/me`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("No se pudo guardar el perfil");
  return res.json();
}

export async function deleteSavedPaymentMethod(token, paymentMethodId) {
  const res = await fetch(`${API_URL}/api/customers/payment-methods/${paymentMethodId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "No se pudo eliminar el metodo guardado");
  }
  return res.json();
}

export async function fetchProducts() {
  const res = await fetch(`${API_URL}/api/products`);
  if (!res.ok) throw new Error("No se pudieron cargar productos");
  return res.json();
}

export async function fetchProduct(id) {
  const res = await fetch(`${API_URL}/api/products/${id}`);
  if (!res.ok) throw new Error("No se pudo cargar el producto");
  return res.json();
}

export async function createProduct(formData, token) {
  const res = await fetch(`${API_URL}/api/products`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "No se pudo crear el producto");
  }
  return res.json();
}

export async function updateProduct(productId, formData, token) {
  const res = await fetch(`${API_URL}/api/products/${productId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "No se pudo actualizar el producto");
  }
  return res.json();
}

export async function deleteProduct(productId, token) {
  const res = await fetch(`${API_URL}/api/products/${productId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "No se pudo eliminar el producto");
  }
  return res.json();
}

export async function initPayment(payload, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}/api/payments/init`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "No se pudo inicializar el pago");
  }
  return res.json();
}

export async function processPayment(payload, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}/api/payments/process`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "No se pudo procesar el pago");
  }
  return res.json();
}
