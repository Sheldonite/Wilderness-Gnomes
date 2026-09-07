const { contextBridge, ipcRenderer } = require('electron');

const subscribe = channel => listener => {
  const handler = (_event, status) => listener(status);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

const info = ipcRenderer.sendSync('app:info');

contextBridge.exposeInMainWorld('desktop', {
  version: info.version,
  commit: info.commit,
  loadSaves: () => ipcRenderer.sendSync('saves:load'),
  storeSaves: entries => ipcRenderer.invoke('saves:store', entries),
  // Game bundle: the latest build of main, published to GitHub Pages.
  checkForBundle: () => ipcRenderer.invoke('bundle:check'),
  downloadBundle: () => ipcRenderer.invoke('bundle:download'),
  applyBundle: () => ipcRenderer.invoke('bundle:apply'),
  onBundleStatus: subscribe('bundle:status'),
  // Shell: the installed exe, from GitHub Releases.
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  downloadUpdate: () => ipcRenderer.invoke('updates:download'),
  installUpdate: () => ipcRenderer.invoke('updates:install'),
  onUpdateStatus: subscribe('updates:status')
});
