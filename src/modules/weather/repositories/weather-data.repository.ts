// weather-data.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { WeatherData } from '../entities/weather-data.entity';

@Injectable()
export class WeatherDataRepository {
  constructor(
    @InjectRepository(WeatherData)
    private repository: Repository<WeatherData>,
  ) {}

  async findLatestByAirportCode(airportCode: string): Promise<WeatherData | undefined> {
    return this.repository.findOne({
      where: { airportCode },
      order: { timestamp: 'DESC' },
    });
  }

  async findByAirportCodeAndDateRange(
    airportCode: string,
    startDate: Date,
    endDate: Date,
  ): Promise<WeatherData[]> {
    return this.repository.find({
      where: {
        airportCode,
        timestamp: Between(startDate, endDate),
      },
      order: { timestamp: 'ASC' },
    });
  }

  async save(weatherData: Partial<WeatherData>): Promise<WeatherData> {
    return this.repository.save(weatherData);
  }

  create(weatherData: Partial<WeatherData>): WeatherData {
    return this.repository.create(weatherData);
  }

  async findOne(options: any): Promise<WeatherData | undefined> {
    return this.repository.findOne(options);
  }
}