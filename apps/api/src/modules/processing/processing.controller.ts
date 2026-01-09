/**
 * Processing Controller
 *
 * REST API endpoints for managing document processing jobs and queues.
 */

import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

import { ProcessingService } from './processing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QUEUE_NAMES } from './queues/queue.constants';

@ApiTags('processing')
@Controller('processing')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ProcessingController {
  constructor(private readonly processingService: ProcessingService) {}

  // ==========================================
  // Job Management Endpoints
  // ==========================================

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Get processing job status' })
  @ApiParam({ name: 'id', description: 'Processing job ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Job details including queue state and progress',
  })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async getJobStatus(@Param('id') jobId: string) {
    return this.processingService.getJobStatus(jobId);
  }

  @Post('jobs/:id/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry a failed job' })
  @ApiParam({ name: 'id', description: 'Processing job ID' })
  @ApiResponse({ status: 200, description: 'Job queued for retry' })
  @ApiResponse({ status: 400, description: 'Job cannot be retried (not failed or max attempts reached)' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async retryJob(@Param('id') jobId: string) {
    return this.processingService.retryJob(jobId);
  }

  @Delete('jobs/:id')
  @ApiOperation({ summary: 'Cancel a pending job' })
  @ApiParam({ name: 'id', description: 'Processing job ID' })
  @ApiResponse({ status: 200, description: 'Job cancelled' })
  @ApiResponse({ status: 400, description: 'Job cannot be cancelled (not pending)' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async cancelJob(@Param('id') jobId: string) {
    return this.processingService.cancelJob(jobId);
  }

  @Get('jobs/failed')
  @ApiOperation({ summary: 'Get list of failed jobs' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max jobs to return (default: 50)' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Offset for pagination (default: 0)' })
  @ApiResponse({ status: 200, description: 'List of failed jobs' })
  async getFailedJobs(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.processingService.getFailedJobs(
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  // ==========================================
  // Queue Statistics Endpoints
  // ==========================================

  @Get('queues/stats')
  @ApiOperation({ summary: 'Get aggregated queue statistics for all queues' })
  @ApiResponse({
    status: 200,
    description: 'Queue statistics including waiting, active, completed, failed counts',
  })
  async getQueueStats() {
    return this.processingService.getQueueStats();
  }

  @Get('queues/:name/stats')
  @ApiOperation({ summary: 'Get statistics for a specific queue' })
  @ApiParam({
    name: 'name',
    description: 'Queue name',
    enum: Object.values(QUEUE_NAMES),
  })
  @ApiResponse({ status: 200, description: 'Queue statistics' })
  @ApiResponse({ status: 404, description: 'Queue not found' })
  async getQueueStatsByName(@Param('name') queueName: string) {
    return this.processingService.getQueueStatsByName(queueName);
  }

  // ==========================================
  // Queue Control Endpoints
  // ==========================================

  @Post('queues/:name/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pause a queue (stop processing new jobs)' })
  @ApiParam({
    name: 'name',
    description: 'Queue name',
    enum: Object.values(QUEUE_NAMES),
  })
  @ApiResponse({ status: 200, description: 'Queue paused' })
  @ApiResponse({ status: 404, description: 'Queue not found' })
  async pauseQueue(@Param('name') queueName: string) {
    return this.processingService.pauseQueue(queueName);
  }

  @Post('queues/:name/resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resume a paused queue' })
  @ApiParam({
    name: 'name',
    description: 'Queue name',
    enum: Object.values(QUEUE_NAMES),
  })
  @ApiResponse({ status: 200, description: 'Queue resumed' })
  @ApiResponse({ status: 404, description: 'Queue not found' })
  async resumeQueue(@Param('name') queueName: string) {
    return this.processingService.resumeQueue(queueName);
  }

  @Delete('queues/:name/drain')
  @ApiOperation({ summary: 'Drain a queue (remove all waiting and delayed jobs)' })
  @ApiParam({
    name: 'name',
    description: 'Queue name',
    enum: Object.values(QUEUE_NAMES),
  })
  @ApiResponse({ status: 200, description: 'Queue drained' })
  @ApiResponse({ status: 404, description: 'Queue not found' })
  async drainQueue(@Param('name') queueName: string) {
    return this.processingService.drainQueue(queueName);
  }

  // ==========================================
  // Cleanup Endpoints
  // ==========================================

  @Post('cleanup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clean up old completed and failed jobs' })
  @ApiQuery({
    name: 'olderThanDays',
    required: false,
    type: Number,
    description: 'Remove jobs older than N days (default: 7)',
  })
  @ApiResponse({
    status: 200,
    description: 'Cleanup result with count of removed jobs',
  })
  async cleanOldJobs(@Query('olderThanDays') olderThanDays?: string) {
    return this.processingService.cleanOldJobs(
      olderThanDays ? parseInt(olderThanDays, 10) : 7,
    );
  }

  // ==========================================
  // Queue List Endpoint
  // ==========================================

  @Get('queues')
  @ApiOperation({ summary: 'Get list of available queue names' })
  @ApiResponse({ status: 200, description: 'List of queue names' })
  async getQueues() {
    return {
      queues: Object.entries(QUEUE_NAMES).map(([key, name]) => ({
        key,
        name,
        description: this.getQueueDescription(key),
      })),
    };
  }

  /**
   * Get description for a queue
   */
  private getQueueDescription(key: string): string {
    const descriptions: Record<string, string> = {
      OCR: 'Text extraction using AWS Textract (rate limited: 10/min, concurrency: 2)',
      PDF: 'PDF operations - split, merge, extract (concurrency: 5)',
      THUMBNAIL: 'Image thumbnail generation (concurrency: 10)',
      EMBEDDING: 'Vector embedding generation for semantic search (rate limited: 60/min, concurrency: 3)',
      AI_CLASSIFY: 'AI-powered document classification using GPT-4 (rate limited: 20/min, concurrency: 2)',
    };
    return descriptions[key] || 'Unknown queue';
  }
}
