
import React, { useMemo, useState } from 'react';
import { FormData, HistoryEntry, ReportLanguage } from '../types';
import { formatDate, formatShortDate, parseIsoDate, STATUS_EMOJI, toNumberField } from '../services/offlineReportService';
import { dayNumber, fromDayNumber, Forecast, forecastCompletion, generateWeeklySummary, ProgressPoint, projectSeries, projectsWithData, weekRange } from '../services/insights';

interface InsightsPanelProps {
  history: HistoryEntry[];
  currentForm: FormData;
  language: ReportLanguage;
  onCopy: (text: string) => void;
  onShare: (text: string) => void;
  onClose: () => void;
}

const STATUS_COLOR = { ok: '#16a34a', risk: '#eab308', blocked: '#dc2626' };

const ProgressChart: React.FC<{ series: ProgressPoint[]; forecast: Forecast; deadline: string }> = ({ series, forecast, deadline }) => {
  const W = 320, H = 180, L = 34, R = 12, T = 12, B = 26;
  const first = series[0].day;
  const deadlineDate = parseIsoDate(deadline);
  const deadlineDay = deadlineDate ? dayNumber(deadlineDate) : null;
  const forecastDay = forecast.kind === 'projected' ? dayNumber(forecast.date) : null;
  const last = series[series.length - 1];
  // look ahead at most as far as the history goes back (min. two weeks), so a slow forecast doesn't squash the points
  const cap = last.day + Math.max(14, last.day - first);
  const lastDay = Math.max(last.day, Math.min(cap, forecastDay ?? 0), Math.min(cap, deadlineDay ?? 0), first + 1);
  const x = (day: number) => L + ((day - first) / (lastDay - first)) * (W - L - R);
  const y = (p: number) => T + (1 - p / 100) * (H - T - B);
  // a forecast beyond the visible range is drawn up to the right edge
  const trendEnd = forecast.kind === 'projected' && forecastDay !== null
    ? forecastDay <= lastDay
      ? { day: forecastDay, progress: 100 }
      : { day: lastDay, progress: Math.min(100, last.progress + forecast.ratePerDay * (lastDay - last.day)) }
    : null;
  const fmt = (day: number) => formatShortDate(fromDayNumber(day));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="גרף התקדמות" dir="ltr" style={{ direction: 'ltr' }}>
      {[0, 50, 100].map(p => (
        <g key={p}>
          <line x1={L} x2={W - R} y1={y(p)} y2={y(p)} stroke="#9ca3af" strokeOpacity="0.3" strokeWidth="1" />
          <text x={L - 6} y={y(p) + 4} textAnchor="end" fontSize="10" fill="#9ca3af">{p}%</text>
        </g>
      ))}
      {deadlineDay !== null && deadlineDay >= first && deadlineDay <= lastDay && (
        <g>
          <line x1={x(deadlineDay)} x2={x(deadlineDay)} y1={T} y2={H - B} stroke="#dc2626" strokeDasharray="4 3" strokeWidth="1.5" />
          <text x={x(deadlineDay)} y={H - 8} textAnchor="middle" fontSize="10" fill="#dc2626">{fmt(deadlineDay)}</text>
        </g>
      )}
      {trendEnd && trendEnd.day > last.day && (
        <line x1={x(last.day)} y1={y(last.progress)} x2={x(trendEnd.day)} y2={y(trendEnd.progress)} stroke="#16a34a" strokeOpacity="0.6" strokeDasharray="5 4" strokeWidth="2" />
      )}
      <polyline fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinejoin="round" points={series.map(p => `${x(p.day)},${y(p.progress)}`).join(' ')} />
      {series.map(p => <circle key={p.day} cx={x(p.day)} cy={y(p.progress)} r="4" fill={STATUS_COLOR[p.status]} stroke="#ffffff" strokeWidth="1.5" />)}
      <text x={L} y={H - 8} textAnchor="start" fontSize="10" fill="#9ca3af">{fmt(first)}</text>
      {deadlineDay !== lastDay && <text x={W - R} y={H - 8} textAnchor="end" fontSize="10" fill="#9ca3af">{fmt(lastDay)}</text>}
    </svg>
  );
};

