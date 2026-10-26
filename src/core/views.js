// 表示部品：色のパレット、草原ビュー（2次元）、棒グラフ（1次元）、時間グラフ、再生バー。
(function (RD) {
  const { h, cssVar, fmt } = RD.ui;

  // ---- パレット ----
  const PALETTES = {
    meadow: { name: '草とウサギ', stops: ['#4f9a45', '#a8c25e', '#d9b06a', '#9a5a2a', '#3b2010'] },
    ink: { name: 'インク', stops: ['#f7f4ea', '#a9c8e8', '#2f68b0', '#132a55'] },
    viridis: { name: 'みどり〜きいろ（見分けやすい）', stops: ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'] },
    sunset: { name: '夕焼け', stops: ['#1b1035', '#6b2d6b', '#e0604a', '#f7d38a'] },
    coral: { name: '海', stops: ['#0b2a3a', '#1f7a8c', '#f2b880', '#fff4e6'] },
    mono: { name: '白黒', stops: ['#ffffff', '#111111'] },
    candy: { name: 'パステル（ミントとたまご）', stops: ['#cfeec0', '#eef6c4', '#ffe68a', '#f6bb5f', '#b8792f'] },
    grass: { name: '草の量', stops: ['#f1ead2', '#bcd58f', '#3a8a35'] },
  };
  // ウサギの濃さ v の既定のパレット（見た目が「かわいい」ならパステル）
  const defaultPalette = () => (RD.look && RD.look() === 'cute' ? 'candy' : 'meadow');
  const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
  const lutCache = {};
  function lut(name) {
    if (lutCache[name]) return lutCache[name];
    const stops = (PALETTES[name] || PALETTES.meadow).stops.map(hex);
    const out = new Uint8ClampedArray(256 * 3);
    for (let i = 0; i < 256; i++) {
      const t = (i / 255) * (stops.length - 1);
      const j = Math.min(stops.length - 2, Math.floor(t)), f = t - j;
      for (let c = 0; c < 3; c++) out[i * 3 + c] = stops[j][c] + (stops[j + 1][c] - stops[j][c]) * f;
    }
    return (lutCache[name] = out);
  }
  const gradientCss = (name) => `linear-gradient(90deg, ${(PALETTES[name] || PALETTES.meadow).stops.join(', ')})`;
  // 値 t(0〜1) を CSS 色に
  function colorOf(name, t) {
    const L = lut(name), i = Math.max(0, Math.min(255, Math.round(t * 255))) * 3;
    return `rgb(${L[i]}, ${L[i + 1]}, ${L[i + 2]})`;
  }

  // キャンバスの内部解像度を、表示幅 × 画素密度に合わせる（スマホで文字が小さくならないように）。
  // 戻り値の W, H は CSS ピクセル。描画は CSS ピクセルの座標で行う。
  function fitCanvas(canvas, cssH, fallbackW) {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const W = Math.round(canvas.clientWidth || fallbackW), H = cssH;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, W, H };
  }
  function observeResize(el, fn) {
    if (!('ResizeObserver' in window)) return;
    let w = 0;
    new ResizeObserver((ents) => { const nw = Math.round(ents[0].contentRect.width); if (nw && nw !== w) { w = nw; fn(); } }).observe(el);
  }

  // ---- 草原ビュー（2次元） ----
  // opts: field 'v'|'u', palette, range [lo, hi], brush {mode, radius} | null,
  //       onPick(i), onPaint(), colorbar(true), title（カラーバーの見出し）, hiLabel（カラーバー右端の文字）,
  //       readout: true | false | (i) => HTML（えらんだマスの表示。既定は field に合わせる）
  class FieldView {
    constructor(sim, opts = {}) {
      this.sim = sim;
      this.field = opts.field || 'v';
      this.palette = opts.palette || (this.field === 'u' ? 'grass' : defaultPalette());
      this.autoPalette = !opts.palette && this.field !== 'u'; // 既定のパレットなら、見た目の切り替えに合わせて変える
      FieldView.live.add(this);
      this.range = opts.range || (this.field === 'u' ? [0, 1] : [0, 0.4]);
      this.brush = opts.brush || null;
      this.onPick = opts.onPick || null;
      this.onPaint = opts.onPaint || null;
      this.picked = opts.picked ?? null;
      this.showReadout = opts.readout !== false;
      this.readoutFn = typeof opts.readout === 'function' ? opts.readout : null;
      this.hiLabel = opts.hiLabel ?? null;
      const { w, hgt } = { w: sim.w, hgt: sim.h };
      this.cell = Math.max(1, Math.floor((opts.maxPx || 480) / Math.max(w, hgt)));
      this.canvas = h('canvas', { width: w * this.cell, height: hgt * this.cell, role: 'img', 'aria-label': opts.title || '草原のようす' });
      this.off = document.createElement('canvas');
      this.off.width = w; this.off.height = hgt;
      this.img = this.off.getContext('2d').createImageData(w, hgt);
      this.wrap = h('div', { class: 'sim-canvas-wrap' + (this.brush ? ' brush' : '') }, this.canvas);
      if (opts.maxCss) this.wrap.style.maxWidth = opts.maxCss;
      this.cbBar = h('div', { class: 'bar' });
      this.cbTitle = h('div', { class: 'cb-title' });
      this.cbLo = h('span'); this.cbHi = h('span');
      this.colorbar = h('div', { class: 'colorbar' }, this.cbTitle, this.cbLo, this.cbBar, this.cbHi);
      this.readout = h('div', { class: 'readout', 'aria-live': 'polite' });
      this.el = h('div', { class: 'sim-view' }, this.wrap, opts.colorbar === false ? null : this.colorbar, this.showReadout ? this.readout : null);
      this.title = opts.title;
      this._bindPointer();
      this._updateColorbar();
      this.render();
    }
    setPalette(name, auto = false) { this.palette = name; this.autoPalette = auto; this._updateColorbar(); this.render(); }
    refreshLook() { if (this.autoPalette && this.field !== 'u') this.setPalette(defaultPalette(), true); }
    setField(field, range) { this.field = field; if (range) this.range = range; this._updateColorbar(); this.render(); }
    setBrush(brush) { this.brush = brush; this.wrap.classList.toggle('brush', !!brush); }
    _updateColorbar() {
      this.cbBar.style.background = gradientCss(this.palette);
      this.cbLo.textContent = fmt(this.range[0], 2);
      this.cbHi.textContent = this.hiLabel ?? fmt(this.range[1], 2) + (this.field === 'v' ? ' 以上' : '');
      this.cbTitle.innerHTML = this.title || (this.field === 'v' ? '色 ＝ 🐇 ウサギの濃さ <i class="v">v</i>' : '色 ＝ 🌱 草の量 <i class="v">u</i>');
    }
    _cellAt(ev) {
      const r = this.canvas.getBoundingClientRect();
      const x = Math.floor(((ev.clientX - r.left) / r.width) * this.sim.w);
      const y = Math.floor(((ev.clientY - r.top) / r.height) * this.sim.h);
      return [Math.max(0, Math.min(this.sim.w - 1, x)), Math.max(0, Math.min(this.sim.h - 1, y))];
    }
    _bindPointer() {
      let painting = false, last = null;
      const paintAt = (ev) => {
        const [x, y] = this._cellAt(ev);
        const rad = this.brush.radius ?? 3;
        if (last) { // 線が途切れないように補間
          const dx = x - last[0], dy = y - last[1], n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / Math.max(1, rad / 2)));
          for (let s = 1; s <= n; s++) this.sim.paint(last[0] + (dx * s) / n, last[1] + (dy * s) / n, rad, this.brush.mode);
        } else this.sim.paint(x, y, rad, this.brush.mode);
        last = [x, y];
        this.render();
        this.onPaint && this.onPaint();
      };
      this.canvas.addEventListener('pointerdown', (ev) => {
        if (this.brush) {
          painting = true; last = null;
          this.canvas.setPointerCapture(ev.pointerId);
          paintAt(ev);
        } else {
          const [x, y] = this._cellAt(ev);
          this.pick(this.sim.idx(x, y));
        }
      });
      this.canvas.addEventListener('pointermove', (ev) => { if (painting && this.brush) paintAt(ev); });
      const end = () => { painting = false; last = null; };
      this.canvas.addEventListener('pointerup', end);
      this.canvas.addEventListener('pointercancel', end);
    }
    pick(i) {
      this.picked = i;
      this.render();
      this.onPick && this.onPick(i);
    }
    render() {
      const { sim, img } = this;
      const a = this.field === 'u' ? sim.u : sim.v;
      const L = lut(this.palette), d = img.data;
      const lo = this.range[0], span = this.range[1] - this.range[0] || 1;
      for (let i = 0; i < sim.n; i++) {
        let t = (a[i] - lo) / span;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const j = (t * 255) | 0, o = i * 4;
        d[o] = L[j * 3]; d[o + 1] = L[j * 3 + 1]; d[o + 2] = L[j * 3 + 2]; d[o + 3] = 255;
      }
      this.off.getContext('2d').putImageData(img, 0, 0);
      const ctx = this.canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.off, 0, 0, this.canvas.width, this.canvas.height);
      const c = this.cell;
      if (c >= 12) { // 小さいマス目は線を引く
        ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 1; x < sim.w; x++) { ctx.moveTo(x * c + 0.5, 0); ctx.lineTo(x * c + 0.5, sim.h * c); }
        for (let y = 1; y < sim.h; y++) { ctx.moveTo(0, y * c + 0.5); ctx.lineTo(sim.w * c, y * c + 0.5); }
        ctx.stroke();
      }
      if (this.picked != null) {
        const [x, y] = sim.xy(this.picked);
        const m = Math.max(2, c);
        ctx.lineWidth = Math.max(2, Math.round(this.canvas.width / 160));
        ctx.strokeStyle = '#ffffff'; ctx.strokeRect(x * c - m * 0.5, y * c - m * 0.5, c + m, c + m);
        ctx.strokeStyle = '#e0303a'; ctx.strokeRect(x * c - m * 0.5 - ctx.lineWidth, y * c - m * 0.5 - ctx.lineWidth, c + m + ctx.lineWidth * 2, c + m + ctx.lineWidth * 2);
        if (this.showReadout) {
          const i = this.picked;
          this.readout.innerHTML = this.readoutFn ? this.readoutFn(i)
            : `えらんだマス（${x + 1}, ${y + 1}）　` + (this.field === 'u' && !sim.terms.react
              ? `<i class="v">u</i> = ${fmt(sim.u[i], 3)}`
              : `草 <i class="v">u</i> = ${fmt(sim.u[i], 3)}　ウサギ <i class="v">v</i> = ${fmt(sim.v[i], 3)}`);
        }
      } else if (this.showReadout && !this.readout.textContent) {
        this.readout.textContent = this.brush ? 'なぞるとウサギを放せます' : 'マスをクリックすると値が見られます';
      }
    }
    // サムネイル（コレクション用）
    thumbnail(size = 96) {
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.off, 0, 0, size, size);
      return c.toDataURL('image/png');
    }
    // PNG 保存（拡大して保存）
    savePng(filename = 'pattern.png', scale = 4) {
      const c = document.createElement('canvas');
      c.width = this.sim.w * scale; c.height = this.sim.h * scale;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.off, 0, 0, c.width, c.height);
      const a = h('a', { href: c.toDataURL('image/png'), download: filename });
      document.body.appendChild(a); a.click(); a.remove();
    }
  }

  FieldView.live = new Set();

  // ---- 棒グラフ（1次元） ----
  // opts: get() → 配列, max, min, color（CSS 変数名）, labels（値を表示。'wide' なら幅 560px 以上のときだけ）,
  //       highlight（index）, onPick(i), width, height, refLine（基準線の値）
  class BarView {
    constructor(opts) {
      this.o = Object.assign({ min: 0, max: 1, color: '--t-u', labels: false, height: 220, highlight: null }, opts);
      this.canvas = h('canvas', { width: this.o.width || 640, height: this.o.height });
      this.el = h('div', { class: 'bars' }, this.canvas);
      observeResize(this.canvas, () => this.render());
      if (this.o.onPick) {
        this.canvas.style.cursor = 'pointer';
        this.canvas.addEventListener('pointerdown', (ev) => {
          const a = this.o.get();
          const r = this.canvas.getBoundingClientRect();
          const i = Math.floor(((ev.clientX - r.left) / r.width) * a.length);
          this.o.highlight = Math.max(0, Math.min(a.length - 1, i));
          this.o.onPick(this.o.highlight);
          this.render();
        });
      }
      this.render();
    }
    set(opts) { Object.assign(this.o, opts); this.render(); }
    render() {
      const { canvas } = this, o = this.o, a = o.get(), n = a.length;
      const { ctx, W, H } = fitCanvas(canvas, o.height, o.width || 640);
      const pad = { t: o.labels ? 26 : 10, b: 10, l: 6, r: 6 };
      ctx.clearRect(0, 0, W, H);
      const bw = (W - pad.l - pad.r) / n;
      const y = (val) => H - pad.b - ((val - o.min) / (o.max - o.min)) * (H - pad.t - pad.b);
      const base = y(Math.max(o.min, Math.min(o.max, 0)));
      const col = cssVar(o.color) || '#3a8a35', ink = cssVar('--ink-2'), acc = cssVar('--accent');
      for (let i = 0; i < n; i++) {
        const val = a[i], top = y(Math.max(o.min, Math.min(o.max, val)));
        ctx.fillStyle = col;
        ctx.globalAlpha = o.highlight === i ? 1 : 0.75;
        ctx.fillRect(pad.l + i * bw + bw * 0.1, Math.min(top, base), bw * 0.8, Math.abs(base - top));
        ctx.globalAlpha = 1;
        if (o.highlight === i) { ctx.strokeStyle = acc; ctx.lineWidth = 3; ctx.strokeRect(pad.l + i * bw + bw * 0.05, pad.t - 4, bw * 0.9, H - pad.t - pad.b + 4); }
        if (o.labels && (o.labels !== 'wide' || this.canvas.getBoundingClientRect().width >= 560 || !this.canvas.isConnected)) {
          ctx.fillStyle = ink; ctx.font = `${Math.min(15, bw * 0.38)}px sans-serif`; ctx.textAlign = 'center';
          ctx.fillText(fmt(val, o.labelDigits ?? 1), pad.l + i * bw + bw / 2, Math.min(top, base) - 6 < 12 ? 14 : Math.min(top, base) - 6);
        }
      }
      ctx.strokeStyle = ink; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad.l, base + 0.5); ctx.lineTo(W - pad.r, base + 0.5); ctx.stroke();
      if (o.refLine != null) {
        ctx.setLineDash([6, 5]); ctx.strokeStyle = acc;
        ctx.beginPath(); ctx.moveTo(pad.l, y(o.refLine)); ctx.lineTo(W - pad.r, y(o.refLine)); ctx.stroke(); ctx.setLineDash([]);
      }
    }
  }

  // ---- 時間グラフ ----
  // opts: series [{label, color:'--t-u'}], ymin, ymax, maxPoints, height, xLabel, yLabel
  class TimeGraph {
    constructor(opts) {
      this.o = Object.assign({ ymin: 0, ymax: 1, maxPoints: 400, height: 220, xLabel: '時間 →' }, opts);
      this.data = this.o.series.map(() => []);
      this.canvas = h('canvas', { width: 640, height: this.o.height });
      this.legend = h('div', { class: 'graph-legend' }, this.o.series.map((s) => h('span', { html: s.label, style: { color: `var(${s.color})` } })));
      this.el = h('div', { class: 'graph' }, this.canvas, this.legend);
      observeResize(this.canvas, () => this.render());
      this.render();
    }
    push(values) {
      values.forEach((v, i) => { const d = this.data[i]; d.push(v); if (d.length > this.o.maxPoints) d.shift(); });
    }
    clear() { this.data = this.o.series.map(() => []); this.render(); }
    render() {
      const { canvas, o } = this;
      const { ctx, W, H } = fitCanvas(canvas, o.height, 640);
      const pad = { t: 12, b: 26, l: 44, r: 10 };
      ctx.clearRect(0, 0, W, H);
      const ink = cssVar('--ink-2'), line = cssVar('--line');
      const y = (v) => H - pad.b - ((v - o.ymin) / (o.ymax - o.ymin)) * (H - pad.t - pad.b);
      ctx.font = '13px sans-serif'; ctx.fillStyle = ink; ctx.textAlign = 'right';
      const ticks = o.ticks || [o.ymin, (o.ymin + o.ymax) / 2, o.ymax];
      ctx.strokeStyle = line; ctx.lineWidth = 1;
      for (const t of ticks) {
        ctx.beginPath(); ctx.moveTo(pad.l, y(t) + 0.5); ctx.lineTo(W - pad.r, y(t) + 0.5); ctx.stroke();
        ctx.fillText(fmt(t, 2), pad.l - 6, y(t) + 4);
      }
      ctx.textAlign = 'right'; ctx.fillText(o.xLabel, W - pad.r, H - 6);
      if (o.yLabel) { ctx.textAlign = 'left'; ctx.fillText(o.yLabel, pad.l + 4, pad.t + 10); }
      const xs = (i) => pad.l + (i / Math.max(1, o.maxPoints - 1)) * (W - pad.l - pad.r);
      this.data.forEach((d, si) => {
        if (!d.length) return;
        ctx.strokeStyle = cssVar(o.series[si].color) || '#333'; ctx.lineWidth = 2.5;
        ctx.beginPath();
        d.forEach((v, i) => { const yy = y(Math.max(o.ymin - 1, Math.min(o.ymax + 1, v))); i ? ctx.lineTo(xs(i), yy) : ctx.moveTo(xs(i), yy); });
        ctx.stroke();
        const last = d[d.length - 1];
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath(); ctx.arc(xs(d.length - 1), y(Math.max(o.ymin, Math.min(o.ymax, last))), 4, 0, Math.PI * 2); ctx.fill();
      });
    }
  }

  // ---- 再生バー（ループ） ----
  // sim は RD.Sim でなくても、step(n)・steps・exploded を持つオブジェクトなら何でもよい（自作モデル可）。
  // opts: sim, onFrame()（描画）, onStep()（1コマごと。軽い処理だけ）, onReset(), onExplode(),
  //       speeds [{label, spf}]（spf = 1フレームあたりのステップ数。0.1 なら10フレームに1回）, speed（初期 index）,
  //       autoplay, showTime, timeLabel(sim),
  //       stopWhen(sim) → 止める理由の文字列 | false（毎コマ確認）, onStop(reason),
  //       watch（この要素が画面に見えているときだけ動かす。既定は再生バー自身）
  class Runner {
    constructor(opts) {
      this.o = Object.assign({ speeds: [{ label: 'ゆっくり', spf: 0.25 }, { label: 'ふつう', spf: 1 }, { label: 'はやい', spf: 8 }], speed: 1, showTime: true }, opts);
      this.sim = opts.sim;
      this.running = false;
      this.acc = 0;
      this.visible = true;
      this.playBtn = RD.ui.button('▶ 再生', () => this.toggle(), { small: true });
      this.stepBtn = RD.ui.button('1コマ進める', () => { this.pause(); this.advance(1); }, { small: true });
      this.resetBtn = this.o.onReset ? RD.ui.button('↺ はじめから', () => { this.pause(); this.setEnabled(true); this.o.onReset(); this.draw(); }, { small: true }) : null;
      this.speedSeg = this.o.speeds.length > 1 ? RD.ui.segmented(this.o.speeds.map((s, i) => ({ value: i, label: s.label })), this.o.speed, (i) => { this.o.speed = i; }) : null;
      this.timeEl = h('span', { class: 'time' });
      this.el = h('div', { class: 'playbar' }, this.playBtn, this.stepBtn, this.resetBtn, this.speedSeg && this.speedSeg.el, this.o.showTime ? this.timeEl : null);
      this._tick = this._tick.bind(this);
      if ('IntersectionObserver' in window) {
        this.io = new IntersectionObserver((ents) => { this.visible = ents.some((e) => e.isIntersecting); });
        this.io.observe(this.o.watch || this.el);
      }
      this.draw();
      if (this.o.autoplay) this.play();
      Runner.all.add(this);
    }
    play() { if (this.running) return; this.running = true; this.playBtn.innerHTML = '⏸ 一時停止'; this.raf = requestAnimationFrame(this._tick); }
    pause() { this.running = false; this.playBtn.innerHTML = '▶ 再生'; cancelAnimationFrame(this.raf); }
    toggle() { this.running ? this.pause() : this.play(); }
    // 見張る要素を変える（草原と再生バーが離れているレイアウト用）
    watch(el) { if (this.io && el) { this.io.disconnect(); this.io.observe(el); } }
    // 速さを変える（index）。speeds を差し替えることもできる
    setSpeed(i, speeds) {
      if (speeds) this.o.speeds = speeds;
      this.o.speed = Math.max(0, Math.min(this.o.speeds.length - 1, i));
      if (this.speedSeg) this.speedSeg.set(this.o.speed, false);
    }
    // 再生・1コマのボタンを使えなくする（爆発したときなど）
    setEnabled(on) { if (!on) this.pause(); this.playBtn.disabled = !on; this.stepBtn.disabled = !on; }
    destroy() { this.pause(); this.io && this.io.disconnect(); Runner.all.delete(this); }
    advance(n) {
      for (let i = 0; i < n; i++) {
        this.sim.step(1);
        this.o.onStep && this.o.onStep(this.sim);
        if (this.sim.exploded) { this.pause(); this.o.onExplode && this.o.onExplode(); break; }
        const why = this.o.stopWhen && this.o.stopWhen(this.sim);
        if (why) { this.pause(); this.o.onStop && this.o.onStop(why); break; }
      }
      this.draw();
    }
    draw() {
      this.o.onFrame && this.o.onFrame(this.sim);
      if (this.o.showTime) this.timeEl.textContent = this.o.timeLabel ? this.o.timeLabel(this.sim) : `${this.sim.steps} コマ目`;
    }
    _tick() {
      if (!this.running) return;
      if (!this.el.isConnected) { this.destroy(); return; }
      if (this.visible) {
        this.acc += this.o.speeds[this.o.speed].spf;
        const n = Math.floor(this.acc);
        if (n > 0) { this.acc -= n; this.advance(n); }
      }
      this.raf = requestAnimationFrame(this._tick);
    }
  }
  Runner.all = new Set();
  Runner.stopAll = () => { for (const r of [...Runner.all]) r.destroy(); };

  RD.PALETTES = PALETTES;
  RD.defaultPalette = defaultPalette;
  RD.colorOf = colorOf;
  RD.gradientCss = gradientCss;
  RD.FieldView = FieldView;
  RD.BarView = BarView;
  RD.TimeGraph = TimeGraph;
  RD.Runner = Runner;
})(window.RD = window.RD || {});
