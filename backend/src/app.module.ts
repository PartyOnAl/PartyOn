import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as dotenv from 'dotenv';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
dotenv.config();


@Module({
  imports:[
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
        return {
          type: 'postgres' as const,
          ...(hasDatabaseUrl
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
          autoLoadEntities: true,
          synchronize: true, // dev only
        };
      },
    }),
    AuthModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
