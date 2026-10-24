import { describe, expect, it } from 'vitest';
import { HistoryEntry, ReportItem, ReportStatus } from '../types';
import { forecastCompletion, generateWeeklySummary, projectSeries, summarizeWeek, weekRange } from '../services/insights';

const item = (projectName: string, progress: number, patch: Partial<ReportItem> = {}): ReportItem => ({
  projectName, version: '', status: 'ok' as ReportStatus, progress, bugs: 0, bugsClosed: 0, openBugs: null, testsPlanned: null, testsPassed: null, testsFailed: null, blockers: 'אין', openIssues: '', deadline: '2026-11-05', ...patch,
});

const entry = (date: Date, items: ReportItem[]): HistoryEntry => ({
  id: String(date.getTime()), createdAt: date.toISOString(), projectName: items.map(i => i.projectName).join(' + '), text: '', items,
});

const day = (d: number, h = 17) => new Date(2026, 9, d, h, 0);

describe('projectSeries', () => {
  it('keeps the latest report per day, oldest first, and ignores other projects', () => {
    const history = [
      entry(day(21, 18), [item('Alpha', 40)]),
      entry(day(21, 9), [item('Alpha', 30)]),
      entry(day(20), [item('Alpha', 20), item('Beta', 90)]),
      { id: 'old', createdAt: day(19).toISOString(), projectName: 'Alpha', text: '' }, // v1.1 entry without items
    ];
    expect(projectSeries(history, 'Alpha').map(p => p.progress)).toEqual([20, 40]);
  });
});

describe('forecastCompletion', () => {
  const series = (values: [number, number][]) =>
    projectSeries(values.map(([d, p]) => entry(day(d), [item('A', p)])), 'A');

  it('projects completion from a steady pace', () => {
    // +10% per day, 60% on the 23rd -> 100% on the 27th
    const f = forecastCompletion(series([[20, 30], [21, 40], [22, 50], [23, 60]]), '2026-11-05');
    expect(f.kind).toBe('projected');
    if (f.kind !== 'projected') return;
    expect(f.date.getDate()).toBe(27);
    expect(f.ratePerDay).toBeCloseTo(10);
    expect(f.late).toBe(false);
  });

  it('flags a forecast that lands after the deadline', () => {
    const f = forecastCompletion(series([[20, 10], [23, 16]]), '2026-10-25');
    expect(f).toMatchObject({ kind: 'projected', late: true });
  });

  it('uses today\'s unsent value instead of an older point from the same day', () => {
    const f = forecastCompletion(series([[22, 50], [23, 55]]), '', { date: day(23), progress: 60 });
    expect(f.kind === 'projected' && f.date.getDate()).toBe(27);
  });

  it('handles the edge cases', () => {
    expect(forecastCompletion(series([[23, 40]]), '').kind).toBe('not-enough-data');
    expect(forecastCompletion(series([[20, 40], [23, 40]]), '').kind).toBe('stalled');
    expect(forecastCompletion(series([[20, 80], [23, 100]]), '').kind).toBe('done');
  });
});

describe('weekly summary', () => {
  it('uses Sunday-based weeks', () => {
    const { start, end } = weekRange(new Date(2026, 9, 23)); // Friday
    expect([start.getDate(), start.getDay(), end.getDate()]).toEqual([18, 0, 24]);
    expect(weekRange(new Date(2026, 9, 23), -1).start.getDate()).toBe(11);
  });

  const history = [
    entry(day(22, 18), [item('Alpha', 60, { bugs: 2, status: 'risk', blockers: 'אין סביבה' })]),
    entry(day(22, 9), [item('Alpha', 55, { bugs: 9 })]), // superseded by the later report that day
    entry(day(20), [item('Alpha', 40, { bugs: 3 }), item('Beta', 10, { status: 'blocked' })]),
    entry(day(15), [item('Alpha', 20, { bugs: 50 })]), // previous week
  ];
  const { start, end } = weekRange(new Date(2026, 9, 23));

  it('aggregates per project without double counting', () => {
    const [alpha, beta] = summarizeWeek(history, start, end);
    expect(alpha).toMatchObject({ name: 'Alpha', days: 2, firstProgress: 40, lastProgress: 60, bugs: 5, blockers: ['אין סביבה'] });
    expect(alpha.statuses).toEqual({ ok: 1, risk: 1, blocked: 0 });
    expect(beta).toMatchObject({ name: 'Beta', days: 1 });
  });

  it('renders the summary text in Hebrew and English', () => {
    const he = generateWeeklySummary(history, start, end, 'he');
    expect(he).toContain('📊 *סיכום QA שבועי* | 18/10–24/10/2026');
    expect(he).toContain('🔴 *סטטוס כללי:* חסום');
    expect(he).toContain('🚀 *Alpha* (2 ימי דיווח)');
    expect(he).toContain('מ-40% ל-60% (+20%)');

    const en = generateWeeklySummary(history, start, end, 'en');
    expect(en).toContain('Weekly QA Summary');
    expect(en).toContain('🚀 *Beta* (1 report day)');
    expect(en).toContain('40% → 60% (+20%)');
  });

  it('says so when the week is empty', () => {
    const { start: s, end: e } = weekRange(new Date(2026, 9, 23), -3);
    expect(generateWeeklySummary(history, s, e, 'he')).toContain('לא נשלחו דוחות בשבוע הזה.');
  });
});
