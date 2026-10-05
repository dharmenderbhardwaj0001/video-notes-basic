import { Component, HostListener, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { UserService } from '../user.service';
import { StorageService } from '../storage.service';
import { ThemeService, ThemeOption } from '../theme.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
  /** Optional primary action (e.g. "Add Video") rendered on the right. */
  @Input() actionLabel: string = '';
  @Input() actionIcon: 'add' | 'save' | 'none' = 'none';
  /** Emitted when the primary action is clicked. */
  @Input() onAction?: () => void;

  showNameDialog: boolean = false;
  draftName: string = '';
  storageHint: string = '';
  showThemePopup: boolean = false;

  constructor(
    private router: Router,
    public user: UserService,
    private storage: StorageService,
    private themeService: ThemeService
  ) {}

  get themes(): ThemeOption[] {
    return this.themeService.themes;
  }

  get currentTheme(): string {
    return this.themeService.currentTheme;
  }

  // Close the theme popup when clicking anywhere outside it.
  @HostListener('document:click')
  onDocumentClick(): void {
    this.showThemePopup = false;
  }

  toggleThemePopup(): void {
    this.showThemePopup = !this.showThemePopup;
  }

  selectTheme(id: string): void {
    this.themeService.setTheme(id);
    this.showThemePopup = false;
  }

  get displayName(): string {
    return this.user.name;
  }

  get greeting(): string {
    return this.user.name ? `Hi ${this.user.name}` : 'User';
  }

  get storageConnected(): boolean {
    return this.storage.storageConnected;
  }

  get storageFolderName(): string {
    return this.storage.storageFolderName;
  }

  goHome(): void {
    this.router.navigate(['/']);
  }

  triggerAction(): void {
    if (this.onAction) {
      this.onAction();
    }
  }

  /** Connect (or reconnect) the folder on the PC where data is stored. */
  async connectStorage(): Promise<void> {
    try {
      this.storageHint = '';
      await this.storage.connectStorage();
    } catch (err: any) {
      this.storageHint = err?.message || 'Could not connect to the storage folder.';
    }
  }

  openNameDialog(): void {
    this.draftName = this.user.name;
    this.showNameDialog = true;
  }

  closeNameDialog(): void {
    this.showNameDialog = false;
  }

  saveName(): void {
    this.user.setName(this.draftName);
    this.showNameDialog = false;
  }

  onNameKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.saveName();
    } else if (event.key === 'Escape') {
      this.closeNameDialog();
    }
  }
}
