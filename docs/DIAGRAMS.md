# Architecture Diagrams

## How to View Diagrams

The architecture diagrams are defined in Mermaid format in `ARCHITECTURE.md`. To render them:

### Option 1: GitHub (Recommended)
- Open `ARCHITECTURE.md` on GitHub - diagrams render automatically

### Option 2: VS Code
- Install "Markdown Preview Mermaid Support" extension
- Open `ARCHITECTURE.md` and use Markdown preview (Ctrl+Shift+V)

### Option 3: Mermaid Live Editor
- Go to https://mermaid.live/
- Paste the diagram code to render and export as PNG/SVG

### Option 4: Command Line
```bash
npm install -g @mermaid-js/mermaid-cli
mmdc -i ARCHITECTURE.md -o architecture.png
```

---

## Main Architecture Diagram (ASCII for Loom)

For the Loom video, use this simplified ASCII diagram:

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENTS                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │   Next.js   │  │   Desktop   │  │    API      │                  │
│  │   Web App   │  │   Agent     │  │   Clients   │                  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                  │
└─────────┼────────────────┼────────────────┼─────────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    CloudFront CDN + ALB                              │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      ECS FARGATE CLUSTER                             │
│                                                                      │
│  ┌───────────────────────────┐  ┌───────────────────────────┐       │
│  │       API Service         │  │      Worker Service       │       │
│  │       (NestJS 11)         │  │      (BullMQ Jobs)        │       │
│  │                           │  │                           │       │
│  │  • REST API               │  │  • OCR Processing         │       │
│  │  • WebSocket Gateway      │  │  • Embedding Generation   │       │
│  │  • Auth (JWT, OAuth)      │  │  • AI Classification      │       │
│  └─────────────┬─────────────┘  └─────────────┬─────────────┘       │
└────────────────┼──────────────────────────────┼─────────────────────┘
                 │                              │
        ┌────────┴────────┐            ┌────────┴────────┐
        ▼                 ▼            ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  PostgreSQL  │  │    Redis     │  │   AWS S3     │  │   OpenAI     │
│  + pgvector  │  │  Cache/Queue │  │   Storage    │  │   + Textract │
│              │  │              │  │              │  │              │
│  • Documents │  │  • Sessions  │  │  • Files     │  │  • GPT-4     │
│  • Users     │  │  • Cache     │  │  • Thumbnails│  │  • Embeddings│
│  • Embeddings│  │  • Job Queue │  │  • Versions  │  │  • OCR       │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

---

## Processing Pipeline Diagram (ASCII)

```
┌──────────────────────────────────────────────────────────────────────┐
│                    DOCUMENT PROCESSING PIPELINE                       │
└──────────────────────────────────────────────────────────────────────┘

     User Upload
          │
          ▼
    ┌───────────┐
    │   S3      │ ◄── Presigned URL (direct upload)
    │  Bucket   │
    └─────┬─────┘
          │
          ▼ S3 Event
    ┌───────────┐
    │  BullMQ   │ ◄── Redis-backed job queue
    │   Queue   │
    └─────┬─────┘
          │
          ▼
    ┌───────────┐
    │  Worker   │ ◄── ECS Fargate (auto-scaling)
    │  Service  │
    └─────┬─────┘
          │
    ┌─────┴─────┬─────────────┬─────────────┬─────────────┐
    ▼           ▼             ▼             ▼             ▼
┌───────┐  ┌───────┐    ┌───────────┐  ┌───────────┐  ┌───────────┐
│  OCR  │  │ Thumb │    │ PDF Split │  │ Embedding │  │ AI Class  │
│       │  │       │    │           │  │           │  │           │
│Textract│  │ Sharp │    │  pdf-lib  │  │  OpenAI   │  │   GPT-4   │
└───┬───┘  └───┬───┘    └─────┬─────┘  └─────┬─────┘  └─────┬─────┘
    │          │              │              │              │
    └──────────┴──────────────┴──────────────┴──────────────┘
                              │
                              ▼
                     ┌──────────────┐
                     │  PostgreSQL  │
                     │  + pgvector  │
                     │              │
                     │  • Text      │
                     │  • Vectors   │
                     │  • Metadata  │
                     └──────────────┘
                              │
                              ▼
                     ┌──────────────┐
                     │  WebSocket   │ ◄── Real-time updates
                     │   (Socket.IO)│
                     └──────────────┘
                              │
                              ▼
                        User Browser
```

