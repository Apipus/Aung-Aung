'use client';

import { memo } from "react";
import { Button } from "@/components/button";

function RoomCardBase({ room, onJoin }) {
  const disabled = room.players >= 2 || room.status === "playing";
  return (
    <div className="flex items-center justify-between w-full bg-[var(--bg-tertiary)] border border-neutral-400 rounded-xl px-4 py-3">
      <div className="space-y-0.5">
        <div className="text-base font-bold">{room.name}</div>
        <div className="text-xs font-bold text-neutral-500 flex items-center gap-3">
          <span>👥 {room.players}/2</span>
          <span>{room.mapKey}</span>
          {room.status === "playing" && <span className="text-amber-600">in match</span>}
        </div>
      </div>
      <Button 
        disabled={disabled} 
        onClick={() => onJoin(room.id)}
        className="px-4 py-2 bg-white hover:bg-[var(--accent)] hover:text-[var(--bg-primary)] text-base font-extrabold text-[var(--text-primary)] border-b-4 shadow-xs active:scale-95 transition"
        >
        JOIN
    </Button>
    </div>
  );
}

const RoomCard = memo(RoomCardBase);
export default RoomCard;