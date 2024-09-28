import { IsString, IsNotEmpty, Length, Matches, IsNumber, Min, Max, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class AirportDto {
  @ApiProperty({ description: 'IATA code of the airport', example: 'LAX' })
  @IsString()
  @IsNotEmpty()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/, { message: 'IATA code must be a valid 3-letter code' })
  iataCode: string;

  @ApiProperty({ description: 'Name of the airport', example: 'Los Angeles International Airport' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Latitude of the airport', example: 33.9416 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  latitude: number;

  @ApiProperty({ description: 'Longitude of the airport', example: -118.4085 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  longitude: number;
}

export class CreateFlightTicketDto {
  @ApiProperty({ description: 'Origin airport code', example: 'LAX' })
  @IsString()
  @IsNotEmpty()
  @Length(3, 3)
  origin: string;

  @ApiProperty({ description: 'Destination airport code', example: 'JFK' })
  @IsString()
  @IsNotEmpty()
  @Length(3, 3)
  destination: string;

  @ApiProperty({ description: 'Airline code', example: 'AA' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 2)
  airline: string;

  @ApiProperty({ description: 'Flight number', example: 'AA123' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 10)
  flightNum: string;

  @ApiProperty({ type: () => AirportDto })
  @Type(() => AirportDto)
  @ValidateNested()
  originAirport: AirportDto;

  @ApiProperty({ type: () => AirportDto })
  @Type(() => AirportDto)
  @ValidateNested()
  destinationAirport: AirportDto;
}

export class UpdateFlightTicketDto extends PartialType(CreateFlightTicketDto) {}

export class FlightTicketDto extends CreateFlightTicketDto {
  @ApiProperty({ description: 'Unique identifier of the flight ticket' })
  @IsString()
  @IsNotEmpty()
  id: string;
}

export class BulkCreateFlightTicketDto {
  @ApiProperty({ type: () => CreateFlightTicketDto, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFlightTicketDto)
  flightTickets: CreateFlightTicketDto[];
}

export class BulkIngestionResultDto {
  @ApiProperty({ description: 'Number of successfully processed tickets' })
  @IsNumber()
  successCount: number;

  @ApiProperty({ description: 'Number of failed ticket ingestions' })
  @IsNumber()
  failureCount: number;

  @ApiProperty({ description: 'Array of successfully ingested flight tickets', type: [FlightTicketDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FlightTicketDto)
  successfulTickets: FlightTicketDto[];

  @ApiProperty({ description: 'Array of errors for failed ingestions', type: [String] })
  @IsArray()
  @IsString({ each: true })
  errors: string[];
}