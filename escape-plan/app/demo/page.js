'use client'

import RoomCard from "@/components/lobby/RoomCard";

export default function Demo() {
  const sample = {
    id: "demo-1",
    name: "Training Yard",
    players: 1,
    mapKey: "7x7",
    status: "waiting"
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-300 p-10">
      <RoomCard
        room={sample}
        onJoin={(id) => alert(`join ${id}`)}
      />
    </div>
  );
}