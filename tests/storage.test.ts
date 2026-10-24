// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_TEMPLATES, loadCombined, loadDraft, loadHistory, loadSettings, saveCombined } from '../services/storage';

beforeEach(() => localStorage.clear());

describe('loadSettings', () => {
  it('returns defaults when nothing is stored', () => {
    expect(loadSettings()).toEqual({
      defaultVersion: '',
      customProjects: [],
      templates: DEFAULT_TEMPLATES,
      theme: 'system',
      reportLanguage: 'he',
      reminder: { enabled: false, time: '17:00', days: [0, 1, 2, 3, 4] },
    });
  });

  it('survives corrupt JSON', () => {
    localStorage.setItem('qa_app_settings', '{broken');
    expect(loadSettings().customProjects).toEqual([]);
  });

  it('migrates v1.0 settings: drops unknown fields, dedupes and trims projects', () => {
    localStorage.setItem('qa_app_settings', JSON.stringify({
      defaultProjectName: 'X', defaultVersion: '2.0', customProjects: ['Alpha', 'alpha', ' Beta ', 5],
    }));
    const s = loadSettings();
    expect(s.customProjects).toEqual(['Alpha', 'Beta']);
    expect(s.defaultVersion).toBe('2.0');
    expect(s).not.toHaveProperty('defaultProjectName');
  });

  it('rejects invalid reminder values', () => {
    localStorage.setItem('qa_app_settings', JSON.stringify({ reminder: { enabled: 'yes', time: '25', days: [1, 9, 'x'] }, theme: 'neon', reportLanguage: 'fr' }));
    const s = loadSettings();
    expect(s.reminder).toEqual({ enabled: false, time: '17:00', days: [1] });
    expect(s.theme).toBe('system');
    expect(s.reportLanguage).toBe('he');
  });
});

describe('loadDraft', () => {
  const settings = { ...loadSettings(), customProjects: ['Alpha'] };

  it('merges old drafts with new fields and validates status', () => {
    localStorage.setItem('daily_qa_form_draft', JSON.stringify({ projectName: 'Alpha', checkedAreas: 'x', status: 'weird', newJiraBugs: 4 }));
    const d = loadDraft(settings);
    expect(d.projectName).toBe('Alpha');
    expect(d.checkedAreas).toBe('x');
    expect(d.status).toBe('ok');
    expect(d.newJiraBugs).toBe('0'); // non-string ignored
  });

  it('clears a project that no longer exists', () => {
    localStorage.setItem('daily_qa_form_draft', JSON.stringify({ projectName: 'Gone' }));
    // only one project -> it is preselected instead
    expect(loadDraft(settings).projectName).toBe('Alpha');
  });
});

describe('loadCombined', () => {
  const settings = { ...loadSettings(), customProjects: ['Alpha', 'Beta'] };

  it('keeps today\'s sections', () => {
    saveCombined([{ ...loadDraft(settings), projectName: 'Beta' }]);
    expect(loadCombined(settings).map(s => s.projectName)).toEqual(['Beta']);
  });

  it('drops sections from another day', () => {
    localStorage.setItem('qa_combined_sections', JSON.stringify({ date: '2020-01-01', sections: [{ projectName: 'Beta' }] }));
    expect(loadCombined(settings)).toEqual([]);
  });
});

describe('loadHistory', () => {
  it('filters invalid entries and keeps v1.1 entries without items', () => {
    localStorage.setItem('qa_report_history', JSON.stringify([
      { id: 'a', createdAt: '2026-10-23T10:00:00Z', projectName: 'Alpha', text: 'old' },
      { id: 'b', createdAt: '2026-10-24T10:00:00Z', projectName: 'Alpha', text: 'new', items: [{ projectName: 'Alpha', progress: 50, status: 'risk' }] },
      { id: 3, text: 'bad' },
      'garbage',
    ]));
    const h = loadHistory();
    expect(h).toHaveLength(2);
    expect(h[0].items).toBeUndefined();
    expect(h[1].items?.[0]).toMatchObject({ projectName: 'Alpha', progress: 50, status: 'risk', bugs: 0 });
  });

  it('returns [] for non-array data', () => {
    localStorage.setItem('qa_report_history', '"nope"');
    expect(loadHistory()).toEqual([]);
  });
});
