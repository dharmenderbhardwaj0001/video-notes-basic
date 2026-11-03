import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { HeaderComponent } from '../../header/header.component';
import { ProjectNotesService } from '../services/project-notes.service';
import { PROJECT_COLORS, ProjectNoteSummary, formatUpdated } from '../models/project-note.model';

interface ProjectForm {
  id: string | null;
  name: string;
  description: string;
  color: string;
}

@Component({
  selector: 'app-projects-list',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent],
  templateUrl: './projects-list.component.html',
  styleUrls: ['./projects-list.component.scss']
})
export class ProjectsListComponent implements OnInit, OnDestroy {
  projects: ProjectNoteSummary[] = [];
  search = '';
  colors = PROJECT_COLORS;

  /** Dialog state: the form is also used to rename an existing project. */
  showDialog = false;
  form: ProjectForm = this.emptyForm();

  private subscription?: Subscription;

  constructor(private service: ProjectNotesService, private router: Router) {}

  ngOnInit(): void {
    this.projects = this.service.getSummaries();
    this.subscription = this.service.changes$.subscribe(() => {
      this.projects = this.service.getSummaries();
    });
    // The first load is async, so refresh once the files are read too.
    this.service.whenLoaded().then(() => {
      this.projects = this.service.getSummaries();
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  get visibleProjects(): ProjectNoteSummary[] {
    const term = this.search.trim().toLowerCase();
    if (!term) return this.projects;
    return this.projects.filter(project =>
      project.name.toLowerCase().includes(term) ||
      project.description.toLowerCase().includes(term));
  }

  get totalFolders(): number {
    return this.projects.reduce((total, project) => total + project.folderCount, 0);
  }

  get totalPoints(): number {
    return this.projects.reduce((total, project) => total + project.nodeCount, 0);
  }

  emptyForm(): ProjectForm {
    return { id: null, name: '', description: '', color: PROJECT_COLORS[0] };
  }

  openCreate(): void {
    this.form = this.emptyForm();
    this.showDialog = true;
  }

  openEdit(project: ProjectNoteSummary, event: MouseEvent): void {
    event.stopPropagation();
    this.form = {
      id: project.id,
      name: project.name,
      description: project.description,
      color: project.color
    };
    this.showDialog = true;
  }

  closeDialog(): void {
    this.showDialog = false;
  }

  save(): void {
    const name = this.form.name.trim();
    if (!name) return;
    if (this.form.id) {
      this.service.updateProject(this.form.id, {
        name,
        description: this.form.description,
        color: this.form.color
      });
    } else {
      this.service.addProject(name, this.form.color, this.form.description);
    }
    this.showDialog = false;
  }

  delete(project: ProjectNoteSummary, event: MouseEvent): void {
    event.stopPropagation();
    const warning = project.folderCount > 0
      ? `"${project.name}" and its ${project.folderCount} folder(s) will be deleted.`
      : `"${project.name}" will be deleted.`;
    if (!confirm(`${warning}\n\nThis cannot be undone.`)) return;
    this.service.deleteProject(project.id);
  }

  openProject(project: ProjectNoteSummary): void {
    this.router.navigate(['/projects', project.id]);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.save();
    } else if (event.key === 'Escape') {
      this.closeDialog();
    }
  }

  updatedLabel(project: ProjectNoteSummary): string {
    return formatUpdated(project.updatedAt);
  }

  pointLabel(count: number): string {
    return `${count} ${count === 1 ? 'point' : 'points'}`;
  }

  folderLabel(count: number): string {
    return `${count} ${count === 1 ? 'folder' : 'folders'}`;
  }

  goDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  createAction = (): void => this.openCreate();
}
