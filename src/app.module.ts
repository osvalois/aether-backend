import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { WeatherModule } from './modules/weather/weather.module';
import { ReportModule } from './modules/report/report.module';
import { RedisModule } from './redis/redis.module';
import configuration from './config/configuration';
import databaseConfig from './config/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration, databaseConfig],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => configService.get('database'),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    RedisModule,
    WeatherModule,
    ReportModule,
  ],
})
export class AppModule {}