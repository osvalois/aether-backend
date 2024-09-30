import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, In } from 'typeorm';
import { FlightTicket } from '../entities/flight-ticket.entity';
import { Airport } from '../entities/airport.entity';
import { CreateFlightTicketDto, FlightTicketDto, BulkIngestionResultDto, UpdateFlightTicketDto } from '../dto/flight-ticket.dto';
import { FlightDataProducer } from '../../../kafka/producers/flight-data.producer';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { chunk } from 'lodash';
import { RedisService } from 'src/redis/redis.service';
import { WebSocketService } from 'src/ws/web-socket.service';
import { AirportRepository } from '../repositories/airport.repository';
import { Interval } from '@nestjs/schedule';

@Injectable()
export class FlightService {
    private readonly logger = new Logger(FlightService.name);
    private airportCache: Map<string, Airport> = new Map();

    constructor(
        @InjectRepository(FlightTicket)
        private readonly flightTicketRepository: Repository<FlightTicket>,
        private readonly airportRepository: AirportRepository,
        private readonly flightDataProducer: FlightDataProducer,
        private readonly dataSource: DataSource,
        private readonly configService: ConfigService,
        private readonly redisService: RedisService,
        private readonly webSocketService: WebSocketService,
    ) {
        this.initializeAirportCache();
    }

    private async initializeAirportCache(): Promise<void> {
        const airports = await this.airportRepository.findAll();
        airports.forEach(airport => this.airportCache.set(airport.iataCode, airport));
    }

    @Interval(60000) // Refresh cache every minute
    private async refreshAirportCache(): Promise<void> {
        await this.initializeAirportCache();
    }

