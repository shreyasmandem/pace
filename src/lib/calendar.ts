import type { PlanItem } from '../state/store';

/**
 * Formats a Date object into Google Calendar / iCal compact ISO string:
 * YYYYMMDDTHHmmSSZ
 */
function toCalendarDateString(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Creates a 1-click Google Calendar Web Intent URL for a planned day.
 */
export function createGoogleCalendarUrl(
  day: string,
  items: PlanItem[],
  startHour = 9,
  durationHours = 2
): string {
  const problemsList = items
    .map((item, idx) => {
      const link = item.links?.leetcode || item.links?.codestudio || item.links?.gfg || '';
      return `${idx + 1}. [${item.difficulty || 'DSA'}] ${item.title}${link ? ` - ${link}` : ''}`;
    })
    .join('\n');

  const eventTitle =
    items.length === 1
      ? `🎯 Pace DSA: ${items[0].title}`
      : `🎯 Pace DSA Study Session (${items.length} problems)`;

  const details = [
    'Pace DSA Study Session & Daily Roadmap',
    '────────────────────────────────────────',
    problemsList,
    '',
    '• Interactive Planner: https://pace-one-navy.vercel.app/#/planner',
    '• Study Mentor: Ask Pacer for intuition & Python hints inside the app.',
  ].join('\n');

  // Construct start and end time in local time
  const [year, month, dateNum] = day.split('-').map(Number);
  const start = new Date(year, month - 1, dateNum, startHour, 0, 0);
  const end = new Date(start.getTime() + durationHours * 3600 * 1000);

  const datesParam = `${toCalendarDateString(start)}/${toCalendarDateString(end)}`;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: eventTitle,
    details,
    location: 'Pace DSA Platform',
    dates: datesParam,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generates an RFC 5545 compliant iCalendar (.ics) string for a single day.
 */
export function generateIcsCalendar(
  day: string,
  items: PlanItem[],
  startHour = 9,
  durationHours = 2
): string {
  const [year, month, dateNum] = day.split('-').map(Number);
  const start = new Date(year, month - 1, dateNum, startHour, 0, 0);
  const end = new Date(start.getTime() + durationHours * 3600 * 1000);

  const summary =
    items.length === 1
      ? `Pace DSA: ${items[0].title}`
      : `Pace DSA: ${items.length} Problems (${items[0]?.topicTitle || 'Practice'})`;

  const description = items
    .map((item, idx) => `${idx + 1}. [${item.difficulty || 'DSA'}] ${item.title}`)
    .join('\\n');

  const uid = `pace-${day}-${Date.now()}@pace.app`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pace DSA//Roadmap Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toCalendarDateString(new Date())}`,
    `DTSTART:${toCalendarDateString(start)}`,
    `DTEND:${toCalendarDateString(end)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}\\n\\nOpen Pace: https://pace-one-navy.vercel.app/#/planner`,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder: Pace DSA Study Session',
    'TRIGGER:-PT15M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/**
 * Generates an RFC 5545 compliant multi-event .ics file for a full schedule.
 */
export function generateWeekIcsCalendar(
  schedule: Record<string, PlanItem[]>,
  startHour = 9,
  durationHours = 2
): string {
  const events: string[] = [];

  for (const [day, items] of Object.entries(schedule)) {
    if (!items || items.length === 0) continue;

    const [year, month, dateNum] = day.split('-').map(Number);
    const start = new Date(year, month - 1, dateNum, startHour, 0, 0);
    const end = new Date(start.getTime() + durationHours * 3600 * 1000);

    const summary =
      items.length === 1
        ? `Pace DSA: ${items[0].title}`
        : `Pace DSA: ${items.length} Problems (${items[0]?.topicTitle || 'Practice'})`;

    const description = items
      .map((item, idx) => `${idx + 1}. [${item.difficulty || 'DSA'}] ${item.title}`)
      .join('\\n');

    const uid = `pace-${day}-${Math.random().toString(36).slice(2, 8)}@pace.app`;

    events.push(
      [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${toCalendarDateString(new Date())}`,
        `DTSTART:${toCalendarDateString(start)}`,
        `DTEND:${toCalendarDateString(end)}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}\\n\\nOpen Pace: https://pace-one-navy.vercel.app/#/planner`,
        'STATUS:CONFIRMED',
        'TRANSP:OPAQUE',
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        'DESCRIPTION:Pace DSA Study Block',
        'TRIGGER:-PT15M',
        'END:VALARM',
        'END:VEVENT',
      ].join('\r\n')
    );
  }

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pace DSA//Roadmap Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
}

/**
 * Triggers a browser download of an .ics calendar file.
 */
export function downloadIcsFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generates a clean Markdown study checklist formatted for Notion, Obsidian, or GitHub.
 */
export function generateMarkdownPlan(day: string, items: PlanItem[]): string {
  const dateObj = new Date(day + 'T00:00:00');
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const lines = [
    `### 🎯 Pace DSA Study Plan — ${formattedDate}`,
    '',
    `| Status | Problem | Difficulty | Topic | Links |`,
    `|:------:|:--------|:----------:|:------|:------|`,
  ];

  for (const item of items) {
    const status = item.completed ? '✅ Done' : '⬜ Pending';
    const link = item.links?.leetcode
      ? `[LeetCode](${item.links.leetcode})`
      : item.links?.gfg
      ? `[GFG](${item.links.gfg})`
      : '—';

    lines.push(`| ${status} | ${item.title} | ${item.difficulty || 'DSA'} | ${item.topicTitle} | ${link} |`);
  }

  lines.push('');
  lines.push(`*Created with [Pace DSA Tracker](https://pace-one-navy.vercel.app)*`);

  return lines.join('\n');
}
