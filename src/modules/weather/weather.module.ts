import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { WeatherService } from './services/weather.service';
import { WeatherApiService } from './services/weather-api.service';
import { WeatherDataRepository } from './repositories/weather-data.repository';
import { WeatherData } from './entities/weather-data.entity';
import { RedisModule } from 'src/redis/redis.module';
import { WeatherController } from './controllers/weather.controller';
import { WeatherDataProducer } from 'src/kafka/producers/weather-data.producer';
import { WeatherUpdateScheduler } from './scheduler/weather-update.scheduler';
import { Airport } from '../flight/entities/airport.entity'; 
@Module({
  imports: [
    TypeOrmModule.forFeature([WeatherData, Airport]), 
    RedisModule,
    HttpModule,
  ],
  providers: [
    WeatherService,
    WeatherApiService,
    WeatherDataRepository,
    WeatherDataProducer,
    WeatherUpdateScheduler
  ],
  controllers: [WeatherController],
  exports: [WeatherService],
})
export class WeatherModule {}