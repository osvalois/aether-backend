import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  database: {
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: ['dist/**/*.entity{.ts,.js}'],
    synchronize: true,
    logging: process.env.NODE_ENV === 'development',
    
  },
  kafka: {
    clientId: 'aether-backend',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    groupId: 'aether-consumer-group',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    ttl: parseInt(process.env.REDIS_CACHE_TTL, 10) || 3600,
  },
  weatherApi: {
    baseUrl: process.env.WEATHER_API_BASE_URL,
    apiKey: process.env.WEATHER_API_KEY,
    timeout: parseInt(process.env.WEATHER_API_TIMEOUT, 10) || 5000,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },
  cors: {
    enabled: process.env.CORS_ENABLED === 'true',
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
  },
}));