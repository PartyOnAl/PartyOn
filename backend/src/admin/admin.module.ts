import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payments } from 'generated-entities/entities/Payments';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ClubSuspensionRefundService } from './club-suspension-refund.service';

@Module({
  imports: [TypeOrmModule.forFeature([Payments])],
  controllers: [AdminController],
  providers: [AdminService, ClubSuspensionRefundService],
})
export class AdminModule {}
