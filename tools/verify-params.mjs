#!/usr/bin/env node
// Gray-Scott パラメータ検証ツール（Node 22、依存なし）
//
// 教材と同じ離散化を使う：
//   lap(u)[i] = (上+下+左+右)/4 − u[i]   （周期境界）
//   u' = u + dt*( Du*lap(u) − u*v*v + F*(1−u) )
//   v' = v + dt*( Dv*lap(v) + u*v*v − (F+k)*v )
//
// 使い方:
//   node tools/verify-params.mjs            # 全部
//   node tools/verify-params.mjs presets    # プリセット6種（時間経過のスナップショット）
//   node tools/verify-params.mjs boxes      # 合格ボックスの角・辺・中心を試す
//   node tools/verify-params.mjs dt         # dt=1.0 と dt=0.8 の比較（市松模様のチェック）
//   node tools/verify-params.mjs diff       # Du=Dv、D を小さくする実験
//   node tools/verify-params.mjs special    # 全滅・一様の点
//   node tools/verify-params.mjs perf       # 速度
//   node tools/verify-params.mjs seeds      # 種の置き方の比較
// 出力: tools/out/*.png と標準出力の表

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import os from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');

// ---------------------------------------------------------------- simulation

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One explicit Euler step. Writes into u2,v2. */
function step(u, v, u2, v2, N, Du, Dv, F, k, dt) {
  const Fk = F + k;
  for (let y = 0; y < N; y++) {
    const row = y * N;
    const up = ((y - 1 + N) % N) * N;
    const dn = ((y + 1) % N) * N;
    for (let x = 0; x < N; x++) {
      const xl = x === 0 ? N - 1 : x - 1;
      const xr = x === N - 1 ? 0 : x + 1;
      const i = row + x;
      const ui = u[i], vi = v[i];
      const lu = (u[up + x] + u[dn + x] + u[row + xl] + u[row + xr]) * 0.25 - ui;
      const lv = (v[up + x] + v[dn + x] + v[row + xl] + v[row + xr]) * 0.25 - vi;
      const uvv = ui * vi * vi;
      u2[i] = ui + dt * (Du * lu - uvv + F * (1 - ui));
      v2[i] = vi + dt * (Dv * lv + uvv - Fk * vi);
    }
  }
}

/**
 * Seed styles — identical to the app engine (src/core/sim.js Sim.seed):
 *  r = max(3, round(N/24))  (square of side 2r+1, u=0.5, v=0.25)
 *  center: one square at (N>>1, N>>1)
 *  random: max(4, round(N*N/2500)) squares at random positions
 *  noise : max(8, round(N*N/1200)) squares of radius max(2, r-1), then ±0.025 noise
 *          added to u and v everywhere (v clamped at 0)
 *  line  : (tool only, experimental) a bar of squares from the centre to the right edge
 */
function makeInitial(N, seed, rng, seedV = 0.25) {
  const u = new Float32Array(N * N).fill(1);
  const v = new Float32Array(N * N);
  const sq = (cx, cy, r) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const i = ((cy + dy + N * 4) % N) * N + ((cx + dx + N * 4) % N);
      u[i] = 0.5; v[i] = seedV;
    }
  };
  const r = Math.max(3, Math.round(N / 24));
  if (seed === 'center') sq(N >> 1, N >> 1, r);
  else if (seed === 'random') {
    const n = Math.max(4, Math.round(N * N / 2500));
    for (let c = 0; c < n; c++) sq(Math.floor(rng() * N), Math.floor(rng() * N), r);
  } else if (seed === 'noise') {
    const n = Math.max(8, Math.round(N * N / 1200));
    for (let c = 0; c < n; c++) sq(Math.floor(rng() * N), Math.floor(rng() * N), Math.max(2, r - 1));
    for (let i = 0; i < N * N; i++) { u[i] += (rng() - 0.5) * 0.05; v[i] = Math.max(0, v[i] + (rng() - 0.5) * 0.05); }
  } else if (seed === 'line') {
    for (let x = N >> 1; x < N - r; x += r) sq(x, N >> 1, r);
  } else throw new Error('unknown seed ' + seed);
  return { u, v };
}

