/**
 * Zod Schemas Unit Tests
 *
 * Tests for all validation schemas to ensure they correctly validate
 * input data and produce expected error messages.
 */

import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';

// Import all schemas from the barrel export
import {
  // Common schemas
  uuidSchema,
  nonEmptyStringSchema,
  urlSchema,
  paginationSchema,
  sortSchema,
  dateRangeSchema,
  hexColorSchema,
  slugSchema,
  // User schemas
  emailSchema,
  passwordSchema,
  simplePasswordSchema,
  memberRoleSchema,
  loginSchema,
  registerSchema,
  changePasswordSchema,
  refreshTokenSchema,
  createApiKeySchema,
  // Organization schemas
  organizationPlanSchema,
  organizationNameSchema,
  createOrganizationSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  // Document schemas
  documentStatusSchema,
  processingStatusSchema,
  documentCategorySchema,
  mimeTypeSchema,
  documentNameSchema,
  tagSchema,
  tagsArraySchema,
  createDocumentSchema,
  updateDocumentSchema,
  semanticSearchSchema,
  bulkDocumentOperationSchema,
  // Folder schemas
  folderNameSchema,
  createFolderSchema,
  updateFolderSchema,
  moveFolderSchema,
  folderContentsSchema,
  folderTreeSchema,
  bulkFolderOperationSchema,
  // Processing schemas
  processingJobTypeSchema,
  processingJobStatusSchema,
  processingPrioritySchema,
  pdfSplitRuleTypeSchema,
  createProcessingJobSchema,
  triggerProcessingSchema,
  bulkProcessingSchema,
  // Search schemas
  searchModeSchema,
  searchQuerySchema,
  semanticSearchQuerySchema,
  autocompleteQuerySchema,
  searchFiltersSchema,
} from '../schemas/index.js';

