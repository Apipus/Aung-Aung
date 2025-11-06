"use client";

import { useRef, useEffect } from "react"; // ✅ hooks at top
import { useGame } from "@/hooks/useGame";
import HeaderBar from "@/components/HeaderBar";

// --- Helper Components ---

const PlayerIcon = ({ role }) => {
  const emoji = role === "warder" ? "👮" : "🏃";
  return <span className="text-4xl md:text-5xl">{emoji}</span>;
};

const CellIcon = ({ type }) => {
  if (type === "obstacle")
    return (
      <div className="w-full h-full bg-[var(--bg-secondary)] rounded-md" />
    );
  if (type === "tunnel")
    return (
      <div className="w-full h-full bg-[var(--cell-exit)] rounded-md flex items-center justify-center text-4xl">
        🕳️
      </div>
    );
  if (type === 'item_move_tunnel')
    return (
      <div className="w-full h-full bg-yellow-100/10 rounded-md flex items-center justify-center text-3xl">
        🔁
      </div>
    );
  if (type === 'item_stay')
    return (
      <div className="w-full h-full bg-yellow-100/10 rounded-md flex items-center justify-center text-3xl">
        ⭐
      </div>
    );
  return null;
};

// --- FIX 1 ---
// Add nextGameTimer to the props here
function GameOverModal({ winnerName, winnerRole, playerRole, onLobby, nextGameTimer }) {
  const amIWinner = playerRole && winnerRole && playerRole === winnerRole;
  return (
    <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 animate-fade-in">
      <div className="panel p-8 text-center shadow-xl animate-jump-in">
        <h2 className="holtwood-title text-4xl mb-2">Game Over!</h2>

        {amIWinner ? (
          <>
            <div className="flex flex-col items-center gap-3 mb-4">
              <div className="text-6xl md:text-7xl">🏆</div>
              <div className="flex gap-2">
                <span className="text-2xl animate-bounce" style={{ animationDelay: '0s' }}>🎉</span>
                <span className="text-3xl animate-bounce" style={{ animationDelay: '0.08s' }}>✨</span>
                <span className="text-2xl animate-bounce" style={{ animationDelay: '0.16s' }}>🎊</span>
              </div>
            </div>
            <p className="text-2xl text-green-400 font-bold mb-6">You Win!</p>
            <p className="text-neutral-300 mb-4">You remain the warder for the next round.</p>
          </>
        ) : (
          <>
            <p className="text-3xl text-red-400 font-bold mb-6">You Lost</p>
            <p className="text-neutral-300 mb-4">Winner: <span className="font-bold text-yellow-300">{winnerName}</span></p>
          </>
        )}

        <p className="text-neutral-400 mb-4">
          {nextGameTimer > 0 ? `Next round starting in... ${nextGameTimer}` : "Restarting..."}
        </p>

        <button
          onClick={onLobby}
          className="px-6 py-3 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition"
        >
          Back to Lobby
        </button>
      </div>
    </div>
  );
}

