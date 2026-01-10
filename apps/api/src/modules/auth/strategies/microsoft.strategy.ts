import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile, VerifyCallback } from 'passport-microsoft';
import { ConfigService } from '@nestjs/config';
import { AuthProvider } from '@prisma/client';

import { UsersService } from '../../users/users.service';

export interface MicrosoftProfile {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

@Injectable()
export class MicrosoftStrategy extends PassportStrategy(Strategy, 'microsoft') {
  private readonly logger = new Logger(MicrosoftStrategy.name);
  private readonly isConfigured: boolean;

  constructor(
    private readonly usersService: UsersService,
    configService: ConfigService,
  ) {
    const clientID = configService.get<string>('MICROSOFT_CLIENT_ID');
    const clientSecret = configService.get<string>('MICROSOFT_CLIENT_SECRET');
    const callbackURL = configService.get<string>(
      'MICROSOFT_CALLBACK_URL',
      'http://localhost:4000/api/auth/microsoft/callback',
    );
    const tenantId = configService.get<string>('MICROSOFT_TENANT_ID', 'common');

    // Use dummy values when not configured to avoid initialization errors
    const isConfigured = !!(clientID && clientSecret);

    super({
      clientID: clientID || 'not-configured',
      clientSecret: clientSecret || 'not-configured',
      callbackURL,
      tenant: tenantId,
      scope: ['user.read', 'openid', 'profile', 'email'],
      authorizationURL: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
      tokenURL: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    });

    this.isConfigured = isConfigured;

    if (!isConfigured) {
      this.logger.warn(
        'Microsoft OAuth is not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET to enable.',
      );
    }
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    if (!this.isConfigured) {
      return done(new Error('Microsoft OAuth is not configured'), undefined);
    }

    try {
      const { id, emails, displayName } = profile;
      const email = emails?.[0]?.value;

      if (!email) {
        return done(new Error('No email found in Microsoft profile'), undefined);
      }

      // Check if user exists with this email
      let user = await this.usersService.findByEmail(email);

      if (!user) {
        // Create new user with Microsoft provider
        user = await this.usersService.create({
          email,
          name: displayName || undefined,
          provider: AuthProvider.MICROSOFT,
          providerId: id,
        });
      } else if (!user.providerId) {
        // Link existing email-only account to Microsoft
        user = await this.usersService.update(user.id, {
          provider: AuthProvider.MICROSOFT,
          providerId: id,
        });
      }

      const validatedUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      };

      done(null, validatedUser);
    } catch (error) {
      done(error as Error, undefined);
    }
  }
}
