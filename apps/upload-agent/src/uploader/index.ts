/**
 * Upload Agent - File Uploader
 *
 * Handles file uploads to the DMS backend with progress tracking,
 * retry logic, and queue management.
 */

import { ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { loadCredentials, createAuthHeaders } from '../auth';

export interface UploadJob {
  id: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  folderId?: string;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  uploadedBytes: number;
  error?: string;
  retryCount: number;
  createdAt: string;
  completedAt?: string;
  documentId?: string;
}

interface UploadQueueStore {
  jobs: UploadJob[];
  maxConcurrent: number;
  maxRetries: number;
}

const uploadQueue: UploadJob[] = [];
let isProcessing = false;
let isPaused = false;
let mainWindow: BrowserWindow | null = null;

const MAX_CONCURRENT = 3;
const MAX_RETRIES = 3;
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks for multipart upload

/**
 * Set the main window for progress updates
 */
export function setMainWindow(window: BrowserWindow): void {
  mainWindow = window;
}

/**
 * Calculate file checksum
 */
async function calculateChecksum(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Get MIME type from file extension
 */
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.zip': 'application/zip',
    '.rar': 'application/vnd.rar',
    '.7z': 'application/x-7z-compressed',
  };

  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Add file to upload queue
 */
export function addToQueue(filePath: string, folderId?: string): UploadJob {
  const stats = fs.statSync(filePath);
  const id = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const job: UploadJob = {
    id,
    filePath,
    fileName: path.basename(filePath),
    fileSize: stats.size,
    mimeType: getMimeType(filePath),
    folderId,
    status: 'pending',
    progress: 0,
    uploadedBytes: 0,
    retryCount: 0,
    createdAt: new Date().toISOString(),
  };

  uploadQueue.push(job);
  notifyQueueUpdate();
  processQueue();

  return job;
}

/**
 * Remove job from queue
 */
export function removeFromQueue(jobId: string): boolean {
  const index = uploadQueue.findIndex((j) => j.id === jobId);
  if (index === -1) return false;

  const job = uploadQueue[index];
  if (job && job.status === 'uploading') {
    job.status = 'cancelled';
  }

  uploadQueue.splice(index, 1);
  notifyQueueUpdate();
  return true;
}

/**
 * Retry failed job
 */
export function retryJob(jobId: string): boolean {
  const job = uploadQueue.find((j) => j.id === jobId);
  if (!job || job.status !== 'failed') return false;

  job.status = 'pending';
  job.error = undefined;
  job.progress = 0;
  job.uploadedBytes = 0;
  notifyQueueUpdate();
  processQueue();

  return true;
}

/**
 * Notify renderer of queue updates
 */
function notifyQueueUpdate(): void {
  mainWindow?.webContents.send('upload:queue-update', uploadQueue);
}

/**
 * Update job progress
 */
function updateJobProgress(job: UploadJob, progress: number, uploadedBytes: number): void {
  job.progress = progress;
  job.uploadedBytes = uploadedBytes;
  mainWindow?.webContents.send('upload:progress', {
    jobId: job.id,
    progress,
    uploadedBytes,
  });
}

/**
 * Upload file with progress tracking
 */
async function uploadWithProgress(
  job: UploadJob,
  uploadUrl: string,
  uploadFields: Record<string, string>
): Promise<void> {
  return new Promise((resolve, reject) => {
    const fileStream = fs.createReadStream(job.filePath);
    let uploadedBytes = 0;

    // Build multipart form data manually for streaming
    const boundary = `----FormBoundary${Date.now().toString(16)}`;
    const chunks: Buffer[] = [];

    // Add form fields
    for (const [key, value] of Object.entries(uploadFields)) {
      chunks.push(Buffer.from(`--${boundary}\r\n`));
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${key}"\r\n\r\n`));
      chunks.push(Buffer.from(`${value}\r\n`));
    }

    // Add file header
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    chunks.push(
      Buffer.from(
        `Content-Disposition: form-data; name="file"; filename="${job.fileName}"\r\n`
      )
    );
    chunks.push(Buffer.from(`Content-Type: ${job.mimeType}\r\n\r\n`));

    const header = Buffer.concat(chunks);
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);

    // Read file and upload with progress tracking
    const fileChunks: Buffer[] = [header];

    fileStream.on('data', (chunk: Buffer) => {
      fileChunks.push(chunk);
      uploadedBytes += chunk.length;
      const progress = Math.round((uploadedBytes / job.fileSize) * 90); // Reserve 10% for upload
      updateJobProgress(job, progress, uploadedBytes);
    });

    fileStream.on('end', async () => {
      fileChunks.push(footer);
      const body = Buffer.concat(fileChunks);

      try {
        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': body.length.toString(),
          },
          body: body,
        });

        if (!response.ok) {
          reject(new Error(`S3 upload failed: ${response.statusText}`));
        } else {
          updateJobProgress(job, 100, job.fileSize);
          resolve();
        }
      } catch (error) {
        reject(error);
      }
    });

    fileStream.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Upload a single file
 */
