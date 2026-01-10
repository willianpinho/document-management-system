import { Module } from '@nestjs/common';

import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [RealtimeModule],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
