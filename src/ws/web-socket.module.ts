// src/ws/web-socket.module.ts
import { Module } from '@nestjs/common';
import { WebSocketService } from './web-socket.service';

@Module({
  providers: [WebSocketService],
  exports: [WebSocketService],
})
export class WebSocketModule {}