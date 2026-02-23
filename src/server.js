const express = require("express");

const app = express();

app.get("/", (req, res) => {
  res.send("MINIMAL SERVER RUNNING");
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT;

if (!PORT) {
  console.error("PORT is undefined. Exiting.");
  process.exit(1);
}

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server listening on port", PORT);
});
