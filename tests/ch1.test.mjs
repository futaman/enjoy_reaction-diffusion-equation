// 第1章の問題の答えを検算する。
//   1) 章のファイルが持つ数字（data）を、手計算とエンジン（RD.Sim）の両方で確かめる
//   2) 実ブラウザで、正解を入れると全問クリアになることを確かめる（playwright があるときだけ）
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

// ui.js / sim.js と章のファイルを読み込み、登録された章の定義を返す
function loadChapter(id) {
  const ctx = { console, Math, Float32Array, Uint8ClampedArray };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of ['ui.js', 'sim.js']) vm.runInContext(readFileSync(join(ROOT, 'src/core', f), 'utf8'), ctx, { filename: f });
  const defs = [];
  ctx.RD.registerChapter = (d) => defs.push(d);
  vm.runInContext(readFileSync(join(ROOT, 'src/chapters', id + '.js'), 'utf8'), ctx, { filename: id + '.js' });
  return { RD: ctx.RD, def: defs.find((d) => d.id === id) };
}

const { RD, def } = loadChapter('ch1');
const D = def.data;

test('章の登録内容', () => {
  assert.equal(def.no, 1);
  assert.equal(def.required, 5);
});

test('問題1：貯金 500 円、毎日 +30 円、3日後 → 590 円', () => {
  const s = D.savings;
  assert.equal(s.start + s.perDay * s.days, s.answer);
  assert.equal(s.answer, 590);
  // 1日ずつ進めても同じ
  let v = s.start;
  for (let i = 0; i < s.days; i++) v = def.lib.stepConst(v, s.perDay, 1);
  assert.equal(v, 590);
});

test('問題2：草 0.4、速さ −0.1、0.5 秒後 → 0.35', () => {
  const g = D.grass;
  near(g.amount + g.speed * g.dt, g.answer);
  near(def.lib.stepConst(g.amount, g.speed, g.dt), 0.35);
  // 誤答メッセージに使う数（0.3 = 時間のかけ忘れ、0.45 = 符号ちがい）が正解と重ならない
  for (const w of [0.3, 0.45, 0.05, -0.05, 0.1, -0.1]) assert.ok(!RD_close(w, g.answer));
});

test('問題4（予告）：0.2 から満タンまでの残りの1割 → 0.28。エンジンの F(1−u) と一致', () => {
  const pv = D.preview;
  near(pv.amount + def.lib.growthSpeed(pv.amount, pv.rate) * pv.dt, pv.answer);
  near(pv.answer, 0.28);
  // 第5章の F(1−u)：F = 0.1、dt = 1、ほかの項はオフ
  const s = new RD.Sim({ w: 1, h: 1, F: pv.rate, dt: pv.dt, terms: { diff: false, react: false, decay: false } });
  s.u[0] = pv.amount; s.v[0] = 0;
  near(s.breakdown(0).uNext, pv.answer, 1e-6);
  s.step(1);
  near(s.u[0], pv.answer, 1e-6);
  // デモの growthRun の1コマ目も同じ
  near(def.lib.growthRun(1, pv.amount, pv.rate, 1)[1][1], pv.answer);
});

test('パラパラ漫画：刻みを細かくするほど本物に近づく（予想問題の正解の裏づけ）', () => {
  const { dts, u0, rate, tmax } = D.frames;
  const errAt = (dt, t) => {
    const pts = def.lib.growthRun(dt, u0, rate, tmax);
    const pt = pts.find((x) => Math.abs(x[0] - t) < 1e-9);
    return Math.abs(pt[1] - def.lib.growthExact(t, u0, rate));
  };
  for (const t of [10, 30]) {
    const errs = [...dts].sort((a, b) => b - a).map((dt) => errAt(dt, t));
    for (let i = 1; i < errs.length; i++) assert.ok(errs[i] < errs[i - 1], `t=${t}: ${errs}`);
    assert.ok(errs[errs.length - 1] < 0.002, '0.1 秒きざみはほぼ本物と重なる');
  }
  // 解説文の数字：5 秒きざみは 5 秒後に 0.6、本物は約 0.515
  near(def.lib.growthRun(5, u0, rate, tmax)[1][1], 0.6);
  near(def.lib.growthExact(5, u0, rate), 0.515, 0.001);
  // どの刻みでも満タンはこえない
  for (const dt of dts) for (const [, u] of def.lib.growthRun(dt, u0, rate, tmax)) assert.ok(u <= 1);
  // 本文の「5秒きざみで6コマ、0.1秒きざみで300コマ」
  assert.equal(def.lib.growthRun(5, u0, rate, tmax).length - 1, 6);
  assert.equal(def.lib.growthRun(0.1, u0, rate, tmax).length - 1, 300);
});

// quiz.js の判定と同じ許容範囲
function RD_close(val, ans) { return Math.abs(val - ans) <= Math.max(0.0005, Math.abs(ans) * 0.002) + 1e-12; }

// ---- 実ブラウザで通しで解く ----
let chromium = null;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch (e) { /* なければ飛ばす */ }

test('ブラウザ：正解を入れると全問クリアになり、誤答には説明が出る', { skip: !chromium && 'playwright なし', timeout: 60000 }, async () => {
  const out = join(ROOT, 'tmp/chA/test-ch1.html');
  execFileSync(process.execPath, [join(ROOT, 'build.mjs'), '--out', 'tmp/chA/test-ch1.html', '--chapters', 'ch1'], { cwd: ROOT, stdio: 'pipe' });
  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext()).newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(pathToFileURL(out).href + '#/c/ch1');
    await page.waitForSelector('#q-savings');

    // 誤答（T01：増えた分と残高の混同）
    await page.fill('#q-savings input', '90');
    await page.click('#q-savings .btn.primary');
    assert.match(await page.textContent('#q-savings .feedback'), /増えた分/);
    await page.fill('#q-grass input', '0.3');
    await page.click('#q-grass .btn.primary');
    assert.match(await page.textContent('#q-grass .feedback'), /0\.5 秒/);
    // 速さ 0 → 草も 0（T01 の誤答）
    await page.click('#q-zero .choice >> nth=0');
    assert.match(await page.textContent('#q-zero .feedback'), /変わらない/);
    assert.equal(await page.locator('#q-zero.solved').count(), 0);

    await solveAll(page, D);
    assert.equal(await page.locator('.quiz.solved').count(), 5);
    assert.equal(await page.locator('.ch-progress.cleared').count(), 1);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

async function solveAll(page, data) {
  const ids = await page.$$eval('.quiz', (els) => els.map((e) => e.id.replace(/^q-/, '')));
  for (const id of ids) {
    const sel = '#q-' + id;
    if (await page.locator(sel + '.solved').count()) continue;
    if (await page.locator(sel + ' .answer-row input').count()) {
      await page.fill(sel + ' .answer-row input', String(data[id].answer));
      await page.click(sel + ' .answer-row .btn.primary');
    } else {
      const n = await page.locator(sel + ' .choice').count();
      for (let i = 0; i < n && !(await page.locator(sel + '.solved').count()); i++) {
        await page.click(`${sel} .choice >> nth=${i}`);
        const obs = page.locator(sel + ' .quiz-body > .row .btn.primary');
        if (await obs.count()) await obs.click();
      }
    }
    assert.equal(await page.locator(sel + '.solved').count(), 1, `${id} が解けない`);
  }
}
