const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { nanoid } = require("nanoid"); // For unique room IDs

const app = express();
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://172.20.10.2:3000" // replace with your local IP
  ], 
  methods: ["GET", "POST"]
}));
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, { 
  cors: {
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://172.20.10.2:3000", // your LAN IP
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const PORT = process.env.PORT || 8000;

// =========== Game State ===========
const GRID = 5;
const OBSTACLES = 5;
const TURN_SECONDS = 10;

// Global state
let playerScores = new Map(); // nickname -> wins
const clients = new Map(); // socket.id -> { id, nickname }
const rooms = new Map(); // roomId -> roomData
const socketToRoom = new Map(); // socket.id -> roomId
const NEXT_GAME_DELAY = 5;

// ===== Helpers =====
// (Your helper functions: shuffle, buildBoard, emptyCells, tunnelCell, isAdjacent)
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function buildBoard() {
  const cells = [];
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) cells.push({ r, c, type: 'free' });
  }
  shuffle(cells);
  cells[0].type = 'tunnel';
  for (let i = 1; i <= OBSTACLES; i++) cells[i].type = 'obstacle';
  const board = Array.from({ length: GRID }, () => Array(GRID).fill(null));
  for (const cell of cells) board[cell.r][cell.c] = { type: cell.type };
  return board;
}
function emptyCells(board) {
  const out = [];
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) if (board[r][c].type === 'free') out.push({ r, c });
  }
  return out;
}
function tunnelCell(board) {
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++)
      if (board[r][c].type === 'tunnel') return { r, c };
  return null;
}

function nicknameOf(id) { return clients.get(id)?.nickname || '(unnamed)'; }

function serializeLeaderboard(limit = 20) {
  return Array.from(playerScores.entries())
    .map(([nickname, score]) => ({ nickname, score }))
    .sort((a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname))
    .slice(0, limit);
}
// (End of your helper functions)

// NEW: Room serializer
function serializeRooms() {
  return Array.from(rooms.values()).map(room => ({
    id: room.id,
    name: room.name,
    players: Array.from(room.players.values()).map(p => p.nickname),
    playerCount: room.players.size,
    isPlaying: room.game !== null,
  }));
}
function connectedClientList() {
  return Array.from(clients.values()).map((c) => ({ id: c.id, nickname: c.nickname }));
}

// NEW: Broadcasts
function broadcastRooms() {
  // This is the new 'lobby:update'
  io.emit('room:list', { rooms: serializeRooms() });
}
function broadcastStats() {
  io.emit('server:stats', { 
    online: clients.size,
    clients: connectedClientList(),
  });
}
function broadcastState(room) {
  if (!room || !room.game) return;
  const game = room.game;
  // Emit state ONLY to the room
  io.to(room.id).emit('game:state', {
    positions: game.positions,
    currentTurn: game.currentTurn,
    deadlineTs: game.deadlineTs,
    playerScores: serializeLeaderboard(),
  });
}

// ===== Rules =====
// (Your rules functions: validMoves, safeSpawn)
function validMoves(board, role, pos) {
  const moves = [];
  const dirs = [{ r: 1, c: 0 }, { r: -1, c: 0 }, { r: 0, c: 1 }, { r: 0, c: -1 }];
  for (const d of dirs) {
    const nr = pos.r + d.r, nc = pos.c + d.c;
    if (nr < 0 || nr >= GRID || nc < 0 || nc >= GRID) continue;
    const cellType = board[nr][nc].type;
    if (cellType === 'obstacle') continue;
    if (role === 'warder' && cellType === 'tunnel') continue;
    moves.push({ r: nr, c: nc });
  }
  return moves;
}
function safeSpawn(board) {
  let free = emptyCells(board);
  if (free.length < 2) return null;
  shuffle(free);
  let positions = {
    warder: free.pop() || null,
    prisoner: free.pop() || null
  };
  if (!positions.warder && free.length) positions.warder = free.pop();
  if (!positions.prisoner && free.length) positions.prisoner = free.pop();
  if (!positions.warder || !positions.prisoner) return null;
  const tCell = tunnelCell(board);
  if (tCell && positions.warder.r === tCell.r && positions.warder.c === tCell.c) {
    positions.warder = free.pop() || positions.warder;
  }
  return positions;
}
// (End of your rules functions)

