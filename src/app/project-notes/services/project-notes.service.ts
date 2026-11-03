import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { FileStorageService } from '../../file-storage.service';
import { StorageService } from '../../storage.service';
import {
  DocNode, ProjectFolder, ProjectNote, ProjectNoteSummary,
  createFolder, createProject, nowIso, toSummary
} from '../models/project-note.model';
interface ProjectIndexEntry {
  id: string;
  name: string;
  updatedAt: string;
}

interface ProjectIndex {
  projects: ProjectIndexEntry[];
}

/**
 * Loads and saves Projects. Each project is its own JSON file
 * (projects/<id>.json) so big documents never slow down the rest, both
 * through the local Node API and through the connected storage folder.
 */
@Injectable({ providedIn: 'root' })
export class ProjectNotesService {
  private readonly FOLDER = 'projects';
  private readonly API = '/api/projects';

  private projects: ProjectNote[] = [];
  private loaded = false;
  private loadPromise: Promise<void> | null = null;

  private summariesSubject = new BehaviorSubject<ProjectNoteSummary[]>([]);
  /** Summaries for the projects list page. */
  readonly summaries$: Observable<ProjectNoteSummary[]> = this.summariesSubject.asObservable();

  private changeSubject = new BehaviorSubject<void>(undefined);
  /** Emits whenever any project changes, so open pages can refresh. */
  readonly changes$: Observable<void> = this.changeSubject.asObservable();

  constructor(
    private http: HttpClient,
    private fileStorage: FileStorageService,
    private storage: StorageService
  ) {}

  /** Mirrors StorageService: true when data is saved to a real file on the PC. */
  get storageConnected(): boolean {
    return this.storage.storageConnected;
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    this.loaded = true;
    this.loadPromise = this.load();
  }

  /** Resolves once the project files have been read from disk. */
  async whenLoaded(): Promise<void> {
    this.ensureLoaded();
    await this.loadPromise;
  }

  /** Reads the index and every project file; newest copy wins per project. */
  private async load(): Promise<void> {
    const ids = await this.readIndex();
    const projects = await Promise.all(ids.map(id => this.readProject(id)));
    this.projects = projects.filter((project): project is ProjectNote => !!project);
    this.summariesSubject.next(this.projects.map(toSummary));
    this.changeSubject.next();
  }

  async reload(): Promise<void> {
    this.loaded = false;
    await this.whenLoaded();
  }

  /** Index ids from the API, the storage folder, or (when unreadable) from a file scan. */
  private async readIndex(): Promise<string[]> {
    const ids = new Set<string>();

    const fromApi = await this.readApi<ProjectIndex>(`${this.API}/index.json`);
    fromApi?.projects?.forEach(entry => ids.add(entry.id));

    const fromFile = await this.fileStorage.readFileAs<ProjectIndex>(`${this.FOLDER}/index.json`);
    fromFile?.projects?.forEach(entry => ids.add(entry.id));

    const fileNames = await this.fileStorage.listFiles(this.FOLDER);
    fileNames
      .filter(name => name.endsWith('.json') && name !== 'index.json')
      .forEach(name => ids.add(name.replace(/\.json$/, '')));

    const fromApiScan = await this.readApi<string[]>(`${this.API}?list=1`);
    Array.isArray(fromApiScan) && fromApiScan.forEach(id => ids.add(id));

    return [...ids];
  }

  private async readProject(id: string): Promise<ProjectNote | null> {
    const relativePath = `${this.FOLDER}/${id}.json`;
    const [fromApi, fromFile] = await Promise.all([
      this.readApi<ProjectNote>(`${this.API}/${id}`),
      this.fileStorage.readFileAs<ProjectNote>(relativePath)
    ]);

    const candidates = [fromApi, fromFile].filter((p): p is ProjectNote => !!p && !!p.id);
    if (candidates.length === 0) return null;
    const best = candidates.reduce((a, b) =>
      (b.updatedAt || '') > (a.updatedAt || '') ? b : a);
    return this.normalize(best);
  }

  private async readApi<T>(url: string): Promise<T | null> {
    try {
      return await firstValueFrom(this.http.get<T>(url));
    } catch {
      return null;
    }
  }

  /** Fills in fields that older/partial files may miss. */
  private normalize(project: ProjectNote): ProjectNote {
    return {
      ...project,
      description: project.description || '',
      color: project.color || '#1a73e8',
      folders: (project.folders || []).map(folder => ({
        ...folder,
        description: folder.description || '',
        nodes: folder.nodes || []
      }))
    };
  }

