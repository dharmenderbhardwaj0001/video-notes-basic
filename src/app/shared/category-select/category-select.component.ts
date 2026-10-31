import { Component, ElementRef, HostListener, Input, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Styled category picker: a dropdown of saved categories plus an inline
 * "create new" row, so a new category can still be typed by hand.
 * Works with [(ngModel)].
 */
@Component({
  selector: 'app-category-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './category-select.component.html',
  styleUrls: ['./category-select.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CategorySelectComponent),
      multi: true
    }
  ]
})
export class CategorySelectComponent implements ControlValueAccessor {
  @Input() categories: string[] = [];
  @Input() placeholder = 'Choose a category';

  value = '';
  isOpen = false;
  openUpward = false;
  creating = false;
  query = '';
  draftCategory = '';

  onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};

  constructor(private host: ElementRef<HTMLElement>) {}

  get filteredCategories(): string[] {
    const q = this.query.trim().toLocaleLowerCase();
    if (!q) return this.categories;
    return this.categories.filter(category => category.toLocaleLowerCase().includes(q));
  }

  get canCreate(): boolean {
    const q = this.query.trim();
    if (!q) return false;
    return !this.categories.some(category => category.toLocaleLowerCase() === q.toLocaleLowerCase());
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isOpen && !this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isOpen) {
      event.stopPropagation();
      this.close();
    }
  }

  @HostListener('document:scroll', ['$event'])
  onDocumentScroll(event: Event): void {
    const target = event.target as HTMLElement;
    if (target && target.contains && target.contains(this.host.nativeElement)) {
      this.close();
    }
  }

  writeValue(value: string | null): void {
    this.value = value || '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open(): void {
    this.query = '';
    this.creating = false;
    this.draftCategory = '';
    this.isOpen = true;

    // Bring the trigger into view first, then measure the room left for the menu.
    this.host.nativeElement.scrollIntoView({ block: 'nearest' });
    this.openUpward = this.availableSpaceBelow() < 240;
  }

  // Room left below the trigger inside the nearest scrollable dialog,
  // used to decide whether the menu should open upward.
  private availableSpaceBelow(): number {
    const trigger = this.host.nativeElement.getBoundingClientRect();
    let container = this.host.nativeElement.parentElement;
    while (container) {
      const style = getComputedStyle(container);
      if (/(auto|scroll)/.test(style.overflowY)) break;
      container = container.parentElement;
    }
    const limit = container ? container.getBoundingClientRect().bottom : window.innerHeight;
    return limit - trigger.bottom;
  }

  close(): void {
    this.isOpen = false;
    this.creating = false;
    this.query = '';
    this.draftCategory = '';
    this.onTouched();
  }

  select(category: string): void {
    this.value = category;
    this.onChange(category);
    this.close();
  }

  startCreating(): void {
    this.draftCategory = this.query.trim();
    this.creating = true;
  }

  confirmCreate(): void {
    const category = this.draftCategory.trim();
    if (!category) return;
    this.value = category;
    this.onChange(category);
    this.close();
  }
}
