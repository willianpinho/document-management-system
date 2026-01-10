# Document Management System - Presentation

## Slide Deck Outline (15-minute presentation)

---

### Slide 1: Title

**Document Management System**
Cloud-based DMS with AI-powered Document Processing

*Willian Pinho - Technical Assessment*

---

### Slide 2: Problem Statement

**Challenge:** Design a cloud-based Document Management System

- Secure document storage (like OneDrive/Google Drive)
- Document processing (PDF splitting, AI-based OCR)
- Web UI for file management
- Scalable and cost-effective

---

### Slide 3: Solution Overview

**Key Capabilities:**

1. **Multi-tenant Architecture** - Organization-based isolation
2. **AI-powered Processing** - OCR, classification, semantic search
3. **Real-time Collaboration** - Presence, comments, sharing
4. **Enterprise Security** - OAuth, RBAC, encryption

---

### Slide 4: Technology Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | Next.js 15 | SSR, App Router, performance |
| Backend | NestJS 11 | TypeScript, modular, enterprise |
| Database | PostgreSQL + pgvector | ACID, vector search, mature |
| Queue | BullMQ + Redis | Reliable, Redis ecosystem |
| Storage | S3 + CloudFront | Scalable, cost-effective |
| IaC | AWS CDK | Type-safe, familiar TypeScript |

---

### Slide 5: Architecture Diagram

*[Show high-level architecture diagram]*

**Components:**
- Client Layer (Web, Desktop Agent, API)
- Load Balancer + CDN
- Compute (ECS Fargate)
- Data (PostgreSQL, Redis)
- Storage (S3)
- Processing Pipeline (SQS, Textract, OpenAI)

---

### Slide 6: Document Processing Pipeline

```
Upload → S3 → EventBridge → SQS → Worker
                                    ↓
                            ┌───────┼───────┐
                            ↓       ↓       ↓
                        Textract  pdf-lib  Sharp
                         (OCR)   (Split)  (Thumb)
                            ↓
                        OpenAI (Embeddings)
                            ↓
                        PostgreSQL (pgvector)
```

**Benefits:**
- Async processing (non-blocking uploads)
- Scalable workers (auto-scaling)
- Retry with dead-letter queue

---

### Slide 7: Authentication Strategy

**Three authentication methods:**

1. **Web Users** - OAuth 2.0 (Google, Microsoft) + Email/Password
2. **API Clients** - JWT Bearer tokens
3. **Upload Agent** - API Keys with HMAC signature

**Security:**
- JWT in HTTP-only cookies
- Token rotation
- Rate limiting per key

---

### Slide 8: Authorization (RBAC)

**Four roles:**

| Role | Permissions |
|------|-------------|
| Viewer | Read documents |
| Editor | Read + Write |
| Admin | Full CRUD + User management |
| Owner | Everything + Settings |

**Row-Level Security:**
- PostgreSQL RLS policies
- Tenant isolation at database level

---

### Slide 9: Semantic Search

**How it works:**

1. Document uploaded → Text extracted (Textract)
2. Text → Embeddings (OpenAI text-embedding-3-small)
3. Embeddings stored in pgvector
4. Search query → Query embedding → Cosine similarity

**Benefits:**
- Natural language queries
- Context-aware results
- No keyword matching required

---

### Slide 10: Scalability & Performance

**Horizontal Scaling:**
- ECS Fargate auto-scaling
- Read replicas for PostgreSQL
- Redis cluster mode

**Performance Targets:**
| Metric | Target |
|--------|--------|
| API Latency (P99) | < 500ms |
| Availability | 99.9% |
| Upload Success | > 99% |

---

### Slide 11: CI/CD Pipeline

```
Push → GitHub Actions → Build → Test → Deploy
                          ↓
              ┌───────────┼───────────┐
              ↓           ↓           ↓
           Staging    E2E Tests   Production
```

**Infrastructure as Code:**
- AWS CDK v2 (TypeScript)
- Separate stacks per concern
- Preview environments for PRs

---

### Slide 12: Observability

**Three Pillars:**

1. **Logs** - CloudWatch Logs, structured JSON
2. **Metrics** - CloudWatch Metrics, custom dashboards
3. **Traces** - X-Ray distributed tracing

**Alerts:**
- Error rate > 1%
- Latency P99 > 1s
- Queue depth > 1000

---

### Slide 13: Cost Optimization

**Design decisions for cost:**

- ECS Fargate Spot for workers (70% savings)
- S3 Intelligent Tiering (auto-archive)
- Reserved capacity for predictable load
- CloudFront caching (reduce S3 egress)

**Estimated monthly cost (1000 users):**
~$500-800/month

---

### Slide 14: Development Process

**AI-assisted workflow:**

1. **Planning** - Claude for architecture decisions
2. **Coding** - GitHub Copilot for implementation
3. **Review** - AI code review suggestions
4. **Testing** - AI-generated test cases

**Quality gates:**
- TypeScript strict mode
- 80%+ test coverage
- Automated security scanning

---

### Slide 15: Demo / Q&A

**Live demo highlights:**
- Document upload with drag-and-drop
- Real-time presence indicators
- Semantic search in action
- Processing pipeline status

**Questions?**

---

## Supporting Materials

### Architecture Decision Records (ADRs)

1. **ADR-001: PostgreSQL over DynamoDB**
   - Need: ACID transactions, complex queries
   - Trade-off: More ops overhead
   - Mitigation: Managed RDS

2. **ADR-002: BullMQ over SQS for internal queues**
   - Need: Job scheduling, retries, priorities
   - Trade-off: Redis dependency
   - Mitigation: Already using Redis for cache

3. **ADR-003: pgvector over Pinecone**
   - Need: Vector search for semantic queries
   - Trade-off: Scale limits (~10M vectors)
   - Mitigation: Sufficient for initial scale

---

### Key Trade-offs

| Decision | Pros | Cons | Mitigation |
|----------|------|------|------------|
| NestJS over Fastify | Type-safe, DI, mature | Heavier | Acceptable for complexity |
| PostgreSQL over NoSQL | ACID, JOIN support | Scaling ceiling | Read replicas, sharding later |
| ECS over Lambda | Long-running jobs | More config | CDK abstracts complexity |
| Monorepo | Shared code, atomic changes | Build complexity | Turborepo caching |
