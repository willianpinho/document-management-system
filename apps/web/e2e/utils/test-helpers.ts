/**
 * E2E Test Helpers
 *
 * Shared utilities for Playwright E2E tests.
 */

import { type Page, expect } from '@playwright/test';

// Test user credentials (from seed data)
export const TEST_USER = {
  email: 'admin@dms-test.com',
  password: 'admin123!',
  name: 'Admin User',
};

/**
 * Login helper - authenticates the user and waits for redirect
 */
export async function login(
  page: Page,
  email: string = TEST_USER.email,
  password: string = TEST_USER.password
): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('email-input').fill(email);
  await page.getByTestId('password-input').fill(password);
  await page.getByTestId('login-button').click();
  await expect(page).toHaveURL(/dashboard|documents/, { timeout: 20000 });
}

/**
 * Logout helper - logs out the current user
 */
export async function logout(page: Page): Promise<void> {
  const userMenuButton = page.getByTestId('user-menu');
  await expect(userMenuButton).toBeVisible({ timeout: 10000 });
  await userMenuButton.click();

  const logoutButton = page.getByTestId('logout-button');
  await expect(logoutButton).toBeVisible();
  await logoutButton.click();

  await expect(page).toHaveURL(/login/, { timeout: 15000 });
}

/**
 * Wait for documents page to fully load
 */
export async function waitForDocumentsPage(page: Page): Promise<void> {
  await expect(
    page.getByRole('main').getByRole('heading', { name: /documents/i })
  ).toBeVisible({ timeout: 10000 });
}

/**
 * Wait for search page to fully load
 */
export async function waitForSearchPage(page: Page): Promise<void> {
  await expect(
    page.getByRole('main').getByRole('heading', { name: /search/i })
  ).toBeVisible({ timeout: 10000 });
}

/**
 * Check if documents exist on the page
 */
export async function hasDocuments(page: Page): Promise<boolean> {
  const documentCard = page.getByTestId('document-card').first();
  return await documentCard.isVisible({ timeout: 5000 }).catch(() => false);
}

/**
 * Generate a unique email for registration tests
 */
export function generateUniqueEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
}

/**
 * Generate a unique folder name
 */
export function generateUniqueFolderName(): string {
  return `Test Folder ${Date.now()}`;
}

/**
 * Upload a test file via the upload dialog
 */
export async function uploadTestFile(
  page: Page,
  fileName: string = 'test-document.txt',
  content: string = 'Test document content for E2E testing'
): Promise<void> {
  // Open upload dialog
  await page.getByRole('button', { name: /upload/i }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();

  // Upload file
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: fileName,
    mimeType: 'text/plain',
    buffer: Buffer.from(content),
  });

  // Wait for upload to complete
  await expect(
    page.getByText(/completed|uploaded|success/i)
      .or(page.getByRole('progressbar'))
  ).toBeVisible({ timeout: 30000 });
}

/**
 * Create a new folder via the dialog
 */
export async function createFolder(page: Page, folderName: string): Promise<void> {
  await page.getByRole('main').getByRole('button', { name: /new folder/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.getByLabel(/folder name/i).fill(folderName);
  await page.getByRole('button', { name: /^create$/i }).click();

  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });
}

/**
 * Search for documents
 */
export async function performSearch(page: Page, query: string): Promise<void> {
  const searchInput = page.getByRole('main').getByPlaceholder(/search/i);
  await searchInput.fill(query);
  await page.getByRole('button', { name: /^search$/i }).click();
  await expect(page).toHaveURL(/q=/, { timeout: 10000 });
}

/**
 * Wait for search results to load
 */
export async function waitForSearchResults(page: Page): Promise<void> {
  await expect(
    page.getByText(/found \d+ result/i)
      .or(page.getByText(/no results found/i))
  ).toBeVisible({ timeout: 10000 });
}
