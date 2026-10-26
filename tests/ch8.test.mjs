// 第8章（自由ラボ）：つまみの上限で計算がこわれないこと、プリセットとコレクションのリンクで使う値が読めること。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { loadCore } from './helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RD = loadCore(['patterns.js', 'sim.js']);
const src = readFileSync(join(ROOT, 'src', 'chapters', 'ch8.js'), 'utf8');

function loadChapter() {
  const ctx = { console, Math, RD };
  ctx.window = ctx;
  vm.createContext(ctx);
  const defs = [];
  RD.ui = RD.ui || {};
  RD.registerChapter = (d) => defs.push(d);
  vm.runInContext(src, ctx, { filename: 'ch8.js' });
  return defs[0];
}

test('章の登録：ラボはクリア条件なし', () => {
  const def = loadChapter();
  assert.equal(def.id, 'ch8');
  assert.equal(def.no, 8);
  assert.equal(def.required, 0);
});

// ch8.js と同じ式：dMax = floor((0.98 / dt) / 0.05) × 0.05
const dt = RD.SIM_DEFAULTS.dt;
const dMax = +(Math.floor((0.98 / dt) / 0.05) * 0.05).toFixed(2);

test('D のつまみの上限は D × dt < 1 を守る', () => {
  assert.match(src, /Math\.floor\(\(0\.98 \/ dt\) \/ 0\.05\) \* 0\.05/);
  assert.ok(dMax * dt < 1, `${dMax} × ${dt}`);
  assert.ok(dMax >= (RD.SIM_DEFAULTS.Du ?? 1), '既定の Du を選べる');
});

test('D を上限にしても、ざわざわの種で 3000 コマこわれない', () => {
  for (const pt of RD.patterns) {
    const s = new RD.Sim({ w: 48, h: 48, F: pt.F, k: pt.k, Du: dMax, Dv: dMax });
    s.seed('noise');
    s.step(3000);
    assert.ok(!s.exploded, pt.id);
    for (let i = 0; i < s.n; i++) assert.ok(Number.isFinite(s.u[i]) && s.u[i] > -0.5 && s.u[i] < 1.5, `${pt.id} u[${i}] = ${s.u[i]}`);
  }
});

test('上限を少しこえる D（D × dt = 1）なら、こわれることを確かめておく', () => {
  const s = new RD.Sim({ w: 48, h: 48, F: 0.03, k: 0.06, Du: 1 / dt, Dv: 0.5 });
  s.seed('noise');
  s.step(3000);
  let bad = s.exploded;
  for (let i = 0; i < s.n && !bad; i++) if (!Number.isFinite(s.u[i]) || Math.abs(s.u[i]) > 2) bad = true;
  assert.ok(bad, 'D × dt = 1 ではこわれるはず（だから上限を下げている）');
});

test('プリセットの種の名前は、ラボの種の選択肢にある', () => {
  for (const pt of RD.patterns) assert.ok(['center', 'random', 'noise'].includes(pt.seed), pt.id);
  for (const s of ['center', 'random', 'noise']) assert.match(src, new RegExp(`value: '${s}'`));
});

test('学習者が読む文では dt ではなく Δt と書く（第2章からの書き方）', () => {
  // コメントを除いた文字列の中に「dt」と書いていない
  const strings = src.replace(/\/\/.*$/gm, '').match(/(['`])(?:\\.|(?!\1)[^\\])*\1/g) || [];
  for (const t of strings) assert.doesNotMatch(t.replace(/\$\{[^}]*\}/g, ''), /(^|[^A-Za-z])dt([^A-Za-z]|$)/, t);
  assert.match(src, /D × Δt/);
});
