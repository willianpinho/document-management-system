import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { createRedisAdapter } from './modules/realtime/adapters/redis.adapter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  // Configure WebSocket adapter with Redis for horizontal scaling
  const redisAdapter = await createRedisAdapter(app);
  app.useWebSocketAdapter(redisAdapter);
  logger.log('WebSocket adapter configured');

  // Security headers - disable strict CSP in development to allow Swagger UI
  app.use(
    helmet({
      contentSecurityPolicy: nodeEnv === 'production' ? {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          scriptSrc: ["'self'"],
        },
      } : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // CORS configuration
  const corsOrigins = configService.get<string>('CORS_ORIGINS', 'http://localhost:3000');
  app.enableCors({
    origin: corsOrigins.split(',').map((origin) => origin.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Organization-ID'],
  });

  // API Versioning
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      validationError: {
        target: false,
        value: false,
      },
    }),
  );

  // Global exception filters (order matters - most specific last)
  app.useGlobalFilters(new HttpExceptionFilter(), new PrismaExceptionFilter());

  // Global interceptors
  app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());

  // Swagger Documentation (non-production only)
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('DMS API')
      .setDescription(
        `
Document Management System API

## Overview
Cloud-based document management with AI-powered processing capabilities.

## Authentication
- Bearer Token (JWT) for web application
- API Key + Secret for machine-to-machine (M2M) authentication

## Rate Limiting
- 100 requests per minute per IP
- Higher limits for authenticated users

## Versioning
All endpoints are versioned. Use \`/api/v1/\` prefix.
      `.trim(),
      )
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token',
        },
        'JWT-auth',
      )
      .addApiKey(
        {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API Key for M2M authentication',
        },
        'API-Key',
      )
      .addTag('auth', 'Authentication and authorization')
      .addTag('users', 'User management')
      .addTag('organizations', 'Organization management')
      .addTag('documents', 'Document CRUD operations')
      .addTag('folders', 'Folder management')
      .addTag('storage', 'File storage operations')
      .addTag('processing', 'Document processing (OCR, AI)')
      .addTag('search', 'Full-text and semantic search')
      .addTag('health', 'Health and readiness checks')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none',
        filter: true,
        showRequestDuration: true,
      },
    });
  }

  // Redirect root to health endpoint
  app.use('/', (req, res, next) => {
    if (req.path === '/' && req.method === 'GET') {
      return res.redirect('/api/v1/health');
    }
    next();
  });

  // Graceful shutdown
  app.enableShutdownHooks();

  const port = configService.get<number>('PORT', 4000);
  const host = configService.get<string>('HOST', '0.0.0.0');

  await app.listen(port, host);

  logger.log(`Application running on: http://${host}:${port}`);
  logger.log(`Swagger docs: http://localhost:${port}/api/docs`);
  logger.log(`Environment: ${nodeEnv}`);
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
