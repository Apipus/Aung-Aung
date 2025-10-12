'use client'
import { socket } from "../socket";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

export default function AdminPage() {
    const [count,setCount] = useState(0);
    
    const didConnect = useRef(false);
    useEffect(()=>{
        if (didConnect.current) return;
        didConnect.current = true;
        socket.connect();
        socket.emit('client:ready');
        socket.on('server:stats', ({ online }) => {
            setCount(online);
            console.log("Online players: ", online);
        });
        return()=>{
            sockey.disconnect();
            didConnect.current = false;
        };
    }, [])

    async function resetGame(){
        const res = await fetch('http://localhost:8000/reset', { method: 'POST' });
        if (res.ok) {
            console.log("Game reset successfully");
        } else {
            console.error("Failed to reset game");
        }
    };

    return (
        <>
            <h1>Escape Plan Admin</h1>
            <p>Online clients: {count}</p>
            <Button onClick={resetGame}>Reset Game & Scores</Button>
        </>
    )
}
