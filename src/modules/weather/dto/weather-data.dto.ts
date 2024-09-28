import { IsString, IsNumber, IsDate, IsOptional } from 'class-validator';

export class WeatherDataDto {
  @IsString()
  airportCode: string;

  @IsDate()
  timestamp: Date;

  @IsNumber()
  temperature: number;

  @IsNumber()
  humidity: number;

  @IsNumber()
  windSpeed: number;

  @IsString()
  windDirection: string;

  @IsString()
  @IsOptional()
  condition?: string;

  @IsNumber()
  @IsOptional()
  pressure?: number;

  @IsNumber()
  @IsOptional()
  visibility?: number;
}