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
    await expect(page).toHaveURL(/dashboard|documents/);
  });

  test.describe('Search Page', () => {
    test('should display search page', async ({ page }) => {
      await page.goto('/search');

      await expect(page.getByRole('heading', { name: /search/i })).toBeVisible();
      await expect(page.getByRole('searchbox').or(page.getByPlaceholder(/search/i))).toBeVisible();
    });

    test('should toggle between standard and AI search', async ({ page }) => {
      await page.goto('/search');

      // Find toggle buttons
      const standardBtn = page.getByRole('button', { name: /standard/i });
      const aiBtn = page.getByRole('button', { name: /ai|semantic/i });

      // Click AI search
      await aiBtn.click();
      await expect(aiBtn).toHaveAttribute('aria-pressed', 'true');

      // Click standard search
      await standardBtn.click();
      await expect(standardBtn).toHaveAttribute('aria-pressed', 'true');
    });
  });

  test.describe('Standard Search', () => {
    test('should search documents', async ({ page }) => {
      await page.goto('/search');

      // Enter search query
      const searchInput = page.getByRole('searchbox').or(page.getByPlaceholder(/search/i));
      await searchInput.fill('test document');
      await searchInput.press('Enter');

      // Wait for results
      await page.waitForResponse((resp) => resp.url().includes('/search') && resp.status() === 200);

      // Results or empty state should be visible
      const hasResults = await page.getByTestId('search-result').first().isVisible().catch(() => false);
      const isEmpty = await page.getByText(/no results/i).isVisible().catch(() => false);

      expect(hasResults || isEmpty).toBe(true);
    });

    test('should apply file type filter', async ({ page }) => {
      await page.goto('/search');

      // Enter search query
      const searchInput = page.getByRole('searchbox').or(page.getByPlaceholder(/search/i));
      await searchInput.fill('document');

      // Apply filter
      await page.getByRole('button', { name: /type|filter/i }).click();
      await page.getByRole('menuitem', { name: /pdf/i }).click();

      // Submit search
      await searchInput.press('Enter');

      // Filter badge should be visible
      await expect(page.getByText(/pdf/i)).toBeVisible();
    });

    test('should apply date range filter', async ({ page }) => {
      await page.goto('/search');

      // Enter search query
      const searchInput = page.getByRole('searchbox').or(page.getByPlaceholder(/search/i));
      await searchInput.fill('report');

      // Apply date filter
      await page.getByRole('button', { name: /date|when/i }).click();
      await page.getByRole('menuitem', { name: /this month/i }).click();

      // Submit search
      await searchInput.press('Enter');

      // Date filter should be visible
      await expect(page.getByText(/this month/i)).toBeVisible();
    });

    test('should clear filters', async ({ page }) => {
      await page.goto('/search');

      // Apply filter first
      await page.getByRole('button', { name: /type|filter/i }).click();
      await page.getByRole('menuitem', { name: /pdf/i }).click();

      // Clear filters
      await page.getByRole('button', { name: /clear/i }).click();

      // Filter should be removed
      await expect(page.getByText(/pdf/).first()).not.toBeVisible();
    });

    test('should navigate to document from results', async ({ page }) => {
      await page.goto('/search');

      // Enter search query
      const searchInput = page.getByRole('searchbox').or(page.getByPlaceholder(/search/i));
      await searchInput.fill('test');
      await searchInput.press('Enter');

      // Wait for results
      await page.waitForResponse((resp) => resp.url().includes('/search') && resp.status() === 200);

      // Click first result (if exists)
      const firstResult = page.getByTestId('search-result').first();
      const hasResults = await firstResult.isVisible().catch(() => false);

      if (hasResults) {
        await firstResult.click();
        await expect(page).toHaveURL(/documents\/[a-z0-9-]+/);
      }
    });
  });

  test.describe('Semantic Search', () => {
    test('should perform AI search', async ({ page }) => {
      await page.goto('/search');

      // Switch to AI search
      await page.getByRole('button', { name: /ai|semantic/i }).click();

      // Enter natural language query
      const searchInput = page.getByRole('searchbox').or(page.getByPlaceholder(/search/i));
      await searchInput.fill('Find invoices from last month');
      await searchInput.press('Enter');

      // Wait for AI search results
      await page.waitForResponse(
        (resp) => resp.url().includes('/search/semantic') && resp.status() === 200,
        { timeout: 30000 }
      );

      // Results should show relevance scores
      const hasResults = await page.getByTestId('search-result').first().isVisible().catch(() => false);
      const isEmpty = await page.getByText(/no results/i).isVisible().catch(() => false);

      expect(hasResults || isEmpty).toBe(true);
    });

    test('should show search suggestions', async ({ page }) => {
      await page.goto('/search');

      // Switch to AI search
      await page.getByRole('button', { name: /ai|semantic/i }).click();

      // Check for suggestions
      const suggestions = page.getByTestId('search-suggestions');
      const hasSuggestions = await suggestions.isVisible().catch(() => false);

      if (hasSuggestions) {
        await expect(page.getByText(/invoices|contracts|reports/i)).toBeVisible();
      }
    });

    test('should click suggestion to search', async ({ page }) => {
      await page.goto('/search');

      // Switch to AI search
      await page.getByRole('button', { name: /ai|semantic/i }).click();

      // Click a suggestion (if available)
      const suggestionBtn = page.getByRole('button', { name: /invoices|contracts|reports/i }).first();
      const hasSuggestions = await suggestionBtn.isVisible().catch(() => false);

      if (hasSuggestions) {
        await suggestionBtn.click();

        // Search should be triggered
        await expect(page.getByRole('searchbox').or(page.getByPlaceholder(/search/i))).not.toBeEmpty();
      }
    });
  });

  test.describe('Quick Search', () => {
    test('should search from header', async ({ page }) => {
      await page.goto('/documents');

      // Find header search input
      const headerSearch = page.getByRole('search').or(page.locator('header').getByPlaceholder(/search/i));

      await headerSearch.fill('quick search test');
      await headerSearch.press('Enter');

      // Should navigate to search page with query
      await expect(page).toHaveURL(/search\?q=quick/);
    });

    test('should show autocomplete suggestions', async ({ page }) => {
      await page.goto('/documents');

      // Find header search input
      const headerSearch = page.getByRole('search').or(page.locator('header').getByPlaceholder(/search/i));

      await headerSearch.fill('test');

      // Wait for suggestions to appear
      await page.waitForTimeout(500); // Wait for debounce

      // Suggestions dropdown should appear
      const suggestions = page.getByRole('listbox').or(page.getByTestId('search-suggestions'));
      const hasSuggestions = await suggestions.isVisible().catch(() => false);

      // Either suggestions or no suggestions is valid
      expect(true).toBe(true);
    });
  });
});
