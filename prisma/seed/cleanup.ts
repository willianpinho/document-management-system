/**
 * Removes prior demo data before re-seeding, so re-running the seed
 * against an already-seeded database (including prod) always ends up
 * with exactly one coherent demo organization instead of accumulating
 * duplicates or leaving orphaned fixtures behind.
 */

import type { PrismaClient } from '@prisma/client';
import { deleteS3Prefix } from './s3-client.js';

/** Slugs ever used by this seed script, past and present. */
export const DEMO_ORG_SLUGS = [
  'acme-corp',
  'startup-inc',
  'enterprise-solutions',
  'northwind-docs',
];

/** Fixture users from the old multi-org seed that no longer belong to any org. */
export const LEGACY_FIXTURE_EMAILS = [
  'john.doe@gmail.com',
  'jane.smith@outlook.com',
  'bob.wilson@test.com',
  'alice.johnson@test.com',
  'test@example.com',
];

export async function cleanupPreviousDemoData(prisma: PrismaClient): Promise<void> {
  const staleOrgs = await prisma.organization.findMany({
    where: { slug: { in: DEMO_ORG_SLUGS } },
    select: { id: true, slug: true },
  });

  if (staleOrgs.length === 0) {
    console.log('  No previous demo organizations found.\n');
    return;
  }

  for (const org of staleOrgs) {
    const deleted = await deleteS3Prefix(`organizations/${org.id}/`);
    console.log(`  Removed ${deleted} S3 object(s) for organization "${org.slug}"`);
  }

  // Cascades: documents, document versions, processing jobs, comments,
  // folders, memberships, API keys, and audit logs all cascade-delete
  // via the organization relation in schema.prisma.
  const { count } = await prisma.organization.deleteMany({
    where: { id: { in: staleOrgs.map((o) => o.id) } },
  });
  console.log(`  Deleted ${count} previous demo organization(s) and their data\n`);

  // Now safe to remove: their documents/folders are already gone, so no
  // FK reference to these users remains.
  const { count: userCount } = await prisma.user.deleteMany({
    where: { email: { in: LEGACY_FIXTURE_EMAILS } },
  });
  if (userCount > 0) {
    console.log(`  Deleted ${userCount} orphaned fixture user(s)\n`);
  }
}
