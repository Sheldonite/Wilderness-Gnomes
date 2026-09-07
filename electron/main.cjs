// Desktop shell: hosts the built game, mirrors save data to a file that survives updates,
// pulls newer builds of main from GitHub Pages on request, and can update the shell itself
// from GitHub Releases as a fallback.
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DEV_URL = process.env.WILDERNESS_DEV_URL;
const PAGES_URL = process.env.WILDERNESS_BUNDLE_URL || 'https://sheldonite.github.io/Wilderness-Gnomes/';
const BUILT_IN_DIST = path.join(__dirname, '..', 'dist');

// ---- saves -------------------------------------------------------------------------------
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

// ---- game bundles ------------------------------------------------------------------------
// The exe ships with the dist/ it was built from. Newer builds of main are downloaded into
// userData/bundles/<commit>/ and the folder named in bundles/current.json is what loads.
const bundlesDir = () => path.join(app.getPath('userData'), 'bundles');
const currentPointer = () => path.join(bundlesDir(), 'current.json');

function readManifest(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, 'bundle-manifest.json'), 'utf8')); } catch { return null; }
}

function activeBundleDir() {
  try {
    const { commit } = JSON.parse(fs.readFileSync(currentPointer(), 'utf8'));
    const dir = path.join(bundlesDir(), commit);
    if (fs.existsSync(path.join(dir, 'index.html'))) return dir;
  } catch { /* no downloaded bundle yet */ }
  return BUILT_IN_DIST;
}

function activeCommit() {
  const manifest = readManifest(activeBundleDir());
  return manifest ? manifest.commit : 'unknown';
}

async function fetchRemoteManifest() {
  const response = await fetch(PAGES_URL + 'bundle-manifest.json?t=' + Date.now(), { cache: 'no-store' });
  if (!response.ok) throw new Error('GitHub Pages answered ' + response.status);
  const manifest = await response.json();
  if (!manifest || typeof manifest.commit !== 'string' || !Array.isArray(manifest.files)) throw new Error('Unexpected manifest');
  return manifest;
}

async function downloadBundle(manifest, report) {
  const target = path.join(bundlesDir(), manifest.commit), temp = target + '.tmp';
  fs.rmSync(temp, { recursive: true, force: true });
  fs.mkdirSync(temp, { recursive: true });
  const total = manifest.files.reduce((n, f) => n + f.size, 0);
  let done = 0;
  const local = readManifest(activeBundleDir());
  const reusable = new Map((local ? local.files : []).map(f => [f.path, f.sha256]));
  for (const file of manifest.files) {
    if (file.path.includes('..') || path.isAbsolute(file.path)) throw new Error('Unsafe path in manifest');
    const destination = path.join(temp, file.path);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    let data;
    if (reusable.get(file.path) === file.sha256) data = fs.readFileSync(path.join(activeBundleDir(), file.path));
    else {
      const response = await fetch(PAGES_URL + file.path.split('/').map(encodeURIComponent).join('/') + '?v=' + file.sha256.slice(0, 8), { cache: 'no-store' });
      if (!response.ok) throw new Error(file.path + ': ' + response.status);
      data = Buffer.from(await response.arrayBuffer());
    }
    if (crypto.createHash('sha256').update(data).digest('hex') !== file.sha256) throw new Error(file.path + ' failed its checksum');
    fs.writeFileSync(destination, data);
    done += file.size; report(Math.round(done / total * 100));
  }
  fs.writeFileSync(path.join(temp, 'bundle-manifest.json'), JSON.stringify(manifest, null, 1));
  fs.rmSync(target, { recursive: true, force: true });
  fs.renameSync(temp, target);
  fs.writeFileSync(currentPointer(), JSON.stringify({ commit: manifest.commit, installedAt: new Date().toISOString() }));
  // Keep only the newest bundle besides the one just installed.
  for (const entry of fs.readdirSync(bundlesDir(), { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name !== manifest.commit) fs.rmSync(path.join(bundlesDir(), entry.name), { recursive: true, force: true });
  }
}

// ---- window ------------------------------------------------------------------------------
function createWindow() {
  const win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 900, minHeight: 600, show: false, autoHideMenuBar: true,
    backgroundColor: '#182e23', title: 'Wilderness Gnomes',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: false }
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  loadGame(win);
  return win;
}

function loadGame(win) {
  if (DEV_URL) win.loadURL(DEV_URL); else win.loadFile(path.join(activeBundleDir(), 'index.html'));
}

function setupBundleUpdates(win) {
  const send = (status, detail = {}) => { if (!win.isDestroyed()) win.webContents.send('bundle:status', { status, ...detail }); };
  let pending = null;
  ipcMain.handle('bundle:check', async () => {
    send('checking');
    try {
      const remote = await fetchRemoteManifest();
      if (remote.commit === activeCommit()) { pending = null; return send('none', { commit: remote.commit, builtAt: remote.builtAt }); }
      pending = remote;
      send('available', { commit: remote.commit, builtAt: remote.builtAt, size: remote.files.reduce((n, f) => n + f.size, 0) });
    } catch (error) { send('error', { message: String((error && error.message) || error) }); }
  });
  ipcMain.handle('bundle:download', async () => {
    if (!pending) return send('error', { message: 'Check for updates first.' });
    try {
      await downloadBundle(pending, percent => send('downloading', { percent }));
      send('ready', { commit: pending.commit });
    } catch (error) { send('error', { message: String((error && error.message) || error) }); }
  });
  ipcMain.handle('bundle:apply', () => loadGame(win));
}

function setupShellUpdater(win) {
  const send = (status, detail = {}) => { if (!win.isDestroyed()) win.webContents.send('updates:status', { status, ...detail }); };
  if (!app.isPackaged) {
    ipcMain.handle('updates:check', () => send('unsupported', { message: 'Shell updates only work in the installed app.' }));
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
ipcMain.on('app:info', event => { event.returnValue = { version: app.getVersion(), commit: activeCommit() }; });

app.whenReady().then(() => {
  const win = createWindow();
  setupBundleUpdates(win);
  setupShellUpdater(win);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => app.quit());
