import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WeatherController } from './controllers/weather.controller';
import { WeatherService } from './services/weather.service';
import { WeatherDataRepository } from './repositories/weather-data.repository';
import { WeatherData } from './entities/weather-data.entity';
import { RedisModule } from '../../redis/redis.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    TypeOrmModule.forFeature([WeatherData]),
    RedisModule,
    HttpModule,
  ],
  controllers: [WeatherController],
  providers: [WeatherService, WeatherDataRepository],
  exports: [WeatherService],
})
export class WeatherModule {}