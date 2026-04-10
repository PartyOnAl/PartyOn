import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import * as dotenv from 'dotenv';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { DatabaseModule } from './database/database.module';
import { SavedModule } from './saved/saved.module';
import { SuggestionsModule } from './suggestions/suggestions.module';
dotenv.config();

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    CatalogModule,
    SavedModule,
    SuggestionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
