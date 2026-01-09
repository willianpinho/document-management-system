import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string().valid('development', 'test', 'staging', 'production').default('development'),
  PORT: Joi.number().default(4000),
  HOST: Joi.string().default('0.0.0.0'),
  CORS_ORIGINS: Joi.string().default('http://localhost:3000'),

  // Database
  DATABASE_URL: Joi.string().required().description('PostgreSQL connection string'),

  // Redis
  REDIS_URL: Joi.string().default('redis://localhost:6379'),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().optional(),

  // JWT
  JWT_SECRET: Joi.string().required().min(32).description('JWT signing secret'),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  REFRESH_TOKEN_SECRET: Joi.string().required().min(32).description('Refresh token secret'),
  REFRESH_TOKEN_EXPIRES_IN: Joi.string().default('7d'),

  // AWS
  AWS_REGION: Joi.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: Joi.string().optional(),
  AWS_SECRET_ACCESS_KEY: Joi.string().optional(),

  // S3
  S3_BUCKET: Joi.string().default('dms-documents-dev'),
  S3_REGION: Joi.string().default('us-east-1'),
  S3_ENDPOINT: Joi.string().optional().description('Custom S3 endpoint (for LocalStack)'),

  // OpenAI
  OPENAI_API_KEY: Joi.string().optional().description('OpenAI API key for AI features'),
  OPENAI_MODEL: Joi.string().default('gpt-4-turbo-preview'),
  OPENAI_EMBEDDING_MODEL: Joi.string().default('text-embedding-ada-002'),

  // OAuth (optional)
  GOOGLE_CLIENT_ID: Joi.string().optional(),
  GOOGLE_CLIENT_SECRET: Joi.string().optional(),
  MICROSOFT_CLIENT_ID: Joi.string().optional(),
  MICROSOFT_CLIENT_SECRET: Joi.string().optional(),
  MICROSOFT_TENANT_ID: Joi.string().optional(),

  // File upload
  MAX_FILE_SIZE_BYTES: Joi.number().default(104857600),
  ALLOWED_MIME_TYPES: Joi.string().optional(),

  // Rate limiting
  RATE_LIMIT_TTL: Joi.number().default(60000),
  RATE_LIMIT_MAX: Joi.number().default(100),
});
