import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';  // Importa HttpModule
import { WeatherService } from './services/weather.service';
import { WeatherApiService } from './services/weather-api.service';
import { WeatherDataRepository } from './repositories/weather-data.repository';
import { WeatherData } from './entities/weather-data.entity';
import { RedisModule } from '@app/redis/redis.module';
import { FlightService } from '../flight/services/flight.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WeatherData]),
    RedisModule,
    HttpModule,
    FlightService
  ],
  providers: [
    WeatherService,
    WeatherApiService,
    WeatherDataRepository,
  ],
  exports: [WeatherService],
})
export class WeatherModule {}