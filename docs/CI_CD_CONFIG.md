# CI/CD Configuration

## GitHub Actions Workflow

### `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

env:
  NODE_VERSION: '22'
  PNPM_VERSION: '9'

jobs:
  # ============================================
  # Build and Test
  # ============================================
  build:
    name: Build & Test
    runs-on: ubuntu-latest

    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: dms_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Generate Prisma client
        run: pnpm db:generate

      - name: Type check
        run: pnpm type-check

      - name: Lint
        run: pnpm lint
        continue-on-error: true  # TODO: Fix ESLint v9 migration

      - name: Build
        run: pnpm build

      - name: Run unit tests
        run: pnpm test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/dms_test
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: test-secret-key-for-ci
          NODE_ENV: test

  # ============================================
  # E2E Tests
  # ============================================
  e2e:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: build

    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: dms_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      minio:
        image: minio/minio
        ports:
          - 9000:9000
        env:
          MINIO_ROOT_USER: minioadmin
          MINIO_ROOT_PASSWORD: minioadmin
        options: >-
          --health-cmd "curl -f http://localhost:9000/minio/health/live"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Generate Prisma client
        run: pnpm db:generate

      - name: Run migrations
        run: pnpm db:migrate
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/dms_test

      - name: Seed database
        run: pnpm db:seed
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/dms_test

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests
        run: pnpm --filter @dms/web test:e2e --project=chromium
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/dms_test
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: test-secret-key-for-ci
          S3_ENDPOINT: http://localhost:9000
          S3_BUCKET: dms-test
          S3_ACCESS_KEY: minioadmin
          S3_SECRET_KEY: minioadmin
          NODE_ENV: test
          CI: true

      - name: Upload Playwright report
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: apps/web/playwright-report/
          retention-days: 7

  # ============================================
  # Security Scan
  # ============================================
  security:
    name: Security Scan
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          severity: 'CRITICAL,HIGH'
          exit-code: '1'

      - name: Run SAST with Semgrep
        uses: returntocorp/semgrep-action@v1
        with:
          config: p/typescript

  # ============================================
  # Deploy to Staging
  # ============================================
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: [build, e2e, security]
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master'
    environment: staging

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Deploy to staging
        run: pnpm infra:deploy:staging
        env:
          CDK_DEFAULT_ACCOUNT: ${{ secrets.AWS_ACCOUNT_ID }}
          CDK_DEFAULT_REGION: us-east-1

  # ============================================
  # Deploy to Production (manual approval)
  # ============================================
  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: deploy-staging
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master'
    environment: production

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID_PROD }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY_PROD }}
          aws-region: us-east-1

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Deploy to production
        run: pnpm infra:deploy:prod
        env:
          CDK_DEFAULT_ACCOUNT: ${{ secrets.AWS_ACCOUNT_ID_PROD }}
          CDK_DEFAULT_REGION: us-east-1
```

---

## Branch Protection Rules

### Recommended Settings for `main`/`master`:

```yaml
# Branch protection rules
protection_rules:
  require_pull_request:
    required_approving_review_count: 1
    dismiss_stale_reviews: true
    require_code_owner_reviews: false

  require_status_checks:
    strict: true
    contexts:
      - "Build & Test"
      - "E2E Tests"
      - "Security Scan"

  require_conversation_resolution: true
  require_signed_commits: false
  allow_force_pushes: false
  allow_deletions: false
```

---

## Environment Secrets

### Required Secrets:

| Secret | Environment | Description |
|--------|-------------|-------------|
| `AWS_ACCESS_KEY_ID` | staging | AWS credentials for staging |
| `AWS_SECRET_ACCESS_KEY` | staging | AWS credentials for staging |
| `AWS_ACCOUNT_ID` | staging | AWS account ID for staging |
| `AWS_ACCESS_KEY_ID_PROD` | production | AWS credentials for production |
| `AWS_SECRET_ACCESS_KEY_PROD` | production | AWS credentials for production |
| `AWS_ACCOUNT_ID_PROD` | production | AWS account ID for production |

### Environment Variables (CDK):

```bash
# Staging
CDK_DEFAULT_ACCOUNT=123456789012
CDK_DEFAULT_REGION=us-east-1

# Production
CDK_DEFAULT_ACCOUNT=234567890123
CDK_DEFAULT_REGION=us-east-1
```

---

## Pipeline Flow Diagram

```mermaid
flowchart TD
    subgraph PR["Pull Request"]
        A[Push] --> B[Build & Test]
        B --> C[E2E Tests]
        C --> D[Security Scan]
        D --> E{All Passed?}
        E -->|Yes| F[Ready to Merge]
        E -->|No| G[Fix Issues]
        G --> A
    end

    subgraph Deploy["Main Branch"]
        F --> H[Auto Deploy Staging]
        H --> I[Manual Approval]
        I --> J[Deploy Production]
    end
```

---

## Monitoring Deployment

### CloudWatch Alarms (post-deployment):

```yaml
alarms:
  - name: APIErrorRate
    metric: 5xxErrorRate
    threshold: 1%
    period: 5m
    action: SNS notification

  - name: APILatency
    metric: P99Latency
    threshold: 1000ms
    period: 5m
    action: SNS notification

  - name: QueueDepth
    metric: ApproximateNumberOfMessagesVisible
    threshold: 1000
    period: 5m
    action: SNS notification
```

### Rollback Strategy:

1. **Automatic rollback** if health checks fail
2. **Manual rollback** via CDK: `pnpm infra:rollback`
3. **Database migrations** are backwards-compatible (no destructive changes)

---

## Cost Estimates

### CI/CD Infrastructure:

| Component | Monthly Cost |
|-----------|--------------|
| GitHub Actions (free tier) | $0 |
| GitHub Actions (paid) | ~$8/1000 min |
| AWS CodeBuild (alternative) | ~$0.005/min |

### Staging Environment:

| Component | Monthly Cost |
|-----------|--------------|
| ECS Fargate | ~$50 |
| RDS PostgreSQL (t3.micro) | ~$15 |
| ElastiCache (t3.micro) | ~$12 |
| S3 + CloudFront | ~$5 |
| **Total** | ~$82/month |

### Production Environment:

| Component | Monthly Cost |
|-----------|--------------|
| ECS Fargate (2x) | ~$150 |
| RDS PostgreSQL (t3.small) | ~$30 |
| ElastiCache (t3.small) | ~$25 |
| S3 + CloudFront | ~$20 |
| Route 53 | ~$5 |
| **Total** | ~$230/month |
