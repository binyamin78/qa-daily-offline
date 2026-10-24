import { describe, expect, it } from 'vitest';
import { FormData } from '../types';
import { formatVersion, generateOfflineReport, hasBlockers, toNumberField, worstStatus } from '../services/offlineReportService';
import { toReportItem } from '../services/daily';

const NOW = new Date(2026, 9, 23, 17, 0); // 23/10/2026

const form = (patch: Partial<FormData> = {}): FormData => ({
  projectName: 'Alpha',
  version: '2.10.1',
  status: 'ok',
  checkedAreas: '  בדיקות רגרסיה  ',
  newJiraBugs: '3',
  bugsClosed: '0',
  openBugs: '',
  testsPlanned: '',
  testsPassed: '',
  testsFailed: '',
  blockers: 'אין',
  openIssues: '',
  estimatedCompletion: '2026-10-30',
  progressPercentage: '75',
  ...patch,
});

describe('generateOfflineReport', () => {
  it('builds a Hebrew single-project report', () => {
    const text = generateOfflineReport([form()], { now: NOW });
    expect(text).toContain('📅 *דיווח QA יומי* | 23/10/2026');
    expect(text).toContain('🟢 *סטטוס:* תקין');
    expect(text).toContain('🚀 *פרויקט:* Alpha (גרסה 2.10.1)');
    expect(text).toContain('📊 *התקדמות:* 75%');
    expect(text).toContain('📅 *צפי סיום:* 30/10/2026 (בעוד 7 ימים)');
    expect(text).toContain('🐞 *באגים (Jira):* 3 חדשים');
    expect(text).toContain('🚫 *חוסמים:* אין');
    // user text is trimmed
    expect(text).toContain('\nבדיקות רגרסיה\n');
  });

  it('omits the version when empty and fills defaults', () => {
    const text = generateOfflineReport([form({ version: ' ', openIssues: '', estimatedCompletion: '' })], { now: NOW });
    expect(text).toContain('🚀 *פרויקט:* Alpha\n');
    expect(text).toContain('*צפי סיום:* לא צוין');
    expect(text).toMatch(/\*נושאים פתוחים:\*\nאין/);
  });

  it('describes overdue deadlines', () => {
    expect(generateOfflineReport([form({ estimatedCompletion: '2026-10-22' })], { now: NOW })).toContain('(עבר אתמול)');
    expect(generateOfflineReport([form({ estimatedCompletion: '2026-10-20' })], { now: NOW })).toContain('(עבר לפני 3 ימים)');
  });

  it('builds an English report and translates the default "no blockers"', () => {
    const text = generateOfflineReport([form({ status: 'risk' })], { language: 'en', now: NOW });
    expect(text).toContain('📅 *Daily QA Report* | 23/10/2026');
    expect(text).toContain('🟡 *Status:* At risk');
    expect(text).toContain('🚀 *Project:* Alpha (v2.10.1)');
    expect(text).toContain('📅 *Target date:* 30/10/2026 (in 7 days)');
    expect(text).toContain('🚫 *Blockers:* None');
    expect(text).not.toMatch(/סטטוס|פרויקט|התקדמות/);
  });

  it('combines several projects with the worst status on top', () => {
    const text = generateOfflineReport(
      [form(), form({ projectName: 'Beta', status: 'blocked', blockers: 'שרת בדיקות למטה' })],
      { now: NOW },
    );
    expect(text).toContain('🔴 *סטטוס כללי:* חסום');
    expect(text).toContain('🚀 *פרויקט:* Alpha');
    expect(text).toContain('🚀 *פרויקט:* Beta');
    expect(text).toContain('🟢 *סטטוס:* תקין');
    expect(text).toContain('🔴 *סטטוס:* חסום');
    expect(text).toContain('🚫 *חוסמים:* שרת בדיקות למטה');
  });

  it('adds a warning line when the forecast is past the deadline', () => {
    const text = generateOfflineReport([form()], { now: NOW, extras: { Alpha: { lateForecast: new Date(2026, 10, 12) } } });
    expect(text).toContain('⚠️ *בקצב הנוכחי:* סיום צפוי ב-12/11/2026');
  });
});

describe('field helpers', () => {
  it('formatVersion keeps digits and single dots', () => {
    expect(formatVersion('2..10a.1')).toBe('2.10.1');
    expect(formatVersion('.1.2')).toBe('1.2');
    expect(formatVersion('1'.repeat(30))).toHaveLength(20);
  });

  it('toNumberField strips non-digits, leading zeros and caps', () => {
    expect(toNumberField('0075', 100)).toBe('75');
    expect(toNumberField('5000', 999)).toBe('999');
    expect(toNumberField('abc', 100)).toBe('');
  });

  it('hasBlockers ignores the "none" placeholders', () => {
    expect(hasBlockers('אין')).toBe(false);
    expect(hasBlockers(' None ')).toBe(false);
    expect(hasBlockers('')).toBe(false);
    expect(hasBlockers('אין סביבת בדיקות')).toBe(true);
  });

  it('worstStatus ranks blocked > risk > ok', () => {
    expect(worstStatus(['ok', 'risk'])).toBe('risk');
    expect(worstStatus(['risk', 'blocked', 'ok'])).toBe('blocked');
    expect(worstStatus([])).toBe('ok');
  });

  it('toReportItem stores numbers', () => {
    expect(toReportItem(form(), null)).toMatchObject({ projectName: 'Alpha', progress: 75, bugs: 3, status: 'ok', openBugs: null, testsPlanned: null });
  });
});
