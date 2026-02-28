function trimString(value) {
  return String(value || "").trim();
}

const FALLBACK_ENV = {
  DIAG_KEY: "abc123_test_runtime",
  DATABASE_URL:
    "mysql://u266391435_franchela:Isla-caiman123@srv1660.hstgr.io:3306/u266391435_tienda_mabel?connect_timeout=5&charset=utf8mb4",
};

function applyRuntimeFallbackEnv() {
  for (const [key, value] of Object.entries(FALLBACK_ENV)) {
    if (!trimString(process.env[key])) {
      process.env[key] = value;
      console.warn(`[runtime-env] Missing ${key}. Using fallback value.`);
    }
  }
}

module.exports = { applyRuntimeFallbackEnv };
