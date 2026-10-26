// 第5章の問題の答えと、本文で使う 0次元（1か所だけ）の振る舞いを RD.Sim で確かめる。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { loadCore } from './helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RD = loadCore(['patterns.js', 'sim.js']);
// 章のファイルを読み込んで、本文・問題で使っている数（RD.chapterData.ch5）を取り出す
RD.ui = {};
RD.registerChapter = () => {};
vm.runInContext(readFileSync(join(ROOT, 'src/chapters/ch5.js'), 'utf8'), vm.createContext(Object.assign(Object.create(null), { window: { RD } })), { filename: 'ch5.js' });
const D = RD.chapterData.ch5;

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

// 0次元の草原を、章と同じ条件（u=U0, v=V0, Δt=DT）で n コマ進める
function run0D({ F, k, terms = {}, n = D.LIMIT, dt = D.DT }) {
  const s = new RD.Sim({ w: 1, h: 1, F, k, dt, terms: Object.assign({ diff: false }, terms) });
  s.u[0] = D.U0; s.v[0] = D.V0;
  const trace = [];
  for (let i = 0; i < n; i++) { s.step(1); trace.push([s.u[0], s.v[0]]); }
  return { s, trace };
}
const extinct = ({ s }) => s.v[0] < 0.005;
const coexist = ({ s, trace }) => s.v[0] > 0.1 && Math.abs(trace[trace.length - 1][1] - trace[trace.length - 51][1]) < 0.005;

test('問題：u=0.5, v=0.4 → uv² = 0.08', () => {
  const s = new RD.Sim({ w: 1, h: 1 });
  s.u[0] = D.uv2.u; s.v[0] = D.uv2.v;
  near(s.breakdown(0).react, D.uv2.answer);
  near(D.uv2.answer, 0.08);
});

test('問題：ウサギ 0 なら uv² = 0（いつまでもウサギは生まれない）', () => {
  const s = new RD.Sim({ w: 1, h: 1, terms: { diff: false } });
  s.u[0] = D.uv2zero.u; s.v[0] = D.uv2zero.v;
  near(s.breakdown(0).react, D.uv2zero.answer);
  s.step(500);
  near(s.v[0], 0);
});

test('本文：F=0.04, u=0.5 → F(1−u) = 0.02。u+v の変化には uv² が効かない（移し替え）', () => {
  const s = new RD.Sim({ w: 1, h: 1, F: 0.04, k: 0.06, terms: { diff: false } });
  s.u[0] = 0.5; s.v[0] = 0.4;
  const b = s.breakdown(0);
  near(b.feed, 0.02);
  near(b.dudt + b.dvdt, b.feed - b.decay); // ±uv² は打ち消し合う
});

test('対応づけの答えは、左右の項目の数と合っている', () => {
  assert.equal(D.MATCH.answer.length, D.MATCH.left.length);
  assert.equal(new Set(D.MATCH.answer).size, D.MATCH.answer.length);
  D.MATCH.answer.forEach((j) => assert.ok(j >= 0 && j < D.MATCH.right.length));
});

test('ステップ1（草が生えるだけ）：25コマで約0.82、100コマでほぼ満タン', () => {
  const { trace } = run0D({ ...D.LAB, terms: D.STEPS[0].terms });
  near(trace[24][0], 0.82, 0.005);
  assert.ok(trace[99][0] > 0.99);
  near(trace[99][1], D.V0); // ウサギは変わらない
});

test('ステップ2（減るルールなし）：ウサギは増え続けて 1 を超える（グラフからはみ出す）', () => {
  const { trace } = run0D({ ...D.LAB, terms: D.STEPS[1].terms, n: 40 });
  const over = trace.findIndex(([, v]) => v > 1);
  assert.ok(over > 0 && over < 40, `v > 1 になったコマ: ${over}`);
  for (let i = 1; i <= over; i++) assert.ok(trace[i][1] > trace[i - 1][1], 'ウサギは増え続ける');
  assert.ok(trace[over][0] < 0.1, '草はほとんど食べ尽くされる');
});

test('ステップ3（全部）：F=0.04, k=0.05 で共存（u≈0.28, v≈0.32）', () => {
  const r = run0D({ ...D.LAB, terms: D.STEPS[2].terms });
  assert.ok(coexist(r));
  near(r.s.u[0], 0.28, 0.01); near(r.s.v[0], 0.32, 0.01);
  // 200コマを過ぎたら落ち着いている（本文「落ち着きました」の表示条件）
  assert.ok(Math.abs(r.trace[200][1] - r.s.v[0]) < 0.005);
});

test('F-k 実験：最初の設定（F=0.02, k=0.05）ではウサギは全滅する', () => {
  const r = run0D(D.FK.start);
  assert.ok(extinct(r));
  // はじめは少し増える（「はじめは草を食べて増えますが……」）
  assert.ok(Math.max(...r.trace.slice(0, 30).map((x) => x[1])) > D.V0);
});

test('予想問題：k=0.05 のまま F を 0.06 に大きくすると、共存する（正解）', () => {
  assert.equal(D.FK.predict.k, D.FK.start.k);
  assert.ok(D.FK.predict.F > D.FK.start.F);
  const r = run0D(D.FK.predict);
  assert.ok(coexist(r));
  assert.ok(r.s.v[0] < 1, 'どこまでも増えるわけではない');
  // 250コマを過ぎたら落ち着いている（「共存しています」の表示条件）
  assert.ok(Math.abs(r.trace[250][1] - r.s.v[0]) < 0.005);
});

test('本文：寿命が短い（k=0.065, F=0.04）と全滅、入れ替えが速すぎる（F=0.12）と全滅', () => {
  assert.ok(extinct(run0D(D.FK.shortLife)));
  assert.ok(extinct(run0D(D.FK.flush)));
});

test('結果は Δt を小さくしても変わらない（Δt=1 のコマ送りの都合ではない）', () => {
  for (const dt of [0.5, 0.8]) {
    const n = Math.round(D.LIMIT * 3 / dt);
    assert.ok(extinct(run0D({ ...D.FK.start, dt, n })));
    assert.ok(coexist(run0D({ ...D.FK.predict, dt, n })));
    assert.ok(extinct(run0D({ ...D.FK.flush, dt, n })));
    assert.ok(extinct(run0D({ ...D.FK.shortLife, dt, n })));
    assert.ok(coexist(run0D({ ...D.LAB, dt, n })));
  }
});
