import { createServer } from 'http';
import { Server } from 'socket.io';

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

interface Player {
  id: string;
  name: string;
  position: { x: number; y: number };
}

const players: Record<string, Player> = {};

io.on('connection', (socket) => {
  socket.on('join', (playerData: { name: string; position: { x: number; y: number } }) => {
    players[socket.id] = {
      id: socket.id,
      name: playerData.name,
      position: playerData.position,
    };
    io.emit('players', players);
  });

  socket.on('move', (position: { x: number; y: number }) => {
    if (players[socket.id]) {
      players[socket.id].position = position;
      io.emit('players', players);
    }
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('players', players);
  });
});

httpServer.listen(3000, () => {
  console.log('Multiplayer server running on port 3000');
});
