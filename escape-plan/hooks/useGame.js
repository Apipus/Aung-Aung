'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { socket } from '@/app/socket';
import { getNickname } from '@/lib/nickname';

export function useGame() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = searchParams.get('room');
  const nickname = getNickname();

  // Game State
  const [gameState, setGameState] = useState(null);
  const [playerRole, setPlayerRole] = useState(null);
  const [timeLeft, setTimeLeft] = useState(10);
  const [scores, setScores] = useState({ warder: 0, prisoner: 0 });
  const [gameOver, setGameOver] = useState(null);
  const [nextGameTimer, setNextGameTimer] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Connecting to room...');
  const [onlineCount, setOnlineCount] = useState(0);

  const didConnect = useRef(false);
  
  // *** FIX 1: Create a ref to hold the game state ***
  // This lets event handlers read the current state without
  // needing to be in the useEffect dependency array.
  const gameStateRef = useRef(gameState);

  // *** FIX 2: Create a synchronized setter ***
  // This function updates both the React state and the ref at the same time.
  const setGameStateAndRef = (newState) => {
    if (typeof newState === 'function') {
      setGameState(prevState => {
        const finalState = newState(prevState);
        gameStateRef.current = finalState;
        return finalState;
      });
    } else {
      gameStateRef.current = newState;
      setGameState(newState);
    }
  };


  // Memoize actions
  const sendMove = useCallback((r, c) => socket.emit('move', { r, c }), []);
  const leaveRoom = useCallback(() => {
    socket.emit('room:leave');
    router.push('/lobby');
  }, [router]);

  useEffect(() => {
    if (!roomId || !nickname) {
      router.replace('/lobby');
      return;
    }

    if (didConnect.current) return;
    didConnect.current = true;

    // --- Helper to update local scores ---
    const updateScores = (allScores, roles) => {
        if (!roles || !allScores) return;
        const warderScore = allScores.find(s => s.nickname === roles.warder)?.score || 0;
        const prisonerScore = allScores.find(s => s.nickname === roles.prisoner)?.score || 0;
        setScores({ warder: warderScore, prisoner: prisonerScore });
    };

    // --- Event Listeners ---
    const onGameStart = (initialGameState) => {
      setStatusMessage('Game starting!');
      setGameStateAndRef(initialGameState); // Use the sync'd setter
      updateScores(initialGameState.playerScores, initialGameState.roles);
      setTimeLeft(initialGameState.turnSeconds || 10);
      setGameOver(null);
      setNextGameTimer(0);
    };

    const onGameState = (newState) => {
      setGameStateAndRef(prevState => { // Use the sync'd setter
        if (!prevState) return null; // Wait for onGameStart
        const updatedState = { ...prevState, ...newState };
        updateScores(newState.playerScores, updatedState.roles);
        return updatedState;
      });
    };
    
    const onTurnTick = ({ remaining }) => setTimeLeft(remaining);
    const onRole = ({ role }) => setPlayerRole(role);
    
    const onRoomCountdown = ({ remaining }) => { 
      setNextGameTimer(remaining);

      if (!gameStateRef.current) {
        setStatusMessage(`Next player joined! Starting in ${remaining}...`);
      }
    };

    // When an opponent leaves but you stay in the room, clear board and show waiting
    const onGameClear = () => {
      setGameStateAndRef(null);
      setGameOver(null);
      setNextGameTimer(0);
      setStatusMessage('Opponent left. Waiting for next player...');
    };

    const onGameOver = (result) => {
        // *** FIX 3: Read from the ref, not the state variable ***
        const roles = gameStateRef.current?.roles;
        updateScores(result.playerScores, roles);
        setGameOver(result);

        if (result.nextGameIn) {
          setNextGameTimer(result.nextGameIn);
        }

        setStatusMessage(`Game Over! ${result.winnerName} wins. Next round starting soon...`);
    };

    const onGameAborted = ({ reason }) => {
        alert(`Game Aborted: ${reason || 'The other player left.'}`);
        router.replace('/lobby');
    };
    
    const onServerReset = () => {
        alert("Server was reset by admin. Returning to lobby.");
        router.replace('/lobby');
    };

  const onAdminReset = ({ message }) => {
    alert(message || 'Admin reset the server. Returning to lobby.');
    router.replace('/lobby');
  };

    const onAdminKick = () => {
      alert('You were kicked by an admin. Returning to lobby.');
      // Send user back to the lobby so UI/timers are cleared
      router.replace('/lobby');
    };
    
    const onStats = ({ online }) => setOnlineCount(online);


    socket.on('game:start', onGameStart);
    socket.on('game:state', onGameState);
    socket.on('turn:tick', onTurnTick);
    socket.on('role', onRole);
    socket.on('room:countdown', onRoomCountdown);
  socket.on('game:over', onGameOver);
  socket.on('game:clear', onGameClear);
    socket.on('game:aborted', onGameAborted);
    socket.on('server:reset', onServerReset);
    socket.on('admin:reset', onAdminReset);
  socket.on('admin:kick', onAdminKick);
    socket.on('server:stats', onStats); // Listen for online count

    const onConnect = () => {
      socket.emit('set:nickname', nickname); 
      if (roomId) socket.emit('game:get', { roomId });
      setStatusMessage('Waiting for another player to join...');
    };
    
    if (socket.connected) onConnect();
    else socket.on('connect', onConnect);
    
    if (!socket.connected) socket.connect();

    return () => {
      socket.off('game:start', onGameStart);
      socket.off('game:state', onGameState);
      socket.off('turn:tick', onTurnTick);
      socket.off('role', onRole);
      socket.off('room:countdown', onRoomCountdown);
  socket.off('game:over', onGameOver);
  socket.off('game:clear', onGameClear);
      socket.off('game:aborted', onGameAborted);
      socket.off('server:reset', onServerReset);
    socket.off('admin:reset', onAdminReset);
  socket.off('admin:kick', onAdminKick);
      socket.off('server:stats', onStats);
      socket.off('connect', onConnect);
      didConnect.current = false;
    };
    
    // *** FIX 4: Remove the 'gameState.roles' dependency ***
  }, [roomId, nickname, router]);

  const isMyTurn = gameState?.currentTurn === playerRole;

  return { gameState, playerRole, timeLeft, scores, gameOver, statusMessage, isMyTurn, onlineCount, nextGameTimer, sendMove, leaveRoom };
}