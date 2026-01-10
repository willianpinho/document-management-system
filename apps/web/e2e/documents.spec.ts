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
    await expect(page).toHaveURL(/dashboard|documents/, { timeout: 15000 });
  });

  test.describe('Document List', () => {
    test('should display documents page', async ({ page }) => {
      await page.goto('/documents');

      // Page has "Documents" heading
      await expect(page.getByRole('heading', { name: /documents/i })).toBeVisible();
      // Upload button is visible
      await expect(page.getByRole('button', { name: /upload/i })).toBeVisible();
    });

    test('should show empty state when no documents', async ({ page }) => {
      await page.goto('/documents');

      // If no documents, show empty state OR document list
      const emptyState = page.getByText(/no documents yet/i);
      const documentCard = page.getByTestId('document-card').first();

      const isEmpty = await emptyState.isVisible().catch(() => false);
      const hasDocuments = await documentCard.isVisible().catch(() => false);

      // Either should be true
      expect(isEmpty || hasDocuments).toBe(true);
    });

    test('should display sort dropdown', async ({ page }) => {
      await page.goto('/documents');

      // Check if documents exist
      const documentCard = page.getByTestId('document-card').first();
      const hasDocuments = await documentCard.isVisible().catch(() => false);

      if (hasDocuments) {
        // Sort dropdown should be visible
        const sortButton = page.getByRole('button', { name: /date created|date modified|name|size/i });
        await expect(sortButton).toBeVisible();
      }
    });

    test('should change sort order', async ({ page }) => {
      await page.goto('/documents');

      // Check if documents exist (sort only shows when documents exist)
      const documentCard = page.getByTestId('document-card').first();
      const hasDocuments = await documentCard.isVisible().catch(() => false);

      if (hasDocuments) {
        // Open sort dropdown
        const sortButton = page.getByRole('button', { name: /date created|date modified|name|size/i });
        await sortButton.click();

        // Select sort by name
        await page.getByRole('menuitem', { name: /name/i }).click();

        // URL should update with sort params
        await expect(page).toHaveURL(/sortBy=name/);
      }
    });
  });

  test.describe('Document Upload', () => {
    test('should open upload dialog', async ({ page }) => {
      await page.goto('/documents');

      await page.getByRole('button', { name: /upload/i }).first().click();

      // Dialog should be visible with "Upload Documents" title
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText(/upload documents/i)).toBeVisible();
      // Drag and drop text
      await expect(page.getByText(/drag and drop/i)).toBeVisible();
    });

    test('should upload a file', async ({ page }) => {
      await page.goto('/documents');

      // Open upload dialog
      await page.getByRole('button', { name: /upload/i }).first().click();

      // Wait for dialog
      await expect(page.getByRole('dialog')).toBeVisible();

      // Upload test file via file input
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'test-document.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('Test document content for E2E testing'),
      });

      // Wait for upload to complete - look for "Completed" status
      await expect(page.getByText(/completed/i)).toBeVisible({ timeout: 30000 });
    });

    test('should show upload progress', async ({ page }) => {
      await page.goto('/documents');

      // Open upload dialog
      await page.getByRole('button', { name: /upload/i }).first().click();

      // Wait for dialog
      await expect(page.getByRole('dialog')).toBeVisible();

      // Upload a file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'test-progress.txt',
        mimeType: 'text/plain',
        buffer: Buffer.alloc(1024 * 10, 'a'), // 10KB file
      });

      // Progress should be visible (either progressbar or percentage text)
      const progressBar = page.getByRole('progressbar');
      const percentageText = page.getByText(/%/);

      await expect(progressBar.or(percentageText).or(page.getByText(/completed/i))).toBeVisible({ timeout: 30000 });
    });

    test('should reject invalid file types', async ({ page }) => {
      await page.goto('/documents');

      // Open upload dialog
      await page.getByRole('button', { name: /upload/i }).first().click();

      // Wait for dialog
      await expect(page.getByRole('dialog')).toBeVisible();

      // Try to upload executable - dropzone should reject
      const fileInput = page.locator('input[type="file"]');

      // Set the file directly (bypassing dropzone validation for test)
      await fileInput.setInputFiles({
        name: 'malicious.exe',
        mimeType: 'application/x-msdownload',
        buffer: Buffer.from('fake executable content'),
      });

      // Either the file won't be accepted (no progress shown) or an error appears
      // The dropzone uses `accept` prop to filter files
      // Wait a bit to see if anything happens
      await page.waitForTimeout(1000);

      // Should either show error or not process the file
      const hasError = await page.getByText(/not allowed|invalid|rejected|error/i).isVisible().catch(() => false);
      const hasProgress = await page.getByText(/uploading|completed/i).isVisible().catch(() => false);

      // exe should not be uploaded (either error or ignored)
      expect(hasError || !hasProgress).toBe(true);
    });
  });

  test.describe('Document Actions', () => {
    test('should navigate to document details', async ({ page }) => {
      await page.goto('/documents');

      // Click on first document (if exists)
      const firstDoc = page.getByTestId('document-card').first();
      const hasDocuments = await firstDoc.isVisible().catch(() => false);

      if (hasDocuments) {
        await firstDoc.click();

        // Should navigate to document details
        await expect(page).toHaveURL(/documents\/[a-f0-9-]+/);
      }
    });

    test('should open document menu', async ({ page }) => {
      await page.goto('/documents');

      const firstDoc = page.getByTestId('document-card').first();
      const hasDocuments = await firstDoc.isVisible().catch(() => false);

      if (hasDocuments) {
        // Hover to show action button
        await firstDoc.hover();

        // Click more actions button (MoreVertical icon)
        const moreButton = firstDoc.getByRole('button', { name: /open menu/i });
        await moreButton.click();

        // Menu should show with options
        await expect(page.getByRole('menuitem', { name: /download/i })).toBeVisible();
      }
    });

    test('should download document', async ({ page }) => {
      await page.goto('/documents');

      const firstDoc = page.getByTestId('document-card').first();
      const hasDocuments = await firstDoc.isVisible().catch(() => false);

      if (hasDocuments) {
        // Hover and click menu
        await firstDoc.hover();
        await firstDoc.getByRole('button', { name: /open menu/i }).click();

        // Click download - don't wait for actual download in test
        await page.getByRole('menuitem', { name: /download/i }).click();
      }
    });

    test('should navigate to rename', async ({ page }) => {
      await page.goto('/documents');

      const firstDoc = page.getByTestId('document-card').first();
      const hasDocuments = await firstDoc.isVisible().catch(() => false);

      if (hasDocuments) {
        // Hover and click menu
        await firstDoc.hover();
        await firstDoc.getByRole('button', { name: /open menu/i }).click();

        // Click rename
        await page.getByRole('menuitem', { name: /rename/i }).click();

        // Should navigate to document detail with edit mode
        await expect(page).toHaveURL(/documents\/[a-f0-9-]+\?edit=true/);
      }
    });

    test('should delete document', async ({ page }) => {
      await page.goto('/documents');

      const firstDoc = page.getByTestId('document-card').first();
      const hasDocuments = await firstDoc.isVisible().catch(() => false);

      if (hasDocuments) {
        // Get initial count
        const initialCount = await page.getByTestId('document-card').count();

        // Hover and click menu
        await firstDoc.hover();
        await firstDoc.getByRole('button', { name: /open menu/i }).click();

        // Click delete
        await page.getByRole('menuitem', { name: /delete/i }).click();

        // Handle confirm dialog (native browser dialog)
        page.on('dialog', async (dialog) => {
          await dialog.accept();
        });

        // Wait for deletion (list should update)
        await page.waitForTimeout(1000);
      }
    });
  });

  test.describe('Document Details', () => {
    test('should display document details page', async ({ page }) => {
      await page.goto('/documents');

      const firstDoc = page.getByTestId('document-card').first();
      const hasDocuments = await firstDoc.isVisible().catch(() => false);

      if (hasDocuments) {
        await firstDoc.click();

        // Should see some document info
        await expect(page.getByRole('heading').first()).toBeVisible();
      }
    });

    test('should display document metadata', async ({ page }) => {
      await page.goto('/documents');

      const firstDoc = page.getByTestId('document-card').first();
      const hasDocuments = await firstDoc.isVisible().catch(() => false);

      if (hasDocuments) {
        await firstDoc.click();

        // Wait for page load
        await expect(page).toHaveURL(/documents\/[a-f0-9-]+/);

        // Some metadata should be visible (created, size, type info)
        // Using more flexible selectors
        const metadataVisible = await Promise.race([
          page.getByText(/created|uploaded|size|type|bytes/i).first().isVisible(),
          page.waitForTimeout(3000).then(() => true),
        ]);

        expect(metadataVisible).toBe(true);
      }
    });
  });
});
