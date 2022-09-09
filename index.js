import { Server } from "http";
import Express from "express";
import bodyParser from "body-parser";
import { Chess } from "./chess.js/chess.js";
import * as SocketIO from "socket.io";

const app = Express();

var games = {};
var game_index = 0;

app.use(bodyParser.text());

const http_server = Server(app);

const socket = new SocketIO.Server(http_server, {
  cors: {
    origin: ["https://www.multiplayer-chess.gq", "http://localhost:8000/"]
  }
});

http_server.listen(34874, function() {
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

app.get("/state/:id([0-9]{5})", function(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.send(JSON.stringify(games[parseInt(request.params.id)].board.board()))
});

// const http_server = http.createServer(app).listen(app.get("port"), function() { });

socket.on("connection", function(socket) {
  console.log(socket);
});
