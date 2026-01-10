import { vi } from 'vitest';

// Set up global test environment
// Note: Individual tests should mock their own dependencies using NestJS testing module
// or direct mock injection

// Mock crypto for consistent UUID generation in tests
vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>();
  return {
    ...actual,
    randomUUID: () => 'test-uuid-1234',
    randomBytes: (size: number) => Buffer.from('a'.repeat(size)),
  };
});

// Mock uuid package
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
}));
