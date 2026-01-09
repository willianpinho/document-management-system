import { Module, forwardRef } from '@nestjs/common';

import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { StorageModule } from '../storage/storage.module';
import { ProcessingModule } from '../processing/processing.module';

@Module({
  imports: [
    StorageModule,
    forwardRef(() => ProcessingModule),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
