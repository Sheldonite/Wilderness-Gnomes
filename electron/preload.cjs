const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  version: ipcRenderer.sendSync('app:version'),
  loadSaves: () => ipcRenderer.sendSync('saves:load'),
  storeSaves: entries => ipcRenderer.invoke('saves:store', entries),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  downloadUpdate: () => ipcRenderer.invoke('updates:download'),
  installUpdate: () => ipcRenderer.invoke('updates:install'),
  onUpdateStatus: listener => {
    const handler = (_event, status) => listener(status);
    ipcRenderer.on('updates:status', handler);
    return () => ipcRenderer.removeListener('updates:status', handler);
  }
});
