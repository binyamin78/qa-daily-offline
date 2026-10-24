import { describe, expect, it } from 'vitest';
import { FormData, HistoryEntry, ReportItem } from '../types';
import { blockerAges, computeChange, openBugsOf, previousReport, splitBlockers, testStats, toReportItem } from '../services/daily';
import { sectionContext, todayOverview } from '../services/projectContext';
import { generateOfflineReport } from '../services/offlineReportService';

const day = (d: number, h = 17) => new Date(2026, 9, d, h, 0);
const NOW = day(23, 12);

const item = (projectName: string, patch: Partial<ReportItem> = {}): ReportItem => ({
  projectName, version: '', status: 'ok', progress: 50, bugs: 0, bugsClosed: 0, openBugs: null,
  testsPlanned: null, testsPassed: null, testsFailed: null, blockers: 'אין', openIssues: '', deadline: '2026-11-05', ...patch,
});

const entry = (date: Date, items: ReportItem[]): HistoryEntry => ({
  id: String(date.getTime()), createdAt: date.toISOString(), projectName: items.map(i => i.projectName).join(' + '), text: '', items,
});

const form = (patch: Partial<FormData> = {}): FormData => ({
  projectName: 'Alpha', version: '', status: 'ok', checkedAreas: 'x', newJiraBugs: '0', bugsClosed: '0', openBugs: '',
  testsPlanned: '', testsPassed: '', testsFailed: '', blockers: 'אין', openIssues: '', estimatedCompletion: '2026-11-05',
  progressPercentage: '50', ...patch,
});

describe('open bugs balance', () => {
  it('continues from the previous report: open + new - closed', () => {
    expect(openBugsOf(form({ newJiraBugs: '3', bugsClosed: '1' }), 10)).toBe(12);
    expect(openBugsOf(form({ newJiraBugs: '0', bugsClosed: '20' }), 10)).toBe(0); // never negative
  });

  it('prefers a manual value and is unknown without a starting point', () => {
    expect(openBugsOf(form({ openBugs: '7', newJiraBugs: '3' }), 10)).toBe(7);
    expect(openBugsOf(form({ newJiraBugs: '3' }), null)).toBeNull();
  });

  it('takes the starting point from the last report before today', () => {
    const history = [entry(day(23, 9), [item('Alpha', { openBugs: 99 })]), entry(day(22), [item('Alpha', { openBugs: 10 })])];
    expect(previousReport(history, 'Alpha', NOW)?.item.openBugs).toBe(10);
    expect(toReportItem(form({ newJiraBugs: '2' }), 10).openBugs).toBe(12);
  });
});

describe('test execution', () => {
  it('derives executed, execution % and pass rate', () => {
    expect(testStats(150, 110, 10)).toEqual({ planned: 150, executed: 120, passed: 110, failed: 10, executedPct: 80, passRate: 92, overPlanned: false });
  });

  it('works without a plan and flags over-execution', () => {
    expect(testStats(null, 5, 0)).toMatchObject({ executed: 5, executedPct: null, passRate: 100 });
    expect(testStats(10, 9, 3)?.overPlanned).toBe(true);
    expect(testStats(null, null, null)).toBeNull();
  });
});

describe('blockers', () => {
  it('splits one blocker per line or ";" and ignores "אין"', () => {
    expect(splitBlockers('שרת למטה\n• אין גישה ל-VPN; חסר מכשיר')).toEqual(['שרת למטה', 'אין גישה ל-VPN', 'חסר מכשיר']);
    expect(splitBlockers('אין')).toEqual([]);
  });

  it('counts how many days a blocker has been open across consecutive reports', () => {
    const history = [
      entry(day(22), [item('Alpha', { blockers: 'שרת למטה\nחסר מכשיר' })]),
      entry(day(20), [item('Alpha', { blockers: 'שרת  למטה' })]), // whitespace differences still match
      entry(day(19), [item('Alpha', { blockers: 'אין' })]),
      entry(day(18), [item('Alpha', { blockers: 'שרת למטה' })]), // earlier, separate occurrence
    ];
    expect(blockerAges(history, 'Alpha', ['שרת למטה', 'חסר מכשיר', 'חדש'], NOW)).toEqual({ 'שרת למטה': 4, 'חסר מכשיר': 2, 'חדש': 1 });
  });
});