// --------------------------------------------------------------- features

function features(v, N, thr = 0.2) {
  let on = 0, sum = 0, hf = 0;
  const lab = new Int32Array(N * N).fill(-1);
  for (let i = 0; i < N * N; i++) { if (v[i] > thr) on++; sum += v[i]; }
  // high-frequency (checkerboard) indicator: mean |v - avg4(v)|
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    const a = (v[((y + N - 1) % N) * N + x] + v[((y + 1) % N) * N + x] +
      v[y * N + (x + N - 1) % N] + v[y * N + (x + 1) % N]) / 4;
    hf += Math.abs(v[i] - a);
  }
  // connected blobs (4-neighbour, periodic)
  let blobs = 0, maxBlob = 0;
  const stack = new Int32Array(N * N);
  for (let s = 0; s < N * N; s++) {
    if (v[s] <= thr || lab[s] >= 0) continue;
    let sp = 0, size = 0; stack[sp++] = s; lab[s] = blobs;
    while (sp) {
      const i = stack[--sp]; size++;
      const x = i % N, y = (i / N) | 0;
      const nb = [((y + N - 1) % N) * N + x, ((y + 1) % N) * N + x, y * N + (x + N - 1) % N, y * N + (x + 1) % N];
      for (const j of nb) if (v[j] > thr && lab[j] < 0) { lab[j] = blobs; stack[sp++] = j; }
    }
    if (size > maxBlob) maxBlob = size;
    blobs++;
  }
  return { frac: on / (N * N), mean: sum / (N * N), blobs, maxBlobFrac: maxBlob / (N * N), hf: hf / (N * N) };
}

function meanAbsDiff(a, b) {
  let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length;
}

/**
 * job: {N, Du, Dv, F, k, dt, seed, steps, snaps:[step...], rng, every}
 * returns {snaps:[{step, v}], trace:[{step, frac, blobs}], feat, change, nan}
 */
function runJob(job) {
  const { N, Du, Dv, F, k, dt, seed, steps } = job;
  const rng = mulberry32(job.rng ?? 1);
  let { u, v } = makeInitial(N, seed, rng, job.seedV);
  let u2 = new Float32Array(N * N), v2 = new Float32Array(N * N);
  const snaps = [], trace = [];
  const snapSet = new Set(job.snaps || []);
  const every = job.every || 200;
  let late = null; const lateAt = steps - (job.lateGap || 500);
  let nan = false;
  for (let t = 1; t <= steps; t++) {
    step(u, v, u2, v2, N, Du, Dv, F, k, dt);
    [u, u2] = [u2, u]; [v, v2] = [v2, v];
    if (t === lateAt) late = v.slice();
    if (t % every === 0) {
      const f = features(v, N);
      trace.push({ step: t, frac: f.frac, blobs: f.blobs, mean: f.mean });
      if (!Number.isFinite(f.mean)) { nan = true; break; }
    }
    if (snapSet.has(t)) snaps.push({ step: t, v: v.slice() });
  }
  const feat = features(v, N);
  const change = late ? meanAbsDiff(late, v) : NaN;
  if (!snapSet.has(steps)) snaps.push({ step: steps, v: v.slice() });
  return { snaps, trace, feat, change, nan, uMin: Math.min(...u), vMax: Math.max(...v) };
}

if (!isMainThread) {
  parentPort.on('message', ({ id, job }) => {
    const r = runJob(job);
    parentPort.postMessage({ id, r }, r.snaps.map((s) => s.v.buffer));
  });
}

// --------------------------------------------------------------- worker pool

function pool(jobs) {
  const n = Math.min(os.cpus().length, jobs.length);
  return new Promise((resolve) => {
    const results = new Array(jobs.length);
    let next = 0, done = 0;
    const workers = [];
    for (let w = 0; w < n; w++) {
      const wk = new Worker(fileURLToPath(import.meta.url));
      workers.push(wk);
      const feed = () => {
        if (next >= jobs.length) { wk.terminate(); return; }
        const id = next++; wk.postMessage({ id, job: jobs[id] });
      };
      wk.on('message', ({ id, r }) => {
        results[id] = r; done++;
        if (done === jobs.length) { workers.forEach((x) => x.terminate()); resolve(results); }
        else feed();
      });
      feed();
    }
  });
}

