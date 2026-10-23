
import React, { useState, useEffect, useRef } from 'react';
import { App as CapApp } from '@capacitor/app';
import Header from './components/Header';
import { FormInput, NumberStepper } from './components/FormFields';
import ProgressPicker from './components/ProgressPicker';
import SettingsModal from './components/SettingsModal';
import HistoryPanel from './components/HistoryPanel';
import { FormData, AppSettings, HistoryEntry } from './types';
import { generateOfflineReport, formatVersion, toNumberField, daysUntil, isSameDay } from './services/offlineReportService';
import { loadSettings, saveSettings, loadDraft, saveDraft, emptyForm, loadHistory, saveHistory, HISTORY_LIMIT } from './services/storage';
import { copyText, shareText, openWhatsApp, isNative } from './services/shareService';

type View = 'form' | 'review' | 'history';
type Modal = 'settings' | 'progress' | null;
type Toast = { text: string; tone: 'info' | 'error' } | null;

const REQUIRED_FIELDS: (keyof FormData)[] = ['projectName', 'progressPercentage', 'estimatedCompletion', 'checkedAreas'];
const NUMBER_LIMITS: Partial<Record<keyof FormData, number>> = { newJiraBugs: 999, progressPercentage: 100 };
const REPORT_TITLE = 'דיווח QA יומי';

