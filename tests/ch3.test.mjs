// 第3章の問題の答えとデモの主張を、RD.Sim の計算と突き合わせる。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { loadCore } from './helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RD = loadCore(['sim.js']);
// 章ファイルを DOM なしで読み込み、登録された定義（data を含む）を取り出す
function loadChapter(file) {
  let def = null;
  const ctx = { console, Math, Float32Array, RD: { ui: {}, registerChapter: (d) => { def = d; } } };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(ROOT, 'src', 'chapters', file), 'utf8'), ctx, { filename: file });
  return def;
}
const def = loadChapter('ch3.js');
const D = def.data;
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);
const diffSim = (Du, dt = 1, w = 20) => new RD.Sim({ w, h: 1, Du, dt, terms: { feed: false, react: false, decay: false } });
const sum = (a) => a.reduce((s, x) => s + x, 0);
const range = (a) => Math.max(...a) - Math.min(...a);

test('登録情報', () => {
  assert.equal(def.id, 'ch3');
  assert.equal(def.required, 4);
});

test('問題1：隣 10 と 20、自分 12、D×Δt=0.5 → 13.5', () => {
  const q = D.q1;
  const s = diffSim(q.D, q.dt, 3);
  s.u.set([q.left, q.self, q.right]);
  const b = s.breakdown(1);
  near(b.avgU, 15); near(b.lapU, 3);
  near(b.uNext, q.answer);
  near(q.answer, 13.5);
});

test('本文の例：隣 4 と 8、自分 2 → 4', () => {
  const e = D.example;
  const s = diffSim(e.D, e.dt, 3);
  s.u.set([e.left, e.self, e.right]);
  near(s.breakdown(1).uNext, e.answer);
});

test('問題2：山のてっぺんは減る（20 → 17）', () => {
  const s = diffSim(0.5);
  s.u.set(D.mountain);
  const b = s.breakdown(D.top);
  assert.equal(D.mountain[D.top], 20);
  assert.equal(D.mountain[D.top - 1], 14);
  assert.equal(D.mountain[D.top + 1], 14);
  assert.ok(b.lapU < 0);
  near(b.uNext, 17);
  // てっぺんが山の最大
  assert.equal(Math.max(...D.mountain), D.mountain[D.top]);
});

test('合計は変わらず、最後は点線（平均）にそろう', () => {
  const s = diffSim(0.5);
  s.u.set(D.mountain);
  const total = sum(D.mountain);
  s.step(2000);
  near(sum(Array.from(s.u)), total, 1e-3);
  for (const x of s.u) near(x, total / 20, 1e-3);
  near(total / 20, 3.2);
});

test('予想3：D を2倍にすると速く平らになるが、そろう高さは同じ', () => {
  const [d1, d2] = D.compare;
  near(d2, 2 * d1);
  const a = diffSim(d1), b = diffSim(d2);
  a.u.set(D.mountain); b.u.set(D.mountain);
  for (const n of [5, 20, 60]) {
    a.step(n); b.step(n);
    assert.ok(range(Array.from(b.u)) < range(Array.from(a.u)), `${n}: D=${d2} のほうが平ら`);
    assert.ok(b.u[D.top] < a.u[D.top]);
  }
  a.step(5000); b.step(5000);
  near(a.u[0], b.u[0], 1e-3);
  near(sum(Array.from(a.u)), sum(Array.from(b.u)), 1e-3);
});

test('粒の見方：1/4 左・1/4 右・1/2 その場 の期待値は D×Δt=0.5 のルールと同じ', () => {
  const q = D.hop;
  const s = diffSim(2 * q);
  // でたらめな数で試す
  let seed = 7; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const n = Array.from({ length: 20 }, () => Math.round(rand() * 50));
  s.u.set(n);
  for (let i = 0; i < 20; i++) {
    const expect = (1 - 2 * q) * n[i] + q * n[(i + 19) % 20] + q * n[(i + 1) % 20];
    near(s.breakdown(i).uNext, expect, 1e-4);
  }
  near(sum(D.particleStart), 200);
});

test('粒の見方：粒をたくさん動かした平均は、棒のルールに近い', () => {
  let seed = 3; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const scale = 50; // 粒 1万個
  const start = D.particleStart.map((c) => c * scale);
  const pos = []; start.forEach((c, i) => { for (let k = 0; k < c; k++) pos.push(i); });
  const s = diffSim(2 * D.hop); s.u.set(start);
  for (let t = 0; t < 10; t++) {
    for (let j = 0; j < pos.length; j++) { const r = rand(); if (r < D.hop) pos[j] = (pos[j] + 19) % 20; else if (r < 2 * D.hop) pos[j] = (pos[j] + 1) % 20; }
    s.step(1);
  }
  const counts = new Array(20).fill(0); pos.forEach((i) => counts[i]++);
  for (let i = 0; i < 20; i++) assert.ok(Math.abs(counts[i] - s.u[i]) < 0.06 * 100 * scale, `bin ${i}: ${counts[i]} vs ${s.u[i]}`);
});

test('予想5：D×Δt=1.5 だと揺れながら爆発する。1 以下なら平らになる', () => {
  const s = diffSim(D.breakMax);
  s.u.set(D.mountain);
  // 1コマ目：てっぺんは 20 + 1.5×(14−20) = 11、すそ（0 のとなり 2）は…符号が入れかわるマスが出る
  near(s.breakdown(D.top).uNext, 11);
  // 本文の例：自分 20、両どなり 0 → −10
  const t = diffSim(1.5, 1, 3); t.u.set([0, 20, 0]); near(t.breakdown(1).uNext, -10);
  s.step(40);
  assert.ok(Math.max(...Array.from(s.u).map(Math.abs)) > 1e4, '爆発している');
  assert.ok(Math.min(...s.u) < 0, 'マイナスが出る');
  for (const v of [0.5, 0.9, 1.0]) {
    const ok = diffSim(v); ok.u.set(D.mountain); ok.step(400);
    assert.ok(Math.max(...Array.from(ok.u).map(Math.abs)) <= 20 + 1e-6, `${v} は爆発しない`);
  }
  for (const v of [0.5, 0.9]) {
    const ok = diffSim(v); ok.u.set(D.mountain); ok.step(400);
    assert.ok(range(Array.from(ok.u)) < 0.01, `${v} は平らになる`);
  }
});
