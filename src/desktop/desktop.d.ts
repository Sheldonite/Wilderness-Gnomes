export type BundleStatus =
  | { status: 'checking' }
  | { status: 'none'; commit: string; builtAt: string }
  | { status: 'available'; commit: string; builtAt: string; size: number }
  | { status: 'downloading'; percent: number }
  | { status: 'ready'; commit: string }
  | { status: 'error'; message: string };

export type UpdateStatus =
  | { status: 'checking' }
  | { status: 'none' }
  | { status: 'available'; version: string }
  | { status: 'downloading'; percent: number }
  | { status: 'downloaded'; version: string }
  | { status: 'error'; message: string }
  | { status: 'unsupported'; message: string };

export interface DesktopBridge {
  version: string;
  commit: string;
  loadSaves(): Record<string, string>;
  storeSaves(entries: Record<string, string>): Promise<boolean>;
  checkForBundle(): Promise<void>;
  downloadBundle(): Promise<void>;
  applyBundle(): Promise<void>;
  onBundleStatus(listener: (status: BundleStatus) => void): () => void;
  checkForUpdates(): Promise<void>;
  downloadUpdate(): Promise<void>;
  installUpdate(): Promise<void>;
  onUpdateStatus(listener: (status: UpdateStatus) => void): () => void;
}

declare global {
  interface Window { desktop?: DesktopBridge }
}
