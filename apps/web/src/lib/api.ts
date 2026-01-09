import type {
  ApiResponse,
  ApiErrorResponse,
  PaginationParams,
  SortParams,
  DocumentSearchParams,
  SemanticSearchParams,
} from '@dms/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

// Organization context management
function getCurrentOrganizationId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('currentOrganizationId');
}

function setCurrentOrganizationId(organizationId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('currentOrganizationId', organizationId);
}

function clearCurrentOrganizationId(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('currentOrganizationId');
}

export class ApiError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    status: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

function setAuthTokens(accessToken: string, refreshToken: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
}

function clearAuthTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  clearCurrentOrganizationId();
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      clearAuthTokens();
      return null;
    }

    const data = await response.json();
    setAuthTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch {
    clearAuthTokens();
    return null;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
  skipAuth?: boolean;
  skipOrganization?: boolean;
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const { body, params, skipAuth = false, skipOrganization = false, ...init } = options;

  let url = `${API_BASE_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...init.headers,
  };

  if (!skipAuth) {
    const token = getAuthToken();
    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }
  }

  // Add organization ID header for multi-tenant requests
  if (!skipOrganization) {
    const organizationId = getCurrentOrganizationId();
    if (organizationId) {
      (headers as Record<string, string>)['X-Organization-ID'] = organizationId;
    }
  }

  let response = await fetch(url, {
    ...init,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Handle token refresh on 401
  if (response.status === 401 && !skipAuth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
      response = await fetch(url, {
        ...init,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } else {
      // Redirect to login
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new ApiError('Session expired', 'SESSION_EXPIRED', 401);
    }
  }

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as ApiErrorResponse;
    throw new ApiError(
      errorData.error?.message || 'An error occurred',
      errorData.error?.code || 'UNKNOWN_ERROR',
      response.status,
      errorData.error?.details
    );
  }

  return data as ApiResponse<T>;
}

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    request<{ accessToken: string; refreshToken: string; expiresIn: number }>(
      '/auth/login',
      { method: 'POST', body: { email, password }, skipAuth: true }
    ),

  register: (name: string, email: string, password: string) =>
    request<{ accessToken: string; refreshToken: string; expiresIn: number }>(
      '/auth/register',
      { method: 'POST', body: { name, email, password }, skipAuth: true }
    ),

  logout: () => request<void>('/auth/logout', { method: 'POST' }),

  me: () =>
    request<{
      id: string;
      email: string;
      name: string | null;
      avatarUrl: string | null;
    }>('/auth/me'),
};

// Documents API
export interface DocumentListItem {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  processingStatus: string;
  thumbnailUrl: string | null;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDetail extends DocumentListItem {
  s3Key: string;
  checksum: string | null;
  metadata: {
    title?: string;
    description?: string;
    tags?: string[];
    ocrText?: string;
    pageCount?: number;
    classification?: {
      category: string;
      confidence: number;
    };
  };
  versions: {
    id: string;
    versionNumber: number;
    sizeBytes: number;
    createdAt: string;
  }[];
  createdBy: {
    id: string;
    name: string | null;
    email: string;
  };
}

export const documentsApi = {
  list: (params?: DocumentSearchParams) =>
    request<DocumentListItem[]>('/documents', { params: params as Record<string, string | number | boolean | undefined> }),

  get: (id: string) => request<DocumentDetail>(`/documents/${id}`),

  create: (data: { name: string; mimeType: string; sizeBytes: number; folderId?: string }) =>
    request<{ document: DocumentListItem; uploadUrl: string; uploadFields?: Record<string, string> }>(
      '/documents',
      { method: 'POST', body: data }
    ),

  update: (id: string, data: { name?: string; folderId?: string | null; metadata?: Record<string, unknown> }) =>
    request<DocumentListItem>(`/documents/${id}`, { method: 'PATCH', body: data }),

  delete: (id: string) => request<void>(`/documents/${id}`, { method: 'DELETE' }),

  getDownloadUrl: (id: string) =>
    request<{ url: string; expiresIn: number }>(`/documents/${id}/download`),

  process: (id: string, operations: string[]) =>
    request<{ jobId: string }>(`/documents/${id}/process`, {
      method: 'POST',
      body: { operations },
    }),

  move: (id: string, folderId: string | null) =>
    request<DocumentListItem>(`/documents/${id}/move`, {
      method: 'POST',
      body: { folderId },
    }),

  copy: (id: string, folderId: string | null, newName?: string) =>
    request<DocumentListItem>(`/documents/${id}/copy`, {
      method: 'POST',
      body: { folderId, name: newName },
    }),
};

// Folders API
export interface FolderListItem {
  id: string;
  name: string;
  path: string;
  parentId: string | null;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FolderDetail extends FolderListItem {
  subfolders: FolderListItem[];
  documents: DocumentListItem[];
  totalSizeBytes: number;
  breadcrumb: { id: string; name: string; path: string }[];
}

export interface FolderTreeItem {
  id: string;
  name: string;
  path: string;
  children: FolderTreeItem[];
}

export const foldersApi = {
  list: (params?: PaginationParams & SortParams & { parentId?: string }) =>
    request<FolderListItem[]>('/folders', { params: params as Record<string, string | number | boolean | undefined> }),

  get: (id: string) => request<FolderDetail>(`/folders/${id}`),

  getTree: () => request<FolderTreeItem[]>('/folders/tree'),

  create: (data: { name: string; parentId?: string }) =>
    request<FolderListItem>('/folders', { method: 'POST', body: data }),

  update: (id: string, data: { name?: string; parentId?: string | null }) =>
    request<FolderListItem>(`/folders/${id}`, { method: 'PATCH', body: data }),

  delete: (id: string) => request<void>(`/folders/${id}`, { method: 'DELETE' }),

  move: (id: string, parentId: string | null) =>
    request<FolderListItem>(`/folders/${id}/move`, {
      method: 'POST',
      body: { parentId },
    }),
};

// Search API
export interface SearchResult {
  id: string;
  type: 'document' | 'folder';
  name: string;
  path: string;
  mimeType?: string;
  snippet?: string;
  score?: number;
  createdAt: string;
}

export const searchApi = {
  search: (params: DocumentSearchParams) =>
    request<SearchResult[]>('/search', { params: params as Record<string, string | number | boolean | undefined> }),

  semantic: (params: SemanticSearchParams) =>
    request<SearchResult[]>('/search/semantic', {
      method: 'POST',
      body: params,
    }),

  suggest: (query: string) =>
    request<string[]>('/search/suggest', { params: { q: query } }),
};

// Storage API
export interface StorageStats {
  usedBytes: number;
  limitBytes: number;
  documentCount: number;
  folderCount: number;
}

export const storageApi = {
  getStats: () => request<StorageStats>('/storage/stats'),
};

// Processing Jobs API
export interface ProcessingJob {
  id: string;
  documentId: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: Record<string, unknown>;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export const jobsApi = {
  list: (params?: PaginationParams & { documentId?: string; status?: string }) =>
    request<ProcessingJob[]>('/jobs', { params: params as Record<string, string | number | boolean | undefined> }),

  get: (id: string) => request<ProcessingJob>(`/jobs/${id}`),
};

// Organizations API
export interface OrganizationListItem {
  id: string;
  name: string;
  slug: string;
  role: 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER';
  createdAt: string;
  memberCount?: number;
}

export interface OrganizationDetail extends OrganizationListItem {
  storageUsedBytes: number;
  storageLimitBytes: number;
  documentCount: number;
  memberCount: number;
}

export const organizationsApi = {
  list: () =>
    request<OrganizationListItem[]>('/organizations', { skipOrganization: true }),

  get: (id: string) =>
    request<OrganizationDetail>(`/organizations/${id}`),

  create: (data: { name: string; slug?: string }) =>
    request<OrganizationListItem>('/organizations', {
      method: 'POST',
      body: data,
      skipOrganization: true,
    }),

  getStorageUsage: (id: string) =>
    request<{ usedBytes: number; limitBytes: number }>(`/organizations/${id}/storage`),
};

// Export utilities
export {
  getAuthToken,
  setAuthTokens,
  clearAuthTokens,
  getCurrentOrganizationId,
  setCurrentOrganizationId,
  clearCurrentOrganizationId,
};
