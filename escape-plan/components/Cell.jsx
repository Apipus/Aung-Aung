'use client';
import React from 'react';

export default function Cell({
  r, c, cell,
  isWarder, isPrisoner,
  canClick,
  onClick
}) {
  const base =
    'relative aspect-square rounded-lg border-2 flex items-center justify-center text-xl md:text-2xl transition transform font-medium';

  const typeClass =
    cell.type === 'obstacle'
      ? 'bg-[var(--cell-obstacle)] border-[var(--cell-obstacle)]'
      : cell.type === 'tunnel'
      ? 'bg-[var(--cell-exit)]/80 text-white font-semibold border-[var(--cell-exit)]/70'
      : 'bg-[var(--cell-free)] border-[var(--border-color)]';

  const hover =
    canClick
      ? 'cursor-pointer ring-2 ring-[#FFCC33] hover:scale-[1.04]'
      : 'cursor-default';

  const contentColor = isWarder
    ? 'text-[#E64D1A]'
    : isPrisoner
    ? 'text-[#2EB873]'
    : 'text-[var(--text-primary)]';

  return (
    <button
      aria-label={`cell-${r}-${c}`}
      className={`${base} ${typeClass} ${hover} ${contentColor}`}
      onClick={canClick ? onClick : undefined}
      disabled={!canClick}
    >
      {cell.type === 'tunnel' ? (
        <span className="text-l sm:text-base md:text-lg tracking-wide">EXIT</span>
      ) : (
        <>
          {isWarder && <span className="pointer-events-none">🔒</span>}
          {isPrisoner && <span className="pointer-events-none">🧍</span>}
        </>
      )}
    </button>
  );
}