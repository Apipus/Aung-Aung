'use client'
import { socket } from "../socket";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/button"; // Assuming this is your button path

export default function AdminPage() {
  const [online, setOnline] = useState(0);
  const [clients, setClients] = useState([]);
  const [rooms, setRooms] = useState([]); // <-- Changed from queue
  const didConnect = useRef(false);

  useEffect(() => {
    if (didConnect.current) return;
    didConnect.current = true;

    socket.connect();
    socket.emit("client:ready");

    socket.on("server:stats", ({ online, clients }) => {
      setOnline(online);
      setClients(clients || []);
    });
    
    // Listen for room list instead of lobby:update
    socket.on("room:list", ({ rooms }) => {
      setRooms(rooms || []);
    });

    // Simple way to track active games
    socket.on("game:start", () => socket.emit("client:ready"));
    socket.on("game:over", () => socket.emit("client:ready"));

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

  // The 'activeGame' state is removed as we now support multiple games
  
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Escape Plan Admin Panel</h1>
      <p>🧑‍💻 Online clients: {online}</p>
      
      <Button onClick={resetGame} className="bg-red-600 hover:bg-red-700">
        🔁 Reset Game & Scores
      </Button>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">🎮 Active Rooms ({rooms.length})</h2>
        {rooms.length > 0 ? (
          <ul className="border rounded-lg p-2 space-y-1 bg-slate-800/40">
            {rooms.map((room) => (
              <li key={room.id} className="border-b p-2">
                <p><strong>{room.name}</strong> (ID: {room.id})</p>
                <p>Status: {room.isPlaying ? "In Game" : "Waiting"}</p>
                <p>Players ({room.playerCount}/2): {room.players.join(', ')}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-400">No active rooms.</p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">👥 Connected Players ({clients.length})</h2>
        <ul className="border rounded-lg p-2 space-y-1 bg-slate-800/40">
          {clients.map((c) => (
            <li key={c.id} className="flex justify-between items-center">
              <span>{c.nickname || "(unnamed)"} (ID: {c.id})</span>
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
    </div>
  );
}