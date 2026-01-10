# Document Management System (DMS)

> Cloud-based Document Management System with AI-powered document processing
>
> **Status:** Technical Assessment - CultureEngine
> **Author:** Willian Pinho

---

## Project Overview

This is a cloud-based Document Management System similar to OneDrive/Google Drive, with enhanced document processing capabilities including PDF splitting and AI-based OCR.

### Key Features

#### Core Features
- **Document Storage**: Secure cloud storage with versioning on AWS S3
- **Document Processing**: PDF split/merge, OCR (AWS Textract), AI classification
- **Semantic Search**: AI-powered document search using pgvector embeddings
- **Multi-tenancy**: Organization-based data isolation with Row-Level Security

#### Collaboration
- **Real-time Presence**: See who's viewing documents in real-time via WebSocket
- **Comments & Discussions**: Threaded comments with @mentions
- **Document Sharing**: Share documents with granular permissions
- **Version History**: Track all document changes with version control

#### User Experience
- **Modern Web UI**: Next.js 15 with App Router and React 19
- **Drag-and-Drop Uploads**: Intuitive file upload with progress tracking
- **Resumable Uploads**: Large file uploads with automatic resume
- **Bulk Operations**: Select and manage multiple documents at once
- **Desktop Upload Agent**: Electron app for automated folder syncing

#### Security & Auth
- **OAuth Integration**: Google and Microsoft SSO support
- **Email/Password Auth**: Traditional authentication with password reset flow
- **RBAC**: Role-based access control (Viewer, Editor, Admin, Owner)
- **API Keys**: Machine-to-machine authentication for integrations

---

## Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Frontend** | Next.js (App Router) | 15.5 |
| **UI Components** | shadcn/ui + Radix | Latest |
| **Backend** | NestJS | 11+ |
| **Database** | PostgreSQL + pgvector | 16+ |
| **ORM** | Prisma | 5.22 |
| **Cache** | Redis | 7+ |
| **Queue** | BullMQ | 5+ |
| **Storage** | AWS S3 + CloudFront | - |
| **Real-time** | Socket.IO | 4.8 |
| **AI/ML** | AWS Textract, OpenAI GPT-4 | - |
| **IaC** | AWS CDK v2 | 2.175 |
| **Language** | TypeScript | 5.9 |
| **Styling** | Tailwind CSS | 3.4 |
| **Package Manager** | pnpm | 9+ |

---

## Project Structure

```
document-management-system/
├── apps/
│   ├── web/                    # Next.js 15 Frontend
│   ├── api/                    # NestJS 11+ Backend
│   └── upload-agent/           # Desktop Upload Agent (Electron)
├── packages/
│   ├── shared/                 # Shared TypeScript types & Zod schemas
│   ├── ui/                     # Shared UI components
│   └── config/                 # Shared configurations
├── infrastructure/             # AWS CDK v2 stacks
├── prisma/                     # Database schema & migrations
├── scripts/                    # Development scripts
└── docs/                       # Documentation
```

---

## Development Commands

```bash
# Install dependencies
pnpm install

# Start development (all apps)
pnpm dev

# Start specific app
pnpm --filter @dms/web dev
pnpm --filter @dms/api dev

# Build all apps
pnpm build

# Run tests
pnpm test              # All tests
pnpm test:unit         # Unit tests only
pnpm test:integration  # Integration tests
pnpm test:e2e          # E2E tests (Playwright)

# Code quality
pnpm lint              # ESLint
pnpm type-check        # TypeScript
pnpm format            # Prettier

# Database
pnpm db:migrate        # Run migrations
pnpm db:generate       # Generate Prisma client
pnpm db:seed           # Seed database
pnpm db:studio         # Open Prisma Studio

# Infrastructure
pnpm infra:deploy:staging    # Deploy to staging
pnpm infra:deploy:prod       # Deploy to production
```

---

## Architecture Patterns

### Backend (NestJS)

