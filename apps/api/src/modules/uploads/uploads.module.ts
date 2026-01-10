import { Module } from '@nestjs/common';

import { PrismaModule } from '@/common/prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [PrismaModule, StorageModule, RealtimeModule],
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
