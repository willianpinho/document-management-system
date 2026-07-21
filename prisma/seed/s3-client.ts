/**
 * S3/MinIO client + helpers used by the seed script.
 */

import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';

export const S3_ENDPOINT = process.env.S3_ENDPOINT || 'http://localhost:9000';
export const S3_BUCKET = process.env.S3_BUCKET || 'dms-documents-dev';
const S3_REGION = process.env.S3_REGION || 'us-east-1';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || 'minioadmin';
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || 'minioadmin';

export const s3Client = new S3Client({
  region: S3_REGION,
  endpoint: S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

export async function checkS3Connection(): Promise<boolean> {
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

export async function uploadToS3(key: string, buffer: Buffer, contentType: string): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );
}

/**
 * Deletes every object under a given key prefix. Used to remove a
 * previous demo organization's uploaded files before re-seeding, so
 * stale objects don't linger in the bucket once their DB rows are gone.
 */
export async function deleteS3Prefix(prefix: string): Promise<number> {
  let deleted = 0;
  let continuationToken: string | undefined;

  do {
    const listed = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: S3_BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    const objects = (listed.Contents ?? []).flatMap((obj) => (obj.Key ? [{ Key: obj.Key }] : []));
    if (objects.length > 0) {
      await s3Client.send(
        new DeleteObjectsCommand({
          Bucket: S3_BUCKET,
          Delete: { Objects: objects },
        }),
      );
      deleted += objects.length;
    }

    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (continuationToken);

  return deleted;
}
