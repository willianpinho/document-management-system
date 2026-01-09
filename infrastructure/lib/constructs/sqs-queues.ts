/**
 * SQS Queues Construct
 *
 * Defines the SQS queues used for document processing pipeline.
 * Each queue handles a specific processing type with appropriate
 * retry and DLQ configuration.
 */

import { Construct } from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import type { EnvironmentConfig } from '../config';

export interface SqsQueuesProps {
  config: EnvironmentConfig;
  environment: string;
}

export interface ProcessingQueues {
  ocr: sqs.Queue;
  pdf: sqs.Queue;
  thumbnail: sqs.Queue;
  embedding: sqs.Queue;
  aiClassify: sqs.Queue;
  dlq: sqs.Queue;
}

export class SqsQueuesConstruct extends Construct {
  public readonly queues: ProcessingQueues;
  public readonly dlqAlarmTopic: string;

  constructor(scope: Construct, id: string, props: SqsQueuesProps) {
    super(scope, id);

    const { config, environment } = props;
    const prefix = `dms-${environment}`;

    // Dead Letter Queue for failed messages
    const dlq = new sqs.Queue(this, 'DeadLetterQueue', {
      queueName: `${prefix}-processing-dlq`,
      retentionPeriod: Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      removalPolicy:
        environment === 'production'
          ? RemovalPolicy.RETAIN
          : RemovalPolicy.DESTROY,
    });

    // Common queue settings
    const commonQueueProps = {
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      retentionPeriod: Duration.days(7),
      removalPolicy:
        environment === 'production'
          ? RemovalPolicy.RETAIN
          : RemovalPolicy.DESTROY,
    };

    // OCR Processing Queue
    const ocrQueue = new sqs.Queue(this, 'OcrQueue', {
      ...commonQueueProps,
      queueName: `${prefix}-ocr-processing`,
      visibilityTimeout: Duration.minutes(10), // OCR can take time
      deadLetterQueue: {
        queue: dlq,
        maxReceiveCount: 3,
      },
    });

    // PDF Processing Queue
    const pdfQueue = new sqs.Queue(this, 'PdfQueue', {
      ...commonQueueProps,
      queueName: `${prefix}-pdf-processing`,
      visibilityTimeout: Duration.minutes(5),
      deadLetterQueue: {
        queue: dlq,
        maxReceiveCount: 3,
      },
    });

    // Thumbnail Generation Queue
    const thumbnailQueue = new sqs.Queue(this, 'ThumbnailQueue', {
      ...commonQueueProps,
      queueName: `${prefix}-thumbnail-processing`,
      visibilityTimeout: Duration.minutes(2),
      deadLetterQueue: {
        queue: dlq,
        maxReceiveCount: 3,
      },
    });

    // Embedding Generation Queue
    const embeddingQueue = new sqs.Queue(this, 'EmbeddingQueue', {
      ...commonQueueProps,
      queueName: `${prefix}-embedding-processing`,
      visibilityTimeout: Duration.minutes(5),
      deadLetterQueue: {
        queue: dlq,
        maxReceiveCount: 3,
      },
    });

    // AI Classification Queue
    const aiClassifyQueue = new sqs.Queue(this, 'AiClassifyQueue', {
      ...commonQueueProps,
      queueName: `${prefix}-ai-classify-processing`,
      visibilityTimeout: Duration.minutes(5),
      deadLetterQueue: {
        queue: dlq,
        maxReceiveCount: 3,
      },
    });

    this.queues = {
      ocr: ocrQueue,
      pdf: pdfQueue,
      thumbnail: thumbnailQueue,
      embedding: embeddingQueue,
      aiClassify: aiClassifyQueue,
      dlq,
    };

    this.dlqAlarmTopic = dlq.queueArn;
  }

  /**
   * Grant send message permissions to a principal
   */
  grantSendMessages(principal: iam.IGrantable): void {
    Object.values(this.queues).forEach((queue) => {
      queue.grantSendMessages(principal);
    });
  }

  /**
   * Grant consume messages permissions to a principal
   */
  grantConsumeMessages(principal: iam.IGrantable): void {
    Object.values(this.queues).forEach((queue) => {
      if (queue !== this.queues.dlq) {
        queue.grantConsumeMessages(principal);
      }
    });
  }

  /**
   * Get queue URLs for application configuration
   */
  getQueueUrls(): Record<string, string> {
    return {
      ocrQueueUrl: this.queues.ocr.queueUrl,
      pdfQueueUrl: this.queues.pdf.queueUrl,
      thumbnailQueueUrl: this.queues.thumbnail.queueUrl,
      embeddingQueueUrl: this.queues.embedding.queueUrl,
      aiClassifyQueueUrl: this.queues.aiClassify.queueUrl,
      dlqUrl: this.queues.dlq.queueUrl,
    };
  }

  /**
   * Get queue ARNs for IAM policies
   */
  getQueueArns(): string[] {
    return Object.values(this.queues).map((q) => q.queueArn);
  }
}
