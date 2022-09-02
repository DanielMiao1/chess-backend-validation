const express = require("express");

const app = express();

app.listen(34874, function() {
  console.log("Started listening for requests on port 34874");
});

app.get("/", function(request, response) {
  response.redirect("https://multiplayer-chess.gq/");
});

app.post("/game", function(request, response) {
  response.setHeader("Content-Security-Policy", "default-src *");
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.set("Cache-Control", "no-store");
  console.log(request.body);
});