// Open bugs per report day: falling means the product is stabilising
const BugsChart: React.FC<{ series: ProgressPoint[] }> = ({ series }) => {
  const points = series.filter(p => p.openBugs !== null) as (ProgressPoint & { openBugs: number })[];
  if (points.length < 2) {
    return <p className="text-gray-500 font-bold text-center py-4 text-sm">הגרף יופיע אחרי שני דוחות עם מספר באגים פתוחים.</p>;
  }
  const W = 320, H = 130, L = 34, R = 12, T = 14, B = 22;
  const first = points[0].day, lastDay = Math.max(points[points.length - 1].day, first + 1);
  const max = Math.max(5, ...points.map(p => p.openBugs)) * 1.15;
  const x = (day: number) => L + ((day - first) / (lastDay - first)) * (W - L - R);
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const start = points[0].openBugs, end = points[points.length - 1].openBugs;
  return (
    <div className="space-y-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="גרף באגים פתוחים" dir="ltr" style={{ direction: 'ltr' }}>
        <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="#9ca3af" strokeOpacity="0.3" />
        <text x={L - 6} y={y(0) + 4} textAnchor="end" fontSize="10" fill="#9ca3af">0</text>
        <polyline fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinejoin="round" points={points.map(p => `${x(p.day)},${y(p.openBugs)}`).join(' ')} />
        {points.map(p => <circle key={p.day} cx={x(p.day)} cy={y(p.openBugs)} r="3.5" fill="#dc2626" stroke="#ffffff" strokeWidth="1.5" />)}
        <text x={x(first)} y={y(start) - 8} textAnchor="start" fontSize="11" fontWeight="700" fill="#9ca3af">{start}</text>
        <text x={x(points[points.length - 1].day)} y={y(end) - 8} textAnchor="end" fontSize="11" fontWeight="700" fill="#dc2626">{end}</text>
        <text x={L} y={H - 6} textAnchor="start" fontSize="10" fill="#9ca3af">{formatShortDate(fromDayNumber(first))}</text>
        <text x={W - R} y={H - 6} textAnchor="end" fontSize="10" fill="#9ca3af">{formatShortDate(fromDayNumber(points[points.length - 1].day))}</text>
      </svg>
      <p className={`text-sm font-black ${end < start ? 'text-green-700' : end > start ? 'text-orange-600' : 'text-gray-500'}`}>
        {end < start ? `📉 יורד: ${start} → ${end}. המוצר מתייצב` : end > start ? `📈 עולה: ${start} → ${end}. נפתחים יותר באגים ממה שנסגרים` : `➖ יציב על ${end}`}
      </p>
    </div>
  );
};

