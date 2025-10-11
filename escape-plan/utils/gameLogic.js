export function getAdjacentPositions({ r, c }, size) {
  const deltas = [
    { dr: -1, dc: 0 }, { dr: 1, dc: 0 },
    { dr: 0, dc: -1 }, { dr: 0, dc: 1 },
  ];
  const inside = (rr, cc) => rr >= 0 && cc >= 0 && rr < size && cc < size;
  return deltas
    .map(({ dr, dc }) => ({ r: r + dr, c: c + dc }))
    .filter(({ r: rr, c: cc }) => inside(rr, cc));
}

export function isValidMove(from, to, board) {
  if (!from || !to || !board?.length) return false;
  const manhattan = Math.abs(from.r - to.r) + Math.abs(from.c - to.c);
  if (manhattan !== 1) return false; // adjacent only
  const dest = board[to.r]?.[to.c];
  if (!dest) return false;
  if (dest.type === 'obstacle') return false;
  return true; // allow free/tunnel here
}
