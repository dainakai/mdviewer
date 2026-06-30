const { app, BrowserWindow, Menu, ipcMain, dialog, shell, clipboard, nativeTheme } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdown', '.mkd', '.mkdn']);
const IMAGE_CONTENT_TYPES = new Map([
  ['.apng', 'image/apng'],
  ['.avif', 'image/avif'],
  ['.bmp', 'image/bmp'],
  ['.gif', 'image/gif'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp']
]);
const STARTUP_UPDATE_CHECK_DELAY_MS = 3500;
const isDev = Boolean(process.env.ELECTRON_RENDERER_URL);

let mainWindow = null;
let pendingOpenFiles = [];
let rendererReady = false;
let settingsCache = null;
let activeWatchers = new Map();
let watchDebounceTimers = new Map();
let startupUpdateCheckScheduled = false;
let updateCheckInProgress = false;
let updateDownloadInProgress = false;
let manualUpdateCheck = false;
let updateDialogOpen = false;

if (process.env.MDVIEWER_DISABLE_GPU === '1') {
  app.disableHardwareAcceleration();
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();

const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');

function isMarkdownPath(filePath) {
  return MARKDOWN_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function getMarkdownArgs(argv) {
  return argv
    .filter((arg) => arg && !arg.startsWith('-'))
    .map((arg) => path.resolve(arg))
    .filter((resolved) => {
      try {
        return fsSync.statSync(resolved).isFile() && isMarkdownPath(resolved);
      } catch {
        return false;
      }
    });
}

async function readSettings() {
  if (settingsCache) return settingsCache;
  try {
    const raw = await fs.readFile(settingsPath(), 'utf8');
    settingsCache = JSON.parse(raw);
  } catch {
    settingsCache = {};
  }
  settingsCache.zoom = Number.isFinite(settingsCache.zoom) ? settingsCache.zoom : 1;
  settingsCache.recentFiles = Array.isArray(settingsCache.recentFiles) ? settingsCache.recentFiles : [];
  return settingsCache;
}

async function writeSettings(nextSettings) {
  settingsCache = nextSettings;
  await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
  await fs.writeFile(settingsPath(), JSON.stringify(settingsCache, null, 2), 'utf8');
  return settingsCache;
}

async function updateSettings(mutator) {
  const current = await readSettings();
  const next = mutator({ ...current, recentFiles: [...current.recentFiles] });
  return writeSettings(next);
}

async function addRecentFile(filePath) {
  const absolutePath = path.resolve(filePath);
  await updateSettings((settings) => {
    settings.recentFiles = [
      absolutePath,
      ...settings.recentFiles.filter((candidate) => candidate !== absolutePath)
    ].slice(0, 20);
    return settings;
  });
}

function sendOpenFiles(filePaths) {
  const uniquePaths = [...new Set(filePaths.map((filePath) => path.resolve(filePath)))];
  if (!uniquePaths.length) return;
  if (!mainWindow || !rendererReady) {
    pendingOpenFiles.push(...uniquePaths);
    return;
  }
  mainWindow.webContents.send('files:open', uniquePaths);
}

function updateDialogParent() {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined;
}

function updateErrorMessage(error) {
  return error?.message ? String(error.message) : String(error ?? 'Unknown update error');
}

function canCheckForUpdates() {
  return app.isPackaged && !isDev;
}

async function showUpdateDialog(options) {
  updateDialogOpen = true;
  try {
    return await dialog.showMessageBox(updateDialogParent(), options);
  } finally {
    updateDialogOpen = false;
  }
}

async function notifyUpdateError(error, shouldShowDialog) {
  updateCheckInProgress = false;
  updateDownloadInProgress = false;
  manualUpdateCheck = false;
  console.error('Update check failed:', error);

  if (!shouldShowDialog || updateDialogOpen) return;
  await showUpdateDialog({
    type: 'error',
    buttons: ['OK'],
    title: 'Update Check Failed',
    message: 'Could not check for updates.',
    detail: updateErrorMessage(error)
  });
}

async function promptToInstallDownloadedUpdate(info) {
  if (updateDialogOpen) return;
  const version = info?.version ? ` ${info.version}` : '';
  const { response } = await showUpdateDialog({
    type: 'info',
    buttons: ['Restart and Install', 'Later'],
    defaultId: 0,
    cancelId: 1,
    title: 'Update Ready',
    message: `Markdown Viewer${version} has been downloaded.`,
    detail: 'Restart Markdown Viewer now to finish installing the update.'
  });

  if (response === 0) {
    autoUpdater.quitAndInstall(false, true);
  }
}

async function promptToDownloadUpdate(info) {
  updateCheckInProgress = false;
  manualUpdateCheck = false;
  if (updateDownloadInProgress || updateDialogOpen) return;

  const currentVersion = app.getVersion();
  const nextVersion = info?.version ?? 'a newer version';
  const { response } = await showUpdateDialog({
    type: 'info',
    buttons: ['Download Update', 'Later'],
    defaultId: 0,
    cancelId: 1,
    title: 'Update Available',
    message: `Markdown Viewer ${nextVersion} is available.`,
    detail: `You are currently using Markdown Viewer ${currentVersion}. Download the update now?`
  });

  if (response !== 0) return;

  updateDownloadInProgress = true;
  try {
    await autoUpdater.downloadUpdate();
  } catch (error) {
    await notifyUpdateError(error, true);
  }
}

function configureAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on('update-available', (info) => {
    promptToDownloadUpdate(info).catch((error) => notifyUpdateError(error, manualUpdateCheck));
  });

  autoUpdater.on('update-not-available', async () => {
    updateCheckInProgress = false;
    const shouldNotify = manualUpdateCheck;
    manualUpdateCheck = false;
    if (!shouldNotify || updateDialogOpen) return;
    await showUpdateDialog({
      type: 'info',
      buttons: ['OK'],
      title: 'No Updates Available',
      message: 'Markdown Viewer is up to date.',
      detail: `Current version: ${app.getVersion()}`
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    updateDownloadInProgress = false;
    promptToInstallDownloadedUpdate(info).catch((error) => notifyUpdateError(error, true));
  });

  autoUpdater.on('error', (error) => {
    notifyUpdateError(error, manualUpdateCheck || updateDownloadInProgress).catch((dialogError) => {
      console.error('Update error dialog failed:', dialogError);
    });
  });
}

async function checkForUpdates({ manual = false } = {}) {
  if (!canCheckForUpdates()) {
    if (manual) {
      await showUpdateDialog({
        type: 'info',
        buttons: ['OK'],
        title: 'Updates Unavailable',
        message: 'Update checks are only available in packaged builds.',
        detail: 'Run an installed release build to check GitHub Releases for updates.'
      });
    }
    return;
  }

  if (updateCheckInProgress || updateDownloadInProgress) {
    if (manual && !updateDialogOpen) {
      await showUpdateDialog({
        type: 'info',
        buttons: ['OK'],
        title: 'Update Check In Progress',
        message: 'Markdown Viewer is already checking for or downloading an update.'
      });
    }
    return;
  }

  updateCheckInProgress = true;
  manualUpdateCheck = manual;

  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    await notifyUpdateError(error, manual);
  }
}

function scheduleStartupUpdateCheck() {
  if (startupUpdateCheckScheduled || !canCheckForUpdates()) return;
  startupUpdateCheckScheduled = true;
  setTimeout(() => {
    checkForUpdates({ manual: false }).catch((error) => notifyUpdateError(error, false));
  }, STARTUP_UPDATE_CHECK_DELAY_MS);
}

function imageContentType(filePath) {
  return IMAGE_CONTENT_TYPES.get(path.extname(filePath).toLowerCase()) ?? 'application/octet-stream';
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 860,
    minHeight: 560,
    title: 'Markdown Viewer',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#171a18' : '#f4f5f2',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isDev) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    rendererReady = false;
  });
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open...',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow?.webContents.send('menu:open-dialog')
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send('menu:save')
        },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => mainWindow?.webContents.send('menu:close-tab')
        },
        { type: 'separator' },
        {
          label: 'Print',
          accelerator: 'CmdOrCtrl+P',
          click: () => mainWindow?.webContents.send('menu:print')
        },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { type: 'separator' },
        {
          label: 'Find',
          accelerator: 'CmdOrCtrl+F',
          click: () => mainWindow?.webContents.send('menu:find')
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates...',
          click: () => {
            checkForUpdates({ manual: true }).catch((error) => notifyUpdateError(error, true));
          }
        }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function rewatchFiles(filePaths) {
  const nextPaths = new Set(filePaths.map((filePath) => path.resolve(filePath)));

  for (const [watchedPath, watcher] of activeWatchers.entries()) {
    if (!nextPaths.has(watchedPath)) {
      watcher.close();
      activeWatchers.delete(watchedPath);
      clearTimeout(watchDebounceTimers.get(watchedPath));
      watchDebounceTimers.delete(watchedPath);
    }
  }

  for (const watchedPath of nextPaths) {
    if (activeWatchers.has(watchedPath)) continue;
    try {
      const watcher = fsSync.watch(watchedPath, { persistent: false }, () => {
        clearTimeout(watchDebounceTimers.get(watchedPath));
        watchDebounceTimers.set(watchedPath, setTimeout(() => {
          watchDebounceTimers.delete(watchedPath);
          const type = fsSync.existsSync(watchedPath) ? 'change' : 'unlink';
          mainWindow?.webContents.send('file:changed', { path: watchedPath, type });
        }, 160));
      });
      watcher.on('error', () => {
        activeWatchers.delete(watchedPath);
      });
      activeWatchers.set(watchedPath, watcher);
    } catch {
      mainWindow?.webContents.send('file:changed', { path: watchedPath, type: 'unlink' });
    }
  }
}

