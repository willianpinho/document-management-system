import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService
  extends PrismaClient<Prisma.PrismaClientOptions, 'query' | 'error' | 'info' | 'warn'>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly configService: ConfigService) {
    const logLevels: Prisma.LogLevel[] =
      configService.get<string>('NODE_ENV') === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'];

    super({
      log: logLevels.map((level) => ({
        emit: 'event' as const,
        level,
      })),
      errorFormat: 'pretty',
    });

    // Log queries in development
    if (configService.get<string>('NODE_ENV') === 'development') {
      this.$on('query', (e: Prisma.QueryEvent) => {
        if (e.duration > 100) {
          this.logger.warn(`Slow query (${e.duration}ms): ${e.query}`);
        }
      });
    }

    this.$on('error', (e: Prisma.LogEvent) => {
      this.logger.error(`Database error: ${e.message}`);
    });

    this.$on('warn', (e: Prisma.LogEvent) => {
      this.logger.warn(`Database warning: ${e.message}`);
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Database connected successfully');
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting from database...');
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  /**
   * Set the current organization context for row-level security
   */
  async setOrganizationContext(organizationId: string): Promise<void> {
    await this.$executeRawUnsafe(`SET app.current_organization = '${organizationId}'`);
  }

  /**
   * Clear the organization context
   */
  async clearOrganizationContext(): Promise<void> {
    await this.$executeRawUnsafe(`RESET app.current_organization`);
  }

  /**
   * Execute a callback within an organization context
   */
  async withOrganizationContext<T>(
    organizationId: string,
    callback: () => Promise<T>,
  ): Promise<T> {
    await this.setOrganizationContext(organizationId);
    try {
      return await callback();
    } finally {
      await this.clearOrganizationContext();
    }
  }

  /**
   * Health check for database connection
   */
  async healthCheck(): Promise<{ status: 'ok' | 'error'; latency: number }> {
    const start = Date.now();
    try {
      await this.$queryRaw`SELECT 1`;
      return { status: 'ok', latency: Date.now() - start };
    } catch {
      return { status: 'error', latency: Date.now() - start };
    }
  }

  /**
   * Clean database (only for testing)
   */
  async cleanDatabase(): Promise<void> {
    if (this.configService.get<string>('NODE_ENV') === 'production') {
      throw new Error('cleanDatabase is not allowed in production');
    }

    // Delete in correct order to respect foreign keys
    const tables = [
      'audit_logs',
      'processing_jobs',
      'document_versions',
      'documents',
      'folders',
      'api_keys',
      'refresh_tokens',
      'organization_members',
      'organizations',
      'users',
    ];

    for (const table of tables) {
      try {
        await this.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`);
      } catch (error) {
        this.logger.warn(`Failed to truncate ${table}: ${error}`);
      }
    }

    this.logger.log('Database cleaned');
  }
}
