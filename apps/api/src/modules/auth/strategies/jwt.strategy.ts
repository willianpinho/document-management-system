import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

import { UsersService } from '../../users/users.service';

export interface JwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
  aud?: string;
  iss?: string;
}

export interface ValidatedUser {
  id: string;
  email: string;
}

/**
 * JWT issuer and audience constants.
 *
 * These MUST match the values used when signing tokens in `AuthModule` so that
 * `passport-jwt` verifies both claims on every request. Without these, a token
 * signed for a different service that happens to share the secret would be
 * accepted as valid.
 */
export const JWT_ISSUER = 'dms-api';
export const JWT_AUDIENCE = 'dms-client';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly usersService: UsersService,
    configService: ConfigService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is not defined');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
  }

  async validate(payload: JwtPayload): Promise<ValidatedUser> {
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
    };
  }
}