ipcMain.handle('renderer:ready', async () => {
  rendererReady = true;
  if (pendingOpenFiles.length) {
    const queued = [...new Set(pendingOpenFiles)];
    pendingOpenFiles = [];
    sendOpenFiles(queued);
  }
});

ipcMain.handle('settings:get', async () => readSettings());

ipcMain.handle('settings:setZoom', async (_event, zoom) => {
  const clampedZoom = Math.min(2.4, Math.max(0.55, Number(zoom) || 1));
  return updateSettings((settings) => {
    settings.zoom = clampedZoom;
    return settings;
  });
});

ipcMain.handle('settings:setTheme', async (_event, theme) => {
  const nextTheme = theme === 'dark' ? 'dark' : 'light';
  return updateSettings((settings) => {
    settings.theme = nextTheme;
    return settings;
  });
});

ipcMain.handle('config:userCss', async () => {
  const cssPath = path.join(os.homedir(), '.config', 'mdviewer', 'user.css');
  try {
    return await fs.readFile(cssPath, 'utf8');
  } catch {
    return '';
  }
});

ipcMain.handle('file:read', async (_event, filePath) => {
  const absolutePath = path.resolve(filePath);
  const content = await fs.readFile(absolutePath, 'utf8');
  const stat = await fs.stat(absolutePath);
  await addRecentFile(absolutePath);
  return {
    path: absolutePath,
    name: path.basename(absolutePath),
    directory: path.dirname(absolutePath),
    content,
    mtimeMs: stat.mtimeMs
  };
});