    async bulkIngestFlightData(flightTickets: CreateFlightTicketDto[]): Promise<BulkIngestionResultDto> {
        const batchSize = this.configService.get<number>('BATCH_SIZE', 1000);
        const chunks = chunk(flightTickets, batchSize);
        
        let totalSuccess = 0;
        let totalFailure = 0;
        const allErrors: string[] = [];
        const allSuccessfulTickets: FlightTicketDto[] = [];

        await Promise.all(chunks.map(async (batch) => {
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
        }));

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
        const successfulTickets: FlightTicketDto[] = [];
        const errors: string[] = [];

        await this.dataSource.transaction(async (transactionalEntityManager) => {
            for (const ticketDto of batch) {
                try {
                    const ticket = await this.processFlightTicket(ticketDto, transactionalEntityManager);
                    const savedTicket = await transactionalEntityManager.save(FlightTicket, ticket);
                    successfulTickets.push(this.mapToFlightTicketDto(savedTicket));
                } catch (error) {
                    this.logger.error(`Failed to process ticket: ${error.message}`, error.stack);
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
        transactionalEntityManager: EntityManager
    ): Promise<FlightTicket> {
        const originAirport = await this.getOrCreateAirport(ticketDto.originAirport, transactionalEntityManager);
        const destinationAirport = await this.getOrCreateAirport(ticketDto.destinationAirport, transactionalEntityManager);

        return transactionalEntityManager.create(FlightTicket, {
            ...ticketDto,
            originAirport,
            destinationAirport,
        });
    }

    private async getOrCreateAirport(
        airportData: Partial<Airport>,
        transactionalEntityManager: EntityManager
    ): Promise<Airport> {
        if (!airportData.iataCode) {
            throw new Error('IATA code is required for airport');
        }

        let airport = this.airportCache.get(airportData.iataCode);
        if (airport) return airport;

        try {
            airport = await transactionalEntityManager.findOne(Airport, { where: { iataCode: airportData.iataCode } });
            if (!airport) {
                airport = transactionalEntityManager.create(Airport, airportData);
                await transactionalEntityManager.save(airport);
                this.logger.log(`Created new airport: ${airport.iataCode}`);
            } else {
                // Update existing airport data if necessary
                Object.assign(airport, airportData);
                await transactionalEntityManager.save(airport);
                this.logger.log(`Updated existing airport: ${airport.iataCode}`);
            }
        } catch (error) {
            this.logger.error(`Error creating/updating airport ${airportData.iataCode}: ${error.message}`);
            throw error;
        }

        this.airportCache.set(airportData.iataCode, airport);
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

    @Cron(CronExpression.EVERY_5_MINUTES)
    async processBackloggedData() {
        const backlogPattern = 'flight_data_backlog:*';
        const backlogKeys = await this.redisService.getKeysByPattern(backlogPattern);
        
        if (backlogKeys.length === 0) {
            this.logger.log('No backlogged data to process');
            return;
        }

        const processedCount = await Promise.all(backlogKeys.map(async (key) => {
            const ticketData = await this.redisService.get(key);
            if (ticketData) {
                const ticket = JSON.parse(ticketData) as FlightTicketDto;
                try {
                    await this.flightDataProducer.publishFlightData(this.mapDtoToEntity(ticket));
                    await this.redisService.del(key);
                    return 1;
                } catch (error) {
                    this.logger.error(`Failed to process backlogged ticket ${ticket.id}: ${error.message}`);
                    return 0;
                }
            }
            return 0;
        })).then(results => results.reduce((a, b) => a + b, 0));

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

    async updateFlightTicket(id: string, updateData: Partial<UpdateFlightTicketDto>): Promise<FlightTicketDto> {
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

    async retryFailedTickets(): Promise<number> {
        const backlogPattern = 'flight_data_backlog:*';
        const backlogKeys = await this.redisService.getKeysByPattern(backlogPattern);
        
        let retryCount = 0;
        for (const key of backlogKeys) {
            const ticketData = await this.redisService.get(key);
            if (ticketData) {
                const ticket = JSON.parse(ticketData) as FlightTicketDto;
                try {
                    await this.flightDataProducer.publishFlightData(this.mapDtoToEntity(ticket));
                    await this.redisService.del(key);
                    retryCount++;
                } catch (error) {
                    this.logger.error(`Failed to retry ticket ${ticket.id}: ${error.message}`);
                }
            }
        }

        return retryCount;
    }

    @Cron(CronExpression.EVERY_HOUR)
    async cleanupOldCacheEntries(): Promise<void> {
        const expiredKeys = await this.redisService.getKeysByPattern('flight_ticket:*');
        for (const key of expiredKeys) {
            const value = await this.redisService.get(key);
            if (!value) {
                await this.redisService.del(key);
            }
        }
    }

    async getFlightStatistics(): Promise<any> {
        // Implement flight statistics calculation
        // This could include total flights, flights by airline, popular routes, etc.
        // You might want to use aggregation queries in your database for this
        throw new Error('Not implemented');
    }

    private async validateFlightData(flightTicket: CreateFlightTicketDto): Promise<string[]> {
        const errors: string[] = [];

        if (!flightTicket.origin || !flightTicket.destination) {
            errors.push('Origin and destination are required');
        }

        if (flightTicket.origin === flightTicket.destination) {
            errors.push('Origin and destination must be different');
        }

        if (!flightTicket.airline || !flightTicket.flightNum) {
            errors.push('Airline and flight number are required');
        }

        // Add more validation as needed

        return errors;
    }

    async bulkUpsertAirports(airports: Partial<Airport>[]): Promise<number> {
        const upsertedCount = await this.dataSource.transaction(async (transactionalEntityManager) => {
            let count = 0;
            for (const airportData of airports) {
                try {
                    await this.getOrCreateAirport(airportData, transactionalEntityManager);
                    count++;
                } catch (error) {
                    this.logger.error(`Failed to upsert airport ${airportData.iataCode}: ${error.message}`);
                }
            }
            return count;
        });

        await this.refreshAirportCache();
        return upsertedCount;
    }

    async getAirportByIataCode(iataCode: string): Promise<Airport> {
        const airport = this.airportCache.get(iataCode) || await this.airportRepository.findByIataCode(iataCode);
        if (!airport) {
            throw new NotFoundException(`Airport with IATA code ${iataCode} not found`);
        }
        return airport;
    }

    private async ensureAirportsExist(originIataCode: string, destinationIataCode: string): Promise<void> {
        await Promise.all([
            this.getAirportByIataCode(originIataCode),
            this.getAirportByIataCode(destinationIataCode)
        ]);
    }

    async createFlightTicket(createFlightTicketDto: CreateFlightTicketDto): Promise<FlightTicketDto> {
        const errors = await this.validateFlightData(createFlightTicketDto);
        if (errors.length > 0) {
            throw new Error(`Invalid flight data: ${errors.join(', ')}`);
        }

        await this.ensureAirportsExist(createFlightTicketDto.origin, createFlightTicketDto.destination);

        const result = await this.bulkIngestFlightData([createFlightTicketDto]);
        if (result.successCount === 1) {
            return result.successfulTickets[0];
        } else {
            throw new Error('Failed to create flight ticket');
        }
    }
}