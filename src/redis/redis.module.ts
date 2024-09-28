import redisConfig from '@app/config/redis.config';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';

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
  ],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule {}