// Timeout = skip turn (now per-room)
function startTurnTimer(room) {
  const game = room.game;
  if (!game) return;
  if (game.intervalId) clearInterval(game.intervalId);

  game.deadlineTs = Date.now() + TURN_SECONDS * 1000;

  game.intervalId = setInterval(() => {
    // Check if room and game still exist
    const roomExists = rooms.get(room.id);
    if (!roomExists || !roomExists.game) return clearInterval(game.intervalId);
    
    const remaining = Math.max(0, Math.ceil((game.deadlineTs - Date.now()) / 1000));
    io.to(room.id).emit('turn:tick', { remaining });
    if (remaining <= 0) {
      switchTurn(room);
    }
  }, 1000);

  broadcastState(room);
}

function applyMove(room, role, to) {
  const game = room.game;
  if (!game) return;

  const other = (role === 'warder') ? 'prisoner' : 'warder';
  // Capture
  if (game.positions[other].r === to.r && game.positions[other].c === to.c) {
    game.positions[role] = to;
    return endGame(room, 'warder');
  }
  // Escape
  const cellType = game.board[to.r][to.c].type;
  if (role === 'prisoner' && cellType === 'tunnel') {
    game.positions[role] = to;
    return endGame(room, 'prisoner');
  }
  game.positions[role] = to;
  broadcastState(room);
}

function switchTurn(room) {
  const game = room.game;
  if (!game) return;
  game.currentTurn = (game.currentTurn === 'warder') ? 'prisoner' : 'warder';
  startTurnTimer(room);
}

// ===== Game lifecycle (PER-ROOM) =====
function startNewMatch(room) {
  // Clear any pending "next game" countdown
  if (room.countdownInterval) {
    clearInterval(room.countdownInterval);
    room.countdownInterval = null;
  }

  const playerList = Array.from(room.players.values());
  if (playerList.length < 2) return false;
  
  // Fulfills "server randomizes first player"
  const shuffledPlayers = shuffle([...playerList]);
  const [p1, p2] = shuffledPlayers;

  const board = buildBoard();
  let positions = safeSpawn(board);
  if (!positions) return false;
  
  // Fulfills "warder will start to move first"
  const roleToSocket = {
    'warder': p1.id,
    'prisoner': p2.id
  };

  room.game = {
    board,
    roleToSocket,
    positions,
    currentTurn: 'warder', // Warder always starts
    deadlineTs: Date.now() + TURN_SECONDS * 1000,
    intervalId: null
  };

  // Emit 'game:start' ONLY to the room
  io.to(room.id).emit('game:start', {
    roomId: room.id,
    grid: GRID,
    board,
    roles: {
      warder: nicknameOf(roleToSocket.warder),
      prisoner: nicknameOf(roleToSocket.prisoner)
    },
    positions,
    currentTurn: room.game.currentTurn,
    turnSeconds: TURN_SECONDS,
    playerScores: serializeLeaderboard(),
  });

  io.to(roleToSocket.warder).emit('role', { role: 'warder' });
  io.to(roleToSocket.prisoner).emit('role', { role: 'prisoner' });

  startTurnTimer(room);
  broadcastRooms(); // Show this room is now "playing"
  return true;
}

function endGame(room, winnerRole) {
  const game = room.game;
  if (!game) return;
  clearInterval(game.intervalId);

  const winnerId = game.roleToSocket[winnerRole];
  const winnerNick = nicknameOf(winnerId) || '(unnamed)';
  playerScores.set(winnerNick, (playerScores.get(winnerNick) || 0) + 1);

  const names = {
    warder: nicknameOf(game.roleToSocket.warder),
    prisoner: nicknameOf(game.roleToSocket.prisoner)
  };
  const leaderboard = serializeLeaderboard();

  // Reset game state, but keep players
  room.game = null; 

  // 1. Tell clients the game is over and when the next one starts
  io.to(room.id).emit('game:over', {
    winnerRole,
    winnerName: names[winnerRole],
    playerScores: leaderboard,
    nextGameIn: NEXT_GAME_DELAY // Send the delay
  });
  io.emit('leaderboard:update', { playerScores: leaderboard });

  // 2. Start the "next game" countdown
  startGameCountdown(room);

  broadcastRooms(); // Show room is no longer "playing"
}

