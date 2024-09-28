import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FlightTicket } from '../entities/flight-ticket.entity';
import { Airport } from '../entities/airport.entity';
import { AirportDto, FlightTicketDto } from '../dto/flight-ticket.dto';
import { FlightDataProducer } from '../../../kafka/producers/flight-data.producer';

@Injectable()
export class FlightService {
  private readonly logger = new Logger(FlightService.name);

  constructor(
    @InjectRepository(FlightTicket)
    private flightTicketRepository: Repository<FlightTicket>,
    @InjectRepository(Airport)
    private airportRepository: Repository<Airport>,
    private flightDataProducer: FlightDataProducer,
  ) {}

  async ingestFlightData(flightTickets: FlightTicketDto[]): Promise<void> {
    for (const ticketDto of flightTickets) {
      await this.processFlightTicket(ticketDto);
    }
  }

  private async processFlightTicket(ticketDto: FlightTicketDto): Promise<void> {
    const originAirport = await this.getOrCreateAirport(ticketDto.originAirport);
    const destinationAirport = await this.getOrCreateAirport(ticketDto.destinationAirport);

    const flightTicket = this.flightTicketRepository.create({
      origin: ticketDto.origin,
      destination: ticketDto.destination,
      airline: ticketDto.airline,
      flightNum: ticketDto.flightNum,
      originAirport,
      destinationAirport,
    });

    await this.flightTicketRepository.save(flightTicket);
    await this.publishFlightTicketToKafka(flightTicket);
  }

  private async getOrCreateAirport(airportDto: AirportDto): Promise<Airport> {
    let airport = await this.airportRepository.findOne({ where: { iataCode: airportDto.iataCode } }); // Ajuste aquí
    if (!airport) {
      airport = this.airportRepository.create(airportDto);
      await this.airportRepository.save(airport);
    }
    return airport;
}


  private async publishFlightTicketToKafka(flightTicket: FlightTicket): Promise<void> {
    try {
      await this.flightDataProducer.publishFlightData(flightTicket);
      this.logger.log(`Published flight ticket ${flightTicket.id} to Kafka`);
    } catch (error) {
      this.logger.error(`Failed to publish flight ticket ${flightTicket.id} to Kafka`, error.stack);
    }
  }

  async getFlightTicket(id: string): Promise<FlightTicket> {
    return this.flightTicketRepository.findOne({ where: { id }, relations: ['originAirport', 'destinationAirport'] }); // Ajuste aquí
}

  async searchFlights(origin: string, destination: string): Promise<FlightTicket[]> {
    return this.flightTicketRepository.find({
      where: { origin, destination },
      relations: ['originAirport', 'destinationAirport'],
    });
  }
}