```
apps/api/src/
├── modules/           # Feature modules
│   ├── auth/          # Authentication (JWT, OAuth, API Keys)
│   ├── users/         # User management and profiles
│   ├── organizations/ # Multi-tenant organization management
│   ├── documents/     # Document CRUD and metadata
│   ├── folders/       # Hierarchical folder structure
│   ├── storage/       # S3 file operations and presigned URLs
│   ├── uploads/       # Chunked upload handling
│   ├── processing/    # Background job processing (OCR, thumbnails)
│   ├── search/        # Full-text and semantic search
│   ├── comments/      # Document comments and threads
│   ├── realtime/      # WebSocket events and presence
│   ├── audit/         # Activity logging and audit trail
│   └── email/         # Transactional email service
├── common/            # Shared utilities
│   ├── decorators/    # Custom decorators (@CurrentUser, etc.)
│   ├── filters/       # Exception filters
│   ├── guards/        # Auth guards (JWT, API Key, Roles)
│   └── interceptors/  # Request/response interceptors
└── config/            # Configuration modules
```

### Frontend (Next.js)

```
apps/web/src/
├── app/               # App Router pages
│   ├── (auth)/        # Auth routes (login, register, reset-password)
│   ├── (dashboard)/   # Protected routes
│   │   ├── documents/ # Document management
│   │   ├── folders/   # Folder management
│   │   └── settings/  # User settings (appearance, security, org)
│   └── auth/          # OAuth callback handlers
├── components/        # React components
│   ├── documents/     # Document components (detail, upload, share)
│   ├── comments/      # Comments and threads
│   ├── folders/       # Folder components
│   ├── search/        # Search components
│   └── layout/        # Layout components (header, sidebar)
├── hooks/             # Custom React hooks
│   ├── useDocuments   # Document operations
│   ├── usePresence    # Real-time presence
│   ├── useBulkSelection # Multi-select operations
│   └── useResumableUpload # Chunked uploads
└── lib/               # Utilities and helpers
```

---

## Database Schema

### Core Entities

- **users** - User accounts with OAuth support
- **organizations** - Multi-tenant organizations
- **organization_members** - User-organization relationships with roles
- **folders** - Hierarchical folder structure
- **documents** - Document metadata and S3 references
- **document_versions** - Version history
- **processing_jobs** - Background job tracking
- **audit_logs** - Complete activity logging

### Key Indexes

- `idx_documents_organization` - Tenant isolation
- `idx_documents_content_vector` - Semantic search (ivfflat)
- `idx_folders_path` - Path-based queries (GIN trigram)

### Row Level Security

Multi-tenant isolation enforced at database level:
```sql
CREATE POLICY documents_org_isolation ON documents
    USING (organization_id = current_setting('app.current_organization')::UUID);
```

---

## Authentication Strategy

### Web Application
- **NextAuth.js** with OAuth 2.0 / OIDC
- Providers: Google OAuth, Microsoft Azure AD, Email/Password
- Session: JWT in HTTP-only cookies

### API Authentication
- Bearer Token (JWT)
- Access Token: 15 min TTL
- Refresh Token: 7 day TTL with rotation

### Upload Agent (M2M)
- API Key + Secret with HMAC signature
- Scoped permissions per key
- Rate limiting per key

### Authorization (RBAC)
```typescript
enum Role {
  VIEWER = 'viewer',   // Read-only
  EDITOR = 'editor',   // Read + Write
  ADMIN = 'admin',     // Read + Write + Delete + User management
  OWNER = 'owner',     // Full access + Settings
}
```

---

## File Processing Pipeline

```
Upload → S3 Event → EventBridge → SQS → Lambda/ECS
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              ┌─────────┐    ┌─────────┐    ┌─────────┐
              │ Textract│    │ pdf-lib │    │  Sharp  │
              │  (OCR)  │    │ (Split) │    │ (Thumb) │
              └─────────┘    └─────────┘    └─────────┘
```

### Processing Job Types

| Job Type | Handler | Purpose |
|----------|---------|---------|
| `ocr` | Textract + GPT-4 | Extract text, tables, forms |
| `pdf_split` | pdf-lib | Split PDF by rules |
| `thumbnail` | Sharp | Generate previews |
| `ai_classify` | GPT-4 | Document classification |
| `embedding` | OpenAI | Generate semantic vectors |

---

## Testing Strategy

| Layer | Tool | Coverage Target |
|-------|------|-----------------|
| Unit | Vitest | 90% |
| Integration | Jest + Supertest | 85% |
| E2E | Playwright | Critical paths |
| API Contract | Pact | Consumer-driven |
| Load | k6 | Performance baselines |

### Running Tests

```bash
# Unit tests with coverage
pnpm test:unit --coverage

# Integration tests (requires Docker services)
docker compose up -d postgres redis
pnpm test:integration

# E2E tests
pnpm exec playwright install
pnpm test:e2e
```

