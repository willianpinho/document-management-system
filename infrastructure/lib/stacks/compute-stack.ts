import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { type EnvironmentConfig, resourceName } from '../config';

export interface ComputeStackProps extends cdk.StackProps {
  readonly config: EnvironmentConfig;
  readonly vpc: ec2.IVpc;
  readonly albSecurityGroup: ec2.ISecurityGroup;
  readonly apiSecurityGroup: ec2.ISecurityGroup;
  readonly documentsBucket: s3.IBucket;
  readonly databaseSecret: secretsmanager.ISecret;
  readonly cacheCluster: elasticache.CfnCacheCluster;
}

/**
 * Compute Stack
 *
 * Creates the compute infrastructure:
 * - ECS Fargate cluster with Container Insights
 * - API service with auto-scaling (2-10 tasks)
 * - Application Load Balancer with health checks
 * - ECR repository for container images
 * - IAM roles with least privilege access
 */
export class ComputeStack extends cdk.Stack {
  public readonly cluster: ecs.ICluster;
  public readonly apiService: ecs.FargateService;
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    const { config, vpc, albSecurityGroup, apiSecurityGroup, documentsBucket, databaseSecret, cacheCluster } = props;

    // Create ECR Repository for API
    const apiRepository = new ecr.Repository(this, 'ApiRepository', {
      repositoryName: resourceName(config, 'api'),
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.IMMUTABLE,
      lifecycleRules: [
        {
          description: 'Keep last 10 images',
          maxImageCount: 10,
          rulePriority: 1,
          tagStatus: ecr.TagStatus.ANY,
        },
      ],
      removalPolicy: config.environment === 'production'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: config.environment !== 'production',
    });

    // Create ECS Cluster with Container Insights
    this.cluster = new ecs.Cluster(this, 'Cluster', {
      clusterName: resourceName(config, 'cluster'),
      vpc,
      containerInsightsV2: ecs.ContainerInsights.ENABLED,
      enableFargateCapacityProviders: true,
    });

    // Create Log Group for API
    const apiLogGroup = new logs.LogGroup(this, 'ApiLogGroup', {
      logGroupName: `/ecs/${resourceName(config, 'api')}`,
      retention: config.environment === 'production'
        ? logs.RetentionDays.THREE_MONTHS
        : logs.RetentionDays.ONE_WEEK,
      removalPolicy: config.environment === 'production'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    // Create Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'ApiTaskDefinition', {
      family: resourceName(config, 'api'),
      cpu: config.ecs.cpu,
      memoryLimitMiB: config.ecs.memoryMiB,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });

    // Grant permissions to task role
    documentsBucket.grantReadWrite(taskDefinition.taskRole);
    databaseSecret.grantRead(taskDefinition.taskRole);

