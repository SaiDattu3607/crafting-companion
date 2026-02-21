// localStorage-based persistence layer for CraftChain

export interface User {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  createdAt: string;
}

export interface Requirement {
  id: string;
  name: string;
  quantity: number;
  status: 'pending' | 'collected' | 'crafted';
  dependencies: string[]; // ids of other requirements
}

export interface Project {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  collaboratorIds: string[];
  requirements: Requirement[];
  createdAt: string;
  updatedAt: string;
}

export interface Contribution {
  id: string;
  projectId: string;
  userId: string;
  username: string;
  itemName: string;
  action: 'collected' | 'crafted';
  quantity: number;
  timestamp: string;
}

const KEYS = {
  users: 'craftchain_users',
  currentUser: 'craftchain_current_user',
  projects: 'craftchain_projects',
  contributions: 'craftchain_contributions',
};

function get<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function set(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

// Simple hash (not secure - demo only)
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Auth
export function signup(email: string, username: string, password: string): User | string {
  const users = get<User[]>(KEYS.users, []);
  if (users.find(u => u.email === email)) return 'Email already registered';
  if (users.find(u => u.username === username)) return 'Username taken';
  const user: User = {
    id: generateId(),
    email,
    username,
    passwordHash: simpleHash(password),
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  set(KEYS.users, users);
  set(KEYS.currentUser, user.id);
  return user;
}

export function login(email: string, password: string): User | string {
  const users = get<User[]>(KEYS.users, []);
  const user = users.find(u => u.email === email);
  if (!user) return 'User not found';
  if (user.passwordHash !== simpleHash(password)) return 'Invalid password';
  set(KEYS.currentUser, user.id);
  return user;
}

export function logout() {
  localStorage.removeItem(KEYS.currentUser);
}

export function getCurrentUser(): User | null {
  const id = get<string | null>(KEYS.currentUser, null);
  if (!id) return null;
  const users = get<User[]>(KEYS.users, []);
  return users.find(u => u.id === id) || null;
}

export function getUserById(id: string): User | undefined {
  return get<User[]>(KEYS.users, []).find(u => u.id === id);
}

export function getUserByUsername(username: string): User | undefined {
  return get<User[]>(KEYS.users, []).find(u => u.username === username);
}

// Projects
export function getProjects(userId: string): Project[] {
  return get<Project[]>(KEYS.projects, []).filter(
    p => p.ownerId === userId || p.collaboratorIds.includes(userId)
  );
}

export function getProject(id: string): Project | undefined {
  return get<Project[]>(KEYS.projects, []).find(p => p.id === id);
}

export function createProject(name: string, description: string, ownerId: string, requirements: Omit<Requirement, 'id' | 'status'>[]): Project {
  const projects = get<Project[]>(KEYS.projects, []);
  const project: Project = {
    id: generateId(),
    name,
    description,
    ownerId,
    collaboratorIds: [],
    requirements: requirements.map(r => ({
      ...r,
      id: generateId(),
      status: 'pending',
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  projects.push(project);
  set(KEYS.projects, projects);
  return project;
}

export function updateProject(project: Project) {
  const projects = get<Project[]>(KEYS.projects, []);
  const idx = projects.findIndex(p => p.id === project.id);
  if (idx >= 0) {
    project.updatedAt = new Date().toISOString();
    projects[idx] = project;
    set(KEYS.projects, projects);
  }
}

export function addCollaborator(projectId: string, username: string): string | true {
  const user = getUserByUsername(username);
  if (!user) return 'User not found';
  const projects = get<Project[]>(KEYS.projects, []);
  const project = projects.find(p => p.id === projectId);
  if (!project) return 'Project not found';
  if (project.collaboratorIds.includes(user.id)) return 'Already a collaborator';
  project.collaboratorIds.push(user.id);
  project.updatedAt = new Date().toISOString();
  set(KEYS.projects, projects);
  return true;
}

// Contributions
export function getContributions(projectId: string): Contribution[] {
  return get<Contribution[]>(KEYS.contributions, [])
    .filter(c => c.projectId === projectId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function addContribution(projectId: string, userId: string, username: string, itemName: string, action: 'collected' | 'crafted', quantity: number): Contribution {
  const contributions = get<Contribution[]>(KEYS.contributions, []);
  const contribution: Contribution = {
    id: generateId(),
    projectId,
    userId,
    username,
    itemName,
    action,
    quantity,
    timestamp: new Date().toISOString(),
  };
  contributions.push(contribution);
  set(KEYS.contributions, contributions);
  return contribution;
}

// Progress & Bottleneck
export function calculateProgress(project: Project): number {
  if (project.requirements.length === 0) return 0;
  const done = project.requirements.filter(r => r.status === 'crafted' || r.status === 'collected').length;
  return Math.round((done / project.requirements.length) * 100);
}

export function getItemStatus(req: Requirement, allReqs: Requirement[]): 'complete' | 'pending' | 'blocked' {
  if (req.status === 'crafted' || req.status === 'collected') return 'complete';
  const deps = req.dependencies.map(id => allReqs.find(r => r.id === id)).filter(Boolean) as Requirement[];
  const blocked = deps.some(d => d.status === 'pending');
  return blocked ? 'blocked' : 'pending';
}

export function findBottleneck(project: Project): { item: Requirement; blockingCount: number } | null {
  let worst: { item: Requirement; blockingCount: number } | null = null;
  for (const req of project.requirements) {
    if (req.status !== 'pending') continue;
    // Count how many items depend on this one
    const dependents = project.requirements.filter(r =>
      r.dependencies.includes(req.id) && r.status === 'pending'
    );
    if (dependents.length > 0 && (!worst || dependents.length > worst.blockingCount)) {
      worst = { item: req, blockingCount: dependents.length };
    }
  }
  return worst;
}
