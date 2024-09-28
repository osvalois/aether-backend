import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportService } from './services/report.service';
import { ReportController } from './controllers/report.controller';
import { FlightWeatherReportRepository } from './repositories/flight-weather-report.repository';
import { FlightModule } from '../flight/flight.module';
import { WeatherModule } from '../weather/weather.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FlightWeatherReportRepository]),
    FlightModule,
    WeatherModule,
  ],
  providers: [ReportService],
  controllers: [ReportController],
  exports: [ReportService],
})
export class ReportModule {}