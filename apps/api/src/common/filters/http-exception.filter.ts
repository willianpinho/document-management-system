import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ErrorResponse {
  success: false;
  statusCode: number;
  message: string;
  error: string;
  path: string;
  timestamp: string;
  requestId?: string;
  details?: Record<string, unknown>;
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let message = exception.message;
    let details: Record<string, unknown> | undefined;

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const responseObj = exceptionResponse as Record<string, unknown>;
      if (typeof responseObj.message === 'string') {
        message = responseObj.message;
      } else if (Array.isArray(responseObj.message)) {
        message = responseObj.message[0] || exception.message;
        details = { validationErrors: responseObj.message };
      }
    }

    const errorResponse: ErrorResponse = {
      success: false,
      statusCode: status,
      message,
      error: HttpStatus[status] || 'Unknown Error',
      path: request.url,
      timestamp: new Date().toISOString(),
      requestId: request.headers['x-request-id'] as string | undefined,
      ...(details && { details }),
    };

    // Log errors (4xx as warnings, 5xx as errors)
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} - ${status} - ${message}`,
        exception.stack,
      );
    } else if (status >= 400) {
      this.logger.warn(`${request.method} ${request.url} - ${status} - ${message}`);
    }

    response.status(status).json(errorResponse);
  }
}
