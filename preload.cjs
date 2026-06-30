const { contextBridge, ipcRenderer } = require('electron');

function on(channel, listener) {
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('mdviewer', {
  rendererReady: () => ipcRenderer.invoke('renderer:ready'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setZoom: (zoom) => ipcRenderer.invoke('settings:setZoom', zoom),
  setTheme: (theme) => ipcRenderer.invoke('settings:setTheme', theme),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  loadUserCss: () => ipcRenderer.invoke('config:userCss'),
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
  readAsset: (filePath) => ipcRenderer.invoke('file:readAsset', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('file:write', filePath, content),
  openFilesDialog: () => ipcRenderer.invoke('file:openDialog'),
  watchFiles: (filePaths) => ipcRenderer.invoke('file:watch', filePaths),
  revealFile: (filePath) => ipcRenderer.invoke('file:reveal', filePath),
  writeClipboard: (text) => ipcRenderer.invoke('clipboard:writeText', text),
  openPathOrUrl: (target) => ipcRenderer.invoke('shell:openPathOrUrl', target),
  print: () => ipcRenderer.invoke('view:print'),
  printPdf: (options) => ipcRenderer.invoke('view:printPdf', options),
  startFind: (text, options) => ipcRenderer.invoke('find:start', text, options),
  stopFind: () => ipcRenderer.invoke('find:stop'),
  onOpenFiles: (listener) => on('files:open', (_event, filePaths) => listener(filePaths)),
  onFileChanged: (listener) => on('file:changed', (_event, payload) => listener(payload)),
  onMenuOpenDialog: (listener) => on('menu:open-dialog', listener),
  onMenuSave: (listener) => on('menu:save', listener),
  onMenuCloseTab: (listener) => on('menu:close-tab', listener),
  onMenuFind: (listener) => on('menu:find', listener),
  onMenuPrint: (listener) => on('menu:print', listener)
});