// --------------------------------------------------------------- PNG

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
// v -> colour (dark navy -> teal -> pale yellow)
const STOPS = [[0, [16, 24, 48]], [0.35, [30, 110, 140]], [0.7, [120, 200, 150]], [1, [250, 245, 190]]];
function cmap(t) {
  t = Math.max(0, Math.min(1, t));
  for (let s = 1; s < STOPS.length; s++) if (t <= STOPS[s][0]) {
    const [t0, c0] = STOPS[s - 1], [t1, c1] = STOPS[s]; const f = (t - t0) / (t1 - t0);
    return c0.map((c, j) => Math.round(c + (c1[j] - c) * f));
  }
  return STOPS[STOPS.length - 1][1];
}
/** tiles: array of rows, each row an array of {v, N}. Each tile drawn at `px` pixels (nearest/box). */
function montage(file, tiles, px = 128, gap = 3) {
  const rows = tiles.length, cols = Math.max(...tiles.map((r) => r.length));
  const W = cols * px + (cols + 1) * gap, H = rows * px + (rows + 1) * gap;
  const rgb = Buffer.alloc(W * H * 3, 255);
  tiles.forEach((row, r) => row.forEach((tile, c) => {
    if (!tile) return;
    const { v, N } = tile;
    const ox = gap + c * (px + gap), oy = gap + r * (px + gap);
    for (let y = 0; y < px; y++) for (let x = 0; x < px; x++) {
      // box-average sample
      const x0 = Math.floor(x * N / px), x1 = Math.max(x0 + 1, Math.floor((x + 1) * N / px));
      const y0 = Math.floor(y * N / px), y1 = Math.max(y0 + 1, Math.floor((y + 1) * N / px));
      let s = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { s += v[yy * N + xx]; n++; }
      const col = cmap(s / n / 0.45);
      const o = ((oy + y) * W + ox + x) * 3; rgb[o] = col[0]; rgb[o + 1] = col[1]; rgb[o + 2] = col[2];
    }
  }));
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, file), encodePNG(W, H, rgb));
  return join('tools/out', file);
}

// --------------------------------------------------------------- experiments

const BASE = { N: 192, Du: 1.0, Dv: 0.5, dt: 0.8 };

// Final values (adjusted after verification; see docs/param-report.md)
export const PRESETS = [
  { id: 'mitosis', name: '分裂する点', F: 0.0367, k: 0.0649, seed: 'center', box: [0.0345, 0.0385, 0.0635, 0.0660] },
  { id: 'spots', name: '水玉', F: 0.030, k: 0.062, seed: 'random', box: [0.026, 0.034, 0.0605, 0.0635] },
  { id: 'maze', name: '迷路', F: 0.029, k: 0.057, seed: 'random', box: [0.026, 0.032, 0.055, 0.059] },
  { id: 'coral', name: 'サンゴ/しま', F: 0.0545, k: 0.062, seed: 'random', box: [0.051, 0.058, 0.0605, 0.0635] },
  { id: 'holes', name: '穴あき', F: 0.039, k: 0.058, seed: 'random', box: [0.036, 0.042, 0.0565, 0.0595] },
  { id: 'spiral', name: 'うずまき・波', F: 0.012, k: 0.049, seed: 'random', box: [0.010, 0.014, 0.047, 0.051] },
];

const fmt = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : String(x));
function stepsToForm(trace, live) {
  // first step at which the coverage reaches 90 % of its final value
  const fin = trace[trace.length - 1].frac;
  if (fin < 0.01) return NaN;
  for (const p of trace) if (p.frac >= 0.9 * fin) return p.step;
  return NaN;
}
function line(name, r, extra = '') {
  const f = r.feat;
  return `${name.padEnd(28)} frac=${fmt(f.frac)} blobs=${String(f.blobs).padStart(4)} maxBlob=${fmt(f.maxBlobFrac, 2)} ` +
    `hf=${fmt(f.hf, 4)} change=${fmt(r.change, 4)} vMax=${fmt(r.vMax, 2)}${r.nan ? ' NaN!' : ''} ${extra}`;
}

