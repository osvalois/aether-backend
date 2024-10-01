// src/modules/weather/services/weather.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WeatherApiService } from './weather-api.service';
import { WeatherData } from '../entities/weather-data.entity';
import { RedisService } from '../../../redis/redis.service';
import { WeatherDataDto } from '../dto/weather-data.dto';
import { WeatherDataProducer } from 'src/kafka/producers/weather-data.producer';

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private readonly CACHE_TTL = 1800; // 30 minutes

  constructor(
    @InjectRepository(WeatherData)
    private weatherDataRepository: Repository<WeatherData>,
    private weatherApiService: WeatherApiService,
    private redisService: RedisService,
    private weatherDataProducer: WeatherDataProducer
  ) {}

  async getWeatherForAirport(iataCode: string): Promise<WeatherData> {
    const cacheKey = `weather:${iataCode}`;
    
    // Try to get data from cache
    const cachedData = await this.redisService.get(cacheKey);
    if (cachedData) {
      this.logger.log(`Cache hit for weather data: ${iataCode}`);
      return JSON.parse(cachedData);
    }

    // If not in cache, check the database for recent data
    const recentData = await this.weatherDataRepository.findOne({
      where: { airportCode: iataCode },
      order: { timestamp: 'DESC' }
    });

    if (recentData && this.isDataRecent(recentData.timestamp)) {
      await this.cacheWeatherData(cacheKey, recentData);
      return recentData;
    }

    // If no recent data, fetch from API
    const weatherData = await this.weatherApiService.fetchWeatherData(iataCode);
    const savedWeatherData = await this.saveWeatherData(weatherData);

    // Publish to Kafka for other services to consume
    await this.weatherDataProducer.publishWeatherData(savedWeatherData);

    return savedWeatherData;
  }

  async updateWeatherData(weatherDataDto: WeatherDataDto): Promise<WeatherData> {
    const existingData = await this.weatherDataRepository.findOne({
      where: { airportCode: weatherDataDto.airportCode }
    });

    const weatherData = existingData 
      ? Object.assign(existingData, weatherDataDto)
      : this.weatherDataRepository.create(weatherDataDto);

    const savedData = await this.weatherDataRepository.save(weatherData);
    await this.cacheWeatherData(`weather:${savedData.airportCode}`, savedData);
    
    // Publish updates to Kafka
    //await this.weatherDataProducer.publishWeatherData(savedData);

    return savedData;
  }

  private async cacheWeatherData(key: string, data: WeatherData): Promise<void> {
    await this.redisService.set(key, JSON.stringify(data), this.CACHE_TTL);
  }

  private isDataRecent(timestamp: Date): boolean {
    const now = new Date();
    const diffInMinutes = (now.getTime() - timestamp.getTime()) / (1000 * 60);
    return diffInMinutes < 30; // Consider data recent if less than 30 minutes old
  }

  private async saveWeatherData(weatherData: WeatherDataDto): Promise<WeatherData> {
    const newWeatherData = this.weatherDataRepository.create(weatherData);
    const savedData = await this.weatherDataRepository.save(newWeatherData);
    await this.cacheWeatherData(`weather:${savedData.airportCode}`, savedData);
    return savedData;
  }
}