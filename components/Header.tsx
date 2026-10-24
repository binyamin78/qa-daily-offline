import React from 'react';
import { formatDate } from '../services/offlineReportService';

interface HeaderProps {
  historyCount: number;
  onOpenInsights: () => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
}

const iconButton = "w-11 h-11 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 active:scale-90 transition-all text-xl relative";

const Header: React.FC<HeaderProps> = ({ historyCount, onOpenInsights, onOpenHistory, onOpenSettings }) => {
  return (
    <header className="safe-top bg-green-600 text-white px-6 pb-6 shadow-lg rounded-b-[32px] mb-2 relative" dir="rtl">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight" dir="ltr">QA Offline</h1>
          <p className="text-green-100 text-xs font-bold">דיווח יומי · {formatDate(new Date())}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={onOpenInsights} className={iconButton} aria-label="התקדמות וסיכומים">📊</button>
          <button onClick={onOpenHistory} className={iconButton} aria-label="היסטוריית דוחות">
            🕘
            {historyCount > 0 && (
              <span className="absolute -top-1 -left-1 min-w-5 h-5 px-1 rounded-full bg-yellow-400 text-green-900 text-[11px] font-black flex items-center justify-center">{historyCount}</span>
            )}
          </button>
          <button onClick={onOpenSettings} className={iconButton} aria-label="הגדרות">⚙️</button>
        </div>
      </div>
    </header>
  );
};

export default Header;
