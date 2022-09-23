import Express from "express";
import bodyParser from "body-parser";
import { Chess } from "chess.js";
import crypto from "crypto";
import http from "http";

const server_url = "server.multiplayer-chess.gq";
// const server_url = "localhost";

const server_port = "45318";
// const server_port = "3000";

const app = Express();

var games = {};
var game_index = 0;

var game_uuids = {};

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
  let uuid = crypto.randomUUID();
  if (parseInt(request.params.id) > game_index || !board.moves().includes(request_body["move"])) {
    response.status(400).send("");
    response.end();
    return;
  };
  board.move(request_body["move"]);
  if (games[parseInt(request.params.id)].type == 0) {
    const request_ = http.request({
      method: "POST",
      hostname: server_url,
      port: server_port,
      path: "/auth",
      headers: {"Content-Type": "text/plain", "-x-uuid": uuid}
    }, (result) => {
      result.on("data", (data) => {
        const request_ = http.request({
          method: "POST",
          hostname: server_url,
          port: server_port,
          path: "/result",
          headers: {"Content-Type": "text/plain", "-x-uuid": uuid, "-x-fen": board.fen()}
        }, (result) => {
          result.on("data", (data) => {
            game_uuids[uuid] = request.params.id
          });
        });
        
        request_.on("error", error => {
          console.log("From 2nd step of 3WH;");
          console.error(error);
        });
        
        request_.write((parseInt(data) / parseInt(process.env.SECRET2) * parseInt(process.env.SECRET)).toString());
        request_.end();
      });
    });
    
    request_.on("error", error => {
      console.log("From 1st step of 3WH;");
      console.error(error);
    });
    
    request_.write("");
    request_.end();
  };
  response.send("");
});

// parseInt(crypto.randomBytes(4).toString("hex"), 16) * parseInt(process.env.SECRET)
