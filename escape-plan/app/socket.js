// escape-plan/app/socket.js
import { io } from "socket.io-client";

// Prefer an env var. Otherwise, match the browser's host (works on localhost and LAN IPs).
const DEFAULT_HOST =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : "http://localhost:8000";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || DEFAULT_HOST;

export const socket = io(SERVER_URL, {
  autoConnect: false,
  // Let Socket.IO choose transports (websocket + fallback) for reliability
  // Remove the line below if you previously forced ['websocket'].
  // transports: ['websocket'],
});