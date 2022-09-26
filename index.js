import Express from "express";
import bodyParser from "body-parser";
import { Chess } from "chess.js";
import crypto from "crypto";
import http from "http";

const server_url = "server.multiplayerchess.gq";
// const server_url = "localhost";

const server_port = "45318";
// const server_port = "3000";

const app = Express();

var games = {};
var game_index = 0;

app.use(bodyParser.text());

app.listen(34874, function() {
  console.log("Started listening for requests on port 34874");
});

app.get("/", function(request, response) {
  response.redirect("https://multiplayerchess.gq/");
});

app.post("/game", function(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  game_index++;
  let auth_key = crypto.randomBytes(64).toString("hex");
  games[game_index] = {"id": game_index, "type": JSON.parse(request.body)["type"], "board": new Chess(), "joined": (JSON.parse(request.body)["type"] == 0 ? true : false), "auth1": auth_key};
  response.send(JSON.stringify({"id": "0".repeat(5 - game_index.toString().length) + game_index.toString(), "auth_key": auth_key}));
});

app.post("/api/join_status/:id([0-9]{5})", function(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  if (parseInt(request.params.id) > game_index) {
    response.status(400).send("");
    return;
  };
  if (games[parseInt(request.params.id)]) {
    response.send(JSON.stringify(games[parseInt(request.params.id)]["joined"]));
  } else {
    response.status(400);
    response.end();
  }
})

app.post("/api/status/:id([0-9]{5})", function(request, response) {
  // TODO: filter out moves that are not available to the requesting player; e.g. using auth methods
  response.setHeader("Access-Control-Allow-Origin", "*");
  if (parseInt(request.params.id) > game_index) {
    response.status(400).send("");
    return;
  };  
  if (games[parseInt(request.params.id)]["type"] == "1" && !games[parseInt(request.params.id)]["joined"]) {
    games[parseInt(request.params.id)]["joined"] = true;
    let auth_key = crypto.randomBytes(64).toString("hex");
    games[parseInt(request.params.id)]["auth2"] = auth_key;
    response.send(JSON.stringify({"auth": auth_key}))
    return;
  }
  let board = games[parseInt(request.params.id)].board;
  if (games[parseInt(request.params.id)].type == 0 && board.turn() == "b") {
    response.send(JSON.stringify({"turn": board.turn(), "moves": [], "board": board.board()}))
  } else {
    let game = games[parseInt(request.params.id)];
    let data = {"turn": board.turn(), "board": board.board()};
    if (!game["joined"]) {
      data["moves"] = [];
      response.send(JSON.stringify(data));
    };
    if (request.body == game["auth1"]) {
      if (board.turn() == "w") {
        data["moves"] = board.moves({ verbose: true });
      } else {
        data["moves"] = [];
      };
      response.send(JSON.stringify(data))
    } else if (request.body == game["auth2"]) {
      if (board.turn() == "b") {
        data["moves"] = board.moves({ verbose: true });
      } else {
        data["moves"] = [];
      };
      response.send(JSON.stringify(data))
    } else {
      response.send(JSON.stringify({"turn": board.turn(), "moves": [], "board": board.board()}))
    };
  };
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
          headers: {"Content-Type": "text/plain", "-x-uuid": uuid, "-x-fen": board.fen(), "-x-board-id": games[parseInt(request.params.id)].id}
        }, (result) => {
          result.on("data", (data) => {
            console
          });
        });
        
        request_.on("error", error => {
          console.error("From 2nd step of 3WH;");
          console.error(error);
        });
        
        request_.write((parseInt(data) / parseInt(process.env.SECRET2) * parseInt(process.env.SECRET)).toString());
        request_.end();
      });
    });
    
    request_.on("error", error => {
      console.error("From 1st step of 3WH;");
      console.error(error);
    });
    
    request_.write("");
    request_.end();
  };
  response.send("");
});

app.post("/result", function(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  // HTTPS request
  if (!request.headers["-x-board-id"]) {
    response.status(400);
    response.end();
    return;
  } else if ((parseInt(request.headers["-x-board-id"]) - parseInt(process.env.SECRET3) + parseInt(process.env.SECRET2)) / parseInt(process.env.SECRET3) > game_index) {
    response.status(400);
    response.end();
    return;
  };
  let board = games[(parseInt(request.headers["-x-board-id"]) - parseInt(process.env.SECRET3) + parseInt(process.env.SECRET2)) / parseInt(process.env.SECRET3)].board;
  board.move(request.body, {sloppy: true});
  response.end()
});

