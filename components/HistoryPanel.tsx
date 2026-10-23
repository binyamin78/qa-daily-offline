
import React, { useState } from 'react';
import { HistoryEntry } from '../types';
import { formatDateTime } from '../services/offlineReportService';

interface HistoryPanelProps {
  entries: HistoryEntry[];
  onCopy: (text: string) => void;
  onShare: (text: string) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onClose: () => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ entries, onCopy, onShare, onDelete, onClearAll, onClose }) => {
  const [openId, setOpenId] = useState<string | null>(entries[0]?.id ?? null);
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <div className="space-y-4 animate-in">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-gray-900">היסטוריית דוחות</h2>
        <button onClick={onClose} className="bg-white border border-gray-300 text-xs font-black py-2.5 px-5 rounded-full active:scale-95">→ חזרה</button>
      </div>

      {entries.length === 0 ? (
        <div className="bg-white p-8 rounded-[24px] border border-gray-200 text-center text-gray-400 font-bold">
          עדיין אין דוחות שמורים.<br />דוח נשמר כאן אוטומטית אחרי שמעתיקים או משתפים אותו.
        </div>
      ) : (
        <>
          {entries.map(entry => {
            const isOpen = openId === entry.id;
            return (
              <div key={entry.id} className="bg-white rounded-[24px] border border-gray-200 shadow-sm overflow-hidden">
                <button onClick={() => setOpenId(isOpen ? null : entry.id)} className="w-full flex items-center justify-between gap-3 p-4 text-right" aria-expanded={isOpen}>
                  <div className="min-w-0">
                    <p className="font-black text-gray-900 truncate">{entry.projectName || 'ללא פרויקט'}</p>
                    <p className="text-xs text-gray-500 font-bold" dir="ltr">{formatDateTime(new Date(entry.createdAt))}</p>
                  </div>
                  <span className="text-gray-400 font-black shrink-0">{isOpen ? '▲' : '▼'}</span>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 space-y-3">
                    <pre className="whitespace-pre-wrap break-words bg-gray-50 border rounded-2xl p-4 text-sm font-bold text-gray-800 text-right font-['Assistant']">{entry.text}</pre>
                    <div className="grid grid-cols-3 gap-2">
                      <button onClick={() => onCopy(entry.text)} className="py-3 rounded-xl bg-gray-800 text-white text-sm font-black">העתק</button>
                      <button onClick={() => onShare(entry.text)} className="py-3 rounded-xl bg-green-600 text-white text-sm font-black">שתף</button>
                      <button onClick={() => onDelete(entry.id)} className="py-3 rounded-xl bg-red-50 text-red-600 border border-red-100 text-sm font-black">מחק</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {!confirmClear ? (
            <button onClick={() => setConfirmClear(true)} className="w-full text-red-500 font-bold py-3">מחק את כל ההיסטוריה</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => { onClearAll(); setConfirmClear(false); }} className="flex-1 bg-red-600 text-white font-black py-3 rounded-2xl">כן, מחק הכל</button>
              <button onClick={() => setConfirmClear(false)} className="flex-1 bg-gray-100 text-gray-600 font-black py-3 rounded-2xl">ביטול</button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default HistoryPanel;
