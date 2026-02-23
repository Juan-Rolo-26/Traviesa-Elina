const express = require("express");
const cors = require("cors");
const path = require("path");

const testRoutes = require("./routes/test");
const authRoutes = require("./routes/auth");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/test", testRoutes);
app.use("/api/auth", authRoutes);

app.get("/api/_diag/env", (req, res) => {
  const diagKeyHeader = req.get("x-diag-key");
  const diagKeyEnv = process.env.DIAG_KEY;
  if (!diagKeyHeader || !diagKeyEnv || diagKeyHeader !== diagKeyEnv) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const googleClientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();
  const hasGoogleClientId = googleClientId.length > 0;

  res.json({
    has_GOOGLE_CLIENT_ID: hasGoogleClientId,
    google_client_id_len: hasGoogleClientId ? googleClientId.length : 0,
    google_client_id_preview: hasGoogleClientId
      ? `${googleClientId.slice(0, 6)}...`
      : undefined,
    env_keys_matching_google: Object.keys(process.env).filter((key) =>
      key.toUpperCase().includes("GOOGLE")
    ),
    node_env: process.env.NODE_ENV || null,
  });
});

// ===== SERVIR FRONTEND =====
const FRONTEND_DIST = path.join(__dirname, "..", "frontend", "dist");

app.use(express.static(FRONTEND_DIST));

app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(FRONTEND_DIST, "index.html"));
});

// ===== LISTEN =====
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
