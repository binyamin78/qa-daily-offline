
import { FormData } from "../types";

const pad = (n: number) => String(n).padStart(2, '0');

export const formatDate = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

export const formatDateTime = (d: Date) => `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const parseIsoDate = (iso: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

// Whole days from today to an ISO date (yyyy-mm-dd); negative when it's already past
export const daysUntil = (iso: string): number | null => {
  const target = parseIsoDate(iso);
  if (!target) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
};

// Digits and single dots only, e.g. "1.10.2" - multi-digit parts are allowed
export const formatVersion = (value: string) =>
  value.replace(/[^\d.]/g, '').replace(/\.{2,}/g, '.').replace(/^\./, '').slice(0, 20);

// Digits only, no leading zeros, capped at max ('' stays '' so the field can be cleared)
export const toNumberField = (value: string, max: number) => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return String(Math.min(max, parseInt(digits, 10)));
};

const describeDeadline = (iso: string) => {
  const date = parseIsoDate(iso);
  const days = daysUntil(iso);
  if (!date || days === null) return 'לא צוין';
  const when =
    days === 0 ? 'היום'
    : days === 1 ? 'מחר'
    : days > 1 ? `בעוד ${days} ימים`
    : days === -1 ? 'עבר אתמול'
    : `עבר לפני ${-days} ימים`;
  return `${formatDate(date)} (${when})`;
};

export const generateOfflineReport = (formData: FormData, now: Date = new Date()): string => {
  const version = formData.version.trim();
  return [
    `📅 *דיווח QA יומי* | ${formatDate(now)}`,
    '-----------------------',
    `🚀 *פרויקט:* ${formData.projectName.trim()}${version ? ` (גרסה ${version})` : ''}`,
    `📊 *התקדמות:* ${toNumberField(formData.progressPercentage, 100) || '0'}%`,
    `📅 *צפי סיום:* ${describeDeadline(formData.estimatedCompletion)}`,
    '',
    '✅ *בוצע היום:*',
    formData.checkedAreas.trim(),
    '',
    `🐞 *באגים חדשים (Jira):* ${toNumberField(formData.newJiraBugs, 999) || '0'}`,
    `🚫 *חוסמים:* ${formData.blockers.trim() || 'אין'}`,
    '',
    '📝 *נושאים פתוחים:*',
    formData.openIssues.trim() || 'אין',
    '-----------------------',
  ].join('\n');
};
