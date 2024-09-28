import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlightService } from './services/flight.service';
import { FlightController } from './controllers/flight.controller';
import { FlightTicket } from './entities/flight-ticket.entity';
import { Airport } from './entities/airport.entity';
import { ConfigModule } from '@nestjs/config';
import { FlightDataProducer } from '@app/kafka/producers/flight-data.producer';

@Module({
  imports: [
    TypeOrmModule.forFeature([FlightTicket, Airport]),
    ConfigModule,
  ],
  providers: [FlightService, FlightDataProducer],
  controllers: [FlightController],
  exports: [FlightService],
})
export class FlightModule {}