'use client'
import { socket } from "../socket";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

export default function AdminPage() {
  const [online, setOnline] = useState(0);
  const [clients, setClients] = useState([]);
  const [queue, setQueue] = useState([]);
  const [activeGame, setActiveGame] = useState(null);
  const didConnect = useRef(false);

  useEffect(() => {
    if (didConnect.current) return;
    didConnect.current = true;

    socket.connect();
    socket.emit("client:ready");

    socket.on("server:stats", ({ online }) => setOnline(online));
    socket.on("lobby:update", ({ clients, queue }) => {
      setClients(clients);
      setQueue(queue);
    });
    socket.on("game:start", ({ roles }) => {
      setActiveGame(roles);
    });
    socket.on("game:over", () => {
      setActiveGame(null);
    });

    return () => {
      socket.disconnect();
      didConnect.current = false;
    };
  }, []);

  async function resetGame() {
    const res = await fetch("http://localhost:8000/reset", { method: "POST" });
    if (res.ok) alert("Game reset successfully!");
    else alert("Failed to reset game.");
  }

  async function kickPlayer(id) {
    const confirmKick = confirm("Kick this player?");
    if (!confirmKick) return;
    try {
      await fetch(`http://localhost:8000/kick/${id}`, { method: "POST" });
    } catch (e) {
      console.error("Failed to kick:", e);
    }
  }

  async function swapQueue(i1, i2) {
    try {
      await fetch(`http://localhost:8000/swap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ i1, i2 }),
      });
    } catch (e) {
      console.error("Failed to swap queue:", e);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Escape Plan Admin Panel</h1>
      <p>🧑‍💻 Online clients: {online}</p>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">🎮 Current Game</h2>
        {activeGame ? (
          <div className="border p-3 rounded-lg bg-slate-800/40">
            <p>Warder: <strong>{activeGame.warder}</strong></p>
            <p>Prisoner: <strong>{activeGame.prisoner}</strong></p>
          </div>
        ) : (
          <p className="text-slate-400">No active game right now.</p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">👥 Connected Players</h2>
        <ul className="border rounded-lg p-2 space-y-1 bg-slate-800/40">
          {clients.map((c) => (
            <li key={c.id} className="flex justify-between items-center">
              <span>{c.nickname || "(unnamed)"}</span>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => kickPlayer(c.id)}
              >
                Kick
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">⏳ Queue</h2>
        {queue.length ? (
          <ul className="border rounded-lg p-2 space-y-1 bg-slate-800/40">
            {queue.map((q, idx) => (
              <li key={q.id} className="flex justify-between items-center">
                <span>
                  {idx + 1}. {q.nickname || "(unnamed)"}
                </span>
                <div className="flex gap-2">
                  {idx > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => swapQueue(idx, idx - 1)}
                    >
                      ↑
                    </Button>
                  )}
                  {idx < queue.length - 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => swapQueue(idx, idx + 1)}
                    >
                      ↓
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-400">Queue is empty.</p>
        )}
      </section>

      <Button onClick={resetGame} className="bg-red-600 hover:bg-red-700">
        🔁 Reset Game & Scores
      </Button>
    </div>
  );
}




/* 'use client'
import { socket } from "../socket";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

export default function AdminPage() {
    const [count,setCount] = useState(0);
    
    const didConnect = useRef(false);
    useEffect(()=>{
        if (didConnect.current) return;
        didConnect.current = true;
        socket.connect();
        socket.emit('client:ready');
        socket.on('server:stats', ({ online }) => {
            setCount(online);
            console.log("Online players: ", online);
        });
        return()=>{
            sockey.disconnect();
            didConnect.current = false;
        };
    }, [])

    async function resetGame(){
        const res = await fetch('http://localhost:8000/reset', { method: 'POST' });
        if (res.ok) {
            console.log("Game reset successfully");
        } else {
            console.error("Failed to reset game");
        }
    };

    return (
        <>
            <h1>Escape Plan Admin</h1>
            <p>Online clients: {count}</p>
            <Button onClick={resetGame}>Reset Game & Scores</Button>
        </>
    )
}
 */