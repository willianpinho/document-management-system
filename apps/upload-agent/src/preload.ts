/**
 * Upload Agent - Preload Script
 *
 * Securely exposes Electron APIs to the renderer process
 * using contextBridge for safe IPC communication.
 */

import { contextBridge, ipcRenderer } from 'electron';

// Window management APIs
const windowAPI = {
  minimize: () => ipcRenderer.send('window:minimize'),
  close: () => ipcRenderer.send('window:close'),
};

// Authentication APIs
const authAPI = {
  save: (credentials: {
    apiKey: string;
    apiSecret: string;
    organizationId: string;
    serverUrl: string;
  }) => ipcRenderer.invoke('auth:save', credentials),
  load: () => ipcRenderer.invoke('auth:load'),
  clear: () => ipcRenderer.invoke('auth:clear'),
  validate: () => ipcRenderer.invoke('auth:validate'),
  hasCredentials: () => ipcRenderer.invoke('auth:has-credentials'),
  createHeaders: (method: string, path: string, body?: string) =>
    ipcRenderer.invoke('auth:create-headers', method, path, body),
};

// Upload APIs
const uploadAPI = {
  add: (filePath: string, folderId?: string) =>
    ipcRenderer.invoke('upload:add', filePath, folderId),
  addMultiple: (filePaths: string[], folderId?: string) =>
    ipcRenderer.invoke('upload:add-multiple', filePaths, folderId),
  remove: (jobId: string) => ipcRenderer.invoke('upload:remove', jobId),
  retry: (jobId: string) => ipcRenderer.invoke('upload:retry', jobId),
  getQueue: () => ipcRenderer.invoke('upload:get-queue'),
  clearCompleted: () => ipcRenderer.invoke('upload:clear-completed'),
  onQueueUpdate: (callback: (queue: unknown[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, queue: unknown[]) =>
      callback(queue);
    ipcRenderer.on('upload:queue-update', handler);
    return () => ipcRenderer.off('upload:queue-update', handler);
  },
  onProgress: (
    callback: (data: { jobId: string; progress: number; uploadedBytes: number }) => void
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { jobId: string; progress: number; uploadedBytes: number }
    ) => callback(data);
    ipcRenderer.on('upload:progress', handler);
    return () => ipcRenderer.off('upload:progress', handler);
  },
  togglePause: (paused: boolean) => ipcRenderer.send('upload:toggle-pause', paused),
};

// File watcher APIs
const watcherAPI = {
  getConfigs: () => ipcRenderer.invoke('watcher:get-configs'),
  addConfig: (config: {
    path: string;
    folderId?: string;
    recursive: boolean;
    patterns: string[];
    enabled: boolean;
  }) => ipcRenderer.invoke('watcher:add-config', config),
  updateConfig: (
    id: string,
    updates: Partial<{
      path: string;
      folderId?: string;
      recursive: boolean;
      patterns: string[];
      enabled: boolean;
    }>
  ) => ipcRenderer.invoke('watcher:update-config', id, updates),
  removeConfig: (id: string) => ipcRenderer.invoke('watcher:remove-config', id),
  start: (id: string) => ipcRenderer.invoke('watcher:start', id),
  stop: (id: string) => ipcRenderer.invoke('watcher:stop', id),
  getStatus: (id: string) => ipcRenderer.invoke('watcher:status', id),
};

// Application APIs
const appAPI = {
  getVersion: () => ipcRenderer.invoke('app:version'),
  getPath: (name: string) => ipcRenderer.invoke('app:path', name),
  openExternal: (url: string) => ipcRenderer.invoke('app:open-external', url),
  showOpenDialog: (options: Electron.OpenDialogOptions) =>
    ipcRenderer.invoke('app:show-open-dialog', options),
};

// Navigation/Events APIs
const eventsAPI = {
  onNavigate: (callback: (route: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, route: string) =>
      callback(route);
    ipcRenderer.on('navigate', handler);
    return () => ipcRenderer.off('navigate', handler);
  },
};

// Expose APIs to renderer
contextBridge.exposeInMainWorld('dms', {
  window: windowAPI,
  auth: authAPI,
  upload: uploadAPI,
  watcher: watcherAPI,
  app: appAPI,
  events: eventsAPI,
});

// TypeScript declaration for global window object
declare global {
  interface Window {
    dms: {
      window: typeof windowAPI;
      auth: typeof authAPI;
      upload: typeof uploadAPI;
      watcher: typeof watcherAPI;
      app: typeof appAPI;
      events: typeof eventsAPI;
    };
  }
}
