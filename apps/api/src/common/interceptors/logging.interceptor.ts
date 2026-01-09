import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url, ip } = request;
    const userAgent = request.get('user-agent') || '';
    const requestId = request.headers['x-request-id'] || '-';

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const { statusCode } = response;
          const contentLength = response.get('content-length') || '0';

          this.logger.log(
            `${method} ${url} ${statusCode} ${contentLength}b ${duration}ms - ${ip} "${userAgent}" [${requestId}]`,
          );
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const statusCode = error.status || 500;

          this.logger.warn(
            `${method} ${url} ${statusCode} ${duration}ms - ${ip} "${userAgent}" [${requestId}] - ${error.message}`,
          );
        },
      }),
    );
  }
}
