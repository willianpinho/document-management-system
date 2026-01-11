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
