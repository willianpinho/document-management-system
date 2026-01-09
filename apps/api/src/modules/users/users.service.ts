import { Injectable } from '@nestjs/common';
import { AuthProvider } from '@prisma/client';

import { PrismaService } from '@/common/prisma/prisma.service';

interface CreateUserInput {
  email: string;
  password?: string;
  name?: string;
  avatarUrl?: string;
  provider?: AuthProvider;
  providerId?: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateUserInput) {
    return this.prisma.user.create({
      data: {
        email: input.email,
        password: input.password,
        name: input.name,
        avatarUrl: input.avatarUrl,
        provider: input.provider,
        providerId: input.providerId,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async update(id: string, data: Partial<CreateUserInput>) {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.prisma.user.delete({
      where: { id },
    });
  }
}
