/**
 * Settings E2E Tests
 *
 * Tests all settings pages functionality including profile,
 * appearance, security, notifications, and organization settings.
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

// Helper to wait for settings page
async function waitForSettingsPage(page: Page) {
  await expect(page.getByText(/manage your account/i)).toBeVisible({
    timeout: 15000,
  });
}

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test.describe('Main Settings Page', () => {
    test('should display settings page', async ({ page }) => {
      await page.goto('/settings');
      await waitForSettingsPage(page);

      await expect(page.getByText(/manage your account/i)).toBeVisible();
    });

    test('should display profile section', async ({ page }) => {
      await page.goto('/settings');
      await waitForSettingsPage(page);

      await expect(page.getByText(/profile/i).first()).toBeVisible();
    });

    test('should display quick settings navigation', async ({ page }) => {
      await page.goto('/settings');
      await waitForSettingsPage(page);

      await expect(page.getByText(/quick settings/i)).toBeVisible();
    });

    test('should display danger zone section', async ({ page }) => {
      await page.goto('/settings');
      await waitForSettingsPage(page);

      await expect(page.getByText(/danger zone/i)).toBeVisible();
    });

    test('should have profile name input', async ({ page }) => {
      await page.goto('/settings');
      await waitForSettingsPage(page);

      await expect(page.getByLabel(/full name/i)).toBeVisible();
    });

    test('should open export data dialog', async ({ page }) => {
      await page.goto('/settings');
      await waitForSettingsPage(page);

      await page.getByRole('button', { name: /export my data/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText(/export your data/i)).toBeVisible();
    });

    test('should close export dialog', async ({ page }) => {
      await page.goto('/settings');
      await waitForSettingsPage(page);

      await page.getByRole('button', { name: /export my data/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      await page.getByRole('button', { name: /cancel/i }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('should open delete account dialog', async ({ page }) => {
      await page.goto('/settings');
      await waitForSettingsPage(page);

      await page.getByRole('button', { name: /delete my account/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText(/this action cannot be undone/i)).toBeVisible();
    });

    test('should require DELETE confirmation for account deletion', async ({ page }) => {
      await page.goto('/settings');
      await waitForSettingsPage(page);

      await page.getByRole('button', { name: /delete my account/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Delete button should be disabled until DELETE is typed
      const deleteButton = page.getByRole('dialog').getByRole('button', { name: /delete my account/i });
      await expect(deleteButton).toBeDisabled();

      // Type DELETE to enable
      await page.getByPlaceholder('DELETE').fill('DELETE');
      await expect(deleteButton).not.toBeDisabled();
    });
  });

  test.describe('Appearance Settings', () => {
    test('should display appearance settings page', async ({ page }) => {
      await page.goto('/settings/appearance');

      await expect(page.getByText(/appearance/i).first()).toBeVisible({
        timeout: 15000,
      });
    });

    test('should display theme section', async ({ page }) => {
      await page.goto('/settings/appearance');

      await expect(page.getByText(/theme/i).first()).toBeVisible({
        timeout: 15000,
      });
    });

    test('should have theme options', async ({ page }) => {
      await page.goto('/settings/appearance');

      // Wait for page to load
      await expect(page.getByText(/appearance/i).first()).toBeVisible({
        timeout: 15000,
      });

      // Should have light, dark, or system options
      const themeText = await page.locator('body').textContent();
      expect(
        themeText?.includes('Light') ||
        themeText?.includes('Dark') ||
        themeText?.includes('System')
      ).toBe(true);
    });
  });

  test.describe('Security Settings', () => {
    test('should display security settings page', async ({ page }) => {
      await page.goto('/settings/security');

      await expect(page.getByText(/security/i).first()).toBeVisible({
        timeout: 15000,
      });
    });

    test('should display password section', async ({ page }) => {
      await page.goto('/settings/security');

      await expect(page.getByText(/password/i).first()).toBeVisible({
        timeout: 15000,
      });
    });
  });

  test.describe('Notifications Settings', () => {
    test('should display notifications settings page', async ({ page }) => {
      await page.goto('/settings/notifications');

      await expect(page.getByText(/notification/i).first()).toBeVisible({
        timeout: 15000,
      });
    });

    test('should display email preferences', async ({ page }) => {
      await page.goto('/settings/notifications');

      await expect(page.getByText(/email/i).first()).toBeVisible({
        timeout: 15000,
      });
    });
  });

  test.describe('Organization Settings', () => {
    test('should display organization settings page', async ({ page }) => {
      await page.goto('/settings/organization');

      await expect(page.getByText(/organization/i).first()).toBeVisible({
        timeout: 15000,
      });
    });

    test('should display organization details', async ({ page }) => {
      await page.goto('/settings/organization');

      // Wait for page to load
      await expect(page.getByText(/organization/i).first()).toBeVisible({
        timeout: 15000,
      });

      // Should show some organization content
      await expect(page.getByRole('main')).toBeVisible();
    });

    test('should display team members section', async ({ page }) => {
      await page.goto('/settings/organization');

      await expect(page.getByText(/team members|members/i).first()).toBeVisible({
        timeout: 15000,
      });
    });
  });

  test.describe('Navigation Between Settings Pages', () => {
    test('should navigate from main settings to appearance', async ({ page }) => {
      await page.goto('/settings');
      await waitForSettingsPage(page);

      await page.getByRole('link', { name: /appearance/i }).click();
      await expect(page).toHaveURL(/settings\/appearance/);
    });

    test('should navigate from main settings to security', async ({ page }) => {
      await page.goto('/settings');
      await waitForSettingsPage(page);

      await page.getByRole('link', { name: /security/i }).click();
      await expect(page).toHaveURL(/settings\/security/);
    });

    test('should navigate from main settings to notifications', async ({ page }) => {
      await page.goto('/settings');
      await waitForSettingsPage(page);

      await page.getByRole('link', { name: /notification/i }).click();
      await expect(page).toHaveURL(/settings\/notification/);
    });

    test('should navigate from main settings to organization', async ({ page }) => {
      await page.goto('/settings');
      await waitForSettingsPage(page);

      await page.getByRole('link', { name: /organization/i }).click();
      await expect(page).toHaveURL(/settings\/organization/);
    });
  });
});
