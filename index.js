import Express from "express";
import bodyParser from "body-parser";
import { Chess } from "chess.js";
import crypto from "crypto";
import http from "http";
import fetch from "node-fetch";

const database_table = "dev2"

const server_url = process.env.SERVER_URL;
// const server_url = "localhost";

const server_port = "5254";
// const server_port = "3000";

const app = Express();

async function query(path, method="GET", body=undefined) {
  let request = await fetch(`https://${process.env.ASTRA_DB_ID}-${process.env.ASTRA_DB_REGION}.apps.astra.datastax.com/api/rest${path}`, {
    method: method,
    body: body,
    headers: {
      "x-cassandra-token": process.env.ASTRA_DB_APPLICATION_TOKEN,
      "content-type": "application/json" // TODO: only send for POSTs; sending with GET wasts bandwidth
    }
  });

  return await request.json();
};

app.use(bodyParser.text());

app.listen(34874, function() {
  console.warn("Started listening for requests on port 34874"); // console.WARN?
});

app.get("/", function(request, response) {
  response.redirect("https://multiplayerchess.gq/");
});

app.post("/game", async function(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  let row = await query("/v2/keyspaces/chess/constants/INDEX");
  let game_index = parseInt(row["data"][0]["value"]);
  let request_body = JSON.parse(request.body);
  let auth_key = crypto.randomBytes(64).toString("hex");
  // games[game_index] = {"id": game_index, "type": request_body["type"], "board": new Chess(), "joined": (request_body["type"] == 0 ? true : false), "auth1": auth_key};
  const date = new Date();
  await query("/v2/keyspaces/chess/" + database_table, "POST", JSON.stringify({"id": game_index, "auth1": auth_key.toString(), "auth2": "", "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "pgn": `[Event \"Online chess game\"]\n[Site \"multiplayerchess.gq\"]\n[Date \"${date.getUTCDate()}.${date.getUTCMonth() + 1}.${date.getUTCDate()}\"]\n[UTCTime \"${date.getUTCHours()}:${date.getUTCMinutes()}:${date.getUTCSeconds()}\"]\n[Round \"1\"]\n[White "Anonymous"]\n[Black "${request_body["type"] == 0 ? "Stockfish" : "Anonymous"}"]\n[Result "*"]\n\n\n*`}));
  await query("/v2/keyspaces/chess/constants/INDEX", "PATCH", JSON.stringify({"value": (game_index + 1).toString()}));
  return response.send(JSON.stringify({"id": "0".repeat(5 - game_index.toString().length) + game_index.toString(), "auth_key": auth_key}));
});

app.post("/api/join_status/:id([0-9]{5})", async function(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  let data = await query(`/v2/keyspaces/chess/${database_table}/${parseInt(request.params.id)}`);
  if (data["count"] == 0) {
    response.status(400);
    return response.end();
  };
  return response.send(JSON.stringify(Boolean(data["data"][0]["auth2"])));
})

app.post("/api/status/:id([0-9]{5})", async function(request, response) {
  // TODO: filter out moves that are not available to the requesting player; e.g. using auth methods
  response.setHeader("Access-Control-Allow-Origin", "*");
  let data = await query(`/v2/keyspaces/chess/${database_table}/${parseInt(request.params.id)}`);
  if (data["count"] == 0) {
    response.status(400).send("");
    return response.end();
  };
  data = data["data"][0];
  let is_computer_game = data["pgn"].includes("Stockfish");
  if (!is_computer_game && !data["auth2"]) {
    let auth_key = crypto.randomBytes(64).toString("hex");
    await query(`/v2/keyspaces/chess/${database_table}/${parseInt(request.params.id).toString()}`, "PATCH", JSON.stringify({"auth2": auth_key}));
    return response.send(JSON.stringify({"auth": auth_key}));
  };

  let board = new Chess(data["fen"]);
  if (is_computer_game && board.turn() == "b") { // TODO: add option for computer to play white; change this clause
    return response.send(JSON.stringify({"turn": board.turn(), "moves": [], "board": board.board()}));
  };
  // let game = games[parseInt(request.params.id)];
  let response_data = {"turn": board.turn(), moves: [], "board": board.board()};
  if (!is_computer_game && !data["auth2"]) {
    return response.send(JSON.stringify(response_data));
  };
  if (request.body == data["auth1"]) {
    if (board.turn() == "w") {
      response_data["moves"] = board.moves({ verbose: true });
    };
    return response.send(JSON.stringify(response_data));
  } else if (request.body == data["auth2"]) {
    if (board.turn() == "b") {
      response_data["moves"] = board.moves({ verbose: true });
    };
    return response.send(JSON.stringify(response_data));
  } else {
    return response.send(JSON.stringify({"turn": board.turn(), "moves": [], "board": board.board()}));
  };
});

app.post("/api/move/:id([0-9]{5})", async function(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  let data = await query(`/v2/keyspaces/chess/${database_table}/${parseInt(request.params.id)}`);
  if (data["count"] == 0) {
    response.status(400).send("");
    return response.end();
  };
  data = data["data"][0];
  let board = new Chess(data["fen"]);
  let is_computer_game = data["pgn"].includes("Stockfish");
  let request_body = JSON.parse(request.body);
  if (!board.moves().includes(request_body["move"])) {
    response.status(400).send("");
    return response.end();
  };
  board.move(request_body["move"]);
  let new_pgn = data["pgn"].slice(0, -1);
  if (board.turn() == "b") {
    new_pgn += `${data["fen"].split(" ").slice(-1)[0]}. ${request_body["move"]} `;
  } else {
    new_pgn += `${request_body["move"]} `;
  };
  new_pgn += "*";
  await query(`/v2/keyspaces/chess/${database_table}/${parseInt(request.params.id).toString()}`, "PATCH", JSON.stringify({"fen": board.fen(), "pgn": new_pgn}));
  if (!is_computer_game) {
    return response.send("");
  };
  let uuid = crypto.randomUUID();
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
        headers: {"Content-Type": "text/plain", "-x-uuid": uuid, "-x-fen": board.fen(), "-x-board-id": parseInt(request.params.id).toString()}
      }, (result) => {
        result.on("data", (data) => { });
      });
      
      request_.on("error", error => {
        console.error("From 2nd step of 3WH;");
        console.error(error);
      });
      
      request_.write((parseInt(data) / parseInt(process.env.SECRET2) * parseInt(process.env.SECRET)).toString());
      console.log(parseInt(data))
      request_.end();
    });
  });
  
  request_.on("error", error => {
    console.error("From 1st step of 3WH;");
    console.error(error);
  });
  
  request_.write("");
  request_.end();
  return response.send("");
});

app.post("/result", async function(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  // HTTPS request
  console.log("asdfghasdfnasdfbsv")
  if (!request.headers["-x-board-id"]) {
    response.status(400);
    return response.end();;
  };
  let board_id = (parseInt(request.headers["-x-board-id"]) - parseInt(process.env.SECRET3) + parseInt(process.env.SECRET2)) / parseInt(process.env.SECRET3);
  let data = await query(`/v2/keyspaces/chess/${database_table}/${parseInt(board_id)}`);
  if (data["count"] == 0) {
    response.status(400);
    return response.end();;
  };
  data = data["data"][0];

  let board = new Chess(data["fen"]);
  let SAN_move = board.move(request.body, {sloppy: true}).san;
  let new_pgn = data["pgn"].slice(0, -1);
  if (board.turn() == "b") {
    new_pgn += `${data["fen"].split(" ").slice(-1)[0]}. ${SAN_move} `;
  } else {
    new_pgn += `${SAN_move} `;
  };
  new_pgn += "*";
  await query(`/v2/keyspaces/chess/${database_table}/${parseInt(board_id).toString()}`, "PATCH", JSON.stringify({"fen": board.fen(), "pgn": new_pgn}));
  return response.end();
});

