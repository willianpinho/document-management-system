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

      await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    });

    test('should show validation errors for empty form', async ({ page }) => {
      await page.goto('/login');

      await page.getByRole('button', { name: /sign in/i }).click();

      await expect(page.getByText(/email is required/i)).toBeVisible();
      await expect(page.getByText(/password is required/i)).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/login');

      await page.getByLabel(/email/i).fill('invalid@test.com');
      await page.getByLabel(/password/i).fill('wrongpassword');
      await page.getByRole('button', { name: /sign in/i }).click();

      await expect(page.getByText(/invalid credentials/i)).toBeVisible();
    });

    test('should login with valid credentials', async ({ page }) => {
      await page.goto('/login');

      await page.getByLabel(/email/i).fill('test@example.com');
      await page.getByLabel(/password/i).fill('password123');
      await page.getByRole('button', { name: /sign in/i }).click();

      // Should redirect to dashboard
      await expect(page).toHaveURL(/dashboard|documents/);
    });

    test('should show OAuth providers', async ({ page }) => {
      await page.goto('/login');

      await expect(page.getByRole('button', { name: /google/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /microsoft/i })).toBeVisible();
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

      await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();
      await expect(page.getByLabel(/name/i)).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel('Password')).toBeVisible();
      await expect(page.getByLabel(/confirm password/i)).toBeVisible();
    });

    test('should show validation errors for invalid input', async ({ page }) => {
      await page.goto('/register');

      await page.getByLabel(/email/i).fill('invalid-email');
      await page.getByLabel('Password').fill('short');
      await page.getByLabel(/confirm password/i).fill('different');

      await page.getByRole('button', { name: /create account/i }).click();

      await expect(page.getByText(/invalid email/i)).toBeVisible();
      await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
      await expect(page.getByText(/passwords do not match/i)).toBeVisible();
    });

    test('should register with valid information', async ({ page }) => {
      const uniqueEmail = `test-${Date.now()}@example.com`;

      await page.goto('/register');

      await page.getByLabel(/name/i).fill('Test User');
      await page.getByLabel(/email/i).fill(uniqueEmail);
      await page.getByLabel('Password').fill('password123');
      await page.getByLabel(/confirm password/i).fill('password123');

      await page.getByRole('button', { name: /create account/i }).click();

      // Should redirect to dashboard or verification page
      await expect(page).toHaveURL(/(dashboard|documents|verify)/);
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
      await expect(page).toHaveURL(/dashboard|documents/);

      // Click user menu and logout
      await page.getByRole('button', { name: /user menu/i }).click();
      await page.getByRole('menuitem', { name: /logout/i }).click();

      // Should redirect to login
      await expect(page).toHaveURL('/login');
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect to login when not authenticated', async ({ page }) => {
      await page.goto('/documents');

      await expect(page).toHaveURL(/login/);
    });

    test('should allow access to protected routes when authenticated', async ({ page }) => {
      // Login first
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('test@example.com');
      await page.getByLabel(/password/i).fill('password123');
      await page.getByRole('button', { name: /sign in/i }).click();

      // Navigate to protected route
      await page.goto('/documents');
      await expect(page).toHaveURL('/documents');
      await expect(page.getByRole('heading', { name: /documents/i })).toBeVisible();
    });
  });
});
