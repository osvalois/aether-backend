import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { WeatherData } from '../entities/weather-data.entity';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class WeatherApiService {
  private readonly logger = new Logger(WeatherApiService.name);
  private readonly apiKey: string;
  private readonly apiBaseUrl: string;

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('WEATHER_API_KEY');
    this.apiBaseUrl = this.configService.get<string>('WEATHER_API_BASE_URL');
  }

  async fetchWeatherData(iataCode: string): Promise<WeatherData> {
    try {
      const url = `${this.apiBaseUrl}/current.json?key=${this.apiKey}&q=${iataCode}`;
      
      this.logger.log(`Fetch weather data for ${url}`);
      const response = await lastValueFrom(this.httpService.get(url));
      return this.transformApiResponse(response.data, iataCode);
    } catch (error) {
      this.logger.error(`Failed to fetch weather data for ${iataCode}: ${error.message}`);
      throw new HttpException('Failed to fetch weather data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private transformApiResponse(apiResponse: any, iataCode: string): WeatherData {
    const weatherData = new WeatherData();
    weatherData.airportCode = iataCode;
    weatherData.timestamp = new Date(apiResponse.current.last_updated_epoch * 1000);
    weatherData.temperature = apiResponse.current.temp_c;
    weatherData.humidity = apiResponse.current.humidity;
    weatherData.windSpeed = apiResponse.current.wind_kph;
    weatherData.windDirection = apiResponse.current.wind_dir;
    weatherData.condition = apiResponse.current.condition.text;
    weatherData.pressure = apiResponse.current.pressure_mb;
    weatherData.visibility = apiResponse.current.vis_km;

    return weatherData;
  }
}