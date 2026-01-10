/**
 * Upload Agent - Renderer Process
 *
 * Main entry point for the renderer process. Handles UI interactions
 * and communicates with the main process via preload script.
 */

// DOM Elements
const authSection = document.getElementById('auth-section') as HTMLElement;
const uploadSection = document.getElementById('upload-section') as HTMLElement;
const authForm = document.getElementById('auth-form') as HTMLFormElement;
const dropZone = document.getElementById('drop-zone') as HTMLElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const browseBtn = document.getElementById('browse-btn') as HTMLButtonElement;
const uploadQueue = document.getElementById('upload-queue') as HTMLUListElement;
const emptyQueue = document.getElementById('empty-queue') as HTMLElement;
const pauseBtn = document.getElementById('pause-btn') as HTMLButtonElement;
const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement;
const disconnectBtn = document.getElementById('disconnect-btn') as HTMLButtonElement;
const minimizeBtn = document.getElementById('minimize-btn') as HTMLButtonElement;
const closeBtn = document.getElementById('close-btn') as HTMLButtonElement;
const versionSpan = document.getElementById('version') as HTMLSpanElement;
const addWatchBtn = document.getElementById('add-watch-btn') as HTMLButtonElement;
const watchList = document.getElementById('watch-list') as HTMLUListElement;
const emptyWatch = document.getElementById('empty-watch') as HTMLElement;

// State
let isPaused = false;

// Initialize
async function init() {
  // Get app version
  const version = await window.dms.app.getVersion();
  versionSpan.textContent = `v${version}`;

  // Check if already authenticated
  const hasCredentials = await window.dms.auth.hasCredentials();
  if (hasCredentials) {
    const isValid = await window.dms.auth.validate();
    if (isValid) {
      showUploadSection();
    } else {
      showAuthSection();
    }
  } else {
    showAuthSection();
  }

  // Setup event listeners
  setupEventListeners();

  // Subscribe to upload updates
  window.dms.upload.onQueueUpdate(updateQueueDisplay);
  window.dms.upload.onProgress(updateProgressDisplay);

  // Load initial queue
  const queue = await window.dms.upload.getQueue();
  updateQueueDisplay(queue);

  // Load watch folders
  const watchConfigs = await window.dms.watcher.getConfigs();
  updateWatchDisplay(watchConfigs);
}

function setupEventListeners() {
  // Window controls
  minimizeBtn.addEventListener('click', () => window.dms.window.minimize());
  closeBtn.addEventListener('click', () => window.dms.window.close());

  // Auth form
  authForm.addEventListener('submit', handleAuth);
  disconnectBtn.addEventListener('click', handleDisconnect);

  // File upload
  browseBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileSelect);

  // Drag and drop
  dropZone.addEventListener('dragover', handleDragOver);
  dropZone.addEventListener('dragleave', handleDragLeave);
  dropZone.addEventListener('drop', handleDrop);

  // Queue controls
  pauseBtn.addEventListener('click', handlePauseToggle);
  clearBtn.addEventListener('click', () => window.dms.upload.clearCompleted());

  // Watch folder controls
  addWatchBtn.addEventListener('click', handleAddWatchFolder);
}

function showAuthSection() {
  authSection.classList.remove('hidden');
  uploadSection.classList.add('hidden');
}

function showUploadSection() {
  authSection.classList.add('hidden');
  uploadSection.classList.remove('hidden');
}

async function handleAuth(event: Event) {
  event.preventDefault();

  const serverUrl = (document.getElementById('server-url') as HTMLInputElement).value;
  const apiKey = (document.getElementById('api-key') as HTMLInputElement).value;
  const apiSecret = (document.getElementById('api-secret') as HTMLInputElement).value;
  const organizationId = (document.getElementById('org-id') as HTMLInputElement).value;

  try {
    await window.dms.auth.save({
      serverUrl,
      apiKey,
      apiSecret,
      organizationId,
    });

    const isValid = await window.dms.auth.validate();
    if (isValid) {
      showUploadSection();
    } else {
      alert('Invalid credentials. Please check and try again.');
    }
  } catch (error) {
    alert('Failed to save credentials. Please try again.');
    console.error('Auth error:', error);
  }
}

async function handleDisconnect() {
  await window.dms.auth.clear();
  showAuthSection();
}

function handleDragOver(event: DragEvent) {
  event.preventDefault();
  event.stopPropagation();
  dropZone.classList.add('drag-over');
}

function handleDragLeave(event: DragEvent) {
  event.preventDefault();
  event.stopPropagation();
  dropZone.classList.remove('drag-over');
}

async function handleDrop(event: DragEvent) {
  event.preventDefault();
  event.stopPropagation();
  dropZone.classList.remove('drag-over');

  const files = event.dataTransfer?.files;
  if (!files || files.length === 0) return;

  const filePaths = Array.from(files).map((file) => (file as any).path);
  await window.dms.upload.addMultiple(filePaths);
}

async function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = input.files;
  if (!files || files.length === 0) return;

  const filePaths = Array.from(files).map((file) => (file as any).path);
  await window.dms.upload.addMultiple(filePaths);

  input.value = ''; // Reset input
}

function handlePauseToggle() {
  isPaused = !isPaused;
  window.dms.upload.togglePause(isPaused);
  pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
  pauseBtn.classList.toggle('btn-warning', isPaused);
}

