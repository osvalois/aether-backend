import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WeatherDataProducer } from './producers/weather-data.producer';
import { FlightDataProducer } from './producers/flight-data.producer';
import { WeatherDataConsumer } from './consumers/weather-data.consumer';
import { WeatherModule } from '../modules/weather/weather.module';
import { PrometheusModule } from 'src/prometeus/prometheus.module';

@Module({
  imports: [
    ConfigModule,
    WeatherModule,
    PrometheusModule
    ,
  ],
  providers: [WeatherDataProducer, FlightDataProducer, WeatherDataConsumer],
  exports: [WeatherDataProducer, FlightDataProducer, WeatherDataConsumer],
})
export class KafkaModule {}