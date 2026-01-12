-- Migration: Add new PDF processing job types to ProcessingJobType enum
-- Created: 2026-01-11
-- Description: Adds PDF_WATERMARK, PDF_COMPRESS, PDF_EXTRACT_PAGES, PDF_RENDER_PAGE, PDF_METADATA
--              to the ProcessingJobType enum for extended PDF processing capabilities.

-- Add new enum values to ProcessingJobType
-- PostgreSQL requires adding enum values one at a time

DO $$
BEGIN
    -- Add PDF_WATERMARK if not exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'PDF_WATERMARK'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ProcessingJobType')
    ) THEN
        ALTER TYPE "ProcessingJobType" ADD VALUE 'PDF_WATERMARK';
    END IF;
END $$;

DO $$
BEGIN
    -- Add PDF_COMPRESS if not exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'PDF_COMPRESS'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ProcessingJobType')
    ) THEN
        ALTER TYPE "ProcessingJobType" ADD VALUE 'PDF_COMPRESS';
    END IF;
END $$;

DO $$
BEGIN
    -- Add PDF_EXTRACT_PAGES if not exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'PDF_EXTRACT_PAGES'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ProcessingJobType')
    ) THEN
        ALTER TYPE "ProcessingJobType" ADD VALUE 'PDF_EXTRACT_PAGES';
    END IF;
END $$;

DO $$
BEGIN
    -- Add PDF_RENDER_PAGE if not exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'PDF_RENDER_PAGE'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ProcessingJobType')
    ) THEN
        ALTER TYPE "ProcessingJobType" ADD VALUE 'PDF_RENDER_PAGE';
    END IF;
END $$;

DO $$
BEGIN
    -- Add PDF_METADATA if not exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'PDF_METADATA'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ProcessingJobType')
    ) THEN
        ALTER TYPE "ProcessingJobType" ADD VALUE 'PDF_METADATA';
    END IF;
END $$;

-- Verification: Check all enum values
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ProcessingJobType');
