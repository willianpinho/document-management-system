#!/usr/bin/env node
/**
 * DMS Infrastructure Entry Point
 *
 * Creates all stacks for the Document Management System.
 * Usage:
 *   cdk deploy --all -c environment=staging
 *   cdk deploy --all -c environment=production
 */

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/stacks/network-stack';
import { DatabaseStack } from '../lib/stacks/database-stack';
import { StorageStack } from '../lib/stacks/storage-stack';
import { ComputeStack } from '../lib/stacks/compute-stack';
import { MonitoringStack } from '../lib/stacks/monitoring-stack';
import { getConfig, getTags, type Environment } from '../lib/config';

const app = new cdk.App();

// Get environment from context
const environment =
  (app.node.tryGetContext("environment") as Environment) ?? "staging";

// Validate environment
if (!["staging", "production"].includes(environment)) {
  throw new Error(
    `Invalid environment: ${environment}. Must be 'staging' or 'production'.`,
  );
}

// Get configuration for the environment
const config = getConfig(environment);

// Common stack props
const commonProps: cdk.StackProps = {
  env: {
    account: config.account,
    region: config.region,
  },
  tags: getTags(config),
};

// Stack name prefix
const prefix = `DMS-${environment.charAt(0).toUpperCase() + environment.slice(1)}`;

// Create Network Stack
const networkStack = new NetworkStack(app, `${prefix}-Network`, {
  ...commonProps,
  config,
  description: `DMS Network Infrastructure (${environment})`,
});

// Create Database Stack
const databaseStack = new DatabaseStack(app, `${prefix}-Database`, {
  ...commonProps,
  config,
  vpc: networkStack.vpc,
  securityGroups: {
    database: networkStack.databaseSecurityGroup,
    cache: networkStack.cacheSecurityGroup,
  },
  description: `DMS Database Infrastructure (${environment})`,
});
databaseStack.addDependency(networkStack);

// Create Storage Stack
const storageStack = new StorageStack(app, `${prefix}-Storage`, {
  ...commonProps,
  config,
  description: `DMS Storage Infrastructure (${environment})`,
});

// Create Compute Stack
const computeStack = new ComputeStack(app, `${prefix}-Compute`, {
  ...commonProps,
  config,
  vpc: networkStack.vpc,
  albSecurityGroup: networkStack.albSecurityGroup,
  apiSecurityGroup: networkStack.apiSecurityGroup,
  documentsBucket: storageStack.documentsBucket,
  databaseSecret: databaseStack.databaseSecret,
  cacheCluster: databaseStack.cacheCluster,
  description: `DMS Compute Infrastructure (${environment})`,
});
computeStack.addDependency(networkStack);
computeStack.addDependency(databaseStack);
computeStack.addDependency(storageStack);

// Create Monitoring Stack
const monitoringStack = new MonitoringStack(app, `${prefix}-Monitoring`, {
  ...commonProps,
  config,
  ecsCluster: computeStack.cluster,
  ecsService: computeStack.apiService,
  loadBalancer: computeStack.loadBalancer,
  databaseInstance: databaseStack.databaseInstance,
  cacheCluster: databaseStack.cacheCluster,
  documentsBucket: storageStack.documentsBucket,
  description: `DMS Monitoring Infrastructure (${environment})`,
});
monitoringStack.addDependency(computeStack);

app.synth();
