'use client'
import { socket } from "../socket";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/button"; // Assuming this is your button path
import Image from "next/image";

export default function AdminPage() {
    // Simple admin auth: the correct answer is 'Iamadmin'
    const [isAuthed, setIsAuthed] = useState(() => {
        try { return sessionStorage.getItem('isAdminAuthenticated') === '1'; } catch (e) { return false; }
    });
    const [authAttempt, setAuthAttempt] = useState('');
    const [authError, setAuthError] = useState(null);

    const [online, setOnline] = useState(0);
    const [clients, setClients] = useState([]);
    const [rooms, setRooms] = useState([]); // <-- Changed from queue
    const [leaderboard, setLeaderboard] = useState([]);
    const didConnect = useRef(false);

    // Only connect the socket when authenticated. This prevents non-admins from opening a socket.
    useEffect(() => {
        if (!isAuthed) return;
        if (didConnect.current) return;
        didConnect.current = true;

        socket.connect();
        socket.emit("client:ready");

        socket.on("server:stats", ({ online, clients }) => {
            setOnline(online);
            setClients(clients || []);
        });

        // Listen for room list instead of lobby:update
        socket.on("room:list", ({ rooms }) => {
            setRooms(rooms || []);
        });

        // Leaderboard updates
        socket.on('leaderboard:update', ({ playerScores }) => {
            setLeaderboard(playerScores || []);
        });
        socket.on('server:reset', ({ playerScores }) => {
            setLeaderboard(playerScores || []);
        });
        socket.on('admin:reset', ({ message, playerScores }) => {
            // Show a prominent notice on the admin UI and update leaderboard
            if (message) alert(message);
            setLeaderboard(playerScores || []);
        });

        // Simple way to track active games
        socket.on("game:start", () => socket.emit("client:ready"));
        socket.on("game:over", () => socket.emit("client:ready"));

        // Fetch initial leaderboard once
        fetch('http://localhost:8000/leaders')
            .then(res => res.json())
            .then((data) => setLeaderboard(data.playerScores || []))
            .catch(() => setLeaderboard([]));

        return () => {
            socket.disconnect();
            didConnect.current = false;
        };
    }, [isAuthed]);

    async function resetGame() {
        const confirmReset = confirm("This will reset all rooms and clear all scores. Continue?");
        if (!confirmReset) return;
        try {
            const res = await fetch("http://localhost:8000/reset", { method: "POST" });
            if (res.ok) alert("Game reset successfully!");
            else alert("Failed to reset game.");
        } catch (e) {
            console.error('Reset failed', e);
            alert('Reset failed. See console.');
        }
    }

    async function kickPlayer(id) {
        const confirmKick = confirm("Kick this player?");
        if (!confirmKick) return;
        try {
            await fetch(`http://localhost:8000/kick/${id}`, { method: "POST" });
        } catch (e) {
            console.error("Failed to kick:", e);
        }
    }

    async function terminateRoom(roomId) {
        const confirmTerm = confirm("Terminate this room? This will return all players to the lobby and delete the room.");
        if (!confirmTerm) return;
        try {
            const res = await fetch(`http://localhost:8000/room/terminate/${roomId}`, { method: "POST" });
            if (!res.ok) throw new Error('Failed to terminate room');
        } catch (e) {
            console.error("Failed to terminate room:", e);
        }
    }

    async function sha256Hex(str) {
        const enc = new TextEncoder();
        const data = enc.encode(str);
        const hashBuffer = await (window.crypto && window.crypto.subtle ? window.crypto.subtle.digest('SHA-256', data) : Promise.reject(new Error('SubtleCrypto not available')));
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async function tryAuth(e) {
        e && e.preventDefault();
        setAuthError(null);
        const attempt = ('' + authAttempt).trim();
        if (!attempt) { setAuthError('Please answer the question.'); return; }

        try {
            // The secret is reconstructed from char codes so the plain string doesn't appear verbatim in source
            const secretCodes = [73,97,109,97,100,109,105,110]; // 'Iamadmin'
            const secret = String.fromCharCode(...secretCodes);
            const expectedHash = await sha256Hex(secret);
            const attemptHash = await sha256Hex(attempt);
            if (attemptHash === expectedHash) {
                try { sessionStorage.setItem('isAdminAuthenticated', '1'); } catch (e) {}
                setIsAuthed(true);
                setAuthAttempt('');
                setAuthError(null);
                return;
            }
        } catch (err) {
            console.warn('Auth hash check failed', err);
            setAuthError('Auth failed (crypto error)');
            return;
        }

        setAuthError('Incorrect answer.');
    }

    function logout() {
        try { sessionStorage.removeItem('isAdminAuthenticated'); } catch (e) {}
        setIsAuthed(false);
        // disconnect socket if connected
        try { socket.disconnect(); } catch (e) {}
        didConnect.current = false;
    }

    // The 'activeGame' state is removed as we now support multiple games

    if (!isAuthed) {
        return (
            <main className="min-h-screen flex flex-col items-center justify-center p-6 -translate-y-10 text-[var(--text-primary)]">
                <div className="p-6 space-y-4 bg-[var(--bg-secondary)] rounded-2xl border border-[#959595] w-full max-w-xl">
                    <h1 className="text-2xl font-bold">Admin Access</h1>
                    <p className="text-sm">Before entering, answer the question:</p>
                    <p className="italic font-medium">"Who are you ?"</p>
                    <form onSubmit={tryAuth} className="space-y-3">
                        <input
                            autoFocus
                            value={authAttempt}
                            onChange={(e) => setAuthAttempt(e.target.value)}
                            className="w-full p-2 rounded border bg-[var(--bg-primary)]"
                            placeholder="Your answer"
                        />
                        {authError && (<p className="text-sm text-red-400">{authError}</p>)}
                        <div className="flex gap-2">
                            <Button
                                type="submit"
                                className="w-1/2 bg-white hover:bg-[var(--accent)] hover:text-[var(--bg-primary)] text-base font-extrabold text-[var(--text-primary)] border-b-4 shadow-xs active:scale-95 transition"
                            >
                                Enter
                            </Button>
                            <button type="button" onClick={() => { setAuthAttempt(''); setAuthError(null); }} className="px-4 py-2 rounded bg-gray-500 text-white">Clear</button>
                        </div>
                        <p className="text-xs text-slate-400">Hint: case-sensitive.</p>
                    </form>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen flex flex-col items-center justify-center p-6 -translate-y-10 text-[var(--text-primary)]">

            <div className="relative">
                <h1 className="holtwood-title text-4xl font-extrabold">Admin Panel</h1>
                <Image
                    src="/crown.png"
                    alt="Crown"
                    width={90}
                    height={90}
                    priority // ensures it loads early for good LCP
                    unoptimized // disable optimization for GIF animation
                    className="absolute -top-11 -left-11 rounded-lg"
                />
            </div>

            <div className="p-6 space-y-4 bg-[var(--bg-secondary)] rounded-2xl border border-[#959595] w-full max-w-4xl">
                <div className="flex justify-end mb-2 space-x-2">
                    <Button
                        variant="destructive"
                        onClick={resetGame}
                        className="bg-red-600 hover:bg-red-700"
                    >
                        Hard Reset (kick all)
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={logout}
                        className="bg-gray-600 hover:bg-gray-700"
                    >
                        Logout
                    </Button>
                </div>
                <h2 className="text-xl font-semibold">Online clients ({online})</h2>
                <section className="space-y-2">
                    <h2 className="text-xl font-semibold">Active Rooms ({rooms.length})</h2>
                    {rooms.length > 0 ? (
                        <ul className="border rounded-lg p-2 space-y-1 bg-[var(--bg-primary)]">
                            {rooms.map((room) => (
                                <li key={room.id} className="border-b p-2">
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p><strong>Room:</strong> {room.name}</p>
                                                <p><strong>ID:</strong> {room.id}</p>
                                                <p><strong>Status:</strong> {room.isPlaying ? "In Game" : "Waiting"}</p>
                                                <p><strong>Players:</strong> ({room.playerCount}/2)</p>
                                            </div>
                                            <div className="flex flex-col items-end space-y-2">
                                                <Button
                                                    variant="destructive"
                                                    onClick={() => terminateRoom(room.id)}
                                                    className="bg-red-600 hover:bg-red-700"
                                                >
                                                    Terminate Room
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="border rounded-lg overflow-hidden w-full">
                                            <table className="w-full text-sm">
                                                    <thead className="bg-[var(--bg-secondary)] border-b border-[#959595]">
                                                        <tr>
                                                            <th className="px-3 py-2 text-left font-semibold">Name</th>
                                                            <th className="px-3 py-2 text-left font-semibold">ID</th>
                                                            <th className="px-3 py-2 text-center font-semibold">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {room.players.map((pName) => {
                                                            const clientObj = clients.find(c => c.nickname === pName);
                                                            return (
                                                                <tr key={pName} className="border-b border-[#959595] last:border-b-0 hover:bg-[var(--bg-secondary)] transition-colors">
                                                                    <td className="px-3 py-2">
                                                                        <strong>{pName}</strong>
                                                                    </td>
                                                                    <td className="px-3 py-2 font-mono text-xs">
                                                                        {clientObj ? clientObj.id : 'N/A'}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-center">
                                                                        {clientObj && (
                                                                            <Button
                                                                                variant="destructive"
                                                                                size="sm"
                                                                                onClick={() => kickPlayer(clientObj.id)}
                                                                                className="text-xs"
                                                                            >
                                                                                🗑️ Kick
                                                                            </Button>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-slate-400">No active rooms.</p>
                    )}
                </section>

                <section className="space-y-2">
                    <h2 className="text-xl font-semibold">🏆 Leaderboard ({leaderboard.length})</h2>
                    <div className="border rounded-lg overflow-hidden bg-[var(--bg-primary)]">
                        <table className="w-full">
                            <thead className="bg-[var(--bg-secondary)] border-b border-[#959595]">
                                <tr>
                                    <th className="px-4 py-3 text-left font-semibold w-16">#</th>
                                    <th className="px-4 py-3 text-left font-semibold">Name</th>
                                    <th className="px-4 py-3 text-right font-semibold w-32">Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leaderboard.length > 0 ? (
                                    leaderboard.map((p, idx) => (
                                        <tr key={`${p.nickname}-${idx}`} className="border-b border-[#959595] last:border-b-0 hover:bg-[var(--bg-secondary)] transition-colors">
                                            <td className="px-4 py-3">{idx + 1}</td>
                                            <td className="px-4 py-3 font-bold">{p.nickname}</td>
                                            <td className="px-4 py-3 text-right font-mono">{p.score}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="3" className="px-4 py-3 text-center text-slate-400">No scores yet</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="space-y-2">
                    <h2 className="text-xl font-semibold">👥 Connected Players ({clients.length})</h2>
                    <div className="border rounded-lg overflow-hidden bg-[var(--bg-primary)]">
                        <table className="w-full">
                            <thead className="bg-[var(--bg-secondary)] border-b border-[#959595]">
                                <tr>
                                    <th className="px-4 py-3 text-left font-semibold">Name</th>
                                    <th className="px-4 py-3 text-left font-semibold">ID</th>
                                </tr>
                            </thead>
                            <tbody>
                                {clients.length > 0 ? (
                                    clients.map((c) => (
                                        <tr key={c.id} className="border-b border-[#959595] last:border-b-0 hover:bg-[var(--bg-secondary)] transition-colors">
                                            <td className="px-4 py-3">
                                                <strong>{c.nickname || "unnamed"}</strong>
                                            </td>
                                            <td className="px-4 py-3 font-mono text-sm">
                                                {c.id}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="2" className="px-4 py-3 text-center text-slate-400">
                                            No connected players
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </main>
    );
}