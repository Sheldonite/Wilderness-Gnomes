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
  loadSaves(): Record<string, string>;
  storeSaves(entries: Record<string, string>): Promise<boolean>;
  checkForUpdates(): Promise<void>;
  downloadUpdate(): Promise<void>;
  installUpdate(): Promise<void>;
  onUpdateStatus(listener: (status: UpdateStatus) => void): () => void;
}

declare global {
  interface Window { desktop?: DesktopBridge }
}
