import Express from "express";
import bodyParser from "body-parser";
import { Chess } from "./chess.js/chess.js";
import "crypto";

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

app.post("/api/status/:id([0-9]{5})", function(request, response) {
  //TODO: filter out moves that are not available to the requesting player; e.g. using auth methods
  response.setHeader("Access-Control-Allow-Origin", "*");
  if (parseInt(request.params.id) > game_index) {
    response.status(400).send("");
    return;
  };
  let board = games[parseInt(request.params.id)].board;
  response.send(JSON.stringify({"turn": board.turn(), "moves": board.moves({verbose: true}), "board": board.board()}))
});

app.post("/api/move/:id([0-9]{5})", function(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  let board = games[parseInt(request.params.id)].board;
  let request_body = JSON.parse(request.body)
  if (parseInt(request.params.id) > game_index || !board.moves().includes(request_body["move"])) {
    response.status(400).send("");
    return;
  };
  board.move(request_body["move"]);
  response.send("");
});
