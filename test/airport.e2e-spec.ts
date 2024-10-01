import * as request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { CreateAirportDto } from 'src/modules/flight/dto/airport.dto';

describe('Airport Module (e2e)', () => {
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

  describe('/airports (POST)', () => {
    it('should create a new airport', () => {
      const createAirportDto: CreateAirportDto = {
        iataCode: 'LAX',
        name: 'Los Angeles International',
        latitude: 33.9416,
        longitude: -118.4085,
        city: 'Los Angeles',
        country: 'United States',
      };

      return request(app.getHttpServer())
        .post('/airports')
        .send(createAirportDto)
        .expect(201)
        .expect((res) => {
          expect(res.body.iataCode).toBe(createAirportDto.iataCode);
          expect(res.body.name).toBe(createAirportDto.name);
        });
    });
  });

  describe('/airports (GET)', () => {
    it('should return all airports', () => {
      return request(app.getHttpServer())
        .get('/airports')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });

  describe('/airports/:iataCode (GET)', () => {
    it('should return an airport by IATA code', async () => {
      // First, create an airport
      const createResponse = await request(app.getHttpServer())
        .post('/airports')
        .send({
          iataCode: 'SFO',
          name: 'San Francisco International',
          latitude: 37.6213,
          longitude: -122.3790,
          city: 'San Francisco',
          country: 'United States',
        });

      const createdAirportIataCode = createResponse.body.iataCode;

      // Then, retrieve the created airport
      return request(app.getHttpServer())
        .get(`/airports/${createdAirportIataCode}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.iataCode).toBe(createdAirportIataCode);
          expect(res.body.name).toBe('San Francisco International');
        });
    });

    it('should return 404 for non-existent airport', () => {
      return request(app.getHttpServer())
        .get('/airports/XXX')
        .expect(404);
    });
  });

  describe('/airports/:iataCode (PUT)', () => {
    it('should update an airport', async () => {
      // First, create an airport
      const createResponse = await request(app.getHttpServer())
        .post('/airports')
        .send({
          iataCode: 'JFK',
          name: 'John F. Kennedy International',
          latitude: 40.6413,
          longitude: -73.7781,
          city: 'New York',
          country: 'United States',
        });

      const createdAirportIataCode = createResponse.body.iataCode;

      // Then, update the created airport
      return request(app.getHttpServer())
        .put(`/airports/${createdAirportIataCode}`)
        .send({ name: 'JFK International' })
        .expect(200)
        .expect((res) => {
            expect(res.body.iataCode).toBe(createdAirportIataCode);
            expect(res.body.name).toBe('JFK International');
          });
      });
    });
  
    describe('/airports/:iataCode (DELETE)', () => {
      it('should delete an airport', async () => {
        // First, create an airport
        const createResponse = await request(app.getHttpServer())
          .post('/airports')
          .send({
            iataCode: 'ORD',
            name: "O'Hare International",
            latitude: 41.9742,
            longitude: -87.9073,
            city: 'Chicago',
            country: 'United States',
          });
  
        const createdAirportIataCode = createResponse.body.iataCode;
  
        // Then, delete the created airport
        await request(app.getHttpServer())
          .delete(`/airports/${createdAirportIataCode}`)
          .expect(204);
  
        // Finally, try to retrieve the deleted airport (should return 404)
        return request(app.getHttpServer())
          .get(`/airports/${createdAirportIataCode}`)
          .expect(404);
      });
    });
  
    describe('/airports/bulk (POST)', () => {
      it('should create multiple airports', () => {
        const bulkCreateDto = {
          airports: [
            {
              iataCode: 'LAX',
              name: 'Los Angeles International',
              latitude: 33.9416,
              longitude: -118.4085,
              city: 'Los Angeles',
              country: 'United States',
            },
            {
              iataCode: 'SFO',
              name: 'San Francisco International',
              latitude: 37.6213,
              longitude: -122.3790,
              city: 'San Francisco',
              country: 'United States',
            },
          ],
        };
  
        return request(app.getHttpServer())
          .post('/airports/bulk')
          .send(bulkCreateDto)
          .expect(201)
          .expect((res) => {
            expect(res.body.upsertedCount).toBe(2);
          });
      });
    });
  });