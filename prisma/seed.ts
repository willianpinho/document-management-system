/**
 * Document Management System - Database Seed Script
 *
 * Creates sample data for development and testing:
 * - Test users with different auth providers
 * - Sample organizations with various plans
 * - Folder hierarchies
 * - Sample documents
 * - Processing jobs
 * - Audit logs
 *
 * Usage:
 *   pnpm db:seed
 *   # or
 *   pnpm prisma db seed
 */

import { PrismaClient, Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function generateUUID(): string {
  return crypto.randomUUID();
}

function hashPassword(password: string): string {
  // Use bcrypt with 10 rounds (matching auth service)
  return bcrypt.hashSync(password, 10);
}

function generateS3Key(orgId: string, folderId: string | null, fileName: string): string {
  const folder = folderId ? `${folderId}/` : '';
  return `organizations/${orgId}/${folder}${generateUUID()}/${fileName}`;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// =============================================================================
// SEED DATA
// =============================================================================

async function main() {
  console.log('Starting database seed...\n');

  // ---------------------------------------------------------------------------
  // 1. CREATE USERS
  // ---------------------------------------------------------------------------
  console.log('Creating users...');

  const users = await Promise.all([
    // Admin user (email auth)
    prisma.user.upsert({
      where: { email: 'admin@dms-test.com' },
      update: {},
      create: {
        email: 'admin@dms-test.com',
        name: 'Admin User',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
        provider: 'EMAIL',
        password: hashPassword('admin123!'),
      },
    }),

    // Google OAuth user
    prisma.user.upsert({
      where: { email: 'john.doe@gmail.com' },
      update: {},
      create: {
        email: 'john.doe@gmail.com',
        name: 'John Doe',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=john',
        provider: 'GOOGLE',
        providerId: 'google-123456789',
      },
    }),

    // Microsoft OAuth user
    prisma.user.upsert({
      where: { email: 'jane.smith@outlook.com' },
      update: {},
      create: {
        email: 'jane.smith@outlook.com',
        name: 'Jane Smith',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jane',
        provider: 'MICROSOFT',
        providerId: 'ms-987654321',
      },
    }),

    // Regular email user
    prisma.user.upsert({
      where: { email: 'bob.wilson@test.com' },
      update: {},
      create: {
        email: 'bob.wilson@test.com',
        name: 'Bob Wilson',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob',
        provider: 'EMAIL',
        password: hashPassword('password123'),
      },
    }),

    // Another user for viewer role
    prisma.user.upsert({
      where: { email: 'alice.johnson@test.com' },
      update: {},
      create: {
        email: 'alice.johnson@test.com',
        name: 'Alice Johnson',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice',
        provider: 'EMAIL',
        password: hashPassword('password123'),
      },
    }),

    // E2E Test user (standard test credentials)
    prisma.user.upsert({
      where: { email: 'test@example.com' },
      update: {},
      create: {
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=test',
        provider: 'EMAIL',
        password: hashPassword('password123'),
      },
    }),
  ]);

  const [adminUser, johnUser, janeUser, bobUser, aliceUser, testUser] = users;
  console.log(`  Created ${users.length} users\n`);

  // ---------------------------------------------------------------------------
  // 2. CREATE ORGANIZATIONS
  // ---------------------------------------------------------------------------
  console.log('Creating organizations...');

  const organizations = await Promise.all([
    // Main test organization (Pro plan)
    prisma.organization.upsert({
      where: { slug: 'acme-corp' },
      update: {},
      create: {
        name: 'Acme Corporation',
        slug: 'acme-corp',
        plan: 'PRO',
        storageQuotaBytes: BigInt(107374182400), // 100GB
        storageUsedBytes: BigInt(1073741824), // 1GB used
        settings: {
          allowPublicSharing: true,
          retentionDays: 365,
          maxFileSize: 104857600, // 100MB
        },
      },
    }),

    // Free tier organization
    prisma.organization.upsert({
      where: { slug: 'startup-inc' },
      update: {},
      create: {
        name: 'Startup Inc',
        slug: 'startup-inc',
        plan: 'FREE',
        storageQuotaBytes: BigInt(5368709120), // 5GB
        storageUsedBytes: BigInt(536870912), // 500MB used
      },
    }),

    // Enterprise organization
    prisma.organization.upsert({
      where: { slug: 'enterprise-solutions' },
      update: {},
      create: {
        name: 'Enterprise Solutions Ltd',
        slug: 'enterprise-solutions',
        plan: 'ENTERPRISE',
        storageQuotaBytes: BigInt(1099511627776), // 1TB
        storageUsedBytes: BigInt(10737418240), // 10GB used
        settings: {
          allowPublicSharing: false,
          retentionDays: 2555, // 7 years
          maxFileSize: 1073741824, // 1GB
          ssoEnabled: true,
          auditLogRetention: 2555,
        },
      },
    }),
  ]);

  const [acmeOrg, startupOrg, enterpriseOrg] = organizations;
  console.log(`  Created ${organizations.length} organizations\n`);

  // ---------------------------------------------------------------------------
  // 3. CREATE ORGANIZATION MEMBERS
  // ---------------------------------------------------------------------------
  console.log('Creating organization memberships...');

  const memberships = await Promise.all([
    // Acme Corp members
    prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: acmeOrg.id,
          userId: adminUser.id,
        },
      },
      update: {},
      create: {
        organizationId: acmeOrg.id,
        userId: adminUser.id,
        role: 'OWNER',
        joinedAt: new Date(),
      },
    }),
    prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: acmeOrg.id,
          userId: johnUser.id,
        },
      },
      update: {},
      create: {
        organizationId: acmeOrg.id,
        userId: johnUser.id,
        role: 'ADMIN',
        joinedAt: new Date(),
      },
    }),
    prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: acmeOrg.id,
          userId: janeUser.id,
        },
      },
      update: {},
      create: {
        organizationId: acmeOrg.id,
        userId: janeUser.id,
        role: 'EDITOR',
        joinedAt: new Date(),
      },
    }),
    prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: acmeOrg.id,
          userId: aliceUser.id,
        },
      },
      update: {},
      create: {
        organizationId: acmeOrg.id,
        userId: aliceUser.id,
        role: 'VIEWER',
        joinedAt: new Date(),
      },
    }),

    // E2E Test user in Acme Corp
    prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: acmeOrg.id,
          userId: testUser.id,
        },
      },
      update: {},
      create: {
        organizationId: acmeOrg.id,
        userId: testUser.id,
        role: 'EDITOR',
        joinedAt: new Date(),
      },
    }),

    // Startup Inc members
    prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: startupOrg.id,
          userId: bobUser.id,
        },
      },
      update: {},
      create: {
        organizationId: startupOrg.id,
        userId: bobUser.id,
        role: 'OWNER',
        joinedAt: new Date(),
      },
    }),

    // Enterprise Solutions members
    prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: enterpriseOrg.id,
          userId: adminUser.id,
        },
      },
      update: {},
      create: {
        organizationId: enterpriseOrg.id,
        userId: adminUser.id,
        role: 'ADMIN',
        joinedAt: new Date(),
      },
    }),
  ]);

  console.log(`  Created ${memberships.length} memberships\n`);

  // ---------------------------------------------------------------------------
  // 4. CREATE FOLDERS
  // ---------------------------------------------------------------------------
  console.log('Creating folders...');

  // Root folders for Acme Corp - use create with try/catch for idempotency
  let documentsFolder = await prisma.folder.findFirst({
    where: { organizationId: acmeOrg.id, parentId: null, name: 'Documents' },
  });
  if (!documentsFolder) {
    documentsFolder = await prisma.folder.create({
      data: {
        organizationId: acmeOrg.id,
        name: 'Documents',
        path: '/Documents',
        depth: 0,
        createdById: adminUser.id,
      },
    });
  }

  let projectsFolder = await prisma.folder.findFirst({
    where: { organizationId: acmeOrg.id, parentId: null, name: 'Projects' },
  });
  if (!projectsFolder) {
    projectsFolder = await prisma.folder.create({
      data: {
        organizationId: acmeOrg.id,
        name: 'Projects',
        path: '/Projects',
        depth: 0,
        createdById: adminUser.id,
      },
    });
  }

  let archiveFolder = await prisma.folder.findFirst({
    where: { organizationId: acmeOrg.id, parentId: null, name: 'Archive' },
  });
  if (!archiveFolder) {
    archiveFolder = await prisma.folder.create({
      data: {
        organizationId: acmeOrg.id,
        name: 'Archive',
        path: '/Archive',
        depth: 0,
        createdById: adminUser.id,
      },
    });
  }

  // Nested folders under Documents
  let contractsFolder = await prisma.folder.findFirst({
    where: { organizationId: acmeOrg.id, parentId: documentsFolder.id, name: 'Contracts' },
  });
  if (!contractsFolder) {
    contractsFolder = await prisma.folder.create({
      data: {
        organizationId: acmeOrg.id,
        parentId: documentsFolder.id,
        name: 'Contracts',
        path: '/Documents/Contracts',
        depth: 1,
        createdById: johnUser.id,
      },
    });
  }

  let invoicesFolder = await prisma.folder.findFirst({
    where: { organizationId: acmeOrg.id, parentId: documentsFolder.id, name: 'Invoices' },
  });
  if (!invoicesFolder) {
    invoicesFolder = await prisma.folder.create({
      data: {
        organizationId: acmeOrg.id,
        parentId: documentsFolder.id,
        name: 'Invoices',
        path: '/Documents/Invoices',
        depth: 1,
        createdById: johnUser.id,
      },
    });
  }

  let reportsFolder = await prisma.folder.findFirst({
    where: { organizationId: acmeOrg.id, parentId: documentsFolder.id, name: 'Reports' },
  });
  if (!reportsFolder) {
    reportsFolder = await prisma.folder.create({
      data: {
        organizationId: acmeOrg.id,
        parentId: documentsFolder.id,
        name: 'Reports',
        path: '/Documents/Reports',
        depth: 1,
        createdById: janeUser.id,
      },
    });
  }

  // Nested folders under Projects
  let project2024Folder = await prisma.folder.findFirst({
    where: { organizationId: acmeOrg.id, parentId: projectsFolder.id, name: '2024' },
  });
  if (!project2024Folder) {
    project2024Folder = await prisma.folder.create({
      data: {
        organizationId: acmeOrg.id,
        parentId: projectsFolder.id,
        name: '2024',
        path: '/Projects/2024',
        depth: 1,
        createdById: adminUser.id,
      },
    });
  }

  let websiteRedesignFolder = await prisma.folder.findFirst({
    where: { organizationId: acmeOrg.id, parentId: project2024Folder.id, name: 'Website Redesign' },
  });
  if (!websiteRedesignFolder) {
    websiteRedesignFolder = await prisma.folder.create({
      data: {
        organizationId: acmeOrg.id,
        parentId: project2024Folder.id,
        name: 'Website Redesign',
        path: '/Projects/2024/Website Redesign',
        depth: 2,
        createdById: janeUser.id,
      },
    });
  }

  // Folders for Startup Inc
  let startupDocsFolder = await prisma.folder.findFirst({
    where: { organizationId: startupOrg.id, parentId: null, name: 'Company Documents' },
  });
  if (!startupDocsFolder) {
    startupDocsFolder = await prisma.folder.create({
      data: {
        organizationId: startupOrg.id,
        name: 'Company Documents',
        path: '/Company Documents',
        depth: 0,
        createdById: bobUser.id,
      },
    });
  }

  console.log('  Created folder hierarchy\n');

  // ---------------------------------------------------------------------------
  // 5. CREATE DOCUMENTS
  // ---------------------------------------------------------------------------
  console.log('Creating documents...');

  const documentData: Prisma.DocumentCreateManyInput[] = [
    // Root level documents
    {
      organizationId: acmeOrg.id,
      folderId: null,
      name: 'Company Handbook.pdf',
      originalName: 'Company_Handbook_2024.pdf',
      mimeType: 'application/pdf',
      sizeBytes: BigInt(2457600),
      s3Key: generateS3Key(acmeOrg.id, null, 'Company Handbook.pdf'),
      checksum: crypto.randomBytes(32).toString('hex'),
      status: 'READY',
      processingStatus: 'COMPLETE',
      metadata: { pages: 45, author: 'HR Department' },
      createdById: adminUser.id,
    },

    // Documents in Contracts folder
    {
      organizationId: acmeOrg.id,
      folderId: contractsFolder.id,
      name: 'Service Agreement - Client A.pdf',
      originalName: 'ServiceAgreement_ClientA_2024.pdf',
      mimeType: 'application/pdf',
      sizeBytes: BigInt(1048576),
      s3Key: generateS3Key(acmeOrg.id, contractsFolder.id, 'Service Agreement.pdf'),
      checksum: crypto.randomBytes(32).toString('hex'),
      status: 'READY',
      processingStatus: 'COMPLETE',
      metadata: { pages: 12, contractType: 'service', client: 'Client A' },
      extractedText: 'This Service Agreement is entered into between...',
      createdById: johnUser.id,
    },
    {
      organizationId: acmeOrg.id,
      folderId: contractsFolder.id,
      name: 'NDA - Partner Corp.pdf',
      originalName: 'NDA_PartnerCorp.pdf',
      mimeType: 'application/pdf',
      sizeBytes: BigInt(524288),
      s3Key: generateS3Key(acmeOrg.id, contractsFolder.id, 'NDA Partner.pdf'),
      checksum: crypto.randomBytes(32).toString('hex'),
      status: 'READY',
      processingStatus: 'COMPLETE',
      metadata: { pages: 5, contractType: 'nda', partner: 'Partner Corp' },
      createdById: johnUser.id,
    },

    // Documents in Invoices folder
    {
      organizationId: acmeOrg.id,
      folderId: invoicesFolder.id,
      name: 'Invoice-2024-001.pdf',
      originalName: 'Invoice-2024-001.pdf',
      mimeType: 'application/pdf',
      sizeBytes: BigInt(204800),
      s3Key: generateS3Key(acmeOrg.id, invoicesFolder.id, 'Invoice-2024-001.pdf'),
      checksum: crypto.randomBytes(32).toString('hex'),
      status: 'READY',
      processingStatus: 'COMPLETE',
      metadata: { invoiceNumber: 'INV-2024-001', amount: 5000, currency: 'USD' },
      createdById: janeUser.id,
    },
    {
      organizationId: acmeOrg.id,
      folderId: invoicesFolder.id,
      name: 'Invoice-2024-002.pdf',
      originalName: 'Invoice-2024-002.pdf',
      mimeType: 'application/pdf',
      sizeBytes: BigInt(215040),
      s3Key: generateS3Key(acmeOrg.id, invoicesFolder.id, 'Invoice-2024-002.pdf'),
      checksum: crypto.randomBytes(32).toString('hex'),
      status: 'READY',
      processingStatus: 'COMPLETE',
      metadata: { invoiceNumber: 'INV-2024-002', amount: 7500, currency: 'USD' },
      createdById: janeUser.id,
    },

    // Documents in Reports folder
    {
      organizationId: acmeOrg.id,
      folderId: reportsFolder.id,
      name: 'Q1 2024 Financial Report.xlsx',
      originalName: 'Q1_2024_Financial_Report.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      sizeBytes: BigInt(1572864),
      s3Key: generateS3Key(acmeOrg.id, reportsFolder.id, 'Q1 Report.xlsx'),
      checksum: crypto.randomBytes(32).toString('hex'),
      status: 'READY',
      processingStatus: 'COMPLETE',
      metadata: { sheets: 5, quarter: 'Q1', year: 2024 },
      createdById: janeUser.id,
    },

    // Documents in Website Redesign project
    {
      organizationId: acmeOrg.id,
      folderId: websiteRedesignFolder.id,
      name: 'Wireframes.fig',
      originalName: 'Website_Wireframes_v2.fig',
      mimeType: 'application/octet-stream',
      sizeBytes: BigInt(8388608),
      s3Key: generateS3Key(acmeOrg.id, websiteRedesignFolder.id, 'Wireframes.fig'),
      checksum: crypto.randomBytes(32).toString('hex'),
      status: 'READY',
      processingStatus: 'PENDING',
      metadata: { version: 2, tool: 'Figma' },
      createdById: janeUser.id,
    },
    {
      organizationId: acmeOrg.id,
      folderId: websiteRedesignFolder.id,
      name: 'Brand Guidelines.pdf',
      originalName: 'Brand_Guidelines_2024.pdf',
      mimeType: 'application/pdf',
      sizeBytes: BigInt(15728640),
      s3Key: generateS3Key(acmeOrg.id, websiteRedesignFolder.id, 'Brand Guidelines.pdf'),
      checksum: crypto.randomBytes(32).toString('hex'),
      status: 'READY',
      processingStatus: 'COMPLETE',
      metadata: { pages: 32, version: '2024.1' },
      createdById: janeUser.id,
    },

    // Word Documents (DOCX)
    {
      organizationId: acmeOrg.id,
      folderId: documentsFolder.id,
      name: 'Meeting Notes.docx',
      originalName: 'Meeting_Notes_2024_01.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sizeBytes: BigInt(524288),
      s3Key: generateS3Key(acmeOrg.id, documentsFolder.id, 'Meeting Notes.docx'),
      checksum: crypto.randomBytes(32).toString('hex'),
      status: 'READY',
      processingStatus: 'COMPLETE',
      metadata: { pages: 8, author: 'John Doe' },
      createdById: johnUser.id,
    },
    {
      organizationId: acmeOrg.id,
      folderId: contractsFolder.id,
      name: 'Employment Contract Template.docx',
      originalName: 'Employment_Contract_Template.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sizeBytes: BigInt(786432),
      s3Key: generateS3Key(acmeOrg.id, contractsFolder.id, 'Employment Contract.docx'),
      checksum: crypto.randomBytes(32).toString('hex'),
      status: 'READY',
      processingStatus: 'COMPLETE',
      metadata: { pages: 15, version: '3.0' },
      createdById: adminUser.id,
    },

    // Images (PNG, JPG)
    {
      organizationId: acmeOrg.id,
      folderId: websiteRedesignFolder.id,
      name: 'Company Logo.png',
      originalName: 'acme_logo_2024.png',
      mimeType: 'image/png',
      sizeBytes: BigInt(256000),
      s3Key: generateS3Key(acmeOrg.id, websiteRedesignFolder.id, 'Company Logo.png'),
      checksum: crypto.randomBytes(32).toString('hex'),
      status: 'READY',
      processingStatus: 'COMPLETE',
      metadata: { width: 1200, height: 600, format: 'PNG' },
      createdById: janeUser.id,
    },
    {
      organizationId: acmeOrg.id,
      folderId: websiteRedesignFolder.id,
      name: 'Hero Banner.jpg',
      originalName: 'website_hero_banner.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: BigInt(1048576),
      s3Key: generateS3Key(acmeOrg.id, websiteRedesignFolder.id, 'Hero Banner.jpg'),
      checksum: crypto.randomBytes(32).toString('hex'),
      status: 'READY',
      processingStatus: 'COMPLETE',
      metadata: { width: 1920, height: 1080, format: 'JPEG' },
      createdById: janeUser.id,
    },
    {
      organizationId: acmeOrg.id,
      folderId: documentsFolder.id,
      name: 'Team Photo.jpg',
      originalName: 'team_photo_2024.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: BigInt(2097152),
      s3Key: generateS3Key(acmeOrg.id, documentsFolder.id, 'Team Photo.jpg'),
      checksum: crypto.randomBytes(32).toString('hex'),
      status: 'READY',
      processingStatus: 'COMPLETE',
      metadata: { width: 4000, height: 3000, format: 'JPEG' },
      createdById: adminUser.id,
    },

    // Text Files (TXT)
    {
      organizationId: acmeOrg.id,
      folderId: documentsFolder.id,
      name: 'README.txt',
      originalName: 'README.txt',
      mimeType: 'text/plain',
      sizeBytes: BigInt(4096),
      s3Key: generateS3Key(acmeOrg.id, documentsFolder.id, 'README.txt'),
      checksum: crypto.randomBytes(32).toString('hex'),
      status: 'READY',
      processingStatus: 'COMPLETE',
      metadata: { encoding: 'UTF-8', lines: 50 },
      extractedText: 'This is the README file for the project...',
      createdById: adminUser.id,
    },

    // CSV Files
    {
      organizationId: acmeOrg.id,
      folderId: reportsFolder.id,
      name: 'Sales Data 2024.csv',
      originalName: 'sales_data_q1_2024.csv',
      mimeType: 'text/csv',
      sizeBytes: BigInt(102400),
      s3Key: generateS3Key(acmeOrg.id, reportsFolder.id, 'Sales Data 2024.csv'),
      checksum: crypto.randomBytes(32).toString('hex'),
      status: 'READY',
      processingStatus: 'COMPLETE',
      metadata: { rows: 1500, columns: 12, delimiter: ',' },
      createdById: janeUser.id,
    },
    {
      organizationId: acmeOrg.id,
      folderId: reportsFolder.id,
      name: 'Customer List.csv',
      originalName: 'customer_list_export.csv',
      mimeType: 'text/csv',
      sizeBytes: BigInt(51200),
      s3Key: generateS3Key(acmeOrg.id, reportsFolder.id, 'Customer List.csv'),
      checksum: crypto.randomBytes(32).toString('hex'),
      status: 'READY',
      processingStatus: 'COMPLETE',
      metadata: { rows: 500, columns: 8, delimiter: ',' },
      createdById: johnUser.id,
    },

    // Document currently being processed
    {
      organizationId: acmeOrg.id,
      folderId: documentsFolder.id,
      name: 'Scanned Contract.pdf',
      originalName: 'scan_001.pdf',
      mimeType: 'application/pdf',
      sizeBytes: BigInt(5242880),
      s3Key: generateS3Key(acmeOrg.id, documentsFolder.id, 'Scanned Contract.pdf'),
      checksum: crypto.randomBytes(32).toString('hex'),
      status: 'PROCESSING',
      processingStatus: 'OCR_IN_PROGRESS',
      metadata: { source: 'scanner', dpi: 300 },
      createdById: johnUser.id,
    },

    // Document with error
    {
      organizationId: acmeOrg.id,
      folderId: archiveFolder.id,
      name: 'Corrupted File.pdf',
      originalName: 'corrupted.pdf',
      mimeType: 'application/pdf',
      sizeBytes: BigInt(102400),
      s3Key: generateS3Key(acmeOrg.id, archiveFolder.id, 'Corrupted File.pdf'),
      status: 'ERROR',
      processingStatus: 'FAILED',
      metadata: { errorReason: 'Invalid PDF structure' },
      createdById: adminUser.id,
    },

    // Startup Inc documents
    {
      organizationId: startupOrg.id,
      folderId: startupDocsFolder.id,
      name: 'Business Plan 2024.pdf',
      originalName: 'Business_Plan_2024_Final.pdf',
      mimeType: 'application/pdf',
      sizeBytes: BigInt(3145728),
      s3Key: generateS3Key(startupOrg.id, startupDocsFolder.id, 'Business Plan.pdf'),
      checksum: crypto.randomBytes(32).toString('hex'),
      status: 'READY',
      processingStatus: 'COMPLETE',
      metadata: { pages: 28, confidential: true },
      createdById: bobUser.id,
    },
    {
      organizationId: startupOrg.id,
      folderId: null,
      name: 'Pitch Deck.pptx',
      originalName: 'Startup_Pitch_v3.pptx',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      sizeBytes: BigInt(10485760),
      s3Key: generateS3Key(startupOrg.id, null, 'Pitch Deck.pptx'),
      checksum: crypto.randomBytes(32).toString('hex'),
      status: 'READY',
      processingStatus: 'COMPLETE',
      metadata: { slides: 15, version: 3 },
      createdById: bobUser.id,
    },
  ];

  await prisma.document.createMany({
    data: documentData,
    skipDuplicates: true,
  });

  const documents = await prisma.document.findMany({
    where: { organizationId: { in: [acmeOrg.id, startupOrg.id] } },
  });

  console.log(`  Created ${documents.length} documents\n`);

  // ---------------------------------------------------------------------------
  // 6. CREATE DOCUMENT VERSIONS
  // ---------------------------------------------------------------------------
  console.log('Creating document versions...');

  const companyHandbook = documents.find((d) => d.name === 'Company Handbook.pdf');
  const brandGuidelines = documents.find((d) => d.name === 'Brand Guidelines.pdf');

  if (companyHandbook) {
    await prisma.documentVersion.createMany({
      data: [
        {
          documentId: companyHandbook.id,
          versionNumber: 1,
          s3Key: `${companyHandbook.s3Key}.v1`,
          sizeBytes: BigInt(2200000),
          checksum: crypto.randomBytes(32).toString('hex'),
          changeNote: 'Initial version',
          createdById: adminUser.id,
        },
        {
          documentId: companyHandbook.id,
          versionNumber: 2,
          s3Key: `${companyHandbook.s3Key}.v2`,
          sizeBytes: BigInt(2350000),
          checksum: crypto.randomBytes(32).toString('hex'),
          changeNote: 'Updated benefits section',
          createdById: adminUser.id,
        },
        {
          documentId: companyHandbook.id,
          versionNumber: 3,
          s3Key: companyHandbook.s3Key,
          sizeBytes: companyHandbook.sizeBytes,
          checksum: companyHandbook.checksum,
          changeNote: 'Added remote work policy',
          createdById: johnUser.id,
        },
      ],
      skipDuplicates: true,
    });
  }

  if (brandGuidelines) {
    await prisma.documentVersion.createMany({
      data: [
        {
          documentId: brandGuidelines.id,
          versionNumber: 1,
          s3Key: `${brandGuidelines.s3Key}.v1`,
          sizeBytes: BigInt(14000000),
          checksum: crypto.randomBytes(32).toString('hex'),
          changeNote: 'Initial brand guidelines',
          createdById: janeUser.id,
        },
        {
          documentId: brandGuidelines.id,
          versionNumber: 2,
          s3Key: brandGuidelines.s3Key,
          sizeBytes: brandGuidelines.sizeBytes,
          checksum: brandGuidelines.checksum,
          changeNote: 'Updated color palette for 2024',
          createdById: janeUser.id,
        },
      ],
      skipDuplicates: true,
    });
  }

  console.log('  Created document versions\n');

  // ---------------------------------------------------------------------------
  // 7. CREATE PROCESSING JOBS
  // ---------------------------------------------------------------------------
  console.log('Creating processing jobs...');

  const scannedContract = documents.find((d) => d.name === 'Scanned Contract.pdf');
  const corruptedFile = documents.find((d) => d.name === 'Corrupted File.pdf');

  const processingJobs: Prisma.ProcessingJobCreateManyInput[] = [];

  // Add OCR jobs for documents
  for (const doc of documents.filter((d) => d.mimeType === 'application/pdf' && d.status === 'READY')) {
    processingJobs.push({
      documentId: doc.id,
      jobType: 'OCR',
      status: 'COMPLETED',
      inputParams: { language: 'en', extractTables: true },
      outputData: { textLength: randomInt(1000, 10000), confidence: 0.95 },
      startedAt: new Date(Date.now() - 3600000),
      completedAt: new Date(Date.now() - 3000000),
    });
    processingJobs.push({
      documentId: doc.id,
      jobType: 'THUMBNAIL',
      status: 'COMPLETED',
      inputParams: { width: 200, height: 200, format: 'webp' },
      outputData: { thumbnailKey: `thumbnails/${doc.id}.webp` },
      startedAt: new Date(Date.now() - 2900000),
      completedAt: new Date(Date.now() - 2800000),
    });
  }

  // In-progress OCR job
  if (scannedContract) {
    processingJobs.push({
      documentId: scannedContract.id,
      jobType: 'OCR',
      status: 'RUNNING',
      inputParams: { language: 'en', extractTables: true, extractForms: true },
      startedAt: new Date(Date.now() - 60000),
    });
  }

  // Failed job
  if (corruptedFile) {
    processingJobs.push({
      documentId: corruptedFile.id,
      jobType: 'OCR',
      status: 'FAILED',
      attempts: 3,
      inputParams: { language: 'en' },
      errorMessage: 'Failed to parse PDF: Invalid document structure',
      errorStack: 'Error: Invalid PDF structure\n    at PDFParser.parse...',
      startedAt: new Date(Date.now() - 7200000),
      completedAt: new Date(Date.now() - 7100000),
    });
  }

  await prisma.processingJob.createMany({
    data: processingJobs,
  });

  console.log(`  Created ${processingJobs.length} processing jobs\n`);

  // ---------------------------------------------------------------------------
  // 8. CREATE API KEYS
  // ---------------------------------------------------------------------------
  console.log('Creating API keys...');

  await prisma.apiKey.createMany({
    data: [
      {
        organizationId: acmeOrg.id,
        name: 'Upload Agent - Office',
        keyPrefix: 'dms_live',
        keyHash: crypto.createHash('sha256').update('dms_live_key_123').digest('hex'),
        scopes: ['documents:read', 'documents:write', 'folders:read'],
        lastUsedAt: new Date(Date.now() - 86400000),
      },
      {
        organizationId: acmeOrg.id,
        name: 'Integration - CRM',
        keyPrefix: 'dms_int_',
        keyHash: crypto.createHash('sha256').update('dms_int_key_456').digest('hex'),
        scopes: ['documents:read'],
      },
      {
        organizationId: enterpriseOrg.id,
        name: 'Backup Service',
        keyPrefix: 'dms_bkp_',
        keyHash: crypto.createHash('sha256').update('dms_bkp_key_789').digest('hex'),
        scopes: ['documents:read', 'documents:write', 'folders:read', 'folders:write'],
        expiresAt: new Date(Date.now() + 31536000000), // 1 year
      },
    ],
  });

  console.log('  Created API keys\n');

  // ---------------------------------------------------------------------------
  // 9. CREATE AUDIT LOGS
  // ---------------------------------------------------------------------------
  console.log('Creating audit logs...');

  const auditLogs: Prisma.AuditLogCreateManyInput[] = [
    // User login events
    {
      organizationId: acmeOrg.id,
      userId: adminUser.id,
      action: 'USER_LOGIN',
      resourceType: 'USER',
      resourceId: adminUser.id,
      metadata: { provider: 'email' },
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    },
    {
      organizationId: acmeOrg.id,
      userId: johnUser.id,
      action: 'USER_LOGIN',
      resourceType: 'USER',
      resourceId: johnUser.id,
      metadata: { provider: 'google' },
      ipAddress: '10.0.0.50',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    },

    // Document events
    {
      organizationId: acmeOrg.id,
      userId: adminUser.id,
      action: 'DOCUMENT_CREATED',
      resourceType: 'DOCUMENT',
      resourceId: companyHandbook?.id,
      metadata: { fileName: 'Company Handbook.pdf', sizeBytes: 2457600 },
      ipAddress: '192.168.1.100',
    },
    {
      organizationId: acmeOrg.id,
      userId: johnUser.id,
      action: 'DOCUMENT_VIEWED',
      resourceType: 'DOCUMENT',
      resourceId: companyHandbook?.id,
      metadata: { viewDuration: 120 },
      ipAddress: '10.0.0.50',
    },
    {
      organizationId: acmeOrg.id,
      userId: janeUser.id,
      action: 'DOCUMENT_DOWNLOADED',
      resourceType: 'DOCUMENT',
      resourceId: brandGuidelines?.id,
      metadata: { fileName: 'Brand Guidelines.pdf' },
      ipAddress: '172.16.0.25',
    },

    // Folder events
    {
      organizationId: acmeOrg.id,
      userId: adminUser.id,
      action: 'FOLDER_CREATED',
      resourceType: 'FOLDER',
      resourceId: documentsFolder.id,
      metadata: { name: 'Documents', path: '/Documents' },
      ipAddress: '192.168.1.100',
    },
    {
      organizationId: acmeOrg.id,
      userId: johnUser.id,
      action: 'FOLDER_CREATED',
      resourceType: 'FOLDER',
      resourceId: contractsFolder.id,
      metadata: { name: 'Contracts', path: '/Documents/Contracts' },
      ipAddress: '10.0.0.50',
    },

    // Processing events
    {
      organizationId: acmeOrg.id,
      userId: null,
      action: 'PROCESSING_STARTED',
      resourceType: 'PROCESSING_JOB',
      metadata: { jobType: 'OCR', documentName: 'Scanned Contract.pdf' },
    },
    {
      organizationId: acmeOrg.id,
      userId: null,
      action: 'PROCESSING_FAILED',
      resourceType: 'PROCESSING_JOB',
      metadata: {
        jobType: 'OCR',
        documentName: 'Corrupted File.pdf',
        error: 'Invalid PDF structure',
      },
    },

    // Organization events
    {
      organizationId: acmeOrg.id,
      userId: adminUser.id,
      action: 'MEMBER_INVITED',
      resourceType: 'ORGANIZATION',
      resourceId: acmeOrg.id,
      metadata: { invitedEmail: 'alice.johnson@test.com', role: 'VIEWER' },
      ipAddress: '192.168.1.100',
    },
  ];

  await prisma.auditLog.createMany({
    data: auditLogs,
  });

  console.log(`  Created ${auditLogs.length} audit log entries\n`);

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('='.repeat(60));
  console.log('Seed completed successfully!');
  console.log('='.repeat(60));
  console.log('\nCreated:');
  console.log(`  - ${users.length} users`);
  console.log(`  - ${organizations.length} organizations`);
  console.log(`  - ${memberships.length} organization memberships`);
  console.log('  - 10 folders (nested hierarchy)');
  console.log(`  - ${documents.length} documents`);
  console.log('  - 5 document versions');
  console.log(`  - ${processingJobs.length} processing jobs`);
  console.log('  - 3 API keys');
  console.log(`  - ${auditLogs.length} audit log entries`);

  console.log('\nTest Accounts:');
  console.log('  Email: admin@dms-test.com | Password: admin123!');
  console.log('  Email: bob.wilson@test.com | Password: password123');
  console.log('  Email: alice.johnson@test.com | Password: password123');
  console.log('  Email: test@example.com | Password: password123 (E2E tests)');

  console.log('\nOrganizations:');
  console.log('  - Acme Corporation (Pro) - slug: acme-corp');
  console.log('  - Startup Inc (Free) - slug: startup-inc');
  console.log('  - Enterprise Solutions (Enterprise) - slug: enterprise-solutions');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
