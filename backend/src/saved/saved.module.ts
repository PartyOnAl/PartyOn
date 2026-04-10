import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { SavedController } from './saved.controller';
import { SavedService } from './saved.service';

@Module({
  imports: [CatalogModule],
  controllers: [SavedController],
  providers: [SavedService],
})
export class SavedModule {}