---

## Technology Stack Visual

```
┌─────────────────────────────────────────────────────────────────────┐
│                          TECHNOLOGY STACK                            │
└─────────────────────────────────────────────────────────────────────┘

   FRONTEND                 BACKEND                 DATA LAYER
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│             │         │             │         │             │
│  Next.js 15 │         │  NestJS 11  │         │PostgreSQL 16│
│  + React 19 │   ◄──►  │  + BullMQ   │   ◄──►  │ + pgvector  │
│             │         │             │         │             │
└─────────────┘         └─────────────┘         └─────────────┘
      │                       │                       │
      ▼                       ▼                       ▼
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  shadcn/ui  │         │   Redis 7   │         │   AWS S3    │
│  Tailwind   │         │ (Cache/Queue)│         │ (Storage)   │
└─────────────┘         └─────────────┘         └─────────────┘
      │                       │                       │
      ▼                       ▼                       ▼
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  Socket.IO  │         │   OpenAI    │         │ CloudFront  │
│ (Real-time) │         │   GPT-4     │         │   (CDN)     │
└─────────────┘         └─────────────┘         └─────────────┘

                    INFRASTRUCTURE
              ┌─────────────────────────┐
              │       AWS CDK v2        │
              │    (TypeScript IaC)     │
              ├─────────────────────────┤
              │  • ECS Fargate          │
              │  • RDS PostgreSQL       │
              │  • ElastiCache Redis    │
              │  • S3 + CloudFront      │
              │  • CloudWatch Logs      │
              └─────────────────────────┘
```

---

## Semantic Search Flow

```
                    SEMANTIC SEARCH FLOW

┌──────────────────────────────────────────────────────────┐
│                      INDEXING PHASE                       │
└──────────────────────────────────────────────────────────┘

  Document Upload        Text Extraction        Embedding Generation
       │                      │                      │
       ▼                      ▼                      ▼
  ┌─────────┐           ┌─────────┐           ┌─────────┐
  │   PDF   │  ──────►  │ Textract│  ──────►  │ OpenAI  │
  │  File   │           │  (OCR)  │           │Embedding│
  └─────────┘           └─────────┘           └─────────┘
                                                   │
                                                   ▼
                                            ┌─────────────┐
                                            │  pgvector   │
                                            │ (1536 dim)  │
                                            └─────────────┘

┌──────────────────────────────────────────────────────────┐
│                      SEARCH PHASE                         │
└──────────────────────────────────────────────────────────┘

  User Query           Query Embedding        Vector Search
       │                      │                      │
       ▼                      ▼                      ▼
  ┌─────────┐           ┌─────────┐           ┌─────────┐
  │"employee│  ──────►  │ OpenAI  │  ──────►  │ pgvector│
  │guidelines│          │Embedding│           │ cosine  │
  └─────────┘           └─────────┘           └─────────┘
                                                   │
                                                   ▼
                                            ┌─────────────┐
                                            │   Results   │
                                            │ "Handbook"  │
                                            │ (81% match) │
                                            └─────────────┘
```

---

## Quick Reference for Presentation

| Diagram | Use For |
|---------|---------|
| Main Architecture | Slide 5: Overview |
| Processing Pipeline | Slide 6: Document Processing |
| Semantic Search | Slide 9: Search Demo |
| Tech Stack | Slide 4: Technology choices |

### Mermaid Links (Copy to mermaid.live)

1. **System Overview**: See `ARCHITECTURE.md` - first diagram
2. **Component Architecture**: See `ARCHITECTURE.md` - second diagram
3. **Data Flow**: See `ARCHITECTURE.md` - sequence diagram
4. **Infrastructure**: See `ARCHITECTURE.md` - CDK stacks
