import { Injectable, Logger } from '@nestjs/common';
import { AirportDto, FlightTicketDto } from '../dto/flight-ticket.dto';

import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class CacheService {
    private readonly logger = new Logger(CacheService.name);
    private readonly FLIGHT_TICKET_PREFIX = 'flight_ticket:';
    private readonly AIRPORT_PREFIX = 'airport:';
    private readonly BACKLOG_PREFIX = 'flight_data_backlog:';
    private readonly ALL_TICKETS_PREFIX = 'all_tickets:';

    constructor(private readonly redisService: RedisService) {}

    // Flight Ticket Cache Operations
    async getFlightTicket(id: string): Promise<FlightTicketDto | null> {
        const cachedTicket = await this.redisService.get(`${this.FLIGHT_TICKET_PREFIX}${id}`);
        return cachedTicket ? JSON.parse(cachedTicket) : null;
    }

    async setFlightTicket(id: string, ticket: FlightTicketDto, ttl: number = 3600): Promise<void> {
        await this.redisService.set(`${this.FLIGHT_TICKET_PREFIX}${id}`, JSON.stringify(ticket), ttl);
    }

    async deleteFlightTicket(id: string): Promise<void> {
        await this.redisService.del(`${this.FLIGHT_TICKET_PREFIX}${id}`);
    }

    // Airport Cache Operations
    async getAirport(iataCode: string): Promise<AirportDto | null> {
        const cachedAirport = await this.redisService.get(`${this.AIRPORT_PREFIX}${iataCode}`);
        return cachedAirport ? JSON.parse(cachedAirport) : null;
    }

    async setAirport(iataCode: string, airport: AirportDto, ttl: number = 86400): Promise<void> {
        await this.redisService.set(`${this.AIRPORT_PREFIX}${iataCode}`, JSON.stringify(airport), ttl);
    }

    async deleteAirport(iataCode: string): Promise<void> {
        await this.redisService.del(`${this.AIRPORT_PREFIX}${iataCode}`);
    }

    // Backlog Operations
    async setBackloggedFlightTicket(id: string, ticket: FlightTicketDto): Promise<void> {
        await this.redisService.set(`${this.BACKLOG_PREFIX}${id}`, JSON.stringify(ticket));
    }

    async getBackloggedFlightTickets(): Promise<FlightTicketDto[]> {
        const backlogKeys = await this.redisService.getKeysByPattern(`${this.BACKLOG_PREFIX}*`);
        const backloggedTickets: FlightTicketDto[] = [];

        for (const key of backlogKeys) {
            const ticketData = await this.redisService.get(key);
            if (ticketData) {
                backloggedTickets.push(JSON.parse(ticketData));
            }
        }

        return backloggedTickets;
    }

    async deleteBackloggedFlightTicket(id: string): Promise<void> {
        await this.redisService.del(`${this.BACKLOG_PREFIX}${id}`);
    }

    // All Tickets Cache Operations
    async getAllTicketsCache(page: number, limit: number): Promise<string | null> {
        return await this.redisService.get(`${this.ALL_TICKETS_PREFIX}${page}:${limit}`);
    }

    async setAllTicketsCache(page: number, limit: number, data: string, ttl: number = 60): Promise<void> {
        await this.redisService.set(`${this.ALL_TICKETS_PREFIX}${page}:${limit}`, data, ttl);
    }

    // Generic Cache Operations
    async get(key: string): Promise<string | null> {
        return await this.redisService.get(key);
    }

    async set(key: string, value: string, ttl?: number): Promise<void> {
        await this.redisService.set(key, value, ttl);
    }

    async del(key: string): Promise<void> {
        await this.redisService.del(key);
    }

    // Cache Cleanup
    async cleanupOldEntries(): Promise<void> {
        this.logger.log('Starting cache cleanup');

        const patterns = [
            `${this.FLIGHT_TICKET_PREFIX}*`,
            `${this.AIRPORT_PREFIX}*`,
            `${this.ALL_TICKETS_PREFIX}*`
        ];

        for (const pattern of patterns) {
            const keys = await this.redisService.getKeysByPattern(pattern);
            for (const key of keys) {
                const value = await this.redisService.get(key);
                if (!value) {
                    await this.redisService.del(key);
                    this.logger.debug(`Deleted expired key: ${key}`);
                }
            }
        }

        this.logger.log('Cache cleanup completed');
    }
}