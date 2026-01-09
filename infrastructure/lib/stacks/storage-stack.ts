import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';
import { type EnvironmentConfig, resourceName } from '../config';

export interface StorageStackProps extends cdk.StackProps {
  readonly config: EnvironmentConfig;
}

/**
 * Storage Stack
 *
 * Creates the storage infrastructure:
 * - S3 bucket for documents with versioning and encryption
 * - Lifecycle rules for cost optimization (Intelligent-Tiering, Glacier)
 * - CloudFront distribution for static asset delivery
 * - CORS configuration for web uploads
 */
export class StorageStack extends cdk.Stack {
  public readonly documentsBucket: s3.IBucket;
  public readonly cloudFrontDistribution: cloudfront.IDistribution;
  public readonly originAccessIdentity: cloudfront.OriginAccessIdentity;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const { config } = props;

    // Create Documents S3 Bucket
    this.documentsBucket = new s3.Bucket(this, 'DocumentsBucket', {
      bucketName: resourceName(config, `documents-${this.account}`),

      // Versioning for document history
      versioned: true,

      // Encryption
      encryption: s3.BucketEncryption.S3_MANAGED,

      // Block all public access
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,

      // Object ownership
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,

      // Access logging
      serverAccessLogsPrefix: 'access-logs/',

      // Enforce SSL
      enforceSSL: true,

      // CORS configuration for web uploads
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.DELETE,
            s3.HttpMethods.HEAD,
          ],
          allowedOrigins: config.environment === 'production'
            ? ['https://*.yourdomain.com'] // Replace with actual domain
            : ['http://localhost:3000', 'http://localhost:4000', 'https://*.vercel.app'],
          allowedHeaders: [
            'Authorization',
            'Content-Type',
            'Content-Length',
            'Content-MD5',
            'x-amz-*',
          ],
          exposedHeaders: [
            'ETag',
            'x-amz-version-id',
            'x-amz-request-id',
          ],
          maxAge: 3600,
        },
      ],

      // Lifecycle rules for cost optimization
      lifecycleRules: [
        // Move current versions to Intelligent-Tiering after 30 days
        {
          id: 'intelligent-tiering',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(config.storage.intelligentTieringDays),
            },
          ],
        },
        // Move old versions to Glacier after specified days
        {
          id: 'archive-old-versions',
          enabled: true,
          noncurrentVersionTransitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(config.storage.glacierDays),
            },
          ],
        },
        // Delete old versions after specified days
        {
          id: 'delete-old-versions',
          enabled: true,
          noncurrentVersionExpiration: cdk.Duration.days(config.storage.deleteAfterDays),
        },
        // Clean up incomplete multipart uploads
        {
          id: 'abort-incomplete-uploads',
          enabled: true,
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
        // Clean up expired delete markers
        {
          id: 'cleanup-delete-markers',
          enabled: true,
          expiredObjectDeleteMarker: true,
        },
      ],

      // Removal policy
      removalPolicy: config.environment === 'production'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: config.environment !== 'production',
    });

    // Create thumbnails bucket for processed images
    const thumbnailsBucket = new s3.Bucket(this, 'ThumbnailsBucket', {
      bucketName: resourceName(config, `thumbnails-${this.account}`),
      versioned: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      enforceSSL: true,

      lifecycleRules: [
        {
          id: 'delete-old-thumbnails',
          enabled: true,
          expiration: cdk.Duration.days(90),
        },
      ],

      removalPolicy: config.environment === 'production'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: config.environment !== 'production',
    });

    // Create Origin Access Identity for CloudFront (kept for backwards compatibility)
    this.originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI', {
      comment: `OAI for DMS ${config.environment}`,
    });

    // Create CloudFront Distribution
    this.cloudFrontDistribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `DMS CDN - ${config.environment}`,
      enabled: true,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      priceClass: config.environment === 'production'
        ? cloudfront.PriceClass.PRICE_CLASS_ALL
        : cloudfront.PriceClass.PRICE_CLASS_100, // Only US, Canada, Europe for staging

      // Default behavior for documents (downloads)
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.documentsBucket as s3.Bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT,
        compress: true,
      },

      // Additional behaviors
      additionalBehaviors: {
        // Thumbnails path with shorter cache
        '/thumbnails/*': {
          origin: origins.S3BucketOrigin.withOriginAccessControl(thumbnailsBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          cachePolicy: new cloudfront.CachePolicy(this, 'ThumbnailCachePolicy', {
            cachePolicyName: resourceName(config, 'thumbnail-cache'),
            comment: 'Cache policy for thumbnails',
            defaultTtl: cdk.Duration.days(7),
            maxTtl: cdk.Duration.days(30),
            minTtl: cdk.Duration.hours(1),
            enableAcceptEncodingBrotli: true,
            enableAcceptEncodingGzip: true,
          }),
          compress: true,
        },
      },

      // Error responses
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 404,
          responsePagePath: undefined,
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 404,
          responsePagePath: undefined,
          ttl: cdk.Duration.minutes(5),
        },
      ],

      // Logging
      enableLogging: true,
      logBucket: new s3.Bucket(this, 'CloudFrontLogsBucket', {
        bucketName: resourceName(config, `cdn-logs-${this.account}`),
        encryption: s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
        enforceSSL: true,
        lifecycleRules: [
          {
            id: 'delete-old-logs',
            enabled: true,
            expiration: cdk.Duration.days(30),
          },
        ],
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
      }),
      logFilePrefix: 'cloudfront/',

      // Security
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
    });

    // Outputs
    new cdk.CfnOutput(this, 'DocumentsBucketName', {
      value: this.documentsBucket.bucketName,
      description: 'Documents S3 bucket name',
      exportName: `${this.stackName}-DocumentsBucketName`,
    });

    new cdk.CfnOutput(this, 'DocumentsBucketArn', {
      value: this.documentsBucket.bucketArn,
      description: 'Documents S3 bucket ARN',
      exportName: `${this.stackName}-DocumentsBucketArn`,
    });

    new cdk.CfnOutput(this, 'ThumbnailsBucketName', {
      value: thumbnailsBucket.bucketName,
      description: 'Thumbnails S3 bucket name',
      exportName: `${this.stackName}-ThumbnailsBucketName`,
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: this.cloudFrontDistribution.distributionId,
      description: 'CloudFront distribution ID',
      exportName: `${this.stackName}-CloudFrontDistributionId`,
    });

    new cdk.CfnOutput(this, 'CloudFrontDomainName', {
      value: this.cloudFrontDistribution.distributionDomainName,
      description: 'CloudFront distribution domain name',
      exportName: `${this.stackName}-CloudFrontDomainName`,
    });
  }
}
