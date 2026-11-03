import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { HeaderComponent } from '../../header/header.component';
import { ProjectNotesService } from '../services/project-notes.service';
import {
  PROJECT_COLORS, ProjectFolder, ProjectNote, countNodes, formatUpdated, toSummary
} from '../models/project-note.model';

interface FolderForm {
  id: string | null;
  name: string;
  description: string;
}

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent],
  templateUrl: './project-detail.component.html',
  styleUrls: ['./project-detail.component.scss']
})
export class ProjectDetailComponent implements OnInit, OnDestroy {
  projectId = '';
  project: ProjectNote | null = null;

  showFolderDialog = false;
  folderForm: FolderForm = { id: null, name: '', description: '' };

  private subscription?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private service: ProjectNotesService
  ) {}

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('projectId') ?? '';
    this.refresh();
    this.subscription = this.service.changes$.subscribe(() => this.refresh());
    this.service.whenLoaded().then(() => this.refresh());
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  private refresh(): void {
    this.project = this.service.getProject(this.projectId);
  }

  get folders(): ProjectFolder[] {
    return this.project?.folders ?? [];
  }

  get sortedFolders(): ProjectFolder[] {
    return [...this.folders].sort((a, b) => a.name.localeCompare(b.name));
  }

  get accent(): string {
    return this.project?.color || PROJECT_COLORS[0];
  }

  nodeCount(folder: ProjectFolder): number {
    return countNodes(folder.nodes);
  }

  updatedLabel(folder: ProjectFolder): string {
    return formatUpdated(folder.updatedAt);
  }

  openFolder(folder: ProjectFolder): void {
    this.router.navigate(['/projects', this.projectId, 'folders', folder.id]);
  }

  openCreateFolder(): void {
    this.folderForm = { id: null, name: '', description: '' };
    this.showFolderDialog = true;
  }

  openEditFolder(folder: ProjectFolder, event: MouseEvent): void {
    event.stopPropagation();
    this.folderForm = { id: folder.id, name: folder.name, description: folder.description };
    this.showFolderDialog = true;
  }

  closeFolderDialog(): void {
    this.showFolderDialog = false;
  }

  saveFolder(): void {
    const name = this.folderForm.name.trim();
    if (!name) return;
    if (this.folderForm.id) {
      this.service.updateFolder(this.projectId, this.folderForm.id, {
        name,
        description: this.folderForm.description
      });
    } else {
      this.service.addFolder(this.projectId, name, this.folderForm.description);
    }
    this.showFolderDialog = false;
  }

  deleteFolder(folder: ProjectFolder, event: MouseEvent): void {
    event.stopPropagation();
    const count = this.nodeCount(folder);
    const warning = count > 0
      ? `"${folder.name}" and its ${count} point(s) will be deleted.`
      : `"${folder.name}" will be deleted.`;
    if (!confirm(`${warning}\n\nThis cannot be undone.`)) return;
    this.service.deleteFolder(this.projectId, folder.id);
  }

  moveFolder(folder: ProjectFolder, direction: -1 | 1, event: MouseEvent): void {
    event.stopPropagation();
    this.service.moveFolder(this.projectId, folder.id, direction);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.saveFolder();
    } else if (event.key === 'Escape') {
      this.closeFolderDialog();
    }
  }

  renameProject(): void {
    if (!this.project) return;
    const name = prompt('Project name', this.project.name);
    if (name === null) return;
    if (!name.trim()) return;
    this.service.updateProject(this.projectId, { name });
  }

  goProjects(): void {
    this.router.navigate(['/projects']);
  }

  goDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  get summaryLabel(): string {
    if (!this.project) return '';
    const summary = toSummary(this.project);
    const folders = `${summary.folderCount} ${summary.folderCount === 1 ? 'folder' : 'folders'}`;
    const points = `${summary.nodeCount} ${summary.nodeCount === 1 ? 'point' : 'points'}`;
    return `${folders} · ${points}`;
  }

  createFolderAction = (): void => this.openCreateFolder();
}
