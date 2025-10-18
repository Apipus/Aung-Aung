'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { socket } from '../socket';
import { Button } from '@/components/button';
import GameBoard from '@/components/GameBoard';
import PlayerCard from '@/components/PlayerCard';
import OptionsMenu from '@/components/OptionsMenu';
import { getNickname } from '@/lib/nickname';

export default function PlayPage() {
  const router = useRouter();

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

  const didConnect = useRef(false);
  const didSetName = useRef(false);

  function formatPlayerScores(list) {
    if (!Array.isArray(list) || list.length === 0) return 'Player Scores — (none yet)';
    return 'Player Scores — ' + list.map(s => `${s.nickname}: ${s.score}`).join(' | ');
  }

  useEffect(() => {
    const nick = getNickname();
    if (!nick) {
      router.replace('/name');
      return;
    }

    if (didConnect.current) return;
    didConnect.current = true;

    socket.connect();
    socket.emit('client:ready');

    const trySetName = () => {
      if (didSetName.current) return;
      const n = getNickname();
      if (n) {
        didSetName.current = true;
        socket.emit('set:nickname', n);
      }
    };

    socket.on('connect', trySetName);
    trySetName();

    socket.on('server:stats', ({ online }) => setOnlineCount(online));
    socket.on('hello', ({ msg }) => setStatus(msg));
    socket.on('lobby:update', ({ clients, queue }) => {
      setPlayers(clients);
      setQueue(queue);
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
    socket.on('game:aborted', ({ reason }) => alert(`Game aborted: ${reason}`));

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      didConnect.current = false;
      didSetName.current = false;
    };
  }, [router, myRole]);

  const handleMove = (r, c) => {
    if (isSpectator) return;
    if (!myRole || myRole !== turn) return;
    socket.emit('move', { r, c });
  };

  return (
    <div className="app min-h-screen flex flex-col py-6">
      <div className="flex justify-between items-center w-full max-w-5xl mb-2">
        <h1 className="text-3xl font-bold">Escape Plan</h1>
        <OptionsMenu />
      </div>

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
          <div className="lobby mt-2 space-y-2">
            <h3 className="text-lg font-semibold">Lobby</h3>
            <ul className="text-sm">
              {players.map((p) => (<li key={p.id}>{p.nickname || '(unnamed)'}</li>))}
            </ul>

            <h3 className="text-lg font-semibold">Queue</h3>
            <ol className="text-sm list-decimal list-inside">
              {queue.map((q, i) => (
                <li key={q.id}>{i === 0 ? 'NEXT — ' : ''}{q.nickname}</li>
              ))}
            </ol>

            <div id="status">{status}</div>
            <div id="role">{role}</div>
            <div id="turn">{turn && `Current turn: ${turn}`}</div>
            <div id="timer">{timer}</div>
            <div id="scores">{scoresText}</div>

            <Button className="mt-3" variant="secondary" onClick={() => router.push('/lobby')}>
              Back to Lobby
            </Button>
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