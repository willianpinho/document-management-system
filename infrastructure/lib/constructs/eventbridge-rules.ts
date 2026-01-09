/**
 * EventBridge Rules Construct
 *
 * Defines EventBridge rules for event-driven document processing.
 * Routes S3 upload events to appropriate processing queues.
 */

import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import type { EnvironmentConfig } from '../config';

export interface EventBridgeRulesProps {
  config: EnvironmentConfig;
  environment: string;
  documentsBucket: s3.IBucket;
  ocrQueue: sqs.IQueue;
  thumbnailQueue: sqs.IQueue;
  embeddingQueue: sqs.IQueue;
}

export class EventBridgeRulesConstruct extends Construct {
  public readonly eventBus: events.EventBus;

  constructor(scope: Construct, id: string, props: EventBridgeRulesProps) {
    super(scope, id);

    const { environment, documentsBucket, ocrQueue, thumbnailQueue, embeddingQueue } = props;
    const prefix = `dms-${environment}`;

    // Custom event bus for DMS events
    this.eventBus = new events.EventBus(this, 'DmsEventBus', {
      eventBusName: `${prefix}-events`,
    });

    // Rule: S3 Object Created -> Trigger OCR for PDFs
    new events.Rule(this, 'PdfUploadedRule', {
      ruleName: `${prefix}-pdf-uploaded`,
      eventBus: this.eventBus,
      eventPattern: {
        source: ['dms.storage'],
        detailType: ['Object Created'],
        detail: {
          bucket: {
            name: [documentsBucket.bucketName],
          },
          object: {
            key: [{ suffix: '.pdf' }],
          },
        },
      },
      targets: [
        new targets.SqsQueue(ocrQueue, {
          message: events.RuleTargetInput.fromEventPath('$.detail'),
        }),
      ],
    });

    // Rule: S3 Object Created -> Trigger Thumbnail for Images
    new events.Rule(this, 'ImageUploadedRule', {
      ruleName: `${prefix}-image-uploaded`,
      eventBus: this.eventBus,
      eventPattern: {
        source: ['dms.storage'],
        detailType: ['Object Created'],
        detail: {
          bucket: {
            name: [documentsBucket.bucketName],
          },
          object: {
            key: [
              { suffix: '.jpg' },
              { suffix: '.jpeg' },
              { suffix: '.png' },
              { suffix: '.gif' },
              { suffix: '.webp' },
            ],
          },
        },
      },
      targets: [
        new targets.SqsQueue(thumbnailQueue, {
          message: events.RuleTargetInput.fromEventPath('$.detail'),
        }),
      ],
    });

    // Rule: Document OCR Completed -> Generate Embeddings
    new events.Rule(this, 'OcrCompletedRule', {
      ruleName: `${prefix}-ocr-completed`,
      eventBus: this.eventBus,
      eventPattern: {
        source: ['dms.processing'],
        detailType: ['OCR Completed'],
      },
      targets: [
        new targets.SqsQueue(embeddingQueue, {
          message: events.RuleTargetInput.fromEventPath('$.detail'),
        }),
      ],
    });

    // Rule: Document Processing Failed -> Alert
    new events.Rule(this, 'ProcessingFailedRule', {
      ruleName: `${prefix}-processing-failed`,
      eventBus: this.eventBus,
      eventPattern: {
        source: ['dms.processing'],
        detailType: ['Processing Failed'],
      },
      // Add SNS target for alerting in production
    });

    // Archive all events for audit purposes
    new events.Archive(this, 'DmsEventArchive', {
      sourceEventBus: this.eventBus,
      archiveName: `${prefix}-event-archive`,
      retention: cdk.Duration.days(640), // ~21 months for compliance
      eventPattern: {
        source: ['dms.storage', 'dms.processing', 'dms.auth'],
      },
    });
  }

  /**
   * Add a custom rule to the event bus
   */
  addRule(
    id: string,
    ruleName: string,
    pattern: events.EventPattern,
    target: events.IRuleTarget
  ): events.Rule {
    return new events.Rule(this, id, {
      ruleName,
      eventBus: this.eventBus,
      eventPattern: pattern,
      targets: [target],
    });
  }

  /**
   * Get the event bus name for SDK usage
   */
  getEventBusName(): string {
    return this.eventBus.eventBusName;
  }
}
