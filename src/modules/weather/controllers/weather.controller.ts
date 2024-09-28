import { Controller, Get, Param, UseInterceptors, CacheInterceptor } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { WeatherService } from '../services/weather.service';
import { WeatherDataDto } from '../dto/weather-data.dto';
import { TransformInterceptor } from '../../../common/interceptors/transform.interceptor';

@ApiTags('weather')
@Controller('weather')
@UseInterceptors(CacheInterceptor, TransformInterceptor)
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  @Get(':iataCode')
  @ApiOperation({ summary: 'Get weather data for an airport' })
  @ApiResponse({ status: 200, description: 'Return the weather data.', type: WeatherDataDto })
  async getWeatherForAirport(@Param('iataCode') iataCode: string): Promise<WeatherDataDto> {
    const weatherData = await this.weatherService.getWeatherForAirport(iataCode);
    return new WeatherDataDto(weatherData);
  }

  // Add more endpoints as needed
}