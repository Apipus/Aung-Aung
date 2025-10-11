'use client';
import React from 'react';

// Keeps your emoji by default; you can swap to lucide icons later.
const GameCell = React.memo(function GameCell({
  r,
  c,
  cell,
  isWarden,
  isPrisoner,
  isValid,
  onClick,
}) {
  let classes = 'cell';
  if (cell?.type === 'obstacle') classes += ' obstacle';
  if (cell?.type === 'tunnel') classes += ' tunnel';
  if (isValid) classes += ' valid'; // optional: style hint ring in CSS

  return (
    <button
      type="button"
      className={classes}
      onClick={isValid ? () => onClick(r, c) : undefined}
      disabled={!isValid}
      aria-disabled={!isValid}
      aria-label={`cell ${r},${c}${isValid ? ' (valid)' : ''}`}
    >
      {isWarden && <span className="piece">🔒</span>}
      {isPrisoner && <span className="piece">🧍</span>}
      {/* Optional labels */}
      {cell?.type === 'tunnel' && !isPrisoner && !isWarden && (
        <span className="cell-label">EXIT</span>
      )}
    </button>
  );
});

export default GameCell;
