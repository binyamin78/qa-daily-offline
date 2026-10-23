
import React, { useState } from 'react';
import { AppSettings } from '../types';
import { formatVersion } from '../services/offlineReportService';

interface SettingsModalProps {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  onProjectRemoved: (name: string) => void;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onChange, onProjectRemoved, onClose }) => {
  const [newProjectName, setNewProjectName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const addProject = () => {
    const name = newProjectName.trim();
    if (!name) return;
    if (settings.customProjects.some(p => p.toLowerCase() === name.toLowerCase())) {
      setAddError('הפרויקט כבר קיים ברשימה');
      return;
    }
    onChange({ ...settings, customProjects: [...settings.customProjects, name] });
    setNewProjectName('');
    setAddError(null);
  };

  const deleteProject = (name: string) => {
    onChange({ ...settings, customProjects: settings.customProjects.filter(p => p !== name) });
    onProjectRemoved(name);
    setPendingDelete(null);
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/40 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full max-w-sm rounded-[32px] p-8 animate-in shadow-2xl overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" dir="rtl">
        <h3 className="text-2xl font-black mb-6 text-right">הגדרות</h3>
        <div className="space-y-6">
          <div>
            <label htmlFor="defaultVersion" className="block text-sm font-bold text-gray-600 mb-2 text-right">גרסת ברירת מחדל</label>
            <input
              id="defaultVersion"
              type="text"
              inputMode="decimal"
              value={settings.defaultVersion}
              onChange={e => onChange({ ...settings, defaultVersion: formatVersion(e.target.value) })}
              className="w-full p-3 bg-gray-50 border-2 rounded-xl font-bold text-right"
              placeholder="1.2.3"
            />
            <p className="text-xs text-gray-400 font-bold mt-1 text-right">ממולאת אוטומטית בכל דוח חדש</p>
          </div>
          <div className="pt-4 border-t">
            <label htmlFor="newProject" className="block text-sm font-bold text-gray-600 mb-2 text-right">רשימת פרויקטים</label>
            <div className="flex gap-2 mb-1">
              <input
                id="newProject"
                type="text"
                value={newProjectName}
                maxLength={60}
                onChange={e => { setNewProjectName(e.target.value); setAddError(null); }}
                onKeyDown={e => { if (e.key === 'Enter') addProject(); }}
                enterKeyHint="done"
                placeholder="שם הפרויקט..."
                className={`flex-1 min-w-0 p-3 bg-gray-50 border-2 rounded-xl text-right font-bold ${addError ? 'border-red-400' : ''}`}
              />
              <button onClick={addProject} disabled={!newProjectName.trim()} aria-label="הוסף פרויקט" className="bg-green-600 text-white px-5 rounded-xl font-black text-xl disabled:opacity-40">+</button>
            </div>
            {addError && <p className="text-xs text-red-600 font-bold text-right mb-2">{addError}</p>}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 mt-3">
              {settings.customProjects.length > 0 ? settings.customProjects.map(p => (
                <div key={p} className="flex justify-between items-center gap-2 bg-gray-50 p-3 rounded-xl border border-gray-200">
                  <span className="font-bold truncate text-right flex-1 text-gray-800">{p}</span>
                  {pendingDelete === p ? (
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => deleteProject(p)} className="text-white text-xs font-black px-3 py-1.5 bg-red-600 rounded-lg">מחק</button>
                      <button onClick={() => setPendingDelete(null)} className="text-gray-600 text-xs font-black px-3 py-1.5 bg-gray-200 rounded-lg">ביטול</button>
                    </div>
                  ) : (
                    <button onClick={() => setPendingDelete(p)} className="shrink-0 text-red-500 text-xs font-black px-3 py-1.5 bg-red-50 rounded-lg border border-red-100 active:scale-90">מחק</button>
                  )}
                </div>
              )) : (
                <p className="text-center text-gray-400 py-4 font-bold italic">אין פרויקטים ברשימה</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="w-full bg-gray-900 text-white py-4 rounded-2xl font-black shadow-lg">סגור</button>
          <p className="text-center text-xs text-gray-400 font-bold">QA Daily Offline · גרסה {__APP_VERSION__}</p>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
