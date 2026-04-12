import 'reflect-metadata'
import * as dotenv from 'dotenv'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

dotenv.config()

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const port = Number(process.env.PORT) || 3000
  const corsOrigin = process.env.FRONTEND_ORIGIN?.trim()
  app.enableCors({
    origin: corsOrigin
      ? corsOrigin
      : ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type'],
  })
  await app.listen(port)
  console.log(`Backend is running on http://localhost:${port}`)
}

bootstrap().catch((err) => {
  console.error(err)
  process.exit(1)
})
