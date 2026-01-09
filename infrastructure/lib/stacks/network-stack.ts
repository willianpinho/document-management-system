import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { type EnvironmentConfig, resourceName } from '../config';

export interface NetworkStackProps extends cdk.StackProps {
  readonly config: EnvironmentConfig;
}

/**
 * Network Stack
 *
 * Creates the VPC and network infrastructure:
 * - VPC with public and private subnets across 2 AZs
 * - NAT Gateway(s) for private subnet internet access
 * - Security groups for API, database, and cache
 * - VPC Flow Logs for network monitoring
 */
export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.IVpc;
  public readonly albSecurityGroup: ec2.ISecurityGroup;
  public readonly apiSecurityGroup: ec2.ISecurityGroup;
  public readonly databaseSecurityGroup: ec2.ISecurityGroup;
  public readonly cacheSecurityGroup: ec2.ISecurityGroup;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    const { config } = props;

    // Create VPC
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: resourceName(config, 'vpc'),
      maxAzs: config.vpc.maxAzs,
      natGateways: config.vpc.natGateways,

      // Subnet configuration
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
          mapPublicIpOnLaunch: false,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],

      // Enable DNS
      enableDnsHostnames: true,
      enableDnsSupport: true,

      // Restrict default security group
      restrictDefaultSecurityGroup: true,
    });

    // Enable VPC Flow Logs
    this.vpc.addFlowLog('FlowLog', {
      destination: ec2.FlowLogDestination.toCloudWatchLogs(),
      trafficType: ec2.FlowLogTrafficType.ALL,
    });

    // Create Security Groups
    this.albSecurityGroup = this.createAlbSecurityGroup(config);
    this.apiSecurityGroup = this.createApiSecurityGroup(config);
    this.databaseSecurityGroup = this.createDatabaseSecurityGroup(config);
    this.cacheSecurityGroup = this.createCacheSecurityGroup(config);

    // Configure security group rules
    this.configureApiAccess();
    this.configureDatabaseAccess();
    this.configureCacheAccess();

    // Outputs
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
      exportName: `${this.stackName}-VpcId`,
    });

    new cdk.CfnOutput(this, 'PrivateSubnets', {
      value: this.vpc.privateSubnets.map((s) => s.subnetId).join(','),
      description: 'Private Subnet IDs',
      exportName: `${this.stackName}-PrivateSubnets`,
    });

    new cdk.CfnOutput(this, 'PublicSubnets', {
      value: this.vpc.publicSubnets.map((s) => s.subnetId).join(','),
      description: 'Public Subnet IDs',
      exportName: `${this.stackName}-PublicSubnets`,
    });
  }

  /**
   * Create ALB Security Group
   * Allows inbound HTTP/HTTPS traffic from internet
   */
  private createAlbSecurityGroup(config: EnvironmentConfig): ec2.SecurityGroup {
    const sg = new ec2.SecurityGroup(this, 'AlbSecurityGroup', {
      vpc: this.vpc,
      securityGroupName: resourceName(config, 'alb-sg'),
      description: 'Security group for Application Load Balancer',
      allowAllOutbound: true,
    });

    // Allow inbound HTTP from anywhere
    sg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP traffic'
    );

    // Allow inbound HTTPS from anywhere
    sg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS traffic'
    );

    return sg;
  }

  /**
   * Create API Security Group
   * Only allows traffic from ALB security group
   */
  private createApiSecurityGroup(config: EnvironmentConfig): ec2.SecurityGroup {
    const sg = new ec2.SecurityGroup(this, 'ApiSecurityGroup', {
      vpc: this.vpc,
      securityGroupName: resourceName(config, 'api-sg'),
      description: 'Security group for API services',
      allowAllOutbound: true,
    });

    return sg;
  }

  /**
   * Create Database Security Group
   * Only allows traffic from API security group
   */
  private createDatabaseSecurityGroup(config: EnvironmentConfig): ec2.SecurityGroup {
    const sg = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc: this.vpc,
      securityGroupName: resourceName(config, 'database-sg'),
      description: 'Security group for PostgreSQL database',
      allowAllOutbound: false,
    });

    return sg;
  }

  /**
   * Create Cache Security Group
   * Only allows traffic from API security group
   */
  private createCacheSecurityGroup(config: EnvironmentConfig): ec2.SecurityGroup {
    const sg = new ec2.SecurityGroup(this, 'CacheSecurityGroup', {
      vpc: this.vpc,
      securityGroupName: resourceName(config, 'cache-sg'),
      description: 'Security group for Redis cache',
      allowAllOutbound: false,
    });

    return sg;
  }

  /**
   * Configure API security group to only accept traffic from ALB
   */
  private configureApiAccess(): void {
    this.apiSecurityGroup.addIngressRule(
      this.albSecurityGroup,
      ec2.Port.tcp(4000),
      'Allow API traffic from ALB'
    );
  }

  /**
   * Configure database security group to only accept traffic from API
   */
  private configureDatabaseAccess(): void {
    this.databaseSecurityGroup.addIngressRule(
      this.apiSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL from API'
    );
  }

  /**
   * Configure cache security group to only accept traffic from API
   */
  private configureCacheAccess(): void {
    this.cacheSecurityGroup.addIngressRule(
      this.apiSecurityGroup,
      ec2.Port.tcp(6379),
      'Allow Redis from API'
    );
  }
}
