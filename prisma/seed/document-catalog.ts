/**
 * Document catalog for the demo organization. Every entry is backed by a
 * real generated file (PDF/CSV/TXT) uploaded to S3/MinIO during seeding —
 * `metadata.pages`/`rows`/`columns`/`lines` are derived from the actual
 * generated content, never hand-typed, so they can't drift out of sync
 * (see `document-spec.ts` for the factories that enforce that).
 */

import { pdfDocument, csvDocument, textDocument, type DocumentSeed } from './document-spec.js';

export type { DocumentSeed, UserKey, FolderKey } from './document-spec.js';

export const documentCatalog: DocumentSeed[] = [
  pdfDocument({
    name: 'Company Handbook.pdf',
    originalName: 'Company_Handbook_2026.pdf',
    folderKey: 'documents',
    createdByKey: 'admin',
    title: 'Company Handbook',
    metadata: { author: 'People Ops' },
    extractedText:
      'Northwind Docs company handbook covering the mission (helping teams store, ' +
      'process, and find their documents without friction) and core values: clarity, ' +
      'ownership, and respect.',
    bodyByPage: [
      `Welcome to Northwind Docs!

This handbook covers how we work together day to day.

Our Mission
Northwind Docs helps teams store, process, and find their documents
without friction - from contracts to invoices to internal reports.`,
      `Our Values
- Clarity: say what you mean, write it down.
- Ownership: ship the smallest useful thing, then iterate.
- Respect: assume good intent, disagree openly.

Getting Help
Reach out in #general on Slack or email people@northwinddocs.com.`,
    ],
  }),

  pdfDocument({
    name: 'Service Agreement - Meridian Retail.pdf',
    originalName: 'ServiceAgreement_MeridianRetail_2026.pdf',
    folderKey: 'contracts',
    createdByKey: 'maria',
    title: 'Service Agreement',
    metadata: { contractType: 'service', client: 'Meridian Retail' },
    extractedText:
      'Service agreement between Northwind Docs and Meridian Retail for document ' +
      'management and OCR processing services, 12-month term, $1,800 monthly fee net 15.',
    bodyByPage: [
      `SERVICE AGREEMENT

This Service Agreement ("Agreement") is entered into between
Northwind Docs ("Provider") and Meridian Retail ("Client").`,
      `1. SERVICES
Provider will deliver document management and OCR processing
services as described in Exhibit A.

2. TERM
This agreement is effective for 12 months from the signature date.

3. PAYMENT
Client agrees to pay a monthly service fee of $1,800, due net 15.`,
    ],
  }),

  pdfDocument({
    name: 'NDA - Beacon Partners.pdf',
    originalName: 'NDA_BeaconPartners_2026.pdf',
    folderKey: 'contracts',
    createdByKey: 'maria',
    title: 'Non-Disclosure Agreement',
    metadata: { contractType: 'nda', partner: 'Beacon Partners' },
    extractedText:
      'Non-disclosure agreement between Northwind Docs and Beacon Partners protecting ' +
      'confidential information shared during partnership discussions, 3-year term.',
    bodyByPage: [
      `NON-DISCLOSURE AGREEMENT

This NDA is entered into between Northwind Docs and Beacon Partners
to protect confidential information shared during partnership
discussions.

1. CONFIDENTIAL INFORMATION
Both parties agree to protect all technical and business information
disclosed during the engagement.

2. TERM
This agreement remains in effect for 3 years from the signature date.`,
    ],
  }),

  pdfDocument({
    name: 'Invoice-2026-014.pdf',
    originalName: 'Invoice-2026-014.pdf',
    folderKey: 'invoices',
    createdByKey: 'alex',
    title: 'Invoice INV-2026-014',
    metadata: { invoiceNumber: 'INV-2026-014', amount: 1800, currency: 'USD' },
    extractedText:
      'Invoice INV-2026-014 billed to Meridian Retail for the February 2026 document ' +
      'management subscription, $1,800.00 due net 15.',
    bodyByPage: [
      `INVOICE

Invoice Number: INV-2026-014
Date: February 3, 2026

Bill To:
Meridian Retail
88 Harbor Street

Services Rendered:
Document Management Subscription - February 2026

Amount Due: $1,800.00
Payment Terms: Net 15`,
    ],
  }),

  pdfDocument({
    name: 'Q1 2026 Financial Summary.pdf',
    originalName: 'Q1_2026_Financial_Summary.pdf',
    folderKey: 'reports',
    createdByKey: 'maria',
    title: 'Q1 2026 Financial Summary',
    metadata: { department: 'Finance', quarter: 'Q1', year: 2026 },
    extractedText:
      'Q1 2026 financial summary for Northwind Docs: total revenue $184,000 (+18% QoQ), ' +
      'net income $38,500, cash on hand $412,000.',
    bodyByPage: [
      `NORTHWIND DOCS
Q1 2026 FINANCIAL SUMMARY

REVENUE
Total revenue: $184,000 (+18% QoQ)
Recurring subscriptions: $151,000
Professional services: $33,000`,
      `EXPENSES
Cloud infrastructure: $22,000
Payroll: $96,000
Marketing: $14,000

NET RESULT
Net income: $38,500
Cash on hand: $412,000`,
    ],
  }),

  pdfDocument({
    name: 'System Architecture Overview.pdf',
    originalName: 'System_Architecture_Overview_v1.2.pdf',
    folderKey: 'projects',
    createdByKey: 'admin',
    title: 'System Architecture Overview',
    metadata: { version: '1.2', author: 'Engineering' },
    extractedText:
      'System architecture overview: API gateway, document service, processing service, ' +
      'and search service, backed by PostgreSQL with pgvector, S3-compatible storage, ' +
      'and Redis/BullMQ queues.',
    bodyByPage: [
      `SYSTEM ARCHITECTURE OVERVIEW
Version 1.2

CORE SERVICES
1. API Gateway - authentication, rate limiting, routing
2. Document Service - uploads, metadata, versioning
3. Processing Service - OCR and thumbnail generation
4. Search Service - full-text and semantic search`,
      `DATA LAYER
- PostgreSQL with pgvector for embeddings
- S3-compatible storage for uploaded files
- Redis for caching and BullMQ job queues

DEPLOYMENT
- Docker Compose locally, containers in production
- GitHub Actions for CI/CD`,
    ],
  }),

  csvDocument({
    name: 'Sales Pipeline Q1 2026.csv',
    originalName: 'Sales_Pipeline_Q1_2026.csv',
    folderKey: 'reports',
    createdByKey: 'alex',
    metadata: { type: 'sales_pipeline' },
    extractedText:
      'Q1 2026 sales pipeline: five open and closed deals across Meridian Retail, Beacon ' +
      'Partners, Harborline Logistics, Crestview Legal, and Fairwind Media.',
    headers: ['Deal', 'Stage', 'Owner', 'Value'],
    rows: [
      ['Meridian Retail Renewal', 'Closed Won', 'Maria Santos', '21600'],
      ['Beacon Partners Onboarding', 'Negotiation', 'Alex Chen', '9600'],
      ['Harborline Logistics', 'Discovery', 'Maria Santos', '14400'],
      ['Crestview Legal', 'Proposal Sent', 'Alex Chen', '7200'],
      ['Fairwind Media', 'Closed Won', 'Maria Santos', '12000'],
    ],
  }),

  textDocument({
    name: 'README.txt',
    originalName: 'README.txt',
    folderKey: 'documents',
    createdByKey: 'admin',
    metadata: {},
    extractedText:
      'Northwind Docs workspace README: getting started with uploads, folders, and search.',
    content: `Northwind Docs - README
=========================

Welcome to the Northwind Docs workspace.

Getting Started:
1. Upload documents via drag-and-drop or the file picker.
2. Organize files into folders.
3. Use search to find documents by content, not just filename.

Support: support@northwinddocs.com`,
  }),
];