const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [formData, setFormData] = useState<FormData>(() => loadDraft(loadSettings()));
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);

  const [view, setView] = useState<View>('form');
  const [modal, setModal] = useState<Modal>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [validationErrors, setValidationErrors] = useState<(keyof FormData)[]>([]);
  const [editableText, setEditableText] = useState('');
  const [reviewSource, setReviewSource] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  const allProjects = settings.customProjects;

  useEffect(() => { saveDraft(formData); }, [formData]);
  useEffect(() => { saveSettings(settings); }, [settings]);
  useEffect(() => { saveHistory(history); }, [history]);

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
    const listener = CapApp.addListener('backButton', () => {
      if (!goBack.current()) CapApp.minimizeApp();
    });
    return () => {
      window.removeEventListener('keydown', onKey);
      listener.then(l => l.remove());
    };
  }, []);

  const notify = (text: string, tone: 'info' | 'error' = 'info') => setToast({ text, tone });

  const setField = (name: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    setValidationErrors(prev => prev.filter(f => f !== name));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const name = e.target.name as keyof FormData;
    let value = e.target.value;
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

  const executeClearForm = () => {
    setFormData(emptyForm(settings));
    setValidationErrors([]);
    setShowClearConfirm(false);
    setReportSent(false);
    notify("הטופס נוקה 🧹");
  };

  const handleProjectRemoved = (name: string) => {
    if (formData.projectName === name) setField('projectName', '');
  };

  const prepareForReview = () => {
    const missing = REQUIRED_FIELDS.filter(key => !formData[key].trim());
    if (missing.length > 0) {
      setValidationErrors(missing);
      notify("נא למלא את שדות החובה (*)", 'error');
      const first = document.querySelector<HTMLElement>(`[name="${missing[0]}"]`);
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      first?.focus({ preventScroll: true });
      return;
    }
    // Keep manual edits to the report text if the form hasn't changed since
    const source = JSON.stringify(formData);
    if (source !== reviewSource || !editableText) {
      setEditableText(generateOfflineReport(formData));
      setReviewSource(source);
    }
    setReportSent(false);
    setView('review');
  };

  const regenerateReport = () => {
    setEditableText(generateOfflineReport(formData));
    setReviewSource(JSON.stringify(formData));
  };

  // Called whenever a report leaves the app - one history entry per project per day
  const recordSent = (text: string) => {
    const now = new Date();
    setHistory(prev => {
      const rest = prev.filter(e => !(e.projectName === formData.projectName && isSameDay(new Date(e.createdAt), now)));
      const entry: HistoryEntry = { id: now.getTime().toString(36), createdAt: now.toISOString(), projectName: formData.projectName, text };
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
    setFormData(prev => ({ ...prev, checkedAreas: '', newJiraBugs: '0', blockers: 'אין' }));
    setEditableText('');
    setReviewSource('');
    setReportSent(false);
    setView('form');
    notify('מוכן לדוח הבא ✨');
  };

  const deadlineDays = daysUntil(formData.estimatedCompletion);
  const deadlineHint = deadlineDays === null ? null
    : deadlineDays < 0 ? <span className="text-orange-600">⚠️ התאריך שנבחר כבר עבר</span>
    : deadlineDays === 0 ? 'היום'
    : `עוד ${deadlineDays} ימים`;

  return (
    <div className="min-h-screen flex flex-col w-full max-w-lg mx-auto bg-gray-50 border-x border-gray-200 relative font-['Assistant'] overflow-x-hidden">
      <Header historyCount={history.length} onOpenHistory={() => setView('history')} onOpenSettings={() => setModal('settings')} />

      {modal === 'settings' && (
        <SettingsModal settings={settings} onChange={setSettings} onProjectRemoved={handleProjectRemoved} onClose={() => setModal(null)} />
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

        {view === 'form' && (
          <div className="space-y-6 animate-in">
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
                  {allProjects.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                {validationErrors.includes('projectName') && <p className="text-xs text-red-600 font-bold pr-1">שדה חובה</p>}
              </div>
              <FormInput name="version" label="גרסה" value={formData.version} isError={false} placeholder="1.2.3" inputMode="decimal" onChange={handleInputChange} isRequired={false} helper="לא חובה. ספרות ונקודות, לדוגמה 2.10.1" />
            </div>

            {/* סעיף 2: התקדמות וצפי */}
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

            {/* סעיף 3: מה נעשה היום */}
            <div className="bg-white p-5 rounded-[24px] border border-gray-200 shadow-sm space-y-6">
              <div className="border-r-4 border-green-600 pr-3 text-right"><h2 className="text-lg font-black text-gray-900">מה נבדק היום?</h2></div>
              <FormInput name="checkedAreas" label="אזורים שנבדקו" value={formData.checkedAreas} isError={validationErrors.includes('checkedAreas')} placeholder="פירוט תהליכים ומסכים..." isTextArea maxLength={2000} onChange={handleInputChange} helper="מה בדקת בפועל במהלך היום?" />
            </div>

            {/* סעיף 4: באגים וסיכונים */}
            <div className="bg-white p-5 rounded-[24px] border border-gray-200 shadow-sm space-y-6">
              <div className="border-r-4 border-red-600 pr-3 text-right"><h2 className="text-lg font-black text-gray-900">באגים וסיכונים</h2></div>
              <NumberStepper name="newJiraBugs" label="באגים חדשים ב-Jira" value={formData.newJiraBugs} isError={false} onUpdate={updateNumber} onChange={handleInputChange} max={999} isRequired={false} />
              <FormInput name="blockers" label="חוסמים (Blockers)" value={formData.blockers} isError={false} placeholder="פרט חוסמים או 'אין'" maxLength={500} onChange={handleInputChange} isRequired={false} helper="מה מפריע לך להתקדם?" />
              <FormInput name="openIssues" label="נושאים פתוחים" value={formData.openIssues} isError={false} placeholder="נושאים למעקב..." isTextArea maxLength={2000} onChange={handleInputChange} isRequired={false} helper="נשמרים גם לדוח של מחר." />
            </div>

            <button onClick={prepareForReview} className="w-full bg-green-600 text-white font-black py-6 rounded-[24px] shadow-xl active:scale-95 transition-all text-xl">תצוגה מקדימה וייצור דוח ✨</button>
          </div>
        )}

        {view === 'review' && (
          <div className="space-y-6 animate-in">
            <div className="bg-white p-6 rounded-[40px] border-4 border-green-600 shadow-2xl space-y-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xl font-black">הדוח מוכן! 🚀</h3>
                <button onClick={regenerateReport} className="text-xs font-black text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">↺ צור מחדש</button>
              </div>
              <p className="text-xs text-gray-500 font-bold -mt-2">אפשר לערוך את הטקסט לפני השליחה.</p>
              <textarea value={editableText} onChange={(e) => setEditableText(e.target.value)} className="w-full h-80 p-5 bg-gray-50 border-2 rounded-2xl font-bold text-lg text-right leading-relaxed" dir="rtl" aria-label="טקסט הדוח" />
              <div className="flex flex-col gap-3">
                <button onClick={() => handleWhatsApp(editableText, true)} disabled={!editableText.trim()} className="w-full py-5 rounded-2xl font-black text-lg shadow-md bg-green-600 text-white disabled:opacity-40">שלח בוואטסאפ 💬</button>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => handleShare(editableText, true)} disabled={!editableText.trim()} className="py-4 rounded-2xl font-black shadow-md bg-white border-2 border-green-600 text-green-700 disabled:opacity-40">שתף... 📤</button>
                  <button onClick={() => handleCopy(editableText, true)} disabled={!editableText.trim()} className={`py-4 rounded-2xl font-black shadow-md transition-all disabled:opacity-40 ${copySuccess ? 'bg-yellow-400 text-green-900' : 'bg-gray-800 text-white'}`}>
                    {copySuccess ? 'הועתק! ✅' : 'העתק 📋'}
                  </button>
                </div>
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
