import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { FileStorageService } from './file-storage.service';

const THEME_FILE = 'theme.json';
const THEME_API = '/api/theme';

export interface ThemeOption {
  id: string;
  name: string;
  dark: boolean;
  /** Representative swatch colors shown in the picker popup. */
  colors: string[];
}

/** Themes shown in the picker popup. Palette values live in src/styles.css. */
export const THEMES: ThemeOption[] = [
  { id: 'light', name: 'Light', dark: false, colors: ['#1a73e8', '#ffffff', '#f1f3f4'] },
  { id: 'dark', name: 'Dark', dark: true, colors: ['#8ab4f8', '#292a2d', '#202124'] },
  { id: 'favicon', name: 'Light Version 2', dark: false, colors: ['#0369a1', '#f7c14b', '#e0f2fc'] },
  { id: 'landing', name: 'Dark Version 2', dark: true, colors: ['#38bdf8', '#0b2e4a', '#04121f'] }
];

/**
 * Applies and persists the app's color theme. The palette itself is
 * defined as CSS custom properties in src/styles.css and switched by
 * setting data-theme on <html>. The chosen theme id is stored via the
 * local Node API (notes/theme.json) and the connected storage folder.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private current = 'light';

  constructor(private fileStorage: FileStorageService, private http: HttpClient) {}

  get themes(): ThemeOption[] {
    return THEMES;
  }

  get currentTheme(): string {
    return this.current;
  }

  isTheme(id: string): boolean {
    return THEMES.some(theme => theme.id === id);
  }

  /** Applies a theme id when it exists; returns whether it was applied. */
  applyTheme(id: string): boolean {
    if (!this.isTheme(id)) return false;
    this.current = id;
    document.documentElement.setAttribute('data-theme', id);
    return true;
  }

  /** Applies a theme and persists it to disk (API + storage folder). */
  setTheme(id: string): void {
    if (!this.applyTheme(id)) return;
    this.fileStorage.writeFile(THEME_FILE, id);
    this.http.put(THEME_API, id).subscribe({
      error: () => { /* API not running; the file-storage copy still saved it. */ }
    });
  }

  /** Loads the saved theme from the Node API (notes/theme.json) at startup. */
  async loadFromDisk(): Promise<void> {
    let saved = '';
    try {
      saved = (await firstValueFrom(
        this.http.get(THEME_API, { responseType: 'text' })
      )).trim();
    } catch {
      // API not running; fall back to the file-storage copy.
      const fromFile = await this.fileStorage.readFileAs<string>(THEME_FILE);
      saved = typeof fromFile === 'string' ? fromFile.trim() : '';
    }
    if (!this.applyTheme(saved)) {
      this.applyTheme('light');
    }
  }
}
