/**
 * Search E2E Tests
 *
 * Tests the search functionality including full-text search,
 * semantic search, and filters.
 */

import { test, expect, type Page } from '@playwright/test';

test.describe('Search', () => {
  // Authenticate before each test
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/dashboard|documents/, { timeout: 15000 });
  });

  test.describe('Search Page', () => {
    test('should display search page', async ({ page }) => {
      await page.goto('/search');

      // Page has "Search" heading
      await expect(page.getByRole('heading', { name: /search/i })).toBeVisible();
      // Search input is visible
      await expect(page.getByPlaceholder(/search/i)).toBeVisible();
    });

    test('should toggle between standard and AI search', async ({ page }) => {
      await page.goto('/search');

      // Find toggle buttons
      const standardBtn = page.getByRole('button', { name: /standard/i });
      const aiBtn = page.getByRole('button', { name: /ai search/i });

      // Click AI search
      await aiBtn.click();

      // AI button should now be the selected variant (has different styling)
      // The button variant changes, not aria-pressed
      await expect(aiBtn).toHaveClass(/bg-primary/);

      // Click standard search
      await standardBtn.click();
      await expect(standardBtn).toHaveClass(/bg-primary/);
    });
  });

  test.describe('Standard Search', () => {
    test('should search documents', async ({ page }) => {
      await page.goto('/search');

      // Enter search query
      const searchInput = page.getByPlaceholder(/search/i);
      await searchInput.fill('test document');

      // Click search button
      await page.getByRole('button', { name: /^search$/i }).click();

      // Wait for URL to update with query
      await expect(page).toHaveURL(/q=test/);

      // Either results or "no results" should be visible
      const hasResults = await page.getByText(/found \d+ result/i).isVisible().catch(() => false);
      const isEmpty = await page.getByText(/no results found/i).isVisible().catch(() => false);

      expect(hasResults || isEmpty).toBe(true);
    });

    test('should apply file type filter', async ({ page }) => {
      await page.goto('/search');

      // Enter search query
      const searchInput = page.getByPlaceholder(/search/i);
      await searchInput.fill('document');

      // Click file type filter button
      await page.getByRole('button', { name: /file type/i }).click();

      // Select PDF
      await page.getByRole('menuitem', { name: /pdf/i }).click();

      // The filter badge should appear on the button
      await expect(page.getByRole('button', { name: /file type/i }).locator('.badge, [class*="badge"]')).toBeVisible();
    });

    test('should apply date filter', async ({ page }) => {
      await page.goto('/search');

      // Enter search query
      const searchInput = page.getByPlaceholder(/search/i);
      await searchInput.fill('report');

      // Click date filter button
      await page.getByRole('button', { name: /^date$/i }).click();

      // Select past month
      await page.getByRole('menuitem', { name: /past month/i }).click();

      // The filter badge should appear
      await expect(page.getByRole('button', { name: /^date$/i }).locator('.badge, [class*="badge"]')).toBeVisible();
    });

    test('should clear filters', async ({ page }) => {
      await page.goto('/search');

      // Apply filter first
      await page.getByRole('button', { name: /file type/i }).click();
      await page.getByRole('menuitem', { name: /pdf/i }).click();

      // Clear filters button should appear
      await page.getByRole('button', { name: /clear filters/i }).click();

      // Filter badge should be gone
      const badge = page.getByRole('button', { name: /file type/i }).locator('.badge, [class*="badge"]');
      await expect(badge).not.toBeVisible();
    });

    test('should navigate to document from results', async ({ page }) => {
      await page.goto('/search');

      // Enter search query and search
      const searchInput = page.getByPlaceholder(/search/i);
      await searchInput.fill('test');
      await page.getByRole('button', { name: /^search$/i }).click();

      // Wait for results
      await page.waitForTimeout(2000);

      // Click first result card (if exists)
      const resultCard = page.locator('[data-testid="search-result"]').or(
        page.locator('.cursor-pointer').filter({ hasText: /document|folder/i }).first()
      );
      const hasResults = await resultCard.isVisible().catch(() => false);

      if (hasResults) {
        await resultCard.click();
        await expect(page).toHaveURL(/documents\/[a-f0-9-]+|folders\/[a-f0-9-]+/);
      }
    });
  });

  test.describe('Semantic Search', () => {
    test('should perform AI search', async ({ page }) => {
      await page.goto('/search');

      // Switch to AI search
      await page.getByRole('button', { name: /ai search/i }).click();

      // Enter natural language query
      const searchInput = page.getByPlaceholder(/ask a question/i);
      await searchInput.fill('Find invoices from last month');
      await page.getByRole('button', { name: /^search$/i }).click();

      // Wait for search
      await page.waitForTimeout(3000);

      // Results or empty state should be visible
      const hasResults = await page.getByText(/found \d+ result/i).isVisible().catch(() => false);
      const isEmpty = await page.getByText(/no results found/i).isVisible().catch(() => false);

      expect(hasResults || isEmpty).toBe(true);
    });

    test('should show search suggestions', async ({ page }) => {
      await page.goto('/search');

      // Switch to AI search
      await page.getByRole('button', { name: /ai search/i }).click();

      // Suggestions should be visible when no query entered
      const suggestionButtons = page.getByRole('button', { name: /invoices|contracts|reports|budget/i });
      await expect(suggestionButtons.first()).toBeVisible();
    });

    test('should click suggestion to search', async ({ page }) => {
      await page.goto('/search');

      // Switch to AI search
      await page.getByRole('button', { name: /ai search/i }).click();

      // Click a suggestion
      const suggestionBtn = page.getByRole('button', { name: /find invoices from last month/i });
      const hasSuggestions = await suggestionBtn.isVisible().catch(() => false);

      if (hasSuggestions) {
        await suggestionBtn.click();

        // Search should be triggered (wait for results or empty state)
        await page.waitForTimeout(3000);

        const hasResults = await page.getByText(/found \d+ result/i).isVisible().catch(() => false);
        const isEmpty = await page.getByText(/no results found/i).isVisible().catch(() => false);

        expect(hasResults || isEmpty).toBe(true);
      }
    });
  });

  test.describe('Quick Search', () => {
    test('should search from header', async ({ page }) => {
      await page.goto('/documents');

      // Find header search input (may or may not exist)
      const headerSearch = page.locator('header').getByPlaceholder(/search/i);
      const hasHeaderSearch = await headerSearch.isVisible().catch(() => false);

      if (hasHeaderSearch) {
        await headerSearch.fill('quick search test');
        await headerSearch.press('Enter');

        // Should navigate to search page with query
        await expect(page).toHaveURL(/search\?q=/);
      }
    });
  });
});
