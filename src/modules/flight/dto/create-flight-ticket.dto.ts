import { IsString, IsNotEmpty, Length, Matches, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { AirportDto } from './flight-ticket.dto';

export class CreateFlightTicketDto {
  @IsString()
  @IsNotEmpty({ message: 'Origin is required' })
  @Length(3, 3, { message: 'Origin must be exactly 3 characters long' })
  @Matches(/^[A-Z]{3}$/, { message: 'Origin must be a valid 3-letter IATA code' })
  origin: string;

  @IsString()
  @IsNotEmpty({ message: 'Destination is required' })
  @Length(3, 3, { message: 'Destination must be exactly 3 characters long' })
  @Matches(/^[A-Z]{3}$/, { message: 'Destination must be a valid 3-letter IATA code' })
  destination: string;

  @IsString()
  @IsNotEmpty({ message: 'Airline is required' })
  @Length(2, 2, { message: 'Airline must be exactly 2 characters long' })
  @Matches(/^[A-Z0-9]{2}$/, { message: 'Airline must be a valid 2-character code' })
  airline: string;

  @IsString()
  @IsNotEmpty({ message: 'Flight number is required' })
  @Length(1, 10, { message: 'Flight number must be between 1 and 10 characters long' })
  @Matches(/^[A-Z0-9]{1,10}$/, { message: 'Flight number must be alphanumeric and up to 10 characters' })
  flightNum: string;

  @IsObject({ message: 'Origin airport must be a valid object' })
  @Type(() => AirportDto)
  originAirport: AirportDto;

  @IsObject({ message: 'Destination airport must be a valid object' })
  @Type(() => AirportDto)
  destinationAirport: AirportDto;
}
