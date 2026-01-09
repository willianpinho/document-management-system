/**
 * Redis Adapter for Socket.io
 *
 * Enables horizontal scaling of WebSocket connections across multiple
 * NestJS instances by using Redis Pub/Sub for message broadcasting.
 *
 * This adapter ensures that events emitted from one server instance
 * are delivered to clients connected to any other instance.
 */

import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServerOptions, Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;

  constructor(
    app: INestApplication,
    private readonly configService: ConfigService,
  ) {
    super(app);
  }

  /**
   * Connect to Redis and create the adapter
   * Must be called before the application starts listening
   */
  async connectToRedis(): Promise<void> {
    const redisHost = this.configService.get<string>('redis.host', 'localhost');
    const redisPort = this.configService.get<number>('redis.port', 6379);
    const redisPassword = this.configService.get<string>('redis.password');

    const redisOptions = {
      host: redisHost,
      port: redisPort,
      password: redisPassword || undefined,
      // Socket.io specific key prefix
      keyPrefix: 'dms:socketio:',
      // Connection retry strategy
      retryStrategy: (times: number) => {
        if (times > 10) {
          this.logger.error('Redis connection failed after 10 attempts');
          return null; // Stop retrying
        }
        return Math.min(times * 100, 3000);
      },
      // Enable reconnection
      enableOfflineQueue: true,
      maxRetriesPerRequest: null,
      lazyConnect: false,
    };

    this.pubClient = new Redis(redisOptions);
    this.subClient = this.pubClient.duplicate();

    // Set up event handlers for pub client
    this.pubClient.on('connect', () => {
      this.logger.log('Redis pub client connected');
    });

    this.pubClient.on('error', (error) => {
      this.logger.error(`Redis pub client error: ${error.message}`);
    });

    this.pubClient.on('close', () => {
      this.logger.warn('Redis pub client connection closed');
    });

    // Set up event handlers for sub client
    this.subClient.on('connect', () => {
      this.logger.log('Redis sub client connected');
    });

    this.subClient.on('error', (error) => {
      this.logger.error(`Redis sub client error: ${error.message}`);
    });

    this.subClient.on('close', () => {
      this.logger.warn('Redis sub client connection closed');
    });

    // Wait for both clients to be ready
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        this.pubClient!.once('ready', resolve);
        this.pubClient!.once('error', reject);
      }),
      new Promise<void>((resolve, reject) => {
        this.subClient!.once('ready', resolve);
        this.subClient!.once('error', reject);
      }),
    ]);

    // Create the adapter with both clients
    this.adapterConstructor = createAdapter(this.pubClient, this.subClient);

    this.logger.log(
      `Redis adapter connected to ${redisHost}:${redisPort}`,
    );
  }

  /**
   * Create the Socket.io server with Redis adapter
   */
  override createIOServer(port: number, options?: ServerOptions): Server {
    const corsOrigins = this.configService.get<string>(
      'CORS_ORIGINS',
      'http://localhost:3000',
    );

    const serverOptions: Partial<ServerOptions> = {
      ...options,
      cors: {
        origin: corsOrigins.split(',').map((origin) => origin.trim()),
        credentials: true,
        methods: ['GET', 'POST'],
        allowedHeaders: ['Authorization', 'Content-Type', 'X-Organization-ID'],
      },
      // Connection settings
      pingTimeout: 60000,
      pingInterval: 25000,
      // Transport settings - prefer WebSocket but allow polling fallback
      transports: ['websocket', 'polling'],
      // Allow upgrades from polling to websocket
      allowUpgrades: true,
      // Compression settings
      perMessageDeflate: {
        threshold: 1024, // Only compress messages larger than 1KB
      },
      // Connection state recovery (Socket.io v4.6+)
      connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
        skipMiddlewares: true,
      },
    };

    const server = super.createIOServer(port, serverOptions);

    // Attach the Redis adapter if available
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
      this.logger.log('Socket.io server using Redis adapter');
    } else {
      this.logger.warn(
        'Socket.io server running without Redis adapter (single instance mode)',
      );
    }

    return server;
  }

  /**
   * Clean up Redis connections on shutdown
   */
  override async close(): Promise<void> {
    if (this.pubClient) {
      await this.pubClient.quit();
      this.pubClient = null;
    }
    if (this.subClient) {
      await this.subClient.quit();
      this.subClient = null;
    }
    this.logger.log('Redis adapter connections closed');
  }

  /**
   * Check if Redis adapter is connected and ready
   */
  isReady(): boolean {
    return (
      this.pubClient?.status === 'ready' &&
      this.subClient?.status === 'ready' &&
      this.adapterConstructor !== null
    );
  }

  /**
   * Get Redis connection status for health checks
   */
  getStatus(): {
    connected: boolean;
    pubClient: string;
    subClient: string;
  } {
    return {
      connected: this.isReady(),
      pubClient: this.pubClient?.status || 'disconnected',
      subClient: this.subClient?.status || 'disconnected',
    };
  }
}

/**
 * Factory function to create and initialize the Redis adapter
 */
export async function createRedisAdapter(
  app: INestApplication,
): Promise<RedisIoAdapter> {
  const configService = app.get(ConfigService);
  const adapter = new RedisIoAdapter(app, configService);

  try {
    await adapter.connectToRedis();
  } catch (error) {
    const logger = new Logger('RedisAdapter');
    logger.error(
      `Failed to connect to Redis: ${(error as Error).message}. Running in single-instance mode.`,
    );
  }

  return adapter;
}
