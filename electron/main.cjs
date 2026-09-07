// Desktop shell: hosts the built game, mirrors save data to a file that survives updates,
// and checks GitHub Releases for new versions on request.
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const DEV_URL = process.env.WILDERNESS_DEV_URL;
const savesDir = () => path.join(app.getPath('userData'), 'saves');
const savePath = () => path.join(savesDir(), 'progress.json');
const backupPath = () => path.join(savesDir(), 'progress.previous.json');

function readSaves() {
  for (const file of [savePath(), backupPath()]) {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (data && typeof data.entries === 'object') return data.entries;
    } catch { /* missing or unreadable: try the previous copy */ }
  }
  return {};
}

function writeSaves(entries) {
  fs.mkdirSync(savesDir(), { recursive: true });
  const target = savePath(), temp = target + '.tmp';
  if (fs.existsSync(target)) fs.copyFileSync(target, backupPath());
  fs.writeFileSync(temp, JSON.stringify({ savedAt: new Date().toISOString(), version: app.getVersion(), entries }, null, 2));
  fs.renameSync(temp, target);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 900, minHeight: 600, show: false, autoHideMenuBar: true,
    backgroundColor: '#182e23', title: 'Wilderness Gnomes',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: false }
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  if (DEV_URL) win.loadURL(DEV_URL); else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  return win;
}

function setupUpdater(win) {
  const send = (status, detail = {}) => { if (!win.isDestroyed()) win.webContents.send('updates:status', { status, ...detail }); };
  if (!app.isPackaged) {
    ipcMain.handle('updates:check', () => send('unsupported', { message: 'Updates only work in the installed app.' }));
    ipcMain.handle('updates:download', () => {});
    ipcMain.handle('updates:install', () => {});
    return;
  }
  const { autoUpdater } = require('electron-updater');
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => send('checking'));
  autoUpdater.on('update-available', info => send('available', { version: info.version }));
  autoUpdater.on('update-not-available', () => send('none'));
  autoUpdater.on('download-progress', p => send('downloading', { percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', info => send('downloaded', { version: info.version }));
  autoUpdater.on('error', error => send('error', { message: String((error && error.message) || error) }));
  ipcMain.handle('updates:check', () => autoUpdater.checkForUpdates().catch(() => {}));
  ipcMain.handle('updates:download', () => autoUpdater.downloadUpdate().catch(() => {}));
  ipcMain.handle('updates:install', () => autoUpdater.quitAndInstall(false, true));
}

ipcMain.on('saves:load', event => { event.returnValue = readSaves(); });
ipcMain.handle('saves:store', (_event, entries) => {
  if (!entries || typeof entries !== 'object') return false;
  try { writeSaves(entries); return true; } catch { return false; }
});
ipcMain.on('app:version', event => { event.returnValue = app.getVersion(); });

app.whenReady().then(() => {
  const win = createWindow();
  setupUpdater(win);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => app.quit());
