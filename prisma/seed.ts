/**
 * Document Management System - Database Seed Script
 *
 * Creates sample data for development and testing:
 * - Test users with different auth providers
 * - Sample organizations with various plans
 * - Folder hierarchies
 * - Sample documents with REAL files uploaded to MinIO/S3
 * - Processing jobs
 * - Audit logs
 *
 * Usage:
 *   pnpm db:seed
 *   # or
 *   pnpm prisma db seed
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from apps/api/.env
config({ path: resolve(process.cwd(), 'apps/api/.env') });

import { PrismaClient, Prisma, DocumentStatus, ProcessingStatus } from '@prisma/client';
import * as crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { S3Client, PutObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const prisma = new PrismaClient();

// =============================================================================
// S3/MINIO CONFIGURATION
// =============================================================================

const S3_ENDPOINT = process.env.S3_ENDPOINT || 'http://localhost:9000';
const S3_BUCKET = process.env.S3_BUCKET || 'dms-documents-dev';
const S3_REGION = process.env.S3_REGION || 'us-east-1';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || 'minioadmin';
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || 'minioadmin';

const s3Client = new S3Client({
  region: S3_REGION,
  endpoint: S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

async function checkS3Connection(): Promise<boolean> {
  console.log(`  S3 Config: endpoint=${S3_ENDPOINT}, bucket=${S3_BUCKET}`);
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
    console.log(`  Connected to S3/MinIO bucket: ${S3_BUCKET}`);
    return true;
  } catch (error) {
    console.warn(`  Warning: Could not connect to S3/MinIO bucket ${S3_BUCKET}`);
    console.warn(`  Error: ${error instanceof Error ? error.message : String(error)}`);
    console.warn(`  Files will NOT be uploaded. Only database records will be created.`);
    return false;
  }
}

async function uploadToS3(key: string, buffer: Buffer, contentType: string): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
}

// =============================================================================
// FILE GENERATORS
// =============================================================================

async function generatePDF(title: string, content: string, pages = 1): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  for (let i = 0; i < pages; i++) {
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
    const { width, height } = page.getSize();

    // Header
    page.drawText(title, {
      x: 50,
      y: height - 50,
      size: 24,
      font: boldFont,
      color: rgb(0.2, 0.2, 0.2),
    });

    // Page number
    page.drawText(`Page ${i + 1} of ${pages}`, {
      x: width - 100,
      y: 30,
      size: 10,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Content
    const lines = content.split('\n');
    let yPosition = height - 100;
    for (const line of lines) {
      if (yPosition < 50) break;
      page.drawText(line.substring(0, 80), {
        x: 50,
        y: yPosition,
        size: 12,
        font,
        color: rgb(0, 0, 0),
      });
      yPosition -= 20;
    }

    // Sample content for remaining space
    if (pages > 1 && i < pages - 1) {
      page.drawText(`[Content continues on page ${i + 2}...]`, {
        x: 50,
        y: 100,
        size: 10,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

function generateTextFile(content: string): Buffer {
  return Buffer.from(content, 'utf-8');
}

function generateCSV(headers: string[], rows: string[][]): Buffer {
  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  return Buffer.from(csvContent, 'utf-8');
}

// Generate a simple PNG placeholder (1x1 pixel)
function generatePlaceholderImage(width: number, height: number, color: string): Buffer {
  // Create a simple BMP file as placeholder (simpler than PNG)
  // This creates a minimal valid image that browsers can display
  const size = width * height * 3 + 54; // 24-bit BMP
  const buffer = Buffer.alloc(size);

  // BMP Header
  buffer.write('BM', 0);
  buffer.writeUInt32LE(size, 2);
  buffer.writeUInt32LE(54, 10); // Data offset
  buffer.writeUInt32LE(40, 14); // DIB header size
  buffer.writeInt32LE(width, 18);
  buffer.writeInt32LE(-height, 22); // Negative for top-down
  buffer.writeUInt16LE(1, 26); // Planes
  buffer.writeUInt16LE(24, 28); // Bits per pixel
  buffer.writeUInt32LE(0, 30); // No compression
  buffer.writeUInt32LE(width * height * 3, 34); // Image size

  // Parse color (hex to RGB)
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);

  // Fill with color (BGR format for BMP)
  for (let i = 54; i < size; i += 3) {
    buffer[i] = b;
    buffer[i + 1] = g;
    buffer[i + 2] = r;
  }

  return buffer;
}

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
      update: {
        password: hashPassword('admin123!'),
      },
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
      update: {
        password: hashPassword('password123'),
      },
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
      update: {
        password: hashPassword('password123'),
      },
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
      update: {
        password: hashPassword('password123'),
      },
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
  // 5. CREATE DOCUMENTS WITH REAL FILE UPLOADS
  // ---------------------------------------------------------------------------
  console.log('Creating documents with real files...');

  // Check S3/MinIO connection
  const s3Connected = await checkS3Connection();

  // Helper to create document with file upload
  async function createDocumentWithFile(
    data: {
      organizationId: string;
      folderId: string | null;
      name: string;
      originalName: string;
      mimeType: string;
      status?: DocumentStatus;
      processingStatus?: ProcessingStatus;
      metadata?: Prisma.InputJsonValue;
      extractedText?: string;
      createdById: string;
    },
    fileGenerator: () => Promise<Buffer> | Buffer
  ) {
    const s3Key = generateS3Key(data.organizationId, data.folderId, data.name);
    const buffer = await fileGenerator();
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    // Upload to S3/MinIO if connected
    if (s3Connected) {
      await uploadToS3(s3Key, buffer, data.mimeType);
    }

    // Check if document already exists
    const existing = await prisma.document.findFirst({
      where: {
        organizationId: data.organizationId,
        name: data.name,
        folderId: data.folderId,
      },
    });

    if (existing) {
      return existing;
    }

    return prisma.document.create({
      data: {
        organizationId: data.organizationId,
        folderId: data.folderId,
        name: data.name,
        originalName: data.originalName,
        mimeType: data.mimeType,
        sizeBytes: BigInt(buffer.length),
        s3Key,
        checksum,
        status: data.status ?? DocumentStatus.READY,
        processingStatus: data.processingStatus ?? ProcessingStatus.COMPLETE,
        metadata: data.metadata ?? {},
        extractedText: data.extractedText,
        createdById: data.createdById,
      },
    });
  }

  const createdDocuments = [];

  // PDF Documents
  console.log('    Creating PDF documents...');

  createdDocuments.push(
    await createDocumentWithFile(
      {
        organizationId: acmeOrg.id,
        folderId: null,
        name: 'Company Handbook.pdf',
        originalName: 'Company_Handbook_2024.pdf',
        mimeType: 'application/pdf',
        metadata: { pages: 5, author: 'HR Department' },
        extractedText: `Company Handbook Acme Corporation policies procedures introduction values
        Innovation integrity collaboration company culture workplace guidelines
        HR department employee manual organizational structure expectations`,
        createdById: adminUser.id,
      },
      () =>
        generatePDF(
          'Company Handbook',
          `Welcome to Acme Corporation!

This handbook outlines our company policies and procedures.

Chapter 1: Introduction
Acme Corporation was founded in 2020 with a mission to provide
innovative solutions for document management.

Chapter 2: Company Values
- Innovation: We constantly seek new ways to improve.
- Integrity: We act with honesty and transparency.
- Collaboration: We work together to achieve goals.

Chapter 3: Policies
Please refer to your department head for specific policies.`,
          5
        )
    )
  );

  createdDocuments.push(
    await createDocumentWithFile(
      {
        organizationId: acmeOrg.id,
        folderId: contractsFolder.id,
        name: 'Service Agreement - Client A.pdf',
        originalName: 'ServiceAgreement_ClientA_2024.pdf',
        mimeType: 'application/pdf',
        metadata: { pages: 3, contractType: 'service', client: 'Client A' },
        extractedText: 'This Service Agreement is entered into between...',
        createdById: johnUser.id,
      },
      () =>
        generatePDF(
          'Service Agreement',
          `SERVICE AGREEMENT

This Service Agreement ("Agreement") is entered into between
Acme Corporation ("Provider") and Client A ("Client").

1. SERVICES
Provider agrees to provide document management services.

2. TERM
This agreement is effective for 12 months.

3. PAYMENT
Client agrees to pay monthly service fees.`,
          3
        )
    )
  );

  createdDocuments.push(
    await createDocumentWithFile(
      {
        organizationId: acmeOrg.id,
        folderId: contractsFolder.id,
        name: 'NDA - Partner Corp.pdf',
        originalName: 'NDA_PartnerCorp.pdf',
        mimeType: 'application/pdf',
        metadata: { pages: 2, contractType: 'nda', partner: 'Partner Corp' },
        extractedText: `Non-Disclosure Agreement NDA confidential information protection
        Partner Corp partnership confidentiality trade secrets proprietary information
        Five year term legal binding agreement parties mutual protection`,
        createdById: johnUser.id,
      },
      () =>
        generatePDF(
          'Non-Disclosure Agreement',
          `NON-DISCLOSURE AGREEMENT

This NDA is entered into between Acme Corporation and Partner Corp.

1. CONFIDENTIAL INFORMATION
Both parties agree to protect confidential information.

2. TERM
This agreement remains in effect for 5 years.`,
          2
        )
    )
  );

  createdDocuments.push(
    await createDocumentWithFile(
      {
        organizationId: acmeOrg.id,
        folderId: invoicesFolder.id,
        name: 'Invoice-2024-001.pdf',
        originalName: 'Invoice-2024-001.pdf',
        mimeType: 'application/pdf',
        metadata: { invoiceNumber: 'INV-2024-001', amount: 5000, currency: 'USD' },
        extractedText: `Invoice INV-2024-001 January 2024 Client A billing payment
        Document Management Services five thousand dollars amount due
        Net 30 payment terms business street address`,
        createdById: janeUser.id,
      },
      () =>
        generatePDF(
          'Invoice INV-2024-001',
          `INVOICE

Invoice Number: INV-2024-001
Date: January 15, 2024

Bill To:
Client A
123 Business Street

Services Rendered:
Document Management Services - January 2024

Amount Due: $5,000.00

Payment Terms: Net 30`,
          1
        )
    )
  );

  createdDocuments.push(
    await createDocumentWithFile(
      {
        organizationId: acmeOrg.id,
        folderId: invoicesFolder.id,
        name: 'Invoice-2024-002.pdf',
        originalName: 'Invoice-2024-002.pdf',
        mimeType: 'application/pdf',
        metadata: { invoiceNumber: 'INV-2024-002', amount: 7500, currency: 'USD' },
        extractedText: `Invoice INV-2024-002 February 2024 Client B premium billing
        Premium Document Management Services seven thousand five hundred dollars
        Corporate Avenue net 30 payment terms monthly billing`,
        createdById: janeUser.id,
      },
      () =>
        generatePDF(
          'Invoice INV-2024-002',
          `INVOICE

Invoice Number: INV-2024-002
Date: February 15, 2024

Bill To:
Client B
456 Corporate Ave

Services Rendered:
Premium Document Management Services - February 2024

Amount Due: $7,500.00

Payment Terms: Net 30`,
          1
        )
    )
  );

  createdDocuments.push(
    await createDocumentWithFile(
      {
        organizationId: acmeOrg.id,
        folderId: websiteRedesignFolder.id,
        name: 'Brand Guidelines.pdf',
        originalName: 'Brand_Guidelines_2024.pdf',
        mimeType: 'application/pdf',
        metadata: { pages: 4, version: '2024.1' },
        extractedText: `Brand Guidelines 2024 logo usage color palette typography
        Primary blue secondary green accent orange professional approachable
        Inter font headings body voice tone visual identity design system`,
        createdById: janeUser.id,
      },
      () =>
        generatePDF(
          'Brand Guidelines 2024',
          `ACME CORPORATION BRAND GUIDELINES

Version 2024.1

1. LOGO USAGE
- Always maintain clear space around the logo
- Minimum size: 100px width

2. COLOR PALETTE
Primary: #2563EB (Blue)
Secondary: #10B981 (Green)
Accent: #F59E0B (Orange)

3. TYPOGRAPHY
Headings: Inter Bold
Body: Inter Regular

4. VOICE AND TONE
Professional yet approachable`,
          4
        )
    )
  );

  // Text Files
  console.log('    Creating text documents...');

  createdDocuments.push(
    await createDocumentWithFile(
      {
        organizationId: acmeOrg.id,
        folderId: documentsFolder.id,
        name: 'README.txt',
        originalName: 'README.txt',
        mimeType: 'text/plain',
        metadata: { encoding: 'UTF-8', lines: 20 },
        extractedText: 'Document Management System Project',
        createdById: adminUser.id,
      },
      () =>
        generateTextFile(`Document Management System - README
=====================================

Welcome to the Acme Corporation Document Management System.

Getting Started:
1. Upload your documents via the web interface
2. Organize documents into folders
3. Use AI-powered search to find documents

Features:
- Cloud storage with versioning
- AI-powered OCR and classification
- Real-time collaboration
- Secure sharing with permissions

For support, contact: support@acme-corp.com`)
    )
  );

  // CSV Files
  console.log('    Creating CSV documents...');

  createdDocuments.push(
    await createDocumentWithFile(
      {
        organizationId: acmeOrg.id,
        folderId: reportsFolder.id,
        name: 'Sales Data 2024.csv',
        originalName: 'sales_data_q1_2024.csv',
        mimeType: 'text/csv',
        metadata: { rows: 10, columns: 4, delimiter: ',' },
        extractedText: `Sales data Q1 2024 quarterly revenue product breakdown
        Basic Plan Pro Plan Enterprise subscription tiers pricing
        January February March quarterly sales performance revenue`,
        createdById: janeUser.id,
      },
      () =>
        generateCSV(
          ['Date', 'Product', 'Quantity', 'Revenue'],
          [
            ['2024-01-05', 'Basic Plan', '15', '7500'],
            ['2024-01-12', 'Pro Plan', '8', '12000'],
            ['2024-01-19', 'Enterprise', '2', '10000'],
            ['2024-02-02', 'Basic Plan', '20', '10000'],
            ['2024-02-09', 'Pro Plan', '12', '18000'],
            ['2024-02-16', 'Enterprise', '3', '15000'],
            ['2024-03-01', 'Basic Plan', '18', '9000'],
            ['2024-03-08', 'Pro Plan', '10', '15000'],
            ['2024-03-15', 'Enterprise', '4', '20000'],
          ]
        )
    )
  );

  createdDocuments.push(
    await createDocumentWithFile(
      {
        organizationId: acmeOrg.id,
        folderId: reportsFolder.id,
        name: 'Customer List.csv',
        originalName: 'customer_list_export.csv',
        mimeType: 'text/csv',
        metadata: { rows: 6, columns: 4, delimiter: ',' },
        extractedText: `Customer list directory contacts enterprise pro basic plans
        Acme Industries TechStart Global Corp Local Business StartupXYZ
        Customer ID names email addresses subscription tier CRM export`,
        createdById: johnUser.id,
      },
      () =>
        generateCSV(
          ['CustomerID', 'Name', 'Email', 'Plan'],
          [
            ['C001', 'Acme Industries', 'contact@acme-ind.com', 'Enterprise'],
            ['C002', 'TechStart Inc', 'hello@techstart.io', 'Pro'],
            ['C003', 'Global Corp', 'info@globalcorp.com', 'Enterprise'],
            ['C004', 'Local Business', 'owner@localbiz.com', 'Basic'],
            ['C005', 'StartupXYZ', 'team@startupxyz.co', 'Pro'],
          ]
        )
    )
  );

  // Image Files (BMP for simplicity - browsers can display these)
  console.log('    Creating image documents...');

  createdDocuments.push(
    await createDocumentWithFile(
      {
        organizationId: acmeOrg.id,
        folderId: websiteRedesignFolder.id,
        name: 'Company Logo.bmp',
        originalName: 'acme_logo_2024.bmp',
        mimeType: 'image/bmp',
        metadata: { width: 100, height: 50, format: 'BMP' },
        extractedText: `Acme Corporation company logo brand identity visual branding
        Blue corporate logo official company trademark marketing asset`,
        createdById: janeUser.id,
      },
      () => generatePlaceholderImage(100, 50, '#2563EB')
    )
  );

  createdDocuments.push(
    await createDocumentWithFile(
      {
        organizationId: acmeOrg.id,
        folderId: websiteRedesignFolder.id,
        name: 'Hero Banner.bmp',
        originalName: 'website_hero_banner.bmp',
        mimeType: 'image/bmp',
        metadata: { width: 200, height: 100, format: 'BMP' },
        extractedText: `Website hero banner homepage graphic landing page visual
        Green gradient marketing banner call to action promotional image`,
        createdById: janeUser.id,
      },
      () => generatePlaceholderImage(200, 100, '#10B981')
    )
  );

  createdDocuments.push(
    await createDocumentWithFile(
      {
        organizationId: acmeOrg.id,
        folderId: documentsFolder.id,
        name: 'Team Photo.bmp',
        originalName: 'team_photo_2024.bmp',
        mimeType: 'image/bmp',
        metadata: { width: 150, height: 100, format: 'BMP' },
        extractedText: `Team photo 2024 company employees group picture staff
        Engineering product sales marketing operations team members office`,
        createdById: adminUser.id,
      },
      () => generatePlaceholderImage(150, 100, '#F59E0B')
    )
  );

  // Startup Inc documents
  createdDocuments.push(
    await createDocumentWithFile(
      {
        organizationId: startupOrg.id,
        folderId: startupDocsFolder.id,
        name: 'Business Plan 2024.pdf',
        originalName: 'Business_Plan_2024_Final.pdf',
        mimeType: 'application/pdf',
        metadata: { pages: 3, confidential: true },
        extractedText: `Business Plan 2024 Startup Inc Executive Summary Market Analysis Financial Projections
        Target market size fifty billion dollars growth rate fifteen percent year over year
        Revenue projections year one five hundred thousand year two two million year three five million`,
        createdById: bobUser.id,
      },
      () =>
        generatePDF(
          'Startup Inc Business Plan 2024',
          `BUSINESS PLAN 2024

Executive Summary:
Startup Inc aims to disrupt the market with innovative solutions.

Market Analysis:
- Target market size: $50B
- Growth rate: 15% YoY

Financial Projections:
- Year 1: $500K revenue
- Year 2: $2M revenue
- Year 3: $5M revenue`,
          3
        )
    )
  );

  // =============================================================================
  // ADDITIONAL AI SEARCH DOCUMENTS - Rich content for semantic search testing
  // =============================================================================
  console.log('    Creating AI search test documents...');

  // --- FINANCIAL DOCUMENTS ---
  createdDocuments.push(
    await createDocumentWithFile(
      {
        organizationId: acmeOrg.id,
        folderId: reportsFolder.id,
        name: 'Q4 2024 Financial Report.pdf',
        originalName: 'Q4_2024_Financial_Report.pdf',
        mimeType: 'application/pdf',
        metadata: { pages: 8, department: 'Finance', quarter: 'Q4', year: 2024 },
        extractedText: `Quarterly Financial Report Q4 2024 Acme Corporation
        Revenue Analysis: Total revenue reached $15.2 million, representing a 23% increase year-over-year.
        Gross margin improved to 68%, up from 62% in Q4 2023.
        Operating expenses decreased by 8% due to efficiency improvements.
        Net income: $4.1 million, earnings per share: $2.15
        Cash flow from operations: $5.8 million
        Key performance indicators: Customer acquisition cost decreased 15%, lifetime value increased 20%
        Market share grew from 12% to 18% in the enterprise segment.
        Product revenue breakdown: Document Management Suite 45%, AI Processing 30%, API Services 25%
        Geographic revenue: North America 60%, Europe 25%, Asia Pacific 15%
        Headcount increased from 85 to 112 employees.
        R&D investment: $2.3 million focused on AI and machine learning capabilities.`,
        createdById: janeUser.id,
      },
      () =>
        generatePDF(
          'Q4 2024 Financial Report',
          `ACME CORPORATION
QUARTERLY FINANCIAL REPORT - Q4 2024

EXECUTIVE SUMMARY
Total revenue: $15.2 million (+23% YoY)
Net income: $4.1 million
Gross margin: 68%

REVENUE BREAKDOWN
- Document Management Suite: 45%
- AI Processing Services: 30%
- API Services: 25%

KEY METRICS
- Customer Acquisition Cost: -15%
- Customer Lifetime Value: +20%
- Market Share: 18% (up from 12%)

GEOGRAPHIC DISTRIBUTION
- North America: 60%
- Europe: 25%
- Asia Pacific: 15%`,
          8
        )
    )
  );

  createdDocuments.push(
    await createDocumentWithFile(
      {
        organizationId: acmeOrg.id,
        folderId: reportsFolder.id,
        name: 'Annual Budget 2025.pdf',
        originalName: 'Annual_Budget_2025.pdf',
        mimeType: 'application/pdf',
        metadata: { pages: 12, department: 'Finance', fiscalYear: 2025 },
        extractedText: `Annual Budget Planning Document Fiscal Year 2025
        Total budget allocation: $45 million
        Engineering department: $18 million for product development and infrastructure
        Sales and Marketing: $12 million including digital marketing campaigns and trade shows
        Operations: $8 million for cloud infrastructure and customer support
        Research and Development: $5 million for AI innovation and patent filing
        General and Administrative: $2 million for legal, HR, and facilities
        Capital expenditure: $3 million for equipment and office expansion
        Contingency reserve: 5% of total budget
        Revenue targets: $65 million with 40% gross margin
        Hiring plan: 45 new positions across engineering, sales, and support
        Key initiatives: Launch AI document classification v2, expand European operations,
        achieve SOC 2 Type II certification, implement automated customer onboarding`,
        createdById: janeUser.id,
      },
      () =>
        generatePDF(
          'Annual Budget 2025',
          `ANNUAL BUDGET PLANNING
FISCAL YEAR 2025

TOTAL BUDGET: $45 MILLION

DEPARTMENT ALLOCATIONS:
- Engineering: $18M
- Sales & Marketing: $12M
- Operations: $8M
- R&D: $5M
- G&A: $2M

CAPEX: $3M
CONTINGENCY: 5%

REVENUE TARGET: $65M
GROSS MARGIN TARGET: 40%`,
          12
        )
    )
  );

  // --- TECHNICAL DOCUMENTS ---
  createdDocuments.push(
    await createDocumentWithFile(
      {
        organizationId: acmeOrg.id,
        folderId: projectsFolder.id,
        name: 'System Architecture Overview.pdf',
        originalName: 'System_Architecture_v2.pdf',
        mimeType: 'application/pdf',
        metadata: { pages: 15, version: '2.0', author: 'Engineering Team' },
        extractedText: `System Architecture Documentation Version 2.0
        Microservices architecture with twelve independent services
        API Gateway handles authentication, rate limiting, and request routing
        Document Service manages file uploads, metadata, and versioning
        Processing Service handles OCR, text extraction, and AI classification
        Search Service provides full-text search using Elasticsearch and semantic search with pgvector
        Storage layer uses AWS S3 for documents and PostgreSQL for metadata
        Redis for session caching and job queues using BullMQ
        WebSocket service for real-time collaboration and presence
        Authentication via JWT tokens with OAuth 2.0 support for Google and Microsoft
        Kubernetes deployment with horizontal pod autoscaling
        CI/CD pipeline using GitHub Actions with automated testing and deployment
        Monitoring stack: Prometheus, Grafana, and Sentry for error tracking
        Security: TLS 1.3, encryption at rest, row-level security in PostgreSQL`,
        createdById: johnUser.id,
      },
      () =>
        generatePDF(
          'System Architecture Overview',
          `SYSTEM ARCHITECTURE DOCUMENTATION
Version 2.0

ARCHITECTURE PATTERN
Microservices with API Gateway

CORE SERVICES:
1. API Gateway - Auth, rate limiting, routing
2. Document Service - File management
3. Processing Service - OCR, AI classification
4. Search Service - Full-text & semantic search

DATA LAYER:
- PostgreSQL with pgvector
- AWS S3 for storage
- Redis for caching

DEPLOYMENT:
- Kubernetes with HPA
- GitHub Actions CI/CD`,
          15
        )
    )
  );

  createdDocuments.push(
    await createDocumentWithFile(
      {
        organizationId: acmeOrg.id,
        folderId: projectsFolder.id,
        name: 'API Documentation v3.pdf',
        originalName: 'API_Documentation_v3.pdf',
        mimeType: 'application/pdf',
        metadata: { pages: 25, version: '3.0', apiVersion: 'v3' },
        extractedText: `REST API Documentation Version 3
        Base URL: https://api.acme-dms.com/v3
        Authentication: Bearer token in Authorization header
        Rate limiting: 1000 requests per minute for Pro plan, 5000 for Enterprise

        Documents Endpoints:
        GET /documents - List all documents with pagination and filtering
        POST /documents - Create new document, returns presigned upload URL
        GET /documents/:id - Get document details including metadata and versions
        PATCH /documents/:id - Update document metadata
        DELETE /documents/:id - Move document to trash
        POST /documents/:id/process - Trigger OCR or AI classification

        Folders Endpoints:
        GET /folders - List folder hierarchy
        POST /folders - Create new folder
        GET /folders/:id/contents - Get folder contents

        Search Endpoints:
        GET /search - Full-text search with filters
        POST /search/semantic - AI-powered semantic search

        Webhooks: Document events, processing completion, sharing events
        SDKs available for JavaScript, Python, Java, and Go`,
        createdById: johnUser.id,
      },
      () =>
        generatePDF(
          'API Documentation v3',
          `REST API DOCUMENTATION
Version 3.0

BASE URL: https://api.acme-dms.com/v3

AUTHENTICATION
Bearer token in Authorization header

RATE LIMITS
- Pro: 1000 req/min
- Enterprise: 5000 req/min

ENDPOINTS:
/documents - CRUD operations
/folders - Folder management
/search - Full-text & semantic search
/webhooks - Event subscriptions

SDKs: JS, Python, Java, Go`,
          25
        )
    )
  );

  // --- HR DOCUMENTS ---
  createdDocuments.push(
    await createDocumentWithFile(
      {
        organizationId: acmeOrg.id,
        folderId: documentsFolder.id,
        name: 'Employee Benefits Guide 2025.pdf',
        originalName: 'Employee_Benefits_Guide_2025.pdf',
        mimeType: 'application/pdf',
        metadata: { pages: 18, department: 'HR', effectiveDate: '2025-01-01' },
        extractedText: `Employee Benefits Guide 2025
        Health Insurance: PPO and HMO options with dental and vision coverage
        401(k) retirement plan with 4% company match, vesting after 2 years
        Paid time off: 20 days PTO plus 10 paid holidays
        Parental leave: 16 weeks paid leave for primary caregivers
        Remote work policy: Flexible hybrid schedule, 3 days office minimum
        Professional development: $3,000 annual learning budget
        Wellness program: Gym membership reimbursement up to $100/month
        Employee stock purchase plan: 15% discount on company shares
        Life insurance: 2x annual salary coverage included
        Disability insurance: Short-term and long-term coverage
        Commuter benefits: Pre-tax transit and parking
        Employee assistance program: Counseling and mental health support
        Tuition reimbursement: Up to $5,250 per year for approved courses`,
        createdById: adminUser.id,
      },
      () =>
        generatePDF(
          'Employee Benefits Guide 2025',
          `EMPLOYEE BENEFITS GUIDE
Effective January 1, 2025

HEALTH & WELLNESS
- Medical: PPO/HMO options
- Dental & Vision included
- Wellness: $100/mo gym reimbursement

FINANCIAL
- 401(k) with 4% match
- ESPP: 15% discount
- Life insurance: 2x salary

TIME OFF
- 20 days PTO
- 10 paid holidays
- 16 weeks parental leave

DEVELOPMENT
- $3,000 learning budget
- $5,250 tuition reimbursement`,
          18
        )
    )
  );

  createdDocuments.push(
    await createDocumentWithFile(
      {
        organizationId: acmeOrg.id,
        folderId: documentsFolder.id,
        name: 'Remote Work Policy.pdf',
        originalName: 'Remote_Work_Policy_2024.pdf',
        mimeType: 'application/pdf',
        metadata: { pages: 6, department: 'HR', policyVersion: '2.1' },
        extractedText: `Remote Work Policy Guidelines
        Eligibility: All employees after 90-day probation period
        Core hours: 10 AM to 3 PM local time for meetings and collaboration
        Equipment: Company provides laptop, monitor, keyboard, and mouse
        Home office stipend: $500 one-time setup allowance
        Internet reimbursement: Up to $75 monthly for high-speed internet
        Security requirements: VPN required, encrypted devices, no public WiFi
        Communication tools: Slack for messaging, Zoom for video calls
        Performance expectations: Same standards as in-office work
        Manager approval: Required for schedule changes
        In-office requirements: Minimum 3 days per week, team meetings
        Workspace requirements: Dedicated workspace with proper lighting
        Data protection: Company data must not be stored on personal devices`,
        createdById: adminUser.id,
      },
      () =>
        generatePDF(
          'Remote Work Policy',
          `REMOTE WORK POLICY
Version 2.1

ELIGIBILITY
All employees after 90-day probation

SCHEDULE
- Core hours: 10 AM - 3 PM
- Office minimum: 3 days/week

EQUIPMENT & BENEFITS
- Company-provided devices
- $500 setup allowance
- $75/mo internet reimbursement

SECURITY
- VPN required
- Encrypted devices
- No public WiFi`,
          6
        )
    )
  );

  // --- LEGAL DOCUMENTS ---
  createdDocuments.push(
    await createDocumentWithFile(
      {
        organizationId: acmeOrg.id,
        folderId: contractsFolder.id,
        name: 'Terms of Service.pdf',
        originalName: 'Terms_of_Service_v4.pdf',
        mimeType: 'application/pdf',
        metadata: { pages: 20, legalDocument: true, version: '4.0' },
        extractedText: `Terms of Service Agreement
        Acme Document Management System Terms and Conditions
        Effective Date: January 1, 2025

        Acceptance of Terms: By accessing our services you agree to these terms
        User Responsibilities: Maintain account security, comply with laws
        Prohibited Uses: No illegal content, malware, or unauthorized access
        Data Ownership: Users retain ownership of uploaded documents
        Privacy: We collect usage data as described in Privacy Policy
        Service Level Agreement: 99.9% uptime guarantee for paid plans
        Liability Limitations: Maximum liability limited to fees paid
        Termination: Either party may terminate with 30 days notice
        Dispute Resolution: Binding arbitration in San Francisco, California
        Intellectual Property: Service and technology owned by Acme Corporation
        Modifications: Terms may be updated with 30 days notice
        Contact Information: legal@acme-dms.com`,
        createdById: adminUser.id,
      },
      () =>
        generatePDF(
          'Terms of Service',
          `TERMS OF SERVICE
Version 4.0 | Effective: January 1, 2025

1. ACCEPTANCE OF TERMS
By using our services, you agree to these terms.

2. USER RESPONSIBILITIES
- Maintain account security
- Comply with applicable laws

3. DATA & PRIVACY
- Users own their data
- 99.9% uptime SLA

4. LEGAL
- Arbitration in San Francisco
- 30-day termination notice`,
          20
        )
    )
  );

  createdDocuments.push(
    await createDocumentWithFile(
      {
        organizationId: acmeOrg.id,
        folderId: contractsFolder.id,
        name: 'Data Processing Agreement.pdf',
        originalName: 'DPA_GDPR_Compliant.pdf',
        mimeType: 'application/pdf',
        metadata: { pages: 14, legalDocument: true, compliance: ['GDPR', 'CCPA'] },
        extractedText: `Data Processing Agreement GDPR and CCPA Compliant
        Controller and Processor responsibilities defined
        Personal data categories: User account information, document metadata
        Processing purposes: Document storage, OCR processing, AI classification
        Security measures: Encryption at rest and in transit, access controls
        Subprocessors: AWS for infrastructure, OpenAI for AI processing
        Data retention: Documents retained until user deletion, logs for 90 days
        Data subject rights: Access, rectification, erasure, portability
        Breach notification: Within 72 hours of discovery
        International transfers: Standard Contractual Clauses for EU data
        Audit rights: Annual audit upon reasonable notice
        Technical measures: SOC 2 Type II certified infrastructure
        Organizational measures: Employee training, background checks`,
        createdById: adminUser.id,
      },
      () =>
        generatePDF(
          'Data Processing Agreement',
          `DATA PROCESSING AGREEMENT
GDPR & CCPA Compliant

PARTIES
Controller: Customer
Processor: Acme Corporation

PROCESSING DETAILS
- Document storage & processing
- OCR and AI classification

SECURITY MEASURES
- Encryption at rest/transit
- SOC 2 Type II certified

DATA SUBJECT RIGHTS
- Access, rectification, erasure
- 72-hour breach notification`,
          14
        )
    )
  );

  // --- MARKETING DOCUMENTS ---
  createdDocuments.push(
    await createDocumentWithFile(
      {
        organizationId: acmeOrg.id,
        folderId: websiteRedesignFolder.id,
        name: 'Product Launch Campaign 2025.pdf',
        originalName: 'Product_Launch_Campaign_Q1_2025.pdf',
        mimeType: 'application/pdf',
        metadata: { pages: 10, department: 'Marketing', campaign: 'Q1 2025 Launch' },
        extractedText: `Product Launch Campaign Plan Q1 2025
        Campaign objective: Launch AI Document Classification v2
        Target audience: Enterprise IT decision makers and document management professionals
        Key messages: 90% accuracy improvement, 50% faster processing, lower costs
        Channels: LinkedIn advertising, Google Ads, industry publications, webinars
        Budget: $500,000 across digital and events
        Timeline: Soft launch January 15, full launch February 1
        Content plan: Blog posts, case studies, video testimonials, white papers
        Launch event: Virtual conference with keynote and product demos
        Press release: Embargoed until February 1
        Influencer partnerships: Document management industry analysts
        Success metrics: 1000 new trial signups, 50 enterprise demos, 25% conversion rate
        Follow-up: Nurture campaigns, customer success stories`,
        createdById: janeUser.id,
      },
      () =>
        generatePDF(
          'Product Launch Campaign 2025',
          `PRODUCT LAUNCH CAMPAIGN
Q1 2025 - AI Classification v2

OBJECTIVE
Launch AI Document Classification v2

TARGET AUDIENCE
Enterprise IT decision makers

KEY MESSAGES
- 90% accuracy improvement
- 50% faster processing

BUDGET: $500,000

TIMELINE
- Soft launch: Jan 15
- Full launch: Feb 1

SUCCESS METRICS
- 1000 trial signups
- 50 enterprise demos`,
          10
        )
    )
  );

  createdDocuments.push(
    await createDocumentWithFile(
      {
        organizationId: acmeOrg.id,
        folderId: websiteRedesignFolder.id,
        name: 'Competitive Analysis Report.pdf',
        originalName: 'Competitive_Analysis_2024.pdf',
        mimeType: 'application/pdf',
        metadata: { pages: 22, department: 'Marketing', confidential: true },
        extractedText: `Competitive Landscape Analysis 2024
        Main competitors: DocuSign, Box, Dropbox, Google Drive, SharePoint
        Our differentiators: AI-powered OCR, semantic search, better pricing
        Market positioning: Mid-market and enterprise focus

        DocuSign: Strong in e-signatures, limited document management
        Box: Enterprise focused, complex pricing, good security
        Dropbox: Consumer focused, simple interface, limited enterprise features
        Google Drive: Integrated with Workspace, limited processing capabilities
        SharePoint: Microsoft ecosystem lock-in, steep learning curve

        Our advantages: Superior AI processing, unified platform, competitive pricing
        Our weaknesses: Smaller brand recognition, fewer integrations
        Opportunities: Growing demand for AI document processing, hybrid work trends
        Threats: Big tech bundling, economic uncertainty affecting IT budgets
        Recommendations: Focus on AI differentiation, expand partner ecosystem`,
        createdById: janeUser.id,
      },
      () =>
        generatePDF(
          'Competitive Analysis Report',
          `COMPETITIVE LANDSCAPE ANALYSIS
2024 Report - CONFIDENTIAL

KEY COMPETITORS
- DocuSign, Box, Dropbox
- Google Drive, SharePoint

OUR DIFFERENTIATORS
- Superior AI processing
- Semantic search
- Competitive pricing

SWOT ANALYSIS
Strengths: AI, unified platform
Weaknesses: Brand recognition
Opportunities: AI demand growth
Threats: Big tech bundling`,
          22
        )
    )
  );

  // --- ADDITIONAL SPREADSHEETS ---
  createdDocuments.push(
    await createDocumentWithFile(
      {
        organizationId: acmeOrg.id,
        folderId: reportsFolder.id,
        name: 'Project Tracking 2025.csv',
        originalName: 'Project_Tracking_2025.csv',
        mimeType: 'text/csv',
        metadata: { rows: 12, columns: 6, type: 'project_tracking' },
        extractedText: `Project tracking spreadsheet 2025 initiatives
        AI Classification v2 development in progress target March completion
        API v3 migration planning phase scheduled for Q2
        Mobile app development design phase iOS and Android
        SOC 2 certification audit in progress expected May completion
        European data center expansion planning Q3 launch
        Customer portal redesign requirements gathering
        Integration marketplace development approved
        Performance optimization infrastructure ongoing
        Security audit remediation in progress
        Analytics dashboard new feature development`,
        createdById: johnUser.id,
      },
      () =>
        generateCSV(
          ['Project', 'Status', 'Owner', 'Start Date', 'Target Date', 'Budget'],
          [
            ['AI Classification v2', 'In Progress', 'Engineering', '2024-10-01', '2025-03-01', '$500K'],
            ['API v3 Migration', 'Planning', 'Engineering', '2025-04-01', '2025-06-30', '$200K'],
            ['Mobile App', 'Design', 'Product', '2025-01-15', '2025-08-01', '$750K'],
            ['SOC 2 Certification', 'In Progress', 'Security', '2024-09-01', '2025-05-01', '$150K'],
            ['EU Data Center', 'Planning', 'DevOps', '2025-06-01', '2025-09-30', '$1.2M'],
            ['Customer Portal', 'Requirements', 'Product', '2025-02-01', '2025-07-01', '$300K'],
            ['Integration Marketplace', 'Approved', 'Partnerships', '2025-03-01', '2025-10-01', '$400K'],
            ['Performance Optimization', 'Ongoing', 'DevOps', '2024-01-01', '2025-12-31', '$100K'],
            ['Security Remediation', 'In Progress', 'Security', '2024-11-01', '2025-02-28', '$75K'],
            ['Analytics Dashboard', 'Development', 'Data', '2024-12-01', '2025-04-01', '$150K'],
          ]
        )
    )
  );

  createdDocuments.push(
    await createDocumentWithFile(
      {
        organizationId: acmeOrg.id,
        folderId: reportsFolder.id,
        name: 'Employee Directory.csv',
        originalName: 'Employee_Directory_2025.csv',
        mimeType: 'text/csv',
        metadata: { rows: 15, columns: 5, type: 'directory' },
        extractedText: `Employee directory department structure and contact information
        Engineering team software developers infrastructure cloud specialists
        Product team product managers designers user researchers
        Sales team account executives business development customer success
        Marketing team content creators digital marketing brand management
        Operations team HR finance legal administration support`,
        createdById: adminUser.id,
      },
      () =>
        generateCSV(
          ['Name', 'Department', 'Title', 'Email', 'Location'],
          [
            ['Sarah Chen', 'Engineering', 'VP Engineering', 'sarah.chen@acme.com', 'San Francisco'],
            ['Michael Rodriguez', 'Engineering', 'Senior Developer', 'michael.r@acme.com', 'Remote'],
            ['Emily Watson', 'Engineering', 'DevOps Lead', 'emily.w@acme.com', 'San Francisco'],
            ['David Kim', 'Product', 'Product Manager', 'david.kim@acme.com', 'New York'],
            ['Lisa Thompson', 'Product', 'UX Designer', 'lisa.t@acme.com', 'Remote'],
            ['James Brown', 'Sales', 'VP Sales', 'james.b@acme.com', 'Chicago'],
            ['Amanda Miller', 'Sales', 'Account Executive', 'amanda.m@acme.com', 'Boston'],
            ['Chris Johnson', 'Marketing', 'Marketing Director', 'chris.j@acme.com', 'San Francisco'],
            ['Rachel Green', 'Marketing', 'Content Manager', 'rachel.g@acme.com', 'Remote'],
            ['Tom Wilson', 'Operations', 'HR Manager', 'tom.w@acme.com', 'San Francisco'],
            ['Jennifer Lee', 'Operations', 'Finance Manager', 'jennifer.l@acme.com', 'San Francisco'],
            ['Kevin Martinez', 'Engineering', 'AI Engineer', 'kevin.m@acme.com', 'Remote'],
            ['Ashley Davis', 'Sales', 'Customer Success', 'ashley.d@acme.com', 'Denver'],
          ]
        )
    )
  );

  createdDocuments.push(
    await createDocumentWithFile(
      {
        organizationId: acmeOrg.id,
        folderId: reportsFolder.id,
        name: 'Monthly Expenses Report.csv',
        originalName: 'Monthly_Expenses_Dec_2024.csv',
        mimeType: 'text/csv',
        metadata: { rows: 18, columns: 4, type: 'financial', month: 'December', year: 2024 },
        extractedText: `Monthly expenses breakdown December 2024 financial report
        Cloud infrastructure AWS costs computing storage networking
        Software subscriptions tools and platforms
        Payroll and benefits employee compensation
        Marketing and advertising digital campaigns events
        Office and facilities rent utilities supplies
        Travel and entertainment client meetings conferences
        Professional services legal accounting consulting`,
        createdById: janeUser.id,
      },
      () =>
        generateCSV(
          ['Category', 'Description', 'Amount', 'Status'],
          [
            ['Cloud Infrastructure', 'AWS Computing', '$45,000', 'Paid'],
            ['Cloud Infrastructure', 'AWS Storage', '$12,000', 'Paid'],
            ['Cloud Infrastructure', 'AWS Networking', '$3,500', 'Paid'],
            ['Software', 'GitHub Enterprise', '$2,400', 'Paid'],
            ['Software', 'Slack Business+', '$1,800', 'Paid'],
            ['Software', 'Jira/Confluence', '$1,200', 'Paid'],
            ['Software', 'Figma Enterprise', '$960', 'Paid'],
            ['Marketing', 'LinkedIn Ads', '$15,000', 'Paid'],
            ['Marketing', 'Google Ads', '$10,000', 'Paid'],
            ['Marketing', 'Content Production', '$5,000', 'Paid'],
            ['Office', 'SF Office Rent', '$25,000', 'Paid'],
            ['Office', 'Utilities', '$1,500', 'Paid'],
            ['Office', 'Office Supplies', '$800', 'Paid'],
            ['Travel', 'Client Meetings', '$4,500', 'Pending'],
            ['Travel', 'Conference Attendance', '$3,200', 'Paid'],
            ['Professional', 'Legal Fees', '$8,000', 'Paid'],
          ]
        )
    )
  );

  // --- ADDITIONAL IMAGES WITH METADATA ---
  createdDocuments.push(
    await createDocumentWithFile(
      {
        organizationId: acmeOrg.id,
        folderId: websiteRedesignFolder.id,
        name: 'Product Screenshot Dashboard.bmp',
        originalName: 'product_screenshot_dashboard.bmp',
        mimeType: 'image/bmp',
        metadata: { width: 400, height: 300, format: 'BMP', type: 'screenshot' },
        extractedText: `Product dashboard screenshot showing document management interface
        Main navigation sidebar with folders documents settings and search
        Document grid view with thumbnails file names dates and tags
        Quick actions panel for upload download share and delete
        Search bar with filters for type date and content
        User activity feed showing recent document activity`,
        createdById: janeUser.id,
      },
      () => generatePlaceholderImage(400, 300, '#1E40AF')
    )
  );

  createdDocuments.push(
    await createDocumentWithFile(
      {
        organizationId: acmeOrg.id,
        folderId: websiteRedesignFolder.id,
        name: 'Architecture Diagram.bmp',
        originalName: 'architecture_diagram_v2.bmp',
        mimeType: 'image/bmp',
        metadata: { width: 600, height: 400, format: 'BMP', type: 'diagram' },
        extractedText: `System architecture diagram showing microservices layout
        Frontend client connecting to API gateway
        API gateway routing to document service processing service search service
        Database layer PostgreSQL for metadata Redis for caching
        Storage layer AWS S3 for documents
        Processing pipeline OCR service AI classification service
        External integrations OAuth providers webhook endpoints`,
        createdById: johnUser.id,
      },
      () => generatePlaceholderImage(600, 400, '#047857')
    )
  );

  createdDocuments.push(
    await createDocumentWithFile(
      {
        organizationId: acmeOrg.id,
        folderId: documentsFolder.id,
        name: 'Office Floor Plan.bmp',
        originalName: 'office_floor_plan_sf.bmp',
        mimeType: 'image/bmp',
        metadata: { width: 500, height: 400, format: 'BMP', type: 'floorplan' },
        extractedText: `San Francisco office floor plan layout
        Open workspace area with hot desks and assigned seating
        Conference rooms Alpha Beta Gamma Delta for meetings
        Kitchen and break room with coffee machines and snacks
        Phone booths for private calls and video conferences
        Executive offices for leadership team
        Reception area and visitor waiting lounge
        Server room and IT equipment storage`,
        createdById: adminUser.id,
      },
      () => generatePlaceholderImage(500, 400, '#7C3AED')
    )
  );

  // --- TEXT/MARKDOWN DOCUMENTS ---
  createdDocuments.push(
    await createDocumentWithFile(
      {
        organizationId: acmeOrg.id,
        folderId: projectsFolder.id,
        name: 'Meeting Notes - Product Roadmap.txt',
        originalName: 'Meeting_Notes_Product_Roadmap_2025.txt',
        mimeType: 'text/plain',
        metadata: { encoding: 'UTF-8', lines: 45, meetingType: 'planning' },
        extractedText: `Product roadmap planning meeting notes January 2025
        Attendees: Product team engineering leadership sales representatives
        Q1 priorities: AI classification improvements mobile app beta
        Q2 focus: API v3 launch enterprise integrations
        Q3 initiatives: Analytics dashboard advanced reporting
        Q4 goals: International expansion platform scaling
        Key decisions: Prioritize mobile over desktop app
        Action items: Engineering estimates by end of week
        Risks discussed: Resource constraints third party dependencies
        Next meeting: February 1st 2025`,
        createdById: johnUser.id,
      },
      () =>
        generateTextFile(`MEETING NOTES: Product Roadmap Planning 2025
Date: January 8, 2025
Location: Conference Room Alpha

ATTENDEES:
- Sarah Chen (VP Engineering)
- David Kim (Product Manager)
- James Brown (VP Sales)
- Chris Johnson (Marketing Director)

AGENDA:
1. Review 2024 achievements
2. Discuss 2025 priorities
3. Resource allocation
4. Timeline planning

Q1 PRIORITIES:
- Complete AI Classification v2
- Launch mobile app beta
- Achieve SOC 2 certification

Q2 FOCUS:
- API v3 migration
- Enterprise integrations (Salesforce, SAP)

Q3 INITIATIVES:
- Analytics dashboard
- Advanced reporting features

Q4 GOALS:
- EU data center launch
- Platform scaling improvements

KEY DECISIONS:
- Prioritize mobile over desktop app
- Delay marketplace to Q4
- Increase AI team headcount by 3

ACTION ITEMS:
- [ ] Engineering estimates by Jan 15
- [ ] Marketing launch plan by Jan 22
- [ ] Sales targets finalized by Jan 29

NEXT MEETING: February 1, 2025`)
    )
  );

  createdDocuments.push(
    await createDocumentWithFile(
      {
        organizationId: acmeOrg.id,
        folderId: projectsFolder.id,
        name: 'Technical Specification - AI OCR.txt',
        originalName: 'Tech_Spec_AI_OCR_v2.txt',
        mimeType: 'text/plain',
        metadata: { encoding: 'UTF-8', lines: 80, docType: 'specification' },
        extractedText: `Technical specification document AI powered OCR system version 2
        Overview: Enhanced optical character recognition with deep learning
        Input formats supported: PDF TIFF PNG JPEG BMP
        Output formats: Structured JSON plain text searchable PDF
        Language support: English Spanish French German Japanese Chinese
        Accuracy targets: 99% for printed text 95% for handwritten
        Processing speed: Less than 5 seconds per page average
        Table extraction: Automatic detection and structured output
        Form recognition: Key value pair extraction from forms
        Confidence scoring: Per character and per word confidence
        Integration: REST API webhook notifications batch processing
        Scalability: Horizontal scaling with Kubernetes auto-scaling`,
        createdById: johnUser.id,
      },
      () =>
        generateTextFile(`TECHNICAL SPECIFICATION
AI-Powered OCR System v2.0

1. OVERVIEW
Enhanced OCR system using deep learning for superior accuracy.

2. INPUT FORMATS
- PDF (scanned and digital)
- TIFF, PNG, JPEG, BMP images
- Multi-page documents

3. OUTPUT FORMATS
- Structured JSON with coordinates
- Plain text extraction
- Searchable PDF generation

4. LANGUAGE SUPPORT
Primary: English, Spanish, French, German
Extended: Japanese, Chinese, Korean, Arabic

5. PERFORMANCE TARGETS
- Printed text accuracy: 99%+
- Handwritten accuracy: 95%+
- Processing speed: <5s per page

6. FEATURES
- Automatic table detection
- Form field extraction
- Key-value pair recognition
- Confidence scoring
- Layout preservation

7. INTEGRATION
- REST API endpoints
- Webhook notifications
- Batch processing queue
- SDK support (JS, Python, Java)

8. SCALABILITY
- Kubernetes deployment
- Horizontal auto-scaling
- Queue-based processing
- Regional distribution`)
    )
  );

  // --- JSON DATA FILES ---
  createdDocuments.push(
    await createDocumentWithFile(
      {
        organizationId: acmeOrg.id,
        folderId: projectsFolder.id,
        name: 'API Configuration.json',
        originalName: 'api_config_production.json',
        mimeType: 'application/json',
        metadata: { environment: 'production', version: '3.0' },
        extractedText: `API configuration file production environment settings
        Database connection pool size timeout settings
        Redis cache configuration session storage
        AWS S3 bucket configuration for document storage
        Rate limiting settings requests per minute
        Authentication JWT token expiration refresh token settings
        Logging configuration log levels destinations
        Feature flags enabled features A/B testing`,
        createdById: johnUser.id,
      },
      () =>
        generateTextFile(
          JSON.stringify(
            {
              version: '3.0',
              environment: 'production',
              database: {
                host: 'db.acme-dms.com',
                port: 5432,
                poolSize: 20,
                timeout: 30000,
              },
              redis: {
                host: 'redis.acme-dms.com',
                port: 6379,
                ttl: 3600,
              },
              storage: {
                provider: 'aws-s3',
                bucket: 'acme-dms-production',
                region: 'us-east-1',
              },
              rateLimiting: {
                free: 100,
                pro: 1000,
                enterprise: 5000,
              },
              auth: {
                jwtExpiration: '15m',
                refreshExpiration: '7d',
              },
            },
            null,
            2
          )
        )
    )
  );

  // --- VIDEO METADATA (represented as PDF with video info) ---
  createdDocuments.push(
    await createDocumentWithFile(
      {
        organizationId: acmeOrg.id,
        folderId: documentsFolder.id,
        name: 'Product Demo Video Transcript.pdf',
        originalName: 'Product_Demo_Transcript.pdf',
        mimeType: 'application/pdf',
        metadata: { pages: 4, videoLength: '12:34', type: 'video_transcript' },
        extractedText: `Product demonstration video transcript
        Welcome to Acme Document Management System demo
        Chapter 1: Getting started with document uploads
        Drag and drop interface for easy file uploads
        Support for PDF Word Excel PowerPoint and images
        Chapter 2: AI powered document processing
        Automatic OCR for scanned documents
        Smart classification and tagging
        Chapter 3: Semantic search capabilities
        Natural language search queries
        Find documents by content not just filename
        Chapter 4: Collaboration features
        Share documents with team members
        Real time presence and comments
        Chapter 5: Security and compliance
        End to end encryption
        SOC 2 Type II certified infrastructure`,
        createdById: janeUser.id,
      },
      () =>
        generatePDF(
          'Product Demo Video Transcript',
          `PRODUCT DEMONSTRATION
Video Transcript | Duration: 12:34

CHAPTER 1: Getting Started (0:00 - 2:30)
Welcome to Acme Document Management System.
Today we'll walk through the key features.

Upload documents via drag-and-drop or file picker.
Supports PDF, Word, Excel, PowerPoint, images.

CHAPTER 2: AI Processing (2:30 - 5:00)
Automatic OCR for scanned documents.
Smart classification and auto-tagging.
Extract text, tables, and form data.

CHAPTER 3: Search (5:00 - 7:30)
Natural language search queries.
Find documents by content, not just filename.
Semantic understanding of search intent.

CHAPTER 4: Collaboration (7:30 - 10:00)
Share with team members.
Granular permissions (view, edit, admin).
Real-time presence indicators.

CHAPTER 5: Security (10:00 - 12:34)
End-to-end encryption.
SOC 2 Type II certified.
GDPR and CCPA compliant.`,
          4
        )
    )
  );

  createdDocuments.push(
    await createDocumentWithFile(
      {
        organizationId: acmeOrg.id,
        folderId: documentsFolder.id,
        name: 'Training Video - New Employee Onboarding.pdf',
        originalName: 'Training_Onboarding_Transcript.pdf',
        mimeType: 'application/pdf',
        metadata: { pages: 6, videoLength: '25:00', type: 'training_transcript' },
        extractedText: `New employee onboarding training video transcript
        Introduction to company culture and values
        Overview of products and services
        Introduction to teams and departments
        IT setup and security training
        Benefits enrollment walkthrough
        Communication tools Slack Zoom email
        Performance review process
        Career development opportunities
        Company policies and handbook
        Questions and resources`,
        createdById: adminUser.id,
      },
      () =>
        generatePDF(
          'Training Video - New Employee Onboarding',
          `NEW EMPLOYEE ONBOARDING
Training Video Transcript | Duration: 25:00

WELCOME (0:00 - 3:00)
Welcome to Acme Corporation!
Meet our CEO and leadership team.

COMPANY OVERVIEW (3:00 - 8:00)
- Our mission and values
- Product and service offerings
- Market position and growth

MEET YOUR TEAM (8:00 - 12:00)
- Department introductions
- Team structure and reporting
- Key contacts and resources

IT SETUP (12:00 - 16:00)
- Equipment and software
- Security best practices
- VPN and remote access

BENEFITS (16:00 - 20:00)
- Health insurance enrollment
- 401(k) setup
- PTO and leave policies

TOOLS & COMMUNICATION (20:00 - 25:00)
- Slack channels and etiquette
- Zoom meeting best practices
- Email guidelines`,
          6
        )
    )
  );

  // --- PRESENTATION-STYLE DOCUMENTS ---
  createdDocuments.push(
    await createDocumentWithFile(
      {
        organizationId: acmeOrg.id,
        folderId: websiteRedesignFolder.id,
        name: 'Investor Pitch Deck.pdf',
        originalName: 'Investor_Pitch_Deck_2025.pdf',
        mimeType: 'application/pdf',
        metadata: { pages: 15, type: 'presentation', confidential: true },
        extractedText: `Investor pitch deck presentation 2025 funding round
        Problem: Enterprises struggle with document chaos and inefficient search
        Solution: AI powered document management with semantic search
        Market size: 25 billion dollar total addressable market
        Traction: 500 customers 15 million ARR 120 percent growth
        Team: Experienced founders from Google Box and Dropbox
        Technology: Proprietary AI models for OCR and classification
        Business model: SaaS subscription with tiered pricing
        Competition: DocuSign Box Dropbox but lack AI capabilities
        Financials: Path to profitability by 2026
        Ask: 20 million Series B for expansion and R&D
        Use of funds: 50 percent engineering 30 percent sales 20 percent operations`,
        createdById: adminUser.id,
      },
      () =>
        generatePDF(
          'Investor Pitch Deck 2025',
          `ACME CORPORATION
Series B Pitch Deck

THE PROBLEM
Enterprises lose 20% productivity to document chaos.

OUR SOLUTION
AI-powered document management with semantic search.

MARKET SIZE
TAM: $25B | SAM: $8B | SOM: $2B

TRACTION
- 500+ customers
- $15M ARR
- 120% YoY growth

TEAM
Founders from Google, Box, Dropbox
80+ employees

TECHNOLOGY
Proprietary AI for OCR and classification.
98% accuracy, 10x faster than competitors.

BUSINESS MODEL
SaaS subscription: $20-500/user/month

THE ASK
$20M Series B

USE OF FUNDS
- 50% Engineering
- 30% Sales
- 20% Operations`,
          15
        )
    )
  );

  console.log(`  Created ${createdDocuments.length} documents${s3Connected ? ' with files uploaded to MinIO' : ''}\n`);

  // For compatibility with rest of seed, create documents array
  const documents = createdDocuments.filter(Boolean);

  // Additional documents without file upload (processing/error states - for testing)
  const additionalDocumentData: Prisma.DocumentCreateManyInput[] = [
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
  ];

  await prisma.document.createMany({
    data: additionalDocumentData,
    skipDuplicates: true,
  });

  // Reload all documents for reference in later sections
  const allDocuments = await prisma.document.findMany({
    where: { organizationId: { in: [acmeOrg.id, startupOrg.id] } },
  });

  console.log(`  Total documents in database: ${allDocuments.length}\n`);

  // ---------------------------------------------------------------------------
  // 6. CREATE DOCUMENT VERSIONS
  // ---------------------------------------------------------------------------
  console.log('Creating document versions...');

  const companyHandbook = allDocuments.find((d) => d.name === 'Company Handbook.pdf');
  const brandGuidelines = allDocuments.find((d) => d.name === 'Brand Guidelines.pdf');

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

  const scannedContract = allDocuments.find((d) => d.name === 'Scanned Contract.pdf');
  const corruptedFile = allDocuments.find((d) => d.name === 'Corrupted File.pdf');

  const processingJobs: Prisma.ProcessingJobCreateManyInput[] = [];

  // Add OCR jobs for documents
  for (const doc of allDocuments.filter((d) => d.mimeType === 'application/pdf' && d.status === 'READY')) {
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
  console.log(`  - ${allDocuments.length} documents (with files in MinIO)`);
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
