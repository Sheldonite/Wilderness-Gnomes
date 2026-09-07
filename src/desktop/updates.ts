import type { BundleStatus, UpdateStatus } from './desktop.d';

/**
 * Title-screen corner panel. The main button pulls the newest build of main from GitHub
 * Pages into the app and reloads. A small secondary link checks GitHub Releases for a newer
 * shell (the exe itself), which only changes when the Electron wrapper does.
 */
export function mountDesktopUpdates(root: HTMLElement): () => void {
  const desktop = window.desktop;
  if (!desktop) return () => {};
  const panel = document.createElement('aside');
  panel.className = 'desktop-updates';
  panel.innerHTML = '<span class="desktop-version"></span><span class="desktop-update-status" aria-live="polite"></span>'
    + '<button type="button" class="desktop-update-action"></button><button type="button" class="desktop-shell-link"></button>';
  panel.querySelector('.desktop-version')!.textContent = 'build ' + desktop.commit.slice(0, 7) + ' · app v' + desktop.version;
  const status = panel.querySelector<HTMLElement>('.desktop-update-status')!;
  const action = panel.querySelector<HTMLButtonElement>('.desktop-update-action')!;
  const shellLink = panel.querySelector<HTMLButtonElement>('.desktop-shell-link')!;
  type Mode = 'check' | 'download' | 'apply' | 'busy' | 'shell-download' | 'shell-install';
  let mode: Mode = 'check';
  const render = (text: string, next: Mode, label = '') => {
    mode = next; status.textContent = text; action.textContent = label; action.hidden = !label;
  };
  const when = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? '' : ' from ' + d.toLocaleDateString(); };
  render('', 'check', 'Check for updates');
  shellLink.textContent = 'Check app update';

  const onBundle = (update: BundleStatus) => {
    switch (update.status) {
      case 'checking': return render('Checking GitHub for a newer build...', 'busy');
      case 'none': return render('You have the latest build' + when(update.builtAt) + '.', 'check', 'Check again');
      case 'available': return render('A newer build' + when(update.builtAt) + ' is ready to download (' + (update.size / 1e6).toFixed(0) + ' MB).', 'download', 'Download update');
      case 'downloading': return render('Downloading... ' + update.percent + '%', 'busy');
      case 'ready': return render('Update downloaded. Your progress is kept.', 'apply', 'Reload with update');
      case 'error': return render('Update failed: ' + update.message, 'check', 'Try again');
    }
  };
  const onShell = (update: UpdateStatus) => {
    switch (update.status) {
      case 'checking': return render('Checking for a newer app version...', 'busy');
      case 'none': return render('The app itself is up to date.', 'check', 'Check for updates');
      case 'available': return render('App version ' + update.version + ' is available.', 'shell-download', 'Download app update');
      case 'downloading': return render('Downloading app... ' + update.percent + '%', 'busy');
      case 'downloaded': return render('App version ' + update.version + ' is ready. Your progress is kept.', 'shell-install', 'Restart to update');
      case 'unsupported': return render(update.message, 'check', 'Check for updates');
      case 'error': return render('App update failed: ' + update.message, 'check', 'Check for updates');
    }
  };
  const unsubscribe = [desktop.onBundleStatus(onBundle), desktop.onUpdateStatus(onShell)];
  action.addEventListener('click', () => {
    if (mode === 'check') void desktop.checkForBundle();
    else if (mode === 'download') void desktop.downloadBundle();
    else if (mode === 'apply') void desktop.applyBundle();
    else if (mode === 'shell-download') void desktop.downloadUpdate();
    else if (mode === 'shell-install') void desktop.installUpdate();
  });
  shellLink.addEventListener('click', () => { if (mode !== 'busy') void desktop.checkForUpdates(); });
  root.append(panel);
  return () => { unsubscribe.forEach(stop => stop()); panel.remove(); };
}
