"use client";
import { useEffect, useState } from "react";
import { socket } from "./socket";
import { Button } from "@/components/ui/button";

export default function ClientPage() {
  const [nickname, setNickname] = useState("");
  const [players, setPlayers] = useState([]);
  const [queue, setQueue] = useState([]);
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  const [turn, setTurn] = useState("");
  const [timer, setTimer] = useState("");
  const [scoresText, setScoresText] = useState("");
  const [board, setBoard] = useState([]);
  const [positions, setPositions] = useState(null);
  const [myRole, setMyRole] = useState(null);
  const [grid, setGrid] = useState(5);

  function formatPlayerScores(list) {
    if (!Array.isArray(list) || list.length === 0)
      return "Player Scores — (none yet)";
    return (
      "Player Scores — " +
      list.map((s) => `${s.nickname}: ${s.score}`).join(" | ")
    );
  }

  useEffect(() => {
    socket.emit("client:ready");

    socket.on("hello", ({ msg }) => setStatus(msg));

    socket.on("nickname:error", ({ message }) => {
      alert(message);
    });

    socket.on("nickname:success", ({ nickname }) => {
      console.log(`Nickname set: ${nickname}`);
    });

    socket.on("lobby:update", ({ clients, queue }) => {
      setPlayers(clients);
      setQueue(queue);
    });

    socket.on("role", ({ role }) => {
      setMyRole(role);
      setRole(`You are: ${role.toUpperCase()}`);
    });

    socket.on("game:start", (payload) => {
      setGrid(payload.grid);
      setBoard(payload.board);
      setPositions(payload.positions);
      setTurn(payload.currentTurn);
      setScoresText(formatPlayerScores(payload.playerScores));
      setStatus("Game started!");
    });

    socket.on(
      "game:state",
      ({ positions: pos, currentTurn: ct, deadlineTs: dl, playerScores }) => {
        setPositions(pos);
        setTurn(ct);
        setScoresText(formatPlayerScores(playerScores));
      }
    );

    socket.on("turn:tick", ({ remaining }) => {
      setTimer(`Time left: ${remaining}s`);
    });

    socket.on("game:over", ({ winnerRole, winnerName, playerScores }) => {
      alert(`Winner: ${winnerName} (${winnerRole})`);
      setScoresText(formatPlayerScores(playerScores));
      setStatus("Waiting for next game...");
    });

    socket.on("leaderboard:update", ({ playerScores }) => {
      setScoresText(formatPlayerScores(playerScores));
    });

    socket.on("game:aborted", ({ reason }) => {
      alert(`Game aborted: ${reason}`);
    });

    socket.on("server:reset", ({ playerScores }) => {
      alert("Server reset.");
      setScoresText(formatPlayerScores(playerScores));
    });

    return () => socket.removeAllListeners();
  }, []);

  const handleJoin = () => {
    if (nickname.trim()) {
      socket.emit("set:nickname", nickname.trim());
    }
  };

  const handleMove = (r, c) => {
    if (!myRole || myRole !== turn) return;
    socket.emit("move", { r, c });
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
                <li key={i}>{p.nickname || "(unnamed)"}</li>
              ))}
            </ul>

            <h3>Queue</h3>
            <ol>
              {queue.map((q, i) => (
                <li key={i}>
                  {i === 0 ? "NEXT — " : ""}
                  {q.nickname}
                </li>
              ))}
            </ol>

            <div id="status">{status}</div>
            <div id="role">{role}</div>
            <div id="turn">{turn && `Current turn: ${turn}`}</div>
            <div id="timer">{timer}</div>
            <div id="scores">{scoresText}</div>
          </div>
        </div>

        <div className="boardWrap">
          <div
            className={`board ${myRole === turn ? "myturn" : ""}`}
            style={{ "--grid": grid }}
          >
            {board.map((row, r) =>
              row.map((cell, c) => {
                const isWarder =
                  positions?.warder?.r === r && positions?.warder?.c === c;
                const isPrisoner =
                  positions?.prisoner?.r === r && positions?.prisoner?.c === c;

                let classes = "cell";
                if (cell.type === "obstacle") classes += " obstacle";
                if (cell.type === "tunnel") classes += " tunnel";

                return (
                  <div
                    key={`${r}-${c}`}
                    className={classes}
                    onClick={() => handleMove(r, c)}
                  >
                    {isWarder && <span className="piece">🔒</span>}
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
