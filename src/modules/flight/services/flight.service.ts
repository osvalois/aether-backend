// flight.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, In } from 'typeorm';
import { FlightTicket } from '../entities/flight-ticket.entity';
import { Airport } from '../entities/airport.entity';
import { CreateFlightTicketDto, FlightTicketDto, BulkIngestionResultDto } from '../dto/flight-ticket.dto';
import { FlightDataProducer } from '../../../kafka/producers/flight-data.producer';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { chunk } from 'lodash';
import { RedisService } from 'src/redis/redis.service';
import { WebSocketService } from 'src/ws/web-socket.service';

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
        private readonly configService: ConfigService,
        private readonly redisService: RedisService,
        private readonly webSocketService: WebSocketService,
    ) {}

    async bulkIngestFlightData(flightTickets: CreateFlightTicketDto[]): Promise<BulkIngestionResultDto> {
        const batchSize = this.configService.get<number>('BATCH_SIZE', 1000);
        const chunks = chunk(flightTickets, batchSize);
        
        let totalSuccess = 0;
        let totalFailure = 0;
        const allErrors: string[] = [];
        const allSuccessfulTickets: FlightTicketDto[] = [];

        for (const batch of chunks) {
            try {
                const result = await this.processBatch(batch);
                totalSuccess += result.successCount;
                totalFailure += result.failureCount;
                allErrors.push(...result.errors);
                allSuccessfulTickets.push(...result.successfulTickets);
            } catch (error) {
                this.logger.error(`Failed to process batch: ${error.message}`, error.stack);
                totalFailure += batch.length;
                allErrors.push(`Batch processing failed: ${error.message}`);
            }
        }

        const result = {
            successCount: totalSuccess,
            failureCount: totalFailure,
            successfulTickets: allSuccessfulTickets,
            errors: allErrors,
        };

        // Notify clients about bulk ingestion
        this.webSocketService.sendToAll('bulkIngestFlightData', result);

        return result;
    }

    private async processBatch(batch: CreateFlightTicketDto[]): Promise<BulkIngestionResultDto> {
        const airportCache = new Map<string, Airport>();
        const successfulTickets: FlightTicketDto[] = [];
        const errors: string[] = [];

        await this.dataSource.transaction(async (transactionalEntityManager) => {
            for (const ticketDto of batch) {
                try {
                    const ticket = await this.processFlightTicket(ticketDto, transactionalEntityManager, airportCache);
                    const savedTicket = await transactionalEntityManager.save(FlightTicket, ticket);
                    successfulTickets.push(this.mapToFlightTicketDto(savedTicket));
                } catch (error) {
                    errors.push(`Failed to process ticket: ${error.message}`);
                }
            }
        });

        // Asynchronously publish to Kafka and cache
        this.publishAndCacheBatch(successfulTickets).catch(error => 
            this.logger.error(`Failed to publish and cache batch: ${error.message}`, error.stack)
        );

        return {
            successCount: successfulTickets.length,
            failureCount: errors.length,
            successfulTickets,
            errors,
        };
    }

    private async processFlightTicket(
        ticketDto: CreateFlightTicketDto,
        transactionalEntityManager: EntityManager,
        airportCache: Map<string, Airport>
    ): Promise<FlightTicket> {
        const originAirport = await this.getOrCreateAirport(ticketDto.originAirport, transactionalEntityManager, airportCache);
        const destinationAirport = await this.getOrCreateAirport(ticketDto.destinationAirport, transactionalEntityManager, airportCache);

        return transactionalEntityManager.create(FlightTicket, {
            ...ticketDto,
            originAirport,
            destinationAirport,
        });
    }

    private async getOrCreateAirport(
        airportData: Partial<Airport>,
        transactionalEntityManager: EntityManager,
        cache: Map<string, Airport>
    ): Promise<Airport> {
        if (!airportData.iataCode) {
            throw new Error('IATA code is required for airport');
        }

        const cachedAirport = cache.get(airportData.iataCode);
        if (cachedAirport) return cachedAirport;

        let airport = await transactionalEntityManager.findOne(Airport, { where: { iataCode: airportData.iataCode } });
        if (!airport) {
            airport = transactionalEntityManager.create(Airport, airportData);
            await transactionalEntityManager.save(airport);
            this.logger.log(`Created new airport: ${airport.iataCode}`);
        }

        cache.set(airportData.iataCode, airport);
        return airport;
    }

    private async publishAndCacheBatch(flightTickets: FlightTicketDto[]): Promise<void> {
        const publishPromises = flightTickets.map(ticket => 
            this.flightDataProducer.publishFlightData(this.mapDtoToEntity(ticket)).catch(error => {
                this.logger.error(`Failed to publish ticket ${ticket.id} to Kafka: ${error.message}`);
                return this.redisService.set(`flight_data_backlog:${ticket.id}`, JSON.stringify(ticket));
            })
        );

        const cachePromises = flightTickets.map(ticket =>
            this.redisService.set(`flight_ticket:${ticket.id}`, JSON.stringify(ticket), 3600) // Cache for 1 hour
        );

        await Promise.all([...publishPromises, ...cachePromises]);

        // Notify clients about new flight tickets
        this.webSocketService.sendToAll('newFlightTickets', flightTickets);
    }

    @Cron('0 */5 * * * *') // Run every 5 minutes
    async processBackloggedData() {
        const backlogKeys = await this.redisService.get('flight_data_backlog:*');
        let processedCount = 0;
        for (const key of backlogKeys) {
            const ticketData = await this.redisService.get(key);
            if (ticketData) {
                const ticket = JSON.parse(ticketData) as FlightTicketDto;
                try {
                    await this.flightDataProducer.publishFlightData(this.mapDtoToEntity(ticket));
                    await this.redisService.del(key);
                    processedCount++;
                } catch (error) {
                    this.logger.error(`Failed to process backlogged ticket ${ticket.id}: ${error.message}`);
                }
            }
        }

        // Notify clients about processed backlog data
        this.webSocketService.sendToAll('backlogProcessed', { processedCount });
    }

    async getFlightTicket(id: string): Promise<FlightTicketDto> {
        const cachedTicket = await this.redisService.get(`flight_ticket:${id}`);
        if (cachedTicket) {
            const dto = JSON.parse(cachedTicket);
            this.webSocketService.sendToAll('flightTicketRetrieved', dto);
            return dto;
        }

        const flightTicket = await this.flightTicketRepository.findOne({
            where: { id },
            relations: ['originAirport', 'destinationAirport']
        });

        if (!flightTicket) {
            throw new NotFoundException(`Flight ticket with ID ${id} not found`);
        }

        const dto = this.mapToFlightTicketDto(flightTicket);
        await this.redisService.set(`flight_ticket:${id}`, JSON.stringify(dto), 3600); // Cache for 1 hour
        this.webSocketService.sendToAll('flightTicketRetrieved', dto);
        return dto;
    }

    async searchFlights(origin: string, destination: string): Promise<FlightTicketDto[]> {
        const cacheKey = `search:${origin}:${destination}`;
        const cachedResults = await this.redisService.get(cacheKey);
        if (cachedResults) {
            const dtos = JSON.parse(cachedResults);
            this.webSocketService.sendToAll('flightSearchResults', { origin, destination, resultsCount: dtos.length });
            return dtos;
        }

        const flightTickets = await this.flightTicketRepository.find({
            where: { origin, destination },
            relations: ['originAirport', 'destinationAirport']
        });

        const dtos = flightTickets.map(ticket => this.mapToFlightTicketDto(ticket));
        await this.redisService.set(cacheKey, JSON.stringify(dtos), 300); // Cache for 5 minutes
        this.webSocketService.sendToAll('flightSearchResults', { origin, destination, resultsCount: dtos.length });
        return dtos;
    }

    async getAllFlightTickets(page: number = 1, limit: number = 10): Promise<{ tickets: FlightTicketDto[], total: number }> {
        const cacheKey = `all_tickets:${page}:${limit}`;
        const cachedResults = await this.redisService.get(cacheKey);
        if (cachedResults) {
            const result = JSON.parse(cachedResults);
            this.webSocketService.sendToAll('allFlightTicketsRetrieved', { page, limit, totalCount: result.total });
            return result;
        }

        const [flightTickets, total] = await this.flightTicketRepository.findAndCount({
            relations: ['originAirport', 'destinationAirport'],
            skip: (page - 1) * limit,
            take: limit,
        });

        const result = {
            tickets: flightTickets.map(ticket => this.mapToFlightTicketDto(ticket)),
            total
        };

        await this.redisService.set(cacheKey, JSON.stringify(result), 60); // Cache for 1 minute
        this.webSocketService.sendToAll('allFlightTicketsRetrieved', { page, limit, totalCount: total });
        return result;
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
                existingTicket.originAirport = await this.getOrCreateAirport(updateData.originAirport, transactionalEntityManager, new Map());
            }
            if (updateData.destinationAirport) {
                existingTicket.destinationAirport = await this.getOrCreateAirport(updateData.destinationAirport, transactionalEntityManager, new Map());
            }

            Object.assign(existingTicket, updateData);
            await transactionalEntityManager.save(existingTicket);
        });

        const updatedDto = this.mapToFlightTicketDto(existingTicket);
        await this.redisService.set(`flight_ticket:${id}`, JSON.stringify(updatedDto), 3600);
        this.flightDataProducer.publishFlightData(this.mapDtoToEntity(updatedDto)).catch(error => {
            this.logger.error(`Failed to publish updated ticket ${id} to Kafka: ${error.message}`);
            return this.redisService.set(`flight_data_backlog:${id}`, JSON.stringify(updatedDto));
        });

        // Notify clients about updated flight ticket
        this.webSocketService.sendToAll('flightTicketUpdated', updatedDto);

        return updatedDto;
    }

    async deleteFlightTicket(id: string): Promise<void> {
        const result = await this.flightTicketRepository.delete(id);
        if (result.affected === 0) {
            throw new NotFoundException(`Flight ticket with ID ${id} not found`);
        }
        await this.redisService.del(`flight_ticket:${id}`);

        // Notify clients about deleted flight ticket
        this.webSocketService.sendToAll('flightTicketDeleted', { id });
    }

    async bulkDeleteFlightTickets(ids: string[]): Promise<{ deletedCount: number }> {
        const result = await this.flightTicketRepository.delete({ id: In(ids) });
        await Promise.all(ids.map(id => this.redisService.del(`flight_ticket:${id}`)));

        // Notify clients about bulk deleted flight tickets
        this.webSocketService.sendToAll('bulkFlightTicketsDeleted', {
            deletedCount: result.affected || 0,
            ids,
        });

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

    private mapDtoToEntity(dto: FlightTicketDto): FlightTicket {
        const entity = new FlightTicket();
        Object.assign(entity, dto);
        return entity;
    }
}