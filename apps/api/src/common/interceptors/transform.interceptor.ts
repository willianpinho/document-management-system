import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';

export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrevious: boolean;
    };
    [key: string]: unknown;
  };
  timestamp: string;
  requestId?: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, SuccessResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<SuccessResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();
    const requestId = request.headers['x-request-id'] as string | undefined;

    return next.handle().pipe(
      map((response) => {
        // If response already has success/data structure, preserve it
        if (response && typeof response === 'object' && 'success' in response) {
          return response;
        }

        // Handle paginated responses (they have data + meta structure)
        if (response && typeof response === 'object' && 'data' in response && 'meta' in response) {
          return {
            success: true as const,
            data: response.data,
            meta: response.meta,
            timestamp: new Date().toISOString(),
            ...(requestId && { requestId }),
          };
        }

        // Standard response wrapping
        return {
          success: true as const,
          data: response,
          timestamp: new Date().toISOString(),
          ...(requestId && { requestId }),
        };
      }),
    );
  }
}
