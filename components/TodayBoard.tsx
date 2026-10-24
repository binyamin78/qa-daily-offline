
import React from 'react';
import { ProjectOverview } from '../services/projectContext';
import { formatShortDate, STATUS_EMOJI } from '../services/offlineReportService';

interface TodayBoardProps {
  overview: ProjectOverview[];
  currentProject: string;
  onSelect: (name: string) => void;
}

const deadlineText = (days: number | null) =>
  days === null ? null
  : days < 0 ? { text: `באיחור ${-days} ימים`, cls: 'text-red-600' }
  : days === 0 ? { text: 'היעד היום', cls: 'text-orange-600' }
  : { text: `עוד ${days} ימים`, cls: days <= 3 ? 'text-orange-600' : 'text-gray-500' };

const TodayBoard: React.FC<TodayBoardProps> = ({ overview, currentProject, onSelect }) => {
  const sent = overview.filter(o => o.sentToday).length;
  return (
    <section className="bg-white p-4 rounded-[24px] border border-gray-200 shadow-sm space-y-3" aria-label="המצב היום">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-gray-900">המצב היום</h2>
        <span className={`text-xs font-black px-2.5 py-1 rounded-full ${sent === overview.length ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
          נשלחו {sent}/{overview.length}
        </span>
      </div>
      <div className="space-y-2">
        {overview.map(o => {
          const deadline = deadlineText(o.daysToDeadline);
          const late = o.forecast?.kind === 'projected' && o.forecast.late ? o.forecast.date : null;
          const active = o.name === currentProject;
          return (
            <button
              key={o.name}
              onClick={() => onSelect(o.name)}
              aria-current={active}
              className={`w-full text-right p-3 rounded-2xl border-2 transition-all active:scale-[0.99] ${active ? 'border-green-600 bg-green-50' : 'border-gray-200 bg-gray-50'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-black text-gray-900 truncate">
                  {o.item ? STATUS_EMOJI[o.item.status] : '⚪'} {o.name}
                </span>
                <span className={`shrink-0 text-xs font-black ${o.sentToday ? 'text-green-700' : 'text-gray-400'}`}>
                  {o.sentToday ? '✓ דוח נשלח' : '⏳ עוד לא נשלח'}
                </span>
              </div>
              {o.item ? (
                <>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500" style={{ width: `${o.item.progress}%` }} />
                    </div>
                    <span className="text-xs font-black text-gray-700 w-10 text-left">{o.item.progress}%</span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs font-bold">
                    {deadline && <span className={deadline.cls}>📅 {deadline.text}</span>}
                    {late && <span className="text-orange-600">⚠️ בקצב הנוכחי: {formatShortDate(late)}</span>}
                    {o.item.openBugs !== null && <span className="text-gray-500">🐞 {o.item.openBugs} פתוחים</span>}
                    {o.oldBlockers > 0 && <span className="text-red-600">🚫 {o.oldBlockers} חוסמים ותיקים</span>}
                    {o.isDraft && !o.sentToday && <span className="text-gray-400">טיוטה</span>}
                  </div>
                </>
              ) : (
                <p className="text-xs text-gray-400 font-bold mt-1">אין דוחות עדיין</p>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default TodayBoard;
