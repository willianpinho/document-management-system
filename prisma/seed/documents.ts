/**
 * Uploads every catalog entry's real file to S3/MinIO and creates its
 * Document row, then corrects the organization's storageUsedBytes to the
 * actual sum of what was uploaded (never a hardcoded number).
 */

import { PrismaClient, DocumentStatus, ProcessingStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { checkS3Connection, uploadToS3 } from './s3-client.js';
import { documentCatalog, type FolderKey, type UserKey } from './document-catalog.js';

function s3KeyFor(orgId: string, folderId: string, fileName: string): string {
  return `organizations/${orgId}/${folderId}/${crypto.randomUUID()}/${fileName}`;
}

export interface CreatedDocument {
  id: string;
  name: string;
  s3Key: string;
  sizeBytes: bigint;
  checksum: string;
}

export interface SeededDocuments {
  createdDocuments: CreatedDocument[];
  totalBytes: bigint;
  s3Connected: boolean;
}

export async function seedDocuments(
  prisma: PrismaClient,
  orgId: string,
  users: Record<UserKey, { id: string }>,
  folders: Record<FolderKey, { id: string }>,
): Promise<SeededDocuments> {
  console.log('Creating documents with real files...');
  const s3Connected = await checkS3Connection();

  let totalBytes = 0n;
  const createdDocuments: CreatedDocument[] = [];

  for (const spec of documentCatalog) {
    const folder = folders[spec.folderKey];
    const createdBy = users[spec.createdByKey];
    const buffer = await spec.content();
    const s3Key = s3KeyFor(orgId, folder.id, spec.name);
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    if (s3Connected) {
      await uploadToS3(s3Key, buffer, spec.mimeType);
    }

    const document = await prisma.document.create({
      data: {
        organizationId: orgId,
        folderId: folder.id,
        name: spec.name,
        originalName: spec.originalName,
        mimeType: spec.mimeType,
        sizeBytes: BigInt(buffer.length),
        s3Key,
        checksum,
        status: DocumentStatus.READY,
        processingStatus: ProcessingStatus.COMPLETE,
        metadata: spec.metadata,
        extractedText: spec.extractedText,
        createdById: createdBy.id,
      },
    });

    totalBytes += BigInt(buffer.length);
    createdDocuments.push({
      id: document.id,
      name: document.name,
      s3Key,
      sizeBytes: document.sizeBytes,
      checksum,
    });
  }
  console.log(
    `  Created ${createdDocuments.length} documents${s3Connected ? ' with files uploaded to MinIO' : ' (S3 not connected - DB rows only)'}\n`,
  );

  await prisma.organization.update({
    where: { id: orgId },
    data: { storageUsedBytes: totalBytes },
  });
  console.log(
    `Updated organization storageUsedBytes to ${totalBytes} bytes (sum of uploaded files)\n`,
  );

  return { createdDocuments, totalBytes, s3Connected };
}