---

## Environment Variables

See `.env.example` for full list. Key variables:

```bash
# Required
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
S3_BUCKET=...

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# AI Services
OPENAI_API_KEY=...
```

---

## API Endpoints

### Documents
- `GET /documents` - List documents (paginated)
- `POST /documents` - Create document (get presigned URL)
- `GET /documents/:id` - Get document details
- `PATCH /documents/:id` - Update document
- `DELETE /documents/:id` - Delete document
- `GET /documents/:id/download` - Get download URL
- `POST /documents/:id/process` - Trigger processing

### Folders
- `GET /folders` - List folders
- `POST /folders` - Create folder
- `GET /folders/:id` - Get folder with contents
- `PATCH /folders/:id` - Update folder
- `DELETE /folders/:id` - Delete folder

### Search
- `GET /search` - Full-text search
- `POST /search/semantic` - AI-powered semantic search

### Auth
- `POST /auth/login` - Login
- `POST /auth/refresh` - Refresh tokens
- `POST /auth/logout` - Logout

---

## Recommended Agents

### Core Development
- `@backend-architect` - API design, NestJS patterns
- `@frontend-developer` - React, Next.js components
- `@typescript-agent` - Type safety, advanced patterns

### Infrastructure
- `@cloud-architect` - AWS architecture decisions
- `@terraform-engineer` - CDK infrastructure (uses same patterns)
- `@devops-engineer` - CI/CD, deployments

### Quality & Security
- `@code-reviewer` - Code quality reviews
- `@security-auditor` - Security assessments
- `@test-automator` - Test coverage

### AI/ML
- `@ai-engineer` - AI integration patterns
- `@rag-specialist` - Semantic search optimization
- `@llm-integration` - GPT-4 usage patterns

### Database
- `@postgres-pro` - PostgreSQL optimization
- `@database-optimizer` - Query performance

---

## Key Files

| File | Purpose |
|------|---------|
| `docs/PRD.md` | Complete Product Requirements Document |
| `prisma/schema.prisma` | Database schema |
| `apps/api/src/app.module.ts` | NestJS root module |
| `apps/web/src/app/layout.tsx` | Next.js root layout |
| `infrastructure/lib/stacks/` | CDK infrastructure stacks |
| `turbo.json` | Monorepo build configuration |

---

## Development Workflow

### 1. Feature Development

```bash
# Create feature branch
git checkout -b feature/document-upload

# Start development
pnpm dev

# Make changes and test
pnpm test:unit
pnpm lint

# Commit with conventional commits
git commit -m "feat(documents): add drag-and-drop upload"
```

### 2. Code Review Checklist

- [ ] TypeScript strict mode passes
- [ ] Unit tests for new code
- [ ] API endpoints documented
- [ ] No security vulnerabilities
- [ ] Performance considered

### 3. Deployment

```bash
# Deploy to staging
git push origin feature/document-upload
# GitHub Actions triggers staging deployment

# After approval, merge to main
# GitHub Actions triggers production deployment
```

---

## Performance Targets

| Metric | Target | Alert |
|--------|--------|-------|
| API Latency (P99) | < 500ms | > 1000ms |
| Availability | 99.9% | < 99.5% |
| Upload Success Rate | > 99% | < 98% |
| Error Rate | < 0.1% | > 1% |

---

## Documentation

- **PRD**: `docs/PRD.md` - Full product requirements
- **API**: Auto-generated Swagger at `/api/docs`
- **Architecture**: `docs/ARCHITECTURE.md`
- **Runbook**: `docs/RUNBOOK.md` - Operations guide

---

## Quick Reference

### Local Development Setup

```bash
# 1. Clone and install
git clone <repo>
cd document-management-system
pnpm install

# 2. Start services
docker compose up -d

# 3. Setup database
pnpm db:migrate
pnpm db:seed

# 4. Start development
pnpm dev

# Web: http://localhost:3000
# API: http://localhost:4000
# Swagger: http://localhost:4000/api/docs
```

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 3000 in use | `lsof -i :3000` then `kill -9 <PID>` |
| Database connection | Check `docker compose ps` |
| Type errors | Run `pnpm db:generate` |
| Stale cache | Run `pnpm clean && pnpm install` |

---

**Last Updated:** January 2026
