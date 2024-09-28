import { IsString, IsNotEmpty, Length, Matches, IsNumber, Min, Max, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class AirportDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/, { message: 'IATA code must be a valid 3-letter code' })
  iataCode: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  longitude: number;
}

export class CreateFlightTicketDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 3)
  origin: string;

  @IsString()
  @IsNotEmpty()
  @Length(3, 3)
  destination: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 2)
  airline: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 10)
  flightNum: string;

  @Type(() => AirportDto)
  originAirport: AirportDto;

  @Type(() => AirportDto)
  destinationAirport: AirportDto;
}

export class FlightTicketDto extends CreateFlightTicketDto {
  @IsString()
  @IsNotEmpty()
  id: string;
}