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

// Mutex to prevent concurrent refresh requests
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  // If a refresh is already in progress, wait for it
  if (refreshPromise) {
    return refreshPromise;
  }

  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return null;

  // Create and store the refresh promise
  refreshPromise = (async () => {
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
      setAuthTokens(data.data?.accessToken || data.accessToken, data.data?.refreshToken || data.refreshToken);
      return data.data?.accessToken || data.accessToken;
    } catch {
      clearAuthTokens();
      return null;
    } finally {
      // Clear the mutex after refresh completes
      refreshPromise = null;
    }
  })();

  return refreshPromise;
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
export interface Session {
  id: string;
  device: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

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

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ success: boolean; message: string }>('/auth/change-password', {
      method: 'POST',
      body: { currentPassword, newPassword },
    }),

  getSessions: () => request<Session[]>('/auth/sessions'),

  revokeSession: (sessionId: string) =>
    request<{ success: boolean; message: string }>(`/auth/sessions/${sessionId}`, {
      method: 'DELETE',
    }),

  revokeAllSessions: () =>
    request<{ success: boolean; message: string }>('/auth/sessions', {
      method: 'DELETE',
    }),

  forgotPassword: (email: string) =>
    request<{ success: boolean; message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: { email },
      skipAuth: true,
    }),

  resetPassword: (token: string, newPassword: string) =>
    request<{ success: boolean; message: string }>('/auth/reset-password', {
      method: 'POST',
      body: { token, newPassword },
      skipAuth: true,
    }),
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

  confirmUpload: (id: string) =>
    request<DocumentListItem>(`/documents/${id}/confirm`, { method: 'POST' }),

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

  // Sharing
  getShares: (id: string) =>
    request<{
      users: Array<{
        id: string;
        email: string;
        name?: string;
        avatarUrl?: string;
        permission: 'VIEW' | 'COMMENT' | 'EDIT';
      }>;
      link: {
        id: string;
        token: string;
        permission: 'VIEW' | 'COMMENT' | 'EDIT';
        expiresAt?: string;
        downloadCount: number;
        maxDownloads?: number;
      } | null;
    }>(`/documents/${id}/shares`),

  share: (id: string, data: { email: string; permission: 'VIEW' | 'COMMENT' | 'EDIT' }) =>
    request<{ success: boolean }>(`/documents/${id}/shares`, {
      method: 'POST',
      body: data,
    }),

  removeShare: (id: string, userId: string) =>
    request<void>(`/documents/${id}/shares/${userId}`, { method: 'DELETE' }),

  updateSharePermission: (id: string, userId: string, permission: 'VIEW' | 'COMMENT' | 'EDIT') =>
    request<{ success: boolean }>(`/documents/${id}/shares/${userId}`, {
      method: 'PATCH',
      body: { permission },
    }),

  createShareLink: (id: string, permission: 'VIEW' | 'COMMENT' | 'EDIT') =>
    request<{
      id: string;
      token: string;
      permission: 'VIEW' | 'COMMENT' | 'EDIT';
      expiresAt?: string;
      downloadCount: number;
    }>(`/documents/${id}/share-link`, {
      method: 'POST',
      body: { permission },
    }),

  deleteShareLink: (id: string) =>
    request<void>(`/documents/${id}/share-link`, { method: 'DELETE' }),

  // Version history
  getVersions: (id: string) =>
    request<Array<{
      id: string;
      versionNumber: number;
      sizeBytes: number;
      checksum?: string;
      changeNote?: string;
      createdAt: string;
      createdBy?: {
        id: string;
        name?: string;
        email: string;
        avatarUrl?: string;
      };
    }>>(`/documents/${id}/versions`),

  getVersionDownloadUrl: (id: string, versionId: string) =>
    request<{ url: string; expiresIn: number }>(`/documents/${id}/versions/${versionId}/download`),

  restoreVersion: (id: string, versionId: string) =>
    request<DocumentDetail>(`/documents/${id}/versions/${versionId}/restore`, {
      method: 'POST',
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

  // Sharing
  getShares: (id: string) =>
    request<{
      users: Array<{
        id: string;
        email: string;
        name?: string | null;
        avatarUrl?: string | null;
        permission: 'VIEW' | 'EDIT' | 'ADMIN';
        canShare: boolean;
        sharedAt: string;
      }>;
      link: {
        id: string;
        token: string;
        permission: 'VIEW' | 'EDIT' | 'ADMIN';
        expiresAt?: string | null;
        hasPassword: boolean;
        maxUses?: number | null;
        useCount: number;
        createdAt: string;
      } | null;
    }>(`/folders/${id}/shares`),

  shareWithUser: (id: string, data: { email: string; permission: 'VIEW' | 'EDIT' | 'ADMIN'; canShare?: boolean }) =>
    request<{
      id: string;
      email: string;
      name?: string | null;
      avatarUrl?: string | null;
      permission: 'VIEW' | 'EDIT' | 'ADMIN';
      canShare: boolean;
      sharedAt: string;
    }>(`/folders/${id}/shares`, {
      method: 'POST',
      body: data,
    }),

  updateShare: (id: string, userId: string, data: { permission?: 'VIEW' | 'EDIT' | 'ADMIN'; canShare?: boolean }) =>
    request<{
      id: string;
      email: string;
      name?: string | null;
      permission: 'VIEW' | 'EDIT' | 'ADMIN';
      canShare: boolean;
      sharedAt: string;
    }>(`/folders/${id}/shares/${userId}`, {
      method: 'PATCH',
      body: data,
    }),

  removeShare: (id: string, userId: string) =>
    request<void>(`/folders/${id}/shares/${userId}`, { method: 'DELETE' }),

  createShareLink: (id: string, data: {
    permission: 'VIEW' | 'EDIT' | 'ADMIN';
    expiresAt?: string;
    password?: string;
    maxUses?: number;
  }) =>
    request<{
      id: string;
      token: string;
      permission: 'VIEW' | 'EDIT' | 'ADMIN';
      expiresAt?: string | null;
      hasPassword: boolean;
      maxUses?: number | null;
      useCount: number;
      createdAt: string;
    }>(`/folders/${id}/share-link`, {
      method: 'POST',
      body: data,
    }),

  deleteShareLink: (id: string) =>
    request<void>(`/folders/${id}/share-link`, { method: 'DELETE' }),

  getInheritedShares: (id: string) =>
    request<Array<{
      folderId: string;
      folderName: string;
      users: Array<{
        id: string;
        email: string;
        name?: string | null;
        avatarUrl?: string | null;
        permission: 'VIEW' | 'EDIT' | 'ADMIN';
        canShare: boolean;
        sharedAt: string;
      }>;
    }>>(`/folders/${id}/inherited-shares`),
};

// Search API
export type SearchType = 'all' | 'documents' | 'folders';
export type SortField = 'relevance' | 'name' | 'createdAt' | 'updatedAt' | 'size';
export type SortOrder = 'asc' | 'desc';

export interface SearchResult {
  id: string;
  type: 'document' | 'folder';
  name: string;
  path: string;
  mimeType?: string;
  sizeBytes?: number;
  snippet?: string;
  highlights?: string[];
  score?: number;
  similarityScore?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  searchType: 'text' | 'semantic' | 'hybrid';
  timing?: {
    textMs?: number;
    semanticMs?: number;
    rerankMs?: number;
    totalMs: number;
  };
}

export interface SearchFilters {
  mimeTypes?: string[];
  folderId?: string;
  createdAfter?: string;
  createdBefore?: string;
  minSize?: number;
  maxSize?: number;
  hasEmbeddings?: boolean;
}

export interface SemanticSearchInput {
  query: string;
  limit?: number;
  threshold?: number;
  filters?: SearchFilters;
  enableReranking?: boolean;
}

export interface HybridSearchInput {
  query: string;
  limit?: number;
  textWeight?: number;
  semanticWeight?: number;
  threshold?: number;
  filters?: SearchFilters;
  enableReranking?: boolean;
}

export const searchApi = {
  // Full-text search
  search: (params: {
    q: string;
    type?: SearchType;
    page?: number;
    limit?: number;
    sortBy?: SortField;
    sortOrder?: SortOrder;
    mimeType?: string;
    dateFrom?: string;
    folderId?: string;
  }) =>
    request<SearchResponse>('/search', {
      params: params as Record<string, string | number | boolean | undefined>,
    }),

  // Semantic search (AI-powered)
  semantic: (params: SemanticSearchInput) =>
    request<SearchResponse>('/search/semantic', {
      method: 'POST',
      body: params,
    }),

  // Hybrid search (combined text + semantic)
  hybrid: (params: HybridSearchInput) =>
    request<SearchResponse>('/search/hybrid', {
      method: 'POST',
      body: params,
    }),

  // Autocomplete suggestions
  suggest: (query: string, limit?: number) =>
    request<{ suggestions: string[] }>('/search/suggest', {
      params: { q: query, limit: limit || 5 },
    }),
};

// Storage API
export interface StorageStats {
  usedBytes: number;
  limitBytes: number;
  documentCount: number;
  folderCount: number;
}

export const storageApi = {
  getStats: (organizationId: string) =>
    request<{ usedBytes: number; quotaBytes: number; usagePercent: number }>(
      `/organizations/${organizationId}/storage`
    ),
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
  attempts?: number;
  maxAttempts?: number;
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

export interface OrganizationMember {
  userId: string;
  organizationId: string;
  role: 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER';
  joinedAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
  };
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface ApiKeyCreated extends ApiKey {
  key: string;
  message: string;
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

  update: (id: string, data: { name?: string; settings?: Record<string, unknown> }) =>
    request<OrganizationDetail>(`/organizations/${id}`, {
      method: 'PATCH',
      body: data,
    }),

  getStorageUsage: (id: string) =>
    request<{ usedBytes: number; quotaBytes: number; usagePercent: number }>(
      `/organizations/${id}/storage`
    ),

  getMembers: (id: string) =>
    request<OrganizationMember[]>(`/organizations/${id}/members`),

  inviteMember: (id: string, email: string, role: string = 'VIEWER') =>
    request<OrganizationMember>(`/organizations/${id}/members`, {
      method: 'POST',
      body: { email, role },
    }),

  updateMemberRole: (id: string, memberId: string, role: string) =>
    request<OrganizationMember>(`/organizations/${id}/members/${memberId}`, {
      method: 'PATCH',
      body: { role },
    }),

  removeMember: (id: string, memberId: string) =>
    request<void>(`/organizations/${id}/members/${memberId}`, {
      method: 'DELETE',
    }),

  // API Keys
  getApiKeys: (id: string) =>
    request<ApiKey[]>(`/organizations/${id}/api-keys`),

  createApiKey: (id: string, data: { name: string; scopes?: string[]; expiresAt?: string }) =>
    request<ApiKeyCreated>(`/organizations/${id}/api-keys`, {
      method: 'POST',
      body: data,
    }),

  revokeApiKey: (id: string, keyId: string) =>
    request<{ success: boolean; message: string }>(`/organizations/${id}/api-keys/${keyId}`, {
      method: 'DELETE',
    }),
};

// Users API
export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPreferences {
  emailOnUpload?: boolean;
  emailOnProcessingComplete?: boolean;
  emailOnShare?: boolean;
  emailOnComments?: boolean;
  weeklyDigest?: boolean;
  marketingEmails?: boolean;
}

export interface AppearancePreferences {
  theme?: 'light' | 'dark' | 'system';
  accentColor?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  compactMode?: boolean;
}

export interface UserPreferences {
  notifications?: NotificationPreferences;
  appearance?: AppearancePreferences;
}

export interface UserDataExport {
  profile: UserProfile;
  preferences: UserPreferences;
  documents: { id: string; name: string; createdAt: string }[];
  folders: { id: string; name: string; path: string }[];
  exportedAt: string;
}

export const usersApi = {
  getProfile: () => request<UserProfile>('/users/me'),

  updateProfile: (data: { name?: string; avatarUrl?: string }) =>
    request<UserProfile>('/users/me', { method: 'PATCH', body: data }),

  getPreferences: () =>
    request<UserPreferences>('/users/me/preferences'),

  updatePreferences: (preferences: UserPreferences) =>
    request<UserPreferences>('/users/me/preferences', { method: 'PUT', body: preferences }),

  exportData: () =>
    request<UserDataExport>('/users/me/export'),

  deleteAccount: () =>
    request<{ success: boolean }>('/users/me', { method: 'DELETE' }),
};

// Comments API
export interface CommentAuthor {
  id: string;
  name: string | null;
  email: string;
  avatarUrl?: string | null;
}

export interface CommentMention {
  id: string;
  name: string | null;
  email: string;
}

export interface Comment {
  id: string;
  documentId: string;
  author: CommentAuthor;
  parentId: string | null;
  content: string;
  isResolved: boolean;
  resolvedBy: CommentAuthor | null;
  resolvedAt: string | null;
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
  pageNumber: number | null;
  positionX: number | null;
  positionY: number | null;
  selectionStart: number | null;
  selectionEnd: number | null;
  mentions: CommentMention[];
  replyCount: number;
  replies?: Comment[];
}

export interface CreateCommentInput {
  content: string;
  parentId?: string;
  pageNumber?: number;
  positionX?: number;
  positionY?: number;
  selectionStart?: number;
  selectionEnd?: number;
  mentions?: string[];
}

export interface UpdateCommentInput {
  content?: string;
  mentions?: string[];
}

export interface CommentListResponse {
  data: Comment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const commentsApi = {
  list: (documentId: string, params?: { page?: number; limit?: number; includeReplies?: boolean }) =>
    request<CommentListResponse>(`/documents/${documentId}/comments`, {
      params: params as Record<string, string | number | boolean | undefined>,
    }),

  get: (documentId: string, commentId: string) =>
    request<Comment>(`/documents/${documentId}/comments/${commentId}`),

  create: (documentId: string, data: CreateCommentInput) =>
    request<Comment>(`/documents/${documentId}/comments`, {
      method: 'POST',
      body: data,
    }),

  update: (documentId: string, commentId: string, data: UpdateCommentInput) =>
    request<Comment>(`/documents/${documentId}/comments/${commentId}`, {
      method: 'PATCH',
      body: data,
    }),

  resolve: (documentId: string, commentId: string, resolved: boolean = true) =>
    request<Comment>(`/documents/${documentId}/comments/${commentId}/resolve`, {
      method: 'PATCH',
      body: { resolved },
    }),

  delete: (documentId: string, commentId: string) =>
    request<void>(`/documents/${documentId}/comments/${commentId}`, {
      method: 'DELETE',
    }),

  getCount: (documentId: string) =>
    request<{ total: number; resolved: number }>(`/documents/${documentId}/comments/count`),
};

// Uploads API (Resumable Uploads)
export interface UploadSession {
  id: string;
  fileName: string;
  mimeType: string;
  totalBytes: number;
  uploadedBytes: number;
  chunkSize: number;
  totalChunks: number;
  uploadedChunks: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  expiresAt: string;
  createdAt: string;
  completedChunks: number[];
}

export interface ChunkUploadUrl {
  uploadUrl: string;
  chunkNumber: number;
  expiresIn: number;
}

export interface UploadChunkResult {
  success: boolean;
  chunkNumber: number;
  sizeBytes: number;
  uploadedBytes: number;
  uploadedChunks: number;
  isComplete: boolean;
}

export interface CompleteUploadResult {
  success: boolean;
  documentId: string;
  name: string;
  s3Key: string;
}

export interface CreateUploadSessionInput {
  fileName: string;
  mimeType: string;
  totalBytes: number;
  chunkSize?: number;
  folderId?: string;
  metadata?: Record<string, unknown>;
}

export const uploadsApi = {
  createSession: (data: CreateUploadSessionInput) =>
    request<UploadSession>('/uploads/sessions', {
      method: 'POST',
      body: data,
    }),

  getSession: (sessionId: string) =>
    request<UploadSession>(`/uploads/sessions/${sessionId}`),

  listSessions: (userId?: string) =>
    request<UploadSession[]>('/uploads/sessions', {
      params: userId ? { userId } : undefined,
    }),

  getChunkUploadUrl: (sessionId: string, chunkNumber: number) =>
    request<ChunkUploadUrl>(`/uploads/sessions/${sessionId}/chunks/${chunkNumber}/url`),

  confirmChunk: (sessionId: string, chunkNumber: number, etag: string, sizeBytes: number) =>
    request<UploadChunkResult>(`/uploads/sessions/${sessionId}/chunks/${chunkNumber}`, {
      method: 'PATCH',
      body: { etag, sizeBytes },
    }),

  completeUpload: (sessionId: string) =>
    request<CompleteUploadResult>(`/uploads/sessions/${sessionId}/complete`, {
      method: 'POST',
    }),

  cancelUpload: (sessionId: string) =>
    request<void>(`/uploads/sessions/${sessionId}`, {
      method: 'DELETE',
    }),
};

// Bulk Operations API
export interface BulkOperationResultItem {
  id: string;
  success: boolean;
  error?: string;
  newId?: string;
}

export interface BulkOperationResult {
  total: number;
  successful: number;
  failed: number;
  results: BulkOperationResultItem[];
}

export interface BulkDownloadResult {
  downloadUrl: string;
  expiresIn: number;
  fileCount: number;
  totalSizeBytes: number;
}

export const bulkApi = {
  delete: (documentIds: string[], folderIds?: string[], permanent?: boolean) =>
    request<BulkOperationResult>('/documents/bulk/delete', {
      method: 'POST',
      body: { documentIds, folderIds, permanent },
    }),

  move: (documentIds: string[], targetFolderId: string | null, folderIds?: string[]) =>
    request<BulkOperationResult>('/documents/bulk/move', {
      method: 'POST',
      body: { documentIds, folderIds, targetFolderId },
    }),

  copy: (documentIds: string[], targetFolderId: string | null) =>
    request<BulkOperationResult>('/documents/bulk/copy', {
      method: 'POST',
      body: { documentIds, targetFolderId },
    }),

  download: (documentIds: string[], folderIds?: string[]) =>
    request<BulkDownloadResult>('/documents/bulk/download', {
      method: 'POST',
      body: { documentIds, folderIds },
    }),
};

// Processing API (extended from ProcessingJob above with more specific types)

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export interface QueueInfo {
  key: string;
  name: string;
  description: string;
}

export const processingApi = {
  // Job management
  getJobStatus: (jobId: string) =>
    request<ProcessingJob>(`/processing/jobs/${jobId}`),

  retryJob: (jobId: string) =>
    request<{ success: boolean; message: string }>(`/processing/jobs/${jobId}/retry`, {
      method: 'POST',
    }),

  cancelJob: (jobId: string) =>
    request<{ success: boolean; message: string }>(`/processing/jobs/${jobId}`, {
      method: 'DELETE',
    }),

  getFailedJobs: (limit: number = 50, offset: number = 0) =>
    request<ProcessingJob[]>('/processing/jobs/failed', {
      params: { limit, offset },
    }),

  // Queue management
  getQueues: () =>
    request<{ queues: QueueInfo[] }>('/processing/queues'),

  getQueueStats: () =>
    request<Record<string, QueueStats>>('/processing/queues/stats'),

  getQueueStatsByName: (queueName: string) =>
    request<QueueStats>(`/processing/queues/${queueName}/stats`),

  pauseQueue: (queueName: string) =>
    request<{ success: boolean }>(`/processing/queues/${queueName}/pause`, {
      method: 'POST',
    }),

  resumeQueue: (queueName: string) =>
    request<{ success: boolean }>(`/processing/queues/${queueName}/resume`, {
      method: 'POST',
    }),

  drainQueue: (queueName: string) =>
    request<{ success: boolean; drained: number }>(`/processing/queues/${queueName}/drain`, {
      method: 'DELETE',
    }),

  // Cleanup
  cleanOldJobs: (olderThanDays: number = 7) =>
    request<{ removed: number }>('/processing/cleanup', {
      method: 'POST',
      params: { olderThanDays },
    }),

  // Trigger document processing
  triggerProcessing: (documentId: string, operations: string[]) =>
    request<{ jobIds: string[] }>(`/documents/${documentId}/process`, {
      method: 'POST',
      body: { operations },
    }),
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
