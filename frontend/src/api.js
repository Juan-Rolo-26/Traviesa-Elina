const API_URL = "";
const AUTH_TIMEOUT_MS = 12000;

async function readError(res, fallback) {
  const data = await res.json().catch(() => ({}));
  throw new Error(data.error || fallback);
}

async function postJsonWithHandling(path, payload, fallbackError) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    let body = {};
    try {
      body = await res.json();
    } catch (_) {
      body = {};
    }

    if (!res.ok) {
      throw new Error(body.error || fallbackError);
    }

    return body;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("La solicitud demoro demasiado. Intenta de nuevo.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function registerCustomer(payload) {
  return postJsonWithHandling("/api/auth/register", payload, "No se pudo registrar");
}

export async function loginCustomer(payload) {
  return postJsonWithHandling("/api/auth/login", payload, "Credenciales invalidas");
}

export async function forgotPassword(payload) {
  const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    return readError(res, "No se pudo enviar el codigo");
  }
  return res.json();
}

export async function verifyResetCode(payload) {
  const res = await fetch(`${API_URL}/api/auth/reset-password/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    return readError(res, "Codigo invalido o vencido");
  }
  return res.json();
}

export async function resetPassword(payload) {
  const res = await fetch(`${API_URL}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    return readError(res, "No se pudo restablecer la contrasena");
  }
  return res.json();
}

export async function loginAdmin(username, password) {
  const res = await fetch(`${API_URL}/api/auth/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    return readError(res, "Credenciales invalidas");
  }
  return res.json();
}

export async function fetchAdminStatus(token) {
  const res = await fetch(`${API_URL}/api/auth/admin-status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    return readError(res, "No se pudo validar admin");
  }
  return res.json();
}

export async function fetchCustomer(token) {
  const res = await fetch(`${API_URL}/api/customers/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    return readError(res, "No se pudo cargar el perfil");
  }
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
  if (!res.ok) {
    return readError(res, "No se pudo guardar el perfil");
  }
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
    return readError(res, "No se pudo eliminar el metodo guardado");
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
    return readError(res, "No se pudo crear el producto");
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
    return readError(res, "No se pudo actualizar el producto");
  }
  return res.json();
}

export async function deleteProduct(productId, token) {
  const res = await fetch(`${API_URL}/api/products/${productId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    return readError(res, "No se pudo eliminar el producto");
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
    return readError(res, "No se pudo inicializar el pago");
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
    return readError(res, "No se pudo procesar el pago");
  }
  return res.json();
}
