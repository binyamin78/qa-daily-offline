
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { App as CapApp } from '@capacitor/app';
import Header from './components/Header';
import { FormInput, NumberStepper } from './components/FormFields';
import ProgressPicker from './components/ProgressPicker';
import SettingsModal from './components/SettingsModal';
import HistoryPanel from './components/HistoryPanel';
import InsightsPanel from './components/InsightsPanel';
import TodayBoard from './components/TodayBoard';
import { FormData, AppSettings, HistoryEntry, ReportStatus } from './types';
import {
  generateOfflineReport, formatVersion, toNumberField, daysUntil, isSameDay, formatDate,
  hasBlockers, STATUS_EMOJI, SectionExtras,
} from './services/offlineReportService';
import {
  loadSettings, saveSettings, loadDraft, saveDraft, emptyForm, loadHistory, saveHistory,
  loadCombined, saveCombined, HISTORY_LIMIT,
} from './services/storage';
import { formTestStats, OLD_BLOCKER_DAYS } from './services/daily';
import { sectionContext, todayOverview } from './services/projectContext';
import { REPORT_STRINGS } from './services/reportText';
import { copyText, shareText, openWhatsApp, isNative } from './services/shareService';
import { syncReminders, ReminderResult } from './services/reminderService';

type View = 'form' | 'review' | 'history' | 'insights';
type Modal = 'settings' | 'progress' | null;
type Toast = { text: string; tone: 'info' | 'error' } | null;

const REQUIRED_FIELDS: (keyof FormData)[] = ['projectName', 'progressPercentage', 'estimatedCompletion', 'checkedAreas'];
const NUMBER_LIMITS: Partial<Record<keyof FormData, number>> = {
  newJiraBugs: 999, bugsClosed: 999, openBugs: 9999, progressPercentage: 100,
  testsPlanned: 99999, testsPassed: 99999, testsFailed: 99999,
};
const UI_TEXT = REPORT_STRINGS.he;

type MemoryFields = 'version' | 'progressPercentage' | 'estimatedCompletion' | 'openIssues' | 'testsPlanned' | 'testsPassed' | 'testsFailed' | 'bugsClosed' | 'openBugs' | 'blockers';
const REPORT_TITLE = 'דיווח QA יומי';

const STATUS_OPTIONS: { value: ReportStatus; label: string; active: string }[] = [
  { value: 'ok', label: 'תקין', active: 'bg-green-600 border-green-600 text-white' },
  { value: 'risk', label: 'בסיכון', active: 'bg-yellow-400 border-yellow-400 text-yellow-950' },
  { value: 'blocked', label: 'חסום', active: 'bg-red-600 border-red-600 text-white' },
];

const isComplete = (f: FormData) => REQUIRED_FIELDS.every(key => String(f[key]).trim() !== '');

