'use client';

import HeaderBar from "@/components/lobby/HeaderBar";
import AvailableRooms from "@/components/lobby/AvailableRooms";
import CreateRoom from "@/components/lobby/CreateRoom";
import { useLobby } from "@/hooks/useLobby";
import { getNickname } from "@/lib/nickname";

export default function LobbyPage() {
  const { online, rooms, welcome, joinRoom, createRoom } = useLobby();

  return (
    <main className="min-h-screen p-6 flex flex-col items-center">
      <HeaderBar online={online} />

      <p className="max-w-6xl mt-3 text-center md:text-left text-base font-bold">
        {welcome && (
          <>WELCOME, <span className="text-green-600">{getNickname()}</span></>
        )}
      </p>

      <div className="w-full max-w-6xl grid md:grid-cols-3 gap-6 mt-6">
        <AvailableRooms rooms={rooms} onJoin={joinRoom} className="md:col-span-1" />
        <CreateRoom onCreate={createRoom} className="md:col-span-2" />
      </div>
    </main>
  );
}