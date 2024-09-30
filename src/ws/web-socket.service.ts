import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@Injectable()
export class WebSocketService {
  private server: Server;
  private readonly logger = new Logger(WebSocketService.name);

  setServer(server: Server) {
    this.server = server;
    this.setupConnectionHandlers();
  }

  private setupConnectionHandlers() {
    this.server.on('connection', (socket: Socket) => {
      this.logger.log(`Client connected: ${socket.id}`);

      socket.on('disconnect', () => {
        this.logger.log(`Client disconnected: ${socket.id}`);
      });

      socket.on('joinRoom', (room: string) => {
        socket.join(room);
        this.logger.log(`Client ${socket.id} joined room: ${room}`);
      });

      socket.on('leaveRoom', (room: string) => {
        socket.leave(room);
        this.logger.log(`Client ${socket.id} left room: ${room}`);
      });
    });
  }

  sendToAll(event: string, data: any) {
    this.server.emit(event, data);
    this.logger.debug(`Sent ${event} to all clients`);
  }

  sendToUser(userId: string, event: string, data: any) {
    this.server.to(userId).emit(event, data);
    this.logger.debug(`Sent ${event} to user ${userId}`);
  }

  sendToRoom(room: string, event: string, data: any) {
    this.server.to(room).emit(event, data);
    this.logger.debug(`Sent ${event} to room ${room}`);
  }

  broadcastToRoom(room: string, event: string, data: any, sender: Socket) {
    sender.to(room).emit(event, data);
    this.logger.debug(`Broadcast ${event} to room ${room} (excluding sender)`);
  }

  getActiveConnections(): number {
    return this.server.sockets.sockets.size;
  }

  getRoomMembers(room: string): string[] {
    const roomMembers = this.server.sockets.adapter.rooms.get(room);
    return roomMembers ? Array.from(roomMembers) : [];
  }

  disconnectUser(userId: string) {
    const socket = this.server.sockets.sockets.get(userId);
    if (socket) {
      socket.disconnect(true);
      this.logger.log(`Forcefully disconnected user: ${userId}`);
    }
  }

  emitToNamespace(namespace: string, event: string, data: any) {
    this.server.of(namespace).emit(event, data);
    this.logger.debug(`Sent ${event} to namespace ${namespace}`);
  }
}