ipcMain.handle('file:readAsset', async (_event, filePath) => {
  const absolutePath = path.resolve(filePath);
  const data = await fs.readFile(absolutePath);
  return {
    path: absolutePath,
    contentType: imageContentType(absolutePath),
    bytes: new Uint8Array(data)
  };
});

ipcMain.handle('file:write', async (_event, filePath, content) => {
  const absolutePath = path.resolve(filePath);
  await fs.writeFile(absolutePath, content, 'utf8');
  const stat = await fs.stat(absolutePath);
  await addRecentFile(absolutePath);
  return {
    path: absolutePath,
    name: path.basename(absolutePath),
    directory: path.dirname(absolutePath),
    content,
    mtimeMs: stat.mtimeMs
  };
});

ipcMain.handle('file:openDialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Markdown',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd', 'mkdn'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (result.canceled) return [];
  return result.filePaths.filter(isMarkdownPath).map((filePath) => path.resolve(filePath));
});

ipcMain.handle('file:watch', async (_event, filePaths) => {
  await rewatchFiles(Array.isArray(filePaths) ? filePaths : []);
  return true;
});

ipcMain.handle('file:reveal', async (_event, filePath) => {
  shell.showItemInFolder(path.resolve(filePath));
});

ipcMain.handle('clipboard:writeText', async (_event, text) => {
  clipboard.writeText(String(text ?? ''));
});

ipcMain.handle('shell:openPathOrUrl', async (_event, target) => {
  const value = String(target ?? '');
  if (/^https?:\/\//i.test(value) || /^mailto:/i.test(value)) {
    await shell.openExternal(value);
    return;
  }
  if (value.startsWith('file://')) {
    await shell.openPath(decodeURI(new URL(value).pathname));
    return;
  }
  await shell.openPath(value);
});

ipcMain.handle('view:print', async () => {
  mainWindow?.webContents.print({ printBackground: true });
});

ipcMain.handle('view:printPdf', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export PDF',
    defaultPath: 'markdown.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (result.canceled || !result.filePath) return false;
  const pdf = await mainWindow.webContents.printToPDF({
    printBackground: true,
    marginsType: 0
  });
  await fs.writeFile(result.filePath, pdf);
  return true;
});

ipcMain.handle('find:start', async (_event, text, options = {}) => {
  const query = String(text ?? '');
  if (!query) {
    mainWindow?.webContents.stopFindInPage('clearSelection');
    return;
  }
  mainWindow?.webContents.findInPage(query, {
    forward: options.forward !== false,
    findNext: Boolean(options.findNext),
    matchCase: Boolean(options.matchCase)
  });
});

ipcMain.handle('find:stop', async () => {
  mainWindow?.webContents.stopFindInPage('clearSelection');
});

app.on('second-instance', (_event, argv) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
  sendOpenFiles(getMarkdownArgs(argv));
});

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (isMarkdownPath(filePath)) sendOpenFiles([filePath]);
});

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.whenReady().then(() => {
    pendingOpenFiles = getMarkdownArgs(process.argv);
    configureAutoUpdater();
    createMenu();
    createMainWindow();
    scheduleStartupUpdateCheck();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
  for (const watcher of activeWatchers.values()) {
    watcher.close();
  }
  activeWatchers.clear();
  for (const timer of watchDebounceTimers.values()) {
    clearTimeout(timer);
  }
  watchDebounceTimers.clear();
});
