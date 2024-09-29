// src/config/configuration.ts

import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3030,
  database: {
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: ['dist/**/*.entity{.ts,.js}'],
    synchronize: process.env.NODE_ENV === 'development',
    logging: process.env.NODE_ENV === 'development',
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
    dialectOptions: {
      project: process.env.ENDPOINT_ID,
    },
  },
  kafka: {
    clientId: process.env.KAFKA_CLIENT_ID || 'aether-backend',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    groupId: process.env.KAFKA_GROUP_ID || 'aether-consumer-group',
    ssl: true,
    sasl: {
      mechanism: 'plain',
      username: process.env.KAFKA_API_KEY,
      password: process.env.KAFKA_API_SECRET,
    },
  },
  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT, 10) || 11037,
    password: process.env.REDIS_PASSWORD,
    db: process.env.REDIS_DB,
    ttl: parseInt(process.env.REDIS_CACHE_TTL, 10) || 3600,
    retryStrategy: (times: number) => Math.min(times * 50, 2000),
    reconnectOnError: (err: Error) => {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        return true;
      }
      return false;
    },
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
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
}));