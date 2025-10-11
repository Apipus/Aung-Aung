/**
 * Escape Plan — rotation edition with React frontend
 * - Serves /client-react/dist if built, else serves /public fallback
 */
const path = require('path');
const fs = require('fs');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 8080;

// Try to serve React build if present
const reactBuild = path.join(__dirname, 'client-react', 'dist');
const hasReactBuild = fs.existsSync(reactBuild);

app.use(express.json());
if (hasReactBuild) {
  app.use(express.static(reactBuild));
} else {
  app.use(express.static(path.join(__dirname, 'public')));
}

// =========== Game State ===========
const GRID = 5;
const OBSTACLES = 5;
const TURN_SECONDS = 10;

let scores = { warder: 0, prisoner: 0 };
let game = null; // { board, roleToSocket, positions, currentTurn, deadlineTs, intervalId }

// Helpers
function shuffle(a){ for (let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
function buildBoard(){
  const cells=[]; for(let r=0;r<GRID;r++)for(let c=0;c<GRID;c++)cells.push({r,c,type:'free'});
  shuffle(cells); cells[0].type='tunnel'; for(let i=1;i<=OBSTACLES;i++)cells[i].type='obstacle';
  const board=Array.from({length:GRID},()=>Array(GRID).fill(null));
  for(const cell of cells) board[cell.r][cell.c]={type:cell.type};
  return board;
}
function emptyCells(board){ const out=[]; for(let r=0;r<GRID;r++)for(let c=0;c<GRID;c++) if(board[r][c].type==='free') out.push({r,c}); return out; }
function tunnelCell(board){ for(let r=0;r<GRID;r++)for(let c=0;c<GRID;c++) if(board[r][c].type==='tunnel') return {r,c}; return null; }
function isAdjacent(a,b){ const dr=Math.abs(a.r-b.r), dc=Math.abs(a.c-b.c); return dr+dc===1; }
function randomChoice(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

// clients
const clients = new Map(); // socket.id -> { id, nickname }
function connectedClientList(){ return Array.from(clients.values()).map(c=>({id:c.id,nickname:c.nickname})); }

// ===== Rotation Queue (winner stays) =====
const queue=[];
function inQueue(id){ return queue.includes(id); }
function enqueue(id){ if(!inQueue(id)) queue.push(id); }
function dequeue(){ return queue.shift(); }
function removeFromQueue(id){ const i=queue.indexOf(id); if(i!==-1) queue.splice(i,1); }
function nicknameOf(id){ return clients.get(id)?.nickname || '(unnamed)'; }

function broadcastLobby(){
  io.emit('lobby:update', {
    clients: connectedClientList(),
    queue: queue.map(id=>({ id, nickname: nicknameOf(id) }))
  });
}
function broadcastStats(){ io.emit('server:stats',{online:clients.size}); broadcastLobby(); }
function broadcastState(){
  if(!game) return;
  io.emit('game:state', {
    positions: game.positions,
    currentTurn: game.currentTurn,
    deadlineTs: game.deadlineTs,
    scores
  });
}

function validMoves(role){
  const pos=game.positions[role], moves=[], dirs=[{r:1,c:0},{r:-1,c:0},{r:0,c:1},{r:0,c:-1}];
  for(const d of dirs){
    const nr=pos.r+d.r, nc=pos.c+d.c;
    if(nr<0||nr>=GRID||nc<0||nc>=GRID) continue;
    const cellType=game.board[nr][nc].type;
    if(cellType==='obstacle') continue;
    if(role==='warden' && cellType==='tunnel') continue;
    const other=(role==='warden')?'prisoner':'warden';
    const otherPos=game.positions[other];
    const steppingOnOther=(otherPos.r===nr && otherPos.c===nc);
    if(steppingOnOther && role!=='warden') continue;
    moves.push({r:nr,c:nc});
  }
  return moves;
}

function startTurnTimer(){
  if(!game) return;
  if(game.intervalId) clearInterval(game.intervalId);
  game.deadlineTs = Date.now() + TURN_SECONDS*1000;
  game.intervalId = setInterval(()=>{
    if(!game) return clearInterval(game.intervalId);
    const remaining = Math.max(0, Math.ceil((game.deadlineTs - Date.now())/1000));
    io.emit('turn:tick', { remaining });
    if(remaining<=0){
      const moves=validMoves(game.currentTurn);
      if(moves.length>0) applyMove(game.currentTurn, randomChoice(moves));
      switchTurn();
    }
  },1000);
  broadcastState();
}

function applyMove(role,to){
  const other=(role==='warden')?'prisoner':'warden';
  if(game.positions[other].r===to.r && game.positions[other].c===to.c){
    game.positions[role]=to; return endGame('warden');
  }
  const cellType=game.board[to.r][to.c].type;
  if(role==='prisoner' && cellType==='tunnel'){
    game.positions[role]=to; return endGame('prisoner');
  }
  game.positions[role]=to; broadcastState();
}

function switchTurn(){ if(!game) return; game.currentTurn=(game.currentTurn==='warden')?'prisoner':'warden'; startTurnTimer(); }

function safeSpawn(board){
  let free=emptyCells(board); if(free.length<2) return null;
  free.sort(()=>Math.random()-0.5);
  let positions={ warden: free.pop()||null, prisoner: free.pop()||null };
  if(!positions.warden && free.length) positions.warden=free.pop();
  if(!positions.prisoner && free.length) positions.prisoner=free.pop();
  if(!positions.warden || !positions.prisoner) return null;
  const tCell=tunnelCell(board);
  if(tCell && positions.warden.r===tCell.r && positions.warden.c===tCell.c){
    positions.warden = free.pop() || positions.warden;
  }
  return positions;
}

function startNewMatch(wardenSocketId, prisonerSocketId){
  const board=buildBoard();
  const positions=safeSpawn(board);
  if(!positions) return false;
  game={ board, roleToSocket:{warden:wardenSocketId, prisoner:prisonerSocketId},
    positions, currentTurn:'warden', deadlineTs: Date.now()+TURN_SECONDS*1000, intervalId:null };

  io.emit('game:start', {
    grid: GRID,
    board,
    roles: { warder: nicknameOf(wardenSocketId), prisoner: nicknameOf(prisonerSocketId) },
    positions,
    currentTurn: game.currentTurn,
    turnSeconds: TURN_SECONDS,
    scores
  });
  io.to(wardenSocketId).emit('role', { role:'warden' });
  io.to(prisonerSocketId).emit('role', { role:'prisoner' });
  startTurnTimer(); broadcastStats(); return true;
}

function maybeStartNewGame(){
  if(game) return;
  if(queue.length<2) return;
  const p1=dequeue(), p2=dequeue();
  const roles = Math.random()<0.5 ? ['warden','prisoner'] : ['prisoner','warden'];
  const ok = startNewMatch( roles[0]==='warden'?p1:p2, roles[0]==='warden'?p2:p1 );
  if(!ok) return;
}

function endGame(winnerRole){
  if(!game) return;
  clearInterval(game.intervalId);
  scores[winnerRole]++;
  const names={ warder:nicknameOf(game.roleToSocket.warden), prisoner:nicknameOf(game.roleToSocket.prisoner) };
  io.emit('game:over', { winnerRole, winnerName:names[winnerRole], scores });

  const winnerId=game.roleToSocket[winnerRole];
  const loserRole=(winnerRole==='warden')?'prisoner':'warden';
  const loserId=game.roleToSocket[loserRole];
  if(clients.has(loserId)) enqueue(loserId); // loser back to queue

  game=null;

  const challenger=dequeue();
  if(clients.has(winnerId) && challenger){
    startNewMatch(winnerId, challenger); // winner stays as warder
  } else {
    broadcastStats();
  }
}

// sockets
io.on('connection',(socket)=>{
  clients.set(socket.id,{id:socket.id,nickname:null});
  broadcastStats();
  socket.emit('hello',{msg:'Welcome to Escape Plan! Set your nickname to join.'});

  socket.on('set:nickname',(name)=>{
    const trimmed=(''+name).trim().slice(0,20);
    if(!trimmed) return;
    const info=clients.get(socket.id); if(!info) return;
    info.nickname=trimmed; clients.set(socket.id, info);
    const isActive = game && (socket.id===game.roleToSocket.warden || socket.id===game.roleToSocket.prisoner);
    if(!isActive) enqueue(socket.id);
    broadcastStats(); maybeStartNewGame();
  });

  socket.on('move',({r,c})=>{
    if(!game) return;
    const role = Object.entries(game.roleToSocket).find(([role,sid])=>sid===socket.id)?.[0];
    if(!role || role!==game.currentTurn) return;
    const from=game.positions[role], to={r,c};
    if(!isAdjacent(from,to)) return;
    const cellType=game.board[r][c].type;
    if(cellType==='obstacle') return;
    if(role==='warden' && cellType==='tunnel') return;
    const other=(role==='warden')?'prisoner':'warden';
    if(game.positions[other].r===r && game.positions[other].c===c && role!=='warden') return;
    applyMove(role,to); if(game) switchTurn();
  });

  socket.on('disconnect',()=>{
    clients.delete(socket.id); removeFromQueue(socket.id);
    if(game && (socket.id===game.roleToSocket.warden || socket.id===game.roleToSocket.prisoner)){
      const roleLeaving = (socket.id===game.roleToSocket.warden)?'warden':'prisoner';
      const replacement = dequeue();
      if(replacement){
        game.roleToSocket[roleLeaving]=replacement;
        io.to(replacement).emit('role', { role: roleLeaving });
        broadcastState();
      } else {
        clearInterval(game.intervalId); game=null;
        io.emit('game:aborted',{reason:'A player disconnected.'});
      }
    }
    broadcastStats();
  });
});

// admin + reset
app.get('/admin',(req,res)=>{
  if(hasReactBuild) res.sendFile(path.join(reactBuild,'index.html'));
  else res.sendFile(path.join(__dirname,'public','admin.html'));
});
app.post('/reset',(req,res)=>{
  scores={warder:0,prisoner:0};
  if(game){ clearInterval(game.intervalId); game=null; }
  io.emit('server:reset',{scores}); maybeStartNewGame(); res.json({ok:true});
});

// SPA fallback
if (hasReactBuild) {
  app.get('*', (req,res) => res.sendFile(path.join(reactBuild,'index.html')));
}

server.listen(PORT, ()=> console.log(`Escape Plan server on http://localhost:${PORT}`));
