# AI Features Test Guide

> Manual testing guide for Document Management System AI features
>
> **Last Updated:** January 2026

---

## Prerequisites

### 1. Environment Setup

Ensure the following environment variables are set in `apps/api/.env`:

```bash
# OpenAI Configuration (Required for AI features)
OPENAI_API_KEY=sk-...your-key...
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

### 2. Start Services

```bash
# Start Docker services (PostgreSQL, Redis, MinIO)
docker compose up -d

# Start the API server
pnpm --filter @dms/api dev

# Start the web frontend (optional, for UI testing)
pnpm --filter @dms/web dev
```

### 3. Verify API is Running

```bash
curl http://localhost:4000/api/v1/health
# Expected: {"status":"ok","timestamp":"..."}
```

### 4. Get Authentication Token

```bash
# Login and get token
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@dms-test.com","password":"admin123!"}'

# Save the accessToken from response for subsequent requests
export TOKEN="your-access-token-here"
export ORG_ID="your-organization-id"
```

---

## Testing Semantic Search

Semantic search uses OpenAI embeddings to find documents based on meaning, not just keyword matching.

### Generate Embeddings for Documents

Before semantic search works, documents need embeddings generated:

```bash
# Trigger embedding generation for a specific document
curl -X POST "http://localhost:4000/api/v1/documents/{documentId}/process" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-ID: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"operations": ["EMBEDDING"]}'
```

### Perform Semantic Search

```bash
# Search using semantic similarity
curl "http://localhost:4000/api/v1/search?q=employee%20guidelines&type=semantic" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-ID: $ORG_ID"
```

### Expected Response

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "document-uuid",
        "name": "Company Handbook.pdf",
        "similarity": 0.816,
        "excerpt": "...matching text excerpt..."
      }
    ],
    "total": 1,
    "searchType": "semantic",
    "queryEmbeddingGenerated": true
  }
}
```

### Key Indicators of Working Semantic Search

| Field | Expected Value | Meaning |
|-------|----------------|---------|
| `searchType` | `"semantic"` | Semantic search was used (not fallback) |
| `queryEmbeddingGenerated` | `true` | Query was converted to embedding |
| `similarity` | 0.0-1.0 | Cosine similarity score |

### Test Queries

| Query | Should Find | Why |
|-------|-------------|-----|
| `"employee guidelines"` | Company Handbook | Semantic match to HR policies |
| `"payment terms"` | Invoice documents | Matches billing/payment content |
| `"confidential agreement"` | NDA documents | Semantic match to legal contracts |

---

## Testing Hybrid Search

Hybrid search combines full-text search with semantic search using Reciprocal Rank Fusion (RRF).

### Perform Hybrid Search

```bash
curl "http://localhost:4000/api/v1/search?q=invoice%20payment&type=hybrid" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-ID: $ORG_ID"
```