    // Add S3 permissions for presigned URLs
    taskDefinition.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: [
          's3:GetObject',
          's3:PutObject',
          's3:DeleteObject',
          's3:GetObjectVersion',
          's3:ListBucket',
        ],
        resources: [
          documentsBucket.bucketArn,
          `${documentsBucket.bucketArn}/*`,
        ],
      })
    );

    // Add Textract permissions
    taskDefinition.taskRole.addToPrincipalPolicy(
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

    // Add SQS permissions for async processing
    taskDefinition.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: [
          'sqs:SendMessage',
          'sqs:ReceiveMessage',
          'sqs:DeleteMessage',
          'sqs:GetQueueAttributes',
        ],
        resources: [
          `arn:aws:sqs:${this.region}:${this.account}:${resourceName(config, '*')}`,
        ],
      })
    );

    // Add container to task definition
    const container = taskDefinition.addContainer('api', {
      containerName: 'api',
      image: ecs.ContainerImage.fromEcrRepository(apiRepository, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'api',
        logGroup: apiLogGroup,
      }),
      environment: {
        NODE_ENV: config.environment,
        PORT: '4000',
        AWS_REGION: this.region,
        S3_BUCKET: documentsBucket.bucketName,
        REDIS_HOST: cacheCluster.attrRedisEndpointAddress,
        REDIS_PORT: cacheCluster.attrRedisEndpointPort,
      },
      secrets: {
        DATABASE_URL: ecs.Secret.fromSecretsManager(databaseSecret, 'connectionString'),
        DB_HOST: ecs.Secret.fromSecretsManager(databaseSecret, 'host'),
        DB_PORT: ecs.Secret.fromSecretsManager(databaseSecret, 'port'),
        DB_NAME: ecs.Secret.fromSecretsManager(databaseSecret, 'dbname'),
        DB_USER: ecs.Secret.fromSecretsManager(databaseSecret, 'username'),
        DB_PASSWORD: ecs.Secret.fromSecretsManager(databaseSecret, 'password'),
      },
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:4000/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
      portMappings: [
        {
          containerPort: 4000,
          protocol: ecs.Protocol.TCP,
        },
      ],
    });

    // Create Application Load Balancer
    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'LoadBalancer', {
      loadBalancerName: resourceName(config, 'alb'),
      vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup as ec2.SecurityGroup,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
    });

    // Enable access logs
    const accessLogsBucket = new s3.Bucket(this, 'AlbAccessLogsBucket', {
      bucketName: resourceName(config, `alb-logs-${this.account}`),
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
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
    });

    this.loadBalancer.logAccessLogs(accessLogsBucket);

    // Create Target Group
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'TargetGroup', {
      targetGroupName: resourceName(config, 'api-tg'),
      vpc,
      port: 4000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        enabled: true,
        path: '/health',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
        healthyHttpCodes: '200',
      },
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    // Add HTTP Listener (redirect to HTTPS in production)
    const httpListener = this.loadBalancer.addListener('HttpListener', {
      port: 80,
      defaultAction: config.environment === 'production' && config.domain
        ? elbv2.ListenerAction.redirect({
            protocol: 'HTTPS',
            port: '443',
            permanent: true,
          })
        : elbv2.ListenerAction.forward([targetGroup]),
    });

    // Create Fargate Service
    this.apiService = new ecs.FargateService(this, 'ApiService', {
      serviceName: resourceName(config, 'api'),
      cluster: this.cluster,
      taskDefinition,
      desiredCount: config.ecs.desiredCount,
      assignPublicIp: false,
      securityGroups: [apiSecurityGroup as ec2.SecurityGroup],
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      capacityProviderStrategies: [
        {
          capacityProvider: 'FARGATE',
          weight: 1,
          base: 1,
        },
        {
          capacityProvider: 'FARGATE_SPOT',
          weight: config.environment === 'production' ? 0 : 2,
        },
      ],
      circuitBreaker: {
        rollback: true,
      },
      minHealthyPercent: 100, // Keep all tasks running during deployments
      maxHealthyPercent: 200, // Allow double the tasks during deployment
      enableExecuteCommand: config.environment !== 'production',
      propagateTags: ecs.PropagatedTagSource.SERVICE,
    });

    // Register with target group
    this.apiService.attachToApplicationTargetGroup(targetGroup);

    // Configure Auto Scaling
    const scaling = this.apiService.autoScaleTaskCount({
      minCapacity: config.ecs.minCapacity,
      maxCapacity: config.ecs.maxCapacity,
    });

    // Scale based on CPU utilization
    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: config.ecs.targetCpuUtilization,
      scaleInCooldown: cdk.Duration.seconds(300),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // Scale based on memory utilization
    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 80,
      scaleInCooldown: cdk.Duration.seconds(300),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // Scale based on request count
    scaling.scaleOnRequestCount('RequestCountScaling', {
      targetGroup,
      requestsPerTarget: 1000,
      scaleInCooldown: cdk.Duration.seconds(300),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // Store API URL
    this.apiUrl = `http://${this.loadBalancer.loadBalancerDnsName}`;

    // Outputs
    new cdk.CfnOutput(this, 'ClusterName', {
      value: this.cluster.clusterName,
      description: 'ECS cluster name',
      exportName: `${this.stackName}-ClusterName`,
    });

    new cdk.CfnOutput(this, 'ClusterArn', {
      value: this.cluster.clusterArn,
      description: 'ECS cluster ARN',
      exportName: `${this.stackName}-ClusterArn`,
    });

    new cdk.CfnOutput(this, 'ServiceName', {
      value: this.apiService.serviceName,
      description: 'ECS service name',
      exportName: `${this.stackName}-ServiceName`,
    });

    new cdk.CfnOutput(this, 'LoadBalancerDns', {
      value: this.loadBalancer.loadBalancerDnsName,
      description: 'Load balancer DNS name',
      exportName: `${this.stackName}-LoadBalancerDns`,
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.apiUrl,
      description: 'API URL',
      exportName: `${this.stackName}-ApiUrl`,
    });

    new cdk.CfnOutput(this, 'EcrRepositoryUri', {
      value: apiRepository.repositoryUri,
      description: 'ECR repository URI',
      exportName: `${this.stackName}-EcrRepositoryUri`,
    });
  }
}