describe('change since the previous report', () => {
  const history = [
    entry(day(22), [item('Alpha', { progress: 42, bugs: 1, openBugs: 10, status: 'ok', blockers: 'שרת למטה', testsPlanned: 150, testsPassed: 90, testsFailed: 10 })]),
    entry(day(21), [item('Alpha', { bugs: 2 })]),
  ];

  it('summarises what moved', () => {
    const current = toReportItem(form({ progressPercentage: '50', newJiraBugs: '2', blockers: 'אין VPN', status: 'risk', testsPlanned: '150', testsPassed: '110', testsFailed: '10' }), 10);
    const c = computeChange(history, current, NOW)!;
    expect(c).toMatchObject({
      sinceYesterday: true, progressDelta: 8, newBugs: 2, avgNewBugs: 1.5,
      openBugs: { from: 10, to: 12 }, testsRunDelta: 20, passRate: { from: 90, to: 92 },
      status: { from: 'ok', to: 'risk' }, newBlockers: ['אין VPN'], resolvedBlockers: ['שרת למטה'],
    });
  });

  it('is null without an earlier report and labels older reports by date', () => {
    expect(computeChange([], toReportItem(form(), null), NOW)).toBeNull();
    const older = [entry(day(20), [item('Alpha')])];
    expect(computeChange(older, toReportItem(form(), null), NOW)?.sinceYesterday).toBe(false);
  });

  it('renders the change, blocker age, tests and open bugs in the report', () => {
    const f = form({ progressPercentage: '50', newJiraBugs: '2', bugsClosed: '1', blockers: 'שרת למטה', testsPlanned: '150', testsPassed: '110', testsFailed: '10' });
    const { extras } = sectionContext(history, f, NOW);
    const he = generateOfflineReport([f], { extras: { Alpha: extras }, now: NOW });
    expect(he).toContain('🧪 *ביצוע בדיקות:* 120/150 בוצעו (80%) · 92% עברו · 10 נכשלו');
    expect(he).toContain('🔄 *מאתמול:* התקדמות +8% · 2 באגים חדשים (ממוצע 1.5) · באגים פתוחים: מ-10 ל-11 · +20 בדיקות בוצעו · הצלחה: מ-90% ל-92%');
    expect(he).toContain('🐞 *באגים (Jira):* 2 חדשים · 1 נסגרו · 11 פתוחים');
    expect(he).toContain('🚫 *חוסמים:* שרת למטה (יום 2)');

    const en = generateOfflineReport([f], { language: 'en', extras: { Alpha: extras }, now: NOW });
    expect(en).toContain('🧪 *Test execution:* 120/150 run (80%) · 92% passed · 10 failed');
    expect(en).toContain('🔄 *Since yesterday:* progress +8%');
    expect(en).toContain('🐞 *Bugs (Jira):* 2 new · 1 closed · 11 open');
    expect(en).toContain('🚫 *Blockers:* שרת למטה (day 2)');
  });
});

describe('today overview', () => {
  const history = [
    entry(day(23, 9), [item('Alpha', { progress: 60, status: 'risk' })]),
    entry(day(22), [item('Beta', { progress: 30, openBugs: 4, blockers: 'שרת למטה' })]),
    entry(day(21), [item('Beta', { blockers: 'שרת למטה' })]),
    entry(day(20), [item('Beta', { blockers: 'שרת למטה' })]),
  ];

  it('shows sent state, latest values and old blockers per project', () => {
    const [alpha, beta, gamma] = todayOverview(['Alpha', 'Beta', 'Gamma'], history, form({ projectName: '' }), [], NOW);
    expect(alpha).toMatchObject({ sentToday: true, isDraft: false });
    expect(alpha.item).toMatchObject({ progress: 60, status: 'risk' });
    expect(beta).toMatchObject({ sentToday: false, oldBlockers: 1, daysToDeadline: 13 });
    expect(beta.item?.openBugs).toBe(4);
    expect(gamma.item).toBeNull();
  });

  it('uses the unsent draft for the project being edited', () => {
    const [, beta] = todayOverview(['Alpha', 'Beta'], history, form({ projectName: 'Beta', progressPercentage: '35' }), [], NOW);
    expect(beta).toMatchObject({ isDraft: true, sentToday: false });
    expect(beta.item?.progress).toBe(35);
  });
});
