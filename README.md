# Document Management System (DMS)

Cloud-based Document Management System with AI-powered document processing.

## Features

- **Document Storage**: Secure cloud storage with versioning on S3
- **Document Processing**: PDF split/merge, OCR (AWS Textract), AI classification
- **Web UI**: Modern React-based interface with drag-and-drop uploads
- **Multi-tenancy**: Organization-based data isolation with RBAC
- **Semantic Search**: AI-powered document search using pgvector

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16.1 (App Router) |
| Backend | NestJS 11+ |
| Database | PostgreSQL 18 + pgvector |
| Cache | Redis 7 |
| Storage | AWS S3 + CloudFront |
| IaC | AWS CDK v2 |

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 9+
- Docker & Docker Compose

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd document-management-system

# Run setup script
./scripts/setup.sh
```

### Development

```bash
# Start all services
pnpm dev

# Start specific app
pnpm --filter @dms/web dev
pnpm --filter @dms/api dev
```

### Available Endpoints

| Service | URL |
|---------|-----|
| Web | http://localhost:3000 |
| API | http://localhost:4000 |
| Swagger | http://localhost:4000/api/docs |
| MinIO Console | http://localhost:9001 |
| MailHog | http://localhost:8025 |

## Project Structure

```
document-management-system/
├── apps/
│   ├── web/           # Next.js 16.1 Frontend
│   ├── api/           # NestJS 11+ Backend
│   └── upload-agent/  # Desktop Upload Agent
├── packages/
│   ├── shared/        # Shared TypeScript types
│   ├── ui/            # Shared UI components
│   └── config/        # Shared configurations
├── infrastructure/    # AWS CDK v2
├── prisma/            # Database schema
└── scripts/           # Development scripts
```

## Scripts

```bash
# Development
pnpm dev              # Start all apps
pnpm build            # Build all apps
pnpm test             # Run all tests
pnpm lint             # Lint all code
pnpm type-check       # TypeScript check

# Database
pnpm db:migrate       # Run migrations
pnpm db:generate      # Generate Prisma client
pnpm db:seed          # Seed database
pnpm db:studio        # Open Prisma Studio

# Infrastructure
pnpm infra:deploy:staging   # Deploy to staging
pnpm infra:deploy:prod      # Deploy to production
```

## License

Private - All rights reserved.
