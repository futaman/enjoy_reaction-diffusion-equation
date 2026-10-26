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

test('F-k マップ：いくつかのマスを RD.Sim で作り直すと同じ国になる（tmp/fixC/encode-map.mjs と同じ分類）', () => {
  const M = C.MAP;
  // 種は random（seeded(11)）。最後の 600 コマで、動き具合メーターと同じ量（60 コマの |Δv| の平均）を測る。
  const rebuild = (F, k, N, steps) => {
    const s = new RD.Sim({ w: N, h: N, F, k, Du: 1, Dv: 0.5, dt: 0.8 });
    s.seed('random', C.seeded(11));
    s.step(steps - 600);
    let meter = 0;
    for (let w = 0; w < 10; w++) { const late = s.v.slice(); s.step(60); let c = 0; for (let j = 0; j < s.n; j++) c += Math.abs(s.v[j] - late[j]); meter += c / s.n / 10; }
    let sum = 0, sq = 0, mx = 0, cover = 0;
    for (let j = 0; j < s.n; j++) { sum += s.v[j]; sq += s.v[j] ** 2; mx = Math.max(mx, s.v[j]); if (s.v[j] > 0.2) cover++; }
    const mean = sum / s.n, std = Math.sqrt(Math.max(0, sq / s.n - mean * mean));
    const c = mx < 0.05 ? '.' : std < 0.02 ? 'U' : meter > 5e-3 ? 'L' : cover / s.n < 0.3 ? 'o' : cover / s.n < 0.62 ? '=' : '#';
    return { c, meter };
  };
  const at = (F, k) => M.cls[Math.round((F - M.F0) / M.FS) * M.nK + Math.round((k - M.K0) / M.KS)];
  // 一様（帯の外：64×64・30000 コマ）
  assert.equal(rebuild(0.06, 0.04, 64, 30000).c, at(0.06, 0.04));
  // 迷路・サンゴ・うずまき（帯の中：128×128・24000 コマ）
  for (const [F, k] of [[0.03, 0.057], [0.055, 0.062], [0.015, 0.051]]) {
    const r = rebuild(F, k, 128, 24000);
    assert.equal(r.c, at(F, k), `F=${F}, k=${k}（メーター ${r.meter.toExponential(1)}）`);
  }
});

