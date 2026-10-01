import { Injectable } from '@angular/core';

/**
 * Stores app data as real files on the user's PC using the
 * File System Access API (Chrome/Edge).
 *
 * The user picks a storage folder once; the folder handle is persisted
 * in IndexedDB so it is remembered across sessions. All files are then
 * read from and written to inside that folder.
 */
@Injectable({
  providedIn: 'root'
})
export class FileStorageService {
  private readonly DB_NAME = 'notes-app-storage';
  private readonly DB_VERSION = 1;
  private readonly STORE = 'handles';
  private readonly HANDLE_KEY = 'data-dir';

  /** Handle of the folder the user picked. Null until connected. */
  private dirHandle: any = null;
  /** Serializes writes so rapid saves never interleave. */
  private writeChain: Promise<void> = Promise.resolve();

  get connected(): boolean {
    return this.dirHandle !== null;
  }

  /** Name of the connected folder, e.g. "notes". Empty when not connected. */
  get folderName(): string {
    return this.dirHandle?.name || '';
  }

  /**
   * Restores the saved folder handle at startup and, if Chrome still
   * grants access without a user gesture, makes it available for reads.
   * Returns false when there is no handle yet or permission must be
   * re-granted via connect().
   */
  async init(): Promise<boolean> {
    this.dirHandle = await this.loadSavedHandle();
    if (!this.dirHandle) return false;
    return await this.queryPermission() === 'granted';
  }

  /**
   * Connects to the storage folder. Must be called from a user gesture
   * (button click): opens the directory picker the first time, then
   * just re-requests permission on later sessions.
   */
  async connect(): Promise<void> {
    if (!this.dirHandle) {
      this.dirHandle = await this.loadSavedHandle();
    }
    if (!this.dirHandle) {
      const picker = (window as any).showDirectoryPicker;
      if (!picker) {
        throw new Error('This browser cannot save to a local folder. Use Chrome or Edge.');
      }
      this.dirHandle = await picker.call(window, {
        id: 'notes-storage',
        mode: 'readwrite',
        startIn: 'documents'
      });
      await this.saveHandle(this.dirHandle);
    }
    if (await this.queryPermission() !== 'granted') {
      const granted = await this.dirHandle.requestPermission({ mode: 'readwrite' });
      if (granted !== 'granted') {
        throw new Error('Permission to the storage folder was denied.');
      }
    }
  }

  /** Reads a JSON file from the storage folder; null if it does not exist. */
  async readFileAs<T>(fileName: string): Promise<T | null> {
    if (!this.dirHandle) return null;
    try {
      const fileHandle = await this.dirHandle.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      return JSON.parse(await file.text()) as T;
    } catch {
      return null;
    }
  }

  /**
   * Queues a write of a JSON file to the storage folder.
   * Resolves true when the data reached the file, false when storage
   * is not connected or permission is missing.
   */
  writeFile(fileName: string, value: unknown): Promise<boolean> {
    const result = this.writeChain.then(() => this.doWrite(fileName, value));
    this.writeChain = result.then(() => undefined, () => undefined);
    return result;
  }

  private async doWrite(fileName: string, value: unknown): Promise<boolean> {
    if (!this.dirHandle) return false;
    if (await this.queryPermission() !== 'granted') return false;
    try {
      const fileHandle = await this.dirHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(value, null, 2));
      await writable.close();
      return true;
    } catch (err) {
      console.error('Failed to write file:', fileName, err);
      return false;
    }
  }

  private async queryPermission(): Promise<PermissionState> {
    if (!this.dirHandle) return 'denied';
    try {
      return await this.dirHandle.queryPermission({ mode: 'readwrite' });
    } catch {
      return 'denied';
    }
  }

  // --- IndexedDB persistence of the folder handle ---

  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(this.STORE)) {
          request.result.createObjectStore(this.STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private saveHandle(handle: any): Promise<void> {
    return this.openDb().then(db => new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.STORE, 'readwrite');
      tx.objectStore(this.STORE).put(handle, this.HANDLE_KEY);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    }));
  }

  private loadSavedHandle(): Promise<any> {
    return this.openDb().then(db => new Promise<any>((resolve, reject) => {
      const tx = db.transaction(this.STORE, 'readonly');
      const request = tx.objectStore(this.STORE).get(this.HANDLE_KEY);
      request.onsuccess = () => { db.close(); resolve(request.result || null); };
      request.onerror = () => { db.close(); reject(request.error); };
    })).catch(() => null);
  }
}
