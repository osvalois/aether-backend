// flight-weather-report.dto.ts
import { IsString, IsDate, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class FlightWeatherReportDto {
  @IsString()
  id: string;

  @IsString()
  flightId: string;

  @IsDate()
  @Type(() => Date)
  createdAt: Date;

  @IsObject()
  originWeather: object;

  @IsObject()
  destinationWeather: object;

  @IsObject()
  reportData: object;

  constructor(partial: Partial<FlightWeatherReportDto>) {
    Object.assign(this, partial);
  }
}
