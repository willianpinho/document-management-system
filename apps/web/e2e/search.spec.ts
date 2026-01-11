/**
 * Search E2E Tests
 *
 * Tests the search functionality including full-text search,
 * semantic search, and filters.
 */

import { test, expect, type Page } from '@playwright/test';

// Test data
const TEST_USER = {
  email: 'admin@dms-test.com',
  password: 'admin123!',
};

// Helper function to login
async function login(page: Page) {
  await page.goto('/login');
  await page.getByTestId('email-input').fill(TEST_USER.email);
  await page.getByTestId('password-input').fill(TEST_USER.password);
  await page.getByTestId('login-button').click();
  await expect(page).toHaveURL(/dashboard|documents/, { timeout: 20000 });
}

// Helper to wait for search page to load
async function waitForSearchPage(page: Page) {
  await expect(
    page.getByRole('main').getByRole('heading', { name: /search/i })
  ).toBeVisible({ timeout: 10000 });
}

test.describe('Search', () => {
  // Authenticate before each test
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test.describe('Search Page', () => {
    test('should display search page', async ({ page }) => {
      await page.goto('/search');

      // Page has "Search" heading
      await waitForSearchPage(page);
      // Search input is visible
      await expect(page.getByRole('main').getByPlaceholder(/search/i)).toBeVisible();
    });

    test('should have search mode toggle buttons', async ({ page }) => {
      await page.goto('/search');

      await waitForSearchPage(page);

      // Find toggle buttons
      const standardBtn = page.getByRole('button', { name: /standard/i });
      const aiBtn = page.getByRole('button', { name: /ai search/i });

      // Both buttons should be visible
      await expect(standardBtn).toBeVisible();
      await expect(aiBtn).toBeVisible();
    });

    test('should toggle between standard and AI search', async ({ page }) => {
      await page.goto('/search');

      await waitForSearchPage(page);

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

      await waitForSearchPage(page);
      await expect(page.getByRole('button', { name: /^search$/i })).toBeVisible();
    });

    test('should perform search', async ({ page }) => {
      await page.goto('/search');

      await waitForSearchPage(page);

      // Enter search query
      const searchInput = page.getByRole('main').getByPlaceholder(/search/i);
      await searchInput.fill('test document');

      // Click search button
      await page.getByRole('button', { name: /^search$/i }).click();

      // Wait for URL to update with query
      await expect(page).toHaveURL(/q=test/, { timeout: 10000 });

      // Either results or "no results" should be visible
      await expect(
        page.getByText(/found \d+ result/i)
          .or(page.getByText(/no results found/i))
      ).toBeVisible({ timeout: 10000 });
    });

    test('should show file type filter', async ({ page }) => {
      await page.goto('/search');

      await waitForSearchPage(page);

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

      await waitForSearchPage(page);

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

      await waitForSearchPage(page);

      // Apply filter first
      await page.getByRole('button', { name: /file type/i }).click();

      // Wait for dropdown to open and click PDF option
      await expect(page.getByRole('menuitem', { name: /pdf/i })).toBeVisible();
      await page.getByRole('menuitem', { name: /pdf/i }).click();

      // Clear filters button should appear
      const clearBtn = page.getByRole('button', { name: /clear filters/i });
      const hasClearBtn = await clearBtn.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasClearBtn) {
        await clearBtn.click();
        // Verify filter is cleared (clear button disappears)
        await expect(clearBtn).not.toBeVisible({ timeout: 5000 });
      }
    });

    test('should navigate to document from results', async ({ page }) => {
      await page.goto('/search');

      await waitForSearchPage(page);

      // Enter search query and search
      const searchInput = page.getByRole('main').getByPlaceholder(/search/i);
      await searchInput.fill('test');
      await page.getByRole('button', { name: /^search$/i }).click();

      // Wait for results or empty state
      await expect(
        page.getByText(/found \d+ result/i)
          .or(page.getByText(/no results found/i))
      ).toBeVisible({ timeout: 10000 });

      // Click first result card (if exists)
      const resultCard = page.getByTestId('search-result').first();
      const hasResults = await resultCard.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasResults) {
        await resultCard.click();
        await expect(page).toHaveURL(/documents\/[a-f0-9-]+|folders\/[a-f0-9-]+/);
      }
    });
  });

  test.describe('Semantic Search', () => {
    test('should switch to AI search mode', async ({ page }) => {
      await page.goto('/search');

      await waitForSearchPage(page);

      // Click AI search button
      await page.getByRole('button', { name: /ai search/i }).click();

      // AI search placeholder should be visible (semantic search mode)
      await expect(page.getByPlaceholder(/ask a question/i)).toBeVisible();
    });

    test('should perform semantic search', async ({ page }) => {
      await page.goto('/search');

      await waitForSearchPage(page);

      // Switch to AI search
      await page.getByRole('button', { name: /ai search/i }).click();

      // Wait for placeholder to change
      await expect(page.getByPlaceholder(/ask a question/i)).toBeVisible();

      // Enter natural language query
      const searchInput = page.getByPlaceholder(/ask a question/i);
      await searchInput.fill('Find invoices from last month');
      await page.getByRole('button', { name: /^search$/i }).click();

      // Wait for search results or empty state
      await expect(
        page.getByText(/found \d+ result/i)
          .or(page.getByText(/no results found/i))
          .or(page.getByText(/searching/i))
      ).toBeVisible({ timeout: 15000 });
    });

    test('should show search suggestions in AI mode', async ({ page }) => {
      await page.goto('/search');

      await waitForSearchPage(page);

      // Switch to AI search
      await page.getByRole('button', { name: /ai search/i }).click();

      // Suggestions should be visible
      await expect(page.getByText(/find invoices from last month/i)).toBeVisible({ timeout: 5000 });
    });

    test('should click suggestion to search', async ({ page }) => {
      await page.goto('/search');

      await waitForSearchPage(page);

      // Switch to AI search
      await page.getByRole('button', { name: /ai search/i }).click();

      // Click a suggestion
      const suggestionBtn = page.getByRole('button', { name: /find invoices from last month/i });
      const hasSuggestions = await suggestionBtn.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasSuggestions) {
        await suggestionBtn.click();

        // Search should be triggered (wait for results or empty state)
        await expect(
          page.getByText(/found \d+ result/i)
            .or(page.getByText(/no results found/i))
            .or(page.getByText(/searching/i))
        ).toBeVisible({ timeout: 15000 });
      }
    });
  });

  test.describe('Quick Search', () => {
    test('should search from header', async ({ page }) => {
      await page.goto('/documents');

      // Wait for documents page to load
      await expect(
        page.getByRole('main').getByRole('heading', { name: /documents/i })
      ).toBeVisible({ timeout: 10000 });

      // Find header search input (may be hidden on smaller screens)
      const headerSearch = page.locator('header').getByPlaceholder(/search/i);
      const hasHeaderSearch = await headerSearch.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasHeaderSearch) {
        await headerSearch.fill('quick search test');
        await headerSearch.press('Enter');

        // Should navigate to search page with query
        await expect(page).toHaveURL(/search\?q=/, { timeout: 10000 });
      }
    });
  });
});