const InsightsPanel: React.FC<InsightsPanelProps> = ({ history, currentForm, language, onCopy, onShare, onClose }) => {
  const projects = useMemo(() => projectsWithData(history), [history]);
  const [project, setProject] = useState(() => (projects.includes(currentForm.projectName) ? currentForm.projectName : projects[0] ?? ''));
  const [weekOffset, setWeekOffset] = useState(0);

  const series = useMemo(() => projectSeries(history, project), [history, project]);
  const latestDeadline = project === currentForm.projectName
    ? currentForm.estimatedCompletion
    : [...history].map(e => e.items?.find(i => i.projectName === project)).find(Boolean)?.deadline ?? '';
  const todayPoint = project === currentForm.projectName && currentForm.progressPercentage !== ''
    ? { date: new Date(), progress: parseInt(toNumberField(currentForm.progressPercentage, 100) || '0', 10) }
    : null;
  const forecast = forecastCompletion(series, latestDeadline, todayPoint);

  // late forecasts for every project, so the weekly summary can flag them too
  const lateForecasts = useMemo(() => {
    const notes: Record<string, Date | undefined> = {};
    for (const name of projects) {
      const deadline = [...history].map(e => e.items?.find(i => i.projectName === name)).find(Boolean)?.deadline ?? '';
      const f = forecastCompletion(projectSeries(history, name), deadline);
      if (f.kind === 'projected' && f.late) notes[name] = f.date;
    }
    return notes;
  }, [history, projects]);

  const { start, end } = weekRange(new Date(), weekOffset);
  const summary = generateWeeklySummary(history, start, end, language, weekOffset === 0 ? lateForecasts : {});

  const forecastBox = (() => {
    switch (forecast.kind) {
      case 'done': return <p className="text-green-700 font-black">✅ הפרויקט הגיע ל-100%</p>;
      case 'not-enough-data': return <p className="text-gray-500 font-bold">צריך דוחות משני ימים שונים לפחות כדי לחשב קצב.</p>;
      case 'stalled': return <p className="text-orange-600 font-black">⚠️ אין התקדמות בימים האחרונים, ולכן אי אפשר לחזות מועד סיום.</p>;
      case 'projected': return (
        <div className="space-y-1">
          <p className={`font-black ${forecast.late ? 'text-orange-600' : 'text-green-700'}`}>
            {forecast.late ? '⚠️' : '✅'} בקצב הנוכחי הסיום צפוי ב-{formatDate(forecast.date)}
          </p>
          <p className="text-xs text-gray-500 font-bold">
            קצב ממוצע: {forecast.ratePerDay.toFixed(1)}% ליום
            {forecast.late === true && ' · אחרי צפי הסיום'}
            {forecast.late === false && ' · לפני צפי הסיום'}
          </p>
        </div>
      );
    }
  })();

  return (
    <div className="space-y-5 animate-in">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-gray-900">התקדמות וסיכומים</h2>
        <button onClick={onClose} className="bg-white border border-gray-300 text-xs font-black py-2.5 px-5 rounded-full active:scale-95">→ חזרה</button>
      </div>

      <div className="bg-white p-5 rounded-[24px] border border-gray-200 shadow-sm space-y-4">
        <div className="border-r-4 border-green-600 pr-3"><h3 className="text-lg font-black text-gray-900">גרף התקדמות</h3></div>
        {projects.length === 0 ? (
          <p className="text-gray-500 font-bold text-center py-6">עדיין אין נתונים. הגרף נבנה מכל דוח שתשלח מעכשיו.</p>
        ) : (
          <>
            <select value={project} onChange={e => setProject(e.target.value)} className="w-full p-3 bg-white border-2 border-gray-300 rounded-2xl font-bold text-right" aria-label="פרויקט">
              {projects.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            {series.length > 0 ? (
              <>
                <ProgressChart series={series} forecast={forecast} deadline={latestDeadline} />
                <div className="flex flex-wrap gap-3 text-xs font-bold text-gray-500 justify-center">
                  <span>{STATUS_EMOJI.ok} תקין</span><span>{STATUS_EMOJI.risk} בסיכון</span><span>{STATUS_EMOJI.blocked} חסום</span>
                  <span className="text-red-600">┊ צפי סיום</span><span className="text-green-700">╌ תחזית</span>
                </div>
              </>
            ) : (
              <p className="text-gray-500 font-bold text-center py-4">אין דוחות שמורים לפרויקט הזה.</p>
            )}
            <div className="bg-gray-50 rounded-2xl p-4">{forecastBox}</div>
          </>
        )}
      </div>

      {projects.length > 0 && (
        <div className="bg-white p-5 rounded-[24px] border border-gray-200 shadow-sm space-y-3">
          <div className="border-r-4 border-red-600 pr-3"><h3 className="text-lg font-black text-gray-900">באגים פתוחים · {project}</h3></div>
          <BugsChart series={series} />
        </div>
      )}

      <div className="bg-white p-5 rounded-[24px] border border-gray-200 shadow-sm space-y-4">
        <div className="border-r-4 border-green-600 pr-3"><h3 className="text-lg font-black text-gray-900">סיכום שבועי</h3></div>
        <div className="grid grid-cols-2 gap-2">
          {[0, -1].map(offset => (
            <button
              key={offset}
              onClick={() => setWeekOffset(offset)}
              className={`py-3 rounded-xl font-black text-sm border-2 ${weekOffset === offset ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200'}`}
            >{offset === 0 ? 'השבוע' : 'שבוע שעבר'}</button>
          ))}
        </div>
        <pre className="whitespace-pre-wrap break-words bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm font-bold text-gray-800 font-['Assistant']" dir={language === 'en' ? 'ltr' : 'rtl'}>{summary}</pre>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => onCopy(summary)} className="py-3 rounded-xl bg-gray-800 text-white font-black">העתק 📋</button>
          <button onClick={() => onShare(summary)} className="py-3 rounded-xl bg-green-600 text-white font-black">שתף 📤</button>
        </div>
      </div>
    </div>
  );
};

export default InsightsPanel;
