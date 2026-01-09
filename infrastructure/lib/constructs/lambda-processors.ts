/**
 * Lambda Processors Construct
 *
 * Defines Lambda functions for document processing tasks.
 * Each function is optimized for its specific processing type.
 */

import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import type { EnvironmentConfig } from '../config';

export interface LambdaProcessorsProps {
  config: EnvironmentConfig;
  environment: string;
  documentsBucket: s3.IBucket;
  thumbnailsBucket: s3.IBucket;
  ocrQueue: sqs.IQueue;
  pdfQueue: sqs.IQueue;
  thumbnailQueue: sqs.IQueue;
  embeddingQueue: sqs.IQueue;
  aiClassifyQueue: sqs.IQueue;
  databaseSecretArn: string;
}

export interface ProcessorLambdas {
  ocrProcessor: lambda.Function;
  pdfProcessor: lambda.Function;
  thumbnailProcessor: lambda.Function;
  embeddingProcessor: lambda.Function;
  aiClassifyProcessor: lambda.Function;
}

export class LambdaProcessorsConstruct extends Construct {
  public readonly processors: ProcessorLambdas;

  constructor(scope: Construct, id: string, props: LambdaProcessorsProps) {
    super(scope, id);

    const {
      config,
      environment,
      documentsBucket,
      thumbnailsBucket,
      ocrQueue,
      pdfQueue,
      thumbnailQueue,
      embeddingQueue,
      aiClassifyQueue,
      databaseSecretArn,
    } = props;

    const prefix = `dms-${environment}`;
    const isProduction = environment === 'production';

    // Common environment variables
    const commonEnvVars = {
      NODE_ENV: environment,
      DOCUMENTS_BUCKET: documentsBucket.bucketName,
      THUMBNAILS_BUCKET: thumbnailsBucket.bucketName,
      DATABASE_SECRET_ARN: databaseSecretArn,
      AWS_REGION: process.env.CDK_DEFAULT_REGION || 'us-east-1',
    };

    // Common Lambda props
    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      tracing: lambda.Tracing.ACTIVE,
      logRetention: isProduction
        ? logs.RetentionDays.THREE_MONTHS
        : logs.RetentionDays.ONE_WEEK,
    };

    // OCR Processor - High memory for Textract processing
    const ocrProcessor = new lambda.Function(this, 'OcrProcessor', {
      ...commonLambdaProps,
      functionName: `${prefix}-ocr-processor`,
      description: 'Processes documents with AWS Textract for OCR',
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/ocr-processor'),
      memorySize: 2048,
      timeout: Duration.minutes(10),
      environment: {
        ...commonEnvVars,
        TEXTRACT_CONCURRENT_LIMIT: '5',
      },
      reservedConcurrentExecutions: isProduction ? 10 : 2,
    });

    // Grant Textract permissions
    ocrProcessor.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'textract:DetectDocumentText',
          'textract:AnalyzeDocument',
          'textract:StartDocumentTextDetection',
          'textract:GetDocumentTextDetection',
          'textract:StartDocumentAnalysis',
          'textract:GetDocumentAnalysis',
        ],
        resources: ['*'],
      })
    );

    // PDF Processor - Medium memory for PDF operations
    const pdfProcessor = new lambda.Function(this, 'PdfProcessor', {
      ...commonLambdaProps,
      functionName: `${prefix}-pdf-processor`,
      description: 'Processes PDF documents (split, merge, compress)',
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/pdf-processor'),
      memorySize: 1024,
      timeout: Duration.minutes(5),
      environment: commonEnvVars,
      reservedConcurrentExecutions: isProduction ? 20 : 5,
    });

    // Thumbnail Processor - Optimized for image processing
    const thumbnailProcessor = new lambda.Function(this, 'ThumbnailProcessor', {
      ...commonLambdaProps,
      functionName: `${prefix}-thumbnail-processor`,
      description: 'Generates thumbnails for documents',
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/thumbnail-processor'),
      memorySize: 512,
      timeout: Duration.minutes(2),
      environment: {
        ...commonEnvVars,
        THUMBNAIL_SIZES: '64,128,256,512',
      },
      reservedConcurrentExecutions: isProduction ? 50 : 10,
    });

    // Embedding Processor - For vector embeddings
    const embeddingProcessor = new lambda.Function(this, 'EmbeddingProcessor', {
      ...commonLambdaProps,
      functionName: `${prefix}-embedding-processor`,
      description: 'Generates vector embeddings for semantic search',
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/embedding-processor'),
      memorySize: 1024,
      timeout: Duration.minutes(5),
      environment: {
        ...commonEnvVars,
        OPENAI_API_KEY_SECRET: 'dms/openai-api-key', // Stored in Secrets Manager
        EMBEDDING_MODEL: 'text-embedding-3-small',
      },
      reservedConcurrentExecutions: isProduction ? 10 : 3,
    });

    // AI Classify Processor - For document classification
    const aiClassifyProcessor = new lambda.Function(this, 'AiClassifyProcessor', {
      ...commonLambdaProps,
      functionName: `${prefix}-ai-classify-processor`,
      description: 'Classifies documents using AI',
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/ai-classify-processor'),
      memorySize: 512,
      timeout: Duration.minutes(5),
      environment: {
        ...commonEnvVars,
        OPENAI_API_KEY_SECRET: 'dms/openai-api-key',
        CLASSIFICATION_MODEL: 'gpt-4o-mini',
      },
      reservedConcurrentExecutions: isProduction ? 5 : 2,
    });

    // Grant S3 permissions to all processors
    [ocrProcessor, pdfProcessor, thumbnailProcessor, embeddingProcessor, aiClassifyProcessor].forEach((fn) => {
      documentsBucket.grantRead(fn);
      thumbnailsBucket.grantReadWrite(fn);
    });

    // Grant Secrets Manager access for API keys
    [embeddingProcessor, aiClassifyProcessor].forEach((fn) => {
      fn.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['secretsmanager:GetSecretValue'],
          resources: [`arn:aws:secretsmanager:*:*:secret:dms/*`],
        })
      );
    });

    // Connect SQS queues to Lambda functions
    ocrProcessor.addEventSource(
      new lambdaEventSources.SqsEventSource(ocrQueue, {
        batchSize: 1,
        maxConcurrency: isProduction ? 10 : 2,
      })
    );

    pdfProcessor.addEventSource(
      new lambdaEventSources.SqsEventSource(pdfQueue, {
        batchSize: 5,
        maxConcurrency: isProduction ? 20 : 5,
      })
    );

    thumbnailProcessor.addEventSource(
      new lambdaEventSources.SqsEventSource(thumbnailQueue, {
        batchSize: 10,
        maxConcurrency: isProduction ? 50 : 10,
      })
    );

    embeddingProcessor.addEventSource(
      new lambdaEventSources.SqsEventSource(embeddingQueue, {
        batchSize: 5,
        maxConcurrency: isProduction ? 10 : 3,
      })
    );

    aiClassifyProcessor.addEventSource(
      new lambdaEventSources.SqsEventSource(aiClassifyQueue, {
        batchSize: 1,
        maxConcurrency: isProduction ? 5 : 2,
      })
    );

    this.processors = {
      ocrProcessor,
      pdfProcessor,
      thumbnailProcessor,
      embeddingProcessor,
      aiClassifyProcessor,
    };
  }

  /**
   * Get all processor ARNs for monitoring
   */
  getProcessorArns(): string[] {
    return Object.values(this.processors).map((fn) => fn.functionArn);
  }
}
