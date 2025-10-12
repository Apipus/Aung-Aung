'use client';
import { useEffect, useRef, useState } from 'react';
import { socket } from './socket';
import { Button } from '@/components/ui/button';
import GameBoard from '@/components/ui/GameBoard';
import PlayerCard from '@/components/ui/PlayerCard';

export default function ClientPage() {
  const [nickname, setNickname] = useState('');
  const [players, setPlayers] = useState([]);
  const [queue, setQueue] = useState([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [isSpectator, setIsSpectator] = useState(false);
  const [turn, setTurn] = useState('');
  const [timer, setTimer] = useState('');
  const [scoresText, setScoresText] = useState('');
  const [board, setBoard] = useState([]);
  const [positions, setPositions] = useState(null);
  const [myRole, setMyRole] = useState(null);
  const [grid, setGrid] = useState(5);
  const [rolesInfo, setRolesInfo] = useState({ warder: '', prisoner: '' });

  // ✅ Guard so we connect only once per tab, even in React StrictMode (dev)
  const didConnect = useRef(false);

  function formatPlayerScores(list) {
    if (!Array.isArray(list) || list.length === 0) return 'Player Scores — (none yet)';
    return 'Player Scores — ' + list.map(s => `${s.nickname}: ${s.score}`).join(' | ');
  }

  useEffect(() => {
    if (didConnect.current) return;           // don't double-connect
    didConnect.current = true;

    socket.connect();
    socket.emit('client:ready');

    socket.on('server:stats', ({ online }) => setOnlineCount(online));
    socket.on('hello', ({ msg }) => setStatus(msg));
    socket.on('lobby:update', ({ clients, queue }) => {
      setPlayers(clients); 
      setQueue(queue);
      // If you're in the queue and not assigned a role, mark as spectator
      const me = clients.find(c => c.id === socket.id);
      const isInQueue = queue.some(q => q.id === socket.id);
      if (me && isInQueue && !myRole) setIsSpectator(true);
    });
    socket.on('role', ({ role }) => {
      setMyRole(role);
      setRole(`You are: ${role.toUpperCase()}`);
      setIsSpectator(false);
    });
    socket.on('game:start', (payload) => {
      setGrid(payload.grid);
      setBoard(payload.board);
      setPositions(payload.positions);
      setTurn(payload.currentTurn);
      setRolesInfo({ warder: payload.roles.warder, prisoner: payload.roles.prisoner });
      setScoresText(formatPlayerScores(payload.playerScores));
      setStatus('Game started!');
    });
    socket.on('game:state', ({ positions: pos, currentTurn: ct, playerScores }) => {
      setPositions(pos); setTurn(ct);
      setScoresText(formatPlayerScores(playerScores));
    });
    socket.on('turn:tick', ({ remaining }) => setTimer(`Time left: ${remaining}s`));
    socket.on('game:over', ({ winnerRole, winnerName, playerScores }) => {
      alert(`Winner: ${winnerName} (${winnerRole})`);
      setScoresText(formatPlayerScores(playerScores));
      setStatus('Waiting for next game...');
    });
    socket.on('leaderboard:update', ({ playerScores }) =>
      setScoresText(formatPlayerScores(playerScores)));
    socket.on('nickname:error', ({ message }) => alert(message));
    socket.on('nickname:success', ({ nickname }) => console.log(`Nickname set: ${nickname}`));
    socket.on('game:aborted', ({ reason }) => alert(`Game aborted: ${reason}`));
    socket.on('server:reset', ({ playerScores }) => {
      alert('Server reset.'); setScoresText(formatPlayerScores(playerScores));
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      didConnect.current = false;
    };
  }, []);

  const handleJoin = () => {
    if (nickname.trim()) socket.emit('set:nickname', nickname.trim());
  };

  const handleMove = (r, c) => {
    if (isSpectator) return;      // spectators cannot move
    if (!myRole || myRole !== turn) return;
    socket.emit('move', { r, c });
  };

  return (
    <div className="app min-h-screen flex flex-col py-6">
      <h1 className="text-3xl font-bold mb-2">Escape Plan</h1>
      <p className="text-sm text-neutral-600 mb-4">
        Players online (tabs): <span className="font-semibold">{onlineCount}</span>
      </p>
      {isSpectator && (
        <p className="text-sm text-blue-500 font-medium mb-4">
            👀 You are a Spectator — enjoy watching the match!
        </p>
      )}

      <div className="row flex flex-col md:flex-row gap-6 w-full max-w-5xl">
        <div className="panel md:w-1/3 space-y-3 bg p-4 rounded-2xl shadow">
          <label className="text-sm font-medium">Nickname</label>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Your name"
            maxLength={20}
            className="w-full border border-neutral-300 rounded-md px-3 py-1.5 text-sm"
          />
          <Button onClick={handleJoin}>Join</Button>

          <div className="lobby mt-2 space-y-2">
            <h3 className="text-lg font-semibold">Lobby</h3>
            <ul className="text-sm">
              {players.map((p, i) => (<li key={i}>{p.nickname || '(unnamed)'}</li>))}
            </ul>

            <h3 className="text-lg font-semibold">Queue</h3>
            <ol className="text-sm list-decimal list-inside">
              {queue.map((q, i) => (
                <li key={i}>{i === 0 ? 'NEXT — ' : ''}{q.nickname}</li>
              ))}
            </ol>

            <div id="status">{status}</div>
            <div id="role">{role}</div>
            <div id="turn">{turn && `Current turn: ${turn}`}</div>
            <div id="timer">{timer}</div>
            <div id="scores">{scoresText}</div>
          </div>
        </div>

        <div className="boardWrap flex-1">
          <PlayerCard
            warderName={rolesInfo.warder}
            prisonerName={rolesInfo.prisoner}
            currentTurn={turn}
          />
          <GameBoard
            board={board}
            positions={positions}
            grid={grid}
            myRole={myRole}
            turn={turn}
            onMove={handleMove}
          />
        </div>
      </div>
    </div>
  );
}