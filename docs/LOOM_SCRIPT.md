# Loom Video Script - 5 Minutes

## Document Management System - Executive Overview

**Target Duration:** 5 minutes (max)
**Format:** Screen recording with voiceover
**Author:** Willian Pinho

---

## Pre-Recording Checklist

- [ ] Architecture diagram open in browser tab
- [ ] Live demo environment running (localhost:3000 + localhost:4000)
- [ ] Test documents uploaded (Invoice, Contract, Handbook)
- [ ] Semantic search query ready ("employee guidelines")
- [ ] Good lighting and audio quality
- [ ] Loom recording ready

---

## SCRIPT

### [0:00 - 0:25] Opening - Hook & Problem

**[SHOW: Title slide or live application]**

> "Hi, I'm Willian Pinho, and in the next 5 minutes I'll walk you through my solution for the Document Management System challenge.
>
> The goal: build a cloud-based document system like OneDrive or Google Drive, but with AI-powered processing - PDF splitting, OCR, and intelligent document classification.
>
> Let me show you what I built."

---

### [0:25 - 1:15] Architecture Overview

**[SHOW: High-level architecture diagram]**

> "Here's the high-level architecture running on AWS.
>
> **Three client types**: a Next.js 15 web app, a desktop upload agent built with Electron, and REST API access for integrations.
>
> **The backend** is a NestJS 11 API running on ECS Fargate, connecting to PostgreSQL with pgvector for semantic search, Redis for caching and job queues, and S3 for file storage with CloudFront CDN.
>
> **The key innovation** is the processing pipeline - when documents are uploaded, workers automatically extract text, generate AI embeddings, and classify documents using GPT-4."

---

### [1:15 - 2:00] Document Processing Pipeline

**[SHOW: Processing flow diagram or live API logs]**

> "Let me explain how document processing works.
>
> When a user uploads a file, it goes directly to S3 using presigned URLs - the API stays lightweight.
>
> Then, background workers powered by BullMQ:
> - Extract text using AWS Textract for OCR
> - Generate 1536-dimensional vector embeddings with OpenAI
> - Classify documents automatically - identifying invoices, contracts, reports
>
> Everything is async and scalable. Users see real-time progress through WebSockets."

---

### [2:00 - 2:45] Live Demo - Semantic Search

**[SHOW: Live application - perform semantic search]**

> "Let me show you the semantic search in action.
>
> *[Type in search: "employee guidelines"]*
>
> Notice how it finds the Company Handbook even though I didn't search for those exact words. That's the power of vector embeddings - it understands meaning, not just keywords.
>
> *[Point to similarity scores]*
>
> Each result shows a similarity score - 81% match in this case. The system supports hybrid search, combining semantic and full-text results."

---

### [2:45 - 3:30] AI Classification Demo

**[SHOW: Document detail page with AI classification metadata]**

> "Now let's look at AI classification.
>
> *[Click on Invoice document]*
>
> GPT-4 analyzed this document and identified it as an Invoice with 99% confidence. It extracted relevant tags - payment, billing, net 30 - and generated a summary.
>
> *[Click on Contract document]*
>
> For this NDA, it correctly identified it as a Contract with 98% confidence, tagged it as legal and confidential.
>
> This happens automatically for every uploaded document."

---

### [3:30 - 4:15] Key Technical Decisions

**[SHOW: Tech stack slide]**

> "A few key decisions that make this production-ready:
>
> **PostgreSQL with pgvector** instead of a separate vector database. Simplifies operations, handles millions of documents.
>
> **BullMQ on Redis** for job processing - reliable retries and priorities.
>
> **Row-Level Security** ensures complete tenant isolation at the database level.
>
> The entire infrastructure is defined as code using AWS CDK in TypeScript."

---

### [4:15 - 4:50] Scalability & Operations

**[SHOW: Infrastructure diagram]**

> "The system scales horizontally.
>
> ECS Fargate auto-scales based on load. Spot instances for workers - 70% cost savings.
>
> Observability built-in: structured logs, custom metrics, alerts for SLOs.
>
> Target: 99.9% availability, under 500ms P99 latency.
>
> Estimated cost for 1000 users: $500-800 per month."

---

### [4:50 - 5:00] Closing

**[SHOW: Running application]**

> "To wrap up: this is a production-ready Document Management System with AI-powered search and classification.
>
> The code is available for review, and I'm excited to dive deeper during our interview.
>
> Thanks for watching."

---

## Recording Tips

### Do's
- Speak clearly and at moderate pace
- Point to diagram sections as you explain
- Show real working demos
- Be enthusiastic but professional

### Don'ts
- Don't rush - 5 minutes is plenty
- Don't read word-for-word
- Don't apologize for anything

### Technical Setup
1. **Resolution:** 1080p or higher
2. **Audio:** Use headset mic
3. **Browser:** Clear tabs, hide bookmarks
4. **Demo URLs:** localhost:3000, localhost:4000/api/docs

---

## Key Metrics

| Metric | Value |
|--------|-------|
| Processing queues | 5 (OCR, PDF, Thumbnail, Embedding, AI Classify) |
| Embedding dimensions | 1536 (text-embedding-3-small) |
| AI classification | 95-99% confidence |
| Target latency | < 500ms P99 |
| Spot savings | 70% |
| Monthly cost | $500-800 (1000 users) |

---

## Questions to Anticipate

1. **"Why PostgreSQL over DynamoDB?"**
   - ACID, complex queries, pgvector, single database

2. **"How does semantic search scale?"**
   - IVFFlat index, pagination, migrate to Pinecone if needed

3. **"Cost breakdown?"**
   - ECS ~$200, RDS ~$150, Redis ~$50, S3 ~$50, AI APIs ~$100-200

4. **"Security?"**
   - RLS, encryption, OAuth 2.0, RBAC

5. **"What would you improve?"**
   - Real-time collab, mobile apps, custom ML models
