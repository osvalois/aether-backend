import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ReportService } from './services/report.service';
import { ReportController } from './controllers/report.controller';
import { FlightModule } from '../flight/flight.module';
import { WeatherModule } from '../weather/weather.module';
import { FlightWeatherReport } from './entities/flight-weather-report.entity';
import { ReportGenerationLog } from './entities/report-generation-log.entity';
import { ReportScheduler } from './scheduler/report.scheduler';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AirportService } from '../flight/services/airport.service';
import { AirportRepository } from '../flight/repositories/airport.repository';
import { Airport } from '../flight/entities/airport.entity';
import { NotificationService } from '../flight/services/notification.service';
import { FlightTicket } from '../flight/entities/flight-ticket.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([FlightWeatherReport, ReportGenerationLog, Airport, FlightTicket]),
    ScheduleModule.forRoot(),
    FlightModule,
    WeatherModule,
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        ttl: configService.get('CACHE_TTL'),
      }),
      inject: [ConfigService],
    }),
    ConfigModule,
  ],
  providers: [
    ReportService,
    ReportScheduler,
    ConfigService,
    AirportService,
    {
      provide: AirportRepository,
      useClass: AirportRepository,
    },
    {
      provide: 'CacheService',
      useFactory: (cacheManager) => cacheManager,
      inject: ['CACHE_MANAGER'],
    },
    {
      provide: NotificationService,
      useValue: {},
    },
  ],
  controllers: [ReportController],
  exports: [ReportService],
})
export class ReportModule {}