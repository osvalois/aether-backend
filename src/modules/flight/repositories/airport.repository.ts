// src/modules/flight/repositories/airport.repository.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Airport } from '../entities/airport.entity';

@Injectable()
export class AirportRepository {
    constructor(
        @InjectRepository(Airport)
        private repository: Repository<Airport>
    ) {}

    async findByIataCode(iataCode: string): Promise<Airport> {
        const airport = await this.repository.findOne({ where: { iataCode } });
        if (!airport) {
            throw new NotFoundException(`Airport with IATA code ${iataCode} not found`);
        }
        return airport;
    }

    async createAirport(airportData: Partial<Airport>): Promise<Airport> {
        const airport = this.repository.create(airportData);
        return this.repository.save(airport);
    }

    async findAll(): Promise<Airport[]> {
        return this.repository.find();
    }

    async update(iataCode: string, airportData: Partial<Airport>): Promise<Airport> {
        const airport = await this.findByIataCode(iataCode);
        Object.assign(airport, airportData);
        return this.repository.save(airport);
    }

    async delete(iataCode: string): Promise<void> {
        const result = await this.repository.delete(iataCode);
        if (result.affected === 0) {
            throw new NotFoundException(`Airport with IATA code ${iataCode} not found`);
        }
    }

    async findByIataCodeWithRelations(iataCode: string): Promise<Airport> {
        const airport = await this.repository.findOne({
            where: { iataCode },
            relations: ['departingFlights', 'arrivingFlights']
        });
        if (!airport) {
            throw new NotFoundException(`Airport with IATA code ${iataCode} not found`);
        }
        return airport;
    }
}