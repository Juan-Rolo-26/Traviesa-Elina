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
