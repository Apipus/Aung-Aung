# server.py
import asyncio, json, os, random
from collections import defaultdict, deque
from aiohttp import web
import websockets
from websockets.server import serve

PORT = 8765  # change if you like
GRID_N = 5
FREE_COUNT = 19
OBSTACLE_COUNT = 5    # ~20% of 25
TUNNEL_COUNT = 1
TURN_SECONDS = 10

# --- game state ---
class Game:
    def __init__(self):
        self.reset(full=True)

    def reset(self, full=False):
        # persistent scores survive "soft" reset from win to next game
        if full or not hasattr(self, "scores"):
            self.scores = {"warden": 0, "prisoner": 0}
        self.players = []        # websocket ids in seat order [P1,P2]
        self.nick = {}           # ws_id -> nickname
        self.sockets = {}        # ws_id -> websocket
        self.turn_owner = None   # "warden" or "prisoner"
        self.turn_deadline = None
        self.timer_task = None
        self._new_board()

    # --- board generation ---
    def _new_board(self):
        # 0=free, X=obstacle, T=tunnel
        cells = [(r, c) for r in range(GRID_N) for c in range(GRID_N)]
        # choose obstacles such that free area is connected
        while True:
            board = [["0"] * GRID_N for _ in range(GRID_N)]
            for (r, c) in random.sample(cells, OBSTACLE_COUNT):
                board[r][c] = "X"
            # tunnel on a free cell
            fr = [(r, c) for (r, c) in cells if board[r][c] == "0"]
            (tr, tc) = random.choice(fr)
            board[tr][tc] = "T"
            # check connectivity among free+tunnel
            if self._all_accessible(board):
                break
        self.board = board
        free = [(r, c) for (r, c) in cells if board[r][c] == "0"]
        self.pos = {
            "warden": random.choice(free)
        }
        free2 = [p for p in free if p != self.pos["warden"]]
        self.pos["prisoner"] = random.choice(free2)

        # randomize first player
        self.turn_owner = random.choice(["warden", "prisoner"])
        self.turn_deadline = None

    def _all_accessible(self, board):
        # BFS from first free/tunnel to confirm single connected component
        cells = [(r, c) for r in range(GRID_N) for c in range(GRID_N)
                 if board[r][c] in ("0", "T")]
        if not cells: return False
        start = cells[0]
        seen = set([start])
        q = deque([start])
        while q:
            r, c = q.popleft()
            for dr, dc in ((1,0),(-1,0),(0,1),(0,-1)):
                nr, nc = r+dr, c+dc
                if 0 <= nr < GRID_N and 0 <= nc < GRID_N and (nr, nc) not in seen:
                    if board[nr][nc] in ("0", "T"):
                        seen.add((nr, nc))
                        q.append((nr, nc))
        return len(seen) == len(cells)

    # helpers
    def adjacents(self, r, c):
        for dr, dc in ((1,0),(-1,0),(0,1),(0,-1)):
            nr, nc = r+dr, c+dc
            if 0 <= nr < GRID_N and 0 <= nc < GRID_N:
                yield (nr, nc)

game = Game()

# --- static file server (to serve index.html) ---
async def handle_index(request):
    return web.FileResponse(os.path.join("static", "index.html"))

async def handle_static(request):
    path = request.match_info["path"]
    return web.FileResponse(os.path.join("static", path))

app = web.Application()
app.router.add_get("/", handle_index)
app.router.add_get("/{path:.*}", handle_static)

# --- websocket hub ---
CLIENTS = {}  # ws -> id
ID_SEQ = 0

def pack(msg_type, **data):
    return json.dumps({"type": msg_type, **data})

async def broadcast(msg):
    for ws in list(CLIENTS.keys()):
        try:
            await ws.send(msg)
        except:
            pass

def snapshot():
    # time remaining
    now = asyncio.get_event_loop().time()
    remaining = max(0, int((game.turn_deadline or now) - now)) if game.turn_deadline else TURN_SECONDS
    return {
        "gridN": GRID_N,
        "board": game.board,
        "pos": game.pos,
        "turn": game.turn_owner,
        "remaining": remaining,
        "online": len(CLIENTS),
        "scores": game.scores,
        "nicks": game.nick
    }

