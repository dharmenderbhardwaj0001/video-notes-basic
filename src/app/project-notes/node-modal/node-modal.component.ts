import { Component, ElementRef, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  DocImage, DocLink, DocNode, NoteLine, NodeDocument,
  emptyDocument, formatUpdated, fromNoteLines, generateId, hostOf, normalizeUrl, nowIso, toNoteLines
} from '../models/project-note.model';

/**
 * Detail popup of one point: title, description, notes, links and images.
 * Everything is edited in place and saved back to the point on every
 * change, so closing the popup never loses work.
 */
@Component({
  selector: 'app-node-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './node-modal.component.html',
  styleUrls: ['./node-modal.component.scss']
})
export class NodeModalComponent implements OnChanges, OnInit {
  @Input() node: DocNode | null = null;
  @Input() pathLabel = '';
  @Input() childCount = 0;

  @Output() saved = new EventEmitter<DocNode>();
  @Output() deleted = new EventEmitter<DocNode>();
  @Output() addChild = new EventEmitter<DocNode>();
  @Output() close = new EventEmitter<void>();

  @ViewChild('linkLabelInput') linkLabelInput?: ElementRef<HTMLInputElement>;

  title = '';
  description = '';
  noteLines: NoteLine[] = [];

  linkDraft: DocLink = { label: '', url: '' };
  linkError = '';

  /** Expanded image preview, null when closed. */
  previewImage: DocImage | null = null;

  ngOnInit(): void {
    this.loadFromNode();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['node']) this.loadFromNode();
  }

  private loadFromNode(): void {
    const document = this.node?.document ?? emptyDocument();
    this.title = this.node?.title ?? '';
    this.description = document.description;
    this.noteLines = toNoteLines(document.notes);
    this.linkDraft = { label: '', url: '' };
    this.linkError = '';
    this.previewImage = null;
  }

  private get document(): NodeDocument {
    return this.node?.document ?? emptyDocument();
  }

  get links(): DocLink[] {
    return this.node?.document.links ?? [];
  }

  get images(): DocImage[] {
    return this.node?.document.images ?? [];
  }

  get updatedLabel(): string {
    return this.node?.document.updatedAt ? formatUpdated(this.node.document.updatedAt) : 'Not saved yet';
  }

  get isEmpty(): boolean {
    return !this.description.trim()
      && !this.noteLines.some(line => line.text.trim())
      && this.links.length === 0
      && this.images.length === 0;
  }

  // ---------- Title, description and notes ----------

  onTitleInput(): void {
    if (!this.node) return;
    this.node.title = this.title;
    this.node.isDraft = !this.title.trim();
    this.emitSaved();
  }

  onTitleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      (event.target as HTMLInputElement).blur();
    }
  }

  onDescriptionInput(): void {
    this.document.description = this.description;
    this.emitSaved();
  }

  onNoteInput(): void {
    this.document.notes = fromNoteLines(this.noteLines);
    this.emitSaved();
  }

  onNoteKeydown(event: KeyboardEvent, index: number): void {
    const line = this.noteLines[index];

    if (event.key === 'Enter') {
      event.preventDefault();
      this.noteLines.splice(index + 1, 0, { id: generateId(), text: '', checked: false });
      this.onNoteInput();
      this.focusNoteInput(index + 1);
      return;
    }

    if (event.key === 'Backspace' && line.text === '' && this.noteLines.length > 1) {
      event.preventDefault();
      this.noteLines.splice(index, 1);
      this.onNoteInput();
      this.focusNoteInput(Math.max(0, index - 1));
    }
  }

  private focusNoteInput(index: number): void {
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLTextAreaElement>('.note-line-input');
      const input = inputs[index];
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    });
  }

  autosize(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  // ---------- Links ----------

  addLink(): void {
    const url = normalizeUrl(this.linkDraft.url);
    if (!url) {
      this.linkError = 'Add a link address first.';
      return;
    }
    if (this.linkDraft.label.trim() === '' && this.linkLabelInput) {
      // Nothing typed in the label yet: use the host name instead.
    }
    const label = this.linkDraft.label.trim() || hostOf(url);
    this.document.links = [...this.links, { label, url }];
    this.linkDraft = { label: '', url: '' };
    this.linkError = '';
    this.emitSaved();
  }

  removeLink(index: number): void {
    this.document.links = this.links.filter((_, i) => i !== index);
    this.emitSaved();
  }

  linkHost(url: string): string {
    return hostOf(url);
  }

  linkHref(url: string): string {
    return normalizeUrl(url) || url;
  }

  // ---------- Images ----------

  onFilesPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const reader = new FileReader();
      reader.onload = () => {
        this.document.images = [...this.images, { src: String(reader.result), caption: file.name }];
        this.emitSaved();
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage(index: number): void {
    if (this.previewImage === this.images[index]) this.previewImage = null;
    this.document.images = this.images.filter((_, i) => i !== index);
    this.emitSaved();
  }

  updateCaption(index: number, caption: string): void {
    if (!this.images[index]) return;
    this.images[index].caption = caption;
    this.emitSaved();
  }

  openPreview(image: DocImage): void {
    this.previewImage = image;
  }

  closePreview(): void {
    this.previewImage = null;
  }

  // ---------- Actions ----------

  private emitSaved(): void {
    if (!this.node) return;
    this.document.updatedAt = nowIso();
    this.saved.emit(this.node);
  }

  addChildPoint(): void {
    if (!this.node) return;
    this.addChild.emit(this.node);
  }

  deletePoint(): void {
    if (!this.node) return;
    const name = this.node.title.trim() || 'this point';
    const warning = this.node.children.length > 0
      ? `"${name}" and its ${this.node.children.length} direct child point(s) will be deleted.`
      : `"${name}" will be deleted.`;
    if (!confirm(`${warning}\n\nThis cannot be undone.`)) return;
    this.deleted.emit(this.node);
  }

  requestClose(): void {
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.requestClose();
  }
}