### Expected Response

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "document-uuid",
        "name": "Invoice-2024-001.pdf",
        "score": 0.0323,
        "textRank": 1,
        "semanticRank": 2,
        "excerpt": "...matching content..."
      }
    ],
    "total": 1,
    "searchType": "hybrid"
  }
}
```

### Key Indicators

| Field | Meaning |
|-------|---------|
| `textRank` | Position in full-text search results |
| `semanticRank` | Position in semantic search results |
| `score` | Combined RRF score (higher = better) |

---

## Testing AI Classification

AI classification uses GPT-4 to categorize documents and extract metadata.

### Trigger Classification

```bash
# Classify a specific document
curl -X POST "http://localhost:4000/api/v1/documents/{documentId}/process" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-ID: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"operations": ["AI_CLASSIFY"]}'
```

### Check Classification Results

```bash
# Get document with metadata
curl "http://localhost:4000/api/v1/documents/{documentId}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-ID: $ORG_ID"
```

### Expected Classification Metadata

```json
{
  "success": true,
  "data": {
    "id": "document-uuid",
    "name": "Invoice-2024-001.pdf",
    "metadata": {
      "aiClassification": {
        "category": "Invoice",
        "confidence": 0.99,
        "language": "en",
        "tags": ["payment", "billing", "net 30", "document management services"],
        "summary": "Invoice from Acme Corp for document management services...",
        "classifiedAt": "2026-01-11T...",
        "model": "gpt-4-turbo-preview"
      }
    }
  }
}
```

### Classification Categories

The AI classifier recognizes these categories:

| Category | Examples |
|----------|----------|
| Invoice | Bills, payment requests, receipts |
| Contract | Agreements, NDAs, terms of service |
| Report | Analysis documents, summaries |
| Letter | Correspondence, formal communications |
| Form | Applications, questionnaires |
| Presentation | Slides, pitch decks |
| Other | Documents that don't fit above categories |

### Expected Results by Document Type

| Document | Expected Category | Confidence |
|----------|-------------------|------------|
| Invoice-2024-001.pdf | Invoice | >0.95 |
| NDA - Partner Corp.pdf | Contract | >0.95 |
| Company Handbook.pdf | Other (or Report) | >0.90 |

---

## Using Test Scripts

Several test scripts are available in the `scripts/` directory:

### Quick Classification Test

```bash
node scripts/quick-classify-test.mjs
```

Tests classification on a single document and waits for results.

### Batch Classification Test

```bash
node scripts/test-ai-classify.mjs
```

Tests classification on multiple documents and displays all results.

### Check Document Metadata

```bash
node scripts/check-metadata.mjs
```

Displays current AI classification metadata for all documents.

---

## Troubleshooting

### Semantic Search Falls Back to Text Search

**Symptom:** Response shows `"searchType": "text"` instead of `"semantic"`

**Causes:**
1. OpenAI API key not configured
2. Documents don't have embeddings generated
3. OpenAI API error

**Solutions:**
1. Check `OPENAI_API_KEY` in `apps/api/.env`
2. Run embedding generation for documents
3. Check API logs for errors: `pnpm --filter @dms/api dev`

### Classification Returns "Other" with 0 Confidence

**Symptom:** All documents classified as "Other" with confidence 0

**Causes:**
1. OpenAI API key not configured
2. Document has no extracted text (run OCR first)
3. JSON parsing error in GPT response

**Solutions:**
1. Verify `OPENAI_API_KEY` and `OPENAI_MODEL` in `.env`
2. Check document has `extractedText` field populated
3. Check API logs for parsing errors

### "Dimensions not supported" Error

**Symptom:** Embedding generation fails with dimensions error

**Cause:** Using older embedding model that doesn't support dimensions parameter

**Solution:** Ensure `OPENAI_EMBEDDING_MODEL=text-embedding-3-small` (or `text-embedding-3-large`)

### Port 4000 Already in Use

**Symptom:** `EADDRINUSE: address already in use :::4000`

**Solution (Windows):**
```powershell
# Find process using port 4000
netstat -ano | findstr :4000

# Kill the process
Stop-Process -Id <PID> -Force
```

**Solution (macOS/Linux):**
```bash
lsof -i :4000
kill -9 <PID>
```

---

## API Reference

### Search Endpoint

```
GET /api/v1/search
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Search query (required) |
| `type` | string | `text`, `semantic`, or `hybrid` (default: `hybrid`) |
| `folderId` | string | Filter by folder |
| `mimeType` | string | Filter by MIME type |
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page (default: 20) |

### Process Document Endpoint

```
POST /api/v1/documents/:id/process
```

| Operation | Description |
|-----------|-------------|
| `OCR` | Extract text using Textract |
| `THUMBNAIL` | Generate preview images |
| `EMBEDDING` | Generate semantic embeddings |
| `AI_CLASSIFY` | Classify with GPT-4 |
| `PDF_SPLIT` | Split PDF into pages |

---

## Verification Checklist

Use this checklist to verify all AI features are working:

- [ ] API server starts without errors
- [ ] OpenAI API key is loaded (check logs for "EmbeddingService initialized")
- [ ] Documents have `extractedText` populated
- [ ] Embedding generation completes successfully
- [ ] Semantic search returns results with similarity scores
- [ ] Hybrid search returns results with RRF scores
- [ ] AI classification returns correct categories
- [ ] Classification confidence scores are >0.9 for clear document types
- [ ] Tags and summaries are generated correctly

---

## Sample Test Session

```bash
# 1. Start services
docker compose up -d
pnpm --filter @dms/api dev

# 2. Login
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@dms-test.com","password":"admin123!"}'

# 3. Test semantic search
curl "http://localhost:4000/api/v1/search?q=employee%20policies&type=semantic" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-ID: $ORG_ID"

# 4. Test hybrid search
curl "http://localhost:4000/api/v1/search?q=invoice&type=hybrid" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-ID: $ORG_ID"

# 5. Trigger classification
curl -X POST "http://localhost:4000/api/v1/documents/$DOC_ID/process" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-ID: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"operations": ["AI_CLASSIFY"]}'

# 6. Check results (wait 10 seconds)
sleep 10
curl "http://localhost:4000/api/v1/documents/$DOC_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-ID: $ORG_ID"
```