function startGameCountdown(room) {
  // Clear any pending "next game" countdown
  if (room.countdownInterval) {
    clearInterval(room.countdownInterval);
  }
  
  let remaining = NEXT_GAME_DELAY;
  
  // Emit the first tick immediately so the UI updates
  io.to(room.id).emit('room:countdown', { remaining });
  
  room.countdownInterval = setInterval(() => {
    remaining--;
    io.to(room.id).emit('room:countdown', { remaining }); // Emit the tick

    if (remaining <= 0) {
      clearInterval(room.countdownInterval);
      room.countdownInterval = null;
      
      // Check if players are still here before starting
      if (rooms.has(room.id) && room.players.size === 2) {
        console.log(`Starting game for room ${room.id}`);
        startNewMatch(room);
      }
    }
  }, 1000);
}

// NEW: Helper to manage leaving rooms
function leaveRoom(socketId) {
  const roomId = socketToRoom.get(socketId);
  if (!roomId) return;
  
  const room = rooms.get(roomId);
  if (!room) return;

  const player = room.players.get(socketId);
  const nickname = player?.nickname || 'A player';
  
  // --- ADDED THIS BLOCK ---
  // If a countdown was in progress, stop it.
  if (room.countdownInterval) {
    clearInterval(room.countdownInterval);
    room.countdownInterval = null;
  }
  // --- END ADD ---

  // If a game was in progress, it's an abort.
  if (room.game) {
    clearInterval(room.game.intervalId);
    
    io.to(roomId).emit('game:aborted', { reason: `${nickname} left.` });

    for (const pId of room.players.keys()) {
      room.players.delete(pId);
      socketToRoom.delete(pId);
      
      const pSock = io.sockets.sockets.get(pId);
      if (pSock) pSock.leave(roomId);
    }
    
    rooms.delete(roomId);

  } else {
    // No game, just a player leaving a waiting room
    room.players.delete(socketId);
    socketToRoom.delete(socketId);
    
    const sock = io.sockets.sockets.get(socketId);
    if (sock) sock.leave(roomId);

    if (room.players.size === 0) {
      rooms.delete(roomId);
    }
  }
  
  broadcastRooms();
}

