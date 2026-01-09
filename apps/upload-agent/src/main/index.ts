/**
 * Upload Agent - Main Electron Window
 *
 * Responsible for creating and managing the main application window,
 * handling system tray integration, and coordinating IPC communication.
 */

import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage } from 'electron';
import * as path from 'path';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

/**
 * Create the main application window
 */
export function createWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    minWidth: 350,
    minHeight: 400,
    resizable: true,
    frame: false,
    transparent: false,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, '../preload.js'),
    },
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000/upload-agent');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Handle window close
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

/**
 * Create system tray with context menu
 */
export function createTray(): Tray {
  const icon = nativeImage.createFromPath(
    path.join(__dirname, '../../assets/tray-icon.png')
  );

  tray = new Tray(icon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Upload Agent',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Pause Uploads',
      type: 'checkbox',
      checked: false,
      click: (menuItem) => {
        mainWindow?.webContents.send('upload:toggle-pause', menuItem.checked);
      },
    },
    {
      label: 'Settings',
      click: () => {
        mainWindow?.webContents.send('navigate', '/settings');
        mainWindow?.show();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('DMS Upload Agent');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  return tray;
}

/**
 * Setup IPC handlers for renderer communication
 */
export function setupIPC(): void {
  // Window controls
  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:close', () => mainWindow?.hide());

  // App info
  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('app:path', (_, name: string) => app.getPath(name as any));

  // Tray badge
  ipcMain.on('tray:set-badge', (_, count: number) => {
    if (process.platform === 'darwin') {
      app.dock.setBadge(count > 0 ? count.toString() : '');
    }
  });
}

/**
 * Get the main window instance
 */
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

/**
 * Get the tray instance
 */
export function getTray(): Tray | null {
  return tray;
}

// Extend Electron app with custom property
declare module 'electron' {
  interface App {
    isQuitting: boolean;
  }
}
