
import { FormData, HistoryEntry, ReportItem, ReportStatus } from '../types';
import { dayNumber, fromDayNumber, DayItem, projectDays } from './days';
import { hasBlockers, toNumberField } from './offlineReportService';

// The last report of a project from before `now`'s day
export const previousReport = (history: HistoryEntry[], projectName: string, now: Date = new Date()): DayItem | null => {
  const today = dayNumber(now);
  const days = projectDays(history, projectName).filter(d => d.day < today);
  return days[days.length - 1] ?? null;
};

// --- Bugs and tests ---

const parseNum = (v: string, max: number): number | null => {
  const n = toNumberField(v, max);
  return n === '' ? null : parseInt(n, 10);
};

// Open bugs = manual value, or yesterday's open bugs + new - closed
export const openBugsOf = (f: FormData, previousOpen: number | null): number | null => {
  const manual = parseNum(f.openBugs, 9999);
  if (manual !== null) return manual;
  if (previousOpen === null) return null;
  return Math.max(0, previousOpen + (parseNum(f.newJiraBugs, 999) ?? 0) - (parseNum(f.bugsClosed, 999) ?? 0));
};

export interface TestStats {
  planned: number | null;
  executed: number;
  passed: number;
  failed: number;
  executedPct: number | null;
  passRate: number | null;
  overPlanned: boolean;
}

export const testStats = (planned: number | null, passed: number | null, failed: number | null): TestStats | null => {
  if (passed === null && failed === null) return planned ? { planned, executed: 0, passed: 0, failed: 0, executedPct: 0, passRate: null, overPlanned: false } : null;
  const p = passed ?? 0;
  const f = failed ?? 0;
  const executed = p + f;
  return {
    planned,
    executed,
    passed: p,
    failed: f,
    executedPct: planned ? Math.round((executed / planned) * 100) : null,
    passRate: executed ? Math.round((p / executed) * 100) : null,
    overPlanned: planned !== null && executed > planned,
  };
};

export const itemTestStats = (i: ReportItem) => testStats(i.testsPlanned, i.testsPassed, i.testsFailed);

export const formTestStats = (f: FormData) =>
  testStats(parseNum(f.testsPlanned, 99999), parseNum(f.testsPassed, 99999), parseNum(f.testsFailed, 99999));

export const toReportItem = (f: FormData, previousOpen: number | null): ReportItem => ({
  projectName: f.projectName.trim(),
  version: f.version.trim(),
  status: f.status,
  progress: parseNum(f.progressPercentage, 100) ?? 0,
  bugs: parseNum(f.newJiraBugs, 999) ?? 0,
  bugsClosed: parseNum(f.bugsClosed, 999) ?? 0,
  openBugs: openBugsOf(f, previousOpen),
  testsPlanned: parseNum(f.testsPlanned, 99999),
  testsPassed: parseNum(f.testsPassed, 99999),
  testsFailed: parseNum(f.testsFailed, 99999),
  blockers: f.blockers.trim(),
  openIssues: f.openIssues.trim(),
  deadline: f.estimatedCompletion,
});

// --- Blockers ---

// One blocker per line (or separated by ';')
export const splitBlockers = (text: string): string[] =>
  hasBlockers(text) ? text.split(/[\n;]/).map(b => b.replace(/^[•\-*]\s*/, '').trim()).filter(Boolean) : [];

const norm = (b: string) => b.trim().toLowerCase().replace(/\s+/g, ' ');

// Days each blocker has been open: counted back through consecutive reports that mention it
export const blockerAges = (history: HistoryEntry[], projectName: string, blockers: string[], now: Date = new Date()): Record<string, number> => {
  const today = dayNumber(now);
  const past = projectDays(history, projectName).filter(d => d.day < today).reverse();
  const ages: Record<string, number> = {};
  for (const b of blockers) {
    let firstDay = today;
    for (const d of past) {
      if (!splitBlockers(d.item.blockers).some(x => norm(x) === norm(b))) break;
      firstDay = d.day;
    }
    ages[b] = today - firstDay + 1;
  }
  return ages;
};

export const OLD_BLOCKER_DAYS = 3;

// --- Change since the previous report ---

export interface ChangeSummary {
  since: Date;
  sinceYesterday: boolean;
  progressDelta: number;
  newBugs: number;
  avgNewBugs: number | null;
  openBugs: { from: number; to: number } | null;
  testsRunDelta: number | null;
  passRate: { from: number | null; to: number } | null;
  status: { from: ReportStatus; to: ReportStatus } | null;
  newBlockers: string[];
  resolvedBlockers: string[];
}

const AVG_WINDOW = 7;

export const computeChange = (history: HistoryEntry[], current: ReportItem, now: Date = new Date()): ChangeSummary | null => {
  const today = dayNumber(now);
  const past = projectDays(history, current.projectName).filter(d => d.day < today);
  const prevDay = past[past.length - 1];
  if (!prevDay) return null;
  const prev = prevDay.item;

  const recent = past.slice(-AVG_WINDOW);
  const avgNewBugs = recent.length >= 2 ? Math.round((recent.reduce((s, d) => s + d.item.bugs, 0) / recent.length) * 10) / 10 : null;

  const prevTests = itemTestStats(prev);
  const curTests = itemTestStats(current);
  const prevBlockers = splitBlockers(prev.blockers);
  const curBlockers = splitBlockers(current.blockers);
  const has = (list: string[], b: string) => list.some(x => norm(x) === norm(b));

  return {
    since: fromDayNumber(prevDay.day),
    sinceYesterday: prevDay.day === today - 1,
    progressDelta: current.progress - prev.progress,
    newBugs: current.bugs,
    avgNewBugs,
    openBugs: prev.openBugs !== null && current.openBugs !== null && prev.openBugs !== current.openBugs
      ? { from: prev.openBugs, to: current.openBugs } : null,
    testsRunDelta: prevTests && curTests && curTests.executed !== prevTests.executed ? curTests.executed - prevTests.executed : null,
    passRate: curTests?.passRate != null && curTests.passRate !== prevTests?.passRate
      ? { from: prevTests?.passRate ?? null, to: curTests.passRate } : null,
    status: prev.status !== current.status ? { from: prev.status, to: current.status } : null,
    newBlockers: curBlockers.filter(b => !has(prevBlockers, b)),
    resolvedBlockers: prevBlockers.filter(b => !has(curBlockers, b)),
  };
};
