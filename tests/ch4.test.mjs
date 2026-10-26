// 第4章の問題の答えとデモの主張を、RD.Sim の計算と突き合わせる。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { loadCore } from './helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RD = loadCore(['sim.js']);
function loadChapter(file) {
  let def = null;
  const ctx = { console, Math, Float32Array, RD: { ui: {}, registerChapter: (d) => { def = d; } } };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(ROOT, 'src', 'chapters', file), 'utf8'), ctx, { filename: file });
  return def;
}
const def = loadChapter('ch4.js');
const D = def.data;
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);
const DIFF = { feed: false, react: false, decay: false };
// 3×3 の真ん中（index 4）に上下左右を入れる。かどには関係ない数を入れておく
const lapOf = (c, opts = {}) => {
  const s = new RD.Sim(Object.assign({ w: 3, h: 3, terms: DIFF }, opts));
  s.u.set([99, c.up, -50, c.left, c.self, c.right, 7, c.down, 123]);
  return s.breakdown(4);
};

test('登録情報', () => {
  assert.equal(def.id, 'ch4');
  assert.equal(def.required, 4);
});

test('問題1：真ん中 1、上下左右 3 → ∇² = +2（ななめは関係ない）', () => {
  const b = lapOf(D.q1);
  near(b.avgU, 3); near(b.lapU, D.q1.answer); near(D.q1.answer, 2);
});

test('問題2：真ん中 4、まわり 6,2,5,3 → ∇² = 0', () => {
  const b = lapOf(D.q2);
  near(b.lapU, D.q2.answer); near(D.q2.answer, 0);
  assert.deepEqual([D.q2.up, D.q2.left, D.q2.right, D.q2.down].sort(), [2, 3, 5, 6]);
});

test('問題3：地形と符号（谷＋、山−、坂0、平ら0）', () => {
  const expectSign = ['+', '-', '0'];
  for (const t of D.terrain) {
    const lap = lapOf(t.cells).lapU;
    const sign = lap > 1e-9 ? '+' : lap < -1e-9 ? '-' : '0';
    assert.equal(sign, expectSign[t.sign], t.kind);
  }
  assert.match(D.signs[0], /＋/); assert.match(D.signs[1], /−/); assert.match(D.signs[2], /0/);
});

test('問題4：D=0.5, Δt=1 で問題1の真ん中は 1 → 2', () => {
  const b = lapOf(D.q1, { Du: D.qNext.D, dt: D.qNext.dt });
  near(b.dudt, 1);
  near(b.uNext, D.qNext.answer); near(D.qNext.answer, 2);
});

const inkSim = () => new RD.Sim({ w: D.ink.size, h: D.ink.size, Du: D.ink.D, dt: D.ink.dt, terms: DIFF });
const drop = (s, cx, cy) => {
  s.reset(0, 0);
  const r = D.ink.radius, n = D.ink.size;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r) s.u[s.idx((cx + dx + n) % n, (cy + dy + n) % n)] = D.ink.value;
};
const total = (s) => s.u.reduce((a, b) => a + b, 0);
const mm = (s) => [Math.min(...s.u), Math.max(...s.u)];

test('2次元のインク：安定（D×Δt ≤ 1）で、合計は変わらず、最後は一様', () => {
  assert.ok(D.ink.D * D.ink.dt < 1);
  const s = inkSim();
  drop(s, ...D.ink.center);
  const t0 = total(s);
  s.step(400);
  near(total(s), t0, 1e-2);
  const [lo1, hi1] = mm(s);
  assert.ok(hi1 < 0.2 && lo1 >= 0);
  s.step(6000);
  const [lo, hi] = mm(s);
  assert.ok(hi - lo < 1e-3, `一様に近い: ${lo}〜${hi}`);
  near(hi, t0 / (D.ink.size ** 2), 1e-3);
});

test('パックマン：左端の近くに落とすと、右端（x = 63）にインクが出てくる', () => {
  const s = inkSim();
  drop(s, ...D.ink.edge);
  const n = D.ink.size, y = D.ink.edge[1];
  assert.equal(s.u[s.idx(n - 1, y)], 0, '最初は右端にない');
  s.step(10);
  assert.ok(s.u[s.idx(n - 1, y)] > 1e-3, '右端から出てくる');
  // 真ん中に落とした場合は、同じ時間では右端にほとんど届かない
  const c = inkSim(); drop(c, ...D.ink.center); c.step(10);
  assert.ok(c.u[c.idx(n - 1, y)] < s.u[s.idx(n - 1, y)]);
});

test('予想5：でこぼこ（ランダム）にまいても、拡散だけなら一様になる', () => {
  const s = inkSim();
  let seed = 11; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < s.n; i++) s.u[i] = rand();
  const t0 = total(s);
  const r0 = mm(s); 
  s.step(3000);
  const r1 = mm(s);
  assert.ok(r1[1] - r1[0] < 0.02 * (r0[1] - r0[0]), `差が縮む ${r1}`);
  near(total(s), t0, 0.5);
});

test('本文：画面の位置に頼った言い方をしない（design.md 3.2）', () => {
  const src = readFileSync(join(ROOT, 'src/chapters/ch4.js'), 'utf8');
  for (const w of ['下のカラーバー', '上の意味', '下のデモ', '右のデモ', 'このデモ']) assert.ok(!src.includes(w), `「${w}」が残っている`);
});