// --- Main Page Component ---
export default function PlayPage() {
  const {
    gameState,
    playerRole,
    timeLeft,
    scores,
    gameOver,
    statusMessage,
    isMyTurn,
    onlineCount,
    nextGameTimer,
    extraRoundReserved,
    sendMove,
    leaveRoom,
  } = useGame();

  // ===== TIMER HOOKS (always run) =====
  // Use safe fallbacks when gameState is null so hooks can run before any return.
  const turnSecondsSafe = Math.max(1, gameState?.turnSeconds ?? 1);
  const currentTurnSafe = gameState?.currentTurn ?? "warder";
  const isWarderTurn = currentTurnSafe === "warder";

  const prevTimeRef = useRef(timeLeft);
  const justReset =
    timeLeft > prevTimeRef.current || timeLeft === turnSecondsSafe;

  useEffect(() => {
    prevTimeRef.current = timeLeft;
  }, [timeLeft]);

  const timerPercent = Math.max(
    0,
    Math.min(100, (timeLeft / turnSecondsSafe) * 100)
  );

  const timerBarStyle = {
    width: `${timerPercent}%`,
    transition: justReset ? "none" : "width 1s linear",
  };
  // ===== END TIMER HOOKS =====

  // Early return is now AFTER hooks (safe)
  if (!gameState) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 space-y-8">
        <HeaderBar
          online={onlineCount}
          showLeaveButton={true}
          onLeave={leaveRoom}
        />
        <div className="flex-grow flex items-center justify-center">
          <h1 className="text-4xl font-bold text-neutral-500 animate-pulse">
            {statusMessage}
          </h1>
        </div>
      </main>
    );
  }

  // Destructure only after we've confirmed gameState exists
  const { board, positions, roles } = gameState;

  const getValidMoves = (role, fromPos) => {
    if (!role || !fromPos) return [];
    const moves = [];
    const dirs = [
      { r: 1, c: 0 },
      { r: -1, c: 0 },
      { r: 0, c: 1 },
      { r: 0, c: -1 },
    ];
    for (const d of dirs) {
      const nr = fromPos.r + d.r;
      const nc = fromPos.c + d.c;
      if (nr < 0 || nr >= board.length || nc < 0 || nc >= board[0].length)
        continue;
      const cellType = board[nr][nc].type;
      if (cellType === "obstacle") continue;
      if (currentTurnSafe === "warder" && cellType === "tunnel") continue;
      moves.push({ r: nr, c: nc });
    }
    return moves;
  };

  const validMoves = isMyTurn
    ? getValidMoves(playerRole, positions[playerRole])
    : [];

  return (
    <main className="min-h-screen flex flex-col items-center p-4 md:p-6 space-y-4">
      {gameOver && (
        <GameOverModal
          winnerName={gameOver.winnerName}
          winnerRole={gameOver.winnerRole}
          playerRole={playerRole}
          onLobby={leaveRoom}
          nextGameTimer={nextGameTimer}
        />
      )}

      <HeaderBar
        online={onlineCount}
        showLeaveButton={true}
        onLeave={leaveRoom}
      />

      {/* --- Top Info Panel --- */}
      <div className="relative w-full max-w-4xl p-4 flex justify-between items-center">
        {/* Warder Info */}
        <div
          className={`flex items-center justify-between gap-12 py-3 px-6 rounded-full transition-all bg-[var(--bg-secondary)]
          ${isWarderTurn ? "ring-1 ring-[var(--text-primary)] shadow-md" : "opacity-50"}`}
        >
          <div className="flex items-center justify-between gap-3">
            {/* Left: Icon */}
            <div className="flex-shrink-0">
              <PlayerIcon role="warder" className="size-10" />
            </div>
            {/* Middle: Player name + role */}
            <div className="flex flex-col items-center text-center flex-1">
                <p className="font-extrabold text-lg">
                  {roles.warder}
                  {extraRoundReserved === roles.warder && (
                    <span className="ml-2 text-sm px-2 py-1 rounded-full bg-yellow-200 text-yellow-800 font-semibold">⭐ Extra</span>
                  )}
                </p>
              <p className="text-sm font-semibold text-[var(--text-primary)] opacity-50">
                Warder
              </p>
            </div>
          </div>
          {/* Right: Score */}
          <div className="flex-shrink-0 text-right">
            <p className="text-2xl font-bold text-[var(--text-primary)]">
              {scores.warder}
            </p>
          </div>
        </div>

        {/* --- TIMER (Centered) --- */}
        <div className="absolute left-1/2 -translate-x-1/2 text-center w-64">
          <p className="text-lg font-bold text-[var(--text-primary)]">
            {isWarderTurn ? "Warder's Turn" : "Prisoner's Turn"}
          </p>
          <p className="text-6xl font-extrabold text-red-500">{timeLeft}</p>

        </div>

        {/* Prisoner Info */}
        <div
          className={`flex items-center justify-between gap-12 py-3 px-6 rounded-full transition-all bg-[var(--bg-secondary)] 
          ${
            !isWarderTurn
              ? "ring-1 ring-[var(--text-primary)] shadow-md"
              : "opacity-50"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            {/* Left: Icon */}
            <div className="flex-shrink-0">
              <PlayerIcon role="prisoner" className="size-10" />
            </div>

            {/* Middle: Player name + role */}
            <div className="flex flex-col items-center text-center flex-1">
              <p className="font-extrabold text-lg">
                {roles.prisoner}
                {extraRoundReserved === roles.prisoner && (
                  <span className="ml-2 text-sm px-2 py-1 rounded-full bg-yellow-200 text-yellow-800 font-semibold">⭐ Extra</span>
                )}
              </p>
              <p className="text-sm font-semibold text-[var(--text-primary)] opacity-50">
                Prisoner
              </p>
            </div>
          </div>

          {/* Right: Score */}
          <div className="flex-shrink-0 text-right">
            <p className="text-2xl font-bold text-[var(--text-primary)]">
              {scores.prisoner}
            </p>
          </div>
        </div>
      </div>

      {/* --- Game Board --- */}
      <div className="w-full max-w-lg aspect-square panel p-2">
        <div className="grid grid-cols-5 gap-1.5 h-full">
          {board.flat().map((cell, index) => {
            const r = Math.floor(index / 5);
            const c = index % 5;
            const isWarderPos =
              positions.warder.r === r && positions.warder.c === c;
            const isPrisonerPos =
              positions.prisoner.r === r && positions.prisoner.c === c;
            const isMyPos =
              (playerRole === "warder" && isWarderPos) ||
              (playerRole === "prisoner" && isPrisonerPos);
            const isValidMove = validMoves.some((m) => m.r === r && m.c === c);

            return (
              <div
                key={index}
                onClick={() => isValidMove && sendMove(r, c)}
                className={`cell aspect-square rounded-md flex items-center justify-center relative transition-all duration-150 bg-[var(--cell-free)]
                  ${
                    isValidMove
                      ? "bg-green-400/50 hover:bg-green-400/80 cursor-pointer ring-2 ring-green-300"
                      : ""
                  }
                  ${isMyPos ? "ring-4 ring-yellow-400" : ""}
                `}
              >
                <CellIcon type={cell.type} />
                {isWarderPos && <PlayerIcon role="warder" />}
                {isPrisonerPos && <PlayerIcon role="prisoner" />}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-center text-sm text-neutral-500">
        You are the <strong>{playerRole}</strong>.{" "}
        {isMyTurn ? "It's your turn!" : "Waiting for opponent..."}
      </p>
    </main>
  );
}