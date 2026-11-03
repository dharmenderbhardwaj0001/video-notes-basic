/**
 * Data model for the Projects section.
 *
 * A project holds folders (e.g. "APIs", "Docs"). A folder holds one
 * scrollable document made of points. Every point can have any number
 * of child points, recursively, so the tree depth is unlimited.
 */

export interface DocLink {
  label: string;
  url: string;
}

export interface DocImage {
  /** Data URL (uploaded file) or remote URL. */
  src: string;
  caption: string;
}

/** Everything written in the detail popup of a single point. */
export interface NodeDocument {
  description: string;
  notes: string;
  links: DocLink[];
  images: DocImage[];
  updatedAt: string;
}

export interface DocNode {
  id: string;
  title: string;
  /** True while the user is still typing the title of a new point. */
  isDraft?: boolean;
  collapsed: boolean;
  children: DocNode[];
  document: NodeDocument;
}

export interface ProjectFolder {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  nodes: DocNode[];
}

export interface ProjectNote {
  id: string;
  name: string;
  description: string;
  /** Accent color used for the project card icon. */
  color: string;
  createdAt: string;
  updatedAt: string;
  folders: ProjectFolder[];
}

export interface ProjectNoteSummary {
  id: string;
  name: string;
  description: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  folderCount: number;
  nodeCount: number;
}

/** Where a dragged row is dropped relative to another row. */
export type DropPosition = 'before' | 'after' | 'inside';

export interface NodeRef {
  node: DocNode;
  parent: DocNode | null;
  depth: number;
  /** Index path from the folder root to this node. */
  path: number[];
}

/**
 * Flattened row of the folder document. Rendering is a flat loop (not a
 * recursive template), so deeply nested trees stay fast; connectors are
 * drawn from the row data.
 */
export interface NodeRow extends NodeRef {
  /** Per ancestor level: true when that ancestor still has siblings below. */
  guides: boolean[];
  hasChildren: boolean;
  childCount: number;
  isLast: boolean;
  isDragging: boolean;
  dropPosition: DropPosition | null;
}

/** One line inside the detail popup's notes editor. */
export interface NoteLine {
  id: string;
  text: string;
  checked: boolean;
}

export const PROJECT_COLORS: string[] = [
  '#1a73e8',
  '#188038',
  '#d93025',
  '#f9ab00',
  '#9334e6',
  '#12a4af',
  '#e8710a',
  '#5f6368'
];

export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function emptyDocument(): NodeDocument {
  return {
    description: '',
    notes: '',
    links: [],
    images: [],
    updatedAt: ''
  };
}

export function createNode(title = ''): DocNode {
  return {
    id: generateId(),
    title,
    isDraft: !title.trim(),
    collapsed: false,
    children: [],
    document: emptyDocument()
  };
}

export function createFolder(name = 'Untitled folder'): ProjectFolder {
  const now = nowIso();
  return {
    id: generateId(),
    name,
    description: '',
    createdAt: now,
    updatedAt: now,
    nodes: []
  };
}

export function createProject(name: string, color: string = PROJECT_COLORS[0], description = ''): ProjectNote {
  const now = nowIso();
  return {
    id: generateId(),
    name,
    description,
    color,
    createdAt: now,
    updatedAt: now,
    folders: []
  };
}

/** Counts every point in the folder, at any depth. */
export function countNodes(nodes: DocNode[]): number {
  return nodes.reduce((total, node) => total + 1 + countNodes(node.children), 0);
}

export function countProjectNodes(project: ProjectNote): number {
  return project.folders.reduce((total, folder) => total + countNodes(folder.nodes), 0);
}

export function toSummary(project: ProjectNote): ProjectNoteSummary {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    color: project.color,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    folderCount: project.folders.length,
    nodeCount: countProjectNodes(project)
  };
}

export function formatUpdated(iso: string): string {
  if (!iso) return 'Not edited yet';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return 'Not edited yet';
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (date.toDateString() === new Date().toDateString()) return `Today, ${time}`;
  return `${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}, ${time}`;
}

/**
 * Normalizes a URL typed by the user: adds https:// when the scheme is
 * missing. Returns null for empty input.
 */
export function normalizeUrl(value: string): string | null {
  const trimmed = (value || '').trim();
  if (!trimmed) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function hostOf(url: string): string {
  try {
    return new URL(normalizeUrl(url) || url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Splits the plain notes text into editable lines. Markdown-style
 * checkboxes ("- [ ] item" / "- [x] item") become toggleable lines.
 */
export function toNoteLines(notes: string): NoteLine[] {
  return (notes || '').split('\n').map(text => {
    const match = /^\s*[-*]\s*\[( |x|X)\]\s?(.*)$/.exec(text);
    return match
      ? { id: generateId(), text: match[2], checked: match[1].toLowerCase() === 'x' }
      : { id: generateId(), text, checked: false };
  });
}

export function fromNoteLines(lines: NoteLine[]): string {
  return lines.map(line => line.checked ? `- [x] ${line.text}` : line.text).join('\n');
}

// ---------- Tree helpers (shared by the service and the folder page) ----------

/** The array that directly contains `id` (the root array, or a parent's children). */
export function findParentList(nodes: DocNode[], id: string): DocNode[] | null {
  if (nodes.some(node => node.id === id)) return nodes;
  for (const node of nodes) {
    const found = findParentList(node.children, id);
    if (found) return found;
  }
  return null;
}

export function findNode(nodes: DocNode[], id: string): DocNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return null;
}

export function isDescendant(ancestor: DocNode, id: string): boolean {
  return ancestor.children.some(child => child.id === id || isDescendant(child, id));
}

/** Removes the node (and its subtree) from the tree and returns it. */
export function detachNode(nodes: DocNode[], id: string): DocNode | null {
  const list = findParentList(nodes, id);
  if (!list) return null;
  const index = list.findIndex(node => node.id === id);
  if (index < 0) return null;
  return list.splice(index, 1)[0] ?? null;
}

/** Flat, in-order list of the tree, skipping children of collapsed nodes. */
export function flattenTree(
  nodes: DocNode[],
  collapsedIds: Set<string>,
  depth = 0,
  guides: boolean[] = [],
  parent: DocNode | null = null,
  path: number[] = []
): NodeRef[] {
  const rows: NodeRef[] = [];
  nodes.forEach((node, index) => {
    const nodePath = [...path, index];
    rows.push({ node, parent, depth, path: nodePath });
    if (node.children.length > 0 && !collapsedIds.has(node.id)) {
      rows.push(...flattenTree(node.children, collapsedIds, depth + 1, [...guides, index < nodes.length - 1], node, nodePath));
    }
  });
  return rows;
}
