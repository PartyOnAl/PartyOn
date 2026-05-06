import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import * as dotenv from 'dotenv';
import { AppModule } from './app.module';
import * as express from 'express';

dotenv.config();
console.log("test",process.env.DATABASE_URL);
async function bootstrap() {
  console.log(process.env.DATABASE_URL);
  const app = await NestFactory.create(AppModule);
  
  const port = process.env.PORT || 3000;

  app.enableCors({
    origin: 'http://localhost:5173',
    credentials: true,
  });
  
  const express = require('express');
  app.use('/payment/webhook', express.raw({ type: 'application/json' }));

  await app.listen(port,'0.0.0.0');
  console.log(`Backend is running on http://localhost:${port}`);
}

/*export const AppDataSource = new DataSource({
  type: 'postgres',
  ...(process.env.DATABASE_URL
    ? {
        url: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      }
    : {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
      }),
  entities: ['src/entities/*.ts'],
  synchronize: true,
});*/


/*async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000);
}
  */

bootstrap();
