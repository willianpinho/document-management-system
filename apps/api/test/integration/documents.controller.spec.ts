/**
 * Documents Controller Integration Tests
 *
 * Tests the full HTTP request/response cycle for document endpoints
 * using a real NestJS application with mocked external services.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { StorageService } from '../../src/modules/storage/storage.service';
import { JwtService } from '@nestjs/jwt';

describe('DocumentsController (Integration)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;
  let accessToken: string;

  const testUser = {
    id: 'user-integration-test',
    email: 'integration@test.com',
    name: 'Integration Test User',
    organizationId: 'org-integration-test',
    role: 'admin',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StorageService)
      .useValue({
        getPresignedUploadUrl: vi.fn().mockResolvedValue({
          url: 'https://s3.mock.com/upload',
          fields: { key: 'test-key' },
        }),
        getPresignedDownloadUrl: vi.fn().mockResolvedValue('https://s3.mock.com/download'),
        deleteObject: vi.fn().mockResolvedValue(undefined),
        headObject: vi.fn().mockResolvedValue({ ContentLength: 1024 }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    await app.init();

    prismaService = app.get(PrismaService);
    jwtService = app.get(JwtService);

    // Generate test JWT
    accessToken = jwtService.sign(testUser, { expiresIn: '1h' });

    // Seed test data
    await seedTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  async function seedTestData() {
    // Create test organization
    await prismaService.organization.upsert({
      where: { id: testUser.organizationId },
      update: {},
      create: {
        id: testUser.organizationId,
        name: 'Integration Test Org',
        slug: 'integration-test-org',
        plan: 'PRO',
        storageQuotaBytes: BigInt(10 * 1024 * 1024 * 1024), // 10GB
      },
    });

    // Create test user
    await prismaService.user.upsert({
      where: { id: testUser.id },
      update: {},
      create: {
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        provider: 'EMAIL',
        password: 'hashed-password',
      },
    });

    // Create organization membership
    await prismaService.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: testUser.organizationId,
          userId: testUser.id,
        },
      },
      update: {},
      create: {
        organizationId: testUser.organizationId,
        userId: testUser.id,
        role: 'ADMIN',
      },
    });
  }

  async function cleanupTestData() {
    await prismaService.document.deleteMany({
      where: { organizationId: testUser.organizationId },
    });
    await prismaService.folder.deleteMany({
      where: { organizationId: testUser.organizationId },
    });
    await prismaService.organizationMember.deleteMany({
      where: { organizationId: testUser.organizationId },
    });
    await prismaService.user.deleteMany({
      where: { id: testUser.id },
    });
    await prismaService.organization.deleteMany({
      where: { id: testUser.organizationId },
    });
  }

  describe('POST /documents', () => {
    it('should create a document and return presigned URL', async () => {
      const createDto = {
        name: 'test-document.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024000,
        checksum: 'abc123def456',
      };

      const response = await request(app.getHttpServer())
        .post('/documents')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body).toHaveProperty('document');
      expect(response.body).toHaveProperty('uploadUrl');
      expect(response.body.document.name).toBe(createDto.name);
      expect(response.body.document.mimeType).toBe(createDto.mimeType);
      expect(response.body.document.organizationId).toBe(testUser.organizationId);
    });

    it('should reject invalid MIME type', async () => {
      const createDto = {
        name: 'malicious.exe',
        mimeType: 'application/x-msdownload',
        sizeBytes: 1024,
        checksum: 'abc123',
      };

      await request(app.getHttpServer())
        .post('/documents')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createDto)
        .expect(400);
    });

    it('should reject without authentication', async () => {
      const createDto = {
        name: 'test.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        checksum: 'abc123',
      };

      await request(app.getHttpServer())
        .post('/documents')
        .send(createDto)
        .expect(401);
    });
  });

  describe('GET /documents', () => {
    beforeAll(async () => {
      // Create test documents
      await prismaService.document.createMany({
        data: [
          {
            id: 'doc-list-1',
            name: 'document-1.pdf',
            originalName: 'document-1.pdf',
            mimeType: 'application/pdf',
            sizeBytes: BigInt(1024),
            s3Key: 'test/doc-1.pdf',
            status: 'READY',
            processingStatus: 'COMPLETED',
            organizationId: testUser.organizationId,
            createdById: testUser.id,
            checksum: 'hash1',
          },
          {
            id: 'doc-list-2',
            name: 'document-2.pdf',
            originalName: 'document-2.pdf',
            mimeType: 'application/pdf',
            sizeBytes: BigInt(2048),
            s3Key: 'test/doc-2.pdf',
            status: 'READY',
            processingStatus: 'COMPLETED',
            organizationId: testUser.organizationId,
            createdById: testUser.id,
            checksum: 'hash2',
          },
          {
            id: 'doc-list-3',
            name: 'image.png',
            originalName: 'image.png',
            mimeType: 'image/png',
            sizeBytes: BigInt(4096),
            s3Key: 'test/image.png',
            status: 'READY',
            processingStatus: 'COMPLETED',
            organizationId: testUser.organizationId,
            createdById: testUser.id,
            checksum: 'hash3',
          },
        ],
      });
    });

    it('should return paginated documents', async () => {
      const response = await request(app.getHttpServer())
        .get('/documents')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.meta).toHaveProperty('total');
      expect(response.body.meta).toHaveProperty('page');
    });

    it('should filter by MIME type', async () => {
      const response = await request(app.getHttpServer())
        .get('/documents')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ mimeType: 'image/png' })
        .expect(200);

      expect(response.body.data.every((d: any) => d.mimeType === 'image/png')).toBe(true);
    });

    it('should search by name', async () => {
      const response = await request(app.getHttpServer())
        .get('/documents')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ search: 'document' })
        .expect(200);

      expect(response.body.data.every((d: any) => d.name.includes('document'))).toBe(true);
    });
  });

  describe('GET /documents/:id', () => {
    let testDocId: string;

    beforeAll(async () => {
      const doc = await prismaService.document.create({
        data: {
          id: 'doc-detail-test',
          name: 'detail-test.pdf',
          originalName: 'detail-test.pdf',
          mimeType: 'application/pdf',
          sizeBytes: BigInt(1024),
          s3Key: 'test/detail-test.pdf',
          status: 'READY',
          processingStatus: 'COMPLETED',
          organizationId: testUser.organizationId,
          createdById: testUser.id,
          checksum: 'detail-hash',
        },
      });
      testDocId = doc.id;
    });

    it('should return document details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/documents/${testDocId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(testDocId);
      expect(response.body.name).toBe('detail-test.pdf');
    });

    it('should return 404 for non-existent document', async () => {
      await request(app.getHttpServer())
        .get('/documents/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should not return document from different organization', async () => {
      // Create document in different org
      await prismaService.organization.create({
        data: {
          id: 'other-org',
          name: 'Other Org',
          slug: 'other-org',
          plan: 'FREE',
          storageQuotaBytes: BigInt(1024 * 1024 * 1024),
        },
      });

      await prismaService.document.create({
        data: {
          id: 'doc-other-org',
          name: 'other-org-doc.pdf',
          originalName: 'other-org-doc.pdf',
          mimeType: 'application/pdf',
          sizeBytes: BigInt(1024),
          s3Key: 'other-org/doc.pdf',
          status: 'READY',
          processingStatus: 'COMPLETED',
          organizationId: 'other-org',
          createdById: testUser.id,
          checksum: 'other-hash',
        },
      });

      await request(app.getHttpServer())
        .get('/documents/doc-other-org')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      // Cleanup
      await prismaService.document.delete({ where: { id: 'doc-other-org' } });
      await prismaService.organization.delete({ where: { id: 'other-org' } });
    });
  });

  describe('PATCH /documents/:id', () => {
    let testDocId: string;

    beforeAll(async () => {
      const doc = await prismaService.document.create({
        data: {
          id: 'doc-update-test',
          name: 'update-test.pdf',
          originalName: 'update-test.pdf',
          mimeType: 'application/pdf',
          sizeBytes: BigInt(1024),
          s3Key: 'test/update-test.pdf',
          status: 'READY',
          processingStatus: 'COMPLETED',
          organizationId: testUser.organizationId,
          createdById: testUser.id,
          checksum: 'update-hash',
        },
      });
      testDocId = doc.id;
    });

    it('should update document name', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/documents/${testDocId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'renamed-document.pdf' })
        .expect(200);

      expect(response.body.name).toBe('renamed-document.pdf');
    });

    it('should reject empty name', async () => {
      await request(app.getHttpServer())
        .patch(`/documents/${testDocId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: '' })
        .expect(400);
    });
  });

  describe('DELETE /documents/:id', () => {
    let testDocId: string;

    beforeEach(async () => {
      const doc = await prismaService.document.create({
        data: {
          id: `doc-delete-${Date.now()}`,
          name: 'delete-test.pdf',
          originalName: 'delete-test.pdf',
          mimeType: 'application/pdf',
          sizeBytes: BigInt(1024),
          s3Key: 'test/delete-test.pdf',
          status: 'READY',
          processingStatus: 'COMPLETED',
          organizationId: testUser.organizationId,
          createdById: testUser.id,
          checksum: 'delete-hash',
        },
      });
      testDocId = doc.id;
    });

    it('should soft delete document', async () => {
      await request(app.getHttpServer())
        .delete(`/documents/${testDocId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const doc = await prismaService.document.findUnique({
        where: { id: testDocId },
      });
      expect(doc?.deletedAt).not.toBeNull();
    });

    it('should hard delete with permanent=true', async () => {
      await request(app.getHttpServer())
        .delete(`/documents/${testDocId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ permanent: true })
        .expect(200);

      const doc = await prismaService.document.findUnique({
        where: { id: testDocId },
      });
      expect(doc).toBeNull();
    });
  });

  describe('GET /documents/:id/download', () => {
    let testDocId: string;

    beforeAll(async () => {
      const doc = await prismaService.document.create({
        data: {
          id: 'doc-download-test',
          name: 'download-test.pdf',
          originalName: 'download-test.pdf',
          mimeType: 'application/pdf',
          sizeBytes: BigInt(1024),
          s3Key: 'test/download-test.pdf',
          status: 'READY',
          processingStatus: 'COMPLETED',
          organizationId: testUser.organizationId,
          createdById: testUser.id,
          checksum: 'download-hash',
        },
      });
      testDocId = doc.id;
    });

    it('should return presigned download URL', async () => {
      const response = await request(app.getHttpServer())
        .get(`/documents/${testDocId}/download`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('url');
      expect(response.body.url).toContain('https://s3.mock.com/download');
    });
  });
});
