'use client';

import { useGame } from '@/hooks/useGame';
import HeaderBar from '@/components/HeaderBar'; // Corrected path

// --- Helper Components ---

const PlayerIcon = ({ role }) => {
  const emoji = role === 'warder' ? '👮' : '🏃';
  return <span className="text-4xl md:text-5xl">{emoji}</span>;
};

const CellIcon = ({ type }) => {
  if (type === 'obstacle') return <div className="w-full h-full bg-[var(--cell-obstacle)] rounded-md" />;
  if (type === 'tunnel') return <div className="w-full h-full bg-[var(--cell-exit)] rounded-md flex items-center justify-center text-4xl">🕳️</div>;
  return null;
};

function GameOverModal({ winnerName, onLobby }) {
  return (
    <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 animate-fade-in">
      <div className="panel p-8 text-center shadow-xl animate-jump-in">
        <h2 className="holtwood-title text-4xl mb-2">Game Over!</h2>
        <p className="text-2xl text-yellow-400 font-bold mb-6">{winnerName} Wins!</p>
        
        <p className="text-neutral-400 mb-4">
          {nextGameTimer > 0 
            ? `Next round starting in... ${nextGameTimer}`
            : "Restarting..."
          }
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
  const { gameState, playerRole, timeLeft, scores, gameOver, statusMessage, isMyTurn, onlineCount, nextGameTimer, sendMove, leaveRoom } = useGame();

  if (!gameState) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 space-y-8">
         <HeaderBar online={onlineCount} showLeaveButton={true} onLeave={leaveRoom} />
        <div className="flex-grow flex items-center justify-center">
            <h1 className="text-4xl font-bold text-neutral-500 animate-pulse">{statusMessage}</h1>
        </div>
      </main>
    );
  }

  const { board, positions, currentTurn, roles } = gameState;
  const isWarderTurn = currentTurn === 'warder';

  const getValidMoves = (role, fromPos) => {
    if (!role || !fromPos) return [];
    const moves = [];
    const dirs = [{ r: 1, c: 0 }, { r: -1, c: 0 }, { r: 0, c: 1 }, { r: 0, c: -1 }];
    for (const d of dirs) {
      const nr = fromPos.r + d.r;
      const nc = fromPos.c + d.c;
      if (nr < 0 || nr >= board.length || nc < 0 || nc >= board[0].length) continue;
      const cellType = board[nr][nc].type;
      if (cellType === 'obstacle') continue;
      if (role === 'warder' && cellType === 'tunnel') continue;
      moves.push({ r: nr, c: nc });
    }
    return moves;
  };

  const validMoves = isMyTurn ? getValidMoves(playerRole, positions[playerRole]) : [];

  return (
    <main className="min-h-screen flex flex-col items-center p-4 md:p-6 space-y-4">
      {gameOver && <GameOverModal 
        winnerName={gameOver.winnerName} 
        onLobby={leaveRoom} 
        nextGameTimer={nextGameTimer}
        />}
      
      <HeaderBar online={onlineCount} showLeaveButton={true} onLeave={leaveRoom} />
      
      {/* --- Top Info Panel --- */}
      <div className="w-full max-w-4xl panel p-4 flex justify-between items-center">
        {/* Warder Info */}
        <div className={`text-center p-3 rounded-lg transition-all ${isWarderTurn ? 'bg-[var(--bg-primary)] ring-4 ring-blue-400' : 'opacity-60'}`}>
            <PlayerIcon role="warder" />
            <p className="font-bold text-lg">{roles.warder}</p>
            <p className="text-sm text-neutral-400">Score: {scores.warder}</p>
        </div>
        
        {/* Timer */}
        <div className="text-center">
            <p className="text-lg font-semibold text-neutral-300">{isWarderTurn ? "Warder's Turn" : "Prisoner's Turn"}</p>
            <p className="text-6xl font-mono font-extrabold text-red-500">{timeLeft}</p>
        </div>

        {/* Prisoner Info */}
        <div className={`text-center p-3 rounded-lg transition-all ${!isWarderTurn ? 'bg-[var(--bg-primary)] ring-4 ring-blue-400' : 'opacity-60'}`}>
            <PlayerIcon role="prisoner" />
            <p className="font-bold text-lg">{roles.prisoner}</p>
            <p className="text-sm text-neutral-400">Score: {scores.prisoner}</p>
        </div>
      </div>
      
      {/* --- Game Board --- */}
      <div className="w-full max-w-lg aspect-square panel p-2">
        <div className="grid grid-cols-5 gap-1.5 h-full">
          {board.flat().map((cell, index) => {
            const r = Math.floor(index / 5);
            const c = index % 5;
            const isWarderPos = positions.warder.r === r && positions.warder.c === c;
            const isPrisonerPos = positions.prisoner.r === r && positions.prisoner.c === c;
            const isMyPos = (playerRole === 'warder' && isWarderPos) || (playerRole === 'prisoner' && isPrisonerPos);
            const isValidMove = validMoves.some(m => m.r === r && m.c === c);

            return (
              <div 
                key={index} 
                onClick={() => isValidMove && sendMove(r, c)}
                className={`cell rounded-md flex items-center justify-center relative transition-all duration-150 bg-[var(--cell-free)]
                  ${isValidMove ? 'bg-green-400/50 hover:bg-green-400/80 cursor-pointer ring-2 ring-green-300' : ''}
                  ${isMyPos ? 'ring-4 ring-yellow-400' : ''}
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
        You are the <strong>{playerRole}</strong>. {isMyTurn ? "It's your turn!" : "Waiting for opponent..."}
      </p>
    </main>
  );
}