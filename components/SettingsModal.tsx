
import React, { useState } from 'react';
import { AppSettings, ReportLanguage, ThemeMode } from '../types';
import { formatVersion } from '../services/offlineReportService';
import { DEFAULT_TEMPLATES } from '../services/storage';
import { isNative } from '../services/shareService';
import { ReminderResult } from '../services/reminderService';

interface SettingsModalProps {
  settings: AppSettings;
  reminderState: ReminderResult | null;
  onChange: (settings: AppSettings) => void;
  onProjectRemoved: (name: string) => void;
  onClose: () => void;
}

interface ListEditorProps {
  id: string;
  label: string;
  items: string[];
  placeholder: string;
  emptyText: string;
  duplicateText: string;
  confirmDelete?: boolean;
  onChange: (items: string[]) => void;
  onRemoved?: (item: string) => void;
}

const ListEditor: React.FC<ListEditorProps> = ({ id, label, items, placeholder, emptyText, duplicateText, confirmDelete, onChange, onRemoved }) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const add = () => {
    const name = value.trim();
    if (!name) return;
    if (items.some(p => p.toLowerCase() === name.toLowerCase())) {
      setError(duplicateText);
      return;
    }
    onChange([...items, name]);
    setValue('');
    setError(null);
  };

  const remove = (item: string) => {
    onChange(items.filter(p => p !== item));
    onRemoved?.(item);
    setPendingDelete(null);
  };

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold text-gray-600 mb-2 text-right">{label}</label>
      <div className="flex gap-2 mb-1">
        <input
          id={id}
          type="text"
          value={value}
          maxLength={60}
          onChange={e => { setValue(e.target.value); setError(null); }}
          onKeyDown={e => { if (e.key === 'Enter') add(); }}
          enterKeyHint="done"
          placeholder={placeholder}
          className={`flex-1 min-w-0 p-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right font-bold ${error ? 'border-red-400' : ''}`}
        />
        <button onClick={add} disabled={!value.trim()} aria-label={`הוסף ל${label}`} className="bg-green-600 text-white px-5 rounded-xl font-black text-xl disabled:opacity-40">+</button>
      </div>
      {error && <p className="text-xs text-red-600 font-bold text-right mb-2">{error}</p>}
      <div className="space-y-2 max-h-48 overflow-y-auto pr-1 mt-3">
        {items.length > 0 ? items.map(p => (
          <div key={p} className="flex justify-between items-center gap-2 bg-gray-50 p-3 rounded-xl border border-gray-200">
            <span className="font-bold truncate text-right flex-1 text-gray-800">{p}</span>
            {confirmDelete && pendingDelete === p ? (
              <div className="flex gap-1 shrink-0">
                <button onClick={() => remove(p)} className="text-white text-xs font-black px-3 py-1.5 bg-red-600 rounded-lg">מחק</button>
                <button onClick={() => setPendingDelete(null)} className="text-gray-600 text-xs font-black px-3 py-1.5 bg-gray-200 rounded-lg">ביטול</button>
              </div>
            ) : (
              <button onClick={() => (confirmDelete ? setPendingDelete(p) : remove(p))} className="shrink-0 text-red-500 text-xs font-black px-3 py-1.5 bg-red-50 rounded-lg border border-red-100 active:scale-90">מחק</button>
            )}
          </div>
        )) : (
          <p className="text-center text-gray-400 py-4 font-bold italic">{emptyText}</p>
        )}
      </div>
    </div>
  );
};

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div>
      <p className="text-sm font-bold text-gray-600 mb-2 text-right">{label}</p>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label={label}>
        {options.map(o => (
          <button
            key={o.value}
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`py-2.5 rounded-xl text-sm font-black border-2 ${value === o.value ? 'bg-green-600 text-white border-green-600' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
          >{o.label}</button>
        ))}
      </div>
    </div>
  );
}

const DAY_LABELS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

const REMINDER_NOTE: Partial<Record<ReminderResult, string>> = {
  scheduled: '✅ התזכורת פעילה. היא לא תופיע ביום שבו כבר שלחת דוח.',
  denied: '⚠️ אין הרשאה להתראות. אפשר להפעיל אותה בהגדרות הטלפון → אפליקציות → QA Daily Offline → התראות.',
  error: '⚠️ לא הצלחנו לתזמן את התזכורת.',
};

const SettingsModal: React.FC<SettingsModalProps> = ({ settings, reminderState, onChange, onProjectRemoved, onClose }) => {
  const reminder = settings.reminder;
  const setReminder = (patch: Partial<AppSettings['reminder']>) => onChange({ ...settings, reminder: { ...reminder, ...patch } });

  return (
    <div className="fixed inset-0 z-[150] bg-black/40 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full max-w-sm rounded-[32px] p-7 animate-in shadow-2xl overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" dir="rtl">
        <h3 className="text-2xl font-black mb-6 text-right">הגדרות</h3>
        <div className="space-y-6">
          <ListEditor
            id="newProject"
            label="רשימת פרויקטים"
            items={settings.customProjects}
            placeholder="שם הפרויקט..."
            emptyText="אין פרויקטים ברשימה"
            duplicateText="הפרויקט כבר קיים ברשימה"
            confirmDelete
            onChange={customProjects => onChange({ ...settings, customProjects })}
            onRemoved={onProjectRemoved}
          />

          <div className="pt-4 border-t border-gray-200">
            <label htmlFor="defaultVersion" className="block text-sm font-bold text-gray-600 mb-2 text-right">גרסת ברירת מחדל</label>
            <input
              id="defaultVersion"
              type="text"
              inputMode="decimal"
              value={settings.defaultVersion}
              onChange={e => onChange({ ...settings, defaultVersion: formatVersion(e.target.value) })}
              className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-xl font-bold text-right"
              placeholder="1.2.3"
            />
            <p className="text-xs text-gray-400 font-bold mt-1 text-right">לפרויקט חדש שעוד לא דווח עליו</p>
          </div>

          <div className="pt-4 border-t border-gray-200 space-y-5">
            <Segmented<ReportLanguage>
              label="שפת הדוח"
              value={settings.reportLanguage}
              options={[{ value: 'he', label: 'עברית' }, { value: 'en', label: 'English' }]}
              onChange={reportLanguage => onChange({ ...settings, reportLanguage })}
            />
            <Segmented<ThemeMode>
              label="מראה"
              value={settings.theme}
              options={[{ value: 'system', label: 'אוטומטי' }, { value: 'light', label: 'בהיר' }, { value: 'dark', label: 'כהה' }]}
              onChange={theme => onChange({ ...settings, theme })}
            />
          </div>

          <div className="pt-4 border-t border-gray-200 space-y-3">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-sm font-bold text-gray-600">תזכורת יומית לשליחת דוח</span>
              <input type="checkbox" checked={reminder.enabled} onChange={e => setReminder({ enabled: e.target.checked })} className="w-6 h-6 accent-green-600" />
            </label>
            {reminder.enabled && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="reminderTime" className="text-sm font-bold text-gray-600">שעה</label>
                  <input id="reminderTime" type="time" value={reminder.time} onChange={e => e.target.value && setReminder({ time: e.target.value })} className="p-2 bg-gray-50 border-2 border-gray-200 rounded-xl font-bold" />
                </div>
                <div className="grid grid-cols-7 gap-1" aria-label="ימי תזכורת">
                  {DAY_LABELS.map((label, day) => {
                    const on = reminder.days.includes(day);
                    return (
                      <button
                        key={day}
                        aria-pressed={on}
                        onClick={() => setReminder({ days: on ? reminder.days.filter(d => d !== day) : [...reminder.days, day].sort() })}
                        className={`py-2 rounded-lg text-sm font-black border-2 ${on ? 'bg-green-600 text-white border-green-600' : 'bg-gray-50 text-gray-500 border-gray-200'}`}
                      >{label}</button>
                    );
                  })}
                </div>
                {!isNative() ? (
                  <p className="text-xs text-gray-400 font-bold">התזכורות פועלות רק באפליקציית האנדרואיד.</p>
                ) : reminderState && REMINDER_NOTE[reminderState] ? (
                  <p className="text-xs text-gray-500 font-bold">{REMINDER_NOTE[reminderState]}</p>
                ) : null}
              </>
            )}
          </div>

          <div className="pt-4 border-t border-gray-200">
            <ListEditor
              id="newTemplate"
              label="תבניות מהירות ל'אזורים שנבדקו'"
              items={settings.templates}
              placeholder="לדוגמה: בדיקות ביצועים"
              emptyText="אין תבניות"
              duplicateText="התבנית כבר קיימת"
              onChange={templates => onChange({ ...settings, templates })}
            />
            <button onClick={() => onChange({ ...settings, templates: DEFAULT_TEMPLATES })} className="mt-2 text-xs font-black text-gray-500 underline">שחזר תבניות ברירת מחדל</button>
          </div>

          <button onClick={onClose} className="w-full bg-gray-900 text-white py-4 rounded-2xl font-black shadow-lg">סגור</button>
          <p className="text-center text-xs text-gray-400 font-bold">QA Daily Offline · גרסה {__APP_VERSION__}</p>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
