'use client';
import React, { useMemo } from 'react';
import Cell from './Cell';

export default function GameBoard({
  board,
  positions,
  grid = 5,
  myRole,
  turn,
  onMove,
  isSpectator = false,
}) {
  const myTurn = myRole && myRole === turn;

  const isAdjacent = (a, b) => {
    if (!a || !b) return false;
    const dr = Math.abs(a.r - b.r);
    const dc = Math.abs(a.c - b.c);
    return dr + dc === 1;
  };

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
        if (myRole === 'warder' && cell.type === 'tunnel') continue;
        map[r][c] = true;
      }
    }
    return map;
  }, [board, grid, myRole, myTurn, positions]);

  return (
    <div className="space-y-2 relative">
      {/* Grid wrapper */}
      <div
        className={[
          'relative transition-opacity',
          isSpectator ? 'opacity-60 pointer-events-none' : '',
        ].join(' ')}
      >
        <div
          className={[
            'grid gap-2 sm:gap-1.5 p-2 rounded-2xl border-2 shadow-sm',
            'bg-[var(--bg-secondary)] border-[var(--border-color)]'
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
                  canClick={isSpectator ? false : canClick}
                  onClick={() => onMove(r, c)}
                />
              );
            })
          )}
        </div>

        {isSpectator && (
          <div className="pointer-events-none absolute top-2 right-2 rounded-full bg-[#1447E6] text-white text-xs font-medium px-3 py-1 shadow">
            Spectating
          </div>
        )}
      </div>

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        {isSpectator
          ? 'You are spectating — moves are disabled.'
          : (myTurn ? 'Your turn — click an adjacent cell.' : 'Waiting for opponent…')}
      </p>
    </div>
  );
}