
import { AppSettings, FormData, HistoryEntry, ReportItem, ReportStatus, ThemeMode } from '../types';

const KEYS = {
  settings: 'qa_app_settings',
  draft: 'daily_qa_form_draft',
  history: 'qa_report_history',
  combined: 'qa_combined_sections',
};

export const HISTORY_LIMIT = 120;

export const DEFAULT_TEMPLATES = [
  'רגרסיה מלאה',
  'בדיקות Smoke',
  'אימות תיקוני באגים',
  'בדיקות על מכשירים שונים',
  'בדיקות API',
  'כתיבת מקרי בדיקה',
];

const STATUSES: ReportStatus[] = ['ok', 'risk', 'blocked'];
const THEMES: ThemeMode[] = ['system', 'light', 'dark'];

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
const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : 0);
const strList = (v: unknown) => (Array.isArray(v) ? v.filter((p): p is string => typeof p === 'string') : []);
export const asStatus = (v: unknown): ReportStatus => (STATUSES.includes(v as ReportStatus) ? (v as ReportStatus) : 'ok');

export const uniqueList = (list: string[]): string[] => {
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

export const localDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// --- Settings ---

export const loadSettings = (): AppSettings => {
  const raw = read(KEYS.settings);
  const s = isRecord(raw) ? raw : {};
  const r = isRecord(s.reminder) ? s.reminder : {};
  const time = typeof r.time === 'string' && /^\d{2}:\d{2}$/.test(r.time) ? r.time : '17:00';
  const days = Array.isArray(r.days) ? r.days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6) : [0, 1, 2, 3, 4];
  return {
    defaultVersion: str(s.defaultVersion),
    customProjects: uniqueList(strList(s.customProjects)),
    templates: Array.isArray(s.templates) ? uniqueList(strList(s.templates)) : DEFAULT_TEMPLATES,
    theme: THEMES.includes(s.theme as ThemeMode) ? (s.theme as ThemeMode) : 'system',
    reportLanguage: s.reportLanguage === 'en' ? 'en' : 'he',
    reminder: { enabled: r.enabled === true, time, days },
  };
};

export const saveSettings = (settings: AppSettings) => write(KEYS.settings, settings);

// --- Form draft ---

export const emptyForm = (settings: AppSettings): FormData => ({
  projectName: settings.customProjects.length === 1 ? settings.customProjects[0] : '',
  version: settings.defaultVersion,
  status: 'ok',
  checkedAreas: '',
  newJiraBugs: '0',
  blockers: 'אין',
  openIssues: '',
  estimatedCompletion: '',
  progressPercentage: '0',
});

const toForm = (d: Record<string, unknown>, settings: AppSettings): FormData => {
  const base = emptyForm(settings);
  const merged = { ...base };
  (Object.keys(base) as (keyof FormData)[]).forEach(key => {
    if (key !== 'status' && typeof d[key] === 'string') (merged[key] as string) = d[key] as string;
  });
  merged.status = asStatus(d.status);
  // A project that was removed from the list can't stay selected
  if (merged.projectName && !settings.customProjects.includes(merged.projectName)) {
    merged.projectName = base.projectName;
  }
  return merged;
};

export const loadDraft = (settings: AppSettings): FormData => {
  const d = read(KEYS.draft);
  return isRecord(d) ? toForm(d, settings) : emptyForm(settings);
};

export const saveDraft = (form: FormData) => write(KEYS.draft, form);

// --- Sections already added to today's multi-project report ---

export const loadCombined = (settings: AppSettings): FormData[] => {
  const c = read(KEYS.combined);
  if (!isRecord(c) || c.date !== localDateKey(new Date()) || !Array.isArray(c.sections)) return [];
  return c.sections.filter(isRecord).map(s => toForm(s, settings)).filter(s => s.projectName);
};

export const saveCombined = (sections: FormData[]) =>
  write(KEYS.combined, { date: localDateKey(new Date()), sections });

// --- Report history ---

const toItem = (v: Record<string, unknown>): ReportItem => ({
  projectName: str(v.projectName),
  version: str(v.version),
  status: asStatus(v.status),
  progress: num(v.progress),
  bugs: num(v.bugs),
  blockers: str(v.blockers),
  openIssues: str(v.openIssues),
  deadline: str(v.deadline),
});

export const loadHistory = (): HistoryEntry[] => {
  const h = read(KEYS.history);
  if (!Array.isArray(h)) return [];
  return h
    .filter(isRecord)
    .filter(e => typeof e.id === 'string' && typeof e.text === 'string' && typeof e.createdAt === 'string')
    .map(e => ({
      id: str(e.id),
      createdAt: str(e.createdAt),
      projectName: str(e.projectName),
      text: str(e.text),
      items: Array.isArray(e.items) ? e.items.filter(isRecord).map(toItem) : undefined,
    }))
    .slice(0, HISTORY_LIMIT);
};

export const saveHistory = (history: HistoryEntry[]) => write(KEYS.history, history.slice(0, HISTORY_LIMIT));
