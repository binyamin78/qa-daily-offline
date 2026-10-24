
import { HistoryEntry, ReportItem } from '../types';

// Calendar-day number that ignores DST shifts
export const dayNumber = (d: Date) => Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);

export const fromDayNumber = (n: number) => {
  const u = new Date(n * 86_400_000);
  return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate());
};

export interface DayItem {
  day: number;
  at: number;
  item: ReportItem;
}

// Latest report item per day for one project, oldest first
export const projectDays = (history: HistoryEntry[], projectName: string): DayItem[] => {
  const byDay = new Map<number, DayItem>();
  for (const entry of history) {
    const at = new Date(entry.createdAt).getTime();
    if (isNaN(at)) continue;
    for (const item of entry.items ?? []) {
      if (item.projectName !== projectName) continue;
      const day = dayNumber(new Date(at));
      const prev = byDay.get(day);
      if (!prev || prev.at < at) byDay.set(day, { day, at, item });
    }
  }
  return [...byDay.values()].sort((a, b) => a.day - b.day);
};
