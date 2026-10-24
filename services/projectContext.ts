
import { FormData, HistoryEntry, ReportItem } from '../types';
import { projectDays } from './days';
import { blockerAges, computeChange, itemTestStats, OLD_BLOCKER_DAYS, previousReport, splitBlockers, toReportItem } from './daily';
import { Forecast, forecastCompletion, projectSeries } from './insights';
import { daysUntil, isSameDay, SectionExtras } from './offlineReportService';

// Everything history adds to one project's section of today's report
export const sectionContext = (history: HistoryEntry[], f: FormData, now: Date = new Date()) => {
  const previous = previousReport(history, f.projectName, now);
  const previousOpen = previous?.item.openBugs ?? null;
  const item = toReportItem(f, previousOpen);
  const forecast = forecastCompletion(projectSeries(history, f.projectName), f.estimatedCompletion, { date: now, progress: item.progress });
  const blockers = splitBlockers(f.blockers);
  const ages = blockerAges(history, f.projectName, blockers, now);
  const extras: SectionExtras = {
    lateForecast: forecast.kind === 'projected' && forecast.late ? forecast.date : undefined,
    change: computeChange(history, item, now),
    openBugs: item.openBugs,
    tests: itemTestStats(item),
    blockers: blockers.map(text => ({ text, age: ages[text] })),
  };
  return { item, forecast, extras, previousOpen };
};

export interface ProjectOverview {
  name: string;
  item: ReportItem | null;
  isDraft: boolean;
  sentToday: boolean;
  daysToDeadline: number | null;
  forecast: Forecast | null;
  oldBlockers: number;
}

// One card per project for the "today" dashboard: the unsent draft if there is one, else the last report
export const todayOverview = (projects: string[], history: HistoryEntry[], draft: FormData, combined: FormData[], now: Date = new Date()): ProjectOverview[] =>
  projects.map(name => {
    const sentToday = history.some(e => isSameDay(new Date(e.createdAt), now) && e.items?.some(i => i.projectName === name));
    const form = name === draft.projectName ? draft : combined.find(s => s.projectName === name);
    if (form) {
      const ctx = sectionContext(history, form, now);
      return {
        name, item: ctx.item, isDraft: true, sentToday,
        daysToDeadline: daysUntil(ctx.item.deadline, now),
        forecast: ctx.forecast,
        oldBlockers: (ctx.extras.blockers ?? []).filter(b => b.age >= OLD_BLOCKER_DAYS).length,
      };
    }
    const days = projectDays(history, name);
    const last = days[days.length - 1];
    if (!last) return { name, item: null, isDraft: false, sentToday: false, daysToDeadline: null, forecast: null, oldBlockers: 0 };
    const blockers = splitBlockers(last.item.blockers);
    const ages = blockerAges(history, name, blockers, now);
    return {
      name, item: last.item, isDraft: false, sentToday,
      daysToDeadline: daysUntil(last.item.deadline, now),
      forecast: forecastCompletion(projectSeries(history, name), last.item.deadline),
      oldBlockers: blockers.filter(b => ages[b] >= OLD_BLOCKER_DAYS).length,
    };
  });
