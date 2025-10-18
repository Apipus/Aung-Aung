'use client';

import { useState } from "react";
import { Button } from "@/components/button";

const MAP_PRESETS = [
  { key: "5x5", label: "5x5 (QUICK)",  detail: ["20 free blocks","5 obstacles"] },
  { key: "7x7", label: "7x7 (MEDIUM)", detail: ["40 free blocks","10 obstacles"] },
  { key: "9x9", label: "9x9 (LARGE)",  detail: ["65 free blocks","17 obstacles"] },
];

export default function CreateRoom({ onCreate, className }) {
  const [roomName, setRoomName] = useState("My Prison");
  const [mapKey, setMapKey] = useState("5x5");

  const create = () => {
    const name = roomName.trim() || "My Prison";
    onCreate(name, mapKey);
  };

  return (
    <section className={`rounded-2xl border bg-[var(--bg-secondary)] p-5 ${className}`}>
      <h2 className="text-xl font-extrabold mb-4">CREATE ROOM</h2>

      <label className="text-base font-extrabold">ROOM NAME</label>
      <input
        value={roomName}
        onChange={(e) => setRoomName(e.target.value)}
        placeholder="My Prison"
        maxLength={30}
        className="mt-1 mb-4 w-full border border-neutral-300 rounded-md px-3 py-2 text-base font-bold bg-white"
      />

      <div className="text-base font-extrabold mb-2">MAP SIZE</div>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {MAP_PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => setMapKey(p.key)}
            className={[
              "rounded-xl border px-4 py-3 text-left bg-[var(--bg-tertiary)]",
              mapKey === p.key ? "ring-2 ring-green-500 border-green-500" : "border-neutral-300",
            ].join(" ")}
          >
            <div className="font-bold">{p.label}</div>
            <ul className="text-xs font-semibold text-neutral-500 list-disc list-inside">
              {p.detail.map((d) => <li key={d}>{d}</li>)}
            </ul>
          </button>
        ))}
      </div>

      <Button 
        onClick={create} 
        className="mt-8 w-1/3 bg-white hover:bg-[var(--accent)] hover:text-[var(--bg-primary)] text-base font-extrabold text-[var(--text-primary)] border-b-4 shadow-xs active:scale-95 transition">
        CREATE
    </Button>
    </section>
  );
}