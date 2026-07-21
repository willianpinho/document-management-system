/**
 * Document spec types + factories used by the demo catalog. Each factory
 * derives its Prisma-facing metadata (`pages`/`rows`/`columns`/`lines`) from
 * the actual generated content, so metadata can't drift out of sync with
 * the real uploaded file.
 */

import type { Prisma } from '@prisma/client';
import { generatePDF, generateTextFile, generateCSV } from './file-generators.js';

export type UserKey = 'admin' | 'maria' | 'alex';
export type FolderKey = 'documents' | 'contracts' | 'invoices' | 'projects' | 'reports';

export interface DocumentSeed {
  name: string;
  originalName: string;
  mimeType: string;
  folderKey: FolderKey;
  createdByKey: UserKey;
  metadata: Prisma.InputJsonObject;
  extractedText: string;
  content: () => Promise<Buffer> | Buffer;
}

interface PdfSpec {
  name: string;
  originalName: string;
  folderKey: FolderKey;
  createdByKey: UserKey;
  title: string;
  /** One string per PDF page. `metadata.pages` is derived from its length. */
  bodyByPage: string[];
  metadata?: Prisma.InputJsonObject;
  extractedText: string;
}

export function pdfDocument(spec: PdfSpec): DocumentSeed {
  const pages = spec.bodyByPage.length;
  return {
    name: spec.name,
    originalName: spec.originalName,
    mimeType: 'application/pdf',
    folderKey: spec.folderKey,
    createdByKey: spec.createdByKey,
    metadata: { pages, ...spec.metadata },
    extractedText: spec.extractedText,
    content: () => generatePDF(spec.title, spec.bodyByPage.join('\f'), pages),
  };
}

interface CsvSpec {
  name: string;
  originalName: string;
  folderKey: FolderKey;
  createdByKey: UserKey;
  headers: string[];
  rows: string[][];
  metadata?: Prisma.InputJsonObject;
  extractedText: string;
}

export function csvDocument(spec: CsvSpec): DocumentSeed {
  return {
    name: spec.name,
    originalName: spec.originalName,
    mimeType: 'text/csv',
    folderKey: spec.folderKey,
    createdByKey: spec.createdByKey,
    metadata: {
      rows: spec.rows.length,
      columns: spec.headers.length,
      delimiter: ',',
      ...spec.metadata,
    },
    extractedText: spec.extractedText,
    content: () => generateCSV(spec.headers, spec.rows),
  };
}

interface TextSpec {
  name: string;
  originalName: string;
  folderKey: FolderKey;
  createdByKey: UserKey;
  content: string;
  metadata?: Prisma.InputJsonObject;
  extractedText: string;
}

export function textDocument(spec: TextSpec): DocumentSeed {
  return {
    name: spec.name,
    originalName: spec.originalName,
    mimeType: 'text/plain',
    folderKey: spec.folderKey,
    createdByKey: spec.createdByKey,
    metadata: { encoding: 'UTF-8', lines: spec.content.split('\n').length, ...spec.metadata },
    extractedText: spec.extractedText,
    content: () => generateTextFile(spec.content),
  };
}