async function presets(arg) {
  const steps = Number(arg.steps || 20000);
  const snaps = [1000, 3000, 6000, 10000, 15000, 20000].filter((s) => s <= steps);
  const jobs = PRESETS.map((p) => ({ ...BASE, ...p, steps, snaps, every: 250, lateGap: 1000 }));
  const res = await pool(jobs);
  console.log(`\n== presets (N=${BASE.N}, dt=${BASE.dt}, Du=${BASE.Du}, Dv=${BASE.Dv}) ==`);
  const rows = [];
  res.forEach((r, i) => {
    const p = PRESETS[i];
    console.log(line(`${p.id} F=${p.F} k=${p.k} ${p.seed}`, r, `form@${stepsToForm(r.trace)}`));
    console.log('   trace frac:', r.trace.filter((_, j) => j % 8 === 7).map((t) => `${t.step}:${fmt(t.frac, 2)}/${t.blobs}`).join(' '));
    rows.push(r.snaps.map((s) => ({ v: s.v, N: BASE.N })));
  });
  console.log('wrote', montage('presets.png', rows, 128), `(rows=${PRESETS.map((p) => p.id).join(',')}; cols=${snaps.join(',')})`);
}

async function seeds() {
  const styles = ['center', 'random', 'noise'];
  const jobs = [];
  for (const p of PRESETS) for (const s of styles) jobs.push({ ...BASE, F: p.F, k: p.k, seed: s, steps: 10000, every: 500 });
  const res = await pool(jobs);
  console.log('\n== seed styles (10000 steps) ==');
  const rows = [];
  PRESETS.forEach((p, i) => {
    const row = [];
    styles.forEach((s, j) => {
      const r = res[i * 3 + j];
      console.log(line(`${p.id} ${s}`, r, `form@${stepsToForm(r.trace)}`));
      row.push({ v: r.snaps.at(-1).v, N: BASE.N });
    });
    rows.push(row);
  });
  console.log('wrote', montage('seeds.png', rows, 128), '(cols=center,random,noise)');
}

async function boxes(arg) {
  const steps = Number(arg.steps || 10000);
  const which = arg.only ? PRESETS.filter((p) => arg.only.split(',').includes(p.id)) : PRESETS;
  for (const p of which) {
    const [f0, f1, k0, k1] = p.box;
    const fs = [f0, (f0 + f1) / 2, f1], ks = [k0, (k0 + k1) / 2, k1];
    const jobs = [];
    for (const F of fs) for (const k of ks) jobs.push({ ...BASE, F, k, seed: p.seed, steps, every: 500, rng: 7 });
    const res = await pool(jobs);
    console.log(`\n== box ${p.id}: F ${f0}..${f1}, k ${k0}..${k1} (${steps} steps, seed=${p.seed}) ==`);
    const rows = [];
    fs.forEach((F, a) => {
      const row = [];
      ks.forEach((k, b) => {
        const r = res[a * 3 + b];
        console.log(line(`F=${fmt(F, 4)} k=${fmt(k, 4)}`, r, `form@${stepsToForm(r.trace)}`));
        row.push({ v: r.snaps.at(-1).v, N: BASE.N });
      });
      rows.push(row);
    });
    console.log('wrote', montage(`box-${p.id}.png`, rows, 96), '(rows: F low->high, cols: k low->high)');
  }
}

