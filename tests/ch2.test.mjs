// 第2章の問題の答えを検算する。
//   1) 章のファイルが持つ数字（data）を、手計算とエンジン（RD.Sim）の両方で確かめる
//   2) 実ブラウザで、正解を入れると全問クリアになり、デモの家計簿が次のコマと一致することを確かめる
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

const { RD, def } = loadChapter('ch2');
const D = def.data;

test('章の登録内容', () => {
  assert.equal(def.no, 2);
  assert.equal(def.required, 5);
});

test('問題4：u = 5、∂u/∂t = −2、Δt = 0.5 → 4', () => {
  const c = D.calc;
  near(c.u + c.dudt * c.dt, c.answer);
  assert.equal(c.answer, 4);
  // エンジンでも：∂u/∂t = −2 になるように、1次元で隣の平均を u − 2 にする（D = 1）
  const s = new RD.Sim({ w: 3, h: 1, Du: 1, dt: c.dt, terms: { feed: false, react: false, decay: false } });
  s.u.set([c.u - 2, c.u, c.u - 2]);
  near(s.breakdown(1).dudt, c.dudt, 1e-6);
  near(s.breakdown(1).uNext, c.answer, 1e-6);
});

test('問題5：3×3 の地図。どのマスも u + ∂u/∂t × Δt', () => {
  const g = D.grid;
  assert.deepEqual(JSON.parse(JSON.stringify(g.answer.map((r) => r.map((v) => +v.toFixed(6))))), [[0.5, 0.5, 1], [0.4, 0.55, 0.2], [0.7, 0.7, 0.5]]);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    near(g.answer[r][c], g.u[r][c] + g.dudt[r][c] * g.dt);
    assert.ok(g.answer[r][c] >= 0 && g.answer[r][c] <= 1, '草の量は 0〜1 におさまる');
    // 1マスずつエンジンでも（1次元の3マスで ∂u/∂t を作る）
    const s = new RD.Sim({ w: 3, h: 1, Du: 1, dt: g.dt, terms: { feed: false, react: false, decay: false } });
    const nb = g.u[r][c] + g.dudt[r][c];
    s.u.set([nb, g.u[r][c], nb]);
    near(s.breakdown(1).uNext, g.answer[r][c], 1e-6);
  }
  // 速さ 0 のマスがあり、値はそのまま（T01 の仕掛け）
  assert.ok(g.dudt.flat().includes(0));
});

test('デモ：5×5 の草原。家計簿の「新しい u」が、1コマ進めた地図と一致する', () => {
  const dm = D.demo;
  const s = new RD.Sim({ w: 5, h: 5, Du: dm.Du, dt: dm.dt, terms: { feed: false, react: false, decay: false } });
  dm.u.forEach((row, r) => row.forEach((x, c) => { s.u[s.idx(c, r)] = x; }));
  // 解説に出てくる値：丘のてっぺんは −0.2 → 0.9、(2行2列) は −0.1 → 0.55、すみは 0
  near(s.breakdown(s.idx(2, 2)).dudt, -0.2, 1e-6);
  near(s.breakdown(s.idx(2, 2)).uNext, 0.9, 1e-6);
  near(s.breakdown(s.idx(1, 1)).dudt, -0.1, 1e-6);
  near(s.breakdown(s.idx(1, 1)).uNext, 0.55, 1e-6);
  near(s.breakdown(0).dudt, 0, 1e-6);
  for (let step = 0; step < 5; step++) {
    const expect = Array.from({ length: s.n }, (_, i) => s.breakdown(i));
    s.step(1);
    for (let i = 0; i < s.n; i++) {
      near(s.u[i], expect[i].u + expect[i].dudt * dm.dt, 1e-6);
      assert.ok(s.u[i] >= 0 && s.u[i] <= 1);
    }
  }
});

// ---- 実ブラウザで通しで解く ----
let chromium = null;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch (e) { /* なければ飛ばす */ }

test('ブラウザ：全問クリア、誤答の説明、家計簿と1コマ送り', { skip: !chromium && 'playwright なし', timeout: 60000 }, async () => {
  const out = join(ROOT, 'tmp/chA/test-ch2.html');
  execFileSync(process.execPath, [join(ROOT, 'build.mjs'), '--out', 'tmp/chA/test-ch2.html', '--chapters', 'ch2'], { cwd: ROOT, stdio: 'pipe' });
  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext()).newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(pathToFileURL(out).href + '#/c/ch2');
    await page.waitForSelector('#q-calc');

    // 家計簿：えらんだマス（2行2列）の「新しい u」0.55 が、1コマ後の u になる
    const demo = page.locator('.step-demo .card').nth(1);
    assert.match(await demo.locator('tr.next').textContent(), /0\.55/);
    await demo.getByText('1コマ進める').click();
    assert.match(await demo.locator('.ch2-msg').textContent(), /0\.55.*0\.55/);
    // 別のマスをクリックすると家計簿が切りかわる
    await demo.locator('.numgrid >> nth=0').locator('.cell >> nth=12').click();
    assert.match(await demo.locator('.ledger-wrap .cap').textContent(), /3行3列/);

    // 誤答：T01（∂u/∂t = 0.3 を u = 0.3 と読む）
    await page.click('#q-rate .choice >> nth=0');
    assert.match(await page.textContent('#q-rate .feedback'), /速さ/);
    await page.fill('#q-calc input', '-1');
    await page.click('#q-calc .answer-row .btn.primary');
    assert.match(await page.textContent('#q-calc .feedback'), /変わる分/);

    // 全問解く
    const ids = await page.$$eval('.quiz', (els) => els.map((e) => e.id.replace(/^q-/, '')));
    assert.equal(ids.length, 5);
    for (const id of ids) {
      const sel = '#q-' + id;
      if (id === 'calc') {
        await page.fill(sel + ' .answer-row input', String(D.calc.answer));
        await page.click(sel + ' .answer-row .btn.primary');
      } else if (id === 'grid') {
        // 1つまちがえると赤くなり、直すとクリア
        const inputs = page.locator(sel + ' .quiz-body .numgrid input');
        const cells = [];
        D.grid.answer.forEach((row, r) => row.forEach((v, c) => { if (r || c) cells.push(v); }));
        assert.equal(await inputs.count(), cells.length);
        for (let i = 0; i < cells.length; i++) await inputs.nth(i).fill(String(i === 0 ? 0.3 : cells[i]));
        await page.click(sel + ' .quiz-body > .row .btn.primary');
        assert.equal(await page.locator(sel + ' .cell.ng').count(), 1);
        await inputs.nth(0).fill(String(cells[0]));
        await page.click(sel + ' .quiz-body > .row .btn.primary');
      } else {
        const n = await page.locator(sel + ' .choice').count();
        for (let i = 0; i < n && !(await page.locator(sel + '.solved').count()); i++) await page.click(`${sel} .choice >> nth=${i}`);
      }
      assert.equal(await page.locator(sel + '.solved').count(), 1, `${id} が解けない`);
    }
    assert.equal(await page.locator('.ch-progress.cleared').count(), 1);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
