/**
 * Authentication E2E Tests
 *
 * Tests the complete authentication flow including login, register,
 * and session management.
 */

import { test, expect, type Page } from '@playwright/test';

// Test data
const TEST_USER = {
  email: 'admin@dms-test.com',
  password: 'admin123!',
};

// Helper function to login
async function login(page: Page, email: string = TEST_USER.email, password: string = TEST_USER.password) {
  await page.goto('/login');
  await page.getByTestId('email-input').fill(email);
  await page.getByTestId('password-input').fill(password);
  await page.getByTestId('login-button').click();
  await expect(page).toHaveURL(/dashboard|documents/, { timeout: 20000 });
}

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies to ensure clean state
    await page.context().clearCookies();
  });

  test.describe('Login', () => {
    test('should display login page', async ({ page }) => {
      await page.goto('/login');

      await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
      await expect(page.getByTestId('email-input')).toBeVisible();
      await expect(page.getByTestId('password-input')).toBeVisible();
      await expect(page.getByTestId('login-button')).toBeVisible();
    });

    test('should show validation for empty form submission', async ({ page }) => {
      await page.goto('/login');

      // The form uses HTML5 required attribute, so we check that native validation prevents submission
      const submitButton = page.getByTestId('login-button');

      // Click submit without filling form
      await submitButton.click();

      // Form should not submit - check that we're still on login page
      await expect(page).toHaveURL(/login/);
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/login');

      await page.getByTestId('email-input').fill('invalid@test.com');
      await page.getByTestId('password-input').fill('wrongpassword');
      await page.getByTestId('login-button').click();

      // Wait for the button to become enabled again (indicating request completed)
      await expect(page.getByTestId('login-button')).toBeEnabled({ timeout: 15000 });

      // Wait for error message - check for error text or error styling
      await expect(
        page.getByText(/invalid email or password|invalid credentials/i)
          .or(page.locator('.bg-destructive\\/10'))
      ).toBeVisible({ timeout: 10000 });
    });

    test('should login with valid credentials', async ({ page }) => {
      await page.goto('/login');

      await page.getByTestId('email-input').fill(TEST_USER.email);
      await page.getByTestId('password-input').fill(TEST_USER.password);
      await page.getByTestId('login-button').click();

      // Should redirect to dashboard
      await expect(page).toHaveURL(/dashboard|documents/, { timeout: 20000 });
    });

    test('should show OAuth providers', async ({ page }) => {
      await page.goto('/login');

      // Buttons contain "Continue with Google/Microsoft"
      await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /continue with microsoft/i })).toBeVisible();
    });

    test('should navigate to register page', async ({ page }) => {
      await page.goto('/login');

      await page.getByRole('link', { name: /sign up/i }).click();

      await expect(page).toHaveURL('/register');
    });
  });

  test.describe('Register', () => {
    test('should display registration page', async ({ page }) => {
      await page.goto('/register');

      await expect(page.getByRole('heading', { name: /create an account/i })).toBeVisible();
      await expect(page.getByTestId('name-input')).toBeVisible();
      await expect(page.getByTestId('email-input')).toBeVisible();
      await expect(page.getByTestId('password-input')).toBeVisible();
      await expect(page.getByTestId('confirm-password-input')).toBeVisible();
    });

    test('should show validation errors for invalid input', async ({ page }) => {
      await page.goto('/register');

      await page.getByTestId('name-input').fill('Test');
      await page.getByTestId('email-input').fill('invalid-email');
      await page.getByTestId('password-input').fill('short');
      await page.getByTestId('confirm-password-input').fill('different');

      await page.getByTestId('register-button').click();

      // Check for validation error message
      await expect(
        page.getByText(/at least 8 characters|passwords do not match|valid email/i)
          .or(page.locator('.bg-destructive\\/10'))
      ).toBeVisible({ timeout: 10000 });
    });

    test('should register with valid information', async ({ page }) => {
      const uniqueEmail = `test-${Date.now()}@example.com`;

      await page.goto('/register');

      await page.getByTestId('name-input').fill('Test User');
      await page.getByTestId('email-input').fill(uniqueEmail);
      await page.getByTestId('password-input').fill('TestPass123!');
      await page.getByTestId('confirm-password-input').fill('TestPass123!');

      await page.getByTestId('register-button').click();

      // Should redirect to dashboard or verification page
      await expect(page).toHaveURL(/(dashboard|documents|verify)/, { timeout: 20000 });
    });

    test('should navigate to login page', async ({ page }) => {
      await page.goto('/register');

      await page.getByRole('link', { name: /sign in/i }).click();

      await expect(page).toHaveURL('/login');
    });
  });

  test.describe('Logout', () => {
    test('should logout successfully', async ({ page }) => {
      // Login first
      await login(page);

      // Wait for the page to fully load and stabilize
      await page.waitForLoadState('networkidle');

      // Click user menu
      const userMenuButton = page.getByTestId('user-menu');
      await expect(userMenuButton).toBeVisible({ timeout: 10000 });
      await userMenuButton.click();

      // Wait for dropdown menu to be visible
      await page.waitForTimeout(500);

      // Wait for menu to open and click logout
      const logoutButton = page.getByTestId('logout-button');
      await expect(logoutButton).toBeVisible({ timeout: 5000 });
      await logoutButton.click();

      // Should redirect to login (with possible logout query param)
      await expect(page).toHaveURL(/login/, { timeout: 30000 });
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect to login when not authenticated', async ({ page }) => {
      // Clear any existing auth state
      await page.context().clearCookies();

      await page.goto('/documents');

      // Should redirect to login
      await expect(page).toHaveURL(/login/, { timeout: 10000 });
    });

    test('should allow access to protected routes when authenticated', async ({ page }) => {
      // Login first
      await login(page);

      // Navigate to protected route
      await page.goto('/documents');
      await expect(page).toHaveURL('/documents');

      // Should see documents page content - wait for main heading
      await expect(
        page.getByRole('main').getByRole('heading', { name: /documents/i })
      ).toBeVisible({ timeout: 10000 });
    });
  });
});
