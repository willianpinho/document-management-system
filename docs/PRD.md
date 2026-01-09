# Product Requirements Document (PRD)
## Cloud-Based Document Management System (DMS)

**Version:** 1.2
**Author:** Willian Pinho
**Date:** January 2026
**Status:** Technical Assessment - CultureEngine

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Solution Overview](#3-solution-overview)
4. [Technology Stack](#4-technology-stack)
5. [System Architecture](#5-system-architecture)
6. [Development Process](#6-development-process)
7. [Cloud Infrastructure](#7-cloud-infrastructure)
8. [CI/CD & Infrastructure as Code](#8-cicd--infrastructure-as-code)
9. [Observability & Metrics](#9-observability--metrics)
10. [Authentication Strategy](#10-authentication-strategy)
11. [Database Design](#11-database-design)
12. [File Processing Architecture](#12-file-processing-architecture)
13. [API Design](#13-api-design)
14. [Security Considerations](#14-security-considerations)
15. [Scalability Strategy](#15-scalability-strategy)
16. [Testing Strategy](#16-testing-strategy)
17. [Project Structure](#17-project-structure)
18. [Project Timeline](#18-project-timeline)

---

## 1. Executive Summary

This document outlines the architecture and implementation strategy for a cloud-based Document Management System (DMS) similar to OneDrive/Google Drive, with enhanced document processing capabilities including PDF splitting and AI-based OCR.

### Key Differentiators
- **AI-Powered Processing**: Intelligent OCR, document classification, and content extraction
- **Rule-Based Transformations**: Project-specific file processing pipelines
- **Enterprise-Grade Security**: End-to-end encryption with SOC 2 compliance readiness
- **Scalable Architecture**: Designed to handle millions of documents and users

---

## 2. Problem Statement

Organizations need a secure, scalable solution to:
- Store and organize large volumes of documents in the cloud
- Process documents automatically (PDF manipulation, OCR, data extraction)
- Provide intuitive web-based access with modern UX
- Ensure data security and compliance with enterprise standards

---

## 3. Solution Overview

### Core Features

| Feature | Description | Priority |
|---------|-------------|----------|
| **Document Storage** | Secure cloud storage with versioning | P0 |
| **File Upload/Download** | Drag-and-drop, bulk operations, resumable uploads | P0 |
| **Folder Management** | Hierarchical organization, sharing, permissions | P0 |
| **Document Processing** | PDF split/merge, OCR, format conversion | P0 |
| **Search** | Full-text search with filters | P1 |
| **Collaboration** | Sharing, comments, real-time presence | P1 |
| **Audit Trail** | Complete activity logging | P1 |
| **API Access** | RESTful API for integrations | P1 |

### User Personas

1. **End User**: Uploads, organizes, and retrieves documents
2. **Admin**: Manages users, permissions, and system settings
3. **API Consumer**: Integrates DMS with external systems

---

## 4. Technology Stack

### Stack Selection Rationale

The technology choices align with modern SaaS best practices and the team's expertise:

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
├─────────────────────────────────────────────────────────────────┤
│  Next.js 16.1 (App Router)                                      │
│  ├── React Server Components (RSC)                              │
│  ├── Server Actions for mutations                               │
│  ├── TypeScript 5.9 (strict mode) - 7.0 preview available       │
│  ├── Tailwind CSS 4.1 + shadcn/ui                               │
│  ├── Turbopack (10-14x faster dev builds)                       │
│  └── TanStack Query for client state                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        BACKEND                                   │
├─────────────────────────────────────────────────────────────────┤
│  NestJS 11+                                                     │
│  ├── TypeScript (shared types with frontend)                    │
│  ├── Prisma ORM 7.x (TypeScript-native, 70% faster type check)  │
│  ├── Bull MQ for job queues                                     │
│  └── OpenAPI/Swagger documentation                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                  │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL 18 (RDS) - with Async I/O support                   │
│  ├── Primary database for metadata                              │
│  ├── pgvector for semantic search                               │
│  └── Row-level security for multi-tenancy                       │
│                                                                 │
│  Redis (ElastiCache)                                            │
│  ├── Session storage                                            │
│  ├── Rate limiting                                              │
│  └── Real-time pub/sub                                          │
│                                                                 │
│  S3 + CloudFront                                                │
│  ├── Document storage                                           │
│  └── CDN for static assets                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   AI/ML SERVICES                                 │
├─────────────────────────────────────────────────────────────────┤
│  AWS Textract (OCR)                                             │
│  OpenAI GPT-4 / AWS Bedrock (document understanding)            │
│  LangChain / Mastra (agentic workflows)                         │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Justification

| Technology | Version | Why Chosen | Alternatives Considered |
|------------|---------|-----------|------------------------|
| **Next.js** | 16.1 | RSC, Server Actions, Turbopack (10-14x faster), MCP integration | Remix, Nuxt |
| **NestJS** | 11+ | Enterprise patterns, JSON logging, improved microservice transporters | Express, Fastify |
| **PostgreSQL** | 18 | ACID, pgvector for AI search, Async I/O for concurrent tasks | MySQL, MongoDB |
| **TypeScript** | 5.9 | Type safety, 7.0 preview with 10x faster compile times | JavaScript |
| **Prisma** | 7.x | TypeScript-native client, 70% faster type checking, no Rust dependency | TypeORM, Drizzle |
| **Tailwind CSS** | 4.1 | 5x faster builds, 100x faster incremental, zero config | CSS Modules, Styled |
| **AWS CDK** | v2 | TypeScript IaC, high-level constructs, split CLI/lib releases | Terraform, Pulumi |

---

## 5. System Architecture

### High-Level Architecture Diagram

```
                                    ┌──────────────────┐
                                    │   CloudFront     │
                                    │   (CDN + WAF)    │
                                    └────────┬─────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
                    ▼                        ▼                        ▼
           ┌───────────────┐       ┌───────────────┐       ┌───────────────┐
           │   Next.js     │       │   NestJS      │       │   S3 Direct   │
           │   Frontend    │       │   API         │       │   Upload      │
           │   (Vercel/ECS)│       │   (ECS)       │       │   (Presigned) │
           └───────┬───────┘       └───────┬───────┘       └───────────────┘
                   │                       │
                   │                       │
                   │              ┌────────┴────────┐
                   │              │                 │
                   ▼              ▼                 ▼
           ┌───────────────────────────┐  ┌───────────────┐
           │      PostgreSQL           │  │    Redis      │
           │      (RDS Multi-AZ)       │  │  (ElastiCache)│
           └───────────────────────────┘  └───────────────┘

                   ┌─────────────────────────────────────┐
                   │         FILE PROCESSING PIPELINE     │
                   ├─────────────────────────────────────┤
                   │                                     │
                   │  S3 Event ──► SQS ──► Lambda/ECS   │
                   │                         │          │
                   │              ┌──────────┴───────┐  │
                   │              ▼                  ▼  │
                   │         ┌─────────┐      ┌────────┐│
                   │         │ Textract│      │  GPT-4 ││
                   │         │  (OCR)  │      │ Analysis││
                   │         └─────────┘      └────────┘│
                   └─────────────────────────────────────┘
```

### Component Breakdown

#### Frontend (Next.js 16.1)
```typescript
// App structure following Next.js 16.1 App Router with Turbopack
app/
├── (auth)/
│   ├── login/
│   └── register/
├── (dashboard)/
│   ├── documents/
│   │   ├── [id]/
│   │   │   └── page.tsx        // Document detail with RSC
│   │   └── page.tsx            // Document list
│   ├── folders/
│   └── settings/
├── api/                        // API routes for BFF pattern
└── layout.tsx                  // Root layout with providers
```

#### Backend (NestJS)
```typescript
// Module structure
src/
├── modules/
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── strategies/         // JWT, OAuth
│   │   └── guards/
│   ├── documents/
│   │   ├── documents.controller.ts
│   │   ├── documents.service.ts
│   │   ├── dto/
│   │   └── entities/
│   ├── storage/
│   │   ├── storage.service.ts  // S3 operations
│   │   └── upload.controller.ts
│   ├── processing/
│   │   ├── processing.service.ts
│   │   ├── processors/
│   │   │   ├── ocr.processor.ts
│   │   │   ├── pdf.processor.ts
│   │   │   └── ai.processor.ts
│   │   └── queues/
│   └── search/
├── common/
│   ├── filters/
│   ├── interceptors/
│   └── decorators/
└── config/
```

---

## 6. Development Process

### AI-Assisted Development Workflow

Leveraging AI tools to accelerate development while maintaining code quality:

```
┌─────────────────────────────────────────────────────────────────┐
│                   AI-POWERED DEVELOPMENT FLOW                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. PLANNING                                                    │
│     └── Claude/GPT for architecture decisions & PRDs            │
│                                                                 │
│  2. CODING                                                      │
│     ├── Cursor IDE with AI autocomplete                         │
│     ├── GitHub Copilot for boilerplate                          │
│     └── Claude Code for complex implementations                 │
│                                                                 │
│  3. REVIEW                                                      │
│     ├── AI-assisted code review                                 │
│     └── Automated PR descriptions                               │
│                                                                 │
│  4. TESTING                                                     │
│     ├── AI-generated test cases                                 │
│     └── Edge case identification                                │
│                                                                 │
│  5. DOCUMENTATION                                               │
│     └── Auto-generated API docs & comments                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Development Principles

1. **Type Safety First**: Shared TypeScript types between frontend and backend
2. **Test-Driven Development**: Unit tests before implementation
3. **Trunk-Based Development**: Short-lived feature branches
4. **Continuous Integration**: Every commit triggers CI pipeline
5. **Code Review Culture**: All changes require peer review

### Tooling

| Category | Tool | Purpose |
|----------|------|---------|
| IDE | Cursor | AI-assisted coding |
| Version Control | GitHub | Source control + Actions |
| Project Management | Linear/Notion | Sprint planning |
| Communication | Slack | Daily standups |
| Design | Figma | UI/UX collaboration |
| API Testing | Postman/Insomnia | API development |

---

## 7. Cloud Infrastructure

### AWS Services Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         AWS CLOUD                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  COMPUTE                          STORAGE                       │
│  ├── ECS Fargate (API)            ├── S3 (Documents)            │
│  ├── Lambda (Processing)          ├── S3 (Static Assets)        │
│  └── Vercel (Frontend)*           └── EFS (Shared Storage)      │
│                                                                 │
│  DATABASE                         NETWORKING                    │
│  ├── RDS PostgreSQL               ├── VPC (Multi-AZ)            │
│  ├── ElastiCache Redis            ├── ALB (Load Balancer)       │
│  └── OpenSearch (Full-text)       └── CloudFront (CDN)          │
│                                                                 │
│  AI/ML                            SECURITY                      │
│  ├── Textract (OCR)               ├── WAF                       │
│  ├── Bedrock (LLMs)               ├── KMS (Encryption)          │
│  └── Comprehend (NLP)             └── Secrets Manager           │
│                                                                 │
│  MESSAGING                        MONITORING                    │
│  ├── SQS (Job Queues)             ├── CloudWatch                │
│  ├── SNS (Notifications)          ├── X-Ray (Tracing)           │
│  └── EventBridge                  └── CloudWatch Logs           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
* Frontend can also be deployed to ECS if Vercel is not preferred
```

### Multi-AZ Deployment

```
                    Region: us-east-1
    ┌────────────────────────────────────────────┐
    │                                            │
    │   AZ-1 (us-east-1a)    AZ-2 (us-east-1b)  │
    │   ┌──────────────┐     ┌──────────────┐   │
    │   │  ECS Tasks   │     │  ECS Tasks   │   │
    │   │  (API)       │     │  (API)       │   │
    │   └──────────────┘     └──────────────┘   │
    │          │                    │           │
    │          └────────┬───────────┘           │
    │                   │                       │
    │          ┌────────▼────────┐              │
    │          │  RDS Primary    │──────────┐   │
    │          │  (Multi-AZ)     │          │   │
    │          └─────────────────┘          │   │
    │                                       │   │
    │          ┌─────────────────┐          │   │
    │          │  RDS Standby    │◄─────────┘   │
    │          │  (Auto-failover)│              │
    │          └─────────────────┘              │
    │                                            │
    └────────────────────────────────────────────┘
```

---

## 8. CI/CD & Infrastructure as Code

### GitHub Actions Pipeline

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  # ============================================
  # CONTINUOUS INTEGRATION
  # ============================================
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint

  type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm type-check

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:18
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:coverage
      - uses: codecov/codecov-action@v3

  # ============================================
  # CONTINUOUS DEPLOYMENT
  # ============================================
  deploy-staging:
    needs: [lint, type-check, test]
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
      - run: pnpm cdk deploy --app "staging" --require-approval never

  deploy-production:
    needs: [lint, type-check, test]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
      - run: pnpm cdk deploy --app "production" --require-approval never
```

### AWS CDK v2 Infrastructure

```typescript
// infrastructure/lib/dms-stack.ts
// AWS CDK v2 with split CLI/Library releases (Feb 2025+)
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';

export class DMSStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC with public/private subnets across 2 AZs
    const vpc = new ec2.Vpc(this, 'DMS-VPC', {
      maxAzs: 2,
      natGateways: 1,
    });

    // RDS PostgreSQL 18 with Multi-AZ and Async I/O
    const database = new rds.DatabaseInstance(this, 'DMS-Database', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_18,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MEDIUM,
      ),
      vpc,
      multiAz: true,
      allocatedStorage: 100,
      storageEncrypted: true,
    });

    // S3 Bucket for documents
    const documentBucket = new s3.Bucket(this, 'DMS-Documents', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      lifecycleRules: [
        {
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(30),
            },
          ],
        },
      ],
    });

    // ECS Cluster for API
    const cluster = new ecs.Cluster(this, 'DMS-Cluster', {
      vpc,
      containerInsights: true,
    });

    // Fargate Service for API
    const apiService = new ecs_patterns.ApplicationLoadBalancedFargateService(
      this, 'DMS-API', {
        cluster,
        cpu: 512,
        memoryLimitMiB: 1024,
        desiredCount: 2,
        taskImageOptions: {
          image: ecs.ContainerImage.fromAsset('../apps/api'),
          environment: {
            DATABASE_URL: database.instanceEndpoint.socketAddress,
            S3_BUCKET: documentBucket.bucketName,
          },
        },
      },
    );

    // Auto-scaling
    const scaling = apiService.service.autoScaleTaskCount({
      minCapacity: 2,
      maxCapacity: 10,
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
    });
  }
}
```

### Infrastructure Directory Structure

```
infrastructure/
├── bin/
│   └── dms.ts                    # CDK app entry point
├── lib/
│   ├── stacks/
│   │   ├── network-stack.ts      # VPC, subnets, security groups
│   │   ├── database-stack.ts     # RDS, ElastiCache
│   │   ├── storage-stack.ts      # S3, CloudFront
│   │   ├── compute-stack.ts      # ECS, Lambda
│   │   └── monitoring-stack.ts   # CloudWatch, alarms
│   └── constructs/
│       ├── api-service.ts        # Reusable API construct
│       └── processing-pipeline.ts
├── cdk.json
└── package.json
```

---

## 9. Observability & Metrics

### Monitoring Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    OBSERVABILITY STACK                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  METRICS (CloudWatch + Custom)                                  │
│  ├── Infrastructure: CPU, Memory, Disk, Network                 │
│  ├── Application: Request rate, Latency, Error rate             │
│  ├── Business: Uploads/day, Storage used, Active users          │
│  └── SLIs: Availability, Latency P99, Error budget              │
│                                                                 │
│  LOGGING (CloudWatch Logs + OpenSearch)                         │
│  ├── Structured JSON logs                                       │
│  ├── Request correlation IDs                                    │
│  ├── Log levels: ERROR, WARN, INFO, DEBUG                       │
│  └── Log retention: 30 days hot, 1 year archive                 │
│                                                                 │
│  TRACING (AWS X-Ray)                                            │
│  ├── Distributed tracing across services                        │
│  ├── Service map visualization                                  │
│  └── Latency analysis and bottleneck detection                  │
│                                                                 │
│  ALERTING (CloudWatch Alarms + PagerDuty/Slack)                 │
│  ├── P1: Service down, Error rate > 5%                          │
│  ├── P2: Latency P99 > 2s, Disk > 80%                           │
│  └── P3: Warning thresholds, capacity planning                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Metrics & SLIs

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| **Availability** | 99.9% | < 99.5% |
| **API Latency (P99)** | < 500ms | > 1000ms |
| **Upload Success Rate** | > 99% | < 98% |
| **Processing Queue Depth** | < 1000 | > 5000 |
| **Error Rate** | < 0.1% | > 1% |
| **Database Connections** | < 80% pool | > 90% pool |

### Structured Logging

```typescript
// NestJS Logger Configuration
@Injectable()
export class LoggerService {
  private logger = new Logger();

  log(message: string, context: LogContext) {
    this.logger.log({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message,
      correlationId: context.correlationId,
      userId: context.userId,
      service: 'dms-api',
      environment: process.env.NODE_ENV,
      ...context.metadata,
    });
  }
}
```

### Dashboard Example

```
┌────────────────────────────────────────────────────────────────────┐
│                      DMS Operations Dashboard                       │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────┐│
│  │ Availability │  │  Requests/s  │  │  Latency P99 │  │ Errors  ││
│  │    99.98%    │  │    1,234     │  │    245ms     │  │  0.02%  ││
│  │      ▲       │  │      ▼       │  │      ─       │  │    ▼    ││
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────┘│
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    Request Latency (24h)                     │  │
│  │  ms                                                          │  │
│  │  500│                                                        │  │
│  │  400│                                                        │  │
│  │  300│    ╭─────╮                     ╭────╮                  │  │
│  │  200│───╯     ╰─────────────────────╯    ╰───────────        │  │
│  │  100│                                                        │  │
│  │    0└────────────────────────────────────────────────────    │  │
│  │      00:00    06:00    12:00    18:00    24:00               │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 10. Authentication Strategy

### Multi-Layer Authentication

```
┌─────────────────────────────────────────────────────────────────┐
│                   AUTHENTICATION FLOW                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  WEB APPLICATION                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  User ──► NextAuth.js ──► OAuth 2.0 / OIDC             │   │
│  │              │                                          │   │
│  │              ├── Google OAuth                           │   │
│  │              ├── Microsoft Azure AD                     │   │
│  │              └── Email/Password (Credentials)           │   │
│  │                                                         │   │
│  │  Session Storage: JWT in HTTP-only cookies              │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  API AUTHENTICATION                                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  Client ──► Bearer Token ──► JWT Validation             │   │
│  │              │                                          │   │
│  │              ├── Access Token (15 min TTL)              │   │
│  │              └── Refresh Token (7 day TTL, rotation)    │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  UPLOAD AGENT (Machine-to-Machine)                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  Agent ──► API Key + Secret ──► HMAC Signature          │   │
│  │              │                                          │   │
│  │              ├── Scoped permissions                     │   │
│  │              ├── Rate limiting per key                  │   │
│  │              └── Audit logging                          │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation

```typescript
// apps/api/src/modules/auth/auth.module.ts
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
      inject: [ConfigService],
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    ApiKeyStrategy,
    LocalStrategy,
  ],
  controllers: [AuthController],
})
export class AuthModule {}

// JWT Strategy
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private userService: UserService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    const user = await this.userService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
```

### Authorization (RBAC)

```typescript
// Role-based access control
enum Role {
  VIEWER = 'viewer',
  EDITOR = 'editor',
  ADMIN = 'admin',
  OWNER = 'owner',
}

// Permission matrix
const permissions = {
  'document:read': [Role.VIEWER, Role.EDITOR, Role.ADMIN, Role.OWNER],
  'document:write': [Role.EDITOR, Role.ADMIN, Role.OWNER],
  'document:delete': [Role.ADMIN, Role.OWNER],
  'settings:manage': [Role.OWNER],
  'users:manage': [Role.ADMIN, Role.OWNER],
};

// Guard decorator
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.EDITOR)
@Post('documents')
async createDocument(@Body() dto: CreateDocumentDto) {
  // ...
}
```

---

## 11. Database Design

### PostgreSQL Schema

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    avatar_url TEXT,
    provider VARCHAR(50),
    provider_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organizations (multi-tenancy)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    plan VARCHAR(50) DEFAULT 'free',
    storage_quota_bytes BIGINT DEFAULT 5368709120, -- 5GB
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization members
CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'viewer',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- Folders
CREATE TABLE folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    path TEXT NOT NULL, -- Materialized path for efficient queries
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documents
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    s3_key TEXT NOT NULL,
    s3_version_id TEXT,
    checksum VARCHAR(64), -- SHA-256
    status VARCHAR(50) DEFAULT 'uploaded',
    processing_status VARCHAR(50) DEFAULT 'pending',
    metadata JSONB DEFAULT '{}',
    content_vector vector(1536), -- For semantic search
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document versions
CREATE TABLE document_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    s3_key TEXT NOT NULL,
    s3_version_id TEXT,
    size_bytes BIGINT NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_id, version_number)
);

-- Processing jobs
CREATE TABLE processing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    job_type VARCHAR(50) NOT NULL, -- 'ocr', 'pdf_split', 'thumbnail'
    status VARCHAR(50) DEFAULT 'pending',
    input_params JSONB DEFAULT '{}',
    output_data JSONB DEFAULT '{}',
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_documents_organization ON documents(organization_id);
CREATE INDEX idx_documents_folder ON documents(folder_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_content_vector ON documents
    USING ivfflat (content_vector vector_cosine_ops);
CREATE INDEX idx_folders_organization ON folders(organization_id);
CREATE INDEX idx_folders_parent ON folders(parent_id);
CREATE INDEX idx_folders_path ON folders USING GIN (path gin_trgm_ops);
CREATE INDEX idx_audit_logs_organization ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- Row Level Security
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY documents_org_isolation ON documents
    USING (organization_id = current_setting('app.current_organization')::UUID);

CREATE POLICY folders_org_isolation ON folders
    USING (organization_id = current_setting('app.current_organization')::UUID);
```

### Prisma Schema

```prisma
// prisma/schema.prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [uuid_ossp(map: "uuid-ossp"), pgvector]
}

model User {
  id              String   @id @default(uuid())
  email           String   @unique
  name            String?
  avatarUrl       String?
  provider        String?
  providerId      String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  memberships     OrganizationMember[]
  documents       Document[]
  folders         Folder[]
  auditLogs       AuditLog[]
}

model Organization {
  id                String   @id @default(uuid())
  name              String
  slug              String   @unique
  plan              String   @default("free")
  storageQuotaBytes BigInt   @default(5368709120)
  createdAt         DateTime @default(now())

  members           OrganizationMember[]
  folders           Folder[]
  documents         Document[]
  auditLogs         AuditLog[]
}

model Document {
  id                String   @id @default(uuid())
  organizationId    String
  folderId          String?
  name              String
  mimeType          String
  sizeBytes         BigInt
  s3Key             String
  s3VersionId       String?
  checksum          String?
  status            String   @default("uploaded")
  processingStatus  String   @default("pending")
  metadata          Json     @default("{}")
  createdById       String
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  organization      Organization @relation(fields: [organizationId], references: [id])
  folder            Folder?      @relation(fields: [folderId], references: [id])
  createdBy         User         @relation(fields: [createdById], references: [id])
  versions          DocumentVersion[]
  processingJobs    ProcessingJob[]

  @@index([organizationId])
  @@index([folderId])
  @@index([status])
}
```

---

## 12. File Processing Architecture

### Event-Driven Processing Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                   FILE PROCESSING PIPELINE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. UPLOAD                                                      │
│     ┌──────────┐    ┌──────────┐    ┌──────────┐               │
│     │  Client  │───►│  API     │───►│   S3     │               │
│     │  Upload  │    │  Presign │    │  Upload  │               │
│     └──────────┘    └──────────┘    └────┬─────┘               │
│                                          │                      │
│  2. EVENT TRIGGER                        ▼                      │
│     ┌──────────────────────────────────────────────┐           │
│     │  S3 Event Notification ──► EventBridge       │           │
│     └──────────────────────────────────────────────┘           │
│                           │                                     │
│  3. ROUTING               ▼                                     │
│     ┌──────────────────────────────────────────────┐           │
│     │  EventBridge Rules                           │           │
│     │  ├── PDF files ──► PDF Processing Queue      │           │
│     │  ├── Images ──► Image Processing Queue       │           │
│     │  └── All files ──► Metadata Extraction Queue │           │
│     └──────────────────────────────────────────────┘           │
│                           │                                     │
│  4. PROCESSING            ▼                                     │
│     ┌─────────────────────────────────────────────────────┐    │
│     │                   SQS Queues                         │    │
│     │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │    │
│     │  │  OCR Queue  │  │  PDF Queue  │  │ Thumb Queue │  │    │
│     │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  │    │
│     │         │                │                │         │    │
│     │         ▼                ▼                ▼         │    │
│     │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │    │
│     │  │   Lambda    │  │   Lambda    │  │   Lambda    │  │    │
│     │  │   (Textract)│  │   (pdf-lib) │  │   (Sharp)   │  │    │
│     │  └─────────────┘  └─────────────┘  └─────────────┘  │    │
│     └─────────────────────────────────────────────────────┘    │
│                           │                                     │
│  5. COMPLETION            ▼                                     │
│     ┌──────────────────────────────────────────────┐           │
│     │  Update DB ──► Notify WebSocket ──► Index    │           │
│     └──────────────────────────────────────────────┘           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Processing Job Types

```typescript
// apps/api/src/modules/processing/processors/

// OCR Processor
@Processor('ocr')
export class OcrProcessor {
  constructor(
    private textractService: TextractService,
    private documentService: DocumentService,
  ) {}

  @Process()
  async process(job: Job<OcrJobData>) {
    const { documentId, s3Key } = job.data;

    // Start Textract analysis
    const result = await this.textractService.analyzeDocument({
      DocumentLocation: {
        S3Object: {
          Bucket: process.env.S3_BUCKET,
          Name: s3Key,
        },
      },
      FeatureTypes: ['TABLES', 'FORMS'],
    });

    // Extract text and structure
    const extractedText = this.parseTextractResult(result);

    // Update document with OCR data
    await this.documentService.updateProcessingResult(documentId, {
      ocrText: extractedText.text,
      ocrTables: extractedText.tables,
      ocrForms: extractedText.forms,
    });

    // Generate embeddings for semantic search
    const embedding = await this.embeddingService.generate(extractedText.text);
    await this.documentService.updateEmbedding(documentId, embedding);
  }
}

// PDF Split Processor
@Processor('pdf-split')
export class PdfSplitProcessor {
  @Process()
  async process(job: Job<PdfSplitJobData>) {
    const { documentId, s3Key, splitRules } = job.data;

    // Download PDF
    const pdfBuffer = await this.s3Service.getObject(s3Key);
    const pdfDoc = await PDFDocument.load(pdfBuffer);

    // Split based on rules
    const splitDocuments = await this.splitByRules(pdfDoc, splitRules);

    // Upload split documents
    for (const [index, doc] of splitDocuments.entries()) {
      const bytes = await doc.save();
      const newKey = `${s3Key.replace('.pdf', '')}_part_${index + 1}.pdf`;
      await this.s3Service.putObject(newKey, bytes);

      // Create new document record
      await this.documentService.create({
        parentId: documentId,
        s3Key: newKey,
        name: `Part ${index + 1}`,
      });
    }
  }
}
```

### AI-Powered Document Understanding

```typescript
// Integration with LangChain for advanced processing
import { ChatOpenAI } from '@langchain/openai';
import { StructuredOutputParser } from 'langchain/output_parsers';

@Injectable()
export class AIDocumentProcessor {
  private llm = new ChatOpenAI({
    modelName: 'gpt-4-turbo-preview',
    temperature: 0,
  });

  async classifyDocument(text: string): Promise<DocumentClassification> {
    const parser = StructuredOutputParser.fromZodSchema(
      z.object({
        category: z.enum(['invoice', 'contract', 'report', 'letter', 'other']),
        confidence: z.number(),
        entities: z.array(z.object({
          type: z.string(),
          value: z.string(),
        })),
        summary: z.string(),
      })
    );

    const result = await this.llm.invoke([
      {
        role: 'system',
        content: `Classify the following document and extract key entities.
                  ${parser.getFormatInstructions()}`,
      },
      {
        role: 'user',
        content: text,
      },
    ]);

    return parser.parse(result.content);
  }
}
```

---

## 13. API Design

### RESTful API Endpoints

```yaml
openapi: 3.0.3
info:
  title: DMS API
  version: 1.0.0

paths:
  # Authentication
  /auth/login:
    post:
      summary: Login with credentials
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                email: { type: string }
                password: { type: string }
      responses:
        200:
          description: JWT tokens
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthTokens'

  /auth/refresh:
    post:
      summary: Refresh access token

  # Documents
  /documents:
    get:
      summary: List documents
      parameters:
        - name: folderId
          in: query
          schema: { type: string }
        - name: search
          in: query
          schema: { type: string }
        - name: page
          in: query
          schema: { type: integer, default: 1 }
        - name: limit
          in: query
          schema: { type: integer, default: 20 }
      responses:
        200:
          description: Paginated document list

    post:
      summary: Create document (get presigned URL)
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                name: { type: string }
                mimeType: { type: string }
                sizeBytes: { type: integer }
                folderId: { type: string }
      responses:
        201:
          description: Document created with upload URL
          content:
            application/json:
              schema:
                type: object
                properties:
                  document:
                    $ref: '#/components/schemas/Document'
                  uploadUrl: { type: string }

  /documents/{id}:
    get:
      summary: Get document details
    patch:
      summary: Update document
    delete:
      summary: Delete document

  /documents/{id}/download:
    get:
      summary: Get download URL
      responses:
        200:
          content:
            application/json:
              schema:
                type: object
                properties:
                  url: { type: string }
                  expiresIn: { type: integer }

  /documents/{id}/process:
    post:
      summary: Trigger document processing
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                type:
                  type: string
                  enum: [ocr, pdf_split, thumbnail, ai_classify]
                options: { type: object }

  # Folders
  /folders:
    get:
      summary: List folders
    post:
      summary: Create folder

  /folders/{id}:
    get:
      summary: Get folder with contents
    patch:
      summary: Update folder
    delete:
      summary: Delete folder

  # Search
  /search:
    get:
      summary: Full-text search
      parameters:
        - name: q
          in: query
          required: true
          schema: { type: string }
        - name: type
          in: query
          schema:
            type: string
            enum: [all, documents, folders]

  /search/semantic:
    post:
      summary: Semantic search using AI embeddings
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                query: { type: string }
                limit: { type: integer, default: 10 }

components:
  schemas:
    Document:
      type: object
      properties:
        id: { type: string, format: uuid }
        name: { type: string }
        mimeType: { type: string }
        sizeBytes: { type: integer }
        status: { type: string }
        processingStatus: { type: string }
        createdAt: { type: string, format: date-time }
        updatedAt: { type: string, format: date-time }
```

---

## 14. Security Considerations

### Security Measures

| Layer | Measure | Implementation |
|-------|---------|----------------|
| **Network** | WAF | AWS WAF with managed rules |
| **Network** | DDoS Protection | AWS Shield Standard |
| **Transport** | TLS 1.3 | CloudFront + ALB |
| **Authentication** | JWT + Refresh | Short-lived access tokens |
| **Authorization** | RBAC | Role-based permissions |
| **Data at Rest** | AES-256 | S3 + RDS encryption |
| **Data in Transit** | TLS | All internal communication |
| **Secrets** | Secrets Manager | No hardcoded credentials |
| **Input Validation** | Zod/class-validator | Strict schema validation |
| **File Validation** | Content-Type check | Magic bytes verification |
| **Rate Limiting** | Redis-based | Per-user and per-IP |
| **Audit** | Complete logging | All actions logged |

### Content Security

```typescript
// File upload validation
@Injectable()
export class FileValidationService {
  private allowedMimeTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];

  async validateFile(file: Buffer, declaredMimeType: string): Promise<boolean> {
    // Check magic bytes
    const fileType = await fileTypeFromBuffer(file);

    if (!fileType || fileType.mime !== declaredMimeType) {
      throw new BadRequestException('Invalid file type');
    }

    if (!this.allowedMimeTypes.includes(fileType.mime)) {
      throw new BadRequestException('File type not allowed');
    }

    // Scan for malware (ClamAV or AWS)
    await this.scanForMalware(file);

    return true;
  }
}
```

---

## 15. Scalability Strategy

### Horizontal Scaling

```
┌─────────────────────────────────────────────────────────────────┐
│                    SCALABILITY ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  FRONTEND (Vercel/CloudFront)                                   │
│  ├── Global CDN with edge caching                               │
│  ├── Automatic scaling with Vercel                              │
│  └── Static asset optimization                                  │
│                                                                 │
│  API LAYER (ECS Fargate)                                        │
│  ├── Auto-scaling: 2-10 tasks based on CPU/Memory               │
│  ├── Target tracking: 70% CPU utilization                       │
│  └── Graceful shutdown for zero-downtime deployments            │
│                                                                 │
│  DATABASE (RDS PostgreSQL)                                      │
│  ├── Vertical scaling: r6g.large → r6g.2xlarge                  │
│  ├── Read replicas for read-heavy workloads                     │
│  └── Connection pooling with PgBouncer                          │
│                                                                 │
│  STORAGE (S3)                                                   │
│  ├── Unlimited scaling by design                                │
│  ├── Intelligent-Tiering for cost optimization                  │
│  └── Multi-part upload for large files                          │
│                                                                 │
│  PROCESSING (Lambda + SQS)                                      │
│  ├── Auto-scaling based on queue depth                          │
│  ├── Reserved concurrency for predictable performance           │
│  └── Dead-letter queues for failed jobs                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Performance Optimizations

1. **Caching Strategy**
   - Redis for session and API response caching
   - CloudFront for static assets (1-year cache)
   - Database query caching with Redis

2. **Database Optimizations**
   - Connection pooling (max 100 connections)
   - Read replicas for search queries
   - Proper indexing strategy
   - Query optimization with EXPLAIN ANALYZE

3. **File Upload Optimization**
   - Presigned URLs for direct S3 upload
   - Multipart upload for files > 100MB
   - Client-side chunking with resumable uploads

---

## 16. Testing Strategy

### Test Pyramid

```
                    ┌─────────────┐
                    │    E2E      │  10%
                    │  (Cypress)  │
                    ├─────────────┤
                    │ Integration │  20%
                    │   (Jest)    │
                    ├─────────────┤
                    │    Unit     │  70%
                    │   (Vitest)  │
                    └─────────────┘
```

### Testing Framework Selection

| Layer | Tool | Purpose |
|-------|------|---------|
| **Unit Tests** | Vitest | Fast, TypeScript-native, ESM support |
| **Integration** | Jest + Supertest | API endpoint testing |
| **E2E** | Playwright | Cross-browser UI testing |
| **Component** | Testing Library | React component testing |
| **API Contract** | Pact | Consumer-driven contracts |
| **Load Testing** | k6 | Performance and stress testing |

### Test Coverage Requirements

| Area | Minimum Coverage | Target |
|------|------------------|--------|
| Business Logic | 90% | 95% |
| API Endpoints | 85% | 90% |
| UI Components | 80% | 85% |
| Utils/Helpers | 95% | 100% |

### Testing Patterns

```typescript
// Unit Test Example (Vitest)
// apps/api/src/modules/documents/__tests__/documents.service.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DocumentsService } from '../documents.service';
import { PrismaService } from '@/common/prisma/prisma.service';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let prisma: PrismaService;

  beforeEach(() => {
    prisma = {
      document: {
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    } as unknown as PrismaService;

    service = new DocumentsService(prisma);
  });

  describe('create', () => {
    it('should create a document with correct metadata', async () => {
      const input = {
        name: 'test.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        organizationId: 'org-123',
      };

      prisma.document.create = vi.fn().mockResolvedValue({
        id: 'doc-123',
        ...input,
        createdAt: new Date(),
      });

      const result = await service.create(input);

      expect(result.id).toBe('doc-123');
      expect(prisma.document.create).toHaveBeenCalledWith({
        data: expect.objectContaining(input),
      });
    });
  });
});

// E2E Test Example (Playwright)
// apps/web/e2e/documents.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Document Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/documents');
  });

  test('should upload a document', async ({ page }) => {
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('[data-testid="upload-button"]');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles('./fixtures/test-document.pdf');

    await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible();
    await expect(page.locator('[data-testid="document-list"]'))
      .toContainText('test-document.pdf');
  });
});
```

### Continuous Testing Pipeline

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:unit --coverage
      - uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:18
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
      redis:
        image: redis:7
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps
      - run: pnpm test:e2e
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## 17. Project Structure

### Monorepo Architecture

```
document-management-system/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # CI pipeline
│       ├── cd-staging.yml            # Staging deployment
│       └── cd-production.yml         # Production deployment
│
├── apps/
│   ├── web/                          # Next.js 16.1 Frontend
│   │   ├── src/
│   │   │   ├── app/                  # App Router pages
│   │   │   │   ├── (auth)/
│   │   │   │   │   ├── login/
│   │   │   │   │   └── register/
│   │   │   │   ├── (dashboard)/
│   │   │   │   │   ├── documents/
│   │   │   │   │   ├── folders/
│   │   │   │   │   └── settings/
│   │   │   │   ├── api/              # API routes (BFF)
│   │   │   │   ├── layout.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── components/
│   │   │   │   ├── ui/               # shadcn/ui components
│   │   │   │   ├── documents/
│   │   │   │   ├── folders/
│   │   │   │   └── layout/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   └── styles/
│   │   ├── e2e/                      # Playwright tests
│   │   ├── public/
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   │
│   ├── api/                          # NestJS 11+ Backend
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   │   ├── auth.controller.ts
│   │   │   │   │   ├── auth.service.ts
│   │   │   │   │   ├── strategies/
│   │   │   │   │   ├── guards/
│   │   │   │   │   └── dto/
│   │   │   │   ├── documents/
│   │   │   │   │   ├── documents.controller.ts
│   │   │   │   │   ├── documents.service.ts
│   │   │   │   │   ├── dto/
│   │   │   │   │   └── entities/
│   │   │   │   ├── folders/
│   │   │   │   ├── storage/
│   │   │   │   ├── processing/
│   │   │   │   │   ├── processors/
│   │   │   │   │   │   ├── ocr.processor.ts
│   │   │   │   │   │   ├── pdf.processor.ts
│   │   │   │   │   │   └── ai.processor.ts
│   │   │   │   │   └── queues/
│   │   │   │   ├── search/
│   │   │   │   └── users/
│   │   │   ├── common/
│   │   │   │   ├── decorators/
│   │   │   │   ├── filters/
│   │   │   │   ├── guards/
│   │   │   │   ├── interceptors/
│   │   │   │   └── prisma/
│   │   │   ├── config/
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   ├── test/
│   │   │   ├── unit/
│   │   │   └── integration/
│   │   ├── nest-cli.json
│   │   └── package.json
│   │
│   └── upload-agent/                 # Desktop Upload Agent
│       ├── src/
│       │   ├── main.ts               # Electron main process
│       │   ├── watcher/              # File system watcher
│       │   ├── uploader/             # Upload queue manager
│       │   └── auth/                 # API key authentication
│       └── package.json
│
├── packages/
│   ├── shared/                       # Shared TypeScript types
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   ├── document.ts
│   │   │   │   ├── folder.ts
│   │   │   │   ├── user.ts
│   │   │   │   └── api.ts
│   │   │   ├── schemas/              # Zod schemas
│   │   │   │   ├── document.schema.ts
│   │   │   │   └── folder.schema.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── ui/                           # Shared UI components
│   │   ├── src/
│   │   │   ├── components/
│   │   │   └── styles/
│   │   └── package.json
│   │
│   └── config/                       # Shared configurations
│       ├── eslint/
│       ├── typescript/
│       └── tailwind/
│
├── infrastructure/                   # AWS CDK v2
│   ├── bin/
│   │   └── dms.ts
│   ├── lib/
│   │   ├── stacks/
│   │   │   ├── network-stack.ts
│   │   │   ├── database-stack.ts
│   │   │   ├── storage-stack.ts
│   │   │   ├── compute-stack.ts
│   │   │   └── monitoring-stack.ts
│   │   └── constructs/
│   ├── cdk.json
│   └── package.json
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
│
├── scripts/
│   ├── setup.sh                      # Initial setup
│   ├── dev.sh                        # Development startup
│   └── migrate.sh                    # Database migrations
│
├── docs/
│   ├── PRD.md                        # This document
│   ├── API.md                        # API documentation
│   ├── ARCHITECTURE.md               # Architecture details
│   └── RUNBOOK.md                    # Operations runbook
│
├── .env.example
├── .gitignore
├── docker-compose.yml                # Local development
├── pnpm-workspace.yaml
├── turbo.json                        # Turborepo config
├── package.json
├── CLAUDE.md                         # Claude Code configuration
└── README.md
```

### Workspace Configuration

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'infrastructure'
```

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "type-check": {
      "dependsOn": ["^build"],
      "outputs": []
    }
  }
}
```

### Environment Configuration

```bash
# .env.example

