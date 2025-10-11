'use client';
import React, { useMemo, useCallback } from 'react';
import { getAdjacentPositions, isValidMove } from '@/utils/gameLogic';

export default function GameBoard({
  board,          // Cell[][]
  positions,      // { warden:{r,c}, prisoner:{r,c} }
  myRole,         // 'warden' | 'prisoner' | null
  turn,           // 'warden' | 'prisoner' | ''
  onMove,         // (r,c) => void
}) {
  const size = board?.length ?? 0;
  const isMyTurn = myRole && myRole === turn;

  // current player's position for this turn
  const fromPos = useMemo(() => {
    if (!positions) return null;
    return turn === 'warden' ? positions.warden : positions.prisoner;
  }, [positions, turn]);

  // set of valid adjacent destinations for highlight
  const validSet = useMemo(() => {
    if (!board?.length || !fromPos || !isMyTurn) return new Set();
    const adj = getAdjacentPositions(fromPos, size);
    const valids = adj.filter((p) => isValidMove(fromPos, p, board));
    return new Set(valids.map((p) => `${p.r},${p.c}`));
  }, [board, fromPos, size, isMyTurn]);

  const handleCellClick = useCallback(
    (r, c) => {
      if (!isMyTurn) return;
      if (!fromPos || !isValidMove(fromPos, { r, c }, board)) return;
      onMove(r, c);
    },
    [isMyTurn, fromPos, board, onMove]
  );

  if (!board?.length) return null;

  return (
    <div className={`board ${isMyTurn ? 'myturn' : ''}`} style={{ '--grid': size }}>
      {board.map((row, r) =>
        row.map((cell, c) => {
          const isWarden = positions?.warden?.r === r && positions?.warden?.c === c;
          const isPrisoner = positions?.prisoner?.r === r && positions?.prisoner?.c === c;
          const isValid = validSet.has(`${r},${c}`);

          let classes = 'cell';
          if (cell.type === 'obstacle') classes += ' obstacle';
          if (cell.type === 'tunnel') classes += ' tunnel';
          if (isValid) classes += ' valid'; // <-- highlight

          return (
            <button
              key={`${r}-${c}`}
              type="button"
              className={classes}
              onClick={isValid ? () => handleCellClick(r, c) : undefined}
              disabled={!isValid}
              aria-disabled={!isValid}
              aria-label={`cell ${r},${c}${isValid ? ' (valid)' : ''}`}
            >
              {isWarden && <span className="piece">🔒</span>}
              {isPrisoner && <span className="piece">🧍</span>}
              {cell.type === 'tunnel' && !isWarden && !isPrisoner && (
                <span className="cell-label">EXIT</span>
              )}
            </button>
          );
        })
      )}
    </div>
  );
}
