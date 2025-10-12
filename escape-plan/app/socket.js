// app/socket.js
import { io } from 'socket.io-client';

const SERVER_URL = 'http://localhost:8000'; // http://192.168.1.105:8000'

// One socket instance per tab
export const socket = io(SERVER_URL, {
  autoConnect: false,            // we'll connect manually
  transports: ['websocket'],     // avoid extra long-polling connects
});