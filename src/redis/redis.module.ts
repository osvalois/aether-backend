import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';
import redisConfig from '@app/config/redis.config';
import { RedisService } from './redis.service';

@Module({
  imports: [ConfigModule.forRoot({ load: [redisConfig] })],
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService) => {
        const options = configService.get<RedisOptions>('redis');
        return new Redis(options);
      },
      inject: [ConfigService],
    },
    RedisService,
  ],
  exports: ['REDIS_CLIENT', RedisService],
})
export class RedisModule {}