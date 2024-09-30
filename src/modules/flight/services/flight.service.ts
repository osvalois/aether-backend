import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, EntityManager } from 'typeorm';
import { FlightTicket } from '../entities/flight-ticket.entity';
import { CreateFlightTicketDto, FlightTicketDto, UpdateFlightTicketDto, BulkIngestionResultDto } from '../dto/flight-ticket.dto';
import { AirportService } from './airport.service';
import { FlightDataProducer } from '../../../kafka/producers/flight-data.producer';
import { CacheService } from './cache.service';
import { NotificationService } from './notification.service';
import { FlightValidator } from '../validators/flight.validator';
import { ConfigService } from '@nestjs/config';
import { chunk } from 'lodash';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class FlightService {
    private readonly logger = new Logger(FlightService.name);

    constructor(
        @InjectRepository(FlightTicket)
        private readonly flightTicketRepository: Repository<FlightTicket>,
        private readonly airportService: AirportService,
        private readonly flightDataProducer: FlightDataProducer,
        private readonly dataSource: DataSource,
        private readonly cacheService: CacheService,
        private readonly notificationService: NotificationService,
        private readonly flightValidator: FlightValidator,
        private readonly configService: ConfigService
    ) {}

    async getAllFlights(): Promise<FlightTicket[]> {
        return this.flightTicketRepository.find();
    }
    async searchFlights(origin?: string, destination?: string): Promise<FlightTicketDto[]> {
        const cacheKey = `search:${origin || '*'}:${destination || '*'}`;
        const cachedResults = await this.cacheService.get(cacheKey);
        if (cachedResults) {
            return JSON.parse(cachedResults);
        }

        let query = this.flightTicketRepository.createQueryBuilder('flightTicket')
            .leftJoinAndSelect('flightTicket.originAirport', 'originAirport')
            .leftJoinAndSelect('flightTicket.destinationAirport', 'destinationAirport');

        if (origin) {
            query = query.andWhere('flightTicket.origin = :origin', { origin });
        }
        if (destination) {
            query = query.andWhere('flightTicket.destination = :destination', { destination });
        }

        const flightTickets = await query.getMany();
        const results = flightTickets.map(ticket => this.mapToFlightTicketDto(ticket));

        await this.cacheService.set(cacheKey, JSON.stringify(results), 300); // Cache for 5 minutes
        this.notificationService.notifyFlightSearchResults({ origin, destination, resultsCount: results.length });

        return results;
    }
    async getFlightTicket(id: string): Promise<FlightTicketDto> {
        const cachedTicket = await this.cacheService.getFlightTicket(id);
        if (cachedTicket) {
            this.notificationService.notifyFlightTicketRetrieved(cachedTicket);
            return cachedTicket;
        }

        const flightTicket = await this.flightTicketRepository.findOne({
            where: { id },
            relations: ['originAirport', 'destinationAirport']
        });

        if (!flightTicket) {
            throw new NotFoundException(`Flight ticket with ID ${id} not found`);
        }

        const dto = this.mapToFlightTicketDto(flightTicket);
        await this.cacheService.setFlightTicket(id, dto);
        this.notificationService.notifyFlightTicketRetrieved(dto);
        return dto;
    }

    async createFlightTicket(createFlightTicketDto: CreateFlightTicketDto): Promise<FlightTicketDto> {
        const errors = await this.flightValidator.validateCreateFlightData(createFlightTicketDto);
        if (errors.length > 0) {
            throw new Error(`Invalid flight data: ${errors.join(', ')}`);
        }

        await this.airportService.ensureAirportsExist(createFlightTicketDto.origin, createFlightTicketDto.destination);

        const ticket = await this.dataSource.transaction(async (transactionalEntityManager) => {
            const originAirport = await this.airportService.getOrCreateAirport(createFlightTicketDto.originAirport, transactionalEntityManager);
            const destinationAirport = await this.airportService.getOrCreateAirport(createFlightTicketDto.destinationAirport, transactionalEntityManager);
            
            const newTicket = transactionalEntityManager.create(FlightTicket, {
                ...createFlightTicketDto,
                originAirport,
                destinationAirport,
            });
            
            return await transactionalEntityManager.save(FlightTicket, newTicket);
        });

        const dto = this.mapToFlightTicketDto(ticket);
        await this.cacheService.setFlightTicket(dto.id, dto);
        await this.flightDataProducer.publishFlightData(ticket);
        this.notificationService.notifyNewFlightTicket(dto);
        
        return dto;
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
                existingTicket.originAirport = await this.airportService.getOrCreateAirport(updateData.originAirport, transactionalEntityManager);
            }
            if (updateData.destinationAirport) {
                existingTicket.destinationAirport = await this.airportService.getOrCreateAirport(updateData.destinationAirport, transactionalEntityManager);
            }

            Object.assign(existingTicket, updateData);
            await transactionalEntityManager.save(existingTicket);
        });

        const updatedDto = this.mapToFlightTicketDto(existingTicket);
        await this.cacheService.setFlightTicket(id, updatedDto);
        this.flightDataProducer.publishFlightData(existingTicket).catch(error => {
            this.logger.error(`Failed to publish updated ticket ${id} to Kafka: ${error.message}`);
            return this.cacheService.setBackloggedFlightTicket(id, updatedDto);
        });

        this.notificationService.notifyFlightTicketUpdated(updatedDto);

        return updatedDto;
    }

    async deleteFlightTicket(id: string): Promise<void> {
        const result = await this.flightTicketRepository.delete(id);
        if (result.affected === 0) {
            throw new NotFoundException(`Flight ticket with ID ${id} not found`);
        }
        await this.cacheService.deleteFlightTicket(id);

        this.notificationService.notifyFlightTicketDeleted(id);
    }

    async bulkDeleteFlightTickets(ids: string[]): Promise<{ deletedCount: number }> {
        const result = await this.flightTicketRepository.delete({ id: In(ids) });
        await Promise.all(ids.map(id => this.cacheService.deleteFlightTicket(id)));

        this.notificationService.notifyBulkFlightTicketsDeleted({
            deletedCount: result.affected || 0,
            ids,
        });

        return { deletedCount: result.affected || 0 };
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

        this.notificationService.notifyBulkIngestionResult(result);

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
        const originAirport = await this.airportService.getOrCreateAirport(ticketDto.originAirport, transactionalEntityManager);
        const destinationAirport = await this.airportService.getOrCreateAirport(ticketDto.destinationAirport, transactionalEntityManager);

        return transactionalEntityManager.create(FlightTicket, {
            ...ticketDto,
            originAirport,
            destinationAirport,
        });
    }

    private async publishAndCacheBatch(flightTickets: FlightTicketDto[]): Promise<void> {
        const publishPromises = flightTickets.map(ticket => 
            this.flightDataProducer.publishFlightData(this.mapDtoToEntity(ticket)).catch(error => {
                this.logger.error(`Failed to publish ticket ${ticket.id} to Kafka: ${error.message}`);
                return this.cacheService.setBackloggedFlightTicket(ticket.id, ticket);
            })
        );

        const cachePromises = flightTickets.map(ticket =>
            this.cacheService.setFlightTicket(ticket.id, ticket)
        );

        await Promise.all([...publishPromises, ...cachePromises]);

        this.notificationService.notifyNewFlightTickets(flightTickets);
    }

    async getAllFlightTickets(page: number = 1, limit: number = 10): Promise<{ tickets: FlightTicketDto[], total: number }> {
        const cacheKey = `all_tickets:${page}:${limit}`;
        const cachedResults = await this.cacheService.get(cacheKey);
        if (cachedResults) {
            const result = JSON.parse(cachedResults);
            this.notificationService.notifyAllFlightTicketsRetrieved({ page, limit, totalCount: result.total });
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

        await this.cacheService.set(cacheKey, JSON.stringify(result), 60); // Cache for 1 minute
        this.notificationService.notifyAllFlightTicketsRetrieved({ page, limit, totalCount: total });
        return result;
    }

    @Cron(CronExpression.EVERY_5_MINUTES)
    async processBackloggedData() {
        const backloggedTickets = await this.cacheService.getBackloggedFlightTickets();
        
        if (backloggedTickets.length === 0) {
            this.logger.log('No backlogged data to process');
            return;
        }

        let processedCount = 0;
        for (const ticket of backloggedTickets) {
            try {
                await this.flightDataProducer.publishFlightData(this.mapDtoToEntity(ticket));
                await this.cacheService.deleteBackloggedFlightTicket(ticket.id);
                processedCount++;
            } catch (error) {
                this.logger.error(`Failed to process backlogged ticket ${ticket.id}: ${error.message}`);
            }
        }

        this.notificationService.notifyBacklogProcessed({ processedCount });
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