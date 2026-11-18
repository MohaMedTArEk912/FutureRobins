import fs from 'fs';
import path from 'path';
const counts = new Map();
const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (p.endsWith('.tsx')) scan(p); } };
const add = (s) => { s = s.replace(/\s+/g, ' ').trim(); if (s.length < 2 || s.length > 70) return; if (/[{}=<>;]|=>|\bconst\b|\breturn\b|&[a-z]+;/.test(s)) return; if (!/[A-Za-z]{2}/.test(s)) return; counts.set(s, (counts.get(s) || 0) + 1); };
const scan = (p) => {
  const t = fs.readFileSync(p, 'utf8');
  for (const m of t.matchAll(/>([^<>{}\n][^<>{}]*?)</g)) add(m[1]);
  for (const m of t.matchAll(/(?:placeholder|title|aria-label|label)="([^"{}]{2,70})"/g)) add(m[1]);
  for (const m of t.matchAll(/(?:placeholder|title|label|message|text)[:=]\s*'([^'{}]{2,70})'/g)) add(m[1]);
};
walk('src');
const arr = [...counts.entries()].filter(([s]) => /^[A-Z]/.test(s)).sort((a, b) => b[1] - a[1]);
fs.writeFileSync('scratch_strings.txt', arr.map(([s, c]) => `${c}\t${s}`).join('\n'));
console.log(arr.length);
