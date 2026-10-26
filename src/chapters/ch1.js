// 第1章：変化の速さ（★T01, T06 / A01 貯金箱の帳簿, A03 パラパラ漫画 / M06 1コマ送り）
// ねらい：「新しい値 = 今の値 + 速さ × 時間」が使えるようになる。
(function (RD) {
  const { h, p, step, note, more, teacher, card, fmt } = RD.ui;

  // ---- 計算の部品（テストからも使う。DOM に触らない） ----
  const round9 = (x) => Math.round(x * 1e9) / 1e9;
  // 速さが一定のときの1コマ
  const stepConst = (amount, speed, dt) => round9(amount + speed * dt);
  // 「満タン（1）までの残りの rate 割ずつ増える」ときの速さ
  const growthSpeed = (amount, rate = 0.1) => rate * (1 - amount);
  // 刻み dt で tmax まで進めた点の列 [[時刻, 量], …]
  function growthRun(dt, u0 = 0.2, rate = 0.1, tmax = 30) {
    const pts = [[0, u0]];
    let u = u0, t = 0;
    while (t + dt <= tmax + 1e-9) { u = u + growthSpeed(u, rate) * dt; t = round9(t + dt); pts.push([t, u]); }
    return pts;
  }
  // なめらかな本物（コマを限りなく細かくしたとき）
  const growthExact = (t, u0 = 0.2, rate = 0.1) => 1 - (1 - u0) * Math.exp(-rate * t);

  // 問題の数字（問題文もここから作る。テストで検算する）
  const DATA = {
    savings: { start: 500, perDay: 30, days: 3, answer: 590 },
    grass: { amount: 0.4, speed: -0.1, dt: 0.5, answer: 0.35 },
    preview: { amount: 0.2, rate: 0.1, dt: 1, answer: 0.28 },
    frames: { dts: [5, 2, 1, 0.1], u0: 0.2, rate: 0.1, tmax: 30 },
  };

  // 符号つきの表示（+0.1 / −0.1 / 0）
  const sgn = (v, d = 3) => (v > 1e-12 ? '+' + fmt(v, d) : v < -1e-12 ? '−' + fmt(-v, d) : '0');

  // ことばの式。せまい画面では「＝」「＋」の前で折り返す（.math は折り返さないため）
  const wordEq = (...parts) => h('div', { class: 'ch1-eq' }, parts.map((x) => h('span', { html: x })));

  // ---- 時刻を横軸にした小さなグラフ（TimeGraph は横軸がコマ番号なので、章の中で作る） ----
  function makePlot(o) {
    o = Object.assign({ xmax: 10, xStep: 1, ymin: 0, ymax: 1, yTicks: [0, 0.25, 0.5, 0.75, 1], xLabel: '時刻（秒）→', yLabel: '', aspect: 0.5, minH: 190 }, o);
    const canvas = h('canvas', { width: 640, height: 320, role: 'img', 'aria-label': o.aria || 'グラフ' });
    const legend = h('div', { class: 'graph-legend' });
    const el = h('div', { class: 'graph' }, canvas, legend);
    let series = [];
    let lastW = 0;
    function draw(s) {
      if (s) series = s;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cssW = canvas.clientWidth || 640;
      const cssH = Math.round(Math.max(o.minH, cssW * o.aspect));
      lastW = cssW;
      const W = Math.round(cssW * dpr), H = Math.round(cssH * dpr);
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      const pad = { l: 40, r: 12, t: 12, b: 40 };
      const X = (t) => pad.l + (t / o.xmax) * (cssW - pad.l - pad.r);
      const Y = (v) => cssH - pad.b - ((v - o.ymin) / (o.ymax - o.ymin)) * (cssH - pad.t - pad.b);
      const ink = RD.ui.cssVar('--ink-2') || '#5d636c', line = RD.ui.cssVar('--line') || '#ddd';
      ctx.font = '12px sans-serif'; ctx.lineWidth = 1; ctx.fillStyle = ink; ctx.strokeStyle = line;
      ctx.textAlign = 'right';
      for (const t of o.yTicks) {
        ctx.beginPath(); ctx.moveTo(pad.l, Math.round(Y(t)) + 0.5); ctx.lineTo(cssW - pad.r, Math.round(Y(t)) + 0.5); ctx.stroke();
        ctx.fillText(fmt(t, 2), pad.l - 5, Y(t) + 4);
      }
      ctx.textAlign = 'center';
      const every = cssW < 420 && o.xmax / o.xStep > 10 ? 2 : 1;
      for (let k = 0, t = 0; t <= o.xmax + 1e-9; k++, t = round9(t + o.xStep)) {
        ctx.beginPath(); ctx.moveTo(Math.round(X(t)) + 0.5, cssH - pad.b); ctx.lineTo(Math.round(X(t)) + 0.5, cssH - pad.b + 4); ctx.stroke();
        if (k % every === 0) ctx.fillText(fmt(t, 1), X(t), cssH - pad.b + 16);
      }
      ctx.textAlign = 'right'; ctx.fillText(o.xLabel, cssW - pad.r, cssH - 4);
      if (o.yLabel) { ctx.textAlign = 'left'; ctx.fillText(o.yLabel, pad.l + 4, pad.t + 12); }
      for (const s of series) {
        if (!s.points || !s.points.length) continue;
        const col = RD.ui.cssVar(s.color) || '#3a8a35';
        ctx.save();
        ctx.globalAlpha = s.alpha ?? 1; ctx.strokeStyle = col; ctx.fillStyle = col;
        ctx.lineWidth = s.width ?? 2.5; ctx.setLineDash(s.dash ? [6, 5] : []);
        ctx.beginPath();
        s.points.forEach(([t, v], i) => (i ? ctx.lineTo(X(t), Y(v)) : ctx.moveTo(X(t), Y(v))));
        ctx.stroke();
        ctx.setLineDash([]);
        if (s.dots && s.points.length <= 80) {
          for (const [t, v] of s.points) { ctx.beginPath(); ctx.arc(X(t), Y(v), s.dots === true ? 4 : s.dots, 0, Math.PI * 2); ctx.fill(); }
        }
        if (s.head) {
          const [t, v] = s.points[s.points.length - 1];
          ctx.beginPath(); ctx.arc(X(t), Y(v), 6.5, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = RD.ui.cssVar('--card') || '#fff'; ctx.lineWidth = 2; ctx.stroke();
        }
        ctx.restore();
      }
    }
    const setLegend = (items) => legend.replaceChildren(...items.map((it) => h('span', { html: it.label, style: { color: `var(${it.color})` }, class: it.dash ? 'ch1-dash' : null })));
    let ro = null;
    if ('ResizeObserver' in window) {
      ro = new ResizeObserver(() => { if (canvas.clientWidth && canvas.clientWidth !== lastW) draw(); });
      ro.observe(el);
    }
    return { el, draw, setLegend, destroy: () => ro && ro.disconnect() };
  }

  const CSS = `
  .ch1-piggy { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
  .ch1-piggy th, .ch1-piggy td { padding: 4px 8px; border-bottom: 1px solid var(--line); text-align: right; }
  .ch1-piggy th:first-child, .ch1-piggy td:first-child { text-align: left; }
  .ch1-piggy thead th { font-size: 0.85rem; }
  .ch1-piggy td.num { font-family: var(--font-mono); white-space: nowrap; }
  .ch1-rate { color: var(--t-react); }
  .ch1-amt { color: var(--t-u); }
  .ch1-piggy td.ch1-rate, .ch1-book td.ch1-rate { background: color-mix(in srgb, var(--t-react) 8%, transparent); }
  .ch1-piggy td.ch1-amt, .ch1-book td.ch1-amt { background: color-mix(in srgb, var(--t-u) 9%, transparent); font-weight: 700; }
  .ch1-piggy tr.zero td { outline: none; }
  .ch1-tag { display: inline-block; border-radius: 6px; padding: 0 6px; font-size: 0.8rem; font-weight: 700; border: 1.5px solid currentColor; white-space: nowrap; }
  .ch1-bookwrap { max-height: 210px; overflow-y: auto; border: 1px solid var(--line); border-radius: 8px; margin-top: 8px; }
  .ch1-book { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  .ch1-book th { position: sticky; top: 0; background: var(--card-2); font-size: 0.78rem; line-height: 1.35; padding: 4px 6px; text-align: right; }
  .ch1-book td { padding: 2px 6px; border-bottom: 1px solid var(--line); text-align: right; font-family: var(--font-mono); white-space: nowrap; }
  .ch1-book th:first-child, .ch1-book td:first-child { text-align: left; }
  .ch1-book tr.last td { box-shadow: inset 0 -2px 0 var(--accent); }
  .ch1-next { background: var(--card-2); border-radius: 8px; padding: 6px 10px; font-size: 0.92rem; margin: 8px 0; line-height: 1.7; }
  .ch1-next .warn { color: var(--ng); font-weight: 700; }
  .ch1-dash::before { content: "┅ " !important; }
  .ch1-eq { text-align: center; font-size: 1.12rem; margin: 12px 0; line-height: 1.7; }
  .ch1-eq > span { display: inline-block; white-space: nowrap; margin: 0 0.15em; }
  .ch1-ctrl { margin: 6px 0; }
  .ch1-ctrl .lbl { font-size: 0.92rem; margin-right: 4px; }
  .ch1-ctrl .seg button { padding: 4px 10px; }
  `;

  RD.registerChapter({
    id: 'ch1',
    no: 1,
    title: '変化の速さ',
    desc: '「量」と「速さ」を区別して、次のコマの値を計算します。',
    goal: '「新しい値 ＝ 今の値 ＋ 速さ × 時間」が使えるようになる',
    // 仕様の4問に、観察するだけでクリアになる予想問題（T06）を1つ足したので 5。
    // 全問を条件にして、いちばん大事な T01 の問題（問題3）を飛ばせないようにしている。
    required: 5,
    data: DATA,
    lib: { stepConst, growthSpeed, growthRun, growthExact },

    render(root, ctx) {
      root.appendChild(h('style', { text: CSS }));
      const plots = [];
      ctx.onCleanup(() => plots.forEach((pl) => pl.destroy()));

      // ================= 1. 貯金箱の帳簿（A01, T01） =================
      const piggy = h('table', { class: 'ch1-piggy' },
        h('thead', null, h('tr', null,
          h('th', { text: '日' }),
          h('th', { html: '<span class="ch1-tag ch1-rate">帳簿</span><br>その日の増減' }),
          h('th', { html: '<span class="ch1-tag ch1-amt">残高</span><br>貯金箱の中身' }))),
        h('tbody', null,
          [['はじめ', '', '500 円'], ['1日目', '+30 円', '530 円'], ['2日目', '+30 円', '560 円'], ['3日目', '−20 円', '540 円'], ['4日目', '0 円', '540 円']].map(([d, a, b]) =>
            h('tr', null, h('td', { text: d }), h('td', { class: 'num ch1-rate', text: a }), h('td', { class: 'num ch1-amt', text: b })))));

      root.appendChild(step({
        title: '「量」と「速さ」はちがうもの',
        text: [
          p('まずは、おこづかいの貯金箱で考えてみましょう。🐷'),
          p('貯金箱には、2種類の数があります。'),
          h('ul', null,
            h('li', { html: '<b class="ch1-amt">残高</b>：いま貯金箱に<b>いくら入っているか</b>（量）' }),
            h('li', { html: '<b class="ch1-rate">帳簿</b>：1日に<b>いくら増えたか・減ったか</b>（変化の速さ）' })),
          p('「貯金箱の帳簿と残高」の表を見てください。帳簿に「+30 円」と書いてあっても、残高が 30 円なのではありません。残高は、前の日の残高に帳簿の分を<b>足して</b>決まります。'),
          note('<p>4日目の帳簿は <b>0 円</b>です。でも、残高は <b>540 円</b>のまま。0 円になったわけではありません。<br>「速さが 0」は「<b>変わらない</b>」という意味です。</p>'),
          p('何日か分をまとめると、こう書けます。'),
          wordEq('新しい残高', '＝ 今の残高', '＋ <span class="ch1-rate">1日の増減 × 日数</span>'),
          p('この章では、これをもう少し広く、次の形で使います。'),
          wordEq('<b>新しい値</b>', '<b>＝ 今の値</b>', '<b>＋ <span class="ch1-rate">速さ × 時間</span></b>'),
        ],
        demo: [card('🐷 貯金箱の帳簿と残高', piggy,
          h('p', { class: 'muted', html: '<span class="ch1-rate">■</span> 帳簿＝変化の速さ　<span class="ch1-amt">■</span> 残高＝量' }))],
      }));

      const S = DATA.savings;
      root.appendChild(ctx.quiz({
        id: 'savings', type: 'number',
        q: `<p>貯金箱に <b>${S.start} 円</b>入っています。毎日 <b>+${S.perDay} 円</b>ずつ貯金します。<br>${S.days}日後の<b>残高</b>はいくらですか？</p>`,
        unit: '円',
        answer: S.answer,
        tol: 0.01,
        hints: [
          '「新しい値 ＝ 今の値 ＋ 速さ × 時間」に当てはめます。今の値は 500 円、速さは 1日に +30 円です。',
          `${S.days}日で増える分は ${S.perDay} × ${S.days} ＝ ${S.perDay * S.days} 円です。`,
          `今の残高 ${S.start} 円に、増えた ${S.perDay * S.days} 円を足します。`,
        ],
        answerText: `${S.start} ＋ ${S.perDay} × ${S.days} ＝ ${S.start} ＋ ${S.perDay * S.days} ＝ <b>${S.answer} 円</b>`,
        wrong: (v) => {
          if (Math.abs(v - S.perDay * S.days) < 0.01) return `<p>${S.perDay * S.days} 円は、${S.days}日間で<b>増えた分</b>（帳簿の合計）です。聞いているのは<b>残高</b>。もとの ${S.start} 円はどこへ行ったでしょう？</p>`;
          if (Math.abs(v - (S.start + S.perDay)) < 0.01) return `<p>それは<b>1日後</b>の残高です。${S.days}日分の増え方を足しましょう。</p>`;
          return null;
        },
        explain: `<p>${S.start} ＋ ${S.perDay} × ${S.days} ＝ ${S.answer} 円。「増えた分（${S.perDay * S.days} 円）」と「残高（${S.answer} 円）」は別の数です。</p>`,
      }));

      // ================= 2. 草原の1か所（デモ：帳簿と残高が並んで進む） =================
      const U0 = 0.3, XMAX1 = 10;
      const m1 = {
        speed: 0.1, dt: 1, t: 0, u: U0, steps: 0, exploded: false, msg: '', pts: [[0, U0]], rows: [],
        reset() { this.t = 0; this.u = U0; this.steps = 0; this.exploded = false; this.msg = ''; this.pts = [[0, U0]]; this.rows = []; },
        step() {
          this.exploded = false;
          const next = stepConst(this.u, this.speed, this.dt);
          const t2 = round9(this.t + this.dt);
          if (t2 > XMAX1 + 1e-9) { this.exploded = true; this.msg = `グラフの右はし（${XMAX1} 秒）まで来ました。「↺ はじめから」でもう一度どうぞ。`; return this; }
          if (next > 1 + 1e-9) { this.exploded = true; this.msg = 'これ以上は満タン（1）をこえてしまいます。速さを 0 かマイナスにしてみましょう。'; return this; }
          if (next < -1e-9) { this.exploded = true; this.msg = '草が 0 より少なくなってしまいます。速さを 0 かプラスにしてみましょう。'; return this; }
          this.rows.push({ t0: this.t, t: t2, speed: this.speed, change: round9(this.speed * this.dt), u: next });
          this.u = next; this.t = t2; this.steps++; this.msg = '';
          this.pts.push([t2, next]);
          return this;
        },
      };
      const plot1 = makePlot({ xmax: XMAX1, xStep: 1, yLabel: '🌱 草の量（1 ＝ 満タン）', aria: '草の量の時間変化のグラフ' });
      plots.push(plot1);
      plot1.setLegend([{ label: '草の量（残高）', color: '--t-u' }]);
      const bookBody = h('tbody');
      const bookWrap = h('div', { class: 'ch1-bookwrap' }, h('table', { class: 'ch1-book' },
        h('thead', null, h('tr', null,
          h('th', { text: '時刻' }),
          h('th', { class: 'ch1-rate', html: '速さ<br>（毎秒）' }),
          h('th', { class: 'ch1-rate', html: '帳簿<br>速さ×時間' }),
          h('th', { class: 'ch1-amt', html: '残高<br>草の量' }))),
        bookBody));
      const next1 = h('div', { class: 'ch1-next', 'aria-live': 'polite' });
      const speedSl = RD.ui.slider({
        label: '<span class="ch1-rate">速さ</span>', min: -0.2, max: 0.2, step: 0.05, value: m1.speed,
        format: (v) => '毎秒 ' + sgn(v, 2),
        onInput: (v) => { m1.speed = round9(v); m1.exploded = false; m1.msg = ''; draw1(); },
      });
      const SPF1 = 1 / 30; // 1フレームで進める秒数（10秒を約5秒で再生）
      const dtSeg = RD.ui.segmented([0.1, 0.5, 1, 2].map((v) => ({ value: v, label: v + ' 秒' })), m1.dt, (v) => {
        m1.dt = v; m1.exploded = false; m1.msg = ''; runner1.o.speeds[0].spf = SPF1 / v; draw1();
      });
      function draw1() {
        plot1.draw([{ points: m1.pts, color: '--t-u', dots: true, head: true }]);
        const rows = [h('tr', null, h('td', { text: '0 秒' }), h('td', { class: 'ch1-rate', text: '' }), h('td', { class: 'ch1-rate', text: '（はじめ）' }), h('td', { class: 'ch1-amt', text: fmt(U0, 3) }))];
        m1.rows.forEach((r, i) => rows.push(h('tr', { class: i === m1.rows.length - 1 ? 'last' : null },
          h('td', { text: fmt(r.t, 1) + ' 秒' }), h('td', { class: 'ch1-rate', text: sgn(r.speed, 2) }), h('td', { class: 'ch1-rate', text: sgn(r.change, 3) }), h('td', { class: 'ch1-amt', text: fmt(r.u, 3) }))));
        bookBody.replaceChildren(...rows);
        bookWrap.scrollTop = bookWrap.scrollHeight;
        const nx = stepConst(m1.u, m1.speed, m1.dt);
        next1.innerHTML = (m1.msg ? `<span class="warn">${m1.msg}</span><br>` : '') +
          `次のコマ（${fmt(round9(m1.t + m1.dt), 1)} 秒）：<b class="ch1-amt">${fmt(m1.u, 3)}</b> ＋ <span class="ch1-rate">(${sgn(m1.speed, 2)}) × ${m1.dt}</span> ＝ <b class="ch1-amt">${fmt(nx, 3)}</b>`;
      }
      const runner1 = new RD.Runner({
        sim: m1, speeds: [{ label: 'ふつう', spf: SPF1 / m1.dt }], speed: 0,
        onFrame: draw1, onReset: () => m1.reset(), onExplode: draw1,
        timeLabel: (s) => `時刻 ${fmt(s.t, 1)} 秒`,
      });

      root.appendChild(step({
        title: '草原の1か所で、コマを1つずつ進める',
        text: [
          p('ここからは草原の話です。🌱 草原のある1か所に注目して、そこに生えている<b>草の量</b>を数で表します。0 なら草なし、1 なら満タンです。'),
          p('貯金箱と同じで、草にも2つの数があります。'),
          h('ul', null,
            h('li', { html: '<b class="ch1-amt">草の量</b>（残高）：いま、どれだけ生えているか' }),
            h('li', { html: '<b class="ch1-rate">変化の速さ</b>（帳簿）：1秒あたり、どれだけ増えるか・減るか' })),
          p('コンピュータは、時間を少しずつ区切って（この区切りを<b>時間の刻み</b>といいます）、1コマずつ計算していきます。'),
          wordEq('新しい草の量', '＝ 今の草の量', '＋ <span class="ch1-rate">速さ × 時間の刻み</span>'),
          p('「草原の1か所」のデモで、試してみましょう。'),
          h('ol', null,
            h('li', { html: '「1コマ進める」を何回か押して、<b>帳簿</b>（速さ×時間）と<b>残高</b>（草の量）の列がどう進むか見る。' }),
            h('li', { html: '途中で<b>速さ</b>をマイナスにしてみる。グラフはどうなる？' }),
            h('li', { html: '速さを <b>0</b> にしてみる。草の量は 0 になる？' }),
            h('li', { html: '<b>時間の刻み</b>を変えてみる。1コマで進む時間が変わります。' })),
          note('<p>グラフの<b>かたむき</b>に注目してください。速さが大きいほど急な坂になり、速さが 0 だと平らになります。<b>グラフのかたむき ＝ 速さ</b>です。</p>'),
        ],
        demo: [card('🌱 草原の1か所', plot1.el,
          h('div', { class: 'ch1-ctrl' }, speedSl.el),
          h('div', { class: 'ch1-ctrl row' }, h('span', { class: 'lbl', text: '時間の刻み' }), dtSeg.el),
          next1, runner1.el, bookWrap)],
      }));

      const G = DATA.grass;
      root.appendChild(ctx.quiz({
        id: 'grass', type: 'number',
        q: `<p>ある場所の草の量が <b>${G.amount}</b> です。草は毎秒 <b>${fmt(-G.speed, 2)}</b> ずつ減っています（速さ ${sgn(G.speed, 2)}）。<br><b>${G.dt} 秒後</b>の草の量はいくつですか？</p>`,
        answer: G.answer,
        hints: [
          '「新しい値 ＝ 今の値 ＋ 速さ × 時間」です。今の値・速さ・時間はそれぞれいくつでしょう？ 速さはマイナスです。',
          `まず帳簿（変化）を出します：(−0.1) × ${G.dt} ＝ −0.05`,
          `今の草の量 ${G.amount} に −0.05 を足します（つまり 0.05 引きます）。`,
        ],
        answerText: `${G.amount} ＋ (−0.1) × ${G.dt} ＝ ${G.amount} − 0.05 ＝ <b>${G.answer}</b>`,
        wrong: (v) => {
          if (Math.abs(v - 0.3) < 1e-6) return '<p>それは<b>1秒</b>たったときの値です。いまは 0.5 秒（半分の時間）なので、減る量も半分です。</p>';
          if (Math.abs(v - 0.45) < 1e-6) return '<p>草が<b>増えて</b>しまいました。速さはマイナス（減っている）なので、草の量は少なくなるはずです。</p>';
          if (Math.abs(Math.abs(v) - 0.05) < 1e-6) return '<p>0.05 は、0.5 秒間に<b>変わった分</b>（帳簿）です。聞いているのは<b>草の量</b>（残高）。今の量 0.4 から出発しましょう。</p>';
          if (Math.abs(v + 0.1) < 1e-6 || Math.abs(v - 0.1) < 1e-6) return '<p>それは<b>速さ</b>です。速さに時間をかけて、今の量に足しましょう。</p>';
          return null;
        },
        explain: `<p>0.4 ＋ (−0.1) × 0.5 ＝ 0.4 − 0.05 ＝ 0.35。<b>速さ × 時間</b>で「変わった分」を出してから、<b>今の量</b>に足しました。</p>`,
      }));

      root.appendChild(ctx.quiz({
        id: 'zero', type: 'choice',
        q: '<p>ある場所で、草の量の<b>変化の速さが 0</b> になりました。このとき、草の量について正しいのはどれですか？<br><span class="muted">迷ったら、「草原の1か所」のデモで速さを 0 にしてみましょう。</span></p>',
        options: [
          { text: '草の量も 0 になる', why: '<p>速さ（帳簿）と量（残高）はちがう数です。帳簿が 0 円の日でも、貯金箱の残高は 0 円にはなりませんでしたね。速さ 0 は「<b>変わらない</b>」という意味です。</p>' },
          { text: '草の量は、いまの量のまま変わらない', correct: true },
          { text: '草の量は、だんだん 0 に近づいていく', why: '<p>だんだん減っていくのは、速さが<b>マイナス</b>のときです。速さが 0 なら、増えも減りもしません。</p>' },
          { text: '速さが 0 だと、次の値は計算できない', why: '<p>計算できます。新しい値 ＝ 今の値 ＋ 0 × 時間 ＝ <b>今の値</b>。0 をかけると 0 なので、何も足されないだけです。</p>' },
        ],
        hints: ['貯金箱の表の「4日目」を見てみましょう。帳簿が 0 円の日、残高はどうなっていましたか？', '式に入れてみます：新しい値 ＝ 今の値 ＋ 0 × 時間', '0 × 時間 ＝ 0 なので、新しい値 ＝ 今の値 です。'],
        explain: '<p>速さが 0 ＝「変わらない」。草が 0.6 あるなら、ずっと 0.6 のままです。グラフでは<b>平らな線</b>になります。<br>「速さ」と「量」を混ぜないことが、この先の式を読むいちばんのコツです。</p>',
      }));

      // ================= 3. 速さが変わっていくとき（予告：第5章の伏線） =================
      const PV = DATA.preview;
      root.appendChild(step({
        title: '速さが、だんだん変わっていくとき',
        text: [
          p('ここまでは、速さがずっと同じでした。でも本物の草は、こんなふうに伸びます。'),
          note('<p>🌱 草は、<b>満タン（1）までの残り</b>の <b>1割</b>ずつ、1秒ごとに増える。</p>', 'story'),
          p('草が少ないうちは、残りが多いのでぐんぐん伸びます。満タンに近づくと、残りが少ないので、ゆっくりになります。'),
          wordEq('<span class="ch1-rate">速さ</span>', '＝ （1 − 今の草の量）× 0.1'),
          p('たとえば今の草の量が 0.5 なら、残りは 1 − 0.5 ＝ 0.5、その1割で速さは毎秒 0.05。1秒後は 0.5 ＋ 0.05 × 1 ＝ 0.55 です。'),
          p('ポイントは、<b>1コマごとに速さを計算し直す</b>ことです。帳簿の行ごとに、速さがちがう数になります。'),
          more('この「満タンまでの残り」は、あとで出てくる？',
            '<p>はい。第5章で「草が生えてくる」ルールとして、ゴールの式の中にそのまま登場します。ここで手を動かしておくと、そのとき「あ、あれだ」と分かります。</p>'),
        ],
      }));

      root.appendChild(ctx.quiz({
        id: 'preview', type: 'number',
        q: `<p>草は「満タン（1）までの残りの1割ずつ」1秒ごとに増えます。今の草の量は <b>${PV.amount}</b> です。<br>1コマ（<b>${PV.dt} 秒</b>）後の草の量はいくつですか？</p>`,
        answer: PV.answer,
        hints: [
          'まず、満タンまでの残りを出します：1 − 0.2',
          '残りは 0.8。その1割（× 0.1）が速さです：0.8 × 0.1 ＝ 0.08',
          '新しい値 ＝ 0.2 ＋ 0.08 × 1',
        ],
        answerText: `残り 1 − 0.2 ＝ 0.8 → 速さ 0.8 × 0.1 ＝ 0.08 → 0.2 ＋ 0.08 × 1 ＝ <b>${PV.answer}</b>`,
        wrong: (v) => {
          if (Math.abs(v - 0.08) < 1e-6) return '<p>0.08 は<b>速さ</b>（1秒で増える分）です。今の草の量 0.2 に足しましょう。</p>';
          if (Math.abs(v - 0.3) < 1e-6) return '<p>「今の量の1割」でも「0.1 増える」でもなく、<b>満タンまでの残り</b>（1 − 0.2）の1割です。</p>';
          if (Math.abs(v - 0.22) < 1e-6) return '<p>今の量 0.2 の1割を足していませんか？ 増えるのは<b>満タンまでの残り</b>（1 − 0.2 ＝ 0.8）の1割です。</p>';
          if (Math.abs(v - 0.8) < 1e-6) return '<p>0.8 は満タンまでの<b>残り</b>です。その1割が速さになります。</p>';
          return null;
        },
        explain: '<p>残り 0.8 の1割で、速さは毎秒 0.08。0.2 ＋ 0.08 ＝ 0.28 です。次のコマでは残りが 0.72 に減るので、速さは 0.072 と少しゆっくりになります。</p>',
      }));

      // ================= 4. パラパラ漫画（T06, A03, M06） =================
      const FR = DATA.frames;
      const DT_COLORS = { 5: '--t-react', 2: '--t-decay', 1: '--t-diff', 0.1: '--t-u' };
      const exactPts = Array.from({ length: 121 }, (_, i) => { const t = (i / 120) * FR.tmax; return [t, growthExact(t, FR.u0, FR.rate)]; });
      const fullRuns = Object.fromEntries(FR.dts.map((d) => [d, growthRun(d, FR.u0, FR.rate, FR.tmax)]));
      const m2 = {
        dt: 5, i: 0, steps: 0, exploded: false,
        get pts() { return fullRuns[this.dt].slice(0, this.i + 1); },
        get t() { return fullRuns[this.dt][this.i][0]; },
        get u() { return fullRuns[this.dt][this.i][1]; },
        reset() { this.i = 0; this.steps = 0; this.exploded = false; },
        step() { this.exploded = false; if (this.i + 1 >= fullRuns[this.dt].length) { this.exploded = true; return this; } this.i++; this.steps++; return this; },
      };
      let overlay = false;
      const plot2 = makePlot({ xmax: FR.tmax, xStep: 5, yLabel: '🌱 草の量', aria: '時間の刻みごとの草の量のグラフ' });
      plots.push(plot2);
      const read2 = h('div', { class: 'ch1-next', 'aria-live': 'polite' });
      function draw2() {
        const s = [{ points: exactPts, color: '--ink-2', width: 2, dash: true }];
        if (overlay) for (const d of FR.dts) if (d !== m2.dt) s.push({ points: fullRuns[d], color: DT_COLORS[d], width: 2, alpha: 0.4, dots: 2.5 });
        s.push({ points: m2.pts, color: DT_COLORS[m2.dt], dots: true, head: true, width: 3 });
        plot2.draw(s);
        plot2.setLegend([{ label: 'なめらかな本物', color: '--ink-2', dash: true }, ...(overlay ? FR.dts : [m2.dt]).map((d) => ({ label: d + ' 秒きざみ', color: DT_COLORS[d] }))]);
        const total = fullRuns[m2.dt].length - 1;
        const ex = growthExact(m2.t, FR.u0, FR.rate);
        read2.innerHTML = `<b>${m2.dt} 秒きざみ</b>：${m2.i} / ${total} コマ目（${fmt(m2.t, 1)} 秒）<br>` +
          `草の量 <b>${fmt(m2.u, 3)}</b>　本物 ${fmt(ex, 3)}　ずれ ${sgn(m2.u - ex, 3)}`;
      }
      const SPF2 = FR.tmax / 360; // 30秒を約6秒で再生
      const runner2 = new RD.Runner({
        sim: m2, speeds: [{ label: 'ふつう', spf: SPF2 / m2.dt }], speed: 0,
        onFrame: draw2, onReset: () => m2.reset(), showTime: false,
      });
      const dtSeg2 = RD.ui.segmented(FR.dts.map((d) => ({ value: d, label: d + ' 秒' })), m2.dt, (d) => {
        runner2.pause(); m2.dt = d; m2.reset(); runner2.o.speeds[0].spf = SPF2 / d; draw2();
      });
      const overlayTg = RD.ui.toggle('ほかの刻みも重ねて見る', overlay, (v) => { overlay = v; draw2(); });
      const demo2 = card('📖 パラパラ漫画：時間の刻みをくらべる', plot2.el,
        h('div', { class: 'ch1-ctrl row' }, h('span', { class: 'lbl', text: '時間の刻み' }), dtSeg2.el),
        read2, runner2.el, h('div', { class: 'row', style: { marginTop: '6px', justifyContent: 'center' } }, overlayTg.el));

      root.appendChild(step({
        title: 'コマ送りは、パラパラ漫画',
        text: [
          p('本物の草は、なめらかに少しずつ伸びます。でもコンピュータは、<b>パラパラ漫画</b>のように、1コマずつ絵を描いていきます。📖'),
          p('1コマの間は「速さは同じ」として進め、次のコマで速さを計算し直します。だから、刻みが粗いと、本物から少しずれます。'),
          p('「パラパラ漫画」のデモは、さっきの「満タンまでの残りの1割ずつ増える」草です。0.2 から始めて、30秒ぶん進めます。点線が<b>なめらかな本物</b>です。'),
          h('ol', null,
            h('li', { html: '<b>5 秒</b>きざみで再生して、点線とくらべる。' }),
            h('li', { html: '刻みを <b>2 秒</b>、<b>1 秒</b>、<b>0.1 秒</b>と細かくしていく。' }),
            h('li', { html: '「ほかの刻みも重ねて見る」で、全部を並べてくらべる。' })),
          note('<p>コマを細かくするほど、本物に近づきます。そのかわり、コマの数（計算の回数）が増えます。5秒きざみなら30秒で6コマ、0.1秒きざみなら300コマです。</p>'),
          more('シミュレーションは「ウソ」なの？',
            '<p>「速さ × 時間」がぴったり正しいのは、その時間のあいだ速さがずっと同じときだけです。この草のように速さが変わっていくときは、少しずれます。</p>' +
            '<p>でも、時間をうんと短く区切れば、その短いあいだは「速さはほとんど同じ」とみなせます。だから、刻みを細かくするほど本物に近づきます。この「うんと短く区切って考える」のが、<b>微分</b>という考え方です。</p>' +
            '<p>シミュレーションは、本物を<b>好きなだけ近くまで</b>まねできる方法です。ウソではなく「近似（ほとんど同じ）」です。</p>'),
        ],
        demo: [demo2],
      }));

      root.appendChild(ctx.quiz({
        id: 'frames', type: 'predict',
        q: '<p>時間の刻みを <b>5 秒</b>から <b>0.1 秒</b>に細かくすると、グラフは「なめらかな本物」（点線）とくらべてどうなると思いますか？</p>',
        options: [
          { text: '本物の曲線に、ほとんどぴったり重なる', correct: true },
          { text: '細かくするほど、本物から大きくずれる', why: '<p>実は逆です。1コマが短いほど、そのあいだの速さの変化が小さいので、「速さは同じ」として進めてもずれにくくなります。</p>' },
          { text: '刻みを変えても、グラフはまったく同じ', why: '<p>速さを計算し直す回数が変わるので、結果も変わります。5秒きざみは、本当はゆっくりになっていく途中も「速いまま」進むので、本物より上にずれます。</p>' },
          { text: '0.1 秒きざみだと、満タン（1）をこえてしまう', why: '<p>こえません。満タンに近づくほど速さが 0 に近づくので、細かく進めるほど、満タンの手前でゆっくり止まっていきます。</p>' },
        ],
        observeLabel: '▶ 0.1 秒きざみで動かしてたしかめる',
        observe: () => {
          overlayTg.set(true); overlay = true;
          dtSeg2.set(0.1, true);
          demo2.scrollIntoView({ behavior: 'smooth', block: 'center' });
          runner2.play();
        },
        explain: '<p>0.1 秒きざみのグラフは、点線とほとんど重なります。5 秒きざみは、5秒後に 0.6 になりますが、本物は約 0.515。<b>コマが細かいほど本物に近い</b>のです。コンピュータは、こうして細かいコマをたくさん計算しています。</p>',
      }));

      root.appendChild(note(`<p>次の章では、草原の<b>たくさんの場所</b>の草を一度に考えます。場所ごとの草の量をまとめた「地図」（<b>場</b>）と、その場所での変化の速さを表す記号 ${RD.ui.math(RD.ui.dudt('u')).outerHTML} が登場します。でも計算は、この章の「新しい値 ＝ 今の値 ＋ 速さ × 時間」のままです。</p>`));

      root.appendChild(teacher(
        '<p><b>扱うつまずき：</b>★T01（値と変化の区別）、T06（連続とコマ送り）。</p>' +
        '<p><b>いちばん大事なこと：</b>「速さ」と「量」を<b>指でさし分け</b>させてください。貯金箱の表やデモの帳簿で「これは速さ？ 量？」と1つずつ聞くと効果的です。</p>' +
        '<p><b>問いかけの例：</b></p><ul>' +
        '<li>「帳簿が +30 円のとき、貯金箱には 30 円入っている？」</li>' +
        '<li>「グラフのどこを見れば速さが分かる？」（かたむき、と気づいたら大いにほめてください）</li>' +
        '<li>「速さを 0 にしたら、草はなくなる？」</li>' +
        '<li>「コンピュータの計算は、本物とぴったり同じ？ どうすれば近づく？」</li></ul>' +
        '<p><b>よくある反応：</b></p><ul>' +
        '<li>問題1で 90 円と答える（増えた分＝残高と混同。T01）。</li>' +
        '<li>問題2で 0.3 と答える（時間 0.5 秒をかけ忘れる）。マイナスの扱いで 0.45 になることも。</li>' +
        '<li>問題3で「速さ 0 → 草も 0」を選ぶ（T01 の典型）。帳簿 0 円の日の残高を思い出させてください。</li>' +
        '<li>問題4で「0.2 の1割」を足して 0.22 にする。「満タンまでの残り」をコップの図で描くと伝わりやすいです。</li></ul>' +
        '<p>微分の正式な定義には深入りしなくて大丈夫です。「短く区切ると速さはほぼ一定」の感覚が伝われば十分です。</p>'));
    },
  });
})(window.RD = window.RD || {});
