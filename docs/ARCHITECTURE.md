# Document Management System - Architecture

## System Overview

```mermaid
flowchart TB
    subgraph Clients["Client Applications"]
        WEB["Web App<br/>(Next.js 15)"]
        AGENT["Upload Agent<br/>(Electron)"]
        API_CLIENT["API Clients<br/>(M2M)"]
    end

    subgraph CDN["Content Delivery"]
        CF["CloudFront CDN"]
    end

    subgraph LB["Load Balancing"]
        ALB["Application<br/>Load Balancer"]
    end

    subgraph Compute["Compute Layer"]
        subgraph ECS["ECS Fargate"]
            API["API Service<br/>(NestJS)"]
            WORKER["Worker Service<br/>(BullMQ)"]
        end
    end

    subgraph Data["Data Layer"]
        PG[("PostgreSQL<br/>+ pgvector")]
        REDIS[("Redis<br/>Cache/Queue")]
    end

    subgraph Storage["Object Storage"]
        S3["S3 Bucket<br/>(Documents)"]
    end

    subgraph Processing["Processing Pipeline"]
        SQS["SQS Queue"]
        TEXTRACT["AWS Textract<br/>(OCR)"]
        OPENAI["OpenAI API<br/>(Embeddings)"]
    end

    subgraph Auth["Authentication"]
        COGNITO["OAuth Providers<br/>(Google, Microsoft)"]
    end

    %% Client connections
    WEB --> CF
    WEB --> ALB
    AGENT --> ALB
    API_CLIENT --> ALB

    %% CDN to S3
    CF --> S3

    %% Load balancer to compute
    ALB --> API

    %% API connections
    API --> PG
    API --> REDIS
    API --> S3
    API --> COGNITO

    %% Worker connections
    WORKER --> PG
    WORKER --> REDIS
    WORKER --> S3
    WORKER --> TEXTRACT
    WORKER --> OPENAI

    %% Queue connections
    REDIS --> WORKER
    S3 -.-> SQS
    SQS --> WORKER
```

## Component Architecture

```mermaid
flowchart LR
    subgraph Frontend["Frontend (Next.js 15)"]
        PAGES["App Router Pages"]
        COMPONENTS["React Components"]
        HOOKS["Custom Hooks"]
        STATE["Zustand Store"]
        QUERY["React Query"]
        SOCKET_CLIENT["Socket.IO Client"]
    end

    subgraph Backend["Backend (NestJS 11)"]
        subgraph Modules["Feature Modules"]
            AUTH["Auth Module"]
            DOCS["Documents Module"]
            FOLDERS["Folders Module"]
            STORAGE["Storage Module"]
            SEARCH["Search Module"]
            COMMENTS["Comments Module"]
            REALTIME["Realtime Module"]
            PROCESSING["Processing Module"]
        end

        subgraph Common["Common"]
            GUARDS["Auth Guards"]
            FILTERS["Exception Filters"]
            INTERCEPTORS["Interceptors"]
        end
    end

    subgraph External["External Services"]
        S3_EXT["AWS S3"]
        TEXTRACT_EXT["AWS Textract"]
        OPENAI_EXT["OpenAI"]
        OAUTH["OAuth Providers"]
    end

    PAGES --> COMPONENTS
    COMPONENTS --> HOOKS
    HOOKS --> STATE
    HOOKS --> QUERY
    HOOKS --> SOCKET_CLIENT

    QUERY --> AUTH
    QUERY --> DOCS
    QUERY --> FOLDERS
    QUERY --> SEARCH

    SOCKET_CLIENT --> REALTIME

    STORAGE --> S3_EXT
    PROCESSING --> TEXTRACT_EXT
    PROCESSING --> OPENAI_EXT
    AUTH --> OAUTH
```

## Data Flow - Document Upload

```mermaid
sequenceDiagram
    participant U as User
    participant W as Web App
    participant A as API
    participant S as S3
    participant Q as Queue
    participant WK as Worker
    participant T as Textract
    participant AI as OpenAI
    participant DB as PostgreSQL

    U->>W: Select file to upload
    W->>A: POST /documents (metadata)
    A->>DB: Create document record
    A->>S: Generate presigned URL
    A-->>W: Return presigned URL
    W->>S: Upload file directly
    S-->>W: Upload complete
    W->>A: PATCH /documents/:id (confirm)
    A->>Q: Enqueue processing job
    A-->>W: Document created

    Q->>WK: Process document
    WK->>S: Download file
    WK->>T: Extract text (OCR)
    T-->>WK: Text content
    WK->>AI: Generate embeddings
    AI-->>WK: Vector embeddings
    WK->>DB: Update document with content
    WK->>A: Notify completion (WebSocket)
    A->>W: Push update (Socket.IO)
    W->>U: Show processed document
```

## Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant W as Web App
    participant A as API
    participant O as OAuth Provider
    participant DB as PostgreSQL

    alt OAuth Login
        U->>W: Click "Sign in with Google"
        W->>O: Redirect to OAuth provider
        O->>U: Show consent screen
        U->>O: Grant permission
        O->>W: Redirect with auth code
        W->>A: POST /auth/callback
        A->>O: Exchange code for tokens
        O-->>A: Access token + user info
        A->>DB: Find or create user
        A->>A: Generate JWT tokens
        A-->>W: Set HTTP-only cookies
    else Email/Password Login
        U->>W: Enter credentials
        W->>A: POST /auth/login
        A->>DB: Verify credentials
        A->>A: Generate JWT tokens
        A-->>W: Set HTTP-only cookies
    end

    W-->>U: Redirect to dashboard
```

## Real-time Presence

```mermaid
sequenceDiagram
    participant U1 as User 1
    participant U2 as User 2
    participant W1 as Web App 1
    participant W2 as Web App 2
    participant RT as Realtime Gateway
    participant R as Redis

    U1->>W1: Open document
    W1->>RT: Connect WebSocket
    W1->>RT: join_document(docId)
    RT->>R: Add to presence set
    RT->>RT: Broadcast presence update
    RT-->>W1: Current viewers list

    U2->>W2: Open same document
    W2->>RT: Connect WebSocket
    W2->>RT: join_document(docId)
    RT->>R: Add to presence set
    RT->>RT: Broadcast presence update
    RT-->>W1: User 2 joined
    RT-->>W2: Current viewers list

    U1->>W1: Close document
    W1->>RT: leave_document(docId)
    RT->>R: Remove from presence set
    RT-->>W2: User 1 left
```

## Infrastructure (AWS CDK)

```mermaid
flowchart TB
    subgraph Network["NetworkStack"]
        VPC["VPC"]
        SUBNETS["Public/Private Subnets"]
        NAT["NAT Gateway"]
        SG["Security Groups"]
    end

    subgraph Database["DatabaseStack"]
        RDS["RDS PostgreSQL"]
        ELASTICACHE["ElastiCache Redis"]
    end

    subgraph Storage_Stack["StorageStack"]
        S3_DOCS["S3 - Documents"]
        S3_ASSETS["S3 - Static Assets"]
        CLOUDFRONT["CloudFront Distribution"]
    end

    subgraph Compute_Stack["ComputeStack"]
        ECS_CLUSTER["ECS Cluster"]
        API_SERVICE["API Service"]
        WORKER_SERVICE["Worker Service"]
        ALB_STACK["Application LB"]
    end

    subgraph Queue_Stack["QueueStack"]
        SQS_MAIN["SQS - Processing"]
        SQS_DLQ["SQS - Dead Letter"]
    end

    subgraph Monitoring["MonitoringStack"]
        CW_LOGS["CloudWatch Logs"]
        CW_ALARMS["CloudWatch Alarms"]
        CW_DASH["CloudWatch Dashboard"]
    end

    Network --> Database
    Network --> Compute_Stack
    Network --> Storage_Stack
    Database --> Compute_Stack
    Storage_Stack --> Compute_Stack
    Queue_Stack --> Compute_Stack
    Compute_Stack --> Monitoring
```

## Security Model

```mermaid
flowchart TB
    subgraph Auth_Layer["Authentication Layer"]
        JWT["JWT Tokens"]
        OAUTH["OAuth 2.0"]
        API_KEY["API Keys"]
    end

    subgraph Authz_Layer["Authorization Layer"]
        RBAC["Role-Based Access"]
        RLS["Row-Level Security"]
        POLICY["Resource Policies"]
    end

    subgraph Data_Layer["Data Security"]
        ENCRYPT["Encryption at Rest"]
        TLS["TLS in Transit"]
        KMS["AWS KMS"]
    end

    subgraph Network_Layer["Network Security"]
        VPC_SEC["VPC Isolation"]
        SG_SEC["Security Groups"]
        WAF["AWS WAF"]
    end

    Auth_Layer --> Authz_Layer
    Authz_Layer --> Data_Layer
    Network_Layer --> Auth_Layer

    subgraph Roles["RBAC Roles"]
        VIEWER["Viewer<br/>Read-only"]
        EDITOR["Editor<br/>Read + Write"]
        ADMIN["Admin<br/>Full Access"]
        OWNER["Owner<br/>Settings + Billing"]
    end

    RBAC --> Roles
```

## Tech Stack Summary

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 15 + React 19 | Server-side rendering, App Router |
| UI | shadcn/ui + Tailwind | Component library, styling |
| State | Zustand + React Query | Client state, server state |
| Real-time | Socket.IO | WebSocket communication |
| Backend | NestJS 11 | REST API, WebSocket gateway |
| Queue | BullMQ + Redis | Background job processing |
| Database | PostgreSQL 16 + pgvector | Relational data, vector search |
| Cache | Redis 7 | Session, cache, pub/sub |
| Storage | AWS S3 + CloudFront | File storage, CDN |
| OCR | AWS Textract | Document text extraction |
| AI | OpenAI GPT-4 | Classification, embeddings |
| IaC | AWS CDK v2 | Infrastructure as code |
| CI/CD | GitHub Actions | Continuous integration/deployment |
