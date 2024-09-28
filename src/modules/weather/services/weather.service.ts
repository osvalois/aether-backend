import { Injectable, Logger } from '@nestjs/common';
import { WeatherApiService } from './weather-api.service';
import { WeatherDataRepository } from '../repositories/weather-data.repository';
import { WeatherData } from '../entities/weather-data.entity';
import { RedisService } from '@app/redis/redis.service';
import { HttpService } from '@nestjs/axios';
import { FlightService } from '@app/modules/flight/services/flight.service';

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);

  constructor(
    private weatherDataRepository: WeatherDataRepository,
    private weatherApiService: WeatherApiService,
    private redisService: RedisService,
    private httpService: HttpService,
    private flightService: FlightService,
  ) {}

  async getWeatherForAirport(iataCode: string): Promise<WeatherData> {
    const cacheKey = `weather:${iataCode}`;
    const cachedData = await this.redisService.get(cacheKey);

    if (cachedData) {
      this.logger.log(`Cache hit for weather data: ${iataCode}`);
      return JSON.parse(cachedData);
    }

    const weatherData = await this.weatherApiService.fetchWeatherData(iataCode);
    const savedWeatherData = await this.weatherDataRepository.save(weatherData);

    await this.redisService.set(cacheKey, JSON.stringify(savedWeatherData), 1800); // 30 minutes TTL

    return savedWeatherData;
  }

  async updateWeatherData(weatherData: Partial<WeatherData>): Promise<WeatherData> {
    const existingData = await this.weatherDataRepository.findOne({ where: { airportCode: weatherData.airportCode } });

    if (existingData) {
      Object.assign(existingData, weatherData);
      const updatedData = await this.weatherDataRepository.save(existingData);
      await this.updateCache(updatedData);
      return updatedData;
    } else {
      const newData = this.weatherDataRepository.create(weatherData);
      const savedData = await this.weatherDataRepository.save(newData);
      await this.updateCache(savedData);
      return savedData;
    }
  }

  private async updateCache(weatherData: WeatherData): Promise<void> {
    const cacheKey = `weather:${weatherData.airportCode}`;
    await this.redisService.set(cacheKey, JSON.stringify(weatherData), 1800); // 30 minutes TTL
  }
}
