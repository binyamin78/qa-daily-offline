
import { ReportLanguage, ReportStatus } from '../types';
import type { ChangeSummary, TestStats } from './daily';

export const STATUS_EMOJI: Record<ReportStatus, string> = { ok: '🟢', risk: '🟡', blocked: '🔴' };

const signed = (n: number) => `${n > 0 ? '+' : ''}${n}`;

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
  bugs: string;
  bugsNew: (n: number) => string;
  bugsClosed: (n: number) => string;
  bugsOpen: (n: number) => string;
  openBugsTrend: (from: number, to: number) => string;
  tests: string;
  testsSummary: (t: TestStats) => string;
  changeLabel: (sinceYesterday: boolean, date: string) => string;
  changeParts: (c: ChangeSummary) => string[];
  blockerDay: (n: number) => string;
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
  bugs: 'באגים (Jira)',
  bugsNew: n => `${n} חדשים`,
  bugsClosed: n => `${n} נסגרו`,
  bugsOpen: n => `${n} פתוחים`,
  openBugsTrend: (from, to) => `פתוחים: מ-${from} ל-${to}`,
  tests: 'ביצוע בדיקות',
  testsSummary: t => [
    t.planned ? `${t.executed}/${t.planned} בוצעו (${t.executedPct}%)` : `${t.executed} בוצעו`,
    ...(t.passRate !== null ? [`${t.passRate}% עברו`] : []),
    ...(t.failed > 0 ? [`${t.failed} נכשלו`] : []),
  ].join(' · '),
  changeLabel: (y, date) => (y ? 'מאתמול' : `מאז ${date}`),
  changeParts: c => {
    const parts = [
      ...(c.progressDelta !== 0 ? [`התקדמות ${signed(c.progressDelta)}%`] : []),
      ...(c.newBugs > 0 || c.avgNewBugs !== null ? [`${c.newBugs} באגים חדשים${c.avgNewBugs !== null ? ` (ממוצע ${c.avgNewBugs})` : ''}`] : []),
      ...(c.openBugs ? [`באגים פתוחים: מ-${c.openBugs.from} ל-${c.openBugs.to}`] : []),
      ...(c.testsRunDelta !== null ? [`${signed(c.testsRunDelta)} בדיקות בוצעו`] : []),
      ...(c.passRate ? [c.passRate.from !== null ? `הצלחה: מ-${c.passRate.from}% ל-${c.passRate.to}%` : `הצלחה ${c.passRate.to}%`] : []),
      ...(c.status ? [`סטטוס השתנה מ-${STATUS_EMOJI[c.status.from]} ל-${STATUS_EMOJI[c.status.to]}`] : []),
      ...c.newBlockers.map(b => `חוסם חדש: ${b}`),
      ...c.resolvedBlockers.map(b => `נפתר: ${b}`),
    ];
    return parts.length ? parts : ['ללא שינוי מהותי'];
  },
  blockerDay: n => `(יום ${n})`,
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
  bugs: 'Bugs (Jira)',
  bugsNew: n => `${n} new`,
  bugsClosed: n => `${n} closed`,
  bugsOpen: n => `${n} open`,
  openBugsTrend: (from, to) => `open: ${from} → ${to}`,
  tests: 'Test execution',
  testsSummary: t => [
    t.planned ? `${t.executed}/${t.planned} run (${t.executedPct}%)` : `${t.executed} run`,
    ...(t.passRate !== null ? [`${t.passRate}% passed`] : []),
    ...(t.failed > 0 ? [`${t.failed} failed`] : []),
  ].join(' · '),
  changeLabel: (y, date) => (y ? 'Since yesterday' : `Since ${date}`),
  changeParts: c => {
    const parts = [
      ...(c.progressDelta !== 0 ? [`progress ${signed(c.progressDelta)}%`] : []),
      ...(c.newBugs > 0 || c.avgNewBugs !== null ? [`${c.newBugs} new bugs${c.avgNewBugs !== null ? ` (avg ${c.avgNewBugs})` : ''}`] : []),
      ...(c.openBugs ? [`open bugs ${c.openBugs.from} → ${c.openBugs.to}`] : []),
      ...(c.testsRunDelta !== null ? [`${signed(c.testsRunDelta)} tests run`] : []),
      ...(c.passRate ? [c.passRate.from !== null ? `pass rate ${c.passRate.from}% → ${c.passRate.to}%` : `pass rate ${c.passRate.to}%`] : []),
      ...(c.status ? [`status ${STATUS_EMOJI[c.status.from]} → ${STATUS_EMOJI[c.status.to]}`] : []),
      ...c.newBlockers.map(b => `new blocker: ${b}`),
      ...c.resolvedBlockers.map(b => `resolved: ${b}`),
    ];
    return parts.length ? parts : ['no significant change'];
  },
  blockerDay: n => `(day ${n})`,
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
