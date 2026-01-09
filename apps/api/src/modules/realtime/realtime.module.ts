/**
 * Realtime Module
 *
 * Provides WebSocket-based real-time communication capabilities for the DMS.
 * Features:
 * - Socket.io WebSocket gateway
 * - JWT authentication for socket connections
 * - Redis adapter for horizontal scaling
 * - Room-based event broadcasting
 * - User presence tracking
 *
 * Events:
 * - document:created, document:updated, document:deleted
 * - folder:created, folder:updated, folder:deleted
 * - processing:started, processing:progress, processing:completed, processing:failed
 * - user:joined, user:left, user:activity
 */

import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';
import { UsersModule } from '../users/users.module';

/**
 * @Global decorator makes RealtimeService available application-wide
 * without needing to import RealtimeModule everywhere
 */
@Global()
@Module({
  imports: [
    // Import UsersModule for user lookup during authentication
    UsersModule,

    // JWT module for token verification
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '15m') as `${number}${'s' | 'm' | 'h' | 'd'}`,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    RealtimeGateway,
    RealtimeService,
  ],
  exports: [
    RealtimeService,
  ],
})
export class RealtimeModule {}
