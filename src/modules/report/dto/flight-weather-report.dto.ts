import { IsString, IsDate, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { WeatherDataDto } from '../../weather/dto/weather-data.dto';

export class FlightWeatherReportDto {
  @IsString()
  id: string;

  @IsString()
  flightId: string;

  @IsDate()
  @Type(() => Date)
  createdAt: Date;

  @IsObject()
  @ValidateNested()
  @Type(() => WeatherDataDto)
  originWeather: WeatherDataDto;

  @IsObject()
  @ValidateNested()
  @Type(() => WeatherDataDto)
  destinationWeather: WeatherDataDto;
}