import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';  // Importa HttpModule
import { WeatherService } from './services/weather.service';
import { WeatherApiService } from './services/weather-api.service';
import { WeatherDataRepository } from './repositories/weather-data.repository';
import { WeatherData } from './entities/weather-data.entity';

import { FlightService } from '../flight/services/flight.service';
import { RedisModule } from 'src/redis/redis.module';
import { WeatherController } from './controllers/weather.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([WeatherData]),
    RedisModule,
    HttpModule,
  ],
  providers: [
    WeatherService,
    WeatherApiService,
    WeatherDataRepository,
  ],
  controllers: [WeatherController],
  exports: [WeatherService],
})
export class WeatherModule {}