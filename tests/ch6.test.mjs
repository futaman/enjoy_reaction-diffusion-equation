// 第6章の手計算の答えと、「拡散だけ／反応だけ／全部」の違いを RD.Sim で確かめる。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { loadCore } from './helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RD = loadCore(['patterns.js', 'sim.js']);
RD.ui = {};
RD.registerChapter = () => {};
vm.runInContext(readFileSync(join(ROOT, 'src/chapters/ch6.js'), 'utf8'), vm.createContext(Object.assign(Object.create(null), { window: { RD } })), { filename: 'ch6.js' });
const D = RD.chapterData.ch6;
const H = D.HAND;

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

test('手計算の条件は仕様書どおり', () => {
  assert.deepEqual([H.u, H.v, H.avgU, H.avgV, H.Du, H.Dv, H.F, H.k, H.dt], [0.5, 0.5, 0.6, 0.3, 1, 0.5, 0.04, 0.06, 1]);
  assert.deepEqual(Array.from(H.blanks, (b) => b[2]), [0.1, -0.2, 0.125, 0.02, 0.05, -0.005, -0.025, 0.495, 0.475]);
});

test('手計算の穴埋め①〜⑨が、答え合わせの 3×3 シミュレーションの家計簿と一致する', () => {
  const s = new RD.Sim({ w: 3, h: 3, Du: H.Du, Dv: H.Dv, F: H.F, k: H.k, dt: H.dt });
  s.u.fill(H.avgU); s.v.fill(H.avgV);
  s.u[4] = H.u; s.v[4] = H.v;
  const b = s.breakdown(4);
  near(b.avgU, H.avgU); near(b.avgV, H.avgV);
  for (const [key, , answer] of H.blanks) near(b[key], answer);
  // 実際に1コマ進めても同じ
  s.step(1);
  near(s.u[4], 0.495); near(s.v[4], 0.475);
});

test('手計算の答えは、小数第3位までの入力で正解になる（quiz.js の許容幅）', () => {
  const tol = (ans) => Math.max(0.0005, Math.abs(ans) * 0.002);
  for (const [, , answer] of H.blanks) {
    const rounded = Math.round(answer * 1000) / 1000;
    assert.ok(Math.abs(rounded - answer) <= tol(answer) + 1e-12);
  }
});

// 章と同じ 2次元の草原（Du, Dv, dt は RD.SIM_DEFAULTS か Sim の既定値）
function run2D(terms, dt) {
  const s = new RD.Sim({ w: D.N, h: D.N, F: D.P2.F, k: D.P2.k, dt, terms: Object.assign({}, terms) });
  s.seed('center');
  s.step(Math.round(D.COMPARE_TIME / s.dt));
  return s;
}

test('全部オンなら、真ん中の種から模様が育つ（拡散だけ・反応だけでは消える）', () => {
  const [diff, react, all] = D.PRESETS.map((pr) => run2D(pr.terms));
  assert.ok(diff.stats().maxV < 0.01, `拡散だけ maxV=${diff.stats().maxV}`);
  assert.ok(react.stats().maxV < 0.01, `反応だけ maxV=${react.stats().maxV}`);
  const st = all.stats();
  assert.ok(st.cover > 0.2 && st.maxV > 0.2, `全部 cover=${st.cover} maxV=${st.maxV}`);
  assert.ok(st.cover < 0.95, '一面ウサギではなく、模様になっている');
});

test('模様が育つのは Δt を変えても同じ（SIM_DEFAULTS が変わっても大丈夫）', () => {
  const all = D.PRESETS.find((pr) => pr.id === 'all');
  for (const dt of [0.5, 0.9]) {
    const st = run2D(all.terms, dt).stats();
    assert.ok(st.cover > 0.15, `dt=${dt} cover=${st.cover}`);
  }
});
