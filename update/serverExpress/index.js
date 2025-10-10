const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { /* options */ });

const player = {};

io.on("connection", (socket) => {
    // check
    console.log(socket.id);
    //player name and room number
    socket.on("join_room", ({ name, room }) => {
        player[socket.id] = name

        const clients = io.sockets.adapter.rooms.get(room);
        const count = clients ? clients.size : 0;

        if (count === 0) {
            // first player → tell them to wait
            socket.emit("status", "Waiting for another opponent...");
            socket.join(room);
            player[socket.id] = name
        } else if (count === 1) {
            // second player → tell both players the game can start
            socket.join(room);
            io.to(room).emit("status", "Ready to play!");
            for (const clientId of clients) {
                if (clientId !== socket.id) {
                    // Send the new player's name to the existing one
                    io.to(clientId).emit("opponent", player[socket.id]);

                    // Send the existing player's name to the new one
                    io.to(socket.id).emit("opponent", player[clientId]);
                }
            }
        }
        else if (count === 2) {
            // room full
            socket.emit("status", "Room is full. Please try another room.");
        }
    })


});

httpServer.listen(8000, () => {
    console.log("listening on *:8000");
});