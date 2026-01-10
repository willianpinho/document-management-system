# Loom Video Script - 5 Minutes

## Document Management System - Executive Overview

**Target Duration:** 5 minutes
**Format:** Screen recording with voiceover

---

## [0:00 - 0:30] Opening - Problem Statement

**[Show: Title slide or architecture diagram]**

> "Hi, I'm Willian Pinho, and I'd like to walk you through my solution for the Document Management System challenge.
>
> The problem is clear: we need a cloud-based system similar to OneDrive or Google Drive, but with enhanced document processing capabilities - specifically PDF splitting and AI-based OCR.
>
> Let me show you how I approached this."

---

## [0:30 - 1:30] Architecture Overview

**[Show: High-level architecture diagram]**

> "Here's the high-level architecture. The system is built on AWS with three main layers:
>
> **First, the Client Layer** - a Next.js web application for users, plus an Electron-based desktop agent for automated folder syncing, and API access for machine-to-machine integrations.
>
> **Second, the Compute Layer** - running on ECS Fargate, we have a NestJS API service handling all requests, and separate worker services for document processing.
>
> **Third, the Data Layer** - PostgreSQL with pgvector for storing documents and enabling semantic search, Redis for caching and job queues, and S3 for actual file storage with CloudFront CDN."

---

## [1:30 - 2:30] Document Processing Pipeline

**[Show: Processing flow diagram]**

> "The document processing pipeline is where the interesting work happens.
>
> When a user uploads a document, it goes directly to S3 using a presigned URL - this keeps the API server lightweight.
>
> S3 triggers an event that queues a processing job. Our workers then:
> - Extract text using AWS Textract for OCR
> - Generate thumbnails with Sharp
> - Create vector embeddings with OpenAI for semantic search
>
> All of this happens asynchronously, so users don't wait. They see processing status in real-time through WebSockets."

---

## [2:30 - 3:15] Key Technical Decisions

**[Show: Tech stack table]**

> "Let me highlight a few key decisions:
>
> **PostgreSQL with pgvector** instead of a separate vector database - this simplifies our architecture while still enabling powerful semantic search. We can always scale to Pinecone later if needed.
>
> **NestJS for the backend** - it gives us a modular, type-safe codebase that's easy to maintain and extend. The dependency injection makes testing straightforward.
>
> **BullMQ for job processing** - built on Redis, it provides reliable job queues with retries, priorities, and rate limiting. Since we're already using Redis for caching, this was a natural fit."

---

## [3:15 - 4:00] Security & Multi-tenancy

**[Show: Security model diagram]**

> "Security is built in from the ground up.
>
> For **authentication**, we support OAuth with Google and Microsoft, plus traditional email/password. API clients use JWT tokens, and the desktop agent uses API keys with HMAC signatures.
>
> For **authorization**, we use role-based access control with four levels: Viewer, Editor, Admin, and Owner. But more importantly, we have Row-Level Security in PostgreSQL - every query is automatically filtered by organization ID, ensuring complete tenant isolation.
>
> All data is encrypted at rest with AWS KMS, and in transit with TLS."

---

## [4:00 - 4:45] Scalability & Operations

**[Show: Infrastructure diagram or CloudWatch dashboard]**

> "The system is designed to scale horizontally.
>
> **ECS Fargate** auto-scales based on CPU and memory. For the workers, we use Spot instances for cost optimization - that's about 70% savings.
>
> **Observability** is handled by CloudWatch - structured logs, custom metrics, and alerts for key SLOs like latency and error rates.
>
> **Infrastructure is defined as code** using AWS CDK in TypeScript - the same language as our application. This makes deployment consistent and reviewable."

---

## [4:45 - 5:00] Closing

**[Show: Summary slide or live demo]**

> "To summarize: this is a production-ready architecture that balances cost, scalability, and developer experience.
>
> The code is available for review, and I'm happy to dive deeper into any aspect during our interview.
>
> Thanks for watching, and I look forward to discussing this further."

---

## Recording Tips

1. **Screen setup:** Have architecture diagrams ready in separate tabs
2. **Pace:** Speak clearly, don't rush - 5 minutes is enough
3. **Visuals:** Point to relevant parts of diagrams as you speak
4. **Energy:** Be enthusiastic but professional
5. **Backup:** Record audio separately in case of issues

## Key Points to Emphasize

- **Practical choices** over over-engineering
- **Cost-conscious** architecture
- **Security-first** design
- **AI-powered** features (OCR, semantic search)
- **Real-time** collaboration capabilities
- **Production-ready** with observability

## Questions to Anticipate

1. "Why PostgreSQL over DynamoDB?"
2. "How does semantic search scale?"
3. "What's the cost breakdown?"
4. "How would you handle 10x traffic?"
5. "What would you change with more time?"
