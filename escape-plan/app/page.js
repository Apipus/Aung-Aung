'use client';
import { useEffect, useState } from 'react';
import { socket } from './socket';
import { Button } from '@/components/ui/button';

export default function ClientPage() {
    const [nickname, setNickname] = useState('');
    const [players, setPlayers] = useState([]);
    const [queue, setQueue] = useState([]);
    const [status, setStatus] = useState('');
    const [role, setRole] = useState('');
    const [turn, setTurn] = useState('');
    const [timer, setTimer] = useState('');
    const [scores, setScores] = useState('');
    const [board, setBoard] = useState([]);
    const [positions, setPositions] = useState(null);
    const [myRole, setMyRole] = useState(null);
    const [grid, setGrid] = useState(5);

    useEffect(() => {
        // Event listeners
        socket.emit('client:ready');
        console.log("Setting up socket listeners");
        socket.on('hello', ({ msg }) => setStatus(msg));

        socket.on('lobby:update', ({ clients, queue }) => {
            setPlayers(clients);
            setQueue(queue);
        });

        socket.on('role', ({ role }) => {
            setMyRole(role);
            setRole(`You are: ${role.toUpperCase()}`);
        });

        socket.on('game:start', (payload) => {
            setGrid(payload.grid);
            setBoard(payload.board);
            setPositions(payload.positions);
            setTurn(payload.currentTurn);
            setScores(`Scores — Warden: ${payload.scores.warden} | Prisoner: ${payload.scores.prisoner}`);
            setStatus('Game started!');
        });

        socket.on('game:state', ({ positions: pos, currentTurn: ct, deadlineTs: dl, scores }) => {
            setPositions(pos);
            setTurn(ct);
            setScores(`Scores — Warden: ${scores.warden} | Prisoner: ${scores.prisoner}`);
        });

        socket.on('turn:tick', ({ remaining }) => {
            setTimer(`Time left: ${remaining}s`);
        });

        socket.on('game:over', ({ winnerRole, winnerName, scores }) => {
            alert(`Winner: ${winnerName} (${winnerRole})`);
            setScores(`Scores — Warden: ${scores.warden} | Prisoner: ${scores.prisoner}`);
            setStatus('Waiting for next game...');
        });

        socket.on('game:aborted', ({ reason }) => {
            alert(`Game aborted: ${reason}`);
        });

        socket.on('server:reset', ({ scores }) => {
            alert('Server reset.');
            setScores(`Scores — Warden: ${scores.warden} | Prisoner: ${scores.prisoner}`);
        });

        return () => socket.removeAllListeners();
    }, []);

    const handleJoin = () => {
        if (nickname.trim()) {
            socket.emit('set:nickname', nickname.trim());
        }
    };

    const handleMove = (r, c) => {
        if (!myRole || myRole !== turn) return;
        socket.emit('move', { r, c });
    };

    return (
        <div className="app">
            <h1>Escape Plan</h1>
            <div className="row">
                <div className="panel">
                    <label>Nickname</label>
                    <input
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        placeholder="Your name"
                        maxLength={20}
                    />
                    <Button onClick={handleJoin}>Join</Button>

                    <div className="lobby mt-2">
                        <h3>Lobby</h3>
                        <ul>
                            {players.map((p, i) => (
                                <li key={i}>{p.nickname || '(unnamed)'}</li>
                            ))}
                        </ul>

                        <h3>Queue</h3>
                        <ol>
                            {queue.map((q, i) => (
                                <li key={i}>
                                    {i === 0 ? 'NEXT — ' : ''}
                                    {q.nickname}
                                </li>
                            ))}
                        </ol>

                        <div id="status">{status}</div>
                        <div id="role">{role}</div>
                        <div id="turn">{turn && `Current turn: ${turn}`}</div>
                        <div id="timer">{timer}</div>
                        <div id="scores">{scores}</div>
                    </div>
                </div>

                <div className="boardWrap">
                    <div
                        className={`board ${myRole === turn ? 'myturn' : ''}`}
                        style={{ '--grid': grid }}
                    >
                        {board.map((row, r) =>
                            row.map((cell, c) => {
                                const isWarden = positions?.warden?.r === r && positions?.warden?.c === c;
                                const isPrisoner = positions?.prisoner?.r === r && positions?.prisoner?.c === c;

                                let classes = 'cell';
                                if (cell.type === 'obstacle') classes += ' obstacle';
                                if (cell.type === 'tunnel') classes += ' tunnel';

                                return (
                                    <div
                                        key={`${r}-${c}`}
                                        className={classes}
                                        onClick={() => handleMove(r, c)}
                                    >
                                        {isWarden && <span className="piece">🔒</span>}
                                        {isPrisoner && <span className="piece">🧍</span>}
                                    </div>
                                );
                            })
                        )}
                    </div>
                    <p className="hint">Click an adjacent cell on your turn to move.</p>
                </div>
            </div>
        </div>
    );
}
