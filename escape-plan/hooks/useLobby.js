'use client';

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { socket } from "@/app/socket"; // Make sure socket.js is in app/
import { getNickname, clearNickname } from "@/lib/nickname";

export function useLobby() {
  const router = useRouter();
  const [online, setOnline] = useState(0);
  const [rooms, setRooms] = useState([]);
  const [welcome, setWelcome] = useState("");

  const didConnect = useRef(false);

  // Define action functions using useCallback
  const requestRooms = useCallback(() => socket.emit("room:list"), []);
  const joinRoom = useCallback((roomId) => socket.emit("room:join", { roomId }), []);
  const createRoom = useCallback((name) => socket.emit("room:create", { name }), []);

useEffect(() => {
    const nick = getNickname();
    if (!nick) {
      router.replace("/name");
      return;
    }
    setWelcome(`WELCOME, ${nick}`);

    if (didConnect.current) return;
    didConnect.current = true;

    // --- 1. Define Listeners FIRST ---
    const onStats = ({ online }) => setOnline(online);
    const onRooms = ({ rooms }) => setRooms(rooms || []);
    const onJoined = ({ roomId }) => router.push(`/play?room=${roomId}`);
    const onQueued = ({ roomId, position }) => {
      alert(`Room is busy. You are queued at position #${position}. You'll join automatically when it's your turn.`);
      // Optional: refresh room list to see updated queue counts
      requestRooms();
    };
    const onRoomError = ({ message }) => {
      alert(message || 'Unable to join the room.');
    };
    
    // Error handling
    const onNicknameError = ({ message }) => {
      alert(`Nickname Error: ${message}\nPlease choose another.`);
      clearNickname();
      router.replace("/name");
    };
    const onGameAborted = ({ reason }) => {
      alert(`Game Aborted: ${reason || 'A player disconnected.'}`);
      // This will force a refresh of the lobby
      requestRooms();
    };
    const onServerReset = () => {
      alert("Server has been reset!");
      window.location.reload();
    };
    const onAdminReset = ({ message }) => {
      alert(message || 'Admin reset the server. Returning to lobby.');
      // Force a reload to ensure UI and local state are cleared
      window.location.reload();
    };
    const onAdminKick = () => {
      alert("You were kicked by an admin.");
      clearNickname();
      router.replace("/name");
    };

    socket.on("server:stats", onStats);
    socket.on("room:list", onRooms);
    socket.on("room:joined", onJoined);
    // New: queue + error notifications
    socket.on("room:queued", onQueued);
    socket.on("room:error", onRoomError);
    socket.on("nickname:error", onNicknameError);
    socket.on("game:aborted", onGameAborted);
    socket.on("server:reset", onServerReset);
  socket.on("admin:reset", onAdminReset);
    socket.on("admin:kick", onAdminKick);

    // --- 2. Define Connection Handler ---
    const onConnect = () => {
      console.log("Lobby: Socket connected!");
      // 1. Identify the client
      socket.emit("set:nickname", nick);
      // 2. Request initial room list
      requestRooms();
    };
    
    socket.on("connect", onConnect); 

    // --- 3. Connect (or run handler if already connected) ---
    // This handles returning from the /play page
    if (socket.connected) {
      console.log("Lobby: Socket already connected.");
      onConnect();
    } else {
      socket.connect(); // Initiate connection
    }

    // --- 4. Cleanup ---
    return () => {
      // Cleanup ONLY listeners. DO NOT DISCONNECT.
    socket.off("server:stats", onStats);
    socket.off("room:list", onRooms);
    socket.off("room:joined", onJoined);
    socket.off("room:queued", onQueued);
    socket.off("room:error", onRoomError);
      socket.off("nickname:error", onNicknameError);
      socket.off("game:aborted", onGameAborted);
      socket.off("server:reset", onServerReset);
    socket.off("admin:reset", onAdminReset);
      socket.off("admin:kick", onAdminKick);
      socket.off("connect", onConnect);

      didConnect.current = false;
    };
  }, [router, requestRooms]);

  // 'resetServer' function has been removed

  return { online, rooms, welcome, requestRooms, joinRoom, createRoom };
}