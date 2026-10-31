// Reports raw Tailwind palette classes (bg-indigo-600, text-gray-500…) in src/.
// Screens must use semantic tokens instead (docs/ui_ux_specification.md §3, Appendix A).
// Warns by default; pass --strict to fail the run (from the end of migration phase 5).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const PALETTES = [
  'slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald',
  'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
];
// `neutral-*` is our own token ramp (§4.1), so it is allowed.
const BANNED = PALETTES.filter((p) => p !== 'neutral');
const PATTERN = new RegExp(`\\b(?:[a-z-]+:)*(?:bg|text|border|ring|outline|divide|from|via|to|fill|stroke|placeholder|accent|caret|decoration|shadow)-(?:${BANNED.join('|')})-\\d{2,3}\\b`, 'g');
const RAW_WHITE_BLACK = /\b(?:[a-z-]+:)*(?:bg|text|border)-(?:white|black)\b/g;

const strict = process.argv.includes('--strict');
const root = join(import.meta.dirname, '..', 'src');

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.(tsx?|css)$/.test(name) && !name.endsWith('index.css')) yield path;
  }
}

const perFile = [];
let total = 0;
for (const path of files(root)) {
  const text = readFileSync(path, 'utf8');
  const hits = [...(text.match(PATTERN) ?? []), ...(text.match(RAW_WHITE_BLACK) ?? [])];
  if (hits.length) {
    perFile.push([relative(root, path), hits.length]);
    total += hits.length;
  }
}

if (total === 0) {
  console.log('check-tokens: no raw palette classes.');
} else {
  perFile.sort((a, b) => b[1] - a[1]);
  for (const [file, count] of perFile) console.log(`${String(count).padStart(5)}  ${file}`);
  console.log(`check-tokens: ${total} raw palette classes in ${perFile.length} files${strict ? '' : ' (warning)'}.`);
}
process.exit(strict && total > 0 ? 1 : 0);
