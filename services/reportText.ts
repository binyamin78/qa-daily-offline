
import { ReportLanguage, ReportStatus } from '../types';

// All fixed text that appears inside generated reports. The app UI itself stays Hebrew.
export interface ReportStrings {
  dailyTitle: string;
  weeklyTitle: string;
  status: string;
  overallStatus: string;
  statusLabels: Record<ReportStatus, string>;
  project: string;
  version: (v: string) => string;
  progress: string;
  deadline: string;
  notSet: string;
  atCurrentPace: string;
  expectedOn: (date: string) => string;
  doneToday: string;
  newBugs: string;
  blockers: string;
  openIssues: string;
  none: string;
  deadlineWhen: (days: number) => string;
  reportDays: (n: number) => string;
  progressChange: (from: number, to: number) => string;
  statusBreakdown: string;
  noReports: string;
}

const he: ReportStrings = {
  dailyTitle: 'דיווח QA יומי',
  weeklyTitle: 'סיכום QA שבועי',
  status: 'סטטוס',
  overallStatus: 'סטטוס כללי',
  statusLabels: { ok: 'תקין', risk: 'בסיכון', blocked: 'חסום' },
  project: 'פרויקט',
  version: v => `גרסה ${v}`,
  progress: 'התקדמות',
  deadline: 'צפי סיום',
  notSet: 'לא צוין',
  atCurrentPace: 'בקצב הנוכחי',
  expectedOn: date => `סיום צפוי ב-${date}`,
  doneToday: 'בוצע היום',
  newBugs: 'באגים חדשים (Jira)',
  blockers: 'חוסמים',
  openIssues: 'נושאים פתוחים',
  none: 'אין',
  deadlineWhen: days =>
    days === 0 ? 'היום'
    : days === 1 ? 'מחר'
    : days > 1 ? `בעוד ${days} ימים`
    : days === -1 ? 'עבר אתמול'
    : `עבר לפני ${-days} ימים`,
  reportDays: n => (n === 1 ? 'יום דיווח אחד' : `${n} ימי דיווח`),
  progressChange: (from, to) => `מ-${from}% ל-${to}% (${to - from >= 0 ? '+' : ''}${to - from}%)`,
  statusBreakdown: 'סטטוסים',
  noReports: 'לא נשלחו דוחות בשבוע הזה.',
};

const en: ReportStrings = {
  dailyTitle: 'Daily QA Report',
  weeklyTitle: 'Weekly QA Summary',
  status: 'Status',
  overallStatus: 'Overall status',
  statusLabels: { ok: 'On track', risk: 'At risk', blocked: 'Blocked' },
  project: 'Project',
  version: v => `v${v}`,
  progress: 'Progress',
  deadline: 'Target date',
  notSet: 'Not set',
  atCurrentPace: 'At current pace',
  expectedOn: date => `expected to finish ${date}`,
  doneToday: 'Done today',
  newBugs: 'New bugs (Jira)',
  blockers: 'Blockers',
  openIssues: 'Open issues',
  none: 'None',
  deadlineWhen: days =>
    days === 0 ? 'today'
    : days === 1 ? 'tomorrow'
    : days > 1 ? `in ${days} days`
    : days === -1 ? 'overdue by 1 day'
    : `overdue by ${-days} days`,
  reportDays: n => (n === 1 ? '1 report day' : `${n} report days`),
  progressChange: (from, to) => `${from}% → ${to}% (${to - from >= 0 ? '+' : ''}${to - from}%)`,
  statusBreakdown: 'Statuses',
  noReports: 'No reports were sent this week.',
};

export const REPORT_STRINGS: Record<ReportLanguage, ReportStrings> = { he, en };
