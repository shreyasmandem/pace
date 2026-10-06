// Writes an .ics with one all-day event per day of the Stripe × Amazon sprint (Oct 7 → Oct 30, 2026),
// built from the verified src/data/stripe-amazon.json. Usage: node data-pipeline/export-stripe-amazon-ics.mjs <out.ics>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || path.join(root, 'stripe-amazon-sprint.ics');
const track = JSON.parse(fs.readFileSync(path.join(root, 'src/data/stripe-amazon.json'), 'utf8'));
const notes = JSON.parse(fs.readFileSync(path.join(root, 'src/data/topic-notes.json'), 'utf8')).stripeAmazon;
const TRACK_URL = 'https://pace-one-navy.vercel.app/#/track/stripe-amazon';
const FIRST_DAY = Date.UTC(2026, 9, 7); // Oct 7, 2026

const ymd = (ms) => new Date(ms).toISOString().slice(0, 10).replace(/-/g, '');
const escape = (s) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
// RFC 5545: fold lines longer than 75 octets.
function fold(line) {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const parts = [];
  let start = 0;
  while (start < bytes.length) {
    let end = Math.min(start + (start === 0 ? 75 : 74), bytes.length);
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--; // don't split a UTF-8 character
    parts.push(bytes.subarray(start, end).toString('utf8'));
    start = end;
  }
  return parts.join('\r\n ');
}

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Pace//Stripe x Amazon Sprint//EN', 'CALSCALE:GREGORIAN'];

track.groups.forEach((group, i) => {
  const day = FIRST_DAY + i * 86400000;
  // "Day 1 · Wed Oct 7 — Arrays & hashing · Linear regression" → "S×A Day 1 · Arrays & hashing · Linear regression"
  const [lead, topic] = group.title.split(' — ');
  const label = lead.split(' · ')[0];
  const summary = `S×A ${label}${topic ? ` · ${topic}` : ''}`;
  const checklist = group.problems.map((p) => `• ${p.title} (${p.difficulty})`).join('\n');
  const description = `${notes[group.id] || ''}\n\nChecklist:\n${checklist}\n\nOpen in Pace: ${TRACK_URL}`;
  lines.push(
    'BEGIN:VEVENT',
    `UID:pace-stripe-amazon-${group.id}@pace-one-navy.vercel.app`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${ymd(day)}`,
    `DTEND;VALUE=DATE:${ymd(day + 86400000)}`,
    fold(`SUMMARY:${escape(summary)}`),
    fold(`DESCRIPTION:${escape(description)}`),
    'TRANSP:TRANSPARENT',
    'END:VEVENT'
  );
});
lines.push('END:VCALENDAR');

fs.writeFileSync(out, lines.join('\r\n') + '\r\n');
console.log(`Wrote ${track.groups.length} events → ${out}`);
console.log(track.groups.map((g, i) => `  ${ymd(FIRST_DAY + i * 86400000)}  ${g.title}`).join('\n'));