test('F-k マップ：サンゴのマスは、動き具合メーターでは「ほとんど止まっています」（1.5×10⁻³ 未満）', () => {
  const pt = P('coral');
  const s = new RD.Sim({ w: 128, h: 128, F: pt.F, k: pt.k });
  s.seed('random', C.seeded(11));
  s.step(12000);
  let prev = s.v.slice(), m = 0;
  s.step(60); for (let i = 0; i < s.n; i++) m += Math.abs(s.v[i] - prev[i]);
  assert.ok(m / s.n < 1.5e-3, String(m / s.n));
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

test('草原で起きていること：草のへこみ（谷の1割以上）はウサギの山（1割以上）より外側まで広がる（デモと同じ水玉の値、まだ点が1つの 400 コマ目）', () => {
  const s = run(P('spots'), {}, 400, 1, 96, 'center');
  assert.equal(C.countGroups(s), 1, 'まだ点は1つ');
  let mi = 0; for (let i = 1; i < s.n; i++) if (s.v[i] > s.v[mi]) mi = i;
  const y = Math.floor(mi / s.w), rowU = [], rowV = [];
  for (let x = 0; x < s.w; x++) { rowU.push(s.u[y * s.w + x]); rowV.push(s.v[y * s.w + x]); }
  const uMin = Math.min(...rowU), uMax = Math.max(...rowU), vMax = Math.max(...rowV);
  const wU = rowU.filter((u) => u < uMax - 0.1 * (uMax - uMin)).length, wV = rowV.filter((v) => v > 0.1 * vMax).length;
  assert.ok(wU > wV, `草の谷 ${wU} マス、ウサギの山 ${wV} マス`);
  // 本文の「約 19 マス／約 25 マス」
  assert.ok(Math.abs(wV - 19) <= 1 && Math.abs(wU - 25) <= 1, `${wV}, ${wU}`);
});

test('種を変えても同じ国：迷路の値で、デモの2つの種（数か所／あちこち少しずつ）のどちらでも迷路（しま）になる', () => {
  for (const seed of ['random', 'noise']) {
    const s = run(P('maze'), {}, 8000, 9, 80, seed);
    const c = s.stats().cover;
    assert.ok(c > 0.3 && c < 0.62, `${seed}: cover ${c}`);
  }
});

test('クリアまでの表示：内訳と、残っている問題を出す', () => {
  const st = def.clearStatus;
  assert.equal(typeof st, 'function');
  const base = ['why', 'same-d', 'small-d', 'seed', 'kind'];
  // 問題5を飛ばして再現を4つ：8問解いてもクリアではない
  const s1 = ['why', 'same-d', 'small-d', 'seed', 'rep-spots', 'rep-maze', 'rep-holes', 'rep-coral'];
  assert.equal(def.isCleared(s1), false);
  assert.equal(st(s1), '問題4/5・再現4/3・残り問題5');
  assert.equal(st(['why', 'small-d', 'seed', 'kind', 'rep-spots']), '問題4/5・再現1/3・残り予想2');
  assert.equal(st([...base, 'rep-spots']), '問題5/5・再現1/3');
  assert.equal(st(['kind']), '問題1/5・再現0/3');
  // ヘッダーの表示は折り返さないので短く（「クリアまで：」とあわせて 360px に収まる長さ）
  for (const ids of [s1, [], base]) assert.ok(st(ids).length <= 17, st(ids));
  assert.equal(def.isCleared([...base, 'rep-spots', 'rep-maze', 'rep-holes']), true);
});

// 例外：迷路の合格ボックスの角（F = 0.0275, k = 0.0577）は、地図では F 0.0275・k 0.058 のマス（k 0.0575〜0.0585）に入る。
// このあたりは迷路と水玉の境目で、128×128 でも 192×192 でも 36000 コマまで線と点が入れかわりつづける（メーターでは「動いている」）。
// 地図の分類は正しいので、ボックスの角を少し内側にする（patterns.js の maze.box.kMax を 0.0574 以下、または fMin を 0.029 以上）のがよい。
const KNOWN_EDGE = []; // 例外のマス（地図では動きつづける国になる箱の角）。いまは無し

test('F-k マップ：プリセットの点と合格ボックスの4つの角が、模様のタイプ（完成する／生きている）と同じ国にある', () => {
  for (const pt of pats) {
    const b = pt.box;
    const pts = [[pt.F, pt.k, '代表値'], [b.fMin, b.kMin, '角'], [b.fMin, b.kMax, '角'], [b.fMax, b.kMin, '角'], [b.fMax, b.kMax, '角'], [(b.fMin + b.fMax) / 2, (b.kMin + b.kMax) / 2, '中心']];
    // ボックスの中に中心があるマスも全部
    const M = C.MAP;
    for (let fi = 0; fi < M.nF; fi++) for (let ki = 0; ki < M.nK; ki++) {
      const F = M.F0 + fi * M.FS, k = M.K0 + ki * M.KS;
      if (C.inBox(pt, F, k)) pts.push([F, k, 'ボックスの中のマス']);
    }
    for (const [F, k, what] of pts) {
      const c = C.classAt(F, k);
      if (KNOWN_EDGE.some(([id, f, kk]) => id === pt.id && f === F && kk === k)) { assert.equal(c, 'L', '例外のマスが変わったら KNOWN_EDGE を消す'); continue; }
      assert.ok(C.kindMatches(pt.kind, c), `${pt.id}（${pt.kind}）の${what} F=${F}, k=${k} → ${c}`);
    }
    // ヒント1に出す国の名前は、模様のタイプと食いちがわない
    assert.ok(C.homeCountry(pt), pt.id);
  }
});

test('ヒント1：国の名前は、模様のタイプと合う国のときだけ出す', () => {
  assert.equal(C.kindMatches('still', 'L'), false);
  assert.equal(C.kindMatches('live', '='), false);
  assert.equal(C.kindMatches('still', '.'), false);
  for (const c of ['o', '=', '#']) assert.equal(C.kindMatches('still', c), true);
  assert.equal(C.kindMatches('live', 'L'), true);
});
