/**
 * DMS Infrastructure Configuration
 *
 * Environment-specific configuration for staging and production deployments.
 */

export type Environment = "staging" | "production";

export interface EnvironmentConfig {
  readonly environment: Environment;
  readonly account: string;
  readonly region: string;

  // VPC Configuration
  readonly vpc: {
    readonly maxAzs: number;
    readonly natGateways: number;
  };

  // Database Configuration
  readonly database: {
    readonly instanceClass: string;
    readonly allocatedStorage: number;
    readonly maxAllocatedStorage: number;
    readonly multiAz: boolean;
    readonly deletionProtection: boolean;
    readonly backupRetention: number;
  };

  // Cache Configuration
  readonly cache: {
    readonly nodeType: string;
    readonly numCacheNodes: number;
  };

  // ECS Configuration
  readonly ecs: {
    readonly cpu: number;
    readonly memoryMiB: number;
    readonly desiredCount: number;
    readonly minCapacity: number;
    readonly maxCapacity: number;
    readonly targetCpuUtilization: number;
  };

  // Storage Configuration
  readonly storage: {
    readonly intelligentTieringDays: number;
    readonly glacierDays: number;
    readonly deleteAfterDays: number;
  };

  // Domain Configuration (optional)
  readonly domain?: {
    readonly certificateArn: string;
    readonly hostedZoneId: string;
    readonly zoneName: string;
    readonly apiSubdomain: string;
    readonly cdnSubdomain: string;
  };

  // Monitoring Configuration
  readonly monitoring: {
    readonly alertEmail?: string;
    readonly slackWebhookUrl?: string;
    readonly enableDetailedMonitoring: boolean;
  };
}

/**
 * Get configuration for the specified environment
 */
export function getConfig(environment: Environment): EnvironmentConfig {
  const account =
    process.env.CDK_DEFAULT_ACCOUNT ?? process.env.AWS_ACCOUNT_ID ?? "";
  const region =
    process.env.CDK_DEFAULT_REGION ?? process.env.AWS_REGION ?? "us-east-1";

  const baseConfig = {
    account,
    region,
  };

  switch (environment) {
    case "staging":
      return {
        ...baseConfig,
        environment: "staging",

        vpc: {
          maxAzs: 2,
          natGateways: 1, // Cost optimization for staging
        },

        database: {
          instanceClass: "db.t3.medium",
          allocatedStorage: 50,
          maxAllocatedStorage: 100,
          multiAz: false, // Single AZ for staging
          deletionProtection: false,
          backupRetention: 7,
        },

        cache: {
          nodeType: "cache.t3.micro",
          numCacheNodes: 1,
        },

        ecs: {
          cpu: 256,
          memoryMiB: 512,
          desiredCount: 1,
          minCapacity: 1,
          maxCapacity: 4,
          targetCpuUtilization: 70,
        },

        storage: {
          intelligentTieringDays: 30,
          glacierDays: 90,
          deleteAfterDays: 365,
        },

        monitoring: {
          alertEmail: process.env.ALERT_EMAIL,
          enableDetailedMonitoring: false,
        },
      };

    case "production":
      return {
        ...baseConfig,
        environment: "production",

        vpc: {
          maxAzs: 2,
          natGateways: 2, // High availability
        },

        database: {
          instanceClass: "db.t3.medium",
          allocatedStorage: 100,
          maxAllocatedStorage: 500,
          multiAz: true,
          deletionProtection: true,
          backupRetention: 30,
        },

        cache: {
          nodeType: "cache.t3.small",
          numCacheNodes: 2,
        },

        ecs: {
          cpu: 512,
          memoryMiB: 1024,
          desiredCount: 2,
          minCapacity: 2,
          maxCapacity: 10,
          targetCpuUtilization: 70,
        },

        storage: {
          intelligentTieringDays: 30,
          glacierDays: 180,
          deleteAfterDays: 730, // 2 years
        },

        monitoring: {
          alertEmail: process.env.ALERT_EMAIL,
          slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
          enableDetailedMonitoring: true,
        },
      };

    default:
      throw new Error(`Unknown environment: ${environment}`);
  }
}

/**
 * Generate resource name with environment prefix
 */
export function resourceName(config: EnvironmentConfig, name: string): string {
  return `dms-${config.environment}-${name}`;
}

/**
 * Generate tags for resources
 */
export function getTags(config: EnvironmentConfig): Record<string, string> {
  return {
    Project: "document-management-system",
    Environment: config.environment,
    ManagedBy: "cdk",
  };
}
