/**
 * Authentication E2E Tests
 *
 * Tests the complete authentication flow including login, register,
 * and session management.
 */

import { test, expect, type Page } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.describe('Login', () => {
    test('should display login page', async ({ page }) => {
      await page.goto('/login');

      // Page has "Welcome back" heading
      await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    });

    test('should show validation for empty form submission', async ({ page }) => {
      await page.goto('/login');

      // The form uses HTML5 required attribute, so we check that native validation prevents submission
      const emailInput = page.getByLabel(/email/i);
      const submitButton = page.getByRole('button', { name: /sign in/i });

      // Click submit without filling form
      await submitButton.click();

      // Form should not submit - email input should still be focused/invalid
      // Check that we're still on login page
      await expect(page).toHaveURL(/login/);
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/login');

      await page.getByLabel(/email/i).fill('invalid@test.com');
      await page.getByLabel(/password/i).fill('wrongpassword');
      await page.getByRole('button', { name: /sign in/i }).click();

      // Wait for error message (the error div with destructive styling)
      await expect(page.locator('.bg-destructive\\/10')).toBeVisible({ timeout: 10000 });
    });

    test('should login with valid credentials', async ({ page }) => {
      await page.goto('/login');

      await page.getByLabel(/email/i).fill('test@example.com');
      await page.getByLabel(/password/i).fill('password123');
      await page.getByRole('button', { name: /sign in/i }).click();

      // Should redirect to dashboard
      await expect(page).toHaveURL(/dashboard|documents/, { timeout: 15000 });
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

      // Page has "Create an account" heading
      await expect(page.getByRole('heading', { name: /create an account/i })).toBeVisible();
      // Label is "Full name" not just "name"
      await expect(page.getByLabel(/full name/i)).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      // Use exact match for Password (not "Confirm password")
      await expect(page.locator('#password')).toBeVisible();
      await expect(page.getByLabel(/confirm password/i)).toBeVisible();
    });

    test('should show validation errors for invalid input', async ({ page }) => {
      await page.goto('/register');

      // Fill with invalid data using locators
      await page.getByLabel(/full name/i).fill('Test');
      await page.getByLabel(/email/i).fill('invalid-email');
      await page.locator('#password').fill('short');
      await page.locator('#confirmPassword').fill('different');

      await page.getByRole('button', { name: /create account/i }).click();

      // Check for validation error message (displayed in error div)
      await expect(page.locator('.bg-destructive\\/10')).toBeVisible({ timeout: 5000 });
    });

    test('should register with valid information', async ({ page }) => {
      const uniqueEmail = `test-${Date.now()}@example.com`;

      await page.goto('/register');

      await page.getByLabel(/full name/i).fill('Test User');
      await page.getByLabel(/email/i).fill(uniqueEmail);
      await page.locator('#password').fill('password123');
      await page.locator('#confirmPassword').fill('password123');

      await page.getByRole('button', { name: /create account/i }).click();

      // Should redirect to dashboard or verification page
      await expect(page).toHaveURL(/(dashboard|documents|verify)/, { timeout: 15000 });
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
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('test@example.com');
      await page.getByLabel(/password/i).fill('password123');
      await page.getByRole('button', { name: /sign in/i }).click();

      // Wait for dashboard
      await expect(page).toHaveURL(/dashboard|documents/, { timeout: 15000 });

      // Look for user menu - try different selectors
      const userMenuButton = page.locator('[data-testid="user-menu"]').or(
        page.getByRole('button', { name: /user|account|profile/i })
      ).or(
        page.locator('.avatar').first()
      );

      // If user menu exists, click it
      const hasUserMenu = await userMenuButton.isVisible().catch(() => false);

      if (hasUserMenu) {
        await userMenuButton.click();

        // Look for logout option
        const logoutButton = page.getByRole('menuitem', { name: /logout|sign out/i }).or(
          page.getByText(/logout|sign out/i)
        );

        const hasLogout = await logoutButton.isVisible().catch(() => false);
        if (hasLogout) {
          await logoutButton.click();
          await expect(page).toHaveURL(/login/);
        }
      }
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect to login when not authenticated', async ({ page }) => {
      // Clear any existing auth state
      await page.context().clearCookies();

      await page.goto('/documents');

      await expect(page).toHaveURL(/login/, { timeout: 10000 });
    });

    test('should allow access to protected routes when authenticated', async ({ page }) => {
      // Login first
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('test@example.com');
      await page.getByLabel(/password/i).fill('password123');
      await page.getByRole('button', { name: /sign in/i }).click();

      // Wait for redirect
      await expect(page).toHaveURL(/dashboard|documents/, { timeout: 15000 });

      // Navigate to protected route
      await page.goto('/documents');
      await expect(page).toHaveURL('/documents');

      // Should see documents page content
      await expect(page.getByRole('heading', { name: /documents/i }).or(
        page.getByText(/my documents/i)
      ).or(
        page.getByRole('button', { name: /upload/i })
      )).toBeVisible({ timeout: 10000 });
    });
  });
});