function updateQueueDisplay(queue: any[]) {
  if (queue.length === 0) {
    uploadQueue.innerHTML = '';
    emptyQueue.classList.remove('hidden');
    return;
  }

  emptyQueue.classList.add('hidden');
  uploadQueue.innerHTML = queue
    .map(
      (job) => `
    <li class="upload-item ${job.status}" data-id="${job.id}">
      <div class="upload-info">
        <span class="upload-name">${job.fileName}</span>
        <span class="upload-size">${formatBytes(job.fileSize)}</span>
      </div>
      <div class="upload-progress">
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${job.progress}%"></div>
        </div>
        <span class="progress-text">${job.progress}%</span>
      </div>
      <div class="upload-status">
        <span class="status-badge ${job.status}">${job.status}</span>
        ${
          job.status === 'failed'
            ? `<button class="btn btn-small btn-secondary retry-btn">Retry</button>`
            : ''
        }
        ${
          job.status !== 'completed' && job.status !== 'cancelled'
            ? `<button class="btn btn-small btn-danger cancel-btn">Cancel</button>`
            : ''
        }
      </div>
    </li>
  `
    )
    .join('');

  // Add event listeners to buttons
  uploadQueue.querySelectorAll('.retry-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const jobId = (e.target as HTMLElement).closest('.upload-item')?.getAttribute('data-id');
      if (jobId) window.dms.upload.retry(jobId);
    });
  });

  uploadQueue.querySelectorAll('.cancel-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const jobId = (e.target as HTMLElement).closest('.upload-item')?.getAttribute('data-id');
      if (jobId) window.dms.upload.remove(jobId);
    });
  });
}

function updateProgressDisplay(data: { jobId: string; progress: number; uploadedBytes: number }) {
  const item = uploadQueue.querySelector(`[data-id="${data.jobId}"]`);
  if (!item) return;

  const progressFill = item.querySelector('.progress-fill') as HTMLElement;
  const progressText = item.querySelector('.progress-text') as HTMLElement;

  if (progressFill) progressFill.style.width = `${data.progress}%`;
  if (progressText) progressText.textContent = `${data.progress}%`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Watch folder functions
async function handleAddWatchFolder() {
  const result = await window.dms.app.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select folder to watch',
  });

  if (result.canceled || result.filePaths.length === 0) return;

  const folderPath = result.filePaths[0];

  try {
    const config = await window.dms.watcher.addConfig({
      path: folderPath,
      recursive: true,
      patterns: ['*'],
      enabled: true,
    });

    const configs = await window.dms.watcher.getConfigs();
    updateWatchDisplay(configs);
  } catch (error) {
    console.error('Failed to add watch folder:', error);
    alert('Failed to add watch folder. Please try again.');
  }
}

interface WatchConfig {
  id: string;
  path: string;
  folderId?: string;
  recursive: boolean;
  patterns: string[];
  enabled: boolean;
}

function updateWatchDisplay(configs: WatchConfig[]) {
  if (configs.length === 0) {
    watchList.innerHTML = '';
    emptyWatch.classList.remove('hidden');
    return;
  }

  emptyWatch.classList.add('hidden');
  watchList.innerHTML = configs
    .map(
      (config) => `
    <li class="watch-item" data-id="${config.id}">
      <div class="watch-info">
        <span class="watch-path" title="${config.path}">${truncatePath(config.path)}</span>
        <span class="watch-options">
          ${config.recursive ? 'Recursive' : 'Top-level only'}
        </span>
      </div>
      <div class="watch-actions">
        <button class="btn btn-small ${config.enabled ? 'btn-warning' : 'btn-primary'} toggle-watch-btn">
          ${config.enabled ? 'Disable' : 'Enable'}
        </button>
        <button class="btn btn-small btn-danger remove-watch-btn">Remove</button>
      </div>
    </li>
  `
    )
    .join('');

  // Add event listeners to buttons
  watchList.querySelectorAll('.toggle-watch-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const id = (e.target as HTMLElement).closest('.watch-item')?.getAttribute('data-id');
      if (!id) return;

      const config = configs.find((c) => c.id === id);
      if (!config) return;

      await window.dms.watcher.updateConfig(id, { enabled: !config.enabled });
      const updatedConfigs = await window.dms.watcher.getConfigs();
      updateWatchDisplay(updatedConfigs);
    });
  });

  watchList.querySelectorAll('.remove-watch-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const id = (e.target as HTMLElement).closest('.watch-item')?.getAttribute('data-id');
      if (!id) return;

      await window.dms.watcher.removeConfig(id);
      const updatedConfigs = await window.dms.watcher.getConfigs();
      updateWatchDisplay(updatedConfigs);
    });
  });
}

function truncatePath(fullPath: string, maxLength: number = 35): string {
  if (fullPath.length <= maxLength) return fullPath;

  const separator = fullPath.includes('\\') ? '\\' : '/';
  const parts = fullPath.split(separator);

  if (parts.length <= 2) {
    return '...' + fullPath.slice(-maxLength + 3);
  }

  // Keep first and last parts
  const first = parts[0];
  const last = parts[parts.length - 1];
  return `${first}${separator}...${separator}${last}`;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
