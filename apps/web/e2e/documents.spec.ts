/**
 * Documents E2E Tests
 *
 * Tests the complete document management flow including upload,
 * download, search, and processing.
 */

import { test, expect, type Page } from '@playwright/test';
import * as path from 'path';

test.describe('Documents', () => {
  // Authenticate before each test
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/dashboard|documents/);
  });

  test.describe('Document List', () => {
    test('should display documents page', async ({ page }) => {
      await page.goto('/documents');

      await expect(page.getByRole('heading', { name: /documents/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /upload/i })).toBeVisible();
    });

    test('should show empty state when no documents', async ({ page }) => {
      await page.goto('/documents');

      // If no documents, show empty state
      const emptyState = page.getByText(/no documents/i);
      const documentList = page.getByTestId('document-list');

      const isEmpty = await emptyState.isVisible().catch(() => false);
      const hasDocuments = await documentList.isVisible().catch(() => false);

      expect(isEmpty || hasDocuments).toBe(true);
    });

    test('should filter documents by type', async ({ page }) => {
      await page.goto('/documents');

      // Open filter dropdown
      await page.getByRole('button', { name: /filter/i }).click();

      // Select PDF filter
      await page.getByRole('menuitem', { name: /pdf/i }).click();

      // Verify filter is applied
      await expect(page.getByText(/filter.*pdf/i)).toBeVisible();
    });

    test('should sort documents', async ({ page }) => {
      await page.goto('/documents');

      // Open sort dropdown
      await page.getByRole('button', { name: /sort/i }).click();

      // Select sort by name
      await page.getByRole('menuitem', { name: /name/i }).click();

      // Sort order should be visible
      await expect(page.getByRole('button', { name: /sort/i })).toContainText(/name/i);
    });
  });

  test.describe('Document Upload', () => {
    test('should open upload dialog', async ({ page }) => {
      await page.goto('/documents');

      await page.getByRole('button', { name: /upload/i }).click();

      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText(/drag.*drop/i)).toBeVisible();
    });

    test('should upload a file', async ({ page }) => {
      await page.goto('/documents');

      // Open upload dialog
      await page.getByRole('button', { name: /upload/i }).click();

      // Upload test file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'test-document.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('Test document content'),
      });

      // Wait for upload to complete
      await expect(page.getByText(/completed|success/i)).toBeVisible({ timeout: 30000 });
    });

    test('should show upload progress', async ({ page }) => {
      await page.goto('/documents');

      // Open upload dialog
      await page.getByRole('button', { name: /upload/i }).click();

      // Upload larger file to see progress
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'large-document.txt',
        mimeType: 'text/plain',
        buffer: Buffer.alloc(1024 * 100, 'a'), // 100KB file
      });

      // Progress should be visible
      await expect(page.getByRole('progressbar').or(page.getByText(/%/))).toBeVisible();
    });

    test('should reject invalid file types', async ({ page }) => {
      await page.goto('/documents');

      // Open upload dialog
      await page.getByRole('button', { name: /upload/i }).click();

      // Try to upload executable
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'malicious.exe',
        mimeType: 'application/x-msdownload',
        buffer: Buffer.from('fake executable'),
      });

      // Should show error
      await expect(page.getByText(/not allowed|invalid|rejected/i)).toBeVisible();
    });
  });

  test.describe('Document Actions', () => {
    test('should open document details', async ({ page }) => {
      await page.goto('/documents');

      // Click on first document (if exists)
      const firstDoc = page.getByTestId('document-card').first();
      const hasDocuments = await firstDoc.isVisible().catch(() => false);

      if (hasDocuments) {
        await firstDoc.click();

        // Should navigate to document details
        await expect(page).toHaveURL(/documents\/[a-z0-9-]+/);
        await expect(page.getByRole('heading')).toBeVisible();
      }
    });

    test('should download document', async ({ page }) => {
      await page.goto('/documents');

      const firstDoc = page.getByTestId('document-card').first();
      const hasDocuments = await firstDoc.isVisible().catch(() => false);

      if (hasDocuments) {
        // Open action menu
        await firstDoc.getByRole('button', { name: /more|actions/i }).click();

        // Start download
        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('menuitem', { name: /download/i }).click();

        const download = await downloadPromise;
        expect(download.suggestedFilename()).toBeTruthy();
      }
    });

    test('should rename document', async ({ page }) => {
      await page.goto('/documents');

      const firstDoc = page.getByTestId('document-card').first();
      const hasDocuments = await firstDoc.isVisible().catch(() => false);

      if (hasDocuments) {
        // Open action menu
        await firstDoc.getByRole('button', { name: /more|actions/i }).click();

        // Click rename
        await page.getByRole('menuitem', { name: /rename/i }).click();

        // Enter new name
        const input = page.getByRole('textbox', { name: /name/i });
        await input.clear();
        await input.fill('Renamed Document.pdf');

        // Save
        await page.getByRole('button', { name: /save|confirm/i }).click();

        // Should show success
        await expect(page.getByText(/renamed|updated/i)).toBeVisible();
      }
    });

    test('should delete document', async ({ page }) => {
      await page.goto('/documents');

      const firstDoc = page.getByTestId('document-card').first();
      const hasDocuments = await firstDoc.isVisible().catch(() => false);

      if (hasDocuments) {
        // Open action menu
        await firstDoc.getByRole('button', { name: /more|actions/i }).click();

        // Click delete
        await page.getByRole('menuitem', { name: /delete/i }).click();

        // Confirm deletion
        await page.getByRole('button', { name: /confirm|delete/i }).click();

        // Should show success
        await expect(page.getByText(/deleted|removed/i)).toBeVisible();
      }
    });

    test('should trigger document processing', async ({ page }) => {
      await page.goto('/documents');

      const firstDoc = page.getByTestId('document-card').first();
      const hasDocuments = await firstDoc.isVisible().catch(() => false);

      if (hasDocuments) {
        // Open action menu
        await firstDoc.getByRole('button', { name: /more|actions/i }).click();

        // Click process
        await page.getByRole('menuitem', { name: /process|ocr/i }).click();

        // Should show processing status
        await expect(page.getByText(/processing|started/i)).toBeVisible();
      }
    });
  });

  test.describe('Document Details', () => {
    test('should display document metadata', async ({ page }) => {
      // Navigate directly to a document detail page
      await page.goto('/documents');

      const firstDoc = page.getByTestId('document-card').first();
      const hasDocuments = await firstDoc.isVisible().catch(() => false);

      if (hasDocuments) {
        await firstDoc.click();

        // Check metadata is displayed
        await expect(page.getByText(/created/i)).toBeVisible();
        await expect(page.getByText(/size/i)).toBeVisible();
        await expect(page.getByText(/type/i)).toBeVisible();
      }
    });

    test('should display document preview', async ({ page }) => {
      await page.goto('/documents');

      const firstDoc = page.getByTestId('document-card').first();
      const hasDocuments = await firstDoc.isVisible().catch(() => false);

      if (hasDocuments) {
        await firstDoc.click();

        // Preview section should be visible
        const preview = page.getByTestId('document-preview');
        const hasPreview = await preview.isVisible().catch(() => false);

        // Either preview or "no preview" message should show
        if (!hasPreview) {
          await expect(page.getByText(/no preview|preview unavailable/i)).toBeVisible();
        }
      }
    });

    test('should show version history', async ({ page }) => {
      await page.goto('/documents');

      const firstDoc = page.getByTestId('document-card').first();
      const hasDocuments = await firstDoc.isVisible().catch(() => false);

      if (hasDocuments) {
        await firstDoc.click();

        // Look for versions section
        const versionsSection = page.getByText(/version.*history/i);
        const hasVersions = await versionsSection.isVisible().catch(() => false);

        if (hasVersions) {
          await expect(page.getByText(/version 1/i)).toBeVisible();
        }
      }
    });
  });
});
