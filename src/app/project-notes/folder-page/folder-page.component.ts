import { Component, HostListener, OnDestroy, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { HeaderComponent } from '../../header/header.component';
import { ProjectNotesService } from '../services/project-notes.service';
import { NodeModalComponent } from '../node-modal/node-modal.component';
import {
  DocNode, DropPosition, NodeRow, ProjectFolder, ProjectNote,
  countNodes, createNode, detachNode, findNode, findParentList,
  isDescendant, nowIso
} from '../models/project-note.model';

/** Pixels each nesting level is indented by (also used by the connector guides). */
export const INDENT_PX = 26;

interface DragState {
  id: string;
  row: NodeRow;
}

@Component({
  selector: 'app-folder-page',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent, NodeModalComponent],
  templateUrl: './folder-page.component.html',
  styleUrls: ['./folder-page.component.scss']
})
export class FolderPageComponent implements OnInit, OnDestroy {
  projectId = '';
  folderId = '';
  project: ProjectNote | null = null;
  folder: ProjectFolder | null = null;

  /** Local copy of the tree; persisted on every change. */
  nodes: DocNode[] = [];
  rows: NodeRow[] = [];
  collapsedIds = new Set<string>();

  activeNode: DocNode | null = null;
  activePathLabel = '';
  activeChildCount = 0;

  /** Id of the point whose title is being typed (draft). */
  draftId: string | null = null;

  search = '';
  matchingIds = new Set<string>();
  searchActive = false;

  drag: DragState | null = null;
  dropTargetId: string | null = null;
  dropPosition: DropPosition | null = null;
  draggedId: string | null = null;

  readonly indent = INDENT_PX;

