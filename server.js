console.log("ROOT SERVER.JS EXECUTED");

const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("ROOT SERVER OK");
});

app.listen(process.env.PORT || 3000, "0.0.0.0", () => {
  console.log("ROOT SERVER LISTENING");
});
