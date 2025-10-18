'use client';

import RoomCard from "./RoomCard";

export default function AvailableRooms({ rooms, onJoin }) {
  return (
    <section className="rounded-2xl border bg-[var(--bg-secondary)] p-5">
      <h2 className="text-xl font-extrabold mb-3">AVAILABLE ROOMS</h2>
      <div className="space-y-3">
        {rooms.length === 0 ? (
          <div className="text-sm text-neutral-500">No rooms yet. Create one on the right!</div>
        ) : (
          rooms.map((r) => <RoomCard key={r.id} room={r} onJoin={onJoin} />)
        )}
      </div>
    </section>
  );
}