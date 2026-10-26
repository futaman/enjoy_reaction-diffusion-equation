// Gray-Scott モデルのシミュレーションエンジン。DOM には触らない（Node のテストでも動く）。
//
//   ∂u/∂t = Du∇²u − uv² + F(1−u)
//   ∂v/∂t = Dv∇²v + uv² − (F+k)v
//
// この教材での ∇² は「まわりの平均 − 自分」。
//   2次元: 上下左右4マスの平均 − 自分 / 1次元: 左右2マスの平均 − 自分 / 0次元（1マス）: 0
// 端はパックマン型（反対側とつながっている）。時間はオイラー法で進める。
(function (RD) {
  const TERM_KEYS = ['diff', 'feed', 'react', 'decay'];

  class Sim {
    // w×h のマス。h=1 で1次元、w=h=1 で0次元（1か所だけ）。
    constructor(opts = {}) {
      const d = RD.SIM_DEFAULTS || {};
      this.w = opts.w || 1;
      this.h = opts.h || 1;
      this.n = this.w * this.h;
      this.Du = opts.Du ?? d.Du ?? 1.0;
      this.Dv = opts.Dv ?? d.Dv ?? 0.5;
      this.F = opts.F ?? 0.04;
      this.k = opts.k ?? 0.06;
      this.dt = opts.dt ?? d.dt ?? 0.8; // Du×dt = 1 ちょうどだとマス目状に振動して壊れるので、少し小さめ
      this.terms = Object.assign({ diff: true, feed: true, react: true, decay: true }, opts.terms || {});
      this.u = new Float32Array(this.n);
      this.v = new Float32Array(this.n);
      this._u = new Float32Array(this.n);
      this._v = new Float32Array(this.n);
      this.time = 0;
      this.steps = 0;
      this.exploded = false;
      this.reset();
    }

    get dim() { return this.n === 1 ? 0 : this.h === 1 ? 1 : 2; }
    idx(x, y = 0) { return y * this.w + x; }
    xy(i) { return [i % this.w, Math.floor(i / this.w)]; }

    reset(u0 = 1, v0 = 0) {
      this.u.fill(u0); this.v.fill(v0);
      this.time = 0; this.steps = 0; this.exploded = false;
      return this;
    }

    // まわりの平均（端はパックマン型）
    neighborAvg(a, i) {
      const { w, h } = this;
      if (this.n === 1) return a[i];
      const x = i % w, y = (i - x) / w;
      const l = a[y * w + (x === 0 ? w - 1 : x - 1)];
      const r = a[y * w + (x === w - 1 ? 0 : x + 1)];
      if (h === 1) return (l + r) / 2;
      const up = a[(y === 0 ? h - 1 : y - 1) * w + x];
      const dn = a[(y === h - 1 ? 0 : y + 1) * w + x];
      return (l + r + up + dn) / 4;
    }
    lap(a, i) { return this.neighborAvg(a, i) - a[i]; }

    // 1マスの「家計簿」。各項の値と、次のコマの値。
    breakdown(i) {
      const { u, v, F, k, Du, Dv, dt, terms } = this;
      const ui = u[i], vi = v[i];
      const avgU = this.neighborAvg(u, i), avgV = this.neighborAvg(v, i);
      const lapU = avgU - ui, lapV = avgV - vi;
      const diffU = terms.diff ? Du * lapU : 0;
      const diffV = terms.diff ? Dv * lapV : 0;
      const feed = terms.feed ? F * (1 - ui) : 0;
      const react = terms.react ? ui * vi * vi : 0;
      const decay = terms.decay ? (F + k) * vi : 0;
      const dudt = diffU - react + feed;
      const dvdt = diffV + react - decay;
      return { u: ui, v: vi, avgU, avgV, lapU, lapV, diffU, diffV, feed, react, decay, dudt, dvdt, uNext: ui + dt * dudt, vNext: vi + dt * dvdt, dt };
    }

    step(count = 1) {
      for (let s = 0; s < count; s++) {
        if (this.dim === 2) this._step2d(); else this._stepGeneric();
        this.time += this.dt;
        this.steps++;
      }
      return this;
    }

    _stepGeneric() {
      const { n, u, v, _u, _v } = this;
      for (let i = 0; i < n; i++) {
        const b = this.breakdown(i);
        _u[i] = b.uNext; _v[i] = b.vNext;
      }
      this._swap();
    }

    // 2次元の高速版（breakdown と同じ計算）
    _step2d() {
      const { w, h, u, v, _u, _v, dt } = this;
      const diff = this.terms.diff ? 1 : 0, feedOn = this.terms.feed ? 1 : 0, reactOn = this.terms.react ? 1 : 0, decayOn = this.terms.decay ? 1 : 0;
      const Du = this.Du * diff * 0.25, Dv = this.Dv * diff * 0.25;
      const DuS = this.Du * diff, DvS = this.Dv * diff;
      const F = this.F, Fk = this.F + this.k;
      for (let y = 0; y < h; y++) {
        const row = y * w;
        const up = (y === 0 ? h - 1 : y - 1) * w;
        const dn = (y === h - 1 ? 0 : y + 1) * w;
        for (let x = 0; x < w; x++) {
          const i = row + x;
          const xl = row + (x === 0 ? w - 1 : x - 1);
          const xr = row + (x === w - 1 ? 0 : x + 1);
          const ui = u[i], vi = v[i];
          const sumU = u[xl] + u[xr] + u[up + x] + u[dn + x];
          const sumV = v[xl] + v[xr] + v[up + x] + v[dn + x];
          const uvv = reactOn * ui * vi * vi;
          _u[i] = ui + dt * (Du * sumU - DuS * ui - uvv + feedOn * F * (1 - ui));
          _v[i] = vi + dt * (Dv * sumV - DvS * vi + uvv - decayOn * Fk * vi);
        }
      }
      this._swap();
    }

    _swap() {
      [this.u, this._u] = [this._u, this.u];
      [this.v, this._v] = [this._v, this.v];
      // 爆発チェック（数マスだけ見る）
      const a = this.u[0], b = this.v[(this.n / 2) | 0];
      if (!isFinite(a) || !isFinite(b) || Math.abs(a) > 1e6 || Math.abs(b) > 1e6) this.exploded = true;
    }

    // ---- 種まき ----
    // 正方形の種。r は半径（マス）。
    seedSquare(cx, cy, r = 4, val = { u: 0.5, v: 0.25 }) {
      const { w, h } = this;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const x = (cx + dx + w * 4) % w, y = (cy + dy + h * 4) % h;
        const i = y * w + x;
        this.u[i] = val.u; this.v[i] = val.v;
      }
      return this;
    }
    // 円形のブラシ（ラボ用）。value: 'rabbit' で種を置く、'erase' で消す
    paint(cx, cy, r, mode = 'rabbit') {
      const { w, h } = this;
      const R = Math.max(0.5, r);
      for (let dy = -Math.ceil(R); dy <= Math.ceil(R); dy++) for (let dx = -Math.ceil(R); dx <= Math.ceil(R); dx++) {
        if (dx * dx + dy * dy > R * R) continue;
        const x = ((Math.round(cx) + dx) % w + w) % w, y = ((Math.round(cy) + dy) % h + h) % h;
        const i = y * w + x;
        if (mode === 'erase') { this.u[i] = 1; this.v[i] = 0; } else { this.u[i] = 0.5; this.v[i] = 0.25; }
      }
      return this;
    }
    seedRandom(count = 10, r = 4, rand = Math.random) {
      for (let c = 0; c < count; c++) this.seedSquare(Math.floor(rand() * this.w), Math.floor(rand() * this.h), r);
      return this;
    }
    seedNoise(amount = 0.02, rand = Math.random) {
      for (let i = 0; i < this.n; i++) { this.u[i] += (rand() - 0.5) * amount; this.v[i] = Math.max(0, this.v[i] + (rand() - 0.5) * amount); }
      return this;
    }
    // 'center' | 'random' | 'noise'（模様のプリセットと同じ名前）
    seed(style = 'center', rand = Math.random) {
      this.reset();
      const r = Math.max(3, Math.round(Math.min(this.w, this.h) / 24));
      if (style === 'random') this.seedRandom(Math.max(4, Math.round(this.n / 2500)), r, rand);
      else if (style === 'noise') { this.seedRandom(Math.max(8, Math.round(this.n / 1200)), Math.max(2, r - 1), rand); this.seedNoise(0.05, rand); }
      else this.seedSquare(this.w >> 1, this.h >> 1, r);
      return this;
    }

    setParams(p) {
      for (const key of ['Du', 'Dv', 'F', 'k', 'dt']) if (p[key] != null) this[key] = +p[key];
      if (p.terms) Object.assign(this.terms, p.terms);
      return this;
    }
    snapshot() { return { u: this.u.slice(), v: this.v.slice(), time: this.time, steps: this.steps }; }
    restore(s) { this.u.set(s.u); this.v.set(s.v); this.time = s.time; this.steps = s.steps; this.exploded = false; return this; }

    // 統計（判定用）
    stats(th = 0.2) {
      let cover = 0, sumV = 0, maxV = -Infinity, minU = Infinity;
      for (let i = 0; i < this.n; i++) { const vi = this.v[i]; sumV += vi; if (vi > th) cover++; if (vi > maxV) maxV = vi; if (this.u[i] < minU) minU = this.u[i]; }
      return { cover: cover / this.n, meanV: sumV / this.n, maxV, minU };
    }
  }

  RD.Sim = Sim;
  RD.TERM_KEYS = TERM_KEYS;
})(window.RD = window.RD || {});
