// Compiles the original topic-notes source into src/data/topic-notes.json,
// and validates every A2Z key actually exists in the generated a2z.json so a
// typo'd id doesn't silently vanish.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { a2zNotes, neetcodeNotes } from './topic-notes-source.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';

function build() {
  const a2z = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/a2z.json'), 'utf8'));
  const validIds = new Set(a2z.steps.flatMap((s) => s.subSteps.map((sub) => sub.id)));

  const badKeys = Object.keys(a2zNotes).filter((id) => !validIds.has(id));
  if (badKeys.length) {
    throw new Error(`[topic-notes] a2z note keys not found in a2z.json: ${badKeys.join(', ')}`);
  }
  const missing = [...validIds].filter((id) => !(id in a2zNotes));
  if (missing.length) {
    console.warn(`[topic-notes] a2z subSteps with no note yet: ${missing.join(', ')}`);
  }

  const out = { a2z: a2zNotes, neetcode: neetcodeNotes };
  fs.writeFileSync(path.join(ROOT, 'src/data/topic-notes.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(`[topic-notes] ${Object.keys(a2zNotes).length} a2z notes, ${Object.keys(neetcodeNotes).length} neetcode notes`);
}

build();