async function dtTest() {
  // Compare dt=1.0 with dt=0.8 at the same simulated time; noise seed is the harshest.
  const T = 8000; const jobs = [];
  for (const p of PRESETS) for (const dt of [1.0, 0.8]) jobs.push({ ...BASE, F: p.F, k: p.k, dt, seed: 'noise', steps: Math.round(T / dt), every: 500 });
  // extra stress: high-v seeds, early steps (checkerboard would appear right away)
  const res = await pool(jobs);
  console.log(`\n== dt comparison (same time T=${T}, seed=noise) ==`);
  const rows = [];
  PRESETS.forEach((p, i) => {
    const a = res[2 * i], b = res[2 * i + 1];
    console.log(line(`${p.id} dt=1.0`, a)); console.log(line(`${p.id} dt=0.8`, b));
    rows.push([{ v: a.snaps.at(-1).v, N: BASE.N }, { v: b.snaps.at(-1).v, N: BASE.N }]);
  });
  console.log('wrote', montage('dt-compare.png', rows, 96), '(cols: dt=1.0, dt=0.8)');
  // Explicit checkerboard test: pure diffusion of a checkerboard perturbation
  for (const dt of [1.0, 0.8, 1.05]) {
    const N = 16; let u = new Float32Array(N * N), v = new Float32Array(N * N), u2 = new Float32Array(N * N), v2 = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) { u[i] = 1 + 0.01 * (((i % N) + ((i / N) | 0)) % 2 ? 1 : -1); }
    for (let t = 0; t < 50; t++) { step(u, v, u2, v2, N, 1.0, 0.5, 0.03, 0.06, dt); [u, u2] = [u2, u]; [v, v2] = [v2, v]; }
    console.log(`checkerboard perturbation of u after 50 steps, dt=${dt}: amplitude ${(Math.abs(u[0] - u[1]) / 2).toExponential(2)} (start 1e-2)`);
  }
}

async function diffusion() {
  const set = [
    { label: 'Du=1,Dv=0.5 (base)', Du: 1.0, Dv: 0.5 },
    { label: 'Du=Dv=0.5', Du: 0.5, Dv: 0.5 },
    { label: 'Du=Dv=1.0', Du: 1.0, Dv: 1.0 },
    { label: 'Du=0.5,Dv=0.25', Du: 0.5, Dv: 0.25 },
    { label: 'Du=0.25,Dv=0.125', Du: 0.25, Dv: 0.125 },
  ];
  const pats = PRESETS.filter((p) => ['mitosis', 'spots', 'maze', 'coral', 'holes'].includes(p.id));
  const jobs = [];
  for (const p of pats) for (const d of set) jobs.push({ ...BASE, F: p.F, k: p.k, Du: d.Du, Dv: d.Dv, seed: 'random', steps: 10000, every: 500 });
  const res = await pool(jobs);
  console.log('\n== diffusion experiments (random seed, 10000 steps) ==');
  const rows = [];
  pats.forEach((p, i) => {
    const row = [];
    set.forEach((d, j) => {
      const r = res[i * set.length + j];
      console.log(line(`${p.id} ${d.label}`, r));
      row.push({ v: r.snaps.at(-1).v, N: BASE.N });
    });
    rows.push(row);
  });
  console.log('wrote', montage('diffusion.png', rows, 96), `(cols: ${set.map((d) => d.label).join(' | ')})`);
}

async function special() {
  const pts = [
    { label: 'extinct F=0.030 k=0.070', F: 0.030, k: 0.070 },
    { label: 'extinct F=0.020 k=0.068', F: 0.020, k: 0.068 },
    { label: 'extinct F=0.050 k=0.072', F: 0.050, k: 0.072 },
    { label: 'uniform F=0.060 k=0.040', F: 0.060, k: 0.040 },
    { label: 'uniform F=0.080 k=0.045', F: 0.080, k: 0.045 },
    { label: 'uniform F=0.040 k=0.045', F: 0.040, k: 0.045 },
    { label: 'uniform F=0.030 k=0.040', F: 0.030, k: 0.040 },
    { label: 'low F F=0.005 k=0.040', F: 0.005, k: 0.040 },
  ];
  const jobs = pts.map((p) => ({ ...BASE, F: p.F, k: p.k, seed: 'random', steps: 6000, snaps: [500, 2000], every: 250 }));
  const res = await pool(jobs);
  console.log('\n== special points (random seed, 6000 steps) ==');
  const rows = [];
  res.forEach((r, i) => {
    console.log(line(pts[i].label, r, `meanV=${fmt(r.feat.mean, 3)} uMin=${fmt(r.uMin, 2)}`));
    rows.push(r.snaps.map((s) => ({ v: s.v, N: BASE.N })));
  });
  console.log('wrote', montage('special.png', rows, 80), '(cols: 500, 2000, 6000 steps)');
}

