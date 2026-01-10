import { Injectable, Logger, Optional } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthProvider } from '@prisma/client';

import { UsersService } from '../../users/users.service';

export interface GoogleProfile {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);
  private readonly isConfigured: boolean;

  constructor(
    private readonly usersService: UsersService,
    configService: ConfigService,
  ) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
    const callbackURL = configService.get<string>(
      'GOOGLE_CALLBACK_URL',
      'http://localhost:4000/api/auth/google/callback',
    );

    // Use dummy values when not configured to avoid initialization errors
    const isConfigured = !!(clientID && clientSecret);

    super({
      clientID: clientID || 'not-configured',
      clientSecret: clientSecret || 'not-configured',
      callbackURL,
      scope: ['email', 'profile'],
    });

    this.isConfigured = isConfigured;

    if (!isConfigured) {
      this.logger.warn(
        'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable.',
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
      return done(new Error('Google OAuth is not configured'), undefined);
    }

    try {
      const { id, emails, displayName, photos } = profile;
      const email = emails?.[0]?.value;

      if (!email) {
        return done(new Error('No email found in Google profile'), undefined);
      }

      // Check if user exists with this email
      let user = await this.usersService.findByEmail(email);

      if (!user) {
        // Create new user with Google provider
        user = await this.usersService.create({
          email,
          name: displayName || undefined,
          avatarUrl: photos?.[0]?.value,
          provider: AuthProvider.GOOGLE,
          providerId: id,
        });
      } else if (!user.providerId) {
        // Link existing email-only account to Google
        user = await this.usersService.update(user.id, {
          provider: AuthProvider.GOOGLE,
          providerId: id,
          avatarUrl: user.avatarUrl || photos?.[0]?.value,
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