async def start_turn():
    # start a 10s countdown, on expiry auto-pass to next turn
    if game.timer_task:
        game.timer_task.cancel()
    game.turn_deadline = asyncio.get_event_loop().time() + TURN_SECONDS

    async def _tick():
        try:
            while True:
                await broadcast(pack("state", **snapshot()))
                await asyncio.sleep(1)
                if asyncio.get_event_loop().time() >= game.turn_deadline:
                    # no move -> switch turn
                    game.turn_owner = "warden" if game.turn_owner == "prisoner" else "prisoner"
                    game.turn_deadline = asyncio.get_event_loop().time() + TURN_SECONDS
        except asyncio.CancelledError:
            pass

    game.timer_task = asyncio.create_task(_tick())

def win(winner_role):
    if game.timer_task:
        game.timer_task.cancel()
        game.timer_task = None
    game.scores[winner_role] += 1
    return pack("end", winner=winner_role, scores=game.scores)

async def handle_move(role, to_r, to_c):
    # validate adjacency & terrain rules
    r, c = game.pos[role]
    if (to_r, to_c) not in game.adjacents(r, c):
        return
    cell = game.board[to_r][to_c]
    if cell == "X":  # obstacle
        return
    if cell == "T" and role != "prisoner":
        return
    # apply
    game.pos[role] = (to_r, to_c)

    # win checks
    if game.pos["warden"] == game.pos["prisoner"]:
        await broadcast(win("warden"))
        game._new_board()
        await start_turn()
        return
    if game.pos["prisoner"] == next(((r,c) for r in range(GRID_N) for c in range(GRID_N) if game.board[r][c]=="T"), None):
        await broadcast(win("prisoner"))
        game._new_board()
        await start_turn()
        return

    # switch turn
    game.turn_owner = "warden" if role == "prisoner" else "prisoner"
    game.turn_deadline = asyncio.get_event_loop().time() + TURN_SECONDS

async def ws_handler(websocket):
    global ID_SEQ
    ID_SEQ += 1
    ws_id = f"c{ID_SEQ}"
    CLIENTS[websocket] = ws_id
    game.sockets[ws_id] = websocket

    # on connect send snapshot + online
    await websocket.send(pack("system", msg="welcome", your_id=ws_id))
    await broadcast(pack("online", count=len(CLIENTS)))

    # if 1st or 2nd player joins, seat them; randomize roles once 2 are present
    if ws_id not in game.players and len(game.players) < 2:
        game.players.append(ws_id)
        if len(game.players) == 2:
            # randomly assign characters to the two seats
            pmap = random.sample(["warden","prisoner"], 2)
            seat_roles = {game.players[0]: pmap[0], game.players[1]: pmap[1]}
            await broadcast(pack("roles", seat_roles=seat_roles))
            await start_turn()

    try:
        async for raw in websocket:
            data = json.loads(raw)
            t = data.get("type")

            if t == "nick":
                game.nick[ws_id] = data.get("name","Player")
                await broadcast(pack("state", **snapshot()))

            elif t == "move":
                role = data["role"]
                if role != game.turn_owner:
                    continue
                await handle_move(role, data["r"], data["c"])
                await broadcast(pack("state", **snapshot()))

            elif t == "reset":
                game._new_board()
                await start_turn()
                await broadcast(pack("state", **snapshot()))
    finally:
        # cleanup
        CLIENTS.pop(websocket, None)
        game.sockets.pop(ws_id, None)
        if ws_id in game.players:
            game.players.remove(ws_id)
        await broadcast(pack("online", count=len(CLIENTS)))

async def main():
    # start HTTP for static files
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", 8080)
    await site.start()

    # start WS on separate port (clean separation)
    async with serve(ws_handler, "0.0.0.0", PORT):
        print(f"HTTP on :8080  |  WebSocket on :{PORT}")
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
