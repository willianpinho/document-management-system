/**
 * Upload Agent - Authentication Module
 *
 * Handles API key-based authentication for machine-to-machine communication
 * with the DMS backend. Stores credentials securely using electron-store.
 */

import { ipcMain, safeStorage } from 'electron';
import Store from 'electron-store';
import crypto from 'crypto';

interface AuthCredentials {
  apiKey: string;
  apiSecret: string;
  organizationId: string;
  serverUrl: string;
}

interface AuthStore {
  credentials?: string; // Encrypted credentials
  lastValidated?: string;
}

const store = new Store<AuthStore>({
  name: 'auth',
  encryptionKey: 'dms-upload-agent-v1',
});

let cachedCredentials: AuthCredentials | null = null;

/**
 * Save authentication credentials securely
 */
export function saveCredentials(credentials: AuthCredentials): void {
  const json = JSON.stringify(credentials);

  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(json);
    store.set('credentials', encrypted.toString('base64'));
  } else {
    // Fallback to basic encryption (less secure)
    store.set('credentials', Buffer.from(json).toString('base64'));
  }

  cachedCredentials = credentials;
  store.set('lastValidated', new Date().toISOString());
}

/**
 * Load stored credentials
 */
export function loadCredentials(): AuthCredentials | null {
  if (cachedCredentials) {
    return cachedCredentials;
  }

  const stored = store.get('credentials');
  if (!stored) {
    return null;
  }

  try {
    let json: string;

    if (safeStorage.isEncryptionAvailable()) {
      const buffer = Buffer.from(stored, 'base64');
      json = safeStorage.decryptString(buffer);
    } else {
      json = Buffer.from(stored, 'base64').toString();
    }

    cachedCredentials = JSON.parse(json);
    return cachedCredentials;
  } catch {
    console.error('Failed to load credentials');
    return null;
  }
}

/**
 * Clear stored credentials
 */
export function clearCredentials(): void {
  store.delete('credentials');
  store.delete('lastValidated');
  cachedCredentials = null;
}

/**
 * Check if credentials are stored
 */
export function hasCredentials(): boolean {
  return store.has('credentials');
}

/**
 * Generate HMAC signature for API request
 */
export function generateSignature(
  method: string,
  path: string,
  timestamp: string,
  body?: string
): string {
  const credentials = loadCredentials();
  if (!credentials) {
    throw new Error('No credentials available');
  }

  const payload = [method.toUpperCase(), path, timestamp, body || ''].join('\n');

  const hmac = crypto.createHmac('sha256', credentials.apiSecret);
  hmac.update(payload);
  return hmac.digest('hex');
}

/**
 * Create authenticated headers for API request
 */
export function createAuthHeaders(
  method: string,
  path: string,
  body?: string
): Record<string, string> {
  const credentials = loadCredentials();
  if (!credentials) {
    throw new Error('No credentials available');
  }

  const timestamp = new Date().toISOString();
  const signature = generateSignature(method, path, timestamp, body);

  return {
    'X-API-Key': credentials.apiKey,
    'X-Timestamp': timestamp,
    'X-Signature': signature,
    'X-Organization-Id': credentials.organizationId,
  };
}

/**
 * Validate credentials against the server
 */
export async function validateCredentials(): Promise<boolean> {
  const credentials = loadCredentials();
  if (!credentials) {
    return false;
  }

  try {
    const headers = createAuthHeaders('GET', '/api/auth/validate');

    const response = await fetch(`${credentials.serverUrl}/api/auth/validate`, {
      method: 'GET',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      store.set('lastValidated', new Date().toISOString());
      return true;
    }

    return false;
  } catch (error) {
    console.error('Credential validation failed:', error);
    return false;
  }
}

/**
 * Setup IPC handlers for authentication
 */
export function setupAuthIPC(): void {
  ipcMain.handle('auth:save', (_, credentials: AuthCredentials) => {
    saveCredentials(credentials);
    return true;
  });

  ipcMain.handle('auth:load', () => {
    return loadCredentials();
  });

  ipcMain.handle('auth:clear', () => {
    clearCredentials();
    return true;
  });

  ipcMain.handle('auth:validate', async () => {
    return validateCredentials();
  });

  ipcMain.handle('auth:has-credentials', () => {
    return hasCredentials();
  });

  ipcMain.handle('auth:create-headers', (_, method: string, path: string, body?: string) => {
    return createAuthHeaders(method, path, body);
  });
}
