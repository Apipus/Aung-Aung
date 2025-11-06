import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { nanoid } from "nanoid"; // For unique room IDs

const app = express();
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://192.168.1.97:3000" // replace with your local IP
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
      "http://192.168.1.97:3000", // your LAN IP
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
    queueCount: room.queue ? room.queue.length : 0,
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
    board: game.board,
    items: game.items || []
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
  // Item pickup: if the cell contains an item, handle it immediately
  if (typeof cellType === 'string' && cellType.startsWith('item')) {
    // Move the player first
    game.positions[role] = to;
    // Handle item effect (e.g., move tunnel)
    handleItemPickup(room, role, socketIdFromRole(room, role), to);
    // Continue to broadcast updated state below
    return broadcastState(room);
  }
  game.positions[role] = to;
  broadcastState(room);
}

// Helper to map role -> socket id from current game.roleToSocket
function socketIdFromRole(room, role) {
  if (!room || !room.game) return null;
  return room.game.roleToSocket ? room.game.roleToSocket[role] : null;
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
  
  // King-of-the-hill: if nextWarderSocketId exists among players, use it
  let pWarder;
  let pPrisoner;
  if (room.nextWarderSocketId && room.players.has(room.nextWarderSocketId)) {
    pWarder = room.players.get(room.nextWarderSocketId);
    pPrisoner = playerList.find(p => p.id !== pWarder.id);
  } else {
    // Fallback random order
    const shuffledPlayers = shuffle([...playerList]);
    pWarder = shuffledPlayers[0];
    pPrisoner = shuffledPlayers[1];
  }

  const board = buildBoard();
  let positions = safeSpawn(board);
  if (!positions) return false;
  
  // Fulfills "warder will start to move first"
  const roleToSocket = {
    'warder': pWarder.id,
    'prisoner': pPrisoner.id
  };

  // Reset nextWarder once consumed
  room.nextWarderSocketId = null;

  room.game = {
    board,
    roleToSocket,
    positions,
    currentTurn: 'warder', // Warder always starts
    deadlineTs: Date.now() + TURN_SECONDS * 1000,
    intervalId: null,
    items: [] // Items on the board for this game
  };

  // Spawn initial item(s) for the match
  spawnItemOnBoard(room, 'item_move_tunnel');

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

// Spawn an item of given type on a free cell (not obstacle, not tunnel, not on players)
function spawnItemOnBoard(room, itemType) {
  if (!room || !room.game) return null;
  const board = room.game.board;
  const free = emptyCells(board);
  // Exclude cells occupied by players
  const occupied = new Set();
  if (room.game.positions) {
    for (const p of Object.values(room.game.positions)) {
      occupied.add(`${p.r},${p.c}`);
    }
  }
  const candidates = free.filter(c => !occupied.has(`${c.r},${c.c}`));
  if (candidates.length === 0) return null;
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  // Mark the board cell as an item type so clients can render it
  board[pick.r][pick.c].type = itemType;
  const item = { type: itemType, pos: pick };
  room.game.items = room.game.items || [];
  room.game.items.push(item);
  return item;
}

// Helper to remove an item from the board and room.game.items
function removeItem(room, pos) {
  if (!room || !room.game) return;
  const board = room.game.board;
  if (board[pos.r] && board[pos.r][pos.c]) board[pos.r][pos.c].type = 'free';
  room.game.items = (room.game.items || []).filter(i => !(i.pos.r === pos.r && i.pos.c === pos.c));
}

// Handle item pickup and apply its immediate effect
function handleItemPickup(room, pickerRole, pickerId, pos) {
  if (!room || !room.game) return;
  const game = room.game;
  const cellType = game.board[pos.r][pos.c].type;
  // Remove the item from board immediately
  removeItem(room, pos);

  // ITEM: move tunnel
  if (cellType === 'item_move_tunnel') {
    const oldTunnel = tunnelCell(game.board);
    // Find candidates for new tunnel: any free cell (not obstacle), not occupied by players, not current tunnel
    let candidates = emptyCells(game.board).filter(c => !(oldTunnel && c.r === oldTunnel.r && c.c === oldTunnel.c));
    // Exclude player positions
    const occupied = new Set();
    for (const p of Object.values(game.positions || {})) occupied.add(`${p.r},${p.c}`);
    candidates = candidates.filter(c => !occupied.has(`${c.r},${c.c}`));

    if (candidates.length > 0) {
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      // Move tunnel
      if (oldTunnel) game.board[oldTunnel.r][oldTunnel.c].type = 'free';
      game.board[pick.r][pick.c].type = 'tunnel';

      // Broadcast an explicit event so clients can show a message, then broadcast the updated state
      io.to(room.id).emit('game:item', {
        type: 'move_tunnel',
        by: nicknameOf(pickerId),
        newTunnel: pick,
        board: game.board
      });

      // Also push a new item later if desired (optional): spawnItemOnBoard(room, 'item_move_tunnel');
    } else {
      // No candidate found; do nothing
      io.to(room.id).emit('game:item', {
        type: 'move_tunnel',
        by: nicknameOf(pickerId),
        newTunnel: null,
        board: game.board
      });
    }

    // Emit updated broadcast state so board changes propagate
    broadcastState(room);
  }
}

function endGame(room, winnerRole) {
  const game = room.game;
  if (!game) return;
  clearInterval(game.intervalId);

  const winnerId = game.roleToSocket[winnerRole];
  const winnerNick = nicknameOf(winnerId) || '(unnamed)';
  playerScores.set(winnerNick, (playerScores.get(winnerNick) || 0) + 1);
  // Winner will be Warder next match
  room.nextWarderSocketId = winnerId;

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

  // If there is a queue, replace the loser with next in queue (king-of-the-hill)
  const loserRole = winnerRole === 'warder' ? 'prisoner' : 'warder';
  const loserId = game.roleToSocket[loserRole];
  if (room.queue && room.queue.length > 0) {
    // Remove countdown if running
    if (room.countdownInterval) {
      clearInterval(room.countdownInterval);
      room.countdownInterval = null;
    }
    // Eject loser to lobby only
    const loserSock = io.sockets.sockets.get(loserId);
    if (room.players.has(loserId)) {
      room.players.delete(loserId);
      socketToRoom.delete(loserId);
      if (loserSock) {
        loserSock.leave(room.id);
        loserSock.emit('game:aborted', { reason: 'You lost. A queued player takes your spot.' });
      }
    }
    // Promote first valid queued player
    let nextId;
    while (room.queue.length > 0 && !nextId) {
      const candidate = room.queue.shift();
      if (clients.has(candidate)) nextId = candidate;
    }
    if (nextId) {
      const info = clients.get(nextId);
      room.players.set(nextId, { id: nextId, nickname: info?.nickname || '(unnamed)' });
      socketToRoom.set(nextId, room.id);
      const nextSock = io.sockets.sockets.get(nextId);
      if (nextSock) {
        nextSock.join(room.id);
        nextSock.emit('room:joined', { roomId: room.id });
      }
    }
  }

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
  // If not mapped to a room, still ensure they are removed from any queues
  if (!roomId) {
    for (const room of rooms.values()) {
      if (room.queue && room.queue.length) {
        room.queue = room.queue.filter(id => id !== socketId);
      }
    }
    broadcastRooms();
    return;
  }
  
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

  // If a game was in progress, it's an abort for that match, but keep the room
  if (room.game) {
    clearInterval(room.game.intervalId);
    // Notify ONLY the leaving player to return to lobby; keep remaining player in room
    const leavingSock = io.sockets.sockets.get(socketId);
    if (leavingSock) leavingSock.emit('game:aborted', { reason: `${nickname} left.` });

    // Remove the leaver from players and channel
    room.players.delete(socketId);
    socketToRoom.delete(socketId);
    if (leavingSock) leavingSock.leave(roomId);

    // Reset game state
    room.game = null;

    // Clear the board for remaining players so their UI switches to waiting state
    io.to(room.id).emit('game:clear');

    // If another player remains, they should be next warder
    const remainingIds = Array.from(room.players.keys());
    if (remainingIds.length >= 1) {
      const remainingId = remainingIds[0];
      room.nextWarderSocketId = remainingId;

      // Promote next queued player if available
      let nextId;
      if (room.queue && room.queue.length) {
        while (room.queue.length > 0 && !nextId) {
          const candidate = room.queue.shift();
          if (clients.has(candidate)) nextId = candidate;
        }
        if (nextId) {
          const info = clients.get(nextId);
          room.players.set(nextId, { id: nextId, nickname: info?.nickname || '(unnamed)' });
          socketToRoom.set(nextId, room.id);
          const nextSock = io.sockets.sockets.get(nextId);
          if (nextSock) {
            nextSock.join(room.id);
            nextSock.emit('room:joined', { roomId: room.id });
          }
        }
      }

      // Start next game countdown if we have two players
      if (room.players.size === 2) {
        startGameCountdown(room);
      } else {
        // Only one player remains in the room, clear their board and show waiting
        io.to(room.id).emit('game:clear');
      }
    } else {
      // No players remain in room.players
      // If there is a queue, promote the next person to keep room alive
      let promotedId;
      if (room.queue && room.queue.length) {
        while (room.queue.length > 0 && !promotedId) {
          const candidate = room.queue.shift();
          if (clients.has(candidate)) promotedId = candidate;
        }
        if (promotedId) {
          const info = clients.get(promotedId);
          room.players.set(promotedId, { id: promotedId, nickname: info?.nickname || '(unnamed)' });
          socketToRoom.set(promotedId, room.id);
          const pSock = io.sockets.sockets.get(promotedId);
          if (pSock) {
            pSock.join(room.id);
            pSock.emit('room:joined', { roomId: room.id });
          }
        }
      }
      // If still empty and no queue, delete the room
      if (room.players.size === 0) {
        rooms.delete(roomId);
      }
      // If we promoted someone but still less than 2 players, tell them waiting
      else if (room.players.size < 2) {
        io.to(room.id).emit('game:clear');
      }
    }

  } else {
    // No game, just a player leaving a waiting room
    room.players.delete(socketId);
    socketToRoom.delete(socketId);
    
    const sock = io.sockets.sockets.get(socketId);
    if (sock) sock.leave(roomId);

    // Remove from queue if present
    if (room.queue && room.queue.length) {
      room.queue = room.queue.filter(id => id !== socketId);
    }

    if (room.players.size === 0) {
      // If there is a queue, promote next to keep room alive
      let nextId;
      while (room.queue && room.queue.length > 0 && !nextId) {
        const candidate = room.queue.shift();
        if (clients.has(candidate)) nextId = candidate;
      }
      if (nextId) {
        const info = clients.get(nextId);
        room.players.set(nextId, { id: nextId, nickname: info?.nickname || '(unnamed)' });
        socketToRoom.set(nextId, room.id);
        const nextSock = io.sockets.sockets.get(nextId);
        if (nextSock) {
          nextSock.join(room.id);
          nextSock.emit('room:joined', { roomId: room.id });
        }
      } else {
        rooms.delete(roomId);
      }
    }
    // If room still has less than 2 players, clear and wait; else start countdown
    if (rooms.has(roomId)) {
      const r = rooms.get(roomId);
      if (r.players.size === 2) startGameCountdown(r);
      else io.to(roomId).emit('game:clear');
    }
  }
  
  broadcastRooms();
}

// ADMIN: Kick a player but keep them connected and return them to lobby.
// If they're in a game, abort the game but keep the room with the remaining player.
function adminKickPlayer(socketId) {
  const client = clients.get(socketId);
  const sock = io.sockets.sockets.get(socketId);

  // Notify the client they're kicked and instruct the UI to return to lobby
  if (sock) sock.emit('admin:kick', { message: 'You were kicked by an admin.' });

  const roomId = socketToRoom.get(socketId);
  if (!roomId) return true; // not in a room, nothing else to do

  const room = rooms.get(roomId);
  if (!room) {
    socketToRoom.delete(socketId);
    return true;
  }

  // Remove countdown if in progress
  if (room.countdownInterval) {
    clearInterval(room.countdownInterval);
    room.countdownInterval = null;
  }

  // If a game is in progress, abort it but keep the room and remaining player
  if (room.game) {
    clearInterval(room.game.intervalId);
    // Remove the kicked player from the room players map
    room.players.delete(socketId);
    socketToRoom.delete(socketId);
    if (sock) sock.leave(roomId);

    // Reset game state so the remaining player can wait for a new opponent
    room.game = null;

    // Clear the board for remaining players so their UI switches to waiting state
    io.to(room.id).emit('game:clear');

  // Do NOT broadcast 'game:aborted' to remaining players; keep them in room

    // If another player remains, set them as next warder and try to promote from queue
    const remainingIds = Array.from(room.players.keys());
    if (remainingIds.length >= 1) {
      const remainingId = remainingIds[0];
      room.nextWarderSocketId = remainingId;

      let nextId;
      if (room.queue && room.queue.length) {
        while (room.queue.length > 0 && !nextId) {
          const candidate = room.queue.shift();
          if (clients.has(candidate)) nextId = candidate;
        }
        if (nextId) {
          const info = clients.get(nextId);
          room.players.set(nextId, { id: nextId, nickname: info?.nickname || '(unnamed)' });
          socketToRoom.set(nextId, room.id);
          const nextSock = io.sockets.sockets.get(nextId);
          if (nextSock) {
            nextSock.join(room.id);
            nextSock.emit('room:joined', { roomId: room.id });
          }
        }
      }
      if (room.players.size === 2) startGameCountdown(room);
    } else {
      // No players remain; try to promote from queue or delete room
      let promotedId;
      if (room.queue && room.queue.length) {
        while (room.queue.length > 0 && !promotedId) {
          const candidate = room.queue.shift();
          if (clients.has(candidate)) promotedId = candidate;
        }
        if (promotedId) {
          const info = clients.get(promotedId);
          room.players.set(promotedId, { id: promotedId, nickname: info?.nickname || '(unnamed)' });
          socketToRoom.set(promotedId, room.id);
          const pSock = io.sockets.sockets.get(promotedId);
          if (pSock) {
            pSock.join(room.id);
            pSock.emit('room:joined', { roomId: room.id });
          }
        }
      }
      if (room.players.size === 0) rooms.delete(roomId);
    }

    broadcastRooms();
    return true;
  }

  // No game in progress (waiting room) - just remove the player
  room.players.delete(socketId);
  socketToRoom.delete(socketId);
  if (sock) sock.leave(roomId);

  // Remove from queue if present
  if (room.queue && room.queue.length) {
    room.queue = room.queue.filter(id => id !== socketId);
  }

  // If room is now empty, remove it
  if (room.players.size === 0) {
    rooms.delete(roomId);
  }

  broadcastRooms();
  return true;
}

// ADMIN: Terminate a room: return all players to the lobby and delete the room.
function adminTerminateRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return false;

  // Clear countdown and game timers
  if (room.countdownInterval) {
    clearInterval(room.countdownInterval);
    room.countdownInterval = null;
  }
  if (room.game) {
    clearInterval(room.game.intervalId);
    room.game = null;
  }

  // Notify any in-progress game that it was aborted so clients can return to lobby
  try {
    io.to(roomId).emit('game:aborted', { reason: 'Room was terminated by admin.' });
  } catch (e) {
    // ignore if room channel no longer exists
  }

  // Notify all players and return them to lobby
  for (const pId of Array.from(room.players.keys())) {
    const pSock = io.sockets.sockets.get(pId);
    if (pSock) {
      pSock.emit('admin:room_terminated', { message: 'Room was terminated by admin.' });
      pSock.leave(roomId);
    }
    socketToRoom.delete(pId);
  }

  // Notify queued players
  if (room.queue && room.queue.length) {
    for (const qId of room.queue) {
      const qSock = io.sockets.sockets.get(qId);
      if (qSock) qSock.emit('game:aborted', { reason: 'Room was terminated by admin.' });
      socketToRoom.delete(qId);
    }
    room.queue = [];
  }

  // Finally delete the room
  rooms.delete(roomId);

  broadcastRooms();
  return true;
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
        queue: [], // FIFO of socket ids waiting to play
        nextWarderSocketId: null, // Remember winner for next match
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
    // If room is full or a game is in progress, enqueue the player
    if (room.players.size >= 2 || room.game) {
      if (!room.queue) room.queue = [];
      // Avoid duplicate enqueue
      if (!room.queue.includes(socket.id)) {
        room.queue.push(socket.id);
      }
      socket.emit('room:queued', { roomId, position: room.queue.indexOf(socket.id) + 1 });
      broadcastRooms();
      return;
    }

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
  // Before we delete rooms, notify any waiting players as well
  for (const room of rooms.values()) {
    // Notify queued players they were removed
    if (room.queue && room.queue.length) {
      for (const qId of room.queue) {
        const qSock = io.sockets.sockets.get(qId);
        if (qSock) qSock.emit('game:aborted', { reason: 'Server was reset by admin.' });
      }
    }
  }

  rooms.clear();
  socketToRoom.clear();

  const leaderboard = serializeLeaderboard();
  // Emit both a generic server reset and an explicit admin reset with a message
  io.emit('server:reset', { playerScores: leaderboard }); // legacy
  io.emit('admin:reset', { message: 'Admin reset everyone. Scores have been cleared.', playerScores: leaderboard });
  broadcastRooms();
  broadcastStats();
  res.json({ ok: true });
});

// Kick a player by socket.id
app.post('/kick/:id', (req, res) => {
  const id = req.params.id;
  const client = clients.get(id);
  if (!client) return res.status(404).json({ error: "Client not found" });
  
  // Use the adminKickPlayer helper to remove the player from any room
  // but keep them connected and return them to the lobby.
  try {
    adminKickPlayer(id);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error kicking player', err);
    res.status(500).json({ error: 'Failed to kick player' });
  }
});

// Admin: terminate a room and return all players to lobby
app.post('/room/terminate/:roomId', (req, res) => {
  const roomId = req.params.roomId;
  if (!rooms.has(roomId)) return res.status(404).json({ error: 'Room not found' });
  try {
    adminTerminateRoom(roomId);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error terminating room', err);
    res.status(500).json({ error: 'Failed to terminate room' });
  }
});

app.get('/leaders', (_req, res) => {
  res.json({ playerScores: serializeLeaderboard() });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Escape Plan server on http://localhost:${PORT}`);
});