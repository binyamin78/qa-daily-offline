
import { AppSettings, FormData, HistoryEntry } from '../types';

const KEYS = {
  settings: 'qa_app_settings',
  draft: 'daily_qa_form_draft',
  history: 'qa_report_history',
};

export const HISTORY_LIMIT = 50;

// localStorage can be missing, full or hold corrupt JSON - never let that crash the app
const read = (key: string): unknown => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable - keep working in memory
  }
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const str = (v: unknown) => (typeof v === 'string' ? v : '');

export const uniqueProjects = (list: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of list) {
    const name = p.trim();
    const key = name.toLowerCase();
    if (name && !seen.has(key)) {
      seen.add(key);
      out.push(name);
    }
  }
  return out;
};

// --- Settings ---

export const loadSettings = (): AppSettings => {
  const s = read(KEYS.settings);
  if (!isRecord(s)) return { defaultVersion: '', customProjects: [] };
  const projects = Array.isArray(s.customProjects)
    ? s.customProjects.filter((p): p is string => typeof p === 'string')
    : [];
  return { defaultVersion: str(s.defaultVersion), customProjects: uniqueProjects(projects) };
};

export const saveSettings = (settings: AppSettings) => write(KEYS.settings, settings);

// --- Form draft ---

export const emptyForm = (settings: AppSettings): FormData => ({
  projectName: settings.customProjects.length === 1 ? settings.customProjects[0] : '',
  version: settings.defaultVersion,
  checkedAreas: '',
  newJiraBugs: '0',
  blockers: 'אין',
  openIssues: '',
  estimatedCompletion: '',
  progressPercentage: '0',
});

export const loadDraft = (settings: AppSettings): FormData => {
  const base = emptyForm(settings);
  const d = read(KEYS.draft);
  if (!isRecord(d)) return base;
  const merged = { ...base };
  (Object.keys(base) as (keyof FormData)[]).forEach(key => {
    if (typeof d[key] === 'string') merged[key] = d[key] as string;
  });
  // A project that was removed from the list can't stay selected
  if (merged.projectName && !settings.customProjects.includes(merged.projectName)) {
    merged.projectName = base.projectName;
  }
  return merged;
};

export const saveDraft = (form: FormData) => write(KEYS.draft, form);

// --- Report history ---

export const loadHistory = (): HistoryEntry[] => {
  const h = read(KEYS.history);
  if (!Array.isArray(h)) return [];
  return h
    .filter(isRecord)
    .filter(e => typeof e.id === 'string' && typeof e.text === 'string' && typeof e.createdAt === 'string')
    .map(e => ({ id: str(e.id), createdAt: str(e.createdAt), projectName: str(e.projectName), text: str(e.text) }))
    .slice(0, HISTORY_LIMIT);
};

export const saveHistory = (history: HistoryEntry[]) => write(KEYS.history, history.slice(0, HISTORY_LIMIT));
