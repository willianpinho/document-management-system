'use client';

import { useState } from 'react';
import {
  Activity,
  Pause,
  Play,
  Trash2,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Timer,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Progress,
  Badge,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@dms/ui';
import { cn } from '@/lib/utils';
import { useDocumentProcessing } from '@/hooks/useDocumentProcessing';
import type { QueueStats, QueueInfo, ProcessingJob } from '@/lib/api';

interface QueueCardProps {
  queue: QueueInfo;
  stats?: QueueStats;
  onPause: () => void;
  onResume: () => void;
  onDrain: () => void;
  isPausing: boolean;
  isResuming: boolean;
  isDraining: boolean;
}

function QueueCard({
  queue,
  stats,
  onPause,
  onResume,
  onDrain,
  isPausing,
  isResuming,
  isDraining,
}: QueueCardProps) {
  const total = stats
    ? stats.waiting + stats.active + stats.completed + stats.failed + stats.delayed
    : 0;

  const successRate = stats && total > 0
    ? ((stats.completed / total) * 100).toFixed(1)
    : '0';

  return (
    <Card className={cn(stats?.paused && 'opacity-60')}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{queue.name}</CardTitle>
          {stats?.paused && (
            <Badge variant="secondary">
              <Pause className="h-3 w-3 mr-1" />
              Paused
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs">{queue.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats ? (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-muted rounded-md">
                <div className="flex items-center justify-center gap-1 text-yellow-600">
                  <Clock className="h-3 w-3" />
                  <span className="text-lg font-bold">{stats.waiting}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">Waiting</p>
              </div>
              <div className="p-2 bg-muted rounded-md">
                <div className="flex items-center justify-center gap-1 text-blue-600">
                  <Loader2 className="h-3 w-3" />
                  <span className="text-lg font-bold">{stats.active}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">Active</p>
              </div>
              <div className="p-2 bg-muted rounded-md">
                <div className="flex items-center justify-center gap-1 text-orange-600">
                  <Timer className="h-3 w-3" />
                  <span className="text-lg font-bold">{stats.delayed}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">Delayed</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2 bg-green-50 dark:bg-green-950 rounded-md">
                <div className="flex items-center justify-center gap-1 text-green-600">
                  <CheckCircle2 className="h-3 w-3" />
                  <span className="text-lg font-bold">{stats.completed}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">Completed</p>
              </div>
              <div className="p-2 bg-red-50 dark:bg-red-950 rounded-md">
                <div className="flex items-center justify-center gap-1 text-red-600">
                  <AlertCircle className="h-3 w-3" />
                  <span className="text-lg font-bold">{stats.failed}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">Failed</p>
              </div>
            </div>

            {/* Success rate */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Success Rate</span>
                <span className="font-medium">{successRate}%</span>
              </div>
              <Progress value={parseFloat(successRate)} className="h-2" />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {stats.paused ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={onResume}
                  disabled={isResuming}
                >
                  {isResuming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-1" />
                      Resume
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={onPause}
                  disabled={isPausing}
                >
                  {isPausing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Pause className="h-4 w-4 mr-1" />
                      Pause
                    </>
                  )}
                </Button>
              )}

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={isDraining || stats.waiting === 0}
                  >
                    {isDraining ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Drain Queue?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove all {stats.waiting} waiting jobs from the {queue.name} queue.
                      Active jobs will continue to completion. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onDrain}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Drain Queue
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Loading stats...
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FailedJobRow({
  job,
  onRetry,
  isRetrying,
}: {
  job: ProcessingJob;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-3 border rounded-md">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm capitalize">{job.type}</span>
          <Badge variant="outline" className="text-[10px]">
            Attempt {job.attempts ?? 0}/{job.maxAttempts ?? 3}
          </Badge>
        </div>
        <p className="text-xs text-destructive truncate">{job.error}</p>
        <p className="text-[10px] text-muted-foreground">
          {new Date(job.createdAt).toLocaleString()}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onRetry}
        disabled={isRetrying || (job.attempts ?? 0) >= (job.maxAttempts ?? 3)}
      >
        {isRetrying ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <RefreshCw className="h-4 w-4 mr-1" />
            Retry
          </>
        )}
      </Button>
    </div>
  );
}

export function QueueDashboard() {
  const {
    queues,
    queueStats,
    totalStats,
    failedJobs,
    isLoadingStats,
    isLoadingFailed,
    isRetrying,
    pauseQueue,
    resumeQueue,
    drainQueue,
    retryJob,
    cleanup,
    refetchStats,
    refetchFailed,
  } = useDocumentProcessing({});

  const [pausingQueue, setPausingQueue] = useState<string | null>(null);
  const [resumingQueue, setResumingQueue] = useState<string | null>(null);
  const [drainingQueue, setDrainingQueue] = useState<string | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);

  const handlePause = async (queueName: string) => {
    setPausingQueue(queueName);
    try {
      await pauseQueue(queueName);
    } finally {
      setPausingQueue(null);
    }
  };

  const handleResume = async (queueName: string) => {
    setResumingQueue(queueName);
    try {
      await resumeQueue(queueName);
    } finally {
      setResumingQueue(null);
    }
  };

  const handleDrain = async (queueName: string) => {
    setDrainingQueue(queueName);
    try {
      await drainQueue(queueName);
    } finally {
      setDrainingQueue(null);
    }
  };

  const handleCleanup = async () => {
    setIsCleaning(true);
    try {
      await cleanup(7);
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with total stats */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              <CardTitle>Processing Queue Dashboard</CardTitle>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => refetchStats()}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={isCleaning}>
                    {isCleaning ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-1" />
                    )}
                    Cleanup
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clean Up Old Jobs?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove all completed and failed jobs older than 7 days.
                      This helps keep the system performant.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCleanup}>
                      Clean Up
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
          <CardDescription>Monitor and manage document processing queues</CardDescription>
        </CardHeader>
        {totalStats && (
          <CardContent>
            <div className="grid grid-cols-5 gap-4 text-center">
              <div className="p-3 bg-muted rounded-md">
                <p className="text-2xl font-bold text-yellow-600">{totalStats.waiting}</p>
                <p className="text-xs text-muted-foreground">Waiting</p>
              </div>
              <div className="p-3 bg-muted rounded-md">
                <p className="text-2xl font-bold text-blue-600">{totalStats.active}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
              <div className="p-3 bg-muted rounded-md">
                <p className="text-2xl font-bold text-orange-600">{totalStats.delayed}</p>
                <p className="text-xs text-muted-foreground">Delayed</p>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-950 rounded-md">
                <p className="text-2xl font-bold text-green-600">{totalStats.completed}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
              <div className="p-3 bg-red-50 dark:bg-red-950 rounded-md">
                <p className="text-2xl font-bold text-red-600">{totalStats.failed}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Queue cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoadingStats && !queues && (
          <div className="col-span-full flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {queues?.map((queue) => (
          <QueueCard
            key={queue.key}
            queue={queue}
            stats={queueStats?.[queue.name]}
            onPause={() => handlePause(queue.name)}
            onResume={() => handleResume(queue.name)}
            onDrain={() => handleDrain(queue.name)}
            isPausing={pausingQueue === queue.name}
            isResuming={resumingQueue === queue.name}
            isDraining={drainingQueue === queue.name}
          />
        ))}
      </div>

      {/* Failed jobs */}
      {failedJobs && failedJobs.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <CardTitle>Failed Jobs ({failedJobs.length})</CardTitle>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetchFailed()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription>Jobs that failed processing and may need attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {failedJobs.map((job) => (
                <FailedJobRow
                  key={job.id}
                  job={job}
                  onRetry={() => retryJob(job.id)}
                  isRetrying={isRetrying}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
