// weather-data.dto.ts
import { IsString, IsNumber, IsDate, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class WeatherDataDto {
  @IsString()
  airportCode: string;

  @IsDate()
  @Type(() => Date)
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

  constructor(partial: Partial<WeatherDataDto>) {
    Object.assign(this, partial);
  }
}