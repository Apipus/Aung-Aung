'use client';
import React from 'react';

/**
 * Props:
 * - r, c: number
 * - cell: { type: 'free'|'obstacle'|'tunnel' }
 * - isWarder: boolean
 * - isPrisoner: boolean
 * - canClick: boolean
 * - onClick: () => void
 */
export default function Cell({
  r, c, cell,
  isWarder, isPrisoner,
  canClick,
  onClick
}) {
  const base =
    'relative aspect-square rounded-xl border select-none ' +
    'flex items-center justify-center text-xl md:text-2xl transition';

  const typeClass =
    cell.type === 'obstacle'
      ? 'bg-neutral-800 border-neutral-700'
      : cell.type === 'tunnel'
      ? 'bg-emerald-100 border-emerald-300'
      : 'bg-white border-neutral-200';

  const hover =
    canClick
      ? 'cursor-pointer ring-2 ring-blue-500 ring-offset-2 hover:scale-[1.02]'
      : 'cursor-default opacity-100';

  return (
    <button
      aria-label={`cell-${r}-${c}`}
      className={`${base} ${typeClass} ${hover}`}
      onClick={canClick ? onClick : undefined}
      disabled={!canClick}
    >
      {isWarder && <span className="pointer-events-none">🔒</span>}
      {isPrisoner && <span className="pointer-events-none">🧍</span>}

      {/* subtle dot to show clickable adjacency */}
      {canClick && !isWarder && !isPrisoner && (
        <span className="absolute bottom-1 right-1 size-2 rounded-full bg-blue-500/70" />
      )}
    </button>
  );
}