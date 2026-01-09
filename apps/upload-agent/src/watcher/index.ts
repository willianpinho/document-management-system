/**
 * Upload Agent - File System Watcher
 *
 * Monitors configured directories for new files and triggers
 * automatic uploads when files are added or modified.
 */

import { ipcMain } from 'electron';
import * as chokidar from 'chokidar';
import * as path from 'path';
import * as fs from 'fs';
import Store from 'electron-store';

interface WatchConfig {
  id: string;
  path: string;
  folderId?: string;
  recursive: boolean;
  patterns: string[];
  enabled: boolean;
}

interface WatcherStore {
  watchConfigs: WatchConfig[];
}

const store = new Store<WatcherStore>({
  name: 'watcher',
  defaults: {
    watchConfigs: [],
  },
});

const watchers = new Map<string, chokidar.FSWatcher>();
let onFileDetected: ((filePath: string, config: WatchConfig) => void) | null = null;

/**
 * Start watching a directory
 */
export function startWatcher(config: WatchConfig): void {
  if (watchers.has(config.id)) {
    console.log(`Watcher ${config.id} already running`);
    return;
  }

  if (!fs.existsSync(config.path)) {
    console.error(`Watch path does not exist: ${config.path}`);
    return;
  }

  const globPatterns = config.patterns.length > 0
    ? config.patterns.map((p) => path.join(config.path, config.recursive ? '**' : '', p))
    : [config.recursive ? path.join(config.path, '**', '*') : path.join(config.path, '*')];

  const watcher = chokidar.watch(globPatterns, {
    ignored: [
      /(^|[\/\\])\../,      // Ignore dotfiles
      /node_modules/,       // Ignore node_modules
      /\.git/,              // Ignore .git
      /\.DS_Store/,         // Ignore macOS metadata
      /Thumbs\.db/,         // Ignore Windows thumbnails
    ],
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100,
    },
    depth: config.recursive ? undefined : 0,
  });

  watcher.on('add', (filePath: string) => {
    console.log(`File detected: ${filePath}`);
    if (onFileDetected) {
      onFileDetected(filePath, config);
    }
  });

  watcher.on('change', (filePath: string) => {
    console.log(`File changed: ${filePath}`);
    // Optionally handle file updates
  });

  watcher.on('error', (error: Error) => {
    console.error(`Watcher error for ${config.id}:`, error);
  });

  watcher.on('ready', () => {
    console.log(`Watcher ${config.id} ready for: ${config.path}`);
  });

  watchers.set(config.id, watcher);
}

/**
 * Stop watching a directory
 */
export async function stopWatcher(configId: string): Promise<void> {
  const watcher = watchers.get(configId);
  if (watcher) {
    await watcher.close();
    watchers.delete(configId);
    console.log(`Watcher ${configId} stopped`);
  }
}

/**
 * Stop all watchers
 */
export async function stopAllWatchers(): Promise<void> {
  const stopPromises = Array.from(watchers.keys()).map((id) => stopWatcher(id));
  await Promise.all(stopPromises);
}

/**
 * Add a watch configuration
 */
export function addWatchConfig(config: Omit<WatchConfig, 'id'>): WatchConfig {
  const id = `watch-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const newConfig: WatchConfig = { ...config, id };

  const configs = store.get('watchConfigs');
  configs.push(newConfig);
  store.set('watchConfigs', configs);

  if (newConfig.enabled) {
    startWatcher(newConfig);
  }

  return newConfig;
}

/**
 * Update a watch configuration
 */
export async function updateWatchConfig(
  id: string,
  updates: Partial<Omit<WatchConfig, 'id'>>
): Promise<WatchConfig | null> {
  const configs = store.get('watchConfigs');
  const index = configs.findIndex((c) => c.id === id);

  if (index === -1) {
    return null;
  }

  const oldConfig = configs[index];
  const newConfig = { ...oldConfig, ...updates };
  configs[index] = newConfig;
  store.set('watchConfigs', configs);

  // Restart watcher if path or patterns changed
  if (
    oldConfig.path !== newConfig.path ||
    oldConfig.recursive !== newConfig.recursive ||
    JSON.stringify(oldConfig.patterns) !== JSON.stringify(newConfig.patterns)
  ) {
    await stopWatcher(id);
    if (newConfig.enabled) {
      startWatcher(newConfig);
    }
  } else if (oldConfig.enabled !== newConfig.enabled) {
    if (newConfig.enabled) {
      startWatcher(newConfig);
    } else {
      await stopWatcher(id);
    }
  }

  return newConfig;
}

/**
 * Remove a watch configuration
 */
export async function removeWatchConfig(id: string): Promise<boolean> {
  await stopWatcher(id);

  const configs = store.get('watchConfigs');
  const newConfigs = configs.filter((c) => c.id !== id);

  if (newConfigs.length === configs.length) {
    return false;
  }

  store.set('watchConfigs', newConfigs);
  return true;
}

/**
 * Get all watch configurations
 */
export function getWatchConfigs(): WatchConfig[] {
  return store.get('watchConfigs');
}

/**
 * Initialize all enabled watchers
 */
export function initializeWatchers(): void {
  const configs = store.get('watchConfigs');
  for (const config of configs) {
    if (config.enabled) {
      startWatcher(config);
    }
  }
}

/**
 * Set the file detection callback
 */
export function setFileDetectedCallback(
  callback: (filePath: string, config: WatchConfig) => void
): void {
  onFileDetected = callback;
}

/**
 * Setup IPC handlers for watcher
 */
export function setupWatcherIPC(): void {
  ipcMain.handle('watcher:get-configs', () => {
    return getWatchConfigs();
  });

  ipcMain.handle(
    'watcher:add-config',
    (_, config: Omit<WatchConfig, 'id'>) => {
      return addWatchConfig(config);
    }
  );

  ipcMain.handle(
    'watcher:update-config',
    async (_, id: string, updates: Partial<Omit<WatchConfig, 'id'>>) => {
      return updateWatchConfig(id, updates);
    }
  );

  ipcMain.handle('watcher:remove-config', async (_, id: string) => {
    return removeWatchConfig(id);
  });

  ipcMain.handle('watcher:start', (_, id: string) => {
    const configs = getWatchConfigs();
    const config = configs.find((c) => c.id === id);
    if (config) {
      startWatcher(config);
      return true;
    }
    return false;
  });

  ipcMain.handle('watcher:stop', async (_, id: string) => {
    await stopWatcher(id);
    return true;
  });

  ipcMain.handle('watcher:status', (_, id: string) => {
    return watchers.has(id);
  });
}
