'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { socket } from "../socket";
import { Button } from "@/components/button";
import { getNickname } from "@/lib/nickname";

const MAP_PRESETS = [
  { key: "5x5",  label: "5x5 (QUICK)",  detail: ["20 free blocks","5 obstacles"] },
  { key: "7x7",  label: "7x7 (MEDIUM)", detail: ["40 free blocks","10 obstacles"] },
  { key: "9x9",  label: "9x9 (LARGE)",  detail: ["65 free blocks","17 obstacles"] },
];

export default function LobbyPage(){
  const router = useRouter();
  const [online, setOnline] = useState(0);
  const [rooms, setRooms] = useState([]);
  const [roomName, setRoomName] = useState("My Prison");
  const [mapKey, setMapKey] = useState("5x5");
  const [welcome, setWelcome] = useState("");
  const didConnect = useRef(false);
  const didName = useRef(false);

  // connect + nickname + rooms stream
  useEffect(()=>{
    const nick = getNickname();
    if(!nick){ router.replace("/name"); return; }
    setWelcome(`WELCOME, ${nick}`);

    if(didConnect.current) return;
    didConnect.current = true;

    socket.connect();
    socket.emit("client:ready");

    const tryName = () => {
      if(didName.current) return;
      const n = getNickname();
      if(n){ didName.current = true; socket.emit("set:nickname", n); }
    };
    socket.on("connect", tryName);
    tryName();

    socket.on("server:stats", ({ online })=> setOnline(online));
    socket.on("room:list", ({ rooms }) => setRooms(rooms));
    socket.on("room:joined", ({ roomId }) => router.push(`/play?room=${roomId}`));
    socket.on("game:start", ({ roomId }) => router.push(`/play?room=${roomId}`));

    // ask for current rooms right away
    socket.emit("room:list");

    return ()=>{ socket.removeAllListeners(); socket.disconnect(); didConnect.current=false; didName.current=false; };
  },[router]);

  const RoomCard = ({r}) => {
    const label = `${r.name}`;
    return (
      <div className="flex items-center justify-between w-full bg-white/60 border rounded-xl px-4 py-3">
        <div className="space-y-0.5">
          <div className="font-semibold">{label}</div>
          <div className="text-xs text-neutral-600 flex items-center gap-3">
            <span>👥 {r.players}/2</span>
            <span>{r.mapKey}</span>
            {r.status==="playing" && <span className="text-amber-600">in match</span>}
          </div>
        </div>
        <Button
          disabled={r.players>=2 || r.status==="playing"}
          onClick={()=>socket.emit("room:join", { roomId: r.id })}
        >
          JOIN
        </Button>
      </div>
    );
  };

  const createRoom = () => {
    const name = roomName.trim() || "My Prison";
    socket.emit("room:create", { name, mapKey });
  };

  const headerRight = useMemo(()=>(
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2 text-sm text-neutral-700">
        <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
        <span>{online} PLAYERS ONLINE</span>
      </div>
      <button className="p-2 rounded-full hover:bg-neutral-100" aria-label="settings">
        ⋮
      </button>
    </div>
  ),[online]);

  return (
    <main className="min-h-screen p-6 flex flex-col items-center">
      {/* Header Row */}
      <div className="w-full max-w-6xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={()=>router.push("/name")}>← BACK</Button>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight">RUN FOR IT!</h1>
        </div>
        {headerRight}
      </div>

      {/* Welcome */}
      <p className="w-full max-w-6xl mt-3 text-center md:text-left text-sm">
        {welcome && (<span>WELCOME, <span className="text-green-600 font-semibold">{getNickname()}</span></span>)}
      </p>

      {/* Two Panels */}
      <div className="w-full max-w-6xl grid md:grid-cols-2 gap-6 mt-6">
        {/* Available Rooms */}
        <section className="rounded-2xl border bg-neutral-50 p-5">
          <h2 className="text-xl font-bold mb-3">AVAILABLE ROOMS</h2>
          <div className="space-y-3">
            {rooms.length===0 && (
              <div className="text-sm text-neutral-600">No rooms yet. Create one on the right!</div>
            )}
            {rooms.map(r=> <RoomCard key={r.id} r={r} />)}
          </div>
        </section>

        {/* Create Room */}
        <section className="rounded-2xl border bg-neutral-50 p-5">
          <h2 className="text-xl font-bold mb-4">CREATE ROOM</h2>

          <label className="text-sm font-medium">ROOM NAME</label>
          <input
            value={roomName}
            onChange={e=>setRoomName(e.target.value)}
            placeholder="My Prison"
            maxLength={30}
            className="mt-1 mb-4 w-full border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white"
          />

          <div className="text-sm font-medium mb-2">MAP SIZE</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {MAP_PRESETS.map(p=>(
              <button
                key={p.key}
                onClick={()=>setMapKey(p.key)}
                className={[
                  "rounded-xl border px-4 py-3 text-left bg-white",
                  mapKey===p.key ? "ring-2 ring-green-500 border-green-500" : "border-neutral-300"
                ].join(" ")}
              >
                <div className="font-semibold">{p.label}</div>
                <ul className="text-xs text-neutral-600 list-disc list-inside">
                  {p.detail.map(d=><li key={d}>{d}</li>)}
                </ul>
              </button>
            ))}
          </div>

          <Button onClick={createRoom} className="mt-4">CREATE</Button>
        </section>
      </div>
    </main>
  );
}