describe('Common Schemas', () => {
  describe('uuidSchema', () => {
    it('should accept valid UUIDs', () => {
      const validUuids = [
        '550e8400-e29b-41d4-a716-446655440000',
        '123e4567-e89b-12d3-a456-426614174000',
        'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      ];

      validUuids.forEach((uuid) => {
        expect(() => uuidSchema.parse(uuid)).not.toThrow();
      });
    });

    it('should reject invalid UUIDs', () => {
      const invalidUuids = [
        'not-a-uuid',
        '123',
        '550e8400-e29b-41d4-a716', // incomplete
        '550e8400-e29b-41d4-a716-446655440000-extra', // extra chars
        '', // empty
      ];

      invalidUuids.forEach((uuid) => {
        expect(() => uuidSchema.parse(uuid)).toThrow(ZodError);
      });
    });
  });

  describe('urlSchema', () => {
    it('should accept valid URLs', () => {
      const validUrls = [
        'https://example.com',
        'http://localhost:3000',
        'https://sub.domain.com/path?query=1',
        'ftp://files.example.com',
      ];

      validUrls.forEach((url) => {
        expect(() => urlSchema.parse(url)).not.toThrow();
      });
    });

    it('should reject invalid URLs', () => {
      const invalidUrls = ['not-a-url', 'example.com', 'http://', ''];

      invalidUrls.forEach((url) => {
        expect(() => urlSchema.parse(url)).toThrow(ZodError);
      });
    });
  });

  describe('paginationSchema', () => {
    it('should apply default values', () => {
      const result = paginationSchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should coerce string values to numbers', () => {
      const result = paginationSchema.parse({ page: '5', limit: '50' });
      expect(result.page).toBe(5);
      expect(result.limit).toBe(50);
    });

    it('should reject page less than 1', () => {
      expect(() => paginationSchema.parse({ page: 0 })).toThrow(ZodError);
      expect(() => paginationSchema.parse({ page: -1 })).toThrow(ZodError);
    });

    it('should reject limit greater than 100', () => {
      expect(() => paginationSchema.parse({ limit: 101 })).toThrow(ZodError);
    });
  });

  describe('hexColorSchema', () => {
    it('should accept valid hex colors', () => {
      const validColors = ['#FF5733', '#000000', '#ffffff', '#AbCdEf'];

      validColors.forEach((color) => {
        expect(() => hexColorSchema.parse(color)).not.toThrow();
      });
    });

    it('should reject invalid hex colors', () => {
      const invalidColors = [
        'FF5733', // missing #
        '#FFF', // 3 chars instead of 6
        '#GGGGGG', // invalid chars
        '#FF573', // 5 chars
        'red', // color name
      ];

      invalidColors.forEach((color) => {
        expect(() => hexColorSchema.parse(color)).toThrow(ZodError);
      });
    });
  });

  describe('slugSchema', () => {
    it('should accept valid slugs', () => {
      const validSlugs = ['my-org', 'test-company-123', 'abc'];

      validSlugs.forEach((slug) => {
        expect(() => slugSchema.parse(slug)).not.toThrow();
      });
    });

    it('should reject invalid slugs', () => {
      const invalidSlugs = [
        'ab', // too short
        'My-Org', // uppercase
        'my_org', // underscore
        'my org', // space
        'my--org', // double hyphen
        '-myorg', // starts with hyphen
        'myorg-', // ends with hyphen
      ];

      invalidSlugs.forEach((slug) => {
        expect(() => slugSchema.parse(slug)).toThrow(ZodError);
      });
    });
  });
});

describe('User Schemas', () => {
  describe('emailSchema', () => {
    it('should accept valid emails and lowercase them', () => {
      const result = emailSchema.parse('Test@Example.COM');
      expect(result).toBe('test@example.com');
    });

    it('should lowercase email before returning', () => {
      // Transform lowercases and trims after validation
      const result = emailSchema.parse('Test@EXAMPLE.com');
      expect(result).toBe('test@example.com');
    });

    it('should reject invalid emails', () => {
      const invalidEmails = ['not-an-email', 'test@', '@example.com', 'test'];

      invalidEmails.forEach((email) => {
        expect(() => emailSchema.parse(email)).toThrow(ZodError);
      });
    });
  });

  describe('passwordSchema', () => {
    it('should accept valid passwords', () => {
      const validPasswords = ['Password1', 'SecurePass123', 'MyP@ssw0rd'];

      validPasswords.forEach((password) => {
        expect(() => passwordSchema.parse(password)).not.toThrow();
      });
    });

    it('should reject passwords without uppercase', () => {
      expect(() => passwordSchema.parse('password1')).toThrow(ZodError);
    });

    it('should reject passwords without lowercase', () => {
      expect(() => passwordSchema.parse('PASSWORD1')).toThrow(ZodError);
    });

    it('should reject passwords without number', () => {
      expect(() => passwordSchema.parse('Password')).toThrow(ZodError);
    });

    it('should reject passwords shorter than 8 characters', () => {
      expect(() => passwordSchema.parse('Pass1')).toThrow(ZodError);
    });
  });

  describe('loginSchema', () => {
    it('should accept valid login data', () => {
      const result = loginSchema.parse({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.email).toBe('test@example.com');
      expect(result.rememberMe).toBe(false); // default
    });

    it('should apply default values', () => {
      const result = loginSchema.parse({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.rememberMe).toBe(false);
    });
  });

  describe('registerSchema', () => {
    it('should accept valid registration data', () => {
      const data = {
        email: 'test@example.com',
        password: 'SecurePass1',
        name: 'Test User',
      };

      expect(() => registerSchema.parse(data)).not.toThrow();
    });

    it('should reject weak passwords', () => {
      expect(() =>
        registerSchema.parse({
          email: 'test@example.com',
          password: 'weak',
        }),
      ).toThrow(ZodError);
    });
  });

  describe('changePasswordSchema', () => {
    it('should accept valid password change data', () => {
      const data = {
        currentPassword: 'currentPass1',
        newPassword: 'NewPassword1',
        confirmPassword: 'NewPassword1',
      };

      expect(() => changePasswordSchema.parse(data)).not.toThrow();
    });

    it('should reject mismatched passwords', () => {
      expect(() =>
        changePasswordSchema.parse({
          currentPassword: 'currentPass1',
          newPassword: 'NewPassword1',
          confirmPassword: 'DifferentPassword1',
        }),
      ).toThrow(ZodError);
    });

    it('should reject same password as current', () => {
      expect(() =>
        changePasswordSchema.parse({
          currentPassword: 'SamePassword1',
          newPassword: 'SamePassword1',
          confirmPassword: 'SamePassword1',
        }),
      ).toThrow(ZodError);
    });
  });

  describe('memberRoleSchema', () => {
    it('should accept valid roles', () => {
      const validRoles = ['viewer', 'editor', 'admin', 'owner'];

      validRoles.forEach((role) => {
        expect(() => memberRoleSchema.parse(role)).not.toThrow();
      });
    });

    it('should reject invalid roles', () => {
      expect(() => memberRoleSchema.parse('superadmin')).toThrow(ZodError);
    });
  });

  describe('createApiKeySchema', () => {
    it('should accept valid API key data', () => {
      const data = {
        name: 'My API Key',
        scopes: ['documents:read', 'documents:write'],
      };

      expect(() => createApiKeySchema.parse(data)).not.toThrow();
    });

    it('should require at least one scope', () => {
      expect(() =>
        createApiKeySchema.parse({ name: 'Key', scopes: [] }),
      ).toThrow(ZodError);
    });
  });
});

describe('Organization Schemas', () => {
  describe('organizationPlanSchema', () => {
    it('should accept valid plans', () => {
      const validPlans = ['free', 'starter', 'professional', 'enterprise'];

      validPlans.forEach((plan) => {
        expect(() => organizationPlanSchema.parse(plan)).not.toThrow();
      });
    });
  });

  describe('createOrganizationSchema', () => {
    it('should accept valid organization data', () => {
      const data = {
        name: 'My Company',
        slug: 'my-company',
      };

      const result = createOrganizationSchema.parse(data);
      expect(result.plan).toBe('free'); // default
    });
  });

  describe('inviteMemberSchema', () => {
    it('should accept valid invite data', () => {
      const data = {
        email: 'new@example.com',
        role: 'editor',
      };

      expect(() => inviteMemberSchema.parse(data)).not.toThrow();
    });

    it('should reject owner role for invites', () => {
      expect(() =>
        inviteMemberSchema.parse({
          email: 'new@example.com',
          role: 'owner',
        }),
      ).toThrow(ZodError);
    });
  });
});

describe('Document Schemas', () => {
  describe('documentStatusSchema', () => {
    it('should accept valid statuses', () => {
      const validStatuses = ['uploading', 'uploaded', 'processing', 'ready', 'error', 'deleted'];

      validStatuses.forEach((status) => {
        expect(() => documentStatusSchema.parse(status)).not.toThrow();
      });
    });
  });

  describe('mimeTypeSchema', () => {
    it('should accept valid MIME types', () => {
      const validMimeTypes = [
        'application/pdf',
        'image/png',
        'image/jpeg',
        'text/plain',
        'application/vnd.ms-excel',
      ];

      validMimeTypes.forEach((mimeType) => {
        expect(() => mimeTypeSchema.parse(mimeType)).not.toThrow();
      });
    });

    it('should reject invalid MIME types', () => {
      const invalidMimeTypes = ['pdf', 'application/', '/pdf', ''];

      invalidMimeTypes.forEach((mimeType) => {
        expect(() => mimeTypeSchema.parse(mimeType)).toThrow(ZodError);
      });
    });
  });

  describe('documentNameSchema', () => {
    it('should accept valid document names', () => {
      const validNames = ['report.pdf', 'My Document (2024).docx', 'file-name_v2.txt'];

      validNames.forEach((name) => {
        expect(() => documentNameSchema.parse(name)).not.toThrow();
      });
    });

    it('should reject names with invalid characters', () => {
      const invalidNames = [
        'file<name>.pdf',
        'file:name.pdf',
        'file/name.pdf',
        'file\\name.pdf',
        'file|name.pdf',
        'file?name.pdf',
        'file*name.pdf',
      ];

      invalidNames.forEach((name) => {
        expect(() => documentNameSchema.parse(name)).toThrow(ZodError);
      });
    });

    it('should reject empty names', () => {
      expect(() => documentNameSchema.parse('')).toThrow(ZodError);
    });
  });

  describe('tagSchema', () => {
    it('should lowercase and trim tags', () => {
      const result = tagSchema.parse('  MyTag  ');
      expect(result).toBe('mytag');
    });

    it('should reject tags longer than 50 characters', () => {
      expect(() => tagSchema.parse('a'.repeat(51))).toThrow(ZodError);
    });
  });

  describe('tagsArraySchema', () => {
    it('should accept array of valid tags', () => {
      const result = tagsArraySchema.parse(['tag1', 'Tag2', 'TAG3']);
      expect(result).toEqual(['tag1', 'tag2', 'tag3']); // all lowercased
    });

    it('should reject more than 20 tags', () => {
      const tooManyTags = Array(21).fill('tag');
      expect(() => tagsArraySchema.parse(tooManyTags)).toThrow(ZodError);
    });
  });

  describe('createDocumentSchema', () => {
    it('should accept valid document creation data', () => {
      const data = {
        name: 'report.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
      };

      expect(() => createDocumentSchema.parse(data)).not.toThrow();
    });

    it('should reject files larger than 10GB', () => {
      expect(() =>
        createDocumentSchema.parse({
          name: 'large.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 11 * 1024 * 1024 * 1024, // 11GB
        }),
      ).toThrow(ZodError);
    });

    it('should accept null folderId', () => {
      const data = {
        name: 'report.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        folderId: null,
      };

      expect(() => createDocumentSchema.parse(data)).not.toThrow();
    });
  });

  describe('semanticSearchSchema', () => {
    it('should apply default values', () => {
      const result = semanticSearchSchema.parse({ query: 'test query' });

      expect(result.limit).toBe(10);
      expect(result.threshold).toBe(0.7);
      expect(result.includeScore).toBe(true);
      expect(result.rerank).toBe(false);
    });

    it('should reject empty query', () => {
      expect(() => semanticSearchSchema.parse({ query: '' })).toThrow(ZodError);
    });

    it('should reject query longer than 1000 chars', () => {
      expect(() =>
        semanticSearchSchema.parse({ query: 'a'.repeat(1001) }),
      ).toThrow(ZodError);
    });

    it('should reject threshold outside 0-1 range', () => {
      expect(() =>
        semanticSearchSchema.parse({ query: 'test', threshold: 1.5 }),
      ).toThrow(ZodError);
      expect(() =>
        semanticSearchSchema.parse({ query: 'test', threshold: -0.1 }),
      ).toThrow(ZodError);
    });
  });

  describe('bulkDocumentOperationSchema', () => {
    it('should accept valid bulk operation', () => {
      const data = {
        documentIds: ['550e8400-e29b-41d4-a716-446655440000'],
        operation: 'move',
        targetFolderId: '550e8400-e29b-41d4-a716-446655440001',
      };

      expect(() => bulkDocumentOperationSchema.parse(data)).not.toThrow();
    });

    it('should require at least one document', () => {
      expect(() =>
        bulkDocumentOperationSchema.parse({
          documentIds: [],
          operation: 'delete',
        }),
      ).toThrow(ZodError);
    });

    it('should reject more than 100 documents', () => {
      const manyIds = Array(101)
        .fill(null)
        .map(() => '550e8400-e29b-41d4-a716-446655440000');

      expect(() =>
        bulkDocumentOperationSchema.parse({
          documentIds: manyIds,
          operation: 'delete',
        }),
      ).toThrow(ZodError);
    });
  });
});

describe('Folder Schemas', () => {
  describe('folderNameSchema', () => {
    it('should trim folder names', () => {
      const result = folderNameSchema.parse('  My Folder  ');
      expect(result).toBe('My Folder');
    });

    it('should reject names with path characters', () => {
      const invalidNames = ['folder/name', 'folder\\name', 'folder:name'];

      invalidNames.forEach((name) => {
        expect(() => folderNameSchema.parse(name)).toThrow(ZodError);
      });
    });
  });

  describe('createFolderSchema', () => {
    it('should accept valid folder data', () => {
      const data = {
        name: 'New Folder',
        parentId: '550e8400-e29b-41d4-a716-446655440000',
      };

      expect(() => createFolderSchema.parse(data)).not.toThrow();
    });

    it('should accept null parentId for root folders', () => {
      const data = { name: 'Root Folder', parentId: null };
      expect(() => createFolderSchema.parse(data)).not.toThrow();
    });
  });

  describe('folderTreeSchema', () => {
    it('should apply default values', () => {
      const result = folderTreeSchema.parse({});

      expect(result.maxDepth).toBe(5);
      expect(result.includeDocumentCount).toBe(false);
    });

    it('should reject maxDepth greater than 10', () => {
      expect(() => folderTreeSchema.parse({ maxDepth: 11 })).toThrow(ZodError);
    });
  });

  describe('bulkFolderOperationSchema', () => {
    it('should accept valid bulk operation', () => {
      const data = {
        folderIds: ['550e8400-e29b-41d4-a716-446655440000'],
        operation: 'move',
        targetFolderId: '550e8400-e29b-41d4-a716-446655440001',
      };

      expect(() => bulkFolderOperationSchema.parse(data)).not.toThrow();
    });

    it('should reject more than 50 folders', () => {
      const manyIds = Array(51)
        .fill(null)
        .map(() => '550e8400-e29b-41d4-a716-446655440000');

      expect(() =>
        bulkFolderOperationSchema.parse({
          folderIds: manyIds,
          operation: 'delete',
        }),
      ).toThrow(ZodError);
    });
  });
});

describe('Processing Schemas', () => {
  describe('processingJobTypeSchema', () => {
    it('should accept valid job types', () => {
      const validTypes = [
        'ocr',
        'pdf_split',
        'pdf_merge',
        'thumbnail',
        'ai_classify',
        'embedding',
        'convert',
        'compress',
      ];

      validTypes.forEach((type) => {
        expect(() => processingJobTypeSchema.parse(type)).not.toThrow();
      });
    });
  });

  describe('processingJobStatusSchema', () => {
    it('should accept valid statuses', () => {
      const validStatuses = ['pending', 'running', 'completed', 'failed', 'cancelled', 'retrying'];

      validStatuses.forEach((status) => {
        expect(() => processingJobStatusSchema.parse(status)).not.toThrow();
      });
    });
  });

  describe('processingPrioritySchema', () => {
    it('should accept valid priorities', () => {
      const validPriorities = ['low', 'normal', 'high', 'urgent'];

      validPriorities.forEach((priority) => {
        expect(() => processingPrioritySchema.parse(priority)).not.toThrow();
      });
    });
  });

  describe('createProcessingJobSchema', () => {
    it('should accept valid job creation data', () => {
      const data = {
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        jobType: 'ocr',
      };

      const result = createProcessingJobSchema.parse(data);
      expect(result.priority).toBe('normal'); // default
    });
  });

  describe('triggerProcessingSchema', () => {
    it('should accept minimal processing trigger', () => {
      const data = { type: 'thumbnail' };
      expect(() => triggerProcessingSchema.parse(data)).not.toThrow();
    });

    it('should accept processing with options', () => {
      const data = {
        type: 'ocr',
        options: {
          language: 'en',
          features: ['TABLES', 'FORMS'],
        },
      };

      expect(() => triggerProcessingSchema.parse(data)).not.toThrow();
    });
  });

  describe('bulkProcessingSchema', () => {
    it('should accept valid bulk processing data', () => {
      const data = {
        documentIds: ['550e8400-e29b-41d4-a716-446655440000'],
        jobType: 'thumbnail',
      };

      expect(() => bulkProcessingSchema.parse(data)).not.toThrow();
    });

    it('should reject more than 100 documents', () => {
      const manyIds = Array(101)
        .fill(null)
        .map(() => '550e8400-e29b-41d4-a716-446655440000');

      expect(() =>
        bulkProcessingSchema.parse({
          documentIds: manyIds,
          jobType: 'thumbnail',
        }),
      ).toThrow(ZodError);
    });
  });
});

describe('Search Schemas', () => {
  describe('searchModeSchema', () => {
    it('should accept valid search modes', () => {
      const validModes = ['fulltext', 'semantic', 'hybrid'];

      validModes.forEach((mode) => {
        expect(() => searchModeSchema.parse(mode)).not.toThrow();
      });
    });
  });

  describe('searchQuerySchema', () => {
    it('should apply default values', () => {
      const result = searchQuerySchema.parse({ query: 'test' });

      expect(result.mode).toBe('fulltext');
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
      expect(result.highlight).toBe(true);
      expect(result.includeFacets).toBe(false);
    });

    it('should reject empty query', () => {
      expect(() => searchQuerySchema.parse({ query: '' })).toThrow(ZodError);
    });

    it('should reject query longer than 500 chars', () => {
      expect(() => searchQuerySchema.parse({ query: 'a'.repeat(501) })).toThrow(
        ZodError,
      );
    });

    it('should reject limit greater than 100', () => {
      expect(() =>
        searchQuerySchema.parse({ query: 'test', limit: 101 }),
      ).toThrow(ZodError);
    });
  });

  describe('autocompleteQuerySchema', () => {
    it('should apply default values', () => {
      const result = autocompleteQuerySchema.parse({ query: 'test' });

      expect(result.limit).toBe(10);
    });

    it('should reject limit greater than 20', () => {
      expect(() =>
        autocompleteQuerySchema.parse({ query: 'test', limit: 21 }),
      ).toThrow(ZodError);
    });
  });

  describe('searchFiltersSchema', () => {
    it('should accept valid filters', () => {
      const data = {
        type: ['document', 'folder'],
        folderId: '550e8400-e29b-41d4-a716-446655440000',
        includeSubfolders: true,
        mimeTypes: ['application/pdf'],
        tags: ['report', 'finance'],
      };

      expect(() => searchFiltersSchema.parse(data)).not.toThrow();
    });

    it('should apply default for includeSubfolders', () => {
      const result = searchFiltersSchema.parse({});
      expect(result.includeSubfolders).toBe(true);
    });
  });

  describe('semanticSearchQuerySchema', () => {
    it('should apply default values', () => {
      const result = semanticSearchQuerySchema.parse({ query: 'semantic search' });

      expect(result.limit).toBe(10);
      expect(result.threshold).toBe(0.7);
      expect(result.includeScore).toBe(true);
      expect(result.rerank).toBe(false);
    });

    it('should accept valid threshold values', () => {
      expect(() =>
        semanticSearchQuerySchema.parse({ query: 'test', threshold: 0 }),
      ).not.toThrow();
      expect(() =>
        semanticSearchQuerySchema.parse({ query: 'test', threshold: 1 }),
      ).not.toThrow();
      expect(() =>
        semanticSearchQuerySchema.parse({ query: 'test', threshold: 0.5 }),
      ).not.toThrow();
    });
  });
});
