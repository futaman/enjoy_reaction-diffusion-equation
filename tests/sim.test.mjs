// エンジンの計算が仕様書の手計算と一致するかを確かめる。
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './helpers.mjs';

const RD = loadCore(['sim.js']);
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

test('第3章：隣が10と20、自分が12、D×dt=0.5 → 13.5', () => {
  const s = new RD.Sim({ w: 3, h: 1, Du: 0.5, dt: 1, terms: { feed: false, react: false, decay: false } });
  s.u.set([10, 12, 20]);
  near(s.breakdown(1).uNext, 13.5);
});

test('第4章：真ん中1、上下左右3 → ∇² = +2', () => {
  const s = new RD.Sim({ w: 3, h: 3 });
  s.u.set([0, 3, 0, 3, 1, 3, 0, 3, 0]);
  near(s.breakdown(4).lapU, 2);
});

test('第6章の手計算と一致する', () => {
  const s = new RD.Sim({ w: 3, h: 3, Du: 1, Dv: 0.5, F: 0.04, k: 0.06, dt: 1 });
  // 真ん中 u=0.5, v=0.5。上下左右の平均 u=0.6, v=0.3
  s.u.fill(0.6); s.v.fill(0.3); s.u[4] = 0.5; s.v[4] = 0.5;
  const b = s.breakdown(4);
  near(b.lapU, 0.1); near(b.lapV, -0.2); near(b.react, 0.125); near(b.feed, 0.02); near(b.decay, 0.05);
  near(b.dudt, -0.005); near(b.dvdt, -0.025);
  near(b.uNext, 0.495); near(b.vNext, 0.475);
});

test('2次元の高速版と breakdown が同じ結果になる', () => {
  const a = new RD.Sim({ w: 16, h: 12, F: 0.037, k: 0.06, dt: 0.9 });
  let seed = 1; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  a.seed('random', rand);
  const expect = Array.from({ length: a.n }, (_, i) => a.breakdown(i));
  a.step(1);
  for (let i = 0; i < a.n; i++) { near(a.u[i], expect[i].uNext, 1e-5); near(a.v[i], expect[i].vNext, 1e-5); }
});

test('項をオフにすると計算から外れる', () => {
  const s = new RD.Sim({ w: 1, h: 1, F: 0.04, k: 0.06, dt: 1, terms: { react: false, decay: false } });
  s.u[0] = 0.2; s.v[0] = 0.5;
  near(s.breakdown(0).uNext, 0.2 + 0.04 * 0.8);
  near(s.breakdown(0).vNext, 0.5);
});
