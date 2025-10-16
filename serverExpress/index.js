const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://192.168.1.105:3000" // replace with your local IP
  ], 
  methods: ["GET", "POST"]
}));
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, { /* options */ });

const PORT = process.env.PORT || 8000;

// =========== Game State ===========
const GRID = 5;
const OBSTACLES = 5;
const TURN_SECONDS = 10;

// Scores keyed by NICKNAME (not socket.id)
let playerScores = new Map(); // nickname -> wins

let game = null; // { board, roleToSocket, positions, currentTurn, deadlineTs, intervalId }

// ===== Helpers =====
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

function isAdjacent(a, b) {
  const dr = Math.abs(a.r - b.r);
  const dc = Math.abs(a.c - b.c);
  return (dr + dc === 1);
}

const clients = new Map(); // socket.id -> { id, nickname }
function nicknameOf(id) { return clients.get(id)?.nickname || '(unnamed)'; }

const queue = []; // FIFO socket ids
function inQueue(id) { return queue.includes(id); }
function enqueue(id) { if (!inQueue(id)) queue.push(id); }
function dequeue() { return queue.shift(); }
function removeFromQueue(id) { const i = queue.indexOf(id); if (i !== -1) queue.splice(i, 1); }

function connectedClientList() {
  return Array.from(clients.values()).map((c) => ({ id: c.id, nickname: c.nickname }));
}

function serializeLeaderboard(limit = 20) {
  return Array.from(playerScores.entries())
    .map(([nickname, score]) => ({ nickname, score }))
    .sort((a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname))
    .slice(0, limit);
}

function broadcastLobby() {
  io.emit('lobby:update', {
    clients: connectedClientList(),
    queue: queue.map(id => ({ id, nickname: nicknameOf(id) }))
  });
}

function broadcastStats() {
  io.emit('server:stats', { online: clients.size });
  broadcastLobby();
}

function broadcastState() {
  if (!game) return;
  io.emit('game:state', {
    positions: game.positions,
    currentTurn: game.currentTurn,
    deadlineTs: game.deadlineTs,
    playerScores: serializeLeaderboard(),
  });
}

// ===== Rules =====
// Prisoner CAN step onto the warder; warder CANNOT enter the tunnel.
function validMoves(role) {
  const pos = game.positions[role];
  const moves = [];
  const dirs = [{ r: 1, c: 0 }, { r: -1, c: 0 }, { r: 0, c: 1 }, { r: 0, c: -1 }];
  for (const d of dirs) {
    const nr = pos.r + d.r, nc = pos.c + d.c;
    if (nr < 0 || nr >= GRID || nc < 0 || nc >= GRID) continue;
    const cellType = game.board[nr][nc].type;
    if (cellType === 'obstacle') continue;
    if (role === 'warder' && cellType === 'tunnel') continue;
    moves.push({ r: nr, c: nc });
  }
  return moves;
}

// Timeout = skip turn (no random move)
function startTurnTimer() {
  if (!game) return;
  if (game.intervalId) clearInterval(game.intervalId);

  game.deadlineTs = Date.now() + TURN_SECONDS * 1000;

  game.intervalId = setInterval(() => {
    if (!game) return clearInterval(game.intervalId);
    const remaining = Math.max(0, Math.ceil((game.deadlineTs - Date.now()) / 1000));
    io.emit('turn:tick', { remaining });
    if (remaining <= 0) {
      switchTurn();
    }
  }, 1000);

  broadcastState();
}

function applyMove(role, to) {
  const other = (role === 'warder') ? 'prisoner' : 'warder';
  // Capture if move lands on the other
  if (game.positions[other].r === to.r && game.positions[other].c === to.c) {
    game.positions[role] = to;
    return endGame('warder'); // warder wins on contact
  }
  // Prisoner escape via tunnel
  const cellType = game.board[to.r][to.c].type;
  if (role === 'prisoner' && cellType === 'tunnel') {
    game.positions[role] = to;
    return endGame('prisoner');
  }
  game.positions[role] = to;
  broadcastState();
}

function switchTurn() {
  if (!game) return;
  game.currentTurn = (game.currentTurn === 'warder') ? 'prisoner' : 'warder';
  startTurnTimer();
}

// ===== Game lifecycle =====
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

function startNewMatch(warderSocketId, prisonerSocketId) {
  const board = buildBoard();
  let positions = safeSpawn(board);
  if (!positions) return false;

  game = {
    board,
    roleToSocket: { warder: warderSocketId, prisoner: prisonerSocketId },
    positions,
    currentTurn: 'warder',
    deadlineTs: Date.now() + TURN_SECONDS * 1000,
    intervalId: null
  };

  io.emit('game:start', {
    grid: GRID,
    board,
    roles: {
      warder: nicknameOf(warderSocketId),
      prisoner: nicknameOf(prisonerSocketId)
    },
    positions,
    currentTurn: game.currentTurn,
    turnSeconds: TURN_SECONDS,
    playerScores: serializeLeaderboard(),
  });

  io.to(warderSocketId).emit('role', { role: 'warder' });
  io.to(prisonerSocketId).emit('role', { role: 'prisoner' });

  startTurnTimer();
  broadcastStats();
  return true;
}

function maybeStartNewGame() {
  if (game) return;
  if (queue.length < 2) return;
  const p1 = dequeue();
  const p2 = dequeue();
  const roles = shuffle(['warder', 'prisoner']);
  const ok = startNewMatch(
    roles[0] === 'warder' ? p1 : p2,
    roles[0] === 'warder' ? p2 : p1
  );
  if (!ok) return;
}

