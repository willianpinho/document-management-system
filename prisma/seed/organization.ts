/**
 * Creates the single demo organization: its users, memberships, and
 * folder hierarchy. Documents (and the storage total that depends on
 * them) are seeded separately in `documents.ts`.
 */

import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import type { FolderKey, UserKey } from './document-spec.js';

function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export interface SeededOrganization {
  org: { id: string; name: string; slug: string };
  users: Record<UserKey, { id: string }>;
  folders: Record<FolderKey, { id: string }>;
}

export async function seedOrganization(prisma: PrismaClient): Promise<SeededOrganization> {
  console.log('Creating organization...');
  const org = await prisma.organization.create({
    data: {
      name: 'Northwind Docs',
      slug: 'northwind-docs',
      plan: 'PRO',
      storageQuotaBytes: BigInt(107374182400), // 100GB
      storageUsedBytes: BigInt(0), // corrected once real files are uploaded (documents.ts)
      settings: { allowPublicSharing: true, retentionDays: 365, maxFileSize: 104857600 },
    },
  });
  console.log(`  Created organization "${org.name}" (${org.slug})\n`);

  console.log('Creating users...');
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@dms-test.com' },
    update: { password: hashPassword('admin123!') },
    create: {
      email: 'admin@dms-test.com',
      name: 'Admin User',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
      provider: 'EMAIL',
      password: hashPassword('admin123!'),
    },
  });
  const mariaUser = await prisma.user.upsert({
    where: { email: 'maria.santos@northwinddocs.com' },
    update: {},
    create: {
      email: 'maria.santos@northwinddocs.com',
      name: 'Maria Santos',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=maria',
      provider: 'GOOGLE',
      providerId: 'google-northwind-maria',
    },
  });
  const alexUser = await prisma.user.upsert({
    where: { email: 'alex.chen@northwinddocs.com' },
    update: { password: hashPassword('password123') },
    create: {
      email: 'alex.chen@northwinddocs.com',
      name: 'Alex Chen',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex',
      provider: 'EMAIL',
      password: hashPassword('password123'),
    },
  });
  const users: Record<UserKey, { id: string }> = {
    admin: adminUser,
    maria: mariaUser,
    alex: alexUser,
  };
  console.log('  Created 3 users\n');

  console.log('Creating organization memberships...');
  await prisma.organizationMember.createMany({
    data: [
      { organizationId: org.id, userId: adminUser.id, role: 'OWNER', joinedAt: new Date() },
      { organizationId: org.id, userId: mariaUser.id, role: 'EDITOR', joinedAt: new Date() },
      { organizationId: org.id, userId: alexUser.id, role: 'VIEWER', joinedAt: new Date() },
    ],
  });
  console.log('  Created 3 memberships\n');

  console.log('Creating folder hierarchy...');
  const documentsFolder = await prisma.folder.create({
    data: {
      organizationId: org.id,
      name: 'Documents',
      path: '/Documents',
      depth: 0,
      createdById: adminUser.id,
    },
  });
  const contractsFolder = await prisma.folder.create({
    data: {
      organizationId: org.id,
      parentId: documentsFolder.id,
      name: 'Contracts',
      path: '/Documents/Contracts',
      depth: 1,
      createdById: mariaUser.id,
    },
  });
  const invoicesFolder = await prisma.folder.create({
    data: {
      organizationId: org.id,
      parentId: documentsFolder.id,
      name: 'Invoices',
      path: '/Documents/Invoices',
      depth: 1,
      createdById: alexUser.id,
    },
  });
  const projectsFolder = await prisma.folder.create({
    data: {
      organizationId: org.id,
      name: 'Projects',
      path: '/Projects',
      depth: 0,
      createdById: adminUser.id,
    },
  });
  const reportsFolder = await prisma.folder.create({
    data: {
      organizationId: org.id,
      name: 'Reports',
      path: '/Reports',
      depth: 0,
      createdById: mariaUser.id,
    },
  });
  const folders: Record<FolderKey, { id: string }> = {
    documents: documentsFolder,
    contracts: contractsFolder,
    invoices: invoicesFolder,
    projects: projectsFolder,
    reports: reportsFolder,
  };
  console.log('  Created 5 folders\n');

  return { org, users, folders };
}
