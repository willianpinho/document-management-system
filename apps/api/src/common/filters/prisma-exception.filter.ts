import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

import type { ErrorResponse } from './http-exception.filter';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Database error occurred';

    // Map Prisma error codes to HTTP status and messages
    switch (exception.code) {
      case 'P2000':
        status = HttpStatus.BAD_REQUEST;
        message = 'The provided value is too long for the column type';
        break;

      case 'P2001':
        status = HttpStatus.NOT_FOUND;
        message = 'Record not found';
        break;

      case 'P2002':
        status = HttpStatus.CONFLICT;
        const target = exception.meta?.target as string[] | undefined;
        message = target
          ? `A record with this ${target.join(', ')} already exists`
          : 'A record with this value already exists';
        break;

      case 'P2003':
        status = HttpStatus.BAD_REQUEST;
        message = 'Foreign key constraint violation';
        break;

      case 'P2004':
        status = HttpStatus.BAD_REQUEST;
        message = 'Constraint failed';
        break;

      case 'P2005':
        status = HttpStatus.BAD_REQUEST;
        message = 'Invalid value for the field type';
        break;

      case 'P2006':
        status = HttpStatus.BAD_REQUEST;
        message = 'Invalid value provided';
        break;

      case 'P2011':
        status = HttpStatus.BAD_REQUEST;
        message = 'Null constraint violation';
        break;

      case 'P2014':
        status = HttpStatus.BAD_REQUEST;
        message = 'The change you are trying to make would violate the required relation';
        break;

      case 'P2015':
        status = HttpStatus.NOT_FOUND;
        message = 'Related record not found';
        break;

      case 'P2016':
        status = HttpStatus.BAD_REQUEST;
        message = 'Query interpretation error';
        break;

      case 'P2017':
        status = HttpStatus.BAD_REQUEST;
        message = 'Records for relation not connected';
        break;

      case 'P2018':
        status = HttpStatus.NOT_FOUND;
        message = 'Required connected records not found';
        break;

      case 'P2019':
        status = HttpStatus.BAD_REQUEST;
        message = 'Input error';
        break;

      case 'P2020':
        status = HttpStatus.BAD_REQUEST;
        message = 'Value out of range for the type';
        break;

      case 'P2021':
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message = 'Table does not exist';
        break;

      case 'P2022':
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message = 'Column does not exist';
        break;

      case 'P2023':
        status = HttpStatus.BAD_REQUEST;
        message = 'Inconsistent column data';
        break;

      case 'P2024':
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message = 'Connection pool timeout';
        break;

      case 'P2025':
        status = HttpStatus.NOT_FOUND;
        message = 'Record not found or no permission';
        break;

      default:
        this.logger.error(`Unhandled Prisma error: ${exception.code}`, exception.stack);
    }

    const errorResponse: ErrorResponse = {
      success: false,
      statusCode: status,
      message,
      error: HttpStatus[status] || 'Database Error',
      path: request.url,
      timestamp: new Date().toISOString(),
      requestId: request.headers['x-request-id'] as string | undefined,
    };

    this.logger.warn(`${request.method} ${request.url} - Prisma ${exception.code}: ${message}`);

    response.status(status).json(errorResponse);
  }
}
