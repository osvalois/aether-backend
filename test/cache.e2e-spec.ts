import * as request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { CacheService } from 'src/modules/flight/services/cache.service';

describe('Cache Module (e2e)', () => {
  let app: INestApplication;
  let cacheService: CacheService;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    cacheService = moduleFixture.get<CacheService>(CacheService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Cache operations', () => {
    it('should set and get a flight ticket in cache', async () => {
      const mockFlightTicket = {
        id: '1',
        origin: 'LAX',
        destination: 'JFK',
        airline: 'AA',
        flightNum: 'AA123',
        originAirport: { iataCode: 'LAX', name: 'Los Angeles International', latitude: 33.9416, longitude: -118.4085 },
        destinationAirport: { iataCode: 'JFK', name: 'John F. Kennedy International', latitude: 40.6413, longitude: -73.7781 },
      };

      await cacheService.setFlightTicket('1', mockFlightTicket);
      const cachedTicket = await cacheService.getFlightTicket('1');

      expect(cachedTicket).toEqual(mockFlightTicket);
    });

    it('should delete a flight ticket from cache', async () => {
      const mockFlightTicket = {
        id: '2',
        origin: 'SFO',
        destination: 'ORD',
        airline: 'UA',
        flightNum: 'UA456',
        originAirport: { iataCode: 'SFO', name: 'San Francisco International', latitude: 37.6213, longitude: -122.3790 },
        destinationAirport: { iataCode: 'ORD', name: "O'Hare International", latitude: 41.9742, longitude: -87.9073 },
      };

      await cacheService.setFlightTicket('2', mockFlightTicket);
      await cacheService.deleteFlightTicket('2');
      const cachedTicket = await cacheService.getFlightTicket('2');

      expect(cachedTicket).toBeNull();
    });

    it('should set and get an airport in cache', async () => {
      const mockAirport = {
        iataCode: 'LAX',
        name: 'Los Angeles International',
        latitude: 33.9416,
        longitude: -118.4085,
      };

      await cacheService.setAirport('LAX', mockAirport);
      const cachedAirport = await cacheService.getAirport('LAX');

      expect(cachedAirport).toEqual(mockAirport);
    });

    it('should delete an airport from cache', async () => {
      const mockAirport = {
        iataCode: 'SFO',
        name: 'San Francisco International',
        latitude: 37.6213,
        longitude: -122.3790,
      };

      await cacheService.setAirport('SFO', mockAirport);
      await cacheService.deleteAirport('SFO');
      const cachedAirport = await cacheService.getAirport('SFO');

      expect(cachedAirport).toBeNull();
    });

    it('should handle backlogged flight tickets', async () => {
      const mockFlightTicket = {
        id: '3',
        origin: 'JFK',
        destination: 'LAX',
        airline: 'DL',
        flightNum: 'DL789',
        originAirport: { iataCode: 'JFK', name: 'John F. Kennedy International', latitude: 40.6413, longitude: -73.7781 },
        destinationAirport: { iataCode: 'LAX', name: 'Los Angeles International', latitude: 33.9416, longitude: -118.4085 },
      };

      await cacheService.setBackloggedFlightTicket('3', mockFlightTicket);
      const backloggedTickets = await cacheService.getBackloggedFlightTickets();

      expect(backloggedTickets).toContainEqual(mockFlightTicket);

      await cacheService.deleteBackloggedFlightTicket('3');
      const updatedBackloggedTickets = await cacheService.getBackloggedFlightTickets();

      expect(updatedBackloggedTickets).not.toContainEqual(mockFlightTicket);
    });

    it('should set and get all tickets cache', async () => {
      const mockAllTicketsData = {
        tickets: [
          { id: '1', origin: 'LAX', destination: 'JFK' },
          { id: '2', origin: 'SFO', destination: 'ORD' },
        ],
        total: 2,
      };

      await cacheService.setAllTicketsCache(1, 10, JSON.stringify(mockAllTicketsData));
      const cachedAllTickets = await cacheService.getAllTicketsCache(1, 10);

      expect(JSON.parse(cachedAllTickets!)).toEqual(mockAllTicketsData);
    });
  });
});