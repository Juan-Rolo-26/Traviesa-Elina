const express = require("express");
const path = require("path");
const { applyRuntimeFallbackEnv } = require("./src/config/runtimeEnv");

applyRuntimeFallbackEnv();

const authRoutes = require("./src/routes/auth");
const productRoutes = require("./src/routes/products");
const orderRoutes = require("./src/routes/orders");
const customerRoutes = require("./src/routes/customers");
const mabelRoutes = require("./src/routes/mabel");
const paymentRoutes = require("./src/routes/payments");
const webhookRoutes = require("./src/routes/webhooks");
const testRoutes = require("./src/routes/test");

const app = express();

app.disable("etag");

app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.set("Surrogate-Control", "no-store");
  next();
});

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/runtime-check", (req, res) => {
  const databaseUrl = String(process.env.DATABASE_URL || "");
  let databaseHost = null;

  if (databaseUrl) {
    try {
      databaseHost = new URL(databaseUrl).hostname || null;
    } catch (_error) {
      databaseHost = "invalid_url";
    }
  }

  return res.json({
    ok: true,
    diag_key_present: Boolean(process.env.DIAG_KEY),
    database_url_present: Boolean(databaseUrl),
    database_host: databaseHost,
    node_env: process.env.NODE_ENV || null,
    timestamp: new Date().toISOString(),
  });
});

app.get("/debug-files", (req, res) => {
  const fs = require("fs");
  const path = require("path");

  const base = path.join(__dirname, "frontend");
  const dist = path.join(__dirname, "frontend", "dist");

  const existsBase = fs.existsSync(base);
  const existsDist = fs.existsSync(dist);
  const existsIndex = fs.existsSync(path.join(dist, "index.html"));

  res.json({
    frontend_exists: existsBase,
    dist_exists: existsDist,
    dist_index_exists: existsIndex
  });
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api/auth", authRoutes);
app.use("/api/mabel", mabelRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/test", testRoutes);

const FRONTEND_DIST = path.join(__dirname, "frontend", "dist");

app.use(express.static(FRONTEND_DIST));

app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(FRONTEND_DIST, "index.html"));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Express + Frontend running");
});
