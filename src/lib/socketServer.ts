import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { NextApiResponse } from 'next';

export const initSocketServer = (server: HTTPServer) => {
  const io = new SocketIOServer(server, {
    path: '/api/socketio',
  });

  io.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('join', (room) => {
      socket.join(room);
      console.log(`Client joined room: ${room}`);
    });

    socket.on('leave', (room) => {
      socket.leave(room);
      console.log(`Client left room: ${room}`);
    });

    socket.on('message', ({ room, message }) => {
      io.to(room).emit('message', message);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  });

  return io;
};

export const SocketHandler = (req: any, res: NextApiResponse) => {
    if (res.socket && 'server' in res.socket) {
      const socket = res.socket as any;
      if (!socket.server.io) {
        console.log('Socket is initializing');
        const httpServer = socket.server as HTTPServer;
        socket.server.io = initSocketServer(httpServer);
      }
    }
    res.end();
};