"use client"

import { useEffect, useState } from "react";
import io from "socket.io-client";

let socket;

export default function Home() {
  const [map, setMap] = useState([]);
  const [warder, setWarder] = useState(null);
  const [prisoner, setPrisoner] = useState(null);
  const [winner, setWinner] = useState(null);

  useEffect(() => {
    socket = io("http://localhost:4000");

    socket.on("init", (data) => {
      setMap(data.map);
    });

    socket.on("game-started", ({ map, warder, prisoner }) => {
      setMap(map);
      setWarder(warder);
      setPrisoner(prisoner);
    });

    socket.on("update", ({ warder, prisoner, winner }) => {
      setWarder(warder);
      setPrisoner(prisoner);
      if (winner) setWinner(winner);
    });

    return () => socket.disconnect();
  }, []);

  const startGame = () => {
    socket.emit("start-game");
  };

  const move = (player, x, y) => {
    socket.emit("move", { player, x, y });
  };

  return (
    <div>
      <h1>Escape Plan</h1>
      <button onClick={startGame}>Start Game</button>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 50px)", gap: "5px", marginTop: "10px" }}>
        {map.map((row, i) =>
          row.map((cell, j) => {
            let content = "";
            if (warder?.[0] === i && warder?.[1] === j) content = "W";
            if (prisoner?.[0] === i && prisoner?.[1] === j) content = "P";
            if (cell === "obstacle") content = "X";
            if (cell === "tunnel") content = "T";

            return (
              <div
                key={`${i}-${j}`}
                style={{
                  width: "50px",
                  height: "50px",
                  border: "1px solid black",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: cell === "obstacle" ? "grey" : "white",
                  cursor: "pointer",
                }}
                onClick={() => move("prisoner", i, j)}
              >
                {content}
              </div>
            );
          })
        )}
      </div>
      {winner && <h2>Winner: {winner}</h2>}
    </div>
  );
}
