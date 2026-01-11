import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('S3_BUCKET', 'dms-documents-dev');

    const endpoint = this.configService.get<string>('S3_ENDPOINT');
    const isLocalEndpoint = endpoint?.includes('localhost') || endpoint?.includes('127.0.0.1');

    // Helper to detect malformed env variables (self-referencing like ${VAR_NAME})
    const isValidEnvValue = (value: string | undefined): boolean => {
      if (!value) return false;
      // Reject values that look like unresolved template variables
      return !value.startsWith('${') && !value.endsWith('}');
    };

    // Use MinIO defaults for local development if credentials not provided or malformed
    const rawAccessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const rawSecretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');

    const accessKeyId = isValidEnvValue(rawAccessKeyId)
      ? rawAccessKeyId
      : (isLocalEndpoint ? 'minioadmin' : undefined);
    const secretAccessKey = isValidEnvValue(rawSecretAccessKey)
      ? rawSecretAccessKey
      : (isLocalEndpoint ? 'minioadmin' : undefined);

    this.s3Client = new S3Client({
      region: this.configService.get<string>('S3_REGION', 'us-east-1'),
      ...(endpoint && {
        endpoint,
        forcePathStyle: true,
      }),
      ...(accessKeyId && secretAccessKey && {
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      }),
    });

    // Log credential source for debugging
    const credentialSource = isValidEnvValue(rawAccessKeyId)
      ? 'environment'
      : (isLocalEndpoint ? 'MinIO defaults' : 'none');

    this.logger.log(
      `Storage configured: endpoint=${endpoint || 'AWS S3'}, bucket=${this.bucket}, credentials=${credentialSource}${isLocalEndpoint ? ' (local MinIO)' : ''}`,
    );
  }

  async getPresignedUploadUrl(key: string, contentType: string, expiresIn = 3600) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async getPresignedDownloadUrl(key: string, expiresIn = 3600) {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async uploadBuffer(key: string, buffer: Buffer, contentType: string) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await this.s3Client.send(command);
    this.logger.log(`Uploaded file: ${key}`);
  }

  async deleteObject(key: string) {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.s3Client.send(command);
    this.logger.log(`Deleted file: ${key}`);
  }

  async headObject(key: string) {
    const command = new HeadObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    try {
      return await this.s3Client.send(command);
    } catch {
      return null;
    }
  }

  async getObject(key: string) {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.s3Client.send(command);
    return response.Body;
  }

  async copyObject(sourceKey: string, destinationKey: string) {
    const command = new CopyObjectCommand({
      Bucket: this.bucket,
      CopySource: `${this.bucket}/${sourceKey}`,
      Key: destinationKey,
    });

    await this.s3Client.send(command);
    this.logger.log(`Copied file from ${sourceKey} to ${destinationKey}`);
  }

  // ============================================
  // Multipart Upload Methods
  // ============================================

  /**
   * Initialize a multipart upload
   */
  async createMultipartUpload(key: string, contentType: string): Promise<string> {
    const command = new CreateMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const response = await this.s3Client.send(command);
    this.logger.log(`Created multipart upload: ${response.UploadId} for ${key}`);
    return response.UploadId!;
  }

  /**
   * Get a presigned URL for uploading a specific part
   */
  async getPresignedPartUploadUrl(
    key: string,
    uploadId: string,
    partNumber: number,
    expiresIn = 3600,
  ): Promise<string> {
    const command = new UploadPartCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /**
   * Upload a part directly (for server-side upload)
   */
  async uploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    body: Buffer,
  ): Promise<{ etag: string; partNumber: number }> {
    const command = new UploadPartCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: body,
    });

    const response = await this.s3Client.send(command);
    this.logger.debug(`Uploaded part ${partNumber} for ${key}`);
    return {
      etag: response.ETag!,
      partNumber,
    };
  }

  /**
   * Complete a multipart upload
   */
  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: { etag: string; partNumber: number }[],
  ): Promise<void> {
    const command = new CompleteMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.map((p) => ({
          ETag: p.etag,
          PartNumber: p.partNumber,
        })),
      },
    });

    await this.s3Client.send(command);
    this.logger.log(`Completed multipart upload: ${uploadId} for ${key}`);
  }

  /**
   * Abort a multipart upload
   */
  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    const command = new AbortMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
    });

    await this.s3Client.send(command);
    this.logger.log(`Aborted multipart upload: ${uploadId} for ${key}`);
  }

  /**
   * List uploaded parts for a multipart upload
   */
  async listParts(
    key: string,
    uploadId: string,
  ): Promise<{ partNumber: number; etag: string; size: number }[]> {
    const command = new ListPartsCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
    });

    const response = await this.s3Client.send(command);
    return (response.Parts || []).map((p) => ({
      partNumber: p.PartNumber!,
      etag: p.ETag!,
      size: p.Size!,
    }));
  }
}
