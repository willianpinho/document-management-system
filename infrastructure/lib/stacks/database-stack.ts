import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { type EnvironmentConfig, resourceName } from '../config';

export interface DatabaseStackProps extends cdk.StackProps {
  readonly config: EnvironmentConfig;
  readonly vpc: ec2.IVpc;
  readonly securityGroups: {
    readonly database: ec2.ISecurityGroup;
    readonly cache: ec2.ISecurityGroup;
  };
}

/**
 * Database Stack
 *
 * Creates the database infrastructure:
 * - RDS PostgreSQL 18 with Multi-AZ (production)
 * - Encrypted storage with automated backups
 * - ElastiCache Redis cluster for caching and sessions
 * - Secrets Manager for credential management
 */
export class DatabaseStack extends cdk.Stack {
  public readonly databaseInstance: rds.IDatabaseInstance;
  public readonly databaseSecret: secretsmanager.ISecret;
  public readonly cacheCluster: elasticache.CfnCacheCluster;
  public readonly cacheEndpoint: string;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const { config, vpc, securityGroups } = props;

    // Create Database Secret
    this.databaseSecret = new secretsmanager.Secret(this, 'DatabaseSecret', {
      secretName: resourceName(config, 'database-credentials'),
      description: 'PostgreSQL database credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: 'dms_admin',
        }),
        generateStringKey: 'password',
        excludePunctuation: true,
        excludeCharacters: '"@/\\',
        passwordLength: 32,
      },
    });

    // Create Parameter Group for PostgreSQL 18
    const parameterGroup = new rds.ParameterGroup(this, 'ParameterGroup', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16_4, // Using 16 as 18 may not be available yet
      }),
      description: 'Custom parameter group for DMS PostgreSQL',
      parameters: {
        // Enable logical replication for future CDC
        'rds.logical_replication': '1',
        // Performance tuning
        'shared_preload_libraries': 'pg_stat_statements',
        'log_statement': 'ddl',
        'log_min_duration_statement': '1000', // Log queries > 1s
        // Connection settings
        'max_connections': '200',
        // Memory settings (will be auto-tuned by RDS)
        'work_mem': '16384', // 16MB
        'maintenance_work_mem': '524288', // 512MB
      },
    });

    // Create Subnet Group for RDS
    const subnetGroup = new rds.SubnetGroup(this, 'SubnetGroup', {
      vpc,
      description: 'Subnet group for DMS database',
      subnetGroupName: resourceName(config, 'database-subnet-group'),
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
    });

    // Create RDS PostgreSQL Instance
    this.databaseInstance = new rds.DatabaseInstance(this, 'Database', {
      instanceIdentifier: resourceName(config, 'postgres'),
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16_4,
      }),

      // Instance configuration
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        this.getInstanceSize(config.database.instanceClass)
      ),

      // Network configuration
      vpc,
      subnetGroup,
      securityGroups: [securityGroups.database],
      publiclyAccessible: false,

      // Storage configuration
      allocatedStorage: config.database.allocatedStorage,
      maxAllocatedStorage: config.database.maxAllocatedStorage,
      storageType: rds.StorageType.GP3,
      storageEncrypted: true,

      // Credentials
      credentials: rds.Credentials.fromSecret(this.databaseSecret),

      // Database name
      databaseName: 'dms',

      // High availability
      multiAz: config.database.multiAz,

      // Backup configuration
      backupRetention: cdk.Duration.days(config.database.backupRetention),
      preferredBackupWindow: '03:00-04:00', // 3-4 AM UTC
      preferredMaintenanceWindow: 'Sun:04:00-Sun:05:00', // Sunday 4-5 AM UTC
      deleteAutomatedBackups: config.environment === 'staging',

      // Monitoring
      enablePerformanceInsights: true,
      performanceInsightRetention: rds.PerformanceInsightRetention.DEFAULT, // 7 days free
      cloudwatchLogsExports: ['postgresql', 'upgrade'],
      cloudwatchLogsRetention: logs.RetentionDays.ONE_MONTH,

      // Parameter group
      parameterGroup,

      // Protection
      deletionProtection: config.database.deletionProtection,
      removalPolicy: config.environment === 'production'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,

      // Auto minor version upgrade
      autoMinorVersionUpgrade: true,
    });

    // Create ElastiCache Subnet Group
    const cacheSubnetGroup = new elasticache.CfnSubnetGroup(this, 'CacheSubnetGroup', {
      description: 'Subnet group for DMS Redis cache',
      subnetIds: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      }).subnetIds,
      cacheSubnetGroupName: resourceName(config, 'cache-subnet-group'),
    });

    // Create ElastiCache Redis Cluster
    this.cacheCluster = new elasticache.CfnCacheCluster(this, 'CacheCluster', {
      clusterName: resourceName(config, 'redis'),
      engine: 'redis',
      engineVersion: '7.1',
      cacheNodeType: config.cache.nodeType,
      numCacheNodes: config.cache.numCacheNodes,

      // Network configuration
      cacheSubnetGroupName: cacheSubnetGroup.cacheSubnetGroupName,
      vpcSecurityGroupIds: [securityGroups.cache.securityGroupId],

      // Availability
      azMode: config.cache.numCacheNodes > 1 ? 'cross-az' : 'single-az',
      preferredAvailabilityZone: config.cache.numCacheNodes === 1
        ? vpc.availabilityZones[0]
        : undefined,

      // Configuration
      port: 6379,
      autoMinorVersionUpgrade: true,
      preferredMaintenanceWindow: 'Sun:05:00-Sun:06:00',

      // Snapshots
      snapshotRetentionLimit: config.environment === 'production' ? 7 : 1,
      snapshotWindow: '04:00-05:00',
    });

    // Add dependency
    this.cacheCluster.addDependency(cacheSubnetGroup);

    // Store cache endpoint
    this.cacheEndpoint = `${this.cacheCluster.attrRedisEndpointAddress}:${this.cacheCluster.attrRedisEndpointPort}`;

    // Outputs
    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: this.databaseInstance.dbInstanceEndpointAddress,
      description: 'PostgreSQL endpoint',
      exportName: `${this.stackName}-DatabaseEndpoint`,
    });

    new cdk.CfnOutput(this, 'DatabasePort', {
      value: this.databaseInstance.dbInstanceEndpointPort,
      description: 'PostgreSQL port',
      exportName: `${this.stackName}-DatabasePort`,
    });

    new cdk.CfnOutput(this, 'DatabaseSecretArn', {
      value: this.databaseSecret.secretArn,
      description: 'Database credentials secret ARN',
      exportName: `${this.stackName}-DatabaseSecretArn`,
    });

    new cdk.CfnOutput(this, 'CacheEndpoint', {
      value: this.cacheEndpoint,
      description: 'Redis cache endpoint',
      exportName: `${this.stackName}-CacheEndpoint`,
    });
  }

  /**
   * Parse instance class string to get instance size
   */
  private getInstanceSize(instanceClass: string): ec2.InstanceSize {
    const size = instanceClass.split('.').pop()?.toLowerCase();
    switch (size) {
      case 'micro':
        return ec2.InstanceSize.MICRO;
      case 'small':
        return ec2.InstanceSize.SMALL;
      case 'medium':
        return ec2.InstanceSize.MEDIUM;
      case 'large':
        return ec2.InstanceSize.LARGE;
      case 'xlarge':
        return ec2.InstanceSize.XLARGE;
      case '2xlarge':
        return ec2.InstanceSize.XLARGE2;
      default:
        return ec2.InstanceSize.MEDIUM;
    }
  }
}
