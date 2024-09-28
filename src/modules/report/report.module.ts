import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportService } from './services/report.service';
import { ReportController } from './controllers/report.controller';
import { FlightModule } from '../flight/flight.module';
import { WeatherModule } from '../weather/weather.module';
import { FlightWeatherReport } from './entities/flight-weather-report.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([FlightWeatherReport]),
    FlightModule,
    WeatherModule,
  ],
  providers: [ReportService],
  controllers: [ReportController],
  exports: [ReportService],
})
export class ReportModule {}