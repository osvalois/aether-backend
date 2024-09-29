// src/ws/web-socket.service.ts
import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class WebSocketService {
  private server: Server;

  setServer(server: Server) {
    this.server = server;
  }

  sendToAll(event: string, data: any) {
    this.server.emit(event, data);
  }
}