-- DMS Database Schema
-- Generated from Prisma schema

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enums
DO $$ BEGIN
    CREATE TYPE "AuthProvider" AS ENUM ('EMAIL', 'GOOGLE', 'MICROSOFT', 'GITHUB');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "OrganizationPlan" AS ENUM ('FREE', 'STARTER', 'PRO', 'ENTERPRISE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "MemberRole" AS ENUM ('VIEWER', 'EDITOR', 'ADMIN', 'OWNER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'READY', 'ERROR', 'DELETED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'OCR_IN_PROGRESS', 'OCR_COMPLETE', 'EMBEDDING_IN_PROGRESS', 'COMPLETE', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ProcessingJobType" AS ENUM ('OCR', 'PDF_SPLIT', 'PDF_MERGE', 'THUMBNAIL', 'AI_CLASSIFY', 'EMBEDDING');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ProcessingJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'STALLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "AuditAction" AS ENUM ('USER_LOGIN', 'USER_LOGOUT', 'USER_REGISTERED', 'DOCUMENT_CREATED', 'DOCUMENT_VIEWED', 'DOCUMENT_UPDATED', 'DOCUMENT_DELETED', 'DOCUMENT_DOWNLOADED', 'DOCUMENT_MOVED', 'DOCUMENT_COPIED', 'DOCUMENT_RESTORED', 'FOLDER_CREATED', 'FOLDER_UPDATED', 'FOLDER_DELETED', 'FOLDER_MOVED', 'PROCESSING_STARTED', 'PROCESSING_COMPLETED', 'PROCESSING_FAILED', 'ORGANIZATION_CREATED', 'ORGANIZATION_UPDATED', 'MEMBER_INVITED', 'MEMBER_REMOVED', 'MEMBER_ROLE_CHANGED', 'SETTINGS_UPDATED', 'API_KEY_CREATED', 'API_KEY_REVOKED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ResourceType" AS ENUM ('USER', 'ORGANIZATION', 'FOLDER', 'DOCUMENT', 'DOCUMENT_VERSION', 'PROCESSING_JOB', 'API_KEY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "SharePermission" AS ENUM ('VIEW', 'COMMENT', 'EDIT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    avatar_url VARCHAR(512),
    provider "AuthProvider" NOT NULL DEFAULT 'EMAIL',
    provider_id VARCHAR(255),
    password VARCHAR(255),
    preferences JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider, provider_id);

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    plan "OrganizationPlan" NOT NULL DEFAULT 'FREE',
    storage_quota_bytes BIGINT NOT NULL DEFAULT 5368709120,
    storage_used_bytes BIGINT NOT NULL DEFAULT 0,
    settings JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

-- Organization members table
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role "MemberRole" NOT NULL DEFAULT 'VIEWER',
    invited_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    joined_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);

-- Folders table
CREATE TABLE IF NOT EXISTS folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    path VARCHAR(2048) NOT NULL,
    depth INT NOT NULL DEFAULT 0,
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, parent_id, name)
);
CREATE INDEX IF NOT EXISTS idx_folders_org ON folders(organization_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_folders_path ON folders(path);
CREATE INDEX IF NOT EXISTS idx_folders_created_by ON folders(created_by_id);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255),
    mime_type VARCHAR(127) NOT NULL,
    size_bytes BIGINT NOT NULL,
    s3_key VARCHAR(1024) NOT NULL,
    s3_version_id VARCHAR(255),
    checksum VARCHAR(64),
    status "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    processing_status "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    metadata JSONB NOT NULL DEFAULT '{}',
    extracted_text TEXT,
    thumbnail_key VARCHAR(1024),
    content_vector vector(1536),
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_documents_org ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_folder ON documents(folder_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_processing ON documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_documents_mime ON documents(mime_type);
CREATE INDEX IF NOT EXISTS idx_documents_created_by ON documents(created_by_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);
CREATE INDEX IF NOT EXISTS idx_documents_deleted ON documents(deleted_at);

-- Document versions table
CREATE TABLE IF NOT EXISTS document_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    s3_key VARCHAR(1024) NOT NULL,
    s3_version_id VARCHAR(255),
    size_bytes BIGINT NOT NULL,
    checksum VARCHAR(64),
    change_note VARCHAR(500),
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(document_id, version_number)
);
CREATE INDEX IF NOT EXISTS idx_doc_versions_doc ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_versions_created_by ON document_versions(created_by_id);

-- Processing jobs table
CREATE TABLE IF NOT EXISTS processing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    job_type "ProcessingJobType" NOT NULL,
    status "ProcessingJobStatus" NOT NULL DEFAULT 'PENDING',
    priority INT NOT NULL DEFAULT 0,
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    input_params JSONB NOT NULL DEFAULT '{}',
    output_data JSONB,
    error_message TEXT,
    error_stack TEXT,
    scheduled_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_proc_jobs_doc ON processing_jobs(document_id);
CREATE INDEX IF NOT EXISTS idx_proc_jobs_status ON processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_proc_jobs_type ON processing_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_proc_jobs_scheduled ON processing_jobs(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_proc_jobs_created ON processing_jobs(created_at);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action "AuditAction" NOT NULL,
    resource_type "ResourceType" NOT NULL,
    resource_id UUID,
    metadata JSONB NOT NULL DEFAULT '{}',
    ip_address VARCHAR(45),
    user_agent VARCHAR(512),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

-- API keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(8) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    scopes TEXT[] NOT NULL DEFAULT '{}',
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    revoked_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

-- Refresh tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID NOT NULL,
    device_id VARCHAR(255),
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_expires ON refresh_tokens(expires_at);

-- Document shares table
CREATE TABLE IF NOT EXISTS document_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID,
    folder_id UUID,
    shared_with_id UUID NOT NULL,
    shared_by_id UUID NOT NULL,
    permission "SharePermission" NOT NULL DEFAULT 'VIEW',
    message VARCHAR(500),
    expires_at TIMESTAMP,
    notified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(document_id, shared_with_id),
    UNIQUE(folder_id, shared_with_id)
);
CREATE INDEX IF NOT EXISTS idx_doc_shares_doc ON document_shares(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_shares_folder ON document_shares(folder_id);
CREATE INDEX IF NOT EXISTS idx_doc_shares_with ON document_shares(shared_with_id);
CREATE INDEX IF NOT EXISTS idx_doc_shares_by ON document_shares(shared_by_id);

-- Share links table
CREATE TABLE IF NOT EXISTS share_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID,
    folder_id UUID,
    token VARCHAR(64) UNIQUE NOT NULL,
    permission "SharePermission" NOT NULL DEFAULT 'VIEW',
    password VARCHAR(255),
    max_downloads INT,
    download_count INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMP,
    created_by_id UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_share_links_doc ON share_links(document_id);
CREATE INDEX IF NOT EXISTS idx_share_links_folder ON share_links(folder_id);
CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_resolved BOOLEAN NOT NULL DEFAULT false,
    resolved_by_id UUID REFERENCES users(id),
    resolved_at TIMESTAMP,
    edited_at TIMESTAMP,
    page_number INT,
    position_x FLOAT,
    position_y FLOAT,
    selection_start INT,
    selection_end INT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_comments_doc ON comments(document_id);
CREATE INDEX IF NOT EXISTS idx_comments_author ON comments(author_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created_at);

-- Comment mentions table
CREATE TABLE IF NOT EXISTS comment_mentions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    mentioned_id UUID NOT NULL,
    notified BOOLEAN NOT NULL DEFAULT false,
    notified_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(comment_id, mentioned_id)
);
CREATE INDEX IF NOT EXISTS idx_mentions_comment ON comment_mentions(comment_id);
CREATE INDEX IF NOT EXISTS idx_mentions_mentioned ON comment_mentions(mentioned_id);

-- Upload sessions table
CREATE TABLE IF NOT EXISTS upload_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    user_id UUID NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(127) NOT NULL,
    total_bytes BIGINT NOT NULL,
    uploaded_bytes BIGINT NOT NULL DEFAULT 0,
    chunk_size INT NOT NULL DEFAULT 5242880,
    total_chunks INT NOT NULL,
    uploaded_chunks INT NOT NULL DEFAULT 0,
    s3_key VARCHAR(1024) NOT NULL,
    s3_upload_id VARCHAR(255),
    folder_id UUID,
    status "UploadStatus" NOT NULL DEFAULT 'PENDING',
    metadata JSONB NOT NULL DEFAULT '{}',
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_org ON upload_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_user ON upload_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_status ON upload_sessions(status);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_expires ON upload_sessions(expires_at);

-- Upload chunks table
CREATE TABLE IF NOT EXISTS upload_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    upload_session_id UUID NOT NULL REFERENCES upload_sessions(id) ON DELETE CASCADE,
    chunk_number INT NOT NULL,
    size_bytes INT NOT NULL,
    checksum VARCHAR(64),
    s3_etag VARCHAR(255),
    uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(upload_session_id, chunk_number)
);
CREATE INDEX IF NOT EXISTS idx_upload_chunks_session ON upload_chunks(upload_session_id);

-- User presence table
CREATE TABLE IF NOT EXISTS user_presence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    document_id UUID NOT NULL,
    organization_id UUID NOT NULL,
    socket_id VARCHAR(255),
    cursor_position JSONB,
    last_active_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, document_id)
);
CREATE INDEX IF NOT EXISTS idx_presence_doc ON user_presence(document_id);
CREATE INDEX IF NOT EXISTS idx_presence_org ON user_presence(organization_id);
CREATE INDEX IF NOT EXISTS idx_presence_active ON user_presence(last_active_at);

-- Prisma migrations table
CREATE TABLE IF NOT EXISTS _prisma_migrations (
    id VARCHAR(36) PRIMARY KEY,
    checksum VARCHAR(64) NOT NULL,
    finished_at TIMESTAMP WITH TIME ZONE,
    migration_name VARCHAR(255) NOT NULL,
    logs TEXT,
    rolled_back_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    applied_steps_count INT NOT NULL DEFAULT 0
);

-- Vector search function
CREATE OR REPLACE FUNCTION search_documents_by_vector(
    p_organization_id UUID,
    p_query_vector vector(1536),
    p_threshold FLOAT DEFAULT 0.7,
    p_limit INT DEFAULT 10
)
RETURNS TABLE (
    document_id UUID,
    document_name VARCHAR,
    similarity FLOAT
)
LANGUAGE SQL
STABLE
AS $$
    SELECT
        d.id as document_id,
        d.name as document_name,
        (1 - (d.content_vector <=> p_query_vector))::FLOAT as similarity
    FROM documents d
    WHERE d.organization_id = p_organization_id
      AND d.status != 'DELETED'
      AND d.content_vector IS NOT NULL
      AND (1 - (d.content_vector <=> p_query_vector)) >= p_threshold
    ORDER BY d.content_vector <=> p_query_vector ASC
    LIMIT p_limit;
$$;
