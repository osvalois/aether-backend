import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Airport } from '../../flight/entities/airport.entity';
import { WeatherService } from '../services/weather.service';

@Injectable()
export class WeatherUpdateScheduler {
  private readonly logger = new Logger(WeatherUpdateScheduler.name);

  constructor(
    private readonly weatherService: WeatherService,
    @InjectRepository(Airport)
    private readonly airportRepository: Repository<Airport>
  ) {}

  @Cron("0 */4 * * * *")
  async handleCron() {
    this.logger.log('Updating weather data for all airports');
    try {
      const airports = await this.airportRepository.find();
      await this.weatherService.updateWeatherForAllAirports(airports.map(airport => airport.iataCode));
      this.logger.log('Weather data updated successfully');
    } catch (error) {
      this.logger.error('Error updating weather data', error.stack);
    }
  }
}