const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // your Next.js dev server
    methods: ["GET", "POST"],
  },
});

let game = {
  map: [],
  warder: null,
  prisoner: null,
  tunnel: null,
};

function generateMap() {
  game.map = Array(5).fill().map(() => Array(5).fill("free"));

  // Place obstacles
  for (let i = 0; i < 5; i++) {
    let x = Math.floor(Math.random() * 5);
    let y = Math.floor(Math.random() * 5);
    if (game.map[x][y] === "free") game.map[x][y] = "obstacle";
  }

  // Place tunnel
  while (true) {
    let x = Math.floor(Math.random() * 5);
    let y = Math.floor(Math.random() * 5);
    if (game.map[x][y] === "free") {
      game.map[x][y] = "tunnel";
      game.tunnel = [x, y];
      break;
    }
  }
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("start-game", () => {
    generateMap();
    io.emit("game-started", game);
  });

  socket.on("move", (data) => {
    // Update game state (simplified)
    if (data.player === "warder") game.warder = data.pos;
    if (data.player === "prisoner") game.prisoner = data.pos;

    // Check for win
    let winner = null;
    if (
      game.warder &&
      game.prisoner &&
      game.warder[0] === game.prisoner[0] &&
      game.warder[1] === game.prisoner[1]
    )
      winner = "warder";
    if (
      game.prisoner &&
      game.tunnel &&
      game.prisoner[0] === game.tunnel[0] &&
      game.prisoner[1] === game.tunnel[1]
    )
      winner = "prisoner";

    io.emit("update", { ...game, winner });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

app.get("/", (req, res) => {
  res.send("Escape Plan server running!");
});

const PORT = 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
