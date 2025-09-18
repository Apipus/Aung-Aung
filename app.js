// -------- configure --------
// Example: const WS_URL = "ws://192.168.1.50:8765";
const WS_URL = "ws://172.20.10.2:8765"; // change to server's LAN IP for the other laptop
// --------------------------

let ws, myId=null, myRole=null, state=null, seatRoles={};

function connect() {
  ws = new WebSocket(WS_URL);
  ws.onopen = () => console.log("connected");
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.type === "system") { myId = m.your_id; }
    if (m.type === "online") document.getElementById("online").textContent = m.count;
    if (m.type === "roles") { seatRoles = m.seat_roles; tryAssignRole(); }
    if (m.type === "end") alert(`Winner: ${m.winner}`);
    if (m.type === "state") { state = m; render(); }
  };
  ws.onclose = () => setTimeout(connect, 1000);
}
connect();

function tryAssignRole() {
  if (!myId) return;
  const r = seatRoles[myId];
  if (r) {
    myRole = r;
    document.getElementById("role").textContent = r;
  }
}

document.getElementById("setNick").onclick = () => {
  const name = document.getElementById("nick").value || "Player";
  ws.send(JSON.stringify({type:"nick", name}));
};
document.getElementById("reset").onclick = () => ws.send(JSON.stringify({type:"reset"}));

function render() {
  if (!state) return;
  document.getElementById("turn").textContent = state.turn;
  document.getElementById("timer").textContent = state.remaining;
  document.getElementById("scores").textContent =
    `Scores — Warden: ${state.scores.warden} | Prisoner: ${state.scores.prisoner}`;
  tryAssignRole();

  const grid = document.getElementById("grid");
  grid.style.gridTemplateColumns = `repeat(${state.gridN}, 60px)`;
  grid.innerHTML = "";
  const w = state.pos.warden.join(",");
  const p = state.pos.prisoner.join(",");
  let tunnel = null;

  for (let r=0; r<state.gridN; r++) {
    for (let c=0; c<state.gridN; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      const t = state.board[r][c];
      if (t==="X") { cell.classList.add("ob"); cell.textContent = "X"; }
      if (t==="T") { cell.classList.add("tun"); cell.textContent = "⛏"; tunnel=[r,c]; }

      if (`${r},${c}` === w) cell.textContent = "🛡";
      if (`${r},${c}` === p) cell.textContent = "🏃";

      // highlight your piece
      if ((myRole==="warden" && `${r},${c}`===w) || (myRole==="prisoner" && `${r},${c}`===p)) {
        cell.classList.add("me");
      }

      // click to move
      cell.onclick = () => {
        if (!myRole || state.turn !== myRole) return;
        const from = (myRole==="warden") ? state.pos.warden : state.pos.prisoner;
        if (!isAdjacent(from, [r,c])) return;
        // block invalid terrain locally too
        if (t==="X" || (t==="T" && myRole!=="prisoner")) return;
        ws.send(JSON.stringify({type:"move", role: myRole, r, c}));
      };
      grid.appendChild(cell);
    }
  }
}

function isAdjacent([r,c],[r2,c2]) {
  const dr=Math.abs(r-r2), dc=Math.abs(c-c2);
  return (dr+dc===1);
}
