import Express from "express";
import bodyParser from "body-parser";
import { Chess } from "./chess.js/chess.js";
import { Server } from "./socket.io/socket.js";

const app = Express();

var games = {};
var game_index = 0;

app.use(bodyParser.text());

app.listen(34874, function() {
  console.log("Started listening for requests on port 34874");
});

app.get("/", function(request, response) {
  response.redirect("https://multiplayer-chess.gq/");
});

app.post("/game", function(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  game_index++;
  games[game_index] = {"id": game_index, "type": JSON.parse(request.body)["type"], board: new Chess()};
  response.send("0".repeat(5 - game_index.toString().length) + game_index.toString());
});

app.get("/moves/:id([0-9]{5})", function(request, response) {
  response.send("")
});

app.get("/turn/:id([0-9]{5})", function(request, response) {
  console.log(id);
  // response.send(games[id])
});

app.get("/state/:id([0-9]{5})", function(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.send(JSON.stringify(games[parseInt(request.params.id)].board.board()))
})
