// 第7章：再現チャレンジの判定、F-k マップのデータ、本文で言っている数値（Du = Dv、D を小さく）を RD.Sim で確かめる。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { loadCore } from './helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RD = loadCore(['patterns.js', 'sim.js']);

// 章のファイルを DOM なしで読み込む（render は呼ばない）
function loadChapter(file) {
  const ctx = { console, Math, Float32Array, Uint8Array, Int32Array, Uint8ClampedArray, atob, RD };
  ctx.window = ctx;
  vm.createContext(ctx);
  const defs = [];
  RD.ui = RD.ui || {};
  RD.registerChapter = (d) => defs.push(d);
  vm.runInContext(readFileSync(join(ROOT, 'src', 'chapters', file), 'utf8'), ctx, { filename: file });
  return defs[0];
}
const def = loadChapter('ch7.js');
const C = RD.ch7;
const pats = RD.patterns;
const P = (id) => pats.find((p) => p.id === id);

test('章の登録：id と必要な正解数（問題5つ＋再現3つ）', () => {
  assert.equal(def.id, 'ch7');
  assert.equal(def.required, 8);
  assert.ok(pats.length >= 3, '再現チャレンジは3つ以上必要');
});

test('判定：ボックスの中で、変えてから OBS_STEPS 動かし、ウサギが生きていれば合格', () => {
  for (const pt of pats) {
    const b = pt.box;
    const mid = { F: (b.fMin + b.fMax) / 2, k: (b.kMin + b.kMax) / 2 };
    assert.deepEqual([...C.judge(pats, { ...mid, obs: C.OBS_STEPS, maxV: 0.3 })], [pt.id], pt.id + ' 中心');
    assert.deepEqual([...C.judge(pats, { F: pt.F, k: pt.k, obs: C.OBS_STEPS, maxV: 0.3 })], [pt.id], pt.id + ' 代表値');
    // 角もふくむ
    assert.deepEqual([...C.judge(pats, { F: b.fMin, k: b.kMax, obs: C.OBS_STEPS, maxV: 0.3 })], [pt.id], pt.id + ' 角');
    // 時間が足りない／全滅／外
    assert.equal(C.judge(pats, { ...mid, obs: C.OBS_STEPS - 1, maxV: 0.3 }).length, 0);
    assert.equal(C.judge(pats, { ...mid, obs: C.OBS_STEPS, maxV: 0.01 }).length, 0);
    for (const [dF, dk] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const F = dF < 0 ? b.fMin - 0.0002 : dF > 0 ? b.fMax + 0.0002 : mid.F;
      const k = dk < 0 ? b.kMin - 0.0001 : dk > 0 ? b.kMax + 0.0001 : mid.k;
      assert.ok(!C.judge(pats, { F, k, obs: C.OBS_STEPS, maxV: 0.3 }).includes(pt.id), `${pt.id} の外 (${F}, ${k})`);
      const adv = C.advise(pt, F, k).join('');
      assert.match(adv, dF < 0 ? /F をもう少し<b>大きく/ : dF > 0 ? /F をもう少し<b>小さく/ : dk < 0 ? /k をもう少し<b>大きく/ : /k をもう少し<b>小さく/);
    }
    assert.equal(C.advise(pt, mid.F, mid.k).length, 0);
  }
});

test('合格ボックスどうしは重ならない', () => {
  for (const a of pats) for (const b of pats) {
    if (a === b) continue;
    const overlap = a.box.fMin < b.box.fMax && b.box.fMin < a.box.fMax && a.box.kMin < b.box.kMax && b.box.kMin < a.box.kMax;
    assert.ok(!overlap, `${a.id} と ${b.id}`);
  }
});

test('ボックスはつまみ（F 0.0005 きざみ、k 0.0001 きざみ）で入れる幅がある', () => {
  for (const pt of pats) {
    const fIn = Math.floor(pt.box.fMax / 0.0005 + 1e-9) - Math.ceil(pt.box.fMin / 0.0005 - 1e-9) + 1;
    const kIn = Math.floor(pt.box.kMax / 0.0001 + 1e-9) - Math.ceil(pt.box.kMin / 0.0001 - 1e-9) + 1;
    assert.ok(fIn >= 2 && kIn >= 2, `${pt.id}: F ${fIn} 点, k ${kIn} 点`);
  }
});

test('F-k マップ：データがこわれていない', () => {
  const M = C.MAP;
  assert.equal(M.cls.length, M.nF * M.nK);
  assert.equal(M.lv.length, M.nF * M.nK);
  const d = C.decodeMap();
  const patterned = [...M.cls].filter((c) => c !== '.' && c !== 'U').length;
  assert.equal(d.count, patterned);
  assert.equal(atob(M.tiles).length, (patterned * M.tile * M.tile) / 2);
});

test('F-k マップ：模様のプリセットは模様の国に、特別な点は全滅・一様の国にある', () => {
  for (const pt of pats) {
    const c = C.classAt(pt.F, pt.k);
    assert.ok(c && c !== '.' && c !== 'U', `${pt.id} → ${c}`);
  }
  assert.equal(C.classAt(RD.specialPoints.extinct.F, RD.specialPoints.extinct.k), '.');
  assert.equal(C.classAt(RD.specialPoints.uniform.F, RD.specialPoints.uniform.k), 'U');
  // 生きている模様（spiral）は「動きつづける国」
  for (const pt of pats.filter((p) => p.kind === 'live')) assert.equal(C.classAt(pt.F, pt.k), 'L', pt.id);
});

