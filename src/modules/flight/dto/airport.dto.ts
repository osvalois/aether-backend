import { IsString, IsNotEmpty, Length, Matches, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class CreateAirportDto {
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
  latitude: number;

  @ApiProperty({ description: 'Longitude of the airport', example: -118.4085 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiProperty({ description: 'City of the airport', example: 'Los Angeles' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ description: 'Country of the airport', example: 'United States' })
  @IsString()
  @IsNotEmpty()
  country: string;
}

export class UpdateAirportDto extends PartialType(CreateAirportDto) {}