const express = require("express");
const path = require("path");

const app = express();

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

const FRONTEND_DIST = path.join(__dirname, "..", "frontend", "dist");

app.use(express.static(FRONTEND_DIST));

app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(FRONTEND_DIST, "index.html"));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Express + Frontend running");
});
