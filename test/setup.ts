// test/setup.ts
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getConnection } from 'typeorm';

let app: INestApplication;

global.beforeAll(async () => {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe());
  await app.init();

  global.app = app;
});

global.afterAll(async () => {
  const connection = getConnection();
  await connection.synchronize(true);
  await connection.close();
  await app.close();
});