// ビルドした dist/index.html を実ブラウザで開き、全ページを回ってエラーと横はみ出しを調べる。
// 使い方: node tests/smoke.mjs [--file dist/index.html] [--shots tests/out] [章id ...]
import { createRequire } from 'node:module';
// playwright はグローバルに入っているものを require で読む（ESM の import では見つからないため）
const { chromium } = createRequire(import.meta.url)('playwright');
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); if (i < 0) return def; const v = args[i + 1]; args.splice(i, 2); return v; };
const FILE = opt('--file', join(ROOT, 'dist', 'index.html'));
const OUT = opt('--shots', join(ROOT, 'tests', 'out'));
mkdirSync(OUT, { recursive: true });
const url = pathToFileURL(FILE.startsWith('/') ? FILE : join(process.cwd(), FILE)).href;

const browser = await chromium.launch();
let failed = false;
for (const vp of [{ name: 'pc', width: 1280, height: 900 }, { name: 'sp', width: 360, height: 740 }]) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  const ids = args.length ? args : await page.evaluate(() => RD.chapters.map((c) => c.id));
  for (const route of ['', ...ids.map((id) => 'c/' + id)]) {
    errors.length = 0;
    await page.goto(`${url}#/${route}`);
    await page.waitForTimeout(700);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const name = (route || 'top').replace('/', '-');
    await page.screenshot({ path: join(OUT, `${vp.name}-${name}.png`), fullPage: true });
    const problems = [...errors];
    if (overflow > 1) problems.push(`横にはみ出し ${overflow}px`);
    console.log(`${problems.length ? 'NG' : 'ok'}  ${vp.name}  #/${route}${problems.length ? '\n    ' + problems.join('\n    ') : ''}`);
    if (problems.length) failed = true;
  }
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
