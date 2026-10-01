import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

const STORAGE_KEY = 'video-notes-user-name';

@Injectable({ providedIn: 'root' })
export class UserService {
  private nameSubject: BehaviorSubject<string>;
  readonly name$: Observable<string>;

  constructor() {
    const stored = this.readStoredName();
    this.nameSubject = new BehaviorSubject<string>(stored);
    this.name$ = this.nameSubject.asObservable();
  }

  get name(): string {
    return this.nameSubject.value;
  }

  setName(name: string): void {
    const trimmed = (name || '').trim();
    this.nameSubject.next(trimmed);
    try {
      if (trimmed) {
        localStorage.setItem(STORAGE_KEY, trimmed);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // localStorage unavailable — keep in-memory only
    }
  }

  clear(): void {
    this.setName('');
  }

  private readStoredName(): string {
    try {
      return localStorage.getItem(STORAGE_KEY) || '';
    } catch {
      return '';
    }
  }
}