  private persist(project: ProjectNote): void {
    project.updatedAt = nowIso();
    const relativePath = `${this.FOLDER}/${project.id}.json`;
    this.fileStorage.writeFile(relativePath, project);
    this.http.put(`${this.API}/${project.id}`, project).subscribe({
      error: () => { /* API not running; the storage folder copy still saved it. */ }
    });
    this.writeIndex();
    this.summariesSubject.next(this.projects.map(toSummary));
    this.changeSubject.next();
  }

  private writeIndex(): void {
    const index: ProjectIndex = {
      projects: this.projects.map(project => ({
        id: project.id,
        name: project.name,
        updatedAt: project.updatedAt
      }))
    };
    this.fileStorage.writeFile(`${this.FOLDER}/index.json`, index);
    this.http.put(`${this.API}/index.json`, index).subscribe({
      error: () => { /* API not running; the storage folder copy still saved it. */ }
    });
  }

  // ---------- Projects ----------

  getSummaries(): ProjectNoteSummary[] {
    this.ensureLoaded();
    return this.summariesSubject.value;
  }

  getProject(id: string): ProjectNote | null {
    this.ensureLoaded();
    return this.projects.find(project => project.id === id) ?? null;
  }

  getFolders(projectId: string): ProjectFolder[] {
    return this.getProject(projectId)?.folders ?? [];
  }

  getFolder(projectId: string, folderId: string): ProjectFolder | null {
    return this.getFolders(projectId).find(folder => folder.id === folderId) ?? null;
  }

  addProject(name: string, color: string, description = ''): ProjectNote {
    this.ensureLoaded();
    const project = createProject(name.trim() || 'Untitled project', color, description.trim());
    this.projects = [project, ...this.projects];
    this.persist(project);
    return project;
  }

  updateProject(id: string, changes: Partial<Pick<ProjectNote, 'name' | 'description' | 'color'>>): void {
    const project = this.getProject(id);
    if (!project) return;
    if (changes.name !== undefined) project.name = changes.name.trim() || project.name;
    if (changes.description !== undefined) project.description = changes.description;
    if (changes.color !== undefined) project.color = changes.color;
    this.persist(project);
  }

  deleteProject(id: string): void {
    if (!this.getProject(id)) return;
    this.projects = this.projects.filter(project => project.id !== id);
    this.fileStorage.removeFile(this.FOLDER, `${id}.json`);
    this.http.delete(`${this.API}/${id}`).subscribe({
      error: () => { /* API not running; the file was removed from the storage folder. */ }
    });
    this.writeIndex();
    this.summariesSubject.next(this.projects.map(toSummary));
    this.changeSubject.next();
  }

  // ---------- Folders ----------

  addFolder(projectId: string, name: string, description = ''): ProjectFolder | null {
    const project = this.getProject(projectId);
    if (!project) return null;
    const folder = createFolder(name.trim() || 'Untitled folder');
    folder.description = description.trim();
    project.folders = [...project.folders, folder];
    this.persist(project);
    return folder;
  }

  updateFolder(projectId: string, folderId: string, changes: Partial<Pick<ProjectFolder, 'name' | 'description'>>): void {
    const project = this.getProject(projectId);
    const folder = project?.folders.find(item => item.id === folderId);
    if (!project || !folder) return;
    if (changes.name !== undefined) folder.name = changes.name.trim() || folder.name;
    if (changes.description !== undefined) folder.description = changes.description;
    folder.updatedAt = nowIso();
    this.persist(project);
  }

  deleteFolder(projectId: string, folderId: string): void {
    const project = this.getProject(projectId);
    if (!project) return;
    project.folders = project.folders.filter(folder => folder.id !== folderId);
    this.persist(project);
  }

  moveFolder(projectId: string, folderId: string, direction: -1 | 1): void {
    const project = this.getProject(projectId);
    if (!project) return;
    const index = project.folders.findIndex(folder => folder.id === folderId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= project.folders.length) return;
    const folders = [...project.folders];
    [folders[index], folders[target]] = [folders[target], folders[index]];
    project.folders = folders;
    this.persist(project);
  }

  /** Saves the point tree of a folder (add/edit/reorder all end up here). */
  saveNodes(projectId: string, folderId: string, nodes: DocNode[]): void {
    const project = this.getProject(projectId);
    const folder = project?.folders.find(item => item.id === folderId);
    if (!project || !folder) return;
    folder.nodes = nodes;
    folder.updatedAt = nowIso();
    this.persist(project);
  }
}