const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [formData, setFormData] = useState<FormData>(() => loadDraft(loadSettings()));
  const [combined, setCombined] = useState<FormData[]>(() => loadCombined(loadSettings()));
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);

  const [view, setView] = useState<View>('form');
  const [modal, setModal] = useState<Modal>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [validationErrors, setValidationErrors] = useState<(keyof FormData)[]>([]);
  const [editableText, setEditableText] = useState('');
  const [reviewSource, setReviewSource] = useState('');
  const [reviewSections, setReviewSections] = useState<FormData[]>([]);
  const [copySuccess, setCopySuccess] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [reminderState, setReminderState] = useState<ReminderResult | null>(null);

  const allProjects = settings.customProjects;
  const language = settings.reportLanguage;

  useEffect(() => { saveDraft(formData); }, [formData]);
  useEffect(() => { saveSettings(settings); }, [settings]);
  useEffect(() => { saveHistory(history); }, [history]);
  useEffect(() => { saveCombined(combined); }, [combined]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.tone === 'error' ? 3500 : 2200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!copySuccess) return;
    const t = setTimeout(() => setCopySuccess(false), 2000);
    return () => clearTimeout(t);
  }, [copySuccess]);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [view]);

  // --- Theme ---
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = settings.theme === 'dark' || (settings.theme === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', dark ? 'dark' : 'light');
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#14532d' : '#16a34a');
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [settings.theme]);

  // --- Daily reminder (re-planned whenever settings change, a report is sent, or the app resumes) ---
  const sentToday = history.some(e => isSameDay(new Date(e.createdAt), new Date()));
  const askReminderPermission = useRef(false);
  const [resumeTick, setResumeTick] = useState(0);
  useEffect(() => {
    const ask = askReminderPermission.current;
    askReminderPermission.current = false;
    syncReminders(settings.reminder, sentToday, ask).then(setReminderState);
  }, [settings.reminder, sentToday, resumeTick]);

  const updateSettings = (next: AppSettings) => {
    if (next.reminder.enabled && !settings.reminder.enabled) askReminderPermission.current = true;
    setSettings(next);
  };

  // Android back button / Escape: close the top-most layer instead of leaving the app
  const goBack = useRef<() => boolean>(() => false);
  goBack.current = () => {
    if (modal) { setModal(null); return true; }
    if (showClearConfirm) { setShowClearConfirm(false); return true; }
    if (view !== 'form') { setView('form'); return true; }
    return false;
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') goBack.current(); };
    window.addEventListener('keydown', onKey);
    if (!isNative()) return () => window.removeEventListener('keydown', onKey);
    const back = CapApp.addListener('backButton', () => {
      if (!goBack.current()) CapApp.minimizeApp();
    });
    const resume = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) setResumeTick(t => t + 1);
    });
    return () => {
      window.removeEventListener('keydown', onKey);
      back.then(l => l.remove());
      resume.then(l => l.remove());
    };
  }, []);

  const notify = (text: string, tone: 'info' | 'error' = 'info') => setToast({ text, tone });

  const setField = (name: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    setValidationErrors(prev => prev.filter(f => f !== name));
  };

  // Project-specific fields come back from the last report of that project
  // Test counts are per test cycle and blockers stay until resolved, so they carry over; bug counts are per day
  const projectMemory = (name: string): Pick<FormData, MemoryFields> => {
    const section = combined.find(s => s.projectName === name);
    if (section) return section;
    const item = history.map(e => e.items?.find(i => i.projectName === name)).find(Boolean);
    const str = (n: number | null) => (n === null ? '' : String(n));
    if (item) return {
      version: item.version, progressPercentage: String(item.progress), estimatedCompletion: item.deadline, openIssues: item.openIssues,
      testsPlanned: str(item.testsPlanned), testsPassed: str(item.testsPassed), testsFailed: str(item.testsFailed),
      bugsClosed: '0', openBugs: '', blockers: item.blockers || 'אין',
    };
    return {
      version: settings.defaultVersion, progressPercentage: '0', estimatedCompletion: '', openIssues: '',
      testsPlanned: '', testsPassed: '', testsFailed: '', bugsClosed: '0', openBugs: '', blockers: 'אין',
    };
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const name = e.target.name as keyof FormData;
    let value = e.target.value;
    if (name === 'projectName') {
      if (value) selectProject(value);
      else setField('projectName', '');
      return;
    }
    if (name === 'version') value = formatVersion(value);
    const max = NUMBER_LIMITS[name];
    if (max !== undefined) value = toNumberField(value, max);
    setField(name, value);
  };

  const updateNumber = (name: keyof FormData, delta: number) => {
    const max = NUMBER_LIMITS[name] ?? 999;
    const current = parseInt(formData[name] || '0', 10);
    const next = Math.max(0, Math.min(max, (isNaN(current) ? 0 : current) + delta));
    setField(name, next.toString());
  };

  const toggleTemplate = (template: string) => {
    const lines = formData.checkedAreas.split('\n');
    const matches = (l: string) => l.replace(/^•\s*/, '').trim() === template;
    const next = lines.some(matches)
      ? lines.filter(l => !matches(l)).join('\n')
      : [...lines.filter(l => l.trim()), `• ${template}`].join('\n');
    setField('checkedAreas', next);
  };

  const executeClearForm = () => {
    setFormData(emptyForm(settings));
    setCombined([]);
    setValidationErrors([]);
    setShowClearConfirm(false);
    setReportSent(false);
    notify("הטופס נוקה 🧹");
  };

  const handleProjectRemoved = (name: string) => {
    if (formData.projectName === name) setField('projectName', '');
    setCombined(prev => prev.filter(s => s.projectName !== name));
  };

  // --- History context for the current project: forecast, change since last report, blocker ages, open bugs ---
  const ctx = useMemo(() => (formData.projectName ? sectionContext(history, formData) : null), [history, formData]);
  const currentForecast = ctx?.forecast ?? null;
  const overview = useMemo(() => todayOverview(allProjects, history, formData, combined), [allProjects, history, formData, combined]);
  const tests = formTestStats(formData);

  // --- Report ---
  const currentSections = (form: FormData = formData) => [...combined.filter(s => s.projectName !== form.projectName), form];

  const buildReport = (sections: FormData[]) => {
    const extras: Record<string, SectionExtras> = {};
    sections.forEach(s => { extras[s.projectName] = sectionContext(history, s).extras; });
    return generateOfflineReport(sections, { language, extras });
  };

  const selectProject = (name: string) => {
    if (name === formData.projectName) return;
    if (combined.some(s => s.projectName === name)) { editSection(name); return; }
    setFormData(prev => ({ ...prev, projectName: name, ...projectMemory(name) }));
    setValidationErrors(prev => prev.filter(f => f !== 'projectName'));
  };

  const prepareForReview = () => {
    const missing = REQUIRED_FIELDS.filter(key => !String(formData[key]).trim());
    if (missing.length > 0) {
      setValidationErrors(missing);
      notify("נא למלא את שדות החובה (*)", 'error');
      const first = document.querySelector<HTMLElement>(`[name="${missing[0]}"]`);
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      first?.focus({ preventScroll: true });
      return;
    }
    const sections = currentSections();
    // Keep manual edits to the report text if nothing changed since
    const source = JSON.stringify({ sections, language });
    if (source !== reviewSource || !editableText) {
      setEditableText(buildReport(sections));
      setReviewSource(source);
    }
    setReviewSections(sections);
    setReportSent(false);
    setView('review');
  };

  const regenerateReport = () => {
    setEditableText(buildReport(reviewSections));
    setReviewSource(JSON.stringify({ sections: reviewSections, language }));
  };

  // --- Multi-project report ---
  const addAnotherProject = () => {
    setCombined(prev => [...prev.filter(s => s.projectName !== formData.projectName), formData]);
    setFormData({ ...emptyForm(settings), projectName: '' });
    setEditableText('');
    setReviewSource('');
    setView('form');
    notify(`${formData.projectName} נוסף לדוח. בחר את הפרויקט הבא`);
  };

  const editSection = (name: string) => {
    const section = combined.find(s => s.projectName === name);
    if (!section) return;
    const current = formData.projectName && formData.projectName !== name ? formData : null;
    if (current && !isComplete(current) && current.checkedAreas.trim()) {
      notify(`קודם השלם את שדות החובה של ${current.projectName}`, 'error');
      return;
    }
    setCombined(prev => [...prev.filter(s => s.projectName !== name), ...(current && isComplete(current) ? [current] : [])]);
    setFormData(section);
    setValidationErrors([]);
  };

  const removeSection = (name: string) => setCombined(prev => prev.filter(s => s.projectName !== name));

  // Called whenever a report leaves the app - one history entry per report per day
  const recordSent = (text: string) => {
    const now = new Date();
    const items = reviewSections.map(s => sectionContext(history, s, now).item);
    const projectName = items.map(i => i.projectName).join(' + ');
    setHistory(prev => {
      const rest = prev.filter(e => !(e.projectName === projectName && isSameDay(new Date(e.createdAt), now)));
      const entry: HistoryEntry = { id: now.getTime().toString(36), createdAt: now.toISOString(), projectName, text, items };
      return [entry, ...rest].slice(0, HISTORY_LIMIT);
    });
    setReportSent(true);
  };

  const handleCopy = async (text: string, record: boolean) => {
    if (!text.trim()) return;
    if (await copyText(text)) {
      if (record) { setCopySuccess(true); recordSent(text); }
      else notify('הועתק ללוח ✅');
    } else {
      notify('ההעתקה נכשלה - סמן את הטקסט והעתק ידנית', 'error');
    }
  };

  const handleShare = async (text: string, record: boolean) => {
    if (!text.trim()) return;
    const result = await shareText(text, REPORT_TITLE);
    if (result === 'shared' && record) recordSent(text);
    if (result === 'unavailable') handleWhatsApp(text, record);
  };

  const handleWhatsApp = (text: string, record: boolean) => {
    if (!text.trim()) return;
    if (record) recordSent(text);
    openWhatsApp(text);
  };

  // Next day: keep project, version, progress, deadline and open issues - clear what was done today
  const startNextReport = () => {
    // open bugs are recalculated tomorrow from today's report; blockers stay until resolved
    setFormData(prev => ({ ...prev, status: 'ok', checkedAreas: '', newJiraBugs: '0', bugsClosed: '0', openBugs: '' }));
    setCombined([]);
    setEditableText('');
    setReviewSource('');
    setReportSent(false);
    setView('form');
    notify('מוכן לדוח הבא ✨');
  };

  const deadlineDays = daysUntil(formData.estimatedCompletion);
  const deadlineHint = (
    <div className="space-y-1">
      {deadlineDays !== null && (
        deadlineDays < 0 ? <p className="text-orange-600">⚠️ התאריך שנבחר כבר עבר</p>
        : <p>{deadlineDays === 0 ? 'היום' : `עוד ${deadlineDays} ימים`}</p>
      )}
      {currentForecast?.kind === 'projected' && (
        <p className={currentForecast.late ? 'text-orange-600' : 'text-green-700'}>
          {currentForecast.late ? '⚠️' : '📈'} בקצב הנוכחי: סיום ב-{formatDate(currentForecast.date)}
        </p>
      )}
      {currentForecast?.kind === 'stalled' && <p className="text-orange-600">⚠️ אין התקדמות בימים האחרונים</p>}
    </div>
  );

  const reviewIsMulti = reviewSections.length > 1;

  return (
    <div className="min-h-screen flex flex-col w-full max-w-lg mx-auto bg-gray-50 border-x border-gray-200 relative font-['Assistant'] overflow-x-hidden">
      <Header
        historyCount={history.length}
        onOpenInsights={() => setView('insights')}
        onOpenHistory={() => setView('history')}
        onOpenSettings={() => setModal('settings')}
      />

      {modal === 'settings' && (
        <SettingsModal settings={settings} reminderState={reminderState} onChange={updateSettings} onProjectRemoved={handleProjectRemoved} onClose={() => setModal(null)} />
      )}

      {modal === 'progress' && (
        <ProgressPicker
          onClose={() => setModal(null)}
          onSelect={v => { setField('progressPercentage', String(v)); setModal(null); }}
        />
      )}

      <main className="flex-1 p-4 space-y-6 safe-bottom-pad" dir="rtl">
        {view === 'history' && (
          <HistoryPanel
            entries={history}
            onCopy={text => handleCopy(text, false)}
            onShare={text => handleShare(text, false)}
            onDelete={id => setHistory(prev => prev.filter(e => e.id !== id))}
            onClearAll={() => setHistory([])}
            onClose={() => setView('form')}
          />
        )}

        {view === 'insights' && (
          <InsightsPanel
            history={history}
            currentForm={formData}
            language={language}
            onCopy={text => handleCopy(text, false)}
            onShare={text => handleShare(text, false)}
            onClose={() => setView('form')}
          />
        )}

        {view === 'form' && (
          <div className="space-y-6 animate-in">
            {overview.length > 0 && <TodayBoard overview={overview} currentProject={formData.projectName} onSelect={selectProject} />}

            <div className="flex justify-start">
              {!showClearConfirm ? (
                <button onClick={() => setShowClearConfirm(true)} className="bg-red-50 text-red-600 text-xs font-black py-2.5 px-5 rounded-full border border-red-100 active:scale-95">🗑️ נקה טופס</button>
              ) : (
                <div className="flex gap-2 animate-in">
                  <button onClick={executeClearForm} className="bg-red-600 text-white text-xs font-black py-2.5 px-5 rounded-full active:scale-95">בטוח? נקה הכל</button>
                  <button onClick={() => setShowClearConfirm(false)} className="bg-gray-100 text-gray-600 text-xs font-black py-2.5 px-5 rounded-full active:scale-95">ביטול</button>
                </div>
              )}
            </div>

            {combined.length > 0 && (
              <div className="bg-green-50 border-2 border-green-200 p-4 rounded-[24px] space-y-3">
                <p className="font-black text-green-900 text-sm">דוח משולב להיום · כבר בדוח:</p>
                <div className="flex flex-wrap gap-2">
                  {combined.map(s => (
                    <span key={s.projectName} className="inline-flex items-center gap-1 bg-white border border-green-200 rounded-full pr-3 pl-1 py-1 text-sm font-bold text-gray-800">
                      <button onClick={() => editSection(s.projectName)} className="font-black">{STATUS_EMOJI[s.status]} {s.projectName}</button>
                      <button onClick={() => removeSection(s.projectName)} aria-label={`הסר את ${s.projectName} מהדוח`} className="w-7 h-7 rounded-full text-gray-400 hover:bg-gray-100 font-black">✕</button>
                    </span>
                  ))}
                </div>
                <p className="text-xs text-green-800 font-bold">הפרויקט שבטופס יתווסף כחלק נוסף. לחיצה על פרויקט פותחת אותו לעריכה.</p>
              </div>
            )}

            {/* סעיף 1: כללי */}
            <div className="bg-white p-5 rounded-[24px] border border-gray-200 shadow-sm space-y-6">
              <div className="border-r-4 border-green-600 pr-3 text-right"><h2 className="text-lg font-black text-gray-900">פרטים וגרסה</h2></div>
              <div className="space-y-2 text-right">
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="projectName" className="text-lg font-extrabold text-gray-900 px-1">שם פרויקט <span className="text-red-600">*</span></label>
                  <button onClick={() => setModal('settings')} className="text-xs font-black text-green-700 bg-green-50 px-2 py-1 rounded-lg border border-green-100">
                    {allProjects.length === 0 ? '+ הוסף פרויקט' : 'ניהול פרויקטים'}
                  </button>
                </div>
                <select id="projectName" name="projectName" value={formData.projectName} onChange={handleInputChange} className={`w-full p-4 bg-white border-2 rounded-2xl font-bold text-lg text-right ${validationErrors.includes('projectName') ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}>
                  <option value="">{allProjects.length === 0 ? '-- קודם הוסף פרויקט בהגדרות --' : 'בחר פרויקט...'}</option>
                  {allProjects.map(p => (
                    <option key={p} value={p} disabled={combined.some(s => s.projectName === p) && p !== formData.projectName}>{p}</option>
                  ))}
                </select>
                {validationErrors.includes('projectName') && <p className="text-xs text-red-600 font-bold pr-1">שדה חובה</p>}
              </div>
              <FormInput name="version" label="גרסה" value={formData.version} isError={false} placeholder="1.2.3" inputMode="decimal" onChange={handleInputChange} isRequired={false} helper="לא חובה. ספרות ונקודות, לדוגמה 2.10.1" />
            </div>

            {/* סעיף 2: סטטוס */}
            <div className="bg-white p-5 rounded-[24px] border border-gray-200 shadow-sm space-y-4">
              <div className="border-r-4 border-green-600 pr-3 text-right"><h2 className="text-lg font-black text-gray-900">סטטוס היום</h2></div>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="סטטוס היום">
                {STATUS_OPTIONS.map(o => (
                  <button
                    key={o.value}
                    role="radio"
                    aria-checked={formData.status === o.value}
                    onClick={() => setFormData(prev => ({ ...prev, status: o.value }))}
                    className={`py-4 rounded-2xl font-black border-2 transition-all active:scale-95 ${formData.status === o.value ? o.active : 'bg-white border-gray-200 text-gray-600'}`}
                  >{STATUS_EMOJI[o.value]} {o.label}</button>
                ))}
              </div>
              {ctx?.extras.change && (
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3 text-sm font-bold text-gray-700">
                  <span className="font-black text-gray-900">🔄 {UI_TEXT.changeLabel(ctx.extras.change.sinceYesterday, formatDate(ctx.extras.change.since))}: </span>
                  {UI_TEXT.changeParts(ctx.extras.change).join(' · ')}
                </div>
              )}
            </div>

            {/* סעיף 3: התקדמות וצפי */}
            <div className="bg-white p-5 rounded-[24px] border border-gray-200 shadow-sm space-y-6">
              <div className="border-r-4 border-green-600 pr-3 text-right"><h2 className="text-lg font-black text-gray-900">התקדמות וזמנים</h2></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2 text-right">
                  <label htmlFor="progressPercentage" className="text-lg font-extrabold text-gray-900 px-1">אחוז התקדמות <span className="text-red-600">*</span></label>
                  <div className="flex gap-2">
                    <div className="relative flex-1 min-w-0">
                      <input id="progressPercentage" name="progressPercentage" type="text" inputMode="numeric" autoComplete="off" value={formData.progressPercentage} onChange={handleInputChange} className={`w-full p-4 bg-white border-2 rounded-2xl font-bold text-lg text-center ${validationErrors.includes('progressPercentage') ? 'border-red-400 bg-red-50' : 'border-gray-300'}`} />
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black pointer-events-none">%</span>
                    </div>
                    <button onClick={() => setModal('progress')} aria-label="בחירה מהירה" className="bg-green-50 text-green-700 border-2 border-green-200 rounded-2xl px-4 font-black">🔢</button>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden" dir="rtl">
                    <div className="h-full bg-green-500 transition-all" style={{ width: `${Math.min(100, parseInt(formData.progressPercentage || '0', 10))}%` }} />
                  </div>
                  {validationErrors.includes('progressPercentage') && <p className="text-xs text-red-600 font-bold pr-1">שדה חובה</p>}
                </div>
                <FormInput name="estimatedCompletion" type="date" label="צפי סיום" value={formData.estimatedCompletion} isError={validationErrors.includes('estimatedCompletion')} placeholder="" onChange={handleInputChange} helper={deadlineHint} />
              </div>
            </div>

            {/* ביצוע בדיקות (מחזור נוכחי) */}
            <div className="bg-white p-5 rounded-[24px] border border-gray-200 shadow-sm space-y-4">
              <div className="border-r-4 border-green-600 pr-3 text-right">
                <h2 className="text-lg font-black text-gray-900">ביצוע בדיקות</h2>
                <p className="text-xs text-gray-500 font-bold">לא חובה · סה"כ במחזור הבדיקות הנוכחי, נשמר גם למחר</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {([['testsPlanned', 'מתוכננות'], ['testsPassed', 'עברו ✓'], ['testsFailed', 'נכשלו ✗']] as [keyof FormData, string][]).map(([name, label]) => (
                  <div key={name} className="space-y-1">
                    <label htmlFor={name} className="block text-sm font-extrabold text-gray-900 text-center">{label}</label>
                    <input id={name} name={name} type="text" inputMode="numeric" autoComplete="off" value={formData[name]} onChange={handleInputChange} placeholder="—" className="w-full p-3 bg-white border-2 border-gray-300 rounded-2xl font-black text-lg text-center" />
                  </div>
                ))}
              </div>
              {tests && (
                <div className="space-y-2">
                  {tests.planned ? (
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex" dir="rtl" aria-hidden="true">
                      <div className="h-full bg-green-500" style={{ width: `${Math.min(100, (tests.passed / tests.planned) * 100)}%` }} />
                      <div className="h-full bg-red-500" style={{ width: `${Math.min(100, (tests.failed / tests.planned) * 100)}%` }} />
                    </div>
                  ) : null}
                  <p className="text-sm font-black text-gray-700">🧪 {UI_TEXT.testsSummary(tests)}</p>
                  {tests.overPlanned && <p className="text-xs font-bold text-orange-600">⚠️ בוצעו יותר בדיקות מהמתוכנן. כדאי לעדכן את מספר המתוכננות.</p>}
                </div>
              )}
            </div>

            {/* סעיף 4: מה נעשה היום */}
            <div className="bg-white p-5 rounded-[24px] border border-gray-200 shadow-sm space-y-4">
              <div className="border-r-4 border-green-600 pr-3 text-right"><h2 className="text-lg font-black text-gray-900">מה נבדק היום?</h2></div>
              {settings.templates.length > 0 && (
                <div className="flex flex-wrap gap-2" aria-label="תבניות מהירות">
                  {settings.templates.map(t => {
                    const active = formData.checkedAreas.split('\n').some(l => l.replace(/^•\s*/, '').trim() === t);
                    return (
                      <button
                        key={t}
                        aria-pressed={active}
                        onClick={() => toggleTemplate(t)}
                        className={`px-3 py-2 rounded-full text-sm font-bold border-2 transition-all active:scale-95 ${active ? 'bg-green-600 border-green-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-600'}`}
                      >{active ? '✓ ' : '+ '}{t}</button>
                    );
                  })}
                </div>
              )}
              <FormInput name="checkedAreas" label="אזורים שנבדקו" value={formData.checkedAreas} isError={validationErrors.includes('checkedAreas')} placeholder="פירוט תהליכים ומסכים..." isTextArea maxLength={2000} onChange={handleInputChange} helper="בחר תבניות למעלה או כתוב בחופשיות" />
            </div>

            {/* סעיף 5: באגים וסיכונים */}
            <div className="bg-white p-5 rounded-[24px] border border-gray-200 shadow-sm space-y-6">
              <div className="border-r-4 border-red-600 pr-3 text-right"><h2 className="text-lg font-black text-gray-900">באגים וסיכונים</h2></div>
              <div className="grid grid-cols-2 gap-3">
                <NumberStepper name="newJiraBugs" label="באגים חדשים" value={formData.newJiraBugs} isError={false} onUpdate={updateNumber} onChange={handleInputChange} max={999} isRequired={false} />
                <NumberStepper name="bugsClosed" label="נסגרו / אומתו" value={formData.bugsClosed} isError={false} onUpdate={updateNumber} onChange={handleInputChange} max={999} isRequired={false} />
              </div>
              {formData.openBugs === '' && ctx && ctx.previousOpen !== null ? (
                <div className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-2xl p-4">
                  <div>
                    <p className="font-black text-gray-900">🐞 באגים פתוחים: {ctx.item.openBugs}</p>
                    <p className="text-xs font-bold text-gray-500">בדוח הקודם {ctx.previousOpen} · +{toNumberField(formData.newJiraBugs, 999) || 0} חדשים · −{toNumberField(formData.bugsClosed, 999) || 0} נסגרו</p>
                  </div>
                  <button onClick={() => setField('openBugs', String(ctx.item.openBugs ?? 0))} className="shrink-0 text-xs font-black text-gray-600 bg-white border border-gray-300 px-3 py-2 rounded-xl">תקן מספר</button>
                </div>
              ) : (
                <FormInput
                  name="openBugs" label="באגים פתוחים כרגע" value={formData.openBugs} isError={false} placeholder="לדוגמה 12" inputMode="numeric" onChange={handleInputChange} isRequired={false}
                  helper={ctx?.previousOpen != null ? (
                    <button onClick={() => setField('openBugs', '')} className="text-green-700 underline">חזור לחישוב אוטומטי מהדוח הקודם</button>
                  ) : 'לא חובה. מזינים פעם אחת לפי Jira, ומהדוח הבא המספר יתעדכן לבד לפי חדשים פחות נסגרו.'}
                />
              )}
              <FormInput
                name="blockers" label="חוסמים (Blockers)" value={formData.blockers} isError={false} placeholder="חוסם בכל שורה, או 'אין'" isTextArea maxLength={500} onChange={handleInputChange} isRequired={false}
                helper={hasBlockers(formData.blockers) && formData.status === 'ok' ? (
                  <button onClick={() => setFormData(prev => ({ ...prev, status: 'blocked' }))} className="text-red-600 underline">יש חוסמים: לסמן את הסטטוס כ-🔴 חסום?</button>
                ) : 'כל חוסם בשורה נפרדת, כדי שנוכל לספור כמה ימים הוא פתוח.'}
              />
              {ctx && (ctx.extras.blockers ?? []).some(b => b.age >= 2) && (
                <div className="flex flex-wrap gap-2 -mt-3" aria-label="גיל החוסמים">
                  {(ctx.extras.blockers ?? []).filter(b => b.age >= 2).map(b => (
                    <span key={b.text} className={`text-xs font-black px-3 py-1.5 rounded-full border ${b.age >= OLD_BLOCKER_DAYS ? 'bg-red-50 text-red-600 border-red-100' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      🚫 {b.text} · יום {b.age}{b.age >= OLD_BLOCKER_DAYS ? ' · דורש טיפול' : ''}
                    </span>
                  ))}
                </div>
              )}
              <FormInput name="openIssues" label="נושאים פתוחים" value={formData.openIssues} isError={false} placeholder="נושאים למעקב..." isTextArea maxLength={2000} onChange={handleInputChange} isRequired={false} helper="נשמרים גם לדוח של מחר." />
            </div>

            <button onClick={prepareForReview} className="w-full bg-green-600 text-white font-black py-6 rounded-[24px] shadow-xl active:scale-95 transition-all text-xl">
              {combined.length > 0 ? `תצוגה מקדימה · ${combined.length + 1} פרויקטים ✨` : 'תצוגה מקדימה וייצור דוח ✨'}
            </button>
          </div>
        )}

        {view === 'review' && (
          <div className="space-y-6 animate-in">
            <div className="bg-white p-6 rounded-[40px] border-4 border-green-600 shadow-2xl space-y-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xl font-black">{reviewIsMulti ? `דוח משולב (${reviewSections.length}) מוכן! 🚀` : 'הדוח מוכן! 🚀'}</h3>
                <button onClick={regenerateReport} className="text-xs font-black text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">↺ צור מחדש</button>
              </div>
              <p className="text-xs text-gray-500 font-bold -mt-2">אפשר לערוך את הטקסט לפני השליחה · שפת הדוח: {language === 'en' ? 'English' : 'עברית'}</p>
              <textarea value={editableText} onChange={(e) => setEditableText(e.target.value)} className="w-full h-80 p-5 bg-gray-50 border-2 border-gray-200 rounded-2xl font-bold text-lg leading-relaxed" dir={language === 'en' ? 'ltr' : 'rtl'} aria-label="טקסט הדוח" />
              <div className="flex flex-col gap-3">
                <button onClick={() => handleWhatsApp(editableText, true)} disabled={!editableText.trim()} className="w-full py-5 rounded-2xl font-black text-lg shadow-md bg-green-600 text-white disabled:opacity-40">שלח בוואטסאפ 💬</button>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => handleShare(editableText, true)} disabled={!editableText.trim()} className="py-4 rounded-2xl font-black shadow-md bg-white border-2 border-green-600 text-green-700 disabled:opacity-40">שתף... 📤</button>
                  <button onClick={() => handleCopy(editableText, true)} disabled={!editableText.trim()} className={`py-4 rounded-2xl font-black shadow-md transition-all disabled:opacity-40 ${copySuccess ? 'bg-yellow-400 text-green-900' : 'bg-gray-800 text-white'}`}>
                    {copySuccess ? 'הועתק! ✅' : 'העתק 📋'}
                  </button>
                </div>
                {!reportSent && allProjects.length > reviewSections.length && (
                  <button onClick={addAnotherProject} className="w-full py-3 rounded-2xl font-black border-2 border-dashed border-gray-300 text-gray-600">➕ הוסף פרויקט נוסף לדוח</button>
                )}
                <button onClick={() => setView('form')} className="w-full text-gray-500 font-bold py-2">→ חזור לעריכה</button>
              </div>
            </div>

            {reportSent && (
              <div className="bg-green-50 border-2 border-green-200 p-5 rounded-[24px] space-y-3 animate-in">
                <p className="font-black text-green-900">הדוח נשמר בהיסטוריה ✔️</p>
                <p className="text-sm text-green-800 font-bold">להתחיל דוח חדש? הפרויקט, הגרסה, ההתקדמות, הצפי והנושאים הפתוחים יישמרו.</p>
                <button onClick={startNextReport} className="w-full bg-green-600 text-white font-black py-4 rounded-2xl">התחל דוח חדש</button>
              </div>
            )}
          </div>
        )}
      </main>

      {toast && (
        <div role="status" className={`safe-bottom-toast fixed left-4 right-4 max-w-md mx-auto p-4 rounded-2xl shadow-lg z-[250] text-center font-bold animate-in ${toast.tone === 'error' ? 'bg-red-600 text-white' : 'bg-gray-900/90 text-white'}`}>
          {toast.text}
        </div>
      )}
    </div>
  );
};

export default App;
