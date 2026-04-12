import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bookmarks } from 'generated-entities/entities/Bookmarks';
import { CatalogModule } from '../catalog/catalog.module';
import { SavedController } from './saved.controller';
import { SavedService } from './saved.service';

@Module({
  imports: [CatalogModule, TypeOrmModule.forFeature([Bookmarks])],
  controllers: [SavedController],
  providers: [SavedService],
})
export class SavedModule {}