async function perf() {
  console.log('\n== performance (single thread, this machine) ==');
  for (const N of [128, 192, 256]) {
    const rng = mulberry32(1);
    let { u, v } = makeInitial(N, 'random', rng);
    let u2 = new Float32Array(N * N), v2 = new Float32Array(N * N);
    for (let t = 0; t < 300; t++) { step(u, v, u2, v2, N, 1, 0.5, 0.0367, 0.0649, 1); [u, u2] = [u2, u]; [v, v2] = [v2, v]; }
    const n = 3000; const t0 = performance.now();
    for (let t = 0; t < n; t++) { step(u, v, u2, v2, N, 1, 0.5, 0.0367, 0.0649, 1); [u, u2] = [u2, u]; [v, v2] = [v2, v]; }
    const ms = performance.now() - t0;
    const sps = n / ms * 1000;
    console.log(`N=${N}: ${fmt(sps, 0)} steps/s (${fmt(ms / n, 3)} ms/step, ${fmt(sps / 60, 1)} steps per frame at 60fps)`);
  }
}

async function adhoc(arg) {
  // node tools/verify-params.mjs adhoc F=0.014 k=0.045 seed=random steps=10000 [Du= Dv= dt= N=] [name=file]
  const job = { ...BASE, F: +arg.F, k: +arg.k, seed: arg.seed || 'random', steps: +(arg.steps || 10000), every: 500 };
  for (const key of ['Du', 'Dv', 'dt', 'N', 'seedV']) if (arg[key]) job[key] = +arg[key];
  const st = job.steps; job.snaps = [st / 4, st / 2, (3 * st) / 4].map(Math.round);
  const [r] = await pool([job]);
  console.log(line(`F=${job.F} k=${job.k} ${job.seed}`, r, `form@${stepsToForm(r.trace)}`));
  console.log('   trace:', r.trace.map((t) => `${t.step}:${fmt(t.frac, 2)}/${t.blobs}`).join(' '));
  if (arg.name) console.log('wrote', montage(`${arg.name}.png`, [r.snaps.map((s) => ({ v: s.v, N: job.N }))], 128));
}

async function scan(arg) {
  // node tools/verify-params.mjs scan F=0.010:0.020:3 k=0.040:0.056:5 seed=random seedV=0.5 steps=8000 name=file
  const rng = (str) => { const [a, b, n] = str.split(':').map(Number); return n > 1 ? Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1)) : [a]; };
  const fs = rng(arg.F), ks = rng(arg.k), steps = +(arg.steps || 8000);
  const jobs = [];
  for (const F of fs) for (const k of ks) {
    const job = { ...BASE, F, k, seed: arg.seed || 'random', steps, every: 500, lateGap: +(arg.gap || 500), rng: +(arg.rng || 1) };
    for (const key of ['Du', 'Dv', 'dt', 'N', 'seedV']) if (arg[key]) job[key] = +arg[key];
    jobs.push(job);
  }
  const res = await pool(jobs);
  const rows = [];
  fs.forEach((F, a) => { const row = []; ks.forEach((k, b) => {
    const r = res[a * ks.length + b];
    console.log(line(`F=${fmt(F, 4)} k=${fmt(k, 4)}`, r, `form@${stepsToForm(r.trace)}`));
    row.push({ v: r.snaps.at(-1).v, N: jobs[0].N });
  }); rows.push(row); });
  if (arg.name) console.log('wrote', montage(`${arg.name}.png`, rows, +(arg.px || 96)), '(rows: F, cols: k)');
}

if (isMainThread) {
  const [cmd = 'all', ...rest] = process.argv.slice(2);
  const arg = Object.fromEntries(rest.map((s) => s.split('=')));
  const table = { scan, presets, seeds, boxes, dt: dtTest, diff: diffusion, special, perf, adhoc };
  const t0 = Date.now();
  if (cmd === 'all') { for (const f of [perf, presets, seeds, dtTest, diffusion, special, boxes]) await f(arg); }
  else if (table[cmd]) await table[cmd](arg);
  else { console.error('unknown command', cmd); process.exit(1); }
  console.log(`\n(done in ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
