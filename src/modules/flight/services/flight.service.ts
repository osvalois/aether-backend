import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FlightTicket } from '../entities/flight-ticket.entity';
import { Airport } from '../entities/airport.entity';
import { CreateFlightTicketDto, FlightTicketDto } from '../dto/flight-ticket.dto';
import { FlightDataProducer } from '../../../kafka/producers/flight-data.producer';

@Injectable()
export class FlightService {
    private readonly logger = new Logger(FlightService.name);

    constructor(
        @InjectRepository(FlightTicket)
        private readonly flightTicketRepository: Repository<FlightTicket>,
        @InjectRepository(Airport)
        private readonly airportRepository: Repository<Airport>,
        private readonly flightDataProducer: FlightDataProducer,
    ) {}

    async ingestFlightData(flightTickets: CreateFlightTicketDto[]): Promise<FlightTicketDto[]> {
        const processedTickets: FlightTicketDto[] = [];
        for (const ticketDto of flightTickets) {
            try {
                const processedTicket = await this.processFlightTicket(ticketDto);
                processedTickets.push(processedTicket);
            } catch (error) {
                this.logger.error(`Failed to process flight ticket: ${error.message}`, error.stack);
            }
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

        await this.flightTicketRepository.save(flightTicket);
        await this.publishFlightTicketToKafka(flightTicket);

        return this.mapToFlightTicketDto(flightTicket);
    }

    private async getOrCreateAirport(airportData: Partial<Airport>): Promise<Airport> {
        let airport = await this.airportRepository.findOne({ where: { iataCode: airportData.iataCode } });
        if (!airport) {
            airport = this.airportRepository.create(airportData);
            await this.airportRepository.save(airport);
            this.logger.log(`Created new airport: ${airport.iataCode}`);
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

    async getFlightTicket(id: string): Promise<FlightTicketDto> {
        const flightTicket = await this.flightTicketRepository.findOne({
            where: { id },
            relations: ['originAirport', 'destinationAirport']
        });
        if (!flightTicket) {
            throw new NotFoundException(`Flight ticket with ID ${id} not found`);
        }
        return this.mapToFlightTicketDto(flightTicket);
    }

    async searchFlights(origin: string, destination: string): Promise<FlightTicketDto[]> {
        const flightTickets = await this.flightTicketRepository.find({
            where: { origin, destination },
            relations: ['originAirport', 'destinationAirport']
        });
        return flightTickets.map(ticket => this.mapToFlightTicketDto(ticket));
    }

    async getAllFlightTickets(): Promise<FlightTicketDto[]> {
        const flightTickets = await this.flightTicketRepository.find({
            relations: ['originAirport', 'destinationAirport']
        });
        return flightTickets.map(ticket => this.mapToFlightTicketDto(ticket));
    }

    async updateFlightTicket(id: string, updateData: Partial<CreateFlightTicketDto>): Promise<FlightTicketDto> {
        const existingTicket = await this.flightTicketRepository.findOne({
            where: { id },
            relations: ['originAirport', 'destinationAirport']
        });
        if (!existingTicket) {
            throw new NotFoundException(`Flight ticket with ID ${id} not found`);
        }

        if (updateData.originAirport) {
            existingTicket.originAirport = await this.getOrCreateAirport(updateData.originAirport);
        }
        if (updateData.destinationAirport) {
            existingTicket.destinationAirport = await this.getOrCreateAirport(updateData.destinationAirport);
        }

        Object.assign(existingTicket, updateData);
        const updatedTicket = await this.flightTicketRepository.save(existingTicket);
        return this.mapToFlightTicketDto(updatedTicket);
    }

    async deleteFlightTicket(id: string): Promise<void> {
        const result = await this.flightTicketRepository.delete(id);
        if (result.affected === 0) {
            throw new NotFoundException(`Flight ticket with ID ${id} not found`);
        }
    }

    private mapToFlightTicketDto(ticket: FlightTicket): FlightTicketDto {
        return {
            id: ticket.id,
            origin: ticket.origin,
            destination: ticket.destination,
            airline: ticket.airline,
            flightNum: ticket.flightNum,
            originAirport: ticket.originAirport,
            destinationAirport: ticket.destinationAirport,
        };
    }
}