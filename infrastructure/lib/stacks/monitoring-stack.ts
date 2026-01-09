import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { type EnvironmentConfig, resourceName } from '../config';

export interface MonitoringStackProps extends cdk.StackProps {
  readonly config: EnvironmentConfig;
  readonly ecsCluster: ecs.ICluster;
  readonly ecsService: ecs.FargateService;
  readonly loadBalancer: elbv2.ApplicationLoadBalancer;
  readonly databaseInstance: rds.IDatabaseInstance;
  readonly cacheCluster: elasticache.CfnCacheCluster;
  readonly documentsBucket: s3.IBucket;
}

/**
 * Monitoring Stack
 *
 * Creates the monitoring infrastructure:
 * - CloudWatch dashboards for system overview
 * - Alarms for critical metrics (CPU, Memory, Error rate, Latency)
 * - SNS topic for alert notifications
 * - Composite alarms for complex conditions
 */
export class MonitoringStack extends cdk.Stack {
  public readonly alertTopic: sns.ITopic;
  public readonly dashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const {
      config,
      ecsCluster,
      ecsService,
      loadBalancer,
      databaseInstance,
      cacheCluster,
      documentsBucket,
    } = props;

    // Create SNS Topic for Alerts
    this.alertTopic = new sns.Topic(this, 'AlertTopic', {
      topicName: resourceName(config, 'alerts'),
      displayName: `DMS Alerts (${config.environment})`,
    });

    // Add email subscription if configured
    if (config.monitoring.alertEmail) {
      this.alertTopic.addSubscription(
        new snsSubscriptions.EmailSubscription(config.monitoring.alertEmail)
      );
    }

    // Create SNS action for alarms
    const alarmAction = new cloudwatchActions.SnsAction(this.alertTopic);

    // ==========================================
    // ECS Alarms
    // ==========================================

    // CPU Utilization Alarm
    const cpuAlarm = new cloudwatch.Alarm(this, 'CpuHighAlarm', {
      alarmName: resourceName(config, 'ecs-cpu-high'),
      alarmDescription: 'ECS service CPU utilization is above 80%',
      metric: ecsService.metricCpuUtilization({
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      }),
      threshold: 80,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    cpuAlarm.addAlarmAction(alarmAction);
    cpuAlarm.addOkAction(alarmAction);

    // Memory Utilization Alarm
    const memoryAlarm = new cloudwatch.Alarm(this, 'MemoryHighAlarm', {
      alarmName: resourceName(config, 'ecs-memory-high'),
      alarmDescription: 'ECS service memory utilization is above 80%',
      metric: ecsService.metricMemoryUtilization({
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      }),
      threshold: 80,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    memoryAlarm.addAlarmAction(alarmAction);
    memoryAlarm.addOkAction(alarmAction);

    // Running Tasks Alarm (service health)
    const runningTasksAlarm = new cloudwatch.Alarm(this, 'RunningTasksLowAlarm', {
      alarmName: resourceName(config, 'ecs-running-tasks-low'),
      alarmDescription: 'ECS service has fewer running tasks than desired',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ECS',
        metricName: 'RunningTaskCount',
        dimensionsMap: {
          ClusterName: ecsCluster.clusterName,
          ServiceName: ecsService.serviceName,
        },
        period: cdk.Duration.minutes(1),
        statistic: 'Average',
      }),
      threshold: config.ecs.minCapacity,
      evaluationPeriods: 3,
      datapointsToAlarm: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    });
    runningTasksAlarm.addAlarmAction(alarmAction);
    runningTasksAlarm.addOkAction(alarmAction);

    // ==========================================
    // ALB Alarms
    // ==========================================

    // Error Rate Alarm (5xx errors)
    const errorRateAlarm = new cloudwatch.Alarm(this, 'ErrorRateHighAlarm', {
      alarmName: resourceName(config, 'alb-error-rate-high'),
      alarmDescription: 'ALB 5xx error rate is above 1%',
      metric: new cloudwatch.MathExpression({
        expression: '(errors / requests) * 100',
        usingMetrics: {
          errors: new cloudwatch.Metric({
            namespace: 'AWS/ApplicationELB',
            metricName: 'HTTPCode_ELB_5XX_Count',
            dimensionsMap: {
              LoadBalancer: loadBalancer.loadBalancerFullName,
            },
            period: cdk.Duration.minutes(5),
            statistic: 'Sum',
          }),
          requests: new cloudwatch.Metric({
            namespace: 'AWS/ApplicationELB',
            metricName: 'RequestCount',
            dimensionsMap: {
              LoadBalancer: loadBalancer.loadBalancerFullName,
            },
            period: cdk.Duration.minutes(5),
            statistic: 'Sum',
          }),
        },
        period: cdk.Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    errorRateAlarm.addAlarmAction(alarmAction);
    errorRateAlarm.addOkAction(alarmAction);

    // Latency Alarm (P99 > 1s)
    const latencyAlarm = new cloudwatch.Alarm(this, 'LatencyHighAlarm', {
      alarmName: resourceName(config, 'alb-latency-high'),
      alarmDescription: 'ALB P99 latency is above 1 second',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApplicationELB',
        metricName: 'TargetResponseTime',
        dimensionsMap: {
          LoadBalancer: loadBalancer.loadBalancerFullName,
        },
        period: cdk.Duration.minutes(5),
        statistic: 'p99',
      }),
      threshold: 1,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    latencyAlarm.addAlarmAction(alarmAction);
    latencyAlarm.addOkAction(alarmAction);

    // Unhealthy Hosts Alarm
    const unhealthyHostsAlarm = new cloudwatch.Alarm(this, 'UnhealthyHostsAlarm', {
      alarmName: resourceName(config, 'alb-unhealthy-hosts'),
      alarmDescription: 'ALB has unhealthy target hosts',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApplicationELB',
        metricName: 'UnHealthyHostCount',
        dimensionsMap: {
          LoadBalancer: loadBalancer.loadBalancerFullName,
        },
        period: cdk.Duration.minutes(1),
        statistic: 'Maximum',
      }),
      threshold: 0,
      evaluationPeriods: 3,
      datapointsToAlarm: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    unhealthyHostsAlarm.addAlarmAction(alarmAction);
    unhealthyHostsAlarm.addOkAction(alarmAction);

    // ==========================================
    // RDS Alarms
    // ==========================================

    // Database CPU Alarm
    const dbCpuAlarm = new cloudwatch.Alarm(this, 'DbCpuHighAlarm', {
      alarmName: resourceName(config, 'rds-cpu-high'),
      alarmDescription: 'RDS CPU utilization is above 80%',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/RDS',
        metricName: 'CPUUtilization',
        dimensionsMap: {
          DBInstanceIdentifier: databaseInstance.instanceIdentifier,
        },
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      }),
      threshold: 80,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    dbCpuAlarm.addAlarmAction(alarmAction);
    dbCpuAlarm.addOkAction(alarmAction);

    // Database Connections Alarm
    const dbConnectionsAlarm = new cloudwatch.Alarm(this, 'DbConnectionsHighAlarm', {
      alarmName: resourceName(config, 'rds-connections-high'),
      alarmDescription: 'RDS connection count is above 150',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/RDS',
        metricName: 'DatabaseConnections',
        dimensionsMap: {
          DBInstanceIdentifier: databaseInstance.instanceIdentifier,
        },
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      }),
      threshold: 150, // Based on max_connections: 200
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    dbConnectionsAlarm.addAlarmAction(alarmAction);
    dbConnectionsAlarm.addOkAction(alarmAction);

    // Database Free Storage Alarm
    const dbStorageAlarm = new cloudwatch.Alarm(this, 'DbStorageLowAlarm', {
      alarmName: resourceName(config, 'rds-storage-low'),
      alarmDescription: 'RDS free storage is below 10GB',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/RDS',
        metricName: 'FreeStorageSpace',
        dimensionsMap: {
          DBInstanceIdentifier: databaseInstance.instanceIdentifier,
        },
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      }),
      threshold: 10 * 1024 * 1024 * 1024, // 10 GB in bytes
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    dbStorageAlarm.addAlarmAction(alarmAction);
    dbStorageAlarm.addOkAction(alarmAction);

    // ==========================================
    // ElastiCache Alarms
    // ==========================================

    // Cache CPU Alarm
    const cacheCpuAlarm = new cloudwatch.Alarm(this, 'CacheCpuHighAlarm', {
      alarmName: resourceName(config, 'cache-cpu-high'),
      alarmDescription: 'ElastiCache CPU utilization is above 80%',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ElastiCache',
        metricName: 'CPUUtilization',
        dimensionsMap: {
          CacheClusterId: cacheCluster.ref,
        },
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      }),
      threshold: 80,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    cacheCpuAlarm.addAlarmAction(alarmAction);
    cacheCpuAlarm.addOkAction(alarmAction);

    // Cache Memory Alarm
    const cacheMemoryAlarm = new cloudwatch.Alarm(this, 'CacheMemoryHighAlarm', {
      alarmName: resourceName(config, 'cache-memory-high'),
      alarmDescription: 'ElastiCache memory usage is above 80%',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ElastiCache',
        metricName: 'DatabaseMemoryUsagePercentage',
        dimensionsMap: {
          CacheClusterId: cacheCluster.ref,
        },
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      }),
      threshold: 80,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    cacheMemoryAlarm.addAlarmAction(alarmAction);
    cacheMemoryAlarm.addOkAction(alarmAction);

    // ==========================================
    // Composite Alarms
    // ==========================================

    // Critical System Health Alarm
    const criticalHealthAlarm = new cloudwatch.CompositeAlarm(this, 'CriticalHealthAlarm', {
      compositeAlarmName: resourceName(config, 'critical-health'),
      alarmDescription: 'Critical system health - multiple components failing',
      alarmRule: cloudwatch.AlarmRule.anyOf(
        cloudwatch.AlarmRule.fromAlarm(runningTasksAlarm, cloudwatch.AlarmState.ALARM),
        cloudwatch.AlarmRule.fromAlarm(unhealthyHostsAlarm, cloudwatch.AlarmState.ALARM),
        cloudwatch.AlarmRule.allOf(
          cloudwatch.AlarmRule.fromAlarm(cpuAlarm, cloudwatch.AlarmState.ALARM),
          cloudwatch.AlarmRule.fromAlarm(memoryAlarm, cloudwatch.AlarmState.ALARM)
        )
      ),
    });
    criticalHealthAlarm.addAlarmAction(alarmAction);
    criticalHealthAlarm.addOkAction(alarmAction);

    // ==========================================
    // CloudWatch Dashboard
    // ==========================================

    this.dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: resourceName(config, 'dashboard'),
      periodOverride: cloudwatch.PeriodOverride.AUTO,
    });

    // Add header
    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: `# DMS Dashboard (${config.environment})\n\nDocument Management System monitoring dashboard`,
        width: 24,
        height: 1,
      })
    );

    // ECS Metrics Row
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'ECS CPU & Memory Utilization',
        left: [
          ecsService.metricCpuUtilization({ period: cdk.Duration.minutes(1) }),
          ecsService.metricMemoryUtilization({ period: cdk.Duration.minutes(1) }),
        ],
        leftYAxis: { min: 0, max: 100 },
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'ECS Task Count',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ECS',
            metricName: 'RunningTaskCount',
            dimensionsMap: {
              ClusterName: ecsCluster.clusterName,
              ServiceName: ecsService.serviceName,
            },
            period: cdk.Duration.minutes(1),
            statistic: 'Average',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/ECS',
            metricName: 'DesiredTaskCount',
            dimensionsMap: {
              ClusterName: ecsCluster.clusterName,
              ServiceName: ecsService.serviceName,
            },
            period: cdk.Duration.minutes(1),
            statistic: 'Average',
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    // ALB Metrics Row
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'ALB Request Count & Latency',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApplicationELB',
            metricName: 'RequestCount',
            dimensionsMap: {
              LoadBalancer: loadBalancer.loadBalancerFullName,
            },
            period: cdk.Duration.minutes(1),
            statistic: 'Sum',
          }),
        ],
        right: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApplicationELB',
            metricName: 'TargetResponseTime',
            dimensionsMap: {
              LoadBalancer: loadBalancer.loadBalancerFullName,
            },
            period: cdk.Duration.minutes(1),
            statistic: 'p99',
          }),
        ],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'ALB HTTP Status Codes',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApplicationELB',
            metricName: 'HTTPCode_Target_2XX_Count',
            dimensionsMap: {
              LoadBalancer: loadBalancer.loadBalancerFullName,
            },
            period: cdk.Duration.minutes(1),
            statistic: 'Sum',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/ApplicationELB',
            metricName: 'HTTPCode_Target_4XX_Count',
            dimensionsMap: {
              LoadBalancer: loadBalancer.loadBalancerFullName,
            },
            period: cdk.Duration.minutes(1),
            statistic: 'Sum',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/ApplicationELB',
            metricName: 'HTTPCode_Target_5XX_Count',
            dimensionsMap: {
              LoadBalancer: loadBalancer.loadBalancerFullName,
            },
            period: cdk.Duration.minutes(1),
            statistic: 'Sum',
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    // Database Metrics Row
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'RDS CPU & Connections',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/RDS',
            metricName: 'CPUUtilization',
            dimensionsMap: {
              DBInstanceIdentifier: databaseInstance.instanceIdentifier,
            },
            period: cdk.Duration.minutes(1),
            statistic: 'Average',
          }),
        ],
        right: [
          new cloudwatch.Metric({
            namespace: 'AWS/RDS',
            metricName: 'DatabaseConnections',
            dimensionsMap: {
              DBInstanceIdentifier: databaseInstance.instanceIdentifier,
            },
            period: cdk.Duration.minutes(1),
            statistic: 'Average',
          }),
        ],
        leftYAxis: { min: 0, max: 100 },
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'RDS IOPS & Storage',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/RDS',
            metricName: 'ReadIOPS',
            dimensionsMap: {
              DBInstanceIdentifier: databaseInstance.instanceIdentifier,
            },
            period: cdk.Duration.minutes(1),
            statistic: 'Average',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/RDS',
            metricName: 'WriteIOPS',
            dimensionsMap: {
              DBInstanceIdentifier: databaseInstance.instanceIdentifier,
            },
            period: cdk.Duration.minutes(1),
            statistic: 'Average',
          }),
        ],
        right: [
          new cloudwatch.Metric({
            namespace: 'AWS/RDS',
            metricName: 'FreeStorageSpace',
            dimensionsMap: {
              DBInstanceIdentifier: databaseInstance.instanceIdentifier,
            },
            period: cdk.Duration.minutes(1),
            statistic: 'Average',
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    // Cache Metrics Row
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'ElastiCache CPU & Memory',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ElastiCache',
            metricName: 'CPUUtilization',
            dimensionsMap: {
              CacheClusterId: cacheCluster.ref,
            },
            period: cdk.Duration.minutes(1),
            statistic: 'Average',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/ElastiCache',
            metricName: 'DatabaseMemoryUsagePercentage',
            dimensionsMap: {
              CacheClusterId: cacheCluster.ref,
            },
            period: cdk.Duration.minutes(1),
            statistic: 'Average',
          }),
        ],
        leftYAxis: { min: 0, max: 100 },
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'ElastiCache Hit Rate',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ElastiCache',
            metricName: 'CacheHits',
            dimensionsMap: {
              CacheClusterId: cacheCluster.ref,
            },
            period: cdk.Duration.minutes(1),
            statistic: 'Sum',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/ElastiCache',
            metricName: 'CacheMisses',
            dimensionsMap: {
              CacheClusterId: cacheCluster.ref,
            },
            period: cdk.Duration.minutes(1),
            statistic: 'Sum',
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    // S3 Metrics Row
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'S3 Bucket Size & Objects',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/S3',
            metricName: 'BucketSizeBytes',
            dimensionsMap: {
              BucketName: documentsBucket.bucketName,
              StorageType: 'StandardStorage',
            },
            period: cdk.Duration.days(1),
            statistic: 'Average',
          }),
        ],
        right: [
          new cloudwatch.Metric({
            namespace: 'AWS/S3',
            metricName: 'NumberOfObjects',
            dimensionsMap: {
              BucketName: documentsBucket.bucketName,
              StorageType: 'AllStorageTypes',
            },
            period: cdk.Duration.days(1),
            statistic: 'Average',
          }),
        ],
        width: 24,
        height: 6,
      })
    );

    // Alarm Status Widget
    this.dashboard.addWidgets(
      new cloudwatch.AlarmStatusWidget({
        title: 'Alarm Status',
        alarms: [
          cpuAlarm,
          memoryAlarm,
          errorRateAlarm,
          latencyAlarm,
          dbCpuAlarm,
          dbStorageAlarm,
          cacheCpuAlarm,
          cacheMemoryAlarm,
        ],
        width: 24,
        height: 3,
      })
    );

    // Outputs
    new cdk.CfnOutput(this, 'AlertTopicArn', {
      value: this.alertTopic.topicArn,
      description: 'SNS topic ARN for alerts',
      exportName: `${this.stackName}-AlertTopicArn`,
    });

    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${this.dashboard.dashboardName}`,
      description: 'CloudWatch dashboard URL',
      exportName: `${this.stackName}-DashboardUrl`,
    });
  }
}
