// src/main.ts

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger } from './utils/logger';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { GlobalExceptionFilter } from './utils/error-handler';
import { WebSocketService } from './ws/web-socket.service';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new Logger(),
  });

  const configService = app.get(ConfigService);
  const corsEnabled = configService.get<boolean>('app.cors.enabled');
  const corsOrigin = configService.get<string | string[]>('app.cors.origin');

  if (corsEnabled !== false) {
    app.enableCors({
      origin: corsOrigin || '*', 
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      credentials: true,
      allowedHeaders: 'Content-Type, Accept, Authorization',
    });
  }

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('Aether API')
    .setDescription('The Aether Flight Weather Information System API')
    .setVersion('1.0')
    .addTag('flights')
    .addTag('weather')
    .addTag('reports')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  app.getHttpAdapter().get('/api-json', (req, res) => res.json(document));


  const webSocketService = app.get(WebSocketService);
  app.useWebSocketAdapter(new IoAdapter(app));

  // Arrancar la aplicación
  const port = configService.get<number>('app.port') || 3040;
  const server = await app.listen(port);
  
  // Configurar el servidor WebSocket
  const io = require('socket.io')(server);
  webSocketService.setServer(io);

  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Environment: ${configService.get<string>('app.nodeEnv')}`);
}

bootstrap();
