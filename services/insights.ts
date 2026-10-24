
import { HistoryEntry, ReportItem, ReportLanguage, ReportStatus } from '../types';
import { formatDate, formatShortDate, hasBlockers, parseIsoDate, SEPARATOR, STATUS_EMOJI, worstStatus } from './offlineReportService';
import { REPORT_STRINGS } from './reportText';

// Calendar-day number that ignores DST shifts
export const dayNumber = (d: Date) => Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
export const fromDayNumber = (n: number) => {
  const u = new Date(n * 86_400_000);
  return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate());
};

export interface ProgressPoint {
  day: number;
  date: Date;
  progress: number;
  status: ReportStatus;
}

// The latest report item per day for one project, oldest first
export const projectSeries = (history: HistoryEntry[], projectName: string): ProgressPoint[] => {
  const byDay = new Map<number, ProgressPoint & { at: number }>();
  for (const entry of history) {
    const at = new Date(entry.createdAt);
    if (isNaN(at.getTime())) continue;
    for (const item of entry.items ?? []) {
      if (item.projectName !== projectName) continue;
      const day = dayNumber(at);
      const prev = byDay.get(day);
      if (!prev || prev.at < at.getTime()) {
        byDay.set(day, { day, date: fromDayNumber(day), progress: item.progress, status: item.status, at: at.getTime() });
      }
    }
  }
  return [...byDay.values()].sort((a, b) => a.day - b.day).map(({ at: _at, ...p }) => p);
};

export const projectsWithData = (history: HistoryEntry[]): string[] => {
  const names = new Set<string>();
  history.forEach(e => e.items?.forEach(i => i.projectName && names.add(i.projectName)));
  return [...names];
};

export type Forecast =
  | { kind: 'done' }
  | { kind: 'not-enough-data' }
  | { kind: 'stalled' }
  | { kind: 'projected'; date: Date; ratePerDay: number; late: boolean | null };

const MAX_POINTS = 14;

// Linear trend over the last two weeks of reports (plus today's unsent value, if given)
export const forecastCompletion = (
  series: ProgressPoint[],
  deadlineIso: string,
  today: { date: Date; progress: number } | null = null,
): Forecast => {
  let points = series.map(p => ({ day: p.day, progress: p.progress }));
  if (today) {
    const day = dayNumber(today.date);
    points = points.filter(p => p.day !== day).concat({ day, progress: today.progress });
  }
  points = points.sort((a, b) => a.day - b.day).slice(-MAX_POINTS);
  const last = points[points.length - 1];
  if (last && last.progress >= 100) return { kind: 'done' };
  if (points.length < 2 || last.day === points[0].day) return { kind: 'not-enough-data' };

  const n = points.length;
  const meanX = points.reduce((s, p) => s + p.day, 0) / n;
  const meanY = points.reduce((s, p) => s + p.progress, 0) / n;
  const sxx = points.reduce((s, p) => s + (p.day - meanX) ** 2, 0);
  const sxy = points.reduce((s, p) => s + (p.day - meanX) * (p.progress - meanY), 0);
  const slope = sxy / sxx;
  if (!isFinite(slope) || slope < 0.05) return { kind: 'stalled' };

  const date = fromDayNumber(last.day + Math.ceil((100 - last.progress) / slope));
  const deadline = parseIsoDate(deadlineIso);
  return { kind: 'projected', date, ratePerDay: slope, late: deadline ? dayNumber(date) > dayNumber(deadline) : null };
};

// --- Weekly summary ---

// Sunday-based week containing `ref`, shifted by `offsetWeeks`
export const weekRange = (ref: Date, offsetWeeks = 0) => {
  const start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - ref.getDay() + offsetWeeks * 7);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return { start, end };
};

interface WeeklyProject {
  name: string;
  days: number;
  firstProgress: number;
  lastProgress: number;
  bugs: number;
  statuses: Record<ReportStatus, number>;
  blockers: string[];
  deadline: string;
}

export const summarizeWeek = (history: HistoryEntry[], start: Date, end: Date): WeeklyProject[] => {
  const from = dayNumber(start);
  const to = dayNumber(end);
  // latest item per project per day, so re-sent reports aren't double counted
  const perDay = new Map<string, { at: number; item: ReportItem }>();
  for (const entry of history) {
    const at = new Date(entry.createdAt);
    const day = dayNumber(at);
    if (isNaN(day) || day < from || day > to) continue;
    for (const item of entry.items ?? []) {
      const key = `${item.projectName}|${day}`;
      const prev = perDay.get(key);
      if (!prev || prev.at < at.getTime()) perDay.set(key, { at: at.getTime(), item });
    }
  }

  const projects = new Map<string, { at: number; item: ReportItem }[]>();
  perDay.forEach(v => {
    const list = projects.get(v.item.projectName) ?? [];
    list.push(v);
    projects.set(v.item.projectName, list);
  });

  return [...projects.entries()].map(([name, list]) => {
    const sorted = list.sort((a, b) => a.at - b.at).map(v => v.item);
    const statuses: Record<ReportStatus, number> = { ok: 0, risk: 0, blocked: 0 };
    sorted.forEach(i => statuses[i.status]++);
    const blockers = [...new Set(sorted.filter(i => hasBlockers(i.blockers)).map(i => i.blockers))];
    return {
      name,
      days: sorted.length,
      firstProgress: sorted[0].progress,
      lastProgress: sorted[sorted.length - 1].progress,
      bugs: sorted.reduce((s, i) => s + i.bugs, 0),
      statuses,
      blockers,
      deadline: sorted[sorted.length - 1].deadline,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
};

export const generateWeeklySummary = (
  history: HistoryEntry[],
  start: Date,
  end: Date,
  language: ReportLanguage = 'he',
  lateForecasts: Record<string, Date | undefined> = {},
): string => {
  const t = REPORT_STRINGS[language];
  const projects = summarizeWeek(history, start, end);
  const lines = [`📊 *${t.weeklyTitle}* | ${formatShortDate(start)}–${formatDate(end)}`];
  if (projects.length === 0) return [...lines, SEPARATOR, t.noReports].join('\n');

  const overall = worstStatus(projects.flatMap(p => (Object.keys(p.statuses) as ReportStatus[]).filter(s => p.statuses[s] > 0)));
  lines.push(`${STATUS_EMOJI[overall]} *${t.overallStatus}:* ${t.statusLabels[overall]}`, SEPARATOR);

  for (const p of projects) {
    const statusText = (Object.keys(p.statuses) as ReportStatus[])
      .filter(s => p.statuses[s] > 0)
      .map(s => `${STATUS_EMOJI[s]}×${p.statuses[s]}`)
      .join(' ');
    const deadline = parseIsoDate(p.deadline);
    const late = lateForecasts[p.name];
    lines.push(
      `🚀 *${p.name}* (${t.reportDays(p.days)})`,
      `📈 *${t.progress}:* ${t.progressChange(p.firstProgress, p.lastProgress)}`,
      `🐞 *${t.newBugs}:* ${p.bugs}`,
      `🚦 *${t.statusBreakdown}:* ${statusText}`,
      `🚫 *${t.blockers}:* ${p.blockers.length ? p.blockers.join('; ') : t.none}`,
      `📅 *${t.deadline}:* ${deadline ? formatDate(deadline) : t.notSet}`,
      ...(late ? [`⚠️ *${t.atCurrentPace}:* ${t.expectedOn(formatDate(late))}`] : []),
      SEPARATOR,
    );
  }
  return lines.join('\n');
};
