import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Airport } from '../entities/airport.entity';
import { AirportRepository } from '../repositories/airport.repository';
import { CacheService } from './cache.service';
import { NotificationService } from './notification.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CreateAirportDto, UpdateAirportDto } from '../dto/airport.dto';
import { AirportDto } from '../dto/flight-ticket.dto';

@Injectable()
export class AirportService {
    private readonly logger = new Logger(AirportService.name);
    private airportCache: Map<string, Airport> = new Map();

    constructor(
        @InjectRepository(Airport)
        private readonly airportRepository: Repository<Airport>,
        private readonly airportCustomRepository: AirportRepository,
        private readonly cacheService: CacheService,
        private readonly notificationService: NotificationService
    ) {
        this.initializeAirportCache();
    }

    private async initializeAirportCache(): Promise<void> {
        const airports = await this.airportCustomRepository.findAll();
        airports.forEach(airport => this.airportCache.set(airport.iataCode, airport));
    }

    @Cron(CronExpression.EVERY_HOUR)
    async refreshAirportCache(): Promise<void> {
        this.logger.log('Refreshing airport cache');
        await this.initializeAirportCache();
    }

    async getAllAirports(): Promise<AirportDto[]> {
        const airports = await this.airportRepository.find();
        return airports.map(airport => this.mapToAirportDto(airport));
    }

    async getAirportByIataCode(iataCode: string): Promise<AirportDto> {
        const cachedAirport = this.airportCache.get(iataCode);
        if (cachedAirport) {
            return this.mapToAirportDto(cachedAirport);
        }

        const airport = await this.airportCustomRepository.findByIataCode(iataCode);
        if (!airport) {
            throw new NotFoundException(`Airport with IATA code ${iataCode} not found`);
        }

        this.airportCache.set(iataCode, airport);
        return this.mapToAirportDto(airport);
    }

    async createAirport(createAirportDto: CreateAirportDto): Promise<AirportDto> {
        const existingAirport = await this.airportCustomRepository.findByIataCode(createAirportDto.iataCode);
        if (existingAirport) {
            throw new Error(`Airport with IATA code ${createAirportDto.iataCode} already exists`);
        }

        const newAirport = this.airportRepository.create(createAirportDto);
        const savedAirport = await this.airportRepository.save(newAirport);

        this.airportCache.set(savedAirport.iataCode, savedAirport);
        const airportDto = this.mapToAirportDto(savedAirport);
        
        await this.cacheService.setAirport(savedAirport.iataCode, airportDto);
        this.notificationService.notifyNewAirport(airportDto);

        return airportDto;
    }

    async updateAirport(iataCode: string, updateAirportDto: UpdateAirportDto): Promise<AirportDto> {
        const airport = await this.airportCustomRepository.findByIataCode(iataCode);
        if (!airport) {
            throw new NotFoundException(`Airport with IATA code ${iataCode} not found`);
        }

        Object.assign(airport, updateAirportDto);
        const updatedAirport = await this.airportRepository.save(airport);

        this.airportCache.set(updatedAirport.iataCode, updatedAirport);
        const airportDto = this.mapToAirportDto(updatedAirport);
        
        await this.cacheService.setAirport(updatedAirport.iataCode, airportDto);
        this.notificationService.notifyAirportUpdated(airportDto);

        return airportDto;
    }

    async deleteAirport(iataCode: string): Promise<void> {
        const result = await this.airportRepository.delete({ iataCode });
        if (result.affected === 0) {
            throw new NotFoundException(`Airport with IATA code ${iataCode} not found`);
        }

        this.airportCache.delete(iataCode);
        await this.cacheService.deleteAirport(iataCode);
        this.notificationService.notifyAirportDeleted(iataCode);
    }

    async getOrCreateAirport(
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

    async ensureAirportsExist(originIataCode: string, destinationIataCode: string): Promise<void> {
        const [originAirport, destinationAirport] = await Promise.all([
            this.getAirportByIataCode(originIataCode),
            this.getAirportByIataCode(destinationIataCode)
        ]);

        if (!originAirport) {
            throw new NotFoundException(`Origin airport with IATA code ${originIataCode} not found`);
        }
        if (!destinationAirport) {
            throw new NotFoundException(`Destination airport with IATA code ${destinationIataCode} not found`);
        }
    }

    async bulkUpsertAirports(airports: CreateAirportDto[]): Promise<number> {
        let upsertedCount = 0;

        for (const airportData of airports) {
            try {
                const existingAirport = await this.airportCustomRepository.findByIataCode(airportData.iataCode);
                if (existingAirport) {
                    await this.updateAirport(airportData.iataCode, airportData);
                } else {
                    await this.createAirport(airportData);
                }
                upsertedCount++;
            } catch (error) {
                this.logger.error(`Failed to upsert airport ${airportData.iataCode}: ${error.message}`);
            }
        }

        await this.refreshAirportCache();
        this.notificationService.notifyBulkAirportsUpserted(upsertedCount);
        return upsertedCount;
    }

    private mapToAirportDto(airport: Airport): AirportDto {
        return {
            iataCode: airport.iataCode,
            name: airport.name,
            latitude: airport.latitude,
            longitude: airport.longitude
        };
    }
}