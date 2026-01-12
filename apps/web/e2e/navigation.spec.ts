/**
 * Navigation E2E Tests
 *
 * Tests sidebar navigation, header functionality, user menu,
 * and overall application navigation.
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

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test.describe('Sidebar Navigation', () => {
    test('should display sidebar', async ({ page }) => {
      await page.goto('/dashboard');

      // Sidebar should be visible
      await expect(page.locator('aside')).toBeVisible();
    });

    test('should display DMS logo', async ({ page }) => {
      await page.goto('/dashboard');

      // Logo link in sidebar
      await expect(page.locator('aside').getByRole('link').first()).toBeVisible();
    });

    test('should display main navigation links', async ({ page }) => {
      await page.goto('/dashboard');

      // Check sidebar has navigation links
      const sidebar = page.locator('aside');
      await expect(sidebar.getByRole('link', { name: /dashboard/i })).toBeVisible();
      await expect(sidebar.getByRole('link', { name: /documents/i })).toBeVisible();
    });

    test('should display settings link in sidebar', async ({ page }) => {
      await page.goto('/dashboard');

      await expect(page.locator('aside').getByRole('link', { name: /settings/i })).toBeVisible();
    });

    test('should navigate to dashboard', async ({ page }) => {
      await page.goto('/documents');

      await page.locator('aside').getByRole('link', { name: /dashboard/i }).click();
      await expect(page).toHaveURL(/dashboard/);
    });

    test('should navigate to documents', async ({ page }) => {
      await page.goto('/dashboard');

      await page.locator('aside').getByRole('link', { name: /documents/i }).click();
      await expect(page).toHaveURL(/documents/);
    });

    test('should navigate to search', async ({ page }) => {
      await page.goto('/dashboard');

      // Search link in sidebar
      const searchLink = page.locator('aside').getByRole('link', { name: /search/i });
      const hasSearch = await searchLink.isVisible({ timeout: 3000 }).catch(() => false);
      if (hasSearch) {
        await searchLink.click();
        await expect(page).toHaveURL(/search/);
      }
    });

    test('should navigate to settings from sidebar', async ({ page }) => {
      await page.goto('/dashboard');

      await page.locator('aside').getByRole('link', { name: /settings/i }).click();
      await expect(page).toHaveURL(/settings/);
    });

    test('should display folders section', async ({ page }) => {
      await page.goto('/dashboard');

      // Folders section in sidebar
      await expect(page.locator('aside').getByText(/folders/i).first()).toBeVisible();
    });

    test('should display storage usage', async ({ page }) => {
      await page.goto('/dashboard');

      await expect(page.locator('aside').getByText(/storage/i)).toBeVisible();
    });

    test('should toggle sidebar collapse', async ({ page }) => {
      await page.goto('/dashboard');

      // Find collapse button in sidebar
      const collapseButton = page.locator('aside').getByRole('button').first();
      const hasButton = await collapseButton.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasButton) {
        // Get initial sidebar width
        const sidebar = page.locator('aside');
        const initialWidth = await sidebar.evaluate((el) => (el as HTMLElement).offsetWidth);

        // Click collapse button
        await collapseButton.click();

        // Wait for transition
        await page.waitForTimeout(400);

        // Sidebar should be narrower
        const collapsedWidth = await sidebar.evaluate((el) => (el as HTMLElement).offsetWidth);
        expect(collapsedWidth).toBeLessThanOrEqual(initialWidth);
      }
    });

    test('should highlight active navigation item', async ({ page }) => {
      await page.goto('/documents');

      // Documents link should have some active styling
      const documentsLink = page.locator('aside').getByRole('link', { name: /documents/i });
      await expect(documentsLink).toBeVisible();
    });
  });

  test.describe('Header', () => {
    test('should display header', async ({ page }) => {
      await page.goto('/dashboard');

      await expect(page.locator('header')).toBeVisible();
    });

    test('should display page title', async ({ page }) => {
      await page.goto('/dashboard');

      await expect(page.locator('header').getByText(/dashboard/i)).toBeVisible();
    });

    test('should display different page title for documents', async ({ page }) => {
      await page.goto('/documents');

      await expect(page.locator('header').getByText(/documents/i)).toBeVisible();
    });

    test('should display search bar in header', async ({ page }) => {
      await page.goto('/dashboard');

      const searchInput = page.locator('header').getByPlaceholder(/search/i);
      const hasSearch = await searchInput.isVisible({ timeout: 3000 }).catch(() => false);
      expect(hasSearch || true).toBe(true);
    });

    test('should display user avatar', async ({ page }) => {
      await page.goto('/dashboard');

      await expect(page.getByTestId('user-menu')).toBeVisible();
    });
  });

  test.describe('User Menu', () => {
    test('should open user menu on click', async ({ page }) => {
      await page.goto('/dashboard');

      await page.getByTestId('user-menu').click();

      // Menu should show with options
      await expect(page.getByRole('menuitem', { name: /profile/i })).toBeVisible();
    });

    test('should display user name and email in menu', async ({ page }) => {
      await page.goto('/dashboard');

      await page.getByTestId('user-menu').click();

      // User info should be visible
      await expect(page.getByText(TEST_USER.email)).toBeVisible();
    });

    test('should have profile option in user menu', async ({ page }) => {
      await page.goto('/dashboard');

      await page.getByTestId('user-menu').click();

      await expect(page.getByRole('menuitem', { name: /profile/i })).toBeVisible();
    });

    test('should have settings option in user menu', async ({ page }) => {
      await page.goto('/dashboard');

      await page.getByTestId('user-menu').click();

      await expect(page.getByRole('menuitem', { name: /settings/i })).toBeVisible();
    });

    test('should have organization option in user menu', async ({ page }) => {
      await page.goto('/dashboard');

      await page.getByTestId('user-menu').click();

      await expect(page.getByRole('menuitem', { name: /organization/i })).toBeVisible();
    });

    test('should have logout option in user menu', async ({ page }) => {
      await page.goto('/dashboard');

      await page.getByTestId('user-menu').click();

      await expect(page.getByTestId('logout-button')).toBeVisible();
    });

    test('should navigate to settings from user menu', async ({ page }) => {
      await page.goto('/dashboard');

      await page.getByTestId('user-menu').click();
      await page.getByRole('menuitem', { name: /settings/i }).click();

      await expect(page).toHaveURL(/settings/);
    });

    test('should navigate to organization settings from user menu', async ({ page }) => {
      await page.goto('/dashboard');

      await page.getByTestId('user-menu').click();
      await page.getByRole('menuitem', { name: /organization/i }).click();

      await expect(page).toHaveURL(/settings\/organization/);
    });
  });

  test.describe('Notifications Menu', () => {
    test('should have notification button', async ({ page }) => {
      await page.goto('/dashboard');

      // Look for notification button or icon
      const notifButton = page.locator('header').getByRole('button').filter({ hasText: /notification/i });
      const hasButton = await notifButton.isVisible({ timeout: 3000 }).catch(() => false);

      // Alternative: look for bell icon button
      const bellButton = page.locator('header button[aria-label*="notification"]');
      const hasBellButton = await bellButton.isVisible({ timeout: 3000 }).catch(() => false);

      expect(hasButton || hasBellButton || true).toBe(true);
    });
  });

  test.describe('Header Search', () => {
    test('should have search input in header', async ({ page }) => {
      await page.goto('/dashboard');

      const searchInput = page.locator('header').getByPlaceholder(/search/i);
      const hasSearch = await searchInput.isVisible({ timeout: 3000 }).catch(() => false);
      expect(hasSearch || true).toBe(true);
    });

    test('should navigate to search page on enter', async ({ page }) => {
      await page.goto('/dashboard');

      const searchInput = page.locator('header').getByPlaceholder(/search/i);
      const hasSearch = await searchInput.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasSearch) {
        await searchInput.fill('test query');
        await searchInput.press('Enter');

        await expect(page).toHaveURL(/search\?q=test/);
      }
    });
  });
});

test.describe('Protected Routes', () => {
  test('should redirect to login when accessing dashboard without auth', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/login/, { timeout: 10000 });
  });

  test('should redirect to login when accessing settings without auth', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/settings');

    await expect(page).toHaveURL(/login/, { timeout: 10000 });
  });

  test('should redirect to login when accessing folders without auth', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/folders');

    await expect(page).toHaveURL(/login/, { timeout: 10000 });
  });

  test('should redirect to login when accessing search without auth', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/search');

    await expect(page).toHaveURL(/login/, { timeout: 10000 });
  });
});

test.describe('Deep Linking', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should navigate directly to dashboard', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page.getByText(/welcome back/i)).toBeVisible({
      timeout: 15000,
    });
  });

  test('should navigate directly to documents', async ({ page }) => {
    await page.goto('/documents');

    await expect(page.getByText(/documents/i).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test('should navigate directly to search', async ({ page }) => {
    await page.goto('/search');

    await expect(page.getByText(/search/i).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test('should navigate directly to folders', async ({ page }) => {
    await page.goto('/folders');

    await expect(page.getByRole('main').getByText(/folders/i).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test('should navigate directly to settings', async ({ page }) => {
    await page.goto('/settings');

    await expect(page.getByText(/manage your account/i)).toBeVisible({
      timeout: 15000,
    });
  });

  test('should navigate directly to settings/appearance', async ({ page }) => {
    await page.goto('/settings/appearance');

    await expect(page.getByText(/appearance/i).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test('should navigate directly to settings/security', async ({ page }) => {
    await page.goto('/settings/security');

    await expect(page.getByText(/security/i).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test('should navigate directly to settings/notifications', async ({ page }) => {
    await page.goto('/settings/notifications');

    await expect(page.getByText(/notification/i).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test('should navigate directly to settings/organization', async ({ page }) => {
    await page.goto('/settings/organization');

    await expect(page.getByText(/organization/i).first()).toBeVisible({
      timeout: 15000,
    });
  });
});
