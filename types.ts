
export type ReportStatus = 'ok' | 'risk' | 'blocked';

export interface FormData {
  projectName: string;
  version: string;
  status: ReportStatus;
  checkedAreas: string;
  newJiraBugs: string;
  bugsClosed: string;
  openBugs: string; // manual override; '' = calculated from the previous report
  testsPlanned: string;
  testsPassed: string;
  testsFailed: string;
  blockers: string;
  openIssues: string;
  estimatedCompletion: string;
  progressPercentage: string;
}

export type ThemeMode = 'system' | 'light' | 'dark';

export type ReportLanguage = 'he' | 'en';

export interface ReminderSettings {
  enabled: boolean;
  time: string; // HH:MM
  days: number[]; // 0 = Sunday
}

export interface AppSettings {
  defaultVersion: string;
  customProjects: string[];
  templates: string[];
  theme: ThemeMode;
  reportLanguage: ReportLanguage;
  reminder: ReminderSettings;
}

// Structured per-project data kept with each sent report, for charts and summaries
export interface ReportItem {
  projectName: string;
  version: string;
  status: ReportStatus;
  progress: number;
  bugs: number;
  bugsClosed: number;
  openBugs: number | null;
  testsPlanned: number | null;
  testsPassed: number | null;
  testsFailed: number | null;
  blockers: string;
  openIssues: string;
  deadline: string;
}

export interface HistoryEntry {
  id: string;
  createdAt: string;
  projectName: string;
  text: string;
  items?: ReportItem[]; // missing on reports saved before v1.2
}