function endGame(winnerRole) {
  if (!game) return;
  clearInterval(game.intervalId);

  const winnerId = game.roleToSocket[winnerRole];
  const winnerNick = nicknameOf(winnerId) || '(unnamed)';

  // Increment nickname-keyed score
  playerScores.set(winnerNick, (playerScores.get(winnerNick) || 0) + 1);

  const names = {
    warder: nicknameOf(game.roleToSocket.warder),
    prisoner: nicknameOf(game.roleToSocket.prisoner)
  };

  const leaderboard = serializeLeaderboard();

  io.emit('game:over', {
    winnerRole,
    winnerName: names[winnerRole],
    playerScores: leaderboard,
  });
  io.emit('leaderboard:update', { playerScores: leaderboard });

  const loserRole = (winnerRole === 'warder') ? 'prisoner' : 'warder';
  const loserId = game.roleToSocket[loserRole];

  if (clients.has(loserId)) enqueue(loserId);

  game = null;

  const challenger = dequeue();
  if (clients.has(winnerId) && challenger) {
    startNewMatch(winnerId, challenger); // winner stays as warder
  } else {
    broadcastStats();
  }
}

// =========== Sockets ===========
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  clients.set(socket.id, { id: socket.id, nickname: null });
  broadcastStats();

  socket.on('client:ready', () => {
    socket.emit('hello', { msg: 'Welcome to Escape Plan! Set your nickname to join.' });
  });

  // ENFORCE UNIQUE NICKNAMES (case-insensitive)
  socket.on('set:nickname', (name) => {
    const trimmed = ('' + name).trim().slice(0, 20);
    if (!trimmed) return;

    const isTaken = Array.from(clients.values()).some(
      (c) => c.nickname && c.nickname.toLowerCase() === trimmed.toLowerCase() && c.id !== socket.id
    );
    if (isTaken) {
      socket.emit('nickname:error', { message: `Nickname "${trimmed}" is already taken. Please choose another.` });
      return;
    }

    // Assign nickname
    const info = clients.get(socket.id);
    if (!info) return;
    info.nickname = trimmed;
    clients.set(socket.id, info);

    // Ensure visible on leaderboard even before first win
    if (!playerScores.has(trimmed)) playerScores.set(trimmed, 0);

    const isActive = game && (socket.id === game.roleToSocket.warder || socket.id === game.roleToSocket.prisoner);
    if (!isActive) enqueue(socket.id);

    broadcastStats();
    maybeStartNewGame();

    socket.emit('nickname:success', { nickname: trimmed });
  });

  socket.on('move', ({ r, c }) => {
    if (!game) return;
    const role = Object.entries(game.roleToSocket).find(([role, sid]) => sid === socket.id)?.[0];
    if (!role || role !== game.currentTurn) return;

    const from = game.positions[role];
    const to = { r, c };

    if (!isAdjacent(from, to)) return;
    const cellType = game.board[r][c].type;
    if (cellType === 'obstacle') return;
    if (role === 'warder' && cellType === 'tunnel') return;

    applyMove(role, to);
    if (game) switchTurn();
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    clients.delete(socket.id);
    removeFromQueue(socket.id);

    // If an active player left, try to replace; else abort game
    if (game && (socket.id === game.roleToSocket.warder || socket.id === game.roleToSocket.prisoner)) {
      const roleLeaving = (socket.id === game.roleToSocket.warder) ? 'warder' : 'prisoner';
      const replacement = dequeue();
      if (replacement) {
        game.roleToSocket[roleLeaving] = replacement;
        io.to(replacement).emit('role', { role: roleLeaving });
        broadcastState();
      } else {
        clearInterval(game.intervalId);
        game = null;
        io.emit('game:aborted', { reason: 'A player disconnected.' });
      }
    }

    broadcastStats();
  });
});

// =========== Admin UI ===========
app.post('/reset', (req, res) => {
  playerScores = new Map(); // clear nickname-keyed scores
  if (game) {
    clearInterval(game.intervalId);
    game = null;
  }
  const leaderboard = serializeLeaderboard();
  io.emit('server:reset', { playerScores: leaderboard });
  maybeStartNewGame();
  res.json({ ok: true });
});

// Kick a player by socket.id
app.post('/kick/:id', (req, res) => {
  const id = req.params.id;
  const client = clients.get(id);
  if (!client) return res.status(404).json({ error: "Client not found" });
  const sock = io.sockets.sockets.get(id);
  if (sock) sock.disconnect(true);
  res.json({ ok: true });
});

// Swap two queue indices
app.post('/swap', (req, res) => {
  const { i1, i2 } = req.body;
  if (
    typeof i1 !== "number" ||
    typeof i2 !== "number" ||
    i1 < 0 ||
    i2 < 0 ||
    i1 >= queue.length ||
    i2 >= queue.length
  ) return res.status(400).json({ error: "Invalid indices" });

  [queue[i1], queue[i2]] = [queue[i2], queue[i1]];
  broadcastLobby();
  res.json({ ok: true });
});


// Optional: quick JSON view of leaderboard
app.get('/leaders', (_req, res) => {
  res.json({ playerScores: serializeLeaderboard() });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Escape Plan server on http://localhost:${PORT}`);
});