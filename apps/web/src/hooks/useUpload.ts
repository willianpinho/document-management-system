'use client';

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { documentsApi } from '@/lib/api';

export interface UploadProgress {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
  documentId?: string;
}

export function useUpload(folderId?: string) {
  const queryClient = useQueryClient();
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const updateUpload = useCallback(
    (id: string, update: Partial<UploadProgress>) => {
      setUploads((prev) =>
        prev.map((u) => (u.id === id ? { ...u, ...update } : u))
      );
    },
    []
  );

  const removeUpload = useCallback((id: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setUploads((prev) => prev.filter((u) => u.status !== 'completed'));
  }, []);

  const uploadFile = useCallback(
    async (file: File): Promise<string | null> => {
      const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // Add to upload queue
      setUploads((prev) => [
        ...prev,
        {
          id: uploadId,
          file,
          progress: 0,
          status: 'pending',
        },
      ]);

      try {
        // Step 1: Create document and get presigned URL
        updateUpload(uploadId, { status: 'uploading', progress: 10 });

        const createResponse = await documentsApi.create({
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          folderId,
        });

        const { document, uploadUrl, uploadFields } = createResponse.data;

        updateUpload(uploadId, { progress: 20, documentId: document.id });

        // Step 2: Upload file to S3
        const formData = new FormData();

        // Add presigned fields first (required for S3)
        if (uploadFields) {
          Object.entries(uploadFields).forEach(([key, value]) => {
            formData.append(key, value);
          });
        }

        // Add file last
        formData.append('file', file);

        // Create XMLHttpRequest for progress tracking
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const progress = 20 + Math.round((event.loaded / event.total) * 70);
              updateUpload(uploadId, { progress });
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          });

          xhr.addEventListener('error', () => {
            reject(new Error('Upload failed'));
          });

          xhr.open('POST', uploadUrl);
          xhr.send(formData);
        });

        // Step 3: Mark as processing (server will process the file)
        updateUpload(uploadId, { status: 'processing', progress: 95 });

        // Short delay to simulate processing acknowledgment
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Step 4: Complete
        updateUpload(uploadId, { status: 'completed', progress: 100 });

        // Invalidate queries to refresh document list
        queryClient.invalidateQueries({ queryKey: ['documents'] });
        if (folderId) {
          queryClient.invalidateQueries({ queryKey: ['folders', folderId] });
        }

        return document.id;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Upload failed';
        updateUpload(uploadId, { status: 'error', error: errorMessage });
        return null;
      }
    },
    [folderId, updateUpload, queryClient]
  );

  const uploadFiles = useCallback(
    async (files: File[]): Promise<(string | null)[]> => {
      setIsUploading(true);

      try {
        // Upload files sequentially to avoid overwhelming the server
        const results: (string | null)[] = [];
        for (const file of files) {
          const result = await uploadFile(file);
          results.push(result);
        }
        return results;
      } finally {
        setIsUploading(false);
      }
    },
    [uploadFile]
  );

  const cancelUpload = useCallback((id: string) => {
    // Note: XMLHttpRequest abort would need to be implemented
    // For now, just mark as error
    setUploads((prev) =>
      prev.map((u) =>
        u.id === id && u.status === 'uploading'
          ? { ...u, status: 'error', error: 'Cancelled' }
          : u
      )
    );
  }, []);

  const retryUpload = useCallback(
    async (id: string) => {
      const upload = uploads.find((u) => u.id === id);
      if (upload && upload.status === 'error') {
        removeUpload(id);
        await uploadFile(upload.file);
      }
    },
    [uploads, removeUpload, uploadFile]
  );

  return {
    uploads,
    isUploading,
    uploadFile,
    uploadFiles,
    cancelUpload,
    retryUpload,
    removeUpload,
    clearCompleted,
  };
}
