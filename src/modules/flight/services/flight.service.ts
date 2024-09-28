import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, In } from 'typeorm';
import { FlightTicket } from '../entities/flight-ticket.entity';
import { Airport } from '../entities/airport.entity';
import { CreateFlightTicketDto, FlightTicketDto, BulkIngestionResultDto } from '../dto/flight-ticket.dto';
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
        private readonly dataSource: DataSource,
    ) {}

    async bulkIngestFlightData(flightTickets: CreateFlightTicketDto[]): Promise<BulkIngestionResultDto> {
        const batchSize = 100;
        let successCount = 0;
        let failureCount = 0;
        const errors: string[] = [];
        const successfulTickets: FlightTicketDto[] = [];

        for (let i = 0; i < flightTickets.length; i += batchSize) {
            const batch = flightTickets.slice(i, i + batchSize);
            
            await this.dataSource.transaction(async (transactionalEntityManager) => {
                for (const ticketDto of batch) {
                    try {
                        const ticket = await this.processFlightTicket(ticketDto, transactionalEntityManager);
                        successfulTickets.push(this.mapToFlightTicketDto(ticket));
                        successCount++;
                    } catch (error) {
                        this.logger.error(`Failed to process flight ticket: ${error.message}`, error.stack);
                        errors.push(`Failed to process ticket: ${error.message}`);
                        failureCount++;
                    }
                }
            });

            // Publicar en Kafka después de cada lote procesado exitosamente
            await this.publishBatchToKafka(successfulTickets.slice(-batch.length));
        }

        return {
            successCount,
            failureCount,
            successfulTickets,
            errors,
        };
    }

    private async processFlightTicket(ticketDto: CreateFlightTicketDto, transactionalEntityManager: EntityManager): Promise<FlightTicket> {
        const originAirport = await this.getOrCreateAirport(ticketDto.originAirport, transactionalEntityManager);
        const destinationAirport = await this.getOrCreateAirport(ticketDto.destinationAirport, transactionalEntityManager);

        const flightTicket = transactionalEntityManager.create(FlightTicket, {
            origin: ticketDto.origin,
            destination: ticketDto.destination,
            airline: ticketDto.airline,
            flightNum: ticketDto.flightNum,
            originAirport,
            destinationAirport,
        });

        return await transactionalEntityManager.save(flightTicket);
    }

    private async getOrCreateAirport(airportData: Partial<Airport>, transactionalEntityManager: EntityManager): Promise<Airport> {
        let airport = await transactionalEntityManager.findOne(Airport, { where: { iataCode: airportData.iataCode } });
        if (!airport) {
            airport = transactionalEntityManager.create(Airport, airportData);
            await transactionalEntityManager.save(airport);
            this.logger.log(`Created new airport: ${airport.iataCode}`);
        }
        return airport;
    }

    private async publishBatchToKafka(flightTickets: FlightTicketDto[]): Promise<void> {
        try {
            await Promise.all(flightTickets.map(ticket => this.flightDataProducer.publishFlightData(this.dtoToEntity(ticket))));
            this.logger.log(`Published ${flightTickets.length} tickets to Kafka`);
        } catch (error) {
            this.logger.error(`Failed to publish batch to Kafka: ${error.message}`, error.stack);
            // Implementar lógica de reintento o almacenamiento de mensajes fallidos
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

    async getAllFlightTickets(page: number = 1, limit: number = 10): Promise<{ tickets: FlightTicketDto[], total: number }> {
        const [flightTickets, total] = await this.flightTicketRepository.findAndCount({
            relations: ['originAirport', 'destinationAirport'],
            skip: (page - 1) * limit,
            take: limit,
        });
        return {
            tickets: flightTickets.map(ticket => this.mapToFlightTicketDto(ticket)),
            total
        };
    }

    async updateFlightTicket(id: string, updateData: Partial<CreateFlightTicketDto>): Promise<FlightTicketDto> {
        const existingTicket = await this.flightTicketRepository.findOne({
            where: { id },
            relations: ['originAirport', 'destinationAirport']
        });
        if (!existingTicket) {
            throw new NotFoundException(`Flight ticket with ID ${id} not found`);
        }

        await this.dataSource.transaction(async (transactionalEntityManager) => {
            if (updateData.originAirport) {
                existingTicket.originAirport = await this.getOrCreateAirport(updateData.originAirport, transactionalEntityManager);
            }
            if (updateData.destinationAirport) {
                existingTicket.destinationAirport = await this.getOrCreateAirport(updateData.destinationAirport, transactionalEntityManager);
            }

            Object.assign(existingTicket, updateData);
            await transactionalEntityManager.save(existingTicket);
        });

        await this.publishFlightTicketToKafka(existingTicket);

        return this.mapToFlightTicketDto(existingTicket);
    }

    async deleteFlightTicket(id: string): Promise<void> {
        const result = await this.flightTicketRepository.delete(id);
        if (result.affected === 0) {
            throw new NotFoundException(`Flight ticket with ID ${id} not found`);
        }
    }

    async bulkDeleteFlightTickets(ids: string[]): Promise<{ deletedCount: number }> {
        const result = await this.flightTicketRepository.delete({ id: In(ids) });
        return { deletedCount: result.affected || 0 };
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

    private dtoToEntity(dto: FlightTicketDto): FlightTicket {
        const entity = new FlightTicket();
        Object.assign(entity, dto);
        entity.createdAt = new Date();
        entity.updatedAt = new Date();
        return entity;
    }

    private async publishFlightTicketToKafka(flightTicket: FlightTicket): Promise<void> {
        try {
            await this.flightDataProducer.publishFlightData(flightTicket);
            this.logger.log(`Published flight ticket ${flightTicket.id} to Kafka`);
        } catch (error) {
            this.logger.error(`Failed to publish flight ticket ${flightTicket.id} to Kafka`, error.stack);
            // Implementar lógica de reintento o almacenamiento de mensajes fallidos
        }
    }
}