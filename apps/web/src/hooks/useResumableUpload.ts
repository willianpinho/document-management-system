'use client';

import { useState, useCallback, useRef } from 'react';
import {
  uploadsApi,
  type UploadSession,
  type UploadChunkResult,
  type CompleteUploadResult,
} from '@/lib/api';

export type UploadStatus =
  | 'idle'
  | 'preparing'
  | 'uploading'
  | 'completing'
  | 'completed'
  | 'paused'
  | 'cancelled'
  | 'error';

export interface ChunkProgress {
  chunkNumber: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress: number;
}

export interface UploadProgress {
  status: UploadStatus;
  sessionId: string | null;
  fileName: string | null;
  totalBytes: number;
  uploadedBytes: number;
  progress: number;
  currentChunk: number;
  totalChunks: number;
  uploadSpeed: number;
  remainingTime: number | null;
  error: string | null;
  chunks: ChunkProgress[];
}

export interface UseResumableUploadOptions {
  chunkSize?: number;
  maxRetries?: number;
  concurrentChunks?: number;
  onProgress?: (progress: UploadProgress) => void;
  onComplete?: (result: CompleteUploadResult) => void;
  onError?: (error: Error) => void;
}

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_CONCURRENT_CHUNKS = 3;

export function useResumableUpload(options: UseResumableUploadOptions = {}) {
  const {
    chunkSize = DEFAULT_CHUNK_SIZE,
    maxRetries = DEFAULT_MAX_RETRIES,
    concurrentChunks = DEFAULT_CONCURRENT_CHUNKS,
    onProgress,
    onComplete,
    onError,
  } = options;

  const [progress, setProgress] = useState<UploadProgress>({
    status: 'idle',
    sessionId: null,
    fileName: null,
    totalBytes: 0,
    uploadedBytes: 0,
    progress: 0,
    currentChunk: 0,
    totalChunks: 0,
    uploadSpeed: 0,
    remainingTime: null,
    error: null,
    chunks: [],
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const isPausedRef = useRef(false);
  const sessionRef = useRef<UploadSession | null>(null);
  const fileRef = useRef<File | null>(null);
  const speedSamplesRef = useRef<{ bytes: number; time: number }[]>([]);

  const updateProgress = useCallback(
    (updates: Partial<UploadProgress>) => {
      setProgress((prev) => {
        const newProgress = { ...prev, ...updates };
        onProgress?.(newProgress);
        return newProgress;
      });
    },
    [onProgress]
  );

  const calculateSpeed = useCallback((bytesUploaded: number) => {
    const now = Date.now();
    speedSamplesRef.current.push({ bytes: bytesUploaded, time: now });

    // Keep only last 5 seconds of samples
    const cutoff = now - 5000;
    speedSamplesRef.current = speedSamplesRef.current.filter(
      (s) => s.time > cutoff
    );

    if (speedSamplesRef.current.length < 2) return 0;

    const oldest = speedSamplesRef.current[0];
    const newest = speedSamplesRef.current[speedSamplesRef.current.length - 1];
    if (!oldest || !newest) return 0;
    const timeDiff = (newest.time - oldest.time) / 1000;
    const bytesDiff = newest.bytes - oldest.bytes;

    return timeDiff > 0 ? bytesDiff / timeDiff : 0;
  }, []);

  const uploadChunk = useCallback(
    async (
      session: UploadSession,
      file: File,
      chunkNumber: number,
      retryCount = 0
    ): Promise<UploadChunkResult | null> => {
      if (isPausedRef.current) return null;

      try {
        // Get presigned URL for this chunk
        const urlResponse = await uploadsApi.getChunkUploadUrl(
          session.id,
          chunkNumber
        );
        const { uploadUrl } = urlResponse.data!;

        // Calculate chunk boundaries
        const start = chunkNumber * session.chunkSize;
        const end = Math.min(start + session.chunkSize, file.size);
        const chunk = file.slice(start, end);

        // Update chunk status to uploading
        updateProgress({
          chunks: progress.chunks.map((c) =>
            c.chunkNumber === chunkNumber
              ? { ...c, status: 'uploading' as const }
              : c
          ),
        });

        // Upload directly to S3
        const response = await fetch(uploadUrl, {
          method: 'PUT',
          body: chunk,
          headers: {
            'Content-Type': file.type,
          },
          signal: abortControllerRef.current?.signal,
        });

        if (!response.ok) {
          throw new Error(`Upload failed with status ${response.status}`);
        }

        // Get ETag from response
        const etag = response.headers.get('ETag') || '';
        const cleanEtag = etag.replace(/"/g, '');

        // Confirm the chunk upload
        const confirmResponse = await uploadsApi.confirmChunk(
          session.id,
          chunkNumber,
          cleanEtag,
          end - start
        );

        const result = confirmResponse.data!;

        // Update progress
        const uploadedBytes = result.uploadedBytes;
        const speed = calculateSpeed(uploadedBytes);
        const remainingBytes = file.size - uploadedBytes;
        const remainingTime = speed > 0 ? remainingBytes / speed : null;

        updateProgress({
          uploadedBytes,
          progress: (uploadedBytes / file.size) * 100,
          currentChunk: result.uploadedChunks,
          uploadSpeed: speed,
          remainingTime,
          chunks: progress.chunks.map((c) =>
            c.chunkNumber === chunkNumber
              ? { ...c, status: 'completed' as const, progress: 100 }
              : c
          ),
        });

        return result;
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return null;
        }

        if (retryCount < maxRetries) {
          // Exponential backoff
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, retryCount) * 1000)
          );
          return uploadChunk(session, file, chunkNumber, retryCount + 1);
        }

        // Mark chunk as error
        updateProgress({
          chunks: progress.chunks.map((c) =>
            c.chunkNumber === chunkNumber
              ? { ...c, status: 'error' as const }
              : c
          ),
        });

        throw error;
      }
    },
    [chunkSize, maxRetries, calculateSpeed, progress.chunks, updateProgress]
  );

  const startUpload = useCallback(
    async (file: File, folderId?: string, metadata?: Record<string, unknown>) => {
      try {
        abortControllerRef.current = new AbortController();
        isPausedRef.current = false;
        fileRef.current = file;
        speedSamplesRef.current = [];

        updateProgress({
          status: 'preparing',
          fileName: file.name,
          totalBytes: file.size,
          uploadedBytes: 0,
          progress: 0,
          error: null,
        });

        // Create upload session
        const sessionResponse = await uploadsApi.createSession({
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          totalBytes: file.size,
          chunkSize,
          folderId,
          metadata,
        });

        const session = sessionResponse.data!;
        sessionRef.current = session;

        // Initialize chunk progress tracking
        const chunks: ChunkProgress[] = Array.from(
          { length: session.totalChunks },
          (_, i) => ({
            chunkNumber: i,
            status: session.completedChunks.includes(i) ? 'completed' : 'pending',
            progress: session.completedChunks.includes(i) ? 100 : 0,
          })
        );

        updateProgress({
          status: 'uploading',
          sessionId: session.id,
          totalChunks: session.totalChunks,
          uploadedBytes: session.uploadedBytes,
          progress: (session.uploadedBytes / file.size) * 100,
          currentChunk: session.uploadedChunks,
          chunks,
        });

        // Find chunks that need to be uploaded
        const pendingChunks = chunks
          .filter((c) => c.status === 'pending')
          .map((c) => c.chunkNumber);

        // Upload chunks with concurrency control
        const uploadQueue = [...pendingChunks];
        const activeUploads = new Map<number, Promise<void>>();

        while (uploadQueue.length > 0 || activeUploads.size > 0) {
          if (isPausedRef.current) {
            // Wait for active uploads to finish before pausing
            await Promise.all(activeUploads.values());
            break;
          }

          // Start new uploads up to concurrency limit
          while (
            uploadQueue.length > 0 &&
            activeUploads.size < concurrentChunks
          ) {
            const chunkNumber = uploadQueue.shift()!;
            const uploadPromise = uploadChunk(session, file, chunkNumber)
              .then(() => {
                activeUploads.delete(chunkNumber);
              })
              .catch((error) => {
                activeUploads.delete(chunkNumber);
                throw error;
              });

            activeUploads.set(chunkNumber, uploadPromise);
          }

          // Wait for at least one upload to complete
          if (activeUploads.size > 0) {
            await Promise.race(activeUploads.values());
          }
        }

        if (isPausedRef.current) {
          updateProgress({ status: 'paused' });
          return null;
        }

        // Complete the upload
        updateProgress({ status: 'completing' });

        const completeResponse = await uploadsApi.completeUpload(session.id);
        const result = completeResponse.data!;

        updateProgress({
          status: 'completed',
          progress: 100,
          uploadedBytes: file.size,
        });

        onComplete?.(result);
        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Upload failed';

        updateProgress({
          status: 'error',
          error: errorMessage,
        });

        onError?.(error instanceof Error ? error : new Error(errorMessage));
        return null;
      }
    },
    [chunkSize, concurrentChunks, updateProgress, uploadChunk, onComplete, onError]
  );

  const resumeUpload = useCallback(async () => {
    if (!sessionRef.current || !fileRef.current) {
      throw new Error('No upload session to resume');
    }

    isPausedRef.current = false;
    abortControllerRef.current = new AbortController();

    // Refresh session state
    const sessionResponse = await uploadsApi.getSession(sessionRef.current.id);
    const session = sessionResponse.data!;
    sessionRef.current = session;

    const file = fileRef.current;

    // Update chunks status
    const chunks: ChunkProgress[] = progress.chunks.map((c) => ({
      ...c,
      status: session.completedChunks.includes(c.chunkNumber)
        ? 'completed'
        : c.status === 'error'
        ? 'pending'
        : c.status,
    }));

    updateProgress({
      status: 'uploading',
      chunks,
      error: null,
    });

    // Find pending chunks
    const pendingChunks = chunks
      .filter((c) => c.status === 'pending')
      .map((c) => c.chunkNumber);

    // Upload remaining chunks
    const uploadQueue = [...pendingChunks];
    const activeUploads = new Map<number, Promise<void>>();

    while (uploadQueue.length > 0 || activeUploads.size > 0) {
      if (isPausedRef.current) {
        await Promise.all(activeUploads.values());
        break;
      }

      while (
        uploadQueue.length > 0 &&
        activeUploads.size < concurrentChunks
      ) {
        const chunkNumber = uploadQueue.shift()!;
        const uploadPromise = uploadChunk(session, file, chunkNumber)
          .then(() => {
            activeUploads.delete(chunkNumber);
          })
          .catch((error) => {
            activeUploads.delete(chunkNumber);
            throw error;
          });

        activeUploads.set(chunkNumber, uploadPromise);
      }

      if (activeUploads.size > 0) {
        await Promise.race(activeUploads.values());
      }
    }

    if (isPausedRef.current) {
      updateProgress({ status: 'paused' });
      return null;
    }

    // Complete the upload
    updateProgress({ status: 'completing' });

    const completeResponse = await uploadsApi.completeUpload(session.id);
    const result = completeResponse.data!;

    updateProgress({
      status: 'completed',
      progress: 100,
      uploadedBytes: file.size,
    });

    onComplete?.(result);
    return result;
  }, [concurrentChunks, progress.chunks, updateProgress, uploadChunk, onComplete]);

  const pauseUpload = useCallback(() => {
    isPausedRef.current = true;
    updateProgress({ status: 'paused' });
  }, [updateProgress]);

  const cancelUpload = useCallback(async () => {
    abortControllerRef.current?.abort();
    isPausedRef.current = true;

    if (sessionRef.current) {
      try {
        await uploadsApi.cancelUpload(sessionRef.current.id);
      } catch {
        // Ignore errors when cancelling
      }
    }

    updateProgress({
      status: 'cancelled',
      error: 'Upload cancelled',
    });

    sessionRef.current = null;
    fileRef.current = null;
  }, [updateProgress]);

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    sessionRef.current = null;
    fileRef.current = null;
    speedSamplesRef.current = [];

    setProgress({
      status: 'idle',
      sessionId: null,
      fileName: null,
      totalBytes: 0,
      uploadedBytes: 0,
      progress: 0,
      currentChunk: 0,
      totalChunks: 0,
      uploadSpeed: 0,
      remainingTime: null,
      error: null,
      chunks: [],
    });
  }, []);

  return {
    progress,
    startUpload,
    resumeUpload,
    pauseUpload,
    cancelUpload,
    reset,
    isUploading: progress.status === 'uploading' || progress.status === 'completing',
    isPaused: progress.status === 'paused',
    isCompleted: progress.status === 'completed',
    hasError: progress.status === 'error',
  };
}
