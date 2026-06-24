// ═══════════════════════════════════════════════════════
// PROJECT PLAYTIME — SERVER
// npm install express socket.io
// node server.js
// ═══════════════════════════════════════════════════════
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST'] }
});

app.use(express.static(path.join(__dirname)));
app.get('/', (req,res)=>res.sendFile(path.join(__dirname,'index.html')));

// rooms[code] = { players: [{id, name, ready}], host: socketId }
const rooms = {};

io.on('connection', socket => {
  console.log('+ connected:', socket.id);

  socket.on('joinRoom', ({code, name, isHost}) => {
    code = code.toUpperCase();
    socket.join(code);
    socket.data = {code, name};

    if(!rooms[code]) rooms[code] = {players:[], host: socket.id};
    rooms[code].players.push({id: socket.id, name, ready: false});

    // Tell others
    socket.to(code).emit('playerJoined', {id: socket.id, name});
    // Send existing players to new joiner
    socket.emit('roomState', rooms[code].players.filter(p=>p.id!==socket.id));
    console.log(`Room ${code}: ${rooms[code].players.length} players`);
  });

  socket.on('ready', ({ready}) => {
    const code = socket.data?.code;
    if(!code || !rooms[code]) return;
    const player = rooms[code].players.find(p=>p.id===socket.id);
    if(player) player.ready = ready;
    socket.to(code).emit('playerReady', {id: socket.id, ready});

    // Check if all ready (min 2)
    const room = rooms[code];
    if(room.players.length >= 2 && room.players.every(p=>p.ready)){
      io.to(code).emit('startGame');
      console.log(`Room ${code}: ALL READY → starting game`);
    }
  });

  socket.on('disconnect', () => {
    const code = socket.data?.code;
    const name = socket.data?.name;
    if(code && rooms[code]){
      rooms[code].players = rooms[code].players.filter(p=>p.id!==socket.id);
      io.to(code).emit('playerLeft', {id: socket.id, name});
      if(rooms[code].players.length === 0) delete rooms[code];
    }
    console.log('- disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=>console.log(`\n🎮 PROJECT PLAYTIME SERVER\n   http://localhost:${PORT}\n   Waiting for players...\n`));
