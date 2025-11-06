"use client";

import { useState } from "react";
import { useLobby } from "@/hooks/useLobby"; // Uses the new hook
import HeaderBar from "@/components/HeaderBar";
import { Button } from "@/components/button";

export default function LobbyPage() {
  const { online, rooms, welcome, joinRoom, createRoom, resetServer } =
    useLobby();
  const [roomName, setRoomName] = useState("");

  const handleCreateRoom = (e) => {
    e.preventDefault();
    const t = roomName.trim();
    if (!t) {
      alert("Please enter a room name.");
      return;
    }
    createRoom(t);
    setRoomName("");
  };

  return (
    <main className="min-h-screen flex flex-col items-center p-6 space-y-6">
      {/* 1. Header Bar */}
      <HeaderBar online={online} />
      <p className="text-lg font-extrabold text-center">{welcome}</p>

      <div className="w-full max-w-6xl flex flex-col md:flex-row gap-6">
        {/* 2. Left Side: Create Room */}
        <div className="flex-1 bg-[var(--bg-secondary)] rounded-2xl border border-[#959595] p-4 space-y-4">
          <h2 className="text-xl font-black mb-4">CREATE ROOM</h2>

          <form onSubmit={handleCreateRoom} className="space-y-1">
            <div className="flex items-center gap-3">
              <label
                htmlFor="roomName"
                className="font-extrabold text-base whitespace-nowrap"
              >
                ROOM NAME
              </label>
              <input
                id="roomName"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="My Awesome Game"
                maxLength={30}
                className="flex-1 border border-neutral-300 rounded-md px-3 py-1 text-base font-bold bg-white"
              />
            </div>
            <Button
              type="submit"
              className="mt-4 w-1/3 bg-white hover:bg-[var(--accent)] hover:text-[var(--bg-primary)] text-base font-extrabold text-[var(--text-primary)] border-b-4 shadow-xs active:scale-95 transition"
            >
              CREATE
            </Button>
          </form>
        </div>

        {/* 3. Right Side: Room List */}
        <div className="flex-1 bg-[var(--bg-secondary)] rounded-2xl border border-[#959595] p-4 space-y-4">
          <h3 className="text-xl font-extrabold mb-4 uppercase">
            Available Rooms ({rooms.length})
          </h3>
          <ul className="space-y-3">
            {rooms.length === 0 && (
              <li className="font-semibold text-neutral-400 text-sm">
                No rooms available. Create one!
              </li>
            )}
            {rooms.map((room) => (
              <li
                key={room.id}
                className="flex items-center justify-between bg-[var(--bg-tertiary)] p-3 rounded-lg border border-neutral-300"
              >
                <div>
                  <p className="text-lg font-bold text-[var(--text-primary)]">
                    {room.name}
                  </p>
                  <p className="text-sm font-semibold text-neutral-500">
                    PLAYERS: {room.players.join(", ") || "Waiting..."} (
                    {room.playerCount}/2)
                  </p>
                  {typeof room.queueCount === 'number' && room.queueCount > 0 && (
                    <p className="text-xs font-semibold text-neutral-500">QUEUE: {room.queueCount}</p>
                  )}
                </div>
                <Button
                  onClick={() => joinRoom(room.id)}
                  className="px-4 py-2 bg-white hover:bg-[var(--accent)] hover:text-[var(--bg-primary)] text-base font-extrabold text-[var(--text-primary)] border-b-4 shadow-xs active:scale-95 transition"
                >
                  {room.isPlaying || room.playerCount >= 2 ? "QUEUE" : "JOIN"}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
