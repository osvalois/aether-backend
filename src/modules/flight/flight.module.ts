import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlightTicket } from './entities/flight-ticket.entity';
import { Airport } from './entities/airport.entity';
import { FlightService } from './services/flight.service';
import { FlightController } from './controllers/flight.controller';
import { FlightDataProducer } from '../../kafka/producers/flight-data.producer';
import { AirportRepository } from './repositories/airport.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([FlightTicket, Airport]),
  ],
  controllers: [FlightController],
  providers: [
    FlightService,
    FlightDataProducer,
    AirportRepository,
  ],
  exports: [FlightService],
})
export class FlightModule {}