'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { processingApi, type ProcessingJob, type QueueStats, type QueueInfo } from '@/lib/api';

export type ProcessingOperationType = 'ocr' | 'pdf' | 'thumbnail' | 'embedding' | 'ai_classify';

export interface UseDocumentProcessingOptions {
  documentId?: string;
  jobIds?: string[];
  pollInterval?: number;
  enabled?: boolean;
}

export function useDocumentProcessing({
  documentId,
  jobIds = [],
  pollInterval = 3000,
  enabled = true,
}: UseDocumentProcessingOptions = {}) {
  const queryClient = useQueryClient();
  const [activeJobIds, setActiveJobIds] = useState<string[]>(jobIds);

  // Store previous jobIds to compare by value
  const prevJobIdsRef = useRef<string[]>(jobIds);

  // Track active jobs - only update when jobIds actually change (by value)
  useEffect(() => {
    const jobIdsStr = JSON.stringify(jobIds);
    const prevJobIdsStr = JSON.stringify(prevJobIdsRef.current);

    if (jobIdsStr !== prevJobIdsStr) {
      setActiveJobIds(jobIds);
      prevJobIdsRef.current = jobIds;
    }
  }, [jobIds]);

  // Poll job statuses
  const {
    data: jobStatuses,
    isLoading: isLoadingJobs,
    error: jobsError,
  } = useQuery({
    queryKey: ['processing-jobs', activeJobIds],
    queryFn: async () => {
      const results = await Promise.all(
        activeJobIds.map(async (id) => {
          try {
            const response = await processingApi.getJobStatus(id);
            return response.data as ProcessingJob;
          } catch {
            return null;
          }
        })
      );
      return results.filter((job): job is ProcessingJob => job !== null);
    },
    enabled: enabled && activeJobIds.length > 0,
    refetchInterval: (query) => {
      // Stop polling when all jobs are complete or failed
      const data = query.state.data as ProcessingJob[] | undefined;
      if (!data) return pollInterval;

      const allDone = data.every(
        (job) => ['completed', 'failed', 'cancelled'].includes(job.status)
      );
      return allDone ? false : pollInterval;
    },
  });

  // Queue stats
  const {
    data: queueStats,
    isLoading: isLoadingStats,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['queue-stats'],
    queryFn: async () => {
      const response = await processingApi.getQueueStats();
      return response.data as Record<string, QueueStats>;
    },
    enabled,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Available queues
  const { data: queuesData } = useQuery({
    queryKey: ['queues'],
    queryFn: async () => {
      const response = await processingApi.getQueues();
      return response.data?.queues as QueueInfo[];
    },
    enabled,
    staleTime: 60000, // Cache for 1 minute
  });

  // Trigger processing mutation
  const triggerProcessingMutation = useMutation({
    mutationFn: async ({
      docId,
      operations,
    }: {
      docId: string;
      operations: ProcessingOperationType[];
    }) => {
      const response = await processingApi.triggerProcessing(docId, operations);
      return response.data?.jobIds as string[];
    },
    onSuccess: (newJobIds) => {
      if (newJobIds && newJobIds.length > 0) {
        setActiveJobIds((prev) => [...prev, ...newJobIds]);
      }
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  // Retry job mutation
  const retryJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await processingApi.retryJob(jobId);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processing-jobs'] });
    },
  });

  // Cancel job mutation
  const cancelJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await processingApi.cancelJob(jobId);
      return response.data;
    },
    onSuccess: (_, jobId) => {
      setActiveJobIds((prev) => prev.filter((id) => id !== jobId));
      queryClient.invalidateQueries({ queryKey: ['processing-jobs'] });
    },
  });

  // Failed jobs query
  const {
    data: failedJobs,
    isLoading: isLoadingFailed,
    refetch: refetchFailed,
  } = useQuery({
    queryKey: ['failed-jobs'],
    queryFn: async () => {
      const response = await processingApi.getFailedJobs(50, 0);
      return response.data as ProcessingJob[];
    },
    enabled,
  });

  // Pause queue mutation
  const pauseQueueMutation = useMutation({
    mutationFn: async (queueName: string) => {
      const response = await processingApi.pauseQueue(queueName);
      return response.data;
    },
    onSuccess: () => {
      refetchStats();
    },
  });

  // Resume queue mutation
  const resumeQueueMutation = useMutation({
    mutationFn: async (queueName: string) => {
      const response = await processingApi.resumeQueue(queueName);
      return response.data;
    },
    onSuccess: () => {
      refetchStats();
    },
  });

  // Drain queue mutation
  const drainQueueMutation = useMutation({
    mutationFn: async (queueName: string) => {
      const response = await processingApi.drainQueue(queueName);
      return response.data;
    },
    onSuccess: () => {
      refetchStats();
    },
  });

  // Cleanup mutation
  const cleanupMutation = useMutation({
    mutationFn: async (olderThanDays: number = 7) => {
      const response = await processingApi.cleanOldJobs(olderThanDays);
      return response.data;
    },
    onSuccess: () => {
      refetchStats();
      refetchFailed();
    },
  });

  // Helper to start processing for a document
  const startProcessing = useCallback(
    async (operations: ProcessingOperationType[]) => {
      if (!documentId) {
        throw new Error('Document ID is required');
      }
      return triggerProcessingMutation.mutateAsync({ docId: documentId, operations });
    },
    [documentId, triggerProcessingMutation]
  );

  // Computed values
  const hasActiveJobs = (jobStatuses || []).some(
    (job) => ['pending', 'processing'].includes(job.status)
  );

  const overallProgress = jobStatuses?.length
    ? jobStatuses.reduce((sum, job) => sum + (job.progress || 0), 0) / jobStatuses.length
    : 0;

  const completedJobs = (jobStatuses || []).filter((job) => job.status === 'completed');
  const failedActiveJobs = (jobStatuses || []).filter((job) => job.status === 'failed');
  const pendingJobs = (jobStatuses || []).filter((job) => job.status === 'pending');
  const processingJobs = (jobStatuses || []).filter((job) => job.status === 'processing');

  // Get total stats
  const totalStats = queueStats
    ? Object.values(queueStats).reduce(
        (acc, stats) => ({
          waiting: acc.waiting + stats.waiting,
          active: acc.active + stats.active,
          completed: acc.completed + stats.completed,
          failed: acc.failed + stats.failed,
          delayed: acc.delayed + stats.delayed,
        }),
        { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 }
      )
    : null;

  return {
    // Job tracking
    jobStatuses,
    activeJobIds,
    hasActiveJobs,
    overallProgress,
    completedJobs,
    failedActiveJobs,
    pendingJobs,
    processingJobs,

    // Queue info
    queueStats,
    queues: queuesData,
    totalStats,
    failedJobs,

    // Loading states
    isLoadingJobs,
    isLoadingStats,
    isLoadingFailed,
    isProcessing: triggerProcessingMutation.isPending,
    isRetrying: retryJobMutation.isPending,
    isCancelling: cancelJobMutation.isPending,

    // Errors
    jobsError,

    // Actions
    startProcessing,
    triggerProcessing: triggerProcessingMutation.mutateAsync,
    retryJob: retryJobMutation.mutateAsync,
    cancelJob: cancelJobMutation.mutateAsync,
    pauseQueue: pauseQueueMutation.mutateAsync,
    resumeQueue: resumeQueueMutation.mutateAsync,
    drainQueue: drainQueueMutation.mutateAsync,
    cleanup: cleanupMutation.mutateAsync,
    refetchStats,
    refetchFailed,
    addJobId: (id: string) => setActiveJobIds((prev) => [...prev, id]),
    removeJobId: (id: string) => setActiveJobIds((prev) => prev.filter((i) => i !== id)),
    clearJobIds: () => setActiveJobIds([]),
  };
}

export type UseDocumentProcessingReturn = ReturnType<typeof useDocumentProcessing>;
