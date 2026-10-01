import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { FileStorageService } from './file-storage.service';

const USER_FILE = 'user.json';
const LEGACY_KEY = 'video-notes-user-name';
const USER_API = '/api/user';

@Injectable({ providedIn: 'root' })
export class UserService {
  private nameSubject: BehaviorSubject<string>;
  readonly name$: Observable<string>;

  constructor(private fileStorage: FileStorageService, private http: HttpClient) {
    const legacy = this.readLegacyName();
    this.nameSubject = new BehaviorSubject<string>(legacy);
    this.name$ = this.nameSubject.asObservable();
  }

  get name(): string {
    return this.nameSubject.value;
  }

  /** Loads the name from the Node API (notes/user.json) and the connected storage folder. */
  async loadFromDisk(): Promise<void> {
    const fromFile = await this.fileStorage.readFileAs<string>(USER_FILE);
    let fromApi: string | null = null;
    try {
      fromApi = await firstValueFrom(this.http.get(USER_API, { responseType: 'text' }));
    } catch {
      // API not running; fall back to the file storage copy only.
    }

    const name = [fromApi, fromFile].find(v => v !== null && v !== undefined && v.trim().length > 0)
      ?? fromApi
      ?? fromFile
      ?? '';
    if (name !== this.name) {
      this.nameSubject.next(name);
    }
  }

  setName(name: string): void {
    const trimmed = (name || '').trim();
    this.nameSubject.next(trimmed);
    this.fileStorage.writeFile(USER_FILE, trimmed);
    this.http.put(USER_API, trimmed).subscribe({
      error: () => { /* API not running; the file-storage copy still saved it. */ }
    });
  }

  clear(): void {
    this.setName('');
  }

  /**
   * One-time migration: reads the old localStorage name and deletes the
   * key, so localStorage is never used again after startup.
   */
  private readLegacyName(): string {
    try {
      const stored = localStorage.getItem(LEGACY_KEY) || '';
      localStorage.removeItem(LEGACY_KEY);
      return stored;
    } catch {
      return '';
    }
  }
}