# Application
NODE_ENV=development
APP_URL=http://localhost:3000
API_URL=http://localhost:4000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dms

# Redis
REDIS_URL=redis://localhost:6379

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET=dms-documents-dev
S3_REGION=us-east-1

# Authentication
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# OAuth (Google)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# OAuth (Microsoft)
AZURE_AD_CLIENT_ID=
AZURE_AD_CLIENT_SECRET=
AZURE_AD_TENANT_ID=

# AI Services
OPENAI_API_KEY=
AWS_TEXTRACT_REGION=us-east-1

# Monitoring
SENTRY_DSN=
DATADOG_API_KEY=

# Upload Agent
UPLOAD_AGENT_API_KEY=
UPLOAD_AGENT_API_SECRET=
```

### Scripts

```json
// package.json (root)
{
  "name": "document-management-system",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "test": "turbo test",
    "test:unit": "turbo test:unit",
    "test:integration": "turbo test:integration",
    "test:e2e": "turbo test:e2e",
    "lint": "turbo lint",
    "type-check": "turbo type-check",
    "format": "prettier --write \"**/*.{ts,tsx,md}\"",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate",
    "db:seed": "prisma db seed",
    "db:studio": "prisma studio",
    "infra:deploy:staging": "cd infrastructure && pnpm cdk deploy --app staging",
    "infra:deploy:prod": "cd infrastructure && pnpm cdk deploy --app production",
    "clean": "turbo clean && rm -rf node_modules"
  },
  "devDependencies": {
    "turbo": "^2.3.0",
    "prettier": "^3.4.0",
    "@types/node": "^22.0.0",
    "typescript": "^5.9.0"
  },
  "packageManager": "pnpm@9.15.0",
  "engines": {
    "node": ">=22.0.0"
  }
}
```

---

## 18. Project Timeline

### Phase 1: Foundation (Weeks 1-2)
- [ ] Project setup (monorepo, CI/CD)
- [ ] Infrastructure provisioning (CDK)
- [ ] Authentication system
- [ ] Basic document CRUD

### Phase 2: Core Features (Weeks 3-4)
- [ ] File upload/download
- [ ] Folder management
- [ ] Basic search
- [ ] User permissions

### Phase 3: Processing (Weeks 5-6)
- [ ] OCR integration
- [ ] PDF processing
- [ ] Thumbnail generation
- [ ] Processing queue

### Phase 4: Polish (Weeks 7-8)
- [ ] Semantic search
- [ ] Real-time updates
- [ ] Audit logging
- [ ] Performance optimization

---

## Appendix A: Technology Decisions Summary

| Decision | Choice | Version | Rationale |
|----------|--------|---------|-----------|
| Frontend Framework | Next.js | 16.1 | RSC, Server Actions, Turbopack (10-14x faster), MCP integration |
| Backend Framework | NestJS | 11+ | Enterprise patterns, JSON logging, improved transporters |
| Database | PostgreSQL | 18 | ACID, pgvector, Async I/O for concurrent operations |
| ORM | Prisma | 7.x | TypeScript-native, 70% faster type checking |
| Styling | Tailwind CSS | 4.1 | 5x faster builds, 100x faster incremental |
| Language | TypeScript | 5.9 | Strict types, 7.0 preview available (10x compile speed) |
| Cloud Provider | AWS | - | Comprehensive services, CDK for IaC |
| IaC Tool | AWS CDK | v2 | TypeScript, split CLI/lib releases (Feb 2025) |
| CI/CD | GitHub Actions | - | Native integration, marketplace |
| Container Orchestration | ECS Fargate | - | Serverless containers, simple |
| File Storage | S3 | - | Infinite scale, cost-effective |
| Search | PostgreSQL + pgvector | - | Unified stack, semantic search |
| Queue | SQS + Lambda | - | Serverless, auto-scaling |
| Monitoring | CloudWatch + X-Ray | - | Native AWS integration |

---

## Appendix B: Cost Estimation (Monthly)

| Service | Configuration | Estimated Cost |
|---------|--------------|----------------|
| ECS Fargate | 2 tasks, 0.5 vCPU, 1GB | $30 |
| RDS PostgreSQL | db.t3.medium, Multi-AZ | $100 |
| S3 | 100GB storage | $2.30 |
| CloudFront | 100GB transfer | $8.50 |
| Lambda | 1M invocations | $0.20 |
| ElastiCache | cache.t3.micro | $12 |
| **Total** | | **~$150/month** |

*Note: Costs scale with usage. Production with higher traffic would be $500-2000/month.*

---

**Document Version History**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Jan 2026 | Willian Pinho | Initial PRD |
| 1.1 | Jan 2026 | Willian Pinho | Updated to latest versions: Next.js 16.1, NestJS 11, PostgreSQL 18, Prisma 7.x, Tailwind CSS 4.1, TypeScript 5.9, AWS CDK v2 |
| 1.2 | Jan 2026 | Willian Pinho | Added Testing Strategy (Section 16), Project Structure with monorepo architecture (Section 17), environment configuration, and workspace setup |
