// src/ 以下を1つの HTML（dist/index.html）にまとめる。外部依存なし。
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src');

const CORE_ORDER = [
  'ui.js', 'store.js', 'sim.js', 'patterns.js', 'views.js',
  'ledger.js', 'equation.js', 'quiz.js', 'calc.js', 'app.js',
];

const read = (p) => readFileSync(p, 'utf8');

// 引数: --out <path>（出力先。既定 dist/index.html） --chapters ch1,ch2（その章だけ入れる。prologue は常に入る）
const args = process.argv.slice(2);
const argOf = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const OUT = argOf('--out') ? join(process.cwd(), argOf('--out')) : join(ROOT, 'dist', 'index.html');
const ONLY = argOf('--chapters') ? new Set(['prologue', ...argOf('--chapters').split(',')]) : null;

const styles = readdirSync(join(SRC, 'styles')).filter((f) => f.endsWith('.css')).sort()
  .map((f) => `/* ${f} */\n${read(join(SRC, 'styles', f))}`).join('\n');

const scripts = [];
for (const f of CORE_ORDER) {
  const p = join(SRC, 'core', f);
  if (!existsSync(p)) { console.warn(`warn: src/core/${f} がありません（スキップ）`); continue; }
  scripts.push(`// core/${f}\n${read(p)}`);
}
for (const f of readdirSync(join(SRC, 'chapters')).filter((f) => f.endsWith('.js')).sort()) {
  if (ONLY && !ONLY.has(f.replace(/\.js$/, ''))) continue;
  scripts.push(`// chapters/${f}\n${read(join(SRC, 'chapters', f))}`);
}
scripts.push('RD.start();');

// </script> が中身に混ざると HTML が壊れるので念のため確認
for (const s of scripts) if (/<\/script/i.test(s)) throw new Error('スクリプト内に </script が含まれています');

const html = read(join(SRC, 'index.template.html'))
  .replace('<!--STYLES-->', () => `<style>\n${styles}\n</style>`)
  .replace('<!--SCRIPTS-->', () => `<script>\n"use strict";\n${scripts.join('\n\n')}\n</script>`);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html);
console.log(`${OUT} (${(html.length / 1024).toFixed(1)} KB)`);