// =========== Sockets ===========
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  clients.set(socket.id, { id: socket.id, nickname: null });
  broadcastStats();

  socket.on('client:ready', () => { // For Admin page
    broadcastStats();
    broadcastRooms();
  });

  // ENFORCE UNIQUE NICKNAMES
  socket.on('set:nickname', (name) => {
    const trimmed = ('' + name).trim().slice(0, 20);
    if (!trimmed) return;

    const isTaken = Array.from(clients.values()).some(
      (c) => c.nickname && c.nickname.toLowerCase() === trimmed.toLowerCase() && c.id !== socket.id
    );
    if (isTaken) {
      return socket.emit('nickname:error', { message: `Nickname "${trimmed}" is already taken.` });
    }

    const info = clients.get(socket.id);
    if (!info) return;
    info.nickname = trimmed;
    clients.set(socket.id, info);

    if (!playerScores.has(trimmed)) playerScores.set(trimmed, 0);

    broadcastStats();
    socket.emit('nickname:success', { nickname: trimmed });
    // Send room list *after* name is set
    socket.emit('room:list', { rooms: serializeRooms() });
  });

  // --- NEW ROOM LISTENERS ---
  socket.on('room:list', () => {
    socket.emit('room:list', { rooms: serializeRooms() });
  });

  socket.on('room:create', ({ name }) => {
    const info = clients.get(socket.id);
    if (!info || !info.nickname) return;
    
    leaveRoom(socket.id); // Leave any current room

    const roomId = nanoid(6);
    const room = {
      id: roomId,
      name: name || `${info.nickname}'s Game`,
      players: new Map(), // socket.id -> { id, nickname }
      game: null, // game state
    };
    room.players.set(socket.id, { id: socket.id, nickname: info.nickname });
    
    rooms.set(roomId, room);
    socketToRoom.set(socket.id, roomId);
    socket.join(roomId);
    
    socket.emit('room:joined', { roomId }); // Tell creator they joined
    broadcastRooms(); // Tell everyone a new room exists
  });

  socket.on('room:join', ({ roomId }) => {
    const info = clients.get(socket.id);
    if (!info || !info.nickname) return;

    const room = rooms.get(roomId);
    if (!room) return socket.emit('room:error', { message: 'Room not found.' });
    if (room.players.size >= 2) return socket.emit('room:error', { message: 'Room is full.' });
    if (room.game) return socket.emit('room:error', { message: 'Game is in progress.' });

    leaveRoom(socket.id); // Leave any current room
    
    room.players.set(socket.id, { id: socket.id, nickname: info.nickname });
    socketToRoom.set(socket.id, roomId);
    socket.join(roomId);
    
    // Tell the joiner they joined
    socket.emit('room:joined', { roomId });
    
    // Instead of starting immediately, begin the countdown
    startGameCountdown(room);
  });

  socket.on('move', ({ r, c }) => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room || !room.game) return;
    
    const game = room.game;
    const role = Object.entries(game.roleToSocket).find(([role, sid]) => sid === socket.id)?.[0];
    if (!role || role !== game.currentTurn) return;

    const from = game.positions[role];
    const to = { r, c };

    // Validate move
    const moves = validMoves(game.board, role, from);
    if (!moves.some(m => m.r === to.r && m.c === to.c)) return;

    applyMove(room, role, to);
    if (rooms.has(roomId) && rooms.get(roomId).game) { // Check if game is still on
      switchTurn(room);
    }
  });

  socket.on('room:leave', () => {
    // Call the same leaveRoom function as a disconnect
    // This handles aborting the game and cleaning up
    leaveRoom(socket.id); 
  });

  socket.on('game:get', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return; // Room doesn't exist

    // Ensure this socket is in the room's broadcast channel
    socket.join(roomId);

    // If the game is in progress, send the *full* state to the user
    // This is what the joiner needs
    if (room.game) {
      const game = room.game;
      
      // 1. Send the full game:start payload
      socket.emit('game:start', {
        roomId: room.id,
        grid: GRID,
        board: game.board,
        roles: {
          warder: nicknameOf(game.roleToSocket.warder),
          prisoner: nicknameOf(game.roleToSocket.prisoner)
        },
        positions: game.positions,
        currentTurn: game.currentTurn,
        turnSeconds: TURN_SECONDS,
        playerScores: serializeLeaderboard(),
      });

      // 2. Send the player their specific role
      const role = Object.entries(game.roleToSocket).find(([r, sid]) => sid === socket.id)?.[0];
      if (role) {
        socket.emit('role', { role });
      }

      // 3. Send the current timer state
      const remaining = Math.max(0, Math.ceil((game.deadlineTs - Date.now()) / 1000));
      socket.emit('turn:tick', { remaining });
    }
    // If room.game is null, the game hasn't started.
    // We do nothing, and the player (the host) will just wait.
    // They will get the 'game:start' event normally when the 2nd player joins.
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    leaveRoom(socket.id); // Handles all room/game cleanup
    clients.delete(socket.id);
    broadcastStats();
  });
});

// =========== Admin UI ===========
// Fulfills "reset button to reset all current game state and scores"
app.post('/reset', (req, res) => {
  playerScores = new Map();
  // Abort all active games
  for (const room of rooms.values()) {
    if (room.game) {
      clearInterval(room.game.intervalId);
      io.to(room.id).emit('game:aborted', { reason: 'Server was reset by admin.' });
    }
  }
  // Clear all rooms and player locations
  rooms.clear();
  socketToRoom.clear();
  
  const leaderboard = serializeLeaderboard();
  io.emit('server:reset', { playerScores: leaderboard }); // Tell clients
  broadcastRooms();
  broadcastStats();
  res.json({ ok: true });
});

// Kick a player by socket.id
app.post('/kick/:id', (req, res) => {
  const id = req.params.id;
  const client = clients.get(id);
  if (!client) return res.status(404).json({ error: "Client not found" });
  
  const sock = io.sockets.sockets.get(id);
  if (sock) {
    sock.emit('admin:kick', { message: 'You were kicked by an admin.' });
    sock.disconnect(true); // disconnect handler will do the cleanup
  }
  
  res.json({ ok: true });
});

app.get('/leaders', (_req, res) => {
  res.json({ playerScores: serializeLeaderboard() });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Escape Plan server on http://localhost:${PORT}`);
});