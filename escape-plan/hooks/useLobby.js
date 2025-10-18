'use client';

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { socket } from "@/app/socket";
import { getNickname } from "@/lib/nickname";

export function useLobby() {
  const router = useRouter();
  const [online, setOnline] = useState(0);
  const [rooms, setRooms] = useState([]);
  const [welcome, setWelcome] = useState("");

  const didConnect = useRef(false);
  const didName = useRef(false);

  useEffect(() => {
    const nick = getNickname();
    if (!nick) {
      router.replace("/name");
      return;
    }
    setWelcome(`WELCOME, ${nick}`);

    if (didConnect.current) return;
    didConnect.current = true;

    socket.connect();
    socket.emit("client:ready");

    const tryName = () => {
      if (didName.current) return;
      const n = getNickname();
      if (n) {
        didName.current = true;
        socket.emit("set:nickname", n);
      }
    };
    socket.on("connect", tryName);
    tryName();

    socket.on("server:stats", ({ online }) => setOnline(online));
    socket.on("room:list", ({ rooms }) => setRooms(rooms));
    socket.on("room:joined", ({ roomId }) => router.push(`/play?room=${roomId}`));
    socket.on("game:start",   ({ roomId }) => router.push(`/play?room=${roomId}`));

    socket.emit("room:list");

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      didConnect.current = false;
      didName.current = false;
    };
  }, [router]);

  const requestRooms = useCallback(() => socket.emit("room:list"), []);
  const joinRoom     = useCallback((roomId) => socket.emit("room:join",   { roomId }), []);
  const createRoom   = useCallback((name, mapKey) => socket.emit("room:create", { name, mapKey }), []);

  return { online, rooms, welcome, requestRooms, joinRoom, createRoom };
}