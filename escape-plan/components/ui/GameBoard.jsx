'use client';
import React, { useMemo } from 'react';
import Cell from './Cell';

/**
 * Props:
 * - board: 2D array of { type: 'free'|'obstacle'|'tunnel' }
 * - positions: { warder: {r,c}, prisoner: {r,c} }
 * - grid: number
 * - myRole: 'warder'|'prisoner'|null
 * - turn: 'warder'|'prisoner'|''
 * - onMove: (r,c) => void
 * - isSpectator?: boolean   // ✅ NEW
 */
export default function GameBoard({
  board,
  positions,
  grid = 5,
  myRole,
  turn,
  onMove,
  isSpectator = false, // ✅ NEW
}) {
  const myTurn = myRole && myRole === turn;

  const isAdjacent = (a, b) => {
    if (!a || !b) return false;
    const dr = Math.abs(a.r - b.r);
    const dc = Math.abs(a.c - b.c);
    return dr + dc === 1;
  };

  // UX-only adjacency/clickability map (server still validates)
  const canClickMap = useMemo(() => {
    const map = Array.from({ length: grid }, () => Array(grid).fill(false));
    if (!myTurn || !positions || !myRole) return map;

    const me = positions[myRole];
    for (let r = 0; r < grid; r++) {
      for (let c = 0; c < grid; c++) {
        const cell = board?.[r]?.[c];
        if (!cell) continue;
        if (!isAdjacent(me, { r, c })) continue;
        if (cell.type === 'obstacle') continue;
        if (myRole === 'warder' && cell.type === 'tunnel') continue; // warder cannot enter tunnel
        // prisoner CAN step onto warder
        map[r][c] = true;
      }
    }
    return map;
  }, [board, grid, myRole, myTurn, positions]);

  return (
    <div className="space-y-2 relative">
      {/* Grid wrapper with spectator dim + disable clicks */}
      <div
        className={[
          'relative',
          isSpectator ? 'opacity-60 pointer-events-none' : '',
        ].join(' ')}
      >
        <div
          className={[
            'grid gap-1 sm:gap-1.5 p-1 sm:p-2 rounded-2xl',
            'bg-neutral-100 border border-neutral-200 shadow-sm'
          ].join(' ')}
          style={{ gridTemplateColumns: `repeat(${grid}, minmax(0, 1fr))` }}
        >
          {board?.map((row, r) =>
            row.map((cell, c) => {
              const isWarder = positions?.warder?.r === r && positions?.warder?.c === c;
              const isPrisoner = positions?.prisoner?.r === r && positions?.prisoner?.c === c;
              const canClick = !!canClickMap?.[r]?.[c];

              return (
                <Cell
                  key={`${r}-${c}`}
                  r={r}
                  c={c}
                  cell={cell}
                  isWarder={isWarder}
                  isPrisoner={isPrisoner}
                  canClick={isSpectator ? false : canClick}  // ✅ disable in spectator mode
                  onClick={() => onMove(r, c)}
                />
              );
            })
          )}
        </div>

        {/* Spectator ribbon overlay (doesn't block clicks due to pointer-events-none) */}
        {isSpectator && (
          <div className="pointer-events-none absolute top-2 right-2 rounded-full bg-blue-600 text-white text-xs font-medium px-3 py-1 shadow">
            Spectating
          </div>
        )}
      </div>

      <p className="text-xs text-neutral-500">
        {isSpectator
          ? 'You are spectating — moves are disabled.'
          : (myTurn ? 'Your turn — click an adjacent cell.' : 'Waiting for opponent…')}
      </p>
    </div>
  );
}