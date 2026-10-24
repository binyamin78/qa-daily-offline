
import { FormData, ReportItem, ReportLanguage, ReportStatus } from "../types";
import { REPORT_STRINGS } from "./reportText";

const pad = (n: number) => String(n).padStart(2, '0');

export const formatDate = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

export const formatShortDate = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;

export const formatDateTime = (d: Date) => `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const parseIsoDate = (iso: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

// Whole days from `from` (default today) to an ISO date (yyyy-mm-dd); negative when it's already past
export const daysUntil = (iso: string, from: Date = new Date()): number | null => {
  const target = parseIsoDate(iso);
  if (!target) return null;
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
};

export const STATUS_EMOJI: Record<ReportStatus, string> = { ok: '🟢', risk: '🟡', blocked: '🔴' };

const STATUS_RANK: Record<ReportStatus, number> = { ok: 0, risk: 1, blocked: 2 };

export const worstStatus = (statuses: ReportStatus[]): ReportStatus =>
  statuses.reduce<ReportStatus>((worst, s) => (STATUS_RANK[s] > STATUS_RANK[worst] ? s : worst), 'ok');

// Digits and single dots only, e.g. "1.10.2" - multi-digit parts are allowed
export const formatVersion = (value: string) =>
  value.replace(/[^\d.]/g, '').replace(/\.{2,}/g, '.').replace(/^\./, '').slice(0, 20);

// Digits only, no leading zeros, capped at max ('' stays '' so the field can be cleared)
export const toNumberField = (value: string, max: number) => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return String(Math.min(max, parseInt(digits, 10)));
};

export const hasBlockers = (blockers: string) => {
  const b = blockers.trim().toLowerCase();
  return b !== '' && b !== 'אין' && b !== '-' && b !== 'none';
};

export const toReportItem = (f: FormData): ReportItem => ({
  projectName: f.projectName.trim(),
  version: f.version.trim(),
  status: f.status,
  progress: parseInt(toNumberField(f.progressPercentage, 100) || '0', 10),
  bugs: parseInt(toNumberField(f.newJiraBugs, 999) || '0', 10),
  blockers: f.blockers.trim(),
  openIssues: f.openIssues.trim(),
  deadline: f.estimatedCompletion,
});

export const SEPARATOR = '-----------------------';

// Late forecasts per project name, shown as a warning line in that project's section
export type ForecastNotes = Record<string, Date | undefined>;

interface ReportOptions {
  language?: ReportLanguage;
  lateForecasts?: ForecastNotes;
  now?: Date;
}

// One project, or several projects in one message with an overall status on top
export const generateOfflineReport = (sections: FormData[], { language = 'he', lateForecasts = {}, now = new Date() }: ReportOptions = {}): string => {
  const t = REPORT_STRINGS[language];
  const multi = sections.length > 1;
  const overall = worstStatus(sections.map(s => s.status));

  const describeDeadline = (iso: string) => {
    const date = parseIsoDate(iso);
    const days = daysUntil(iso, now);
    if (!date || days === null) return t.notSet;
    return `${formatDate(date)} (${t.deadlineWhen(days)})`;
  };

  const section = (f: FormData): string[] => {
    const version = f.version.trim();
    const late = lateForecasts[f.projectName];
    return [
      `🚀 *${t.project}:* ${f.projectName.trim()}${version ? ` (${t.version(version)})` : ''}`,
      ...(multi ? [`${STATUS_EMOJI[f.status]} *${t.status}:* ${t.statusLabels[f.status]}`] : []),
      `📊 *${t.progress}:* ${toNumberField(f.progressPercentage, 100) || '0'}%`,
      `📅 *${t.deadline}:* ${describeDeadline(f.estimatedCompletion)}`,
      ...(late ? [`⚠️ *${t.atCurrentPace}:* ${t.expectedOn(formatDate(late))}`] : []),
      '',
      `✅ *${t.doneToday}:*`,
      f.checkedAreas.trim(),
      '',
      `🐞 *${t.newBugs}:* ${toNumberField(f.newJiraBugs, 999) || '0'}`,
      `🚫 *${t.blockers}:* ${hasBlockers(f.blockers) ? f.blockers.trim() : t.none}`,
      '',
      `📝 *${t.openIssues}:*`,
      f.openIssues.trim() || t.none,
    ];
  };

  const lines = [
    `📅 *${t.dailyTitle}* | ${formatDate(now)}`,
    `${STATUS_EMOJI[overall]} *${multi ? t.overallStatus : t.status}:* ${t.statusLabels[overall]}`,
    SEPARATOR,
  ];
  sections.forEach(s => lines.push(...section(s), SEPARATOR));
  return lines.join('\n');
};
