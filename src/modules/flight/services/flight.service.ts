import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FlightTicket } from '../entities/flight-ticket.entity';
import { Airport } from '../entities/airport.entity';
import { AirportDto, CreateFlightTicketDto, FlightTicketDto } from '../dto/flight-ticket.dto';
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

  async ingestFlightData(flightTickets: CreateFlightTicketDto[]): Promise<FlightTicketDto[]> {
    const processedTickets: FlightTicketDto[] = [];
    for (const ticketDto of flightTickets) {
      const processedTicket = await this.processFlightTicket(ticketDto);
      processedTickets.push(processedTicket);
    }
    return processedTickets;
  }

  private async processFlightTicket(ticketDto: CreateFlightTicketDto): Promise<FlightTicketDto> {
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

    const savedTicket = await this.flightTicketRepository.save(flightTicket);
    await this.publishFlightTicketToKafka(savedTicket);

    return this.mapToFlightTicketDto(savedTicket);
  }

  private async getOrCreateAirport(airportDto: AirportDto): Promise<Airport> {
    let airport = await this.airportRepository.findOne({ where: { iataCode: airportDto.iataCode } });
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

  async getFlightTicket(id: string): Promise<FlightTicketDto | null> {
    const flightTicket = await this.flightTicketRepository.findOne({ 
      where: { id }, 
      relations: ['originAirport', 'destinationAirport'] 
    });
    return flightTicket ? this.mapToFlightTicketDto(flightTicket) : null;
  }

  async searchFlights(origin: string, destination: string): Promise<FlightTicketDto[]> {
    const flightTickets = await this.flightTicketRepository.find({
      where: { origin, destination },
      relations: ['originAirport', 'destinationAirport'],
    });
    return flightTickets.map(ticket => this.mapToFlightTicketDto(ticket));
  }

  private mapToFlightTicketDto(ticket: FlightTicket): FlightTicketDto {
    return {
      id: ticket.id,
      origin: ticket.origin,
      destination: ticket.destination,
      airline: ticket.airline,
      flightNum: ticket.flightNum,
      originAirport: {
        iataCode: ticket.originAirport.iataCode,
        name: ticket.originAirport.name,
        latitude: ticket.originAirport.latitude,
        longitude: ticket.originAirport.longitude,
      },
      destinationAirport: {
        iataCode: ticket.destinationAirport.iataCode,
        name: ticket.destinationAirport.name,
        latitude: ticket.destinationAirport.latitude,
        longitude: ticket.destinationAirport.longitude,
      },
    };
  }
}