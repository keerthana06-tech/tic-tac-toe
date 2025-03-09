const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

let rooms = {};

io.on('connection', (socket) => {
    console.log(`A user connected: ${socket.id}`);

    socket.on('createRoom', (roomID) => {
        if (!rooms[roomID]) {
            rooms[roomID] = {
                players: [socket.id],
                board: Array(9).fill(null),
                currentPlayer: 'X',
                gameActive: true,
            };
            socket.join(roomID);
            socket.emit('roomCreated', roomID);
            console.log(`Room ${roomID} created by ${socket.id}`);
        } else {
            socket.emit('error', 'Room already exists.');
        }
    });

    socket.on('joinRoom', (roomID) => {
        const room = rooms[roomID];
        if (room && room.players.length === 1) {
            room.players.push(socket.id);
            socket.join(roomID);
            socket.emit('roomJoined', roomID);
            io.to(roomID).emit('startGame', room.board);
            console.log(`User ${socket.id} joined room ${roomID}`);
        } else {
            socket.emit('error', 'Room is full or does not exist.');
        }
    });

    socket.on('makeMove', ({ roomID, index }) => {
        const room = rooms[roomID];
        if (room && room.gameActive && room.board[index] === null) {
            room.board[index] = room.currentPlayer;
            io.to(roomID).emit('moveMade', { index, player: room.currentPlayer });
            if (checkWinner(room.board)) {
                room.gameActive = false;
                io.to(roomID).emit('gameOver', `${room.currentPlayer} wins!`);
            } else if (!room.board.includes(null)) {
                room.gameActive = false;
                io.to(roomID).emit('gameOver', 'Draw!');
            } else {
                room.currentPlayer = room.currentPlayer === 'X' ? 'O' : 'X';
            }
        }
    });

    socket.on('disconnect', () => {
        console.log(`A user disconnected: ${socket.id}`);
        for (const roomID in rooms) {
            const room = rooms[roomID];
            if (room.players.includes(socket.id)) {
                room.players = room.players.filter((id) => id !== socket.id);
                if (room.players.length === 0) {
                    delete rooms[roomID];
                    console.log(`Room ${roomID} deleted due to inactivity.`);
                } else {
                    io.to(roomID).emit('playerDisconnected', 'Your opponent has left the game.');
                }
                break;
            }
        }
    });
});

function checkWinner(board) {
    const winningCombinations = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6],
    ];

    return winningCombinations.some((combination) => {
        const [a, b, c] = combination;
        return board[a] && board[a] === board[b] && board[a] === board[c];
    });
}

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