  private subscription?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private service: ProjectNotesService,
    private zone: NgZone
  ) {}

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('projectId') ?? '';
    this.folderId = this.route.snapshot.paramMap.get('folderId') ?? '';
    this.refresh();

    this.subscription = this.service.changes$.subscribe(() => {
      // Only the first change (initial load) creates the local copy; later
      // changes come from this page and must not overwrite it.
      if (!this.folder) this.refresh();
    });
    this.service.whenLoaded().then(() => {
      if (!this.folder) this.refresh();
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  private refresh(): void {
    this.project = this.service.getProject(this.projectId);
    this.folder = this.service.getFolder(this.projectId, this.folderId);
    this.nodes = this.folder?.nodes ?? [];
    this.closedIdsCleared();
    this.rebuildRows();
  }

  private closedIdsCleared(): void {
    // Forget collapse states of points that no longer exist.
    const alive = new Set<string>();
    const walk = (list: DocNode[]) => list.forEach(node => {
      alive.add(node.id);
      walk(node.children);
    });
    walk(this.nodes);
    this.collapsedIds = new Set([...this.collapsedIds].filter(id => alive.has(id)));
  }

  private rebuildRows(): void {
    const collapsed = this.searchActive ? new Set<string>() : this.collapsedIds;
    const refs: NodeRow[] = [];
    const collect = (list: DocNode[], depth: number, guides: boolean[], parent: DocNode | null, path: number[]) => {
      list.forEach((node, index) => {
        const childCount = node.children.length;
        refs.push({
          node,
          parent,
          depth,
          path: [...path, index],
          guides: [...guides, index < list.length - 1],
          hasChildren: childCount > 0,
          childCount,
          isLast: index === list.length - 1,
          isDragging: this.draggedId === node.id,
          dropPosition: this.dropTargetId === node.id ? this.dropPosition : null
        });
        if (childCount > 0 && !collapsed.has(node.id)) {
          collect(node.children, depth + 1, [...guides, index < list.length - 1], node, [...path, index]);
        }
      });
    };
    collect(this.nodes, 0, [], null, []);
    this.rows = refs;
  }

  // ---------- Statistics ----------

  get totalPoints(): number {
    return countNodes(this.nodes);
  }

  get maxDepth(): number {
    const depthOf = (list: DocNode[]): number =>
      list.length === 0 ? 0 : 1 + Math.max(...list.map(node => depthOf(node.children)));
    return depthOf(this.nodes);
  }

  get documentWidth(): number {
    const deepest = this.maxDepth - 1;
    return Math.max(320, deepest * INDENT_PX + 420);
  }

  // ---------- Adding points ----------

  addRootPoint(): void {
    this.beginDraft(this.nodes, createNode());
  }

  addChild(node: DocNode): void {
    node.collapsed = false;
    this.collapsedIds.delete(node.id);
    this.beginDraft(node.children, createNode());
  }

  addSiblingBelow(node: DocNode): void {
    const list = findParentList(this.nodes, node.id);
    if (!list) return;
    const index = list.findIndex((item: DocNode) => item.id === node.id);
    list.splice(index + 1, 0, createNode());
    this.finishDraftAndPersist();
  }

  private beginDraft(list: DocNode[], node: DocNode): void {
    this.finishDraft(true);
    list.push(node);
    this.draftId = node.id;
    this.refreshAfterChange();
    this.focusDraft();
  }

  private focusDraft(): void {
    setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>('.point-title-input');
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    });
  }

  /** Runs a change inside the zone so the template re-renders. */
  private apply(change: () => void): void {
    this.zone.run(() => {
      change();
      this.rebuildRows();
    });
  }

  onDraftTitleInput(node: DocNode): void {
    node.isDraft = !node.title.trim();
  }

  onDraftKeydown(event: KeyboardEvent, node: DocNode): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      node.isDraft = false;
      node.title = node.title.trim() || 'Untitled point';
      this.draftId = null;
      this.refreshAfterChange();
      const input = event.target as HTMLInputElement;
      input.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      (event.target as HTMLInputElement).blur();
    }
  }

  /** Gives an unnamed draft a default title instead of throwing it away. */
  private finishDraft(rebuild = false): void {
    if (!this.draftId) return;
    const draft = findNode(this.nodes, this.draftId);
    if (draft) {
      if (!draft.title.trim()) draft.title = 'Untitled point';
      draft.isDraft = false;
    }
    this.draftId = null;
    this.refreshAfterChange(rebuild);
  }

  private finishDraftAndPersist(): void {
    this.finishDraft(true);
  }

  onDocumentClick(event: MouseEvent): void {
    if (!this.draftId) return;
    const target = event.target as HTMLElement;
    // Row titles, add buttons and the header all start other actions;
    // only a click elsewhere means "I'm done with this draft".
    if (target.closest('.point-title, .add-point-row, .empty-state, .point-action, .folder-tools, .breadcrumb-bar')) return;
    this.finishDraft(true);
  }

  // ---------- Point actions ----------

  openDetails(node: DocNode, index: number): void {
    this.activeNode = node;
    this.activePathLabel = this.pathLabelFor(index);
    this.activeChildCount = node.children.length;
  }

  private pathLabelFor(rowIndex: number): string {
    const parts: string[] = [];
    let list = this.nodes;
    const row = this.rows[rowIndex];
    if (!row) return '';
    row.path.forEach((childIndex, level) => {
      const item = list[childIndex];
      if (item) parts.push(item.title.trim() || 'Untitled point');
      list = item?.children ?? [];
      void level;
    });
    return parts.join(' › ');
  }

  onModalSaved(node: DocNode): void {
    this.refreshAfterChange();
  }

  onModalDeleted(node: DocNode): void {
    this.deleteNode(node);
    this.closeModal();
  }

  onModalAddChild(node: DocNode): void {
    this.addChild(node);
    this.closeModal();
  }

  closeModal(): void {
    this.activeNode = null;
  }

  deleteNode(node: DocNode, event?: MouseEvent): void {
    event?.stopPropagation();
    const count = countNodes([node]);
    const name = node.title.trim() || 'this point';
    const warning = count > 1
      ? `"${name}" and ${count - 1} nested point(s) will be deleted.`
      : `"${name}" will be deleted.`;
    if (!confirm(`${warning}\n\nThis cannot be undone.`)) return;
    detachNode(this.nodes, node.id);
    if (this.draftId === node.id) this.draftId = null;
    this.refreshAfterChange();
  }

  toggleCollapse(node: DocNode, event: MouseEvent): void {
    event.stopPropagation();
    if (node.children.length === 0) return;
    if (this.collapsedIds.has(node.id)) this.collapsedIds.delete(node.id);
    else this.collapsedIds.add(node.id);
    this.rebuildRows();
  }

  renamePoint(node: DocNode, event: MouseEvent): void {
    event.stopPropagation();
    const name = prompt('Point title', node.title);
    if (name === null || !name.trim()) return;
    node.title = name.trim();
    node.isDraft = false;
    this.refreshAfterChange();
  }

  collapseAll(): void {
    this.collapsedIds = new Set(this.rows.filter(row => row.hasChildren).map(row => row.node.id));
    this.rebuildRows();
  }

  expandAll(): void {
    this.collapsedIds.clear();
    this.rebuildRows();
  }

  // ---------- Keyboard reordering ----------

  movePoint(node: DocNode, direction: -1 | 1): void {
    const list = findParentList(this.nodes, node.id);
    if (!list) return;
    const index = list.findIndex((item: DocNode) => item.id === node.id);
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    this.refreshAfterChange();
  }

  canMoveUp(node: DocNode): boolean {
    const list = findParentList(this.nodes, node.id);
    if (!list) return false;
    return list.findIndex((item: DocNode) => item.id === node.id) > 0;
  }

  canMoveDown(node: DocNode): boolean {
    const list = findParentList(this.nodes, node.id);
    if (!list) return false;
    const index = list.findIndex((item: DocNode) => item.id === node.id);
    return index >= 0 && index < list.length - 1;
  }

  indentPoint(node: DocNode): void {
    const list = findParentList(this.nodes, node.id);
    if (!list) return;
    const index = list.findIndex((item: DocNode) => item.id === node.id);
    const previous = list[index - 1];
    if (!previous) return;
    const [moved] = list.splice(index, 1);
    previous.children.push(moved);
    previous.collapsed = false;
    this.collapsedIds.delete(previous.id);
    this.refreshAfterChange();
  }

  outdentPoint(node: DocNode): void {
    const list = findParentList(this.nodes, node.id);
    if (!list) return;
    const parent = this.parentOf(node.id);
    if (!parent) return;
    const parentList = findParentList(this.nodes, parent.id);
    if (!parentList) return;
    const index = list.findIndex((item: DocNode) => item.id === node.id);
    const [moved] = list.splice(index, 1);
    const parentIndex = parentList.findIndex((item: DocNode) => item.id === parent.id);
    parentList.splice(parentIndex + 1, 0, moved);
    this.refreshAfterChange();
  }

  private parentOf(id: string): DocNode | null {
    let found: DocNode | null = null;
    const walk = (list: DocNode[], parent: DocNode | null) => list.forEach(node => {
      if (node.id === id) found = parent;
      else walk(node.children, node);
    });
    walk(this.nodes, null);
    return found;
  }

  canOutdent(node: DocNode): boolean {
    return this.parentOf(node.id) !== null;
  }

  // ---------- Drag and drop ----------

  onDragStart(event: DragEvent, node: DocNode, row: NodeRow): void {
    if (this.searchActive) {
      event.preventDefault();
      return;
    }
    this.drag = { id: node.id, row };
    this.draggedId = node.id;
    event.dataTransfer?.setData('text/plain', node.id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    this.zone.run(() => this.rebuildRows());
  }

  onDragOver(event: DragEvent, row: NodeRow): void {
    if (!this.drag) return;
    if (row.node.id === this.drag.id) return;
    if (isDescendant(this.drag.row.node, row.node.id)) {
      event.preventDefault();
      event.dataTransfer!.dropEffect = 'none';
      this.dropTargetId = null;
      this.dropPosition = null;
      this.rebuildRows();
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';

    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const offset = (event.clientY - rect.top) / rect.height;
    let position: DropPosition;
    if (offset < 0.28) position = 'before';
    else if (offset > 0.72) position = 'after';
    else position = 'inside';

    if (this.dropTargetId !== row.node.id || this.dropPosition !== position) {
      this.zone.run(() => {
        this.dropTargetId = row.node.id;
        this.dropPosition = position;
        this.rebuildRows();
      });
    }
  }

  onDrop(event: DragEvent, row: NodeRow): void {
    if (!this.drag || !this.dropPosition) return;
    event.preventDefault();
    event.stopPropagation();

    this.apply(() => {
      const moving = this.drag!.row.node;
      const target = row.node;
      const position = this.dropPosition!;
      this.clearDragState();


      detachNode(this.nodes, moving.id);

      if (position === 'inside') {
        target.children.push(moving);
        target.collapsed = false;
        this.collapsedIds.delete(target.id);
      } else {
        const targetList = findParentList(this.nodes, target.id);
        if (!targetList) {
          this.nodes.push(moving);
        } else {
          const index = targetList.findIndex((item: DocNode) => item.id === target.id);
          targetList.splice(position === 'before' ? index : index + 1, 0, moving);
        }
      }

      this.persist();
    });
  }

  onDragEnd(): void {
    this.apply(() => this.clearDragState());
  }

  private clearDragState(): void {
    this.drag = null;
    this.dropTargetId = null;
    this.dropPosition = null;
    this.draggedId = null;
  }

  onBodyDragOver(event: DragEvent): void {
    if (!this.drag) return;
    event.preventDefault();
    // Dragging below the last row moves the point to the end of the root list.
    const target = event.target as HTMLElement;
    if (target.closest('.point-row')) return;
    this.zone.run(() => {
      this.dropTargetId = null;
      this.dropPosition = null;
      this.rebuildRows();
    });
  }

  onBodyDrop(event: DragEvent): void {
    if (!this.drag) return;
    const target = event.target as HTMLElement;
    if (target.closest('.point-row')) return;
    event.preventDefault();
    this.apply(() => {
      const moving = this.drag!.row.node;
      this.clearDragState();
      detachNode(this.nodes, moving.id);
      this.nodes.push(moving);
      this.persist();
    });
  }

  // ---------- Search ----------

  onSearchChange(): void {
    this.apply(() => {
      const term = this.search.trim().toLowerCase();
      this.searchActive = term.length > 0;
      this.matchingIds = new Set<string>();

      if (!this.searchActive) return;
      const walk = (list: DocNode[], ancestors: string[]) => list.forEach(node => {
        const matches = node.title.toLowerCase().includes(term) ||
          node.document.notes.toLowerCase().includes(term) ||
          node.document.description.toLowerCase().includes(term);
        if (matches) {
          this.matchingIds.add(node.id);
          ancestors.forEach(id => this.matchingIds.add(id));
        }
        walk(node.children, [...ancestors, node.id]);
      });
      walk(this.nodes, []);
    });
  }

  isMatch(row: NodeRow): boolean {
    return this.searchActive && this.matchingIds.has(row.node.id) &&
      row.node.title.toLowerCase().includes(this.search.trim().toLowerCase());
  }

  rowHidden(row: NodeRow): boolean {
    return this.searchActive && !this.matchingIds.has(row.node.id);
  }

  clearSearch(): void {
    this.search = '';
    this.onSearchChange();
  }

  // ---------- Persistence ----------

  private persist(): void {
    if (!this.folder) return;
    this.folder.updatedAt = nowIso();
    this.service.saveNodes(this.projectId, this.folderId, this.nodes);
  }

  /**
   * Saves a tree change and re-renders the row list. The rows must be
   * rebuilt before the save notification reaches subscribers, otherwise
   * the template renders with an outdated row list.
   */
  private refreshAfterChange(rebuild = true): void {
    if (rebuild) this.rebuildRows();
    this.persist();
  }

  // ---------- Row/label helpers for the template ----------

  rowStyle(row: NodeRow): Record<string, string> {
    return {
      'padding-left': `${row.depth * this.indent + 8}px`
    };
  }

  guideStyle(level: number): Record<string, string> {
    return { left: `${level * this.indent + 17}px` };
  }

  untitled(node: DocNode): string {
    return node.title.trim() || 'Untitled point';
  }

  childLabel(row: NodeRow): string {
    return `${row.childCount} ${row.childCount === 1 ? 'subpoint' : 'subpoints'}`;
  }

  hasContent(node: DocNode): boolean {
    const document = node.document;
    return !!document.description.trim() || !!document.notes.trim() ||
      document.links.length > 0 || document.images.length > 0;
  }

  // ---------- Actions passed to the header (bound as plain functions) ----------

  addRootAction = (): void => this.addRootPoint();

  // ---------- Navigation ----------

  goProjects(): void {
    this.router.navigate(['/projects']);
  }

  goProject(): void {
    this.router.navigate(['/projects', this.projectId]);
  }

  goDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (this.activeNode) {
        this.closeModal();
      } else if (this.search) {
        this.clearSearch();
      }
    }
  }

  onRowTitleKeydown(event: Event): void {
    if ((event as KeyboardEvent).key !== 'Tab') return;
    event.preventDefault();
    const input = event.target as HTMLInputElement;
    const id = input.getAttribute('data-node-id');
    const node = id ? findNode(this.nodes, id) : null;
    if (!node) return;
    if ((event as KeyboardEvent).shiftKey) this.outdentPoint(node);
    else this.indentPoint(node);
  }
}