async function uploadFile(job: UploadJob): Promise<void> {
  const credentials = loadCredentials();
  if (!credentials) {
    throw new Error('No credentials available');
  }

  job.status = 'uploading';
  notifyQueueUpdate();

  try {
    // Step 1: Calculate checksum
    const checksum = await calculateChecksum(job.filePath);

    // Step 2: Create document and get presigned URL
    const createBody = JSON.stringify({
      name: job.fileName,
      mimeType: job.mimeType,
      sizeBytes: job.fileSize,
      checksum,
      folderId: job.folderId,
    });

    const createHeaders = createAuthHeaders('POST', '/api/documents', createBody);
    const createResponse = await fetch(`${credentials.serverUrl}/api/documents`, {
      method: 'POST',
      headers: {
        ...createHeaders,
        'Content-Type': 'application/json',
      },
      body: createBody,
    });

    if (!createResponse.ok) {
      const error = await createResponse.text();
      throw new Error(`Failed to create document: ${error}`);
    }

    const { document, uploadUrl, uploadFields } = await createResponse.json();
    job.documentId = document.id;

    // Step 3: Upload file to S3 using presigned URL with progress tracking
    await uploadWithProgress(job, uploadUrl, uploadFields || {});

    // Step 4: Confirm upload
    const confirmHeaders = createAuthHeaders('POST', `/api/documents/${document.id}/confirm`);
    const confirmResponse = await fetch(
      `${credentials.serverUrl}/api/documents/${document.id}/confirm`,
      {
        method: 'POST',
        headers: {
          ...confirmHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!confirmResponse.ok) {
      throw new Error('Failed to confirm upload');
    }

    job.status = 'completed';
    job.completedAt = new Date().toISOString();
  } catch (error) {
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : 'Unknown error';

    if (job.retryCount < MAX_RETRIES) {
      job.retryCount++;
      job.status = 'pending';
      setTimeout(() => processQueue(), 5000 * job.retryCount); // Exponential backoff
    }
  }

  notifyQueueUpdate();
}

/**
 * Process upload queue
 */
export async function processQueue(): Promise<void> {
  if (isProcessing || isPaused) return;
  isProcessing = true;

  while (!isPaused) {
    const activeJobs = uploadQueue.filter((j) => j.status === 'uploading');
    if (activeJobs.length >= MAX_CONCURRENT) {
      break;
    }

    const nextJob = uploadQueue.find((j) => j.status === 'pending');
    if (!nextJob) {
      break;
    }

    // Don't await - let it run concurrently
    uploadFile(nextJob);
  }

  isProcessing = false;
}

/**
 * Pause/resume uploads
 */
export function togglePause(paused: boolean): void {
  isPaused = paused;
  if (!paused) {
    processQueue();
  }
}

/**
 * Get current queue
 */
export function getQueue(): UploadJob[] {
  return [...uploadQueue];
}

/**
 * Clear completed jobs
 */
export function clearCompleted(): void {
  const pendingJobs = uploadQueue.filter(
    (j) => j.status !== 'completed' && j.status !== 'cancelled'
  );
  uploadQueue.length = 0;
  uploadQueue.push(...pendingJobs);
  notifyQueueUpdate();
}

/**
 * Setup IPC handlers for uploader
 */
export function setupUploaderIPC(): void {
  ipcMain.handle('upload:add', (_, filePath: string, folderId?: string) => {
    return addToQueue(filePath, folderId);
  });

  ipcMain.handle('upload:add-multiple', (_, filePaths: string[], folderId?: string) => {
    return filePaths.map((fp) => addToQueue(fp, folderId));
  });

  ipcMain.handle('upload:remove', (_, jobId: string) => {
    return removeFromQueue(jobId);
  });

  ipcMain.handle('upload:retry', (_, jobId: string) => {
    return retryJob(jobId);
  });

  ipcMain.handle('upload:get-queue', () => {
    return getQueue();
  });

  ipcMain.handle('upload:clear-completed', () => {
    clearCompleted();
    return true;
  });

  ipcMain.on('upload:toggle-pause', (_, paused: boolean) => {
    togglePause(paused);
  });
}

/**
 * Alias for addToQueue - used by watcher integration
 */
export const addUploadJob = addToQueue;