test('F-k マップ：いくつかのマスを RD.Sim で作り直すと同じ国になる', () => {
  const M = C.MAP;
  const cls = (s, late) => {
    let ch = 0, sum = 0, sq = 0, mx = 0, cover = 0;
    for (let j = 0; j < s.n; j++) { ch += Math.abs(s.v[j] - late[j]); sum += s.v[j]; sq += s.v[j] ** 2; mx = Math.max(mx, s.v[j]); if (s.v[j] > 0.2) cover++; }
    const mean = sum / s.n, std = Math.sqrt(Math.max(0, sq / s.n - mean * mean));
    return mx < 0.05 ? '.' : std < 0.02 ? 'U' : ch / s.n > 0.004 ? 'L' : cover / s.n < 0.3 ? 'o' : cover / s.n < 0.62 ? '=' : '#';
  };
  // 全滅・一様・水玉・迷路 のマス
  for (const [fi, ki] of [[8, 30], [20, 0], [8, 23], [8, 17]]) {
    const F = +(M.F0 + fi * M.FS).toFixed(4), k = +(M.K0 + ki * M.KS).toFixed(4);
    const s = new RD.Sim({ w: 64, h: 64, F, k, Du: 1, Dv: 0.5, dt: 0.8 });
    s.seed('random', C.seeded(11));
    s.step(12000 - 300); const late = s.v.slice(); s.step(300);
    assert.equal(cls(s, late), M.cls[fi * M.nK + ki], `F=${F}, k=${k}`);
  }
});

// ---- 本文の数値の確認 ----
const D = RD.SIM_DEFAULTS;
function run(pt, opts, steps, seedNo = 3, N = 80, seed = pt.seed) {
  const s = new RD.Sim({ w: N, h: N, F: pt.F, k: pt.k, ...opts });
  s.seed(seed, C.seeded(seedNo));
  s.step(steps);
  return s;
}

test('実験1：Du = Dv にすると、どのプリセットでも模様ができずウサギが全滅する', () => {
  for (const pt of pats) {
    const base = run(pt, {}, 3000);
    assert.ok(base.stats().maxV > 0.2, `${pt.id}: ふつうは模様ができる`);
    const same = run(pt, { Dv: D.Du }, 3000);
    assert.ok(same.stats().maxV < 0.01, `${pt.id}: Du = Dv で全滅 (maxV ${same.stats().maxV})`);
  }
});

test('実験1のデモ（迷路、80×80、種は random）：Du = Dv では数百コマでウサギがいなくなる', () => {
  const s = run(P('maze'), { Dv: D.Du }, 800, 3, 80, 'random');
  assert.ok(s.stats().maxV < 0.05, String(s.stats().maxV));
});

test('もっと詳しく：迷路の値で Dv が Du の7割なら迷路ができ、9割では消える', () => {
  const at = (r) => run(P('maze'), { Du: 1, Dv: r }, 8000, 5, 96, 'random').stats().cover;
  assert.ok(at(0.7) > 0.2, '0.7');
  assert.ok(at(0.9) < 0.01, '0.9');
});

test('実験2：D を両方半分にすると、水玉の数はおよそ2倍（128×128）', () => {
  const sp = P('spots');
  const a = run(sp, {}, 10000, 3, 128, 'random');
  const b = run(sp, { Du: D.Du / 2, Dv: D.Dv / 2 }, 10000, 3, 128, 'random');
  const na = C.countGroups(a), nb = C.countGroups(b);
  const r = nb / na;
  assert.ok(r > 1.6 && r < 2.6, `${na} → ${nb}（${r.toFixed(2)} 倍）`);
});

test('実験2のデモ（80×80、種は noise）でも、半分のほうが群れが多い', () => {
  const sp = P('spots');
  const a = run(sp, {}, 8000, 5, 80, 'noise'), b = run(sp, { Du: D.Du / 2, Dv: D.Dv / 2 }, 8000, 5, 80, 'noise');
  assert.ok(C.countGroups(b) > 1.5 * C.countGroups(a), `${C.countGroups(a)} → ${C.countGroups(b)}`);
});

test('草原で起きていること：草のへこみ（谷の1割以上）はウサギの山（1割以上）より外側まで広がる（分裂する点の値、1つの点）', () => {
  const s = run(P('mitosis'), {}, 1500, 1, 96, 'center');
  let mi = 0; for (let i = 1; i < s.n; i++) if (s.v[i] > s.v[mi]) mi = i;
  const y = Math.floor(mi / s.w), rowU = [], rowV = [];
  for (let x = 0; x < s.w; x++) { rowU.push(s.u[y * s.w + x]); rowV.push(s.v[y * s.w + x]); }
  const uMin = Math.min(...rowU), uMax = Math.max(...rowU), vMax = Math.max(...rowV);
  const wU = rowU.filter((u) => u < uMax - 0.1 * (uMax - uMin)).length, wV = rowV.filter((v) => v > 0.1 * vMax).length;
  assert.ok(wU > wV, `草の谷 ${wU} マス、ウサギの山 ${wV} マス`);
  // 本文の「約 15 マス／約 19 マス」
  assert.ok(Math.abs(wV - 15) <= 1 && Math.abs(wU - 19) <= 1, `${wV}, ${wU}`);
});

test('種を変えても同じ国：迷路の値で、まん中1つでも数か所でも迷路（しま）になる', () => {
  for (const seed of ['center', 'random']) {
    const s = run(P('maze'), {}, 8000, 9, 80, seed);
    const c = s.stats().cover;
    assert.ok(c > 0.3 && c < 0.62, `${seed}: cover ${c}`);
  }
});
