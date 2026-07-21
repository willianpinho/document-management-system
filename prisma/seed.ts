/**
 * Document Management System - Database Seed Script
 *
 * Creates a single, coherent demo organization for the live demo:
 * - 1 organization with storageUsedBytes computed from real uploads
 * - 3 users (admin@dms-test.com stays the OWNER the demo auto-login expects)
 * - A real folder hierarchy
 * - Documents each backed by a REAL file uploaded to S3/MinIO, with
 *   fileSize/mimeType/status/metadata all derived from that real file
 * - Re-running this script cleans up any previous demo data first, so
 *   it is safe to run repeatedly (locally or against prod).
 *
 * See prisma/seed/ for the implementation: cleanup, organization setup,
 * document uploads, and demo activity (versions/jobs/audit logs) each
 * live in their own module.
 *
 * Usage:
 *   pnpm db:seed
 *   # or
 *   pnpm prisma db seed
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), 'apps/api/.env') });

import { PrismaClient } from '@prisma/client';
import { cleanupPreviousDemoData } from './seed/cleanup.js';
import { seedOrganization } from './seed/organization.js';
import { seedDocuments } from './seed/documents.js';
import { seedActivity } from './seed/activity.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...\n');

  console.log('Cleaning up previous demo data...');
  await cleanupPreviousDemoData(prisma);

  const { org, users, folders } = await seedOrganization(prisma);
  const { createdDocuments, totalBytes, s3Connected } = await seedDocuments(
    prisma,
    org.id,
    users,
    folders,
  );
  await seedActivity(prisma, org.id, users, folders, createdDocuments, s3Connected);

  console.log('='.repeat(60));
  console.log('Seed completed successfully!');
  console.log('='.repeat(60));
  console.log(`\nOrganization: ${org.name} (${org.slug})`);
  console.log(`Storage used: ${totalBytes} bytes\n`);
  console.log('Test Account:');
  console.log('  Email: admin@dms-test.com | Password: admin123!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
