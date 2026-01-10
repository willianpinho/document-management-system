/**
 * Desktop Upload Agent - Main Entry Point
 *
 * Bootstraps the Electron application with:
 * - Main window and tray management
 * - File system watcher for automatic uploads
 * - Upload queue management with chunked uploads
 * - API key authentication with HMAC signatures
 * - IPC communication between processes
 */

import { app } from 'electron';
import { createWindow, createTray, setupIPC, getMainWindow } from './main';
import { setupAuthIPC } from './auth';
import { setupUploaderIPC, processQueue, setMainWindow as setUploaderMainWindow } from './uploader';
import {
  setupWatcherIPC,
  initializeWatchers,
  setFileDetectedCallback,
  stopAllWatchers,
} from './watcher';
import { addUploadJob } from './uploader';

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window
    const mainWindow = getMainWindow();
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // App ready
  app.whenReady().then(async () => {
    // Setup IPC handlers
    setupIPC();
    setupAuthIPC();
    setupUploaderIPC();
    setupWatcherIPC();

    // Create window and tray
    const mainWindow = createWindow();
    createTray();

    // Set main window reference for uploader progress updates
    setUploaderMainWindow(mainWindow);

    // Initialize file watchers
    initializeWatchers();

    // Connect watcher to uploader
    setFileDetectedCallback((filePath, config) => {
      addUploadJob(filePath, config.folderId);
      processQueue();
    });

    // Start processing upload queue
    processQueue();
  });

  // Quit when all windows are closed (except on macOS)
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  // On macOS, recreate window when dock icon is clicked
  app.on('activate', () => {
    const mainWindow = getMainWindow();
    if (!mainWindow) {
      createWindow();
    }
  });

  // Cleanup on quit
  app.on('before-quit', async () => {
    await stopAllWatchers();
  });
}

// Export version info
export const version = app.getVersion?.() || '0.0.0';
export const name = '@dms/upload-agent';
