const express = require("express");

const app = express();

app.get("/", (req, res) => {
  res.send("EXPRESS MODE OK");
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

module.exports = app;
