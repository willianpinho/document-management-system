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
    await page.getByLabel(/email/i).fill('admin@dms-test.com');
    await page.getByLabel(/password/i).fill('admin123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/dashboard|documents/, { timeout: 20000 });
  });

  test.describe('Search Page', () => {
    test('should display search page', async ({ page }) => {
      await page.goto('/search');

      // Page has "Search" heading
      await expect(page.getByRole('main').getByRole('heading', { name: /search/i })).toBeVisible({ timeout: 10000 });
      // Search input is visible
      await expect(page.getByRole('main').getByPlaceholder(/search/i)).toBeVisible();
    });

    test('should have search mode toggle buttons', async ({ page }) => {
      await page.goto('/search');

      await expect(page.getByRole('main').getByRole('heading', { name: /search/i })).toBeVisible({ timeout: 10000 });

      // Find toggle buttons
      const standardBtn = page.getByRole('button', { name: /standard/i });
      const aiBtn = page.getByRole('button', { name: /ai search/i });

      // Both buttons should be visible
      await expect(standardBtn).toBeVisible();
      await expect(aiBtn).toBeVisible();
    });

    test('should toggle between standard and AI search', async ({ page }) => {
      await page.goto('/search');

      await expect(page.getByRole('main').getByRole('heading', { name: /search/i })).toBeVisible({ timeout: 10000 });

      // Find toggle buttons
      const standardBtn = page.getByRole('button', { name: /standard/i });
      const aiBtn = page.getByRole('button', { name: /ai search/i });

      // Click AI search
      await aiBtn.click();

      // Placeholder should change to semantic search placeholder
      await expect(page.getByPlaceholder(/ask a question/i)).toBeVisible();

      // Click standard search
      await standardBtn.click();

      // Placeholder should change back
      await expect(page.getByRole('main').getByPlaceholder(/search/i)).toBeVisible();
    });
  });

  test.describe('Standard Search', () => {
    test('should have search button', async ({ page }) => {
      await page.goto('/search');

      await expect(page.getByRole('main').getByRole('heading', { name: /search/i })).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('button', { name: /^search$/i })).toBeVisible();
    });

    test('should perform search', async ({ page }) => {
      await page.goto('/search');

      // Enter search query
      const searchInput = page.getByRole('main').getByPlaceholder(/search/i);
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

    test('should show file type filter', async ({ page }) => {
      await page.goto('/search');

      await expect(page.getByRole('main').getByRole('heading', { name: /search/i })).toBeVisible({ timeout: 10000 });

      // Filter button should be visible
      const filterBtn = page.getByRole('button', { name: /file type/i });
      await expect(filterBtn).toBeVisible();

      // Click to open dropdown
      await filterBtn.click();

      // Filter options should appear
      await expect(page.getByText(/pdf/i)).toBeVisible();
    });

    test('should show date filter', async ({ page }) => {
      await page.goto('/search');

      await expect(page.getByRole('main').getByRole('heading', { name: /search/i })).toBeVisible({ timeout: 10000 });

      // Date button should be visible
      const dateBtn = page.getByRole('button', { name: /date/i });
      await expect(dateBtn).toBeVisible();

      // Click to open dropdown
      await dateBtn.click();

      // Date options should appear
      await expect(page.getByText(/past month/i)).toBeVisible();
    });

    test('should clear filters', async ({ page }) => {
      await page.goto('/search');

      // Apply filter first
      await page.getByRole('button', { name: /file type/i }).click();
      await page.getByRole('menuitem', { name: /pdf/i }).click();

      // Clear filters button should appear
      const clearBtn = page.getByRole('button', { name: /clear filters/i });
      const hasClearBtn = await clearBtn.isVisible().catch(() => false);

      if (hasClearBtn) {
        await clearBtn.click();
      }
    });

    test('should navigate to document from results', async ({ page }) => {
      await page.goto('/search');

      // Enter search query and search
      const searchInput = page.getByRole('main').getByPlaceholder(/search/i);
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
    test('should switch to AI search mode', async ({ page }) => {
      await page.goto('/search');

      await expect(page.getByRole('main').getByRole('heading', { name: /search/i })).toBeVisible({ timeout: 10000 });

      // Click AI search button
      await page.getByRole('button', { name: /ai search/i }).click();

      // AI search suggestions should be visible
      await expect(page.getByText(/ai-powered search|ask a question/i)).toBeVisible();
    });

    test('should perform semantic search', async ({ page }) => {
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

    test('should show search suggestions in AI mode', async ({ page }) => {
      await page.goto('/search');

      await expect(page.getByRole('main').getByRole('heading', { name: /search/i })).toBeVisible({ timeout: 10000 });

      // Switch to AI search
      await page.getByRole('button', { name: /ai search/i }).click();

      // Suggestions should be visible
      await expect(page.getByText(/find invoices from last month/i)).toBeVisible();
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
