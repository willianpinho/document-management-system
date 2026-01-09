import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';
import * as crypto from 'crypto';

import { PrismaService } from '@/common/prisma/prisma.service';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'api-key') {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async validate(req: Request) {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      throw new UnauthorizedException('API key is required');
    }

    // Extract prefix (first 8 characters)
    const keyPrefix = apiKey.substring(0, 8);

    // Hash the full key
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    // Find the API key
    const apiKeyRecord = await this.prisma.apiKey.findFirst({
      where: {
        keyPrefix,
        keyHash,
        revokedAt: null,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: {
        organization: true,
      },
    });

    if (!apiKeyRecord) {
      throw new UnauthorizedException('Invalid or expired API key');
    }

    // Update last used timestamp
    await this.prisma.apiKey.update({
      where: { id: apiKeyRecord.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      id: `api-key:${apiKeyRecord.id}`,
      organizationId: apiKeyRecord.organizationId,
      scopes: apiKeyRecord.scopes,
      isApiKey: true,
    };
  }
}
