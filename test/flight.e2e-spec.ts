import * as request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { CreateFlightTicketDto, FlightTicketDto } from 'src/modules/flight/dto/flight-ticket.dto';

describe('Flight Module (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/flights (POST)', () => {
    it('should create a new flight ticket', () => {
      const createFlightTicketDto: CreateFlightTicketDto = {
        origin: 'LAX',
        destination: 'JFK',
        airline: 'AA',
        flightNum: 'AA123',
        originAirport: { iataCode: 'LAX', name: 'Los Angeles International', latitude: 33.9416, longitude: -118.4085 },
        destinationAirport: { iataCode: 'JFK', name: 'John F. Kennedy International', latitude: 40.6413, longitude: -73.7781 },
      };

      return request(app.getHttpServer())
        .post('/flights')
        .send(createFlightTicketDto)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.origin).toBe(createFlightTicketDto.origin);
          expect(res.body.destination).toBe(createFlightTicketDto.destination);
        });
    });
  });

  describe('/flights (GET)', () => {
    it('should return all flight tickets', () => {
      return request(app.getHttpServer())
        .get('/flights')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body.tickets)).toBe(true);
          expect(res.body).toHaveProperty('total');
        });
    });

    it('should search flights by origin and destination', () => {
      return request(app.getHttpServer())
        .get('/flights?origin=LAX&destination=JFK')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body.tickets)).toBe(true);
          res.body.tickets.forEach((ticket: FlightTicketDto) => {
            expect(ticket.origin).toBe('LAX');
            expect(ticket.destination).toBe('JFK');
          });
        });
    });
  });

  describe('/flights/:id (GET)', () => {
    it('should return a flight ticket by id', async () => {
      // First, create a flight ticket
      const createResponse = await request(app.getHttpServer())
        .post('/flights')
        .send({
          origin: 'SFO',
          destination: 'NYC',
          airline: 'UA',
          flightNum: 'UA456',
          originAirport: { iataCode: 'SFO', name: 'San Francisco International', latitude: 37.6213, longitude: -122.3790 },
          destinationAirport: { iataCode: 'NYC', name: 'New York City', latitude: 40.7128, longitude: -74.0060 },
        });

      const createdTicketId = createResponse.body.id;

      // Then, retrieve the created ticket
      return request(app.getHttpServer())
        .get(`/flights/${createdTicketId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(createdTicketId);
          expect(res.body.origin).toBe('SFO');
          expect(res.body.destination).toBe('NYC');
        });
    });

    it('should return 404 for non-existent flight ticket', () => {
      return request(app.getHttpServer())
        .get('/flights/non-existent-id')
        .expect(404);
    });
  });

  describe('/flights/:id (PUT)', () => {
    it('should update a flight ticket', async () => {
      // First, create a flight ticket
      const createResponse = await request(app.getHttpServer())
        .post('/flights')
        .send({
          origin: 'LAX',
          destination: 'SFO',
          airline: 'AA',
          flightNum: 'AA789',
          originAirport: { iataCode: 'LAX', name: 'Los Angeles International', latitude: 33.9416, longitude: -118.4085 },
          destinationAirport: { iataCode: 'SFO', name: 'San Francisco International', latitude: 37.6213, longitude: -122.3790 },
        });

      const createdTicketId = createResponse.body.id;

      // Then, update the created ticket
      return request(app.getHttpServer())
        .put(`/flights/${createdTicketId}`)
        .send({ airline: 'UA', flightNum: 'UA789' })
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(createdTicketId);
          expect(res.body.airline).toBe('UA');
          expect(res.body.flightNum).toBe('UA789');
        });
    });
  });

  describe('/flights/:id (DELETE)', () => {
    it('should delete a flight ticket', async () => {
      // First, create a flight ticket
      const createResponse = await request(app.getHttpServer())
        .post('/flights')
        .send({
          origin: 'JFK',
          destination: 'LAX',
          airline: 'DL',
          flightNum: 'DL123',
          originAirport: { iataCode: 'JFK', name: 'John F. Kennedy International', latitude: 40.6413, longitude: -73.7781 },
          destinationAirport: { iataCode: 'LAX', name: 'Los Angeles International', latitude: 33.9416, longitude: -118.4085 },
        });

      const createdTicketId = createResponse.body.id;

      // Then, delete the created ticket
      await request(app.getHttpServer())
        .delete(`/flights/${createdTicketId}`)
        .expect(204);

      // Finally, try to retrieve the deleted ticket (should return 404)
      return request(app.getHttpServer())
        .get(`/flights/${createdTicketId}`)
        .expect(404);
    });
  });

  describe('/flights/bulk (POST)', () => {
    it('should create multiple flight tickets', () => {
      const bulkCreateDto = {
        flightTickets: [
          {
            origin: 'LAX',
            destination: 'JFK',
            airline: 'AA',
            flightNum: 'AA123',
            originAirport: { iataCode: 'LAX', name: 'Los Angeles International', latitude: 33.9416, longitude: -118.4085 },
            destinationAirport: { iataCode: 'JFK', name: 'John F. Kennedy International', latitude: 40.6413, longitude: -73.7781 },
          },
          {
            origin: 'SFO',
            destination: 'ORD',
            airline: 'UA',
            flightNum: 'UA456',
            originAirport: { iataCode: 'SFO', name: 'San Francisco International', latitude: 37.6213, longitude: -122.3790 },
            destinationAirport: { iataCode: 'ORD', name: "O'Hare International", latitude: 41.9742, longitude: -87.9073 },
          },
        ],
      };

      return request(app.getHttpServer())
        .post('/flights/bulk')
        .send(bulkCreateDto)
        .expect(201)
        .expect((res) => {
          expect(res.body.successCount).toBe(2);
          expect(res.body.failureCount).toBe(0);
          expect(Array.isArray(res.body.successfulTickets)).toBe(true);
          expect(res.body.successfulTickets).toHaveLength(2);
        });
    });
  });

  describe('/flights/bulk (DELETE)', () => {
    it('should delete multiple flight tickets', async () => {
      // First, create some flight tickets
      const createResponse = await request(app.getHttpServer())
        .post('/flights/bulk')
        .send({
          flightTickets: [
            {
              origin: 'LAX',
              destination: 'JFK',
              airline: 'AA',
              flightNum: 'AA123',
              originAirport: { iataCode: 'LAX', name: 'Los Angeles International', latitude: 33.9416, longitude: -118.4085 },
              destinationAirport: { iataCode: 'JFK', name: 'John F. Kennedy International', latitude: 40.6413, longitude: -73.7781 },
            },
            {
              origin: 'SFO',
              destination: 'ORD',
              airline: 'UA',
              flightNum: 'UA456',
              originAirport: { iataCode: 'SFO', name: 'San Francisco International', latitude: 37.6213, longitude: -122.3790 },
              destinationAirport: { iataCode: 'ORD', name: "O'Hare International", latitude: 41.9742, longitude: -87.9073 },
            },
          ],
        });

      const createdTicketIds = createResponse.body.successfulTickets.map((ticket: FlightTicketDto) => ticket.id);

      // Then, delete the created tickets
      return request(app.getHttpServer())
        .delete('/flights/bulk')
        .send(createdTicketIds)
        .expect(200)
        .expect((res) => {
          expect(res.body.deletedCount).toBe(2);
        });
    });
  });
});