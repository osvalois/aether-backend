import { registerAs } from '@nestjs/config';
import { RedisOptions } from 'ioredis';

export default registerAs('redis', (): RedisOptions => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  password: process.env.REDIS_PASSWORD || undefined, // Si usas autenticación
  db: parseInt(process.env.REDIS_DB, 10) || 0, // Si usas múltiples bases de datos en Redis
  retryStrategy: (times) => {
    // Intenta reconectar durante un tiempo específico
    const delay = Math.min(times * 50, 2000); // Retraso entre reconexiones
    return delay; // Retorna el tiempo de espera
  },
  connectTimeout: 10000, // Timeout de conexión en ms
  // Otras opciones pueden añadirse aquí si es necesario
}));
