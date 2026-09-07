import type { UpdateStatus } from './desktop.d';

/** Title-screen corner panel: version, a check button, and a restart button once an update is ready. */
export function mountDesktopUpdates(root: HTMLElement): () => void {
  const desktop = window.desktop;
  if (!desktop) return () => {};
  const panel = document.createElement('aside');
  panel.className = 'desktop-updates';
  panel.innerHTML = '<span class="desktop-version"></span><span class="desktop-update-status" aria-live="polite"></span><button type="button" class="desktop-update-action"></button>';
  panel.querySelector('.desktop-version')!.textContent = 'v' + desktop.version;
  const status = panel.querySelector<HTMLElement>('.desktop-update-status')!;
  const action = panel.querySelector<HTMLButtonElement>('.desktop-update-action')!;
  let mode: 'check' | 'download' | 'install' | 'busy' = 'check';
  const render = (text: string, next: typeof mode, label = '') => {
    mode = next; status.textContent = text; action.textContent = label; action.hidden = !label;
  };
  render('', 'check', 'Check for updates');
  const apply = (update: UpdateStatus) => {
    switch (update.status) {
      case 'checking': return render('Checking GitHub for a newer release...', 'busy');
      case 'none': return render('You have the latest version.', 'check', 'Check again');
      case 'available': return render('Version ' + update.version + ' is available.', 'download', 'Download update');
      case 'downloading': return render('Downloading... ' + update.percent + '%', 'busy');
      case 'downloaded': return render('Version ' + update.version + ' is ready. Your progress is kept.', 'install', 'Restart to update');
      case 'unsupported': return render(update.message, 'check', 'Check for updates');
      case 'error': return render('Update check failed: ' + update.message, 'check', 'Try again');
    }
  };
  const unsubscribe = desktop.onUpdateStatus(apply);
  action.addEventListener('click', () => {
    if (mode === 'check') void desktop.checkForUpdates();
    else if (mode === 'download') void desktop.downloadUpdate();
    else if (mode === 'install') void desktop.installUpdate();
  });
  root.append(panel);
  return () => { unsubscribe(); panel.remove(); };
}
