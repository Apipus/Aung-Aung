const socket = io();
const boardEl = document.getElementById('board');
const playersEl = document.getElementById('players');
const queueEl = document.getElementById('queue');
const statusEl = document.getElementById('status');
const roleEl = document.getElementById('role');
const turnEl = document.getElementById('turn');
const timerEl = document.getElementById('timer');
const scoresEl = document.getElementById('scores');

let myRole = null;
let grid = 5;
let board = [];
let positions = null;
let currentTurn = null;
let deadlineTs = null;

document.getElementById('joinBtn').onclick = () => {
  const name = document.getElementById('nickname').value.trim();
  if (name) socket.emit('set:nickname', name);
};

socket.on('hello', ({ msg }) => { statusEl.textContent = msg; });

socket.on('lobby:update', ({ clients, queue }) => {
  playersEl.innerHTML = '';
  clients.forEach(c => {
    const li = document.createElement('li');
    li.textContent = c.nickname || '(unnamed)';
    playersEl.appendChild(li);
  });

  queueEl.innerHTML = '';
  queue.forEach((q, idx) => {
    const li = document.createElement('li');
    li.textContent = `${idx === 0 ? 'NEXT — ' : ''}${q.nickname}`;
    queueEl.appendChild(li);
  });
});

socket.on('role', ({ role }) => {
  myRole = role;
  roleEl.textContent = `You are: ${role.toUpperCase()}`;
});

socket.on('game:start', (payload) => {
  grid = payload.grid;
  board = payload.board;
  positions = payload.positions;
  currentTurn = payload.currentTurn;
  scoresEl.textContent = `Scores — Warder: ${payload.scores.warden} | Prisoner: ${payload.scores.prisoner}`;
  statusEl.textContent = 'Game started!';
  renderBoard();
  updateTurn();
});

socket.on('game:state', ({ positions: pos, currentTurn: ct, deadlineTs: dl, scores }) => {
  positions = pos;
  currentTurn = ct;
  deadlineTs = dl;
  scoresEl.textContent = `Scores — Warder: ${scores.warden} | Prisoner: ${scores.prisoner}`;
  renderBoard();
  updateTurn();
});

socket.on('turn:tick', ({ remaining }) => {
  timerEl.textContent = `Time left: ${remaining}s`;
});

socket.on('game:over', ({ winnerRole, winnerName, scores }) => {
  alert(`Winner: ${winnerName} (${winnerRole})`);
  scoresEl.textContent = `Scores — Warder: ${scores.warden} | Prisoner: ${scores.prisoner}`;
  statusEl.textContent = 'Waiting for next game...';
});

socket.on('game:aborted', ({ reason }) => {
  alert(`Game aborted: ${reason}`);
});

socket.on('server:reset', ({ scores }) => {
  alert('Server reset.');
  scoresEl.textContent = `Scores — Warder: ${scores.warden} | Prisoner: ${scores.prisoner}`;
});

function renderBoard() {
  boardEl.innerHTML = '';
  boardEl.style.setProperty('--grid', grid);
  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      const div = document.createElement('div');
      div.className = 'cell';
      const type = board[r][c].type;
      if (type === 'obstacle') div.classList.add('obstacle');
      if (type === 'tunnel') div.classList.add('tunnel');

      const isWarder = positions?.warden?.r === r && positions?.warden?.c === c;
      const isPrisoner = positions?.prisoner?.r === r && positions?.prisoner?.c === c;

      if (isWarder) { div.textContent = '🔒'; div.classList.add('piece'); }
      else if (isPrisoner) { div.textContent = '🧍'; div.classList.add('piece'); }

      div.dataset.r = r; div.dataset.c = c;
      div.onclick = () => tryMove(r, c);
      boardEl.appendChild(div);
    }
  }
}

function updateTurn() {
  if (!myRole) return;
  turnEl.textContent = `Current turn: ${currentTurn}`;
  if (myRole === currentTurn) boardEl.classList.add('myturn');
  else boardEl.classList.remove('myturn');
}

function tryMove(r, c) {
  if (!myRole || myRole !== currentTurn) return;
  socket.emit('move', { r, c });
}
