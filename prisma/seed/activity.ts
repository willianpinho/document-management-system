/**
 * Seeds demo activity that references the real documents created in
 * documents.ts: an earlier draft version (also a real uploaded file),
 * OCR processing jobs, one API key, and a short audit trail.
 */

import { PrismaClient, ProcessingJobType } from '@prisma/client';
import * as crypto from 'crypto';
import { uploadToS3 } from './s3-client.js';
import { generatePDF } from './file-generators.js';
import type { CreatedDocument } from './documents.js';
import type { UserKey } from './document-spec.js';
import type { FolderKey } from './document-spec.js';

export async function seedActivity(
  prisma: PrismaClient,
  orgId: string,
  users: Record<UserKey, { id: string }>,
  folders: Record<FolderKey, { id: string }>,
  createdDocuments: CreatedDocument[],
  s3Connected: boolean,
): Promise<void> {
  console.log('Creating document version history...');
  const handbook = createdDocuments.find((d) => d.name === 'Company Handbook.pdf');
  if (handbook) {
    const draftBuffer = await generatePDF(
      'Company Handbook (Draft)',
      'Welcome to Northwind Docs!\n\nDraft outline - policies section pending review.',
      1,
    );
    const draftKey = `${handbook.s3Key}.v1`;
    if (s3Connected) {
      await uploadToS3(draftKey, draftBuffer, 'application/pdf');
    }
    await prisma.documentVersion.createMany({
      data: [
        {
          documentId: handbook.id,
          versionNumber: 1,
          s3Key: draftKey,
          sizeBytes: BigInt(draftBuffer.length),
          checksum: crypto.createHash('sha256').update(draftBuffer).digest('hex'),
          changeNote: 'Initial draft',
          createdById: users.admin.id,
        },
        {
          documentId: handbook.id,
          versionNumber: 2,
          s3Key: handbook.s3Key,
          sizeBytes: handbook.sizeBytes,
          checksum: handbook.checksum,
          changeNote: 'Published version',
          createdById: users.admin.id,
        },
      ],
    });
    console.log('  Created 2 versions for Company Handbook.pdf\n');
  }

  console.log('Creating processing jobs...');
  const pdfDocuments = await prisma.document.findMany({
    where: { organizationId: orgId, mimeType: 'application/pdf' },
  });
  await prisma.processingJob.createMany({
    data: pdfDocuments.map((doc) => ({
      documentId: doc.id,
      jobType: ProcessingJobType.OCR,
      status: 'COMPLETED' as const,
      inputParams: { language: 'en' },
      outputData: { textLength: doc.extractedText?.length ?? 0, confidence: 0.97 },
      startedAt: new Date(Date.now() - 3600000),
      completedAt: new Date(Date.now() - 3595000),
    })),
  });
  console.log(`  Created ${pdfDocuments.length} OCR jobs\n`);

  console.log('Creating API key...');
  await prisma.apiKey.create({
    data: {
      organizationId: orgId,
      name: 'Upload Agent - Office',
      keyPrefix: 'dms_live',
      keyHash: crypto.createHash('sha256').update('demo-upload-agent-key').digest('hex'),
      scopes: ['documents:read', 'documents:write', 'folders:read'],
      lastUsedAt: new Date(Date.now() - 86400000),
    },
  });
  console.log('  Created 1 API key\n');

  console.log('Creating audit logs...');
  await prisma.auditLog.createMany({
    data: [
      {
        organizationId: orgId,
        userId: users.admin.id,
        action: 'USER_LOGIN',
        resourceType: 'USER',
        resourceId: users.admin.id,
        metadata: { provider: 'email' },
      },
      {
        organizationId: orgId,
        userId: users.admin.id,
        action: 'FOLDER_CREATED',
        resourceType: 'FOLDER',
        resourceId: folders.documents.id,
        metadata: { name: 'Documents', path: '/Documents' },
      },
      {
        organizationId: orgId,
        userId: users.admin.id,
        action: 'DOCUMENT_CREATED',
        resourceType: 'DOCUMENT',
        resourceId: handbook?.id,
        metadata: { fileName: 'Company Handbook.pdf' },
      },
      {
        organizationId: orgId,
        userId: users.maria.id,
        action: 'DOCUMENT_VIEWED',
        resourceType: 'DOCUMENT',
        resourceId: handbook?.id,
        metadata: { viewDuration: 90 },
      },
      {
        organizationId: orgId,
        userId: users.admin.id,
        action: 'MEMBER_INVITED',
        resourceType: 'ORGANIZATION',
        resourceId: orgId,
        metadata: { invitedEmail: 'alex.chen@northwinddocs.com', role: 'VIEWER' },
      },
    ],
  });
  console.log('  Created 5 audit log entries\n');
}
