// 第5章：反応の項（草とウサギのルール）。T10, T11, T12, T13, T22 / A07, A08, A11, A16 / M02, M04, M05
// 拡散なし・1か所だけ（0次元）の草原で、反応の項を1つずつ足していく。
(function (RD) {
  const { h, p, step, note, more, teacher, card, mathBlock, math, fmt } = RD.ui;

  // ---- この章で使う数（tests/ch5.test.mjs で RD.Sim と突き合わせる） ----
  const U0 = 0.5, V0 = 0.25; // 最初の草とウサギ（2次元の「種」と同じ値）
  const DT = 1;              // 1コマ = 時間 1。F や k が「1コマあたりの割合」としてそのまま読める
  const LIMIT = 400;         // グラフに描くコマ数
  const STEPS = [
    { id: 's1', label: 'ステップ1：草が生える', terms: { feed: true, react: false, decay: false } },
    { id: 's2', label: 'ステップ2：ウサギが食べて増える', terms: { feed: true, react: true, decay: false } },
    { id: 's3', label: 'ステップ3：ウサギが減る', terms: { feed: true, react: true, decay: true } },
  ];
  const LAB = { F: 0.04, k: 0.05 };          // ステップ実験の F, k（ステップ3で共存する）
  const FK = {
    start: { F: 0.02, k: 0.05 },              // 全滅する
    predict: { F: 0.06, k: 0.05 },            // F を大きくすると共存する（予想問題の答え）
    flush: { F: 0.12, k: 0.05 },              // F を大きくしすぎると、流されて全滅
    shortLife: { F: 0.04, k: 0.065 },         // 寿命が短いと全滅
  };
  const MATCH = {
    left: ['<span class="t-feed"><i>F</i>(1−<i>u</i>)</span>', '<span class="t-react"><i>uv</i>²</span>', '<span class="t-decay"><i>kv</i></span>', '<span class="t-decay"><i>Fv</i></span>'],
    right: ['草が生えてくる（満タンまでの残りに比例）', 'ウサギがペアで草を食べて増える', 'ウサギが寿命で減る', '草原の入れ替えで、ウサギも流される', '草のタネが風で広がる'],
    answer: [0, 1, 2, 3],
  };
  RD.chapterData = RD.chapterData || {};
  RD.chapterData.ch5 = { U0, V0, DT, LIMIT, STEPS, LAB, FK, MATCH, uv2: { u: 0.5, v: 0.4, answer: 0.08 }, uv2zero: { u: 0.5, v: 0, answer: 0 } };

  const CSS = `
.ch5-status { font-size: 0.92rem; min-height: 3.2em; margin: 6px 0; padding: 6px 10px; border-radius: 8px; background: var(--card-2); line-height: 1.6; }
.ch5-status:empty { display: none; }
.ch5-steps { display: grid; grid-template-columns: 1fr; gap: 6px; margin-bottom: 8px; }
.ch5-steps .btn { justify-content: flex-start; text-align: left; }
.ch5-steps .btn.on { font-weight: 700; }
.ch5-offnote { font-size: 0.85rem; color: var(--ink-2); margin: -4px 0 8px; }
.ch5-cup { display: flex; height: 34px; border: 2px solid var(--ink-3); border-radius: 0 0 10px 10px; border-top-style: dashed; overflow: hidden; margin: 10px 0 4px; }
.ch5-cup .fill { background: var(--t-feed); transition: width .15s; }
.ch5-cup .rest { flex: 1; background: repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in srgb, var(--t-feed) 20%, transparent) 6px 12px); display: flex; align-items: center; justify-content: center; font-size: 0.85rem; color: var(--ink-2); white-space: nowrap; overflow: hidden; }
.ch5-cuplbl { display: flex; justify-content: space-between; font-size: 0.82rem; color: var(--ink-2); }
.ch5-calc { font-family: var(--font-math); font-size: 1.05rem; text-align: center; margin: 10px 0; line-height: 1.8; }
.ch5-calc b { font-family: var(--font-mono); }
.ch5-transfer { display: grid; grid-template-columns: 1fr auto 1fr; gap: 6px; align-items: center; text-align: center; margin-top: 8px; }
.ch5-transfer .side { border: 1px solid var(--line); border-radius: 8px; padding: 6px 4px; background: var(--card-2); font-size: 0.9rem; line-height: 1.5; }
.ch5-transfer .side b { font-family: var(--font-mono); font-size: 1.05rem; }
.ch5-transfer .arrow { color: var(--t-react); font-weight: 700; font-size: 0.85rem; line-height: 1.3; }
.ch5-reaction { font-size: 1.3rem; text-align: center; margin: 8px 0; letter-spacing: 0.05em; }
.ch5-presets { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 8px; }
/* 選択肢の文が長いので、狭い画面でも select が横にはみ出さないようにする */
.ch5-match .match-item { grid-template-columns: minmax(0, 1fr); }
.ch5-match .match-item select { width: 100%; min-width: 0; max-width: 100%; }
@media (min-width: 521px) { .ch5-match .match-item { grid-template-columns: minmax(0, 1fr) auto; } .ch5-match .match-item select { width: auto; max-width: 16em; } }
`;

  // 1か所だけの草原（0次元）＋時間グラフ＋再生バー
  function lab0D({ F, k, terms, status }) {
    const sim = new RD.Sim({ w: 1, h: 1, F, k, dt: DT, terms: Object.assign({ diff: false }, terms) });
    const graph = new RD.TimeGraph({
      series: [{ label: '🌱 草 <i class="v">u</i>', color: '--t-u' }, { label: '🐇 ウサギ <i class="v">v</i>', color: '--t-v' }],
      ymin: 0, ymax: 1, ticks: [0, 0.5, 1], maxPoints: LIMIT + 1, height: 200, xLabel: '時間（コマ）→',
    });
    const statusEl = h('div', { class: 'ch5-status', 'aria-live': 'polite' });
    let stopReason = null;
    let runner = null;
    const lab = { sim, graph, statusEl, onFrame: null, onRestart: null };
    const lock = (on) => runner.setEnabled(!on);
    // 止める条件（Runner の爆発チェックの仕組みを借りて、そのコマで止める）
    const onStep = (s) => {
      graph.push([s.u[0], s.v[0]]);
      if (!s.terms.decay && s.terms.react && s.v[0] > 1) { stopReason = 'overflow'; s.exploded = true; }
      else if (s.steps >= LIMIT) { stopReason = 'limit'; s.exploded = true; }
    };
    const refreshStatus = () => { statusEl.innerHTML = status(sim, stopReason); };
    lab.restart = () => {
      sim.reset();
      sim.u[0] = U0; sim.v[0] = V0;
      stopReason = null;
      graph.clear();
      graph.push([U0, V0]);
      if (runner) { lock(false); runner.draw(); }
      lab.onRestart && lab.onRestart();
    };
    runner = new RD.Runner({
      sim,
      speeds: [{ label: 'ゆっくり', spf: 0.25 }, { label: 'ふつう', spf: 1 }, { label: 'はやい', spf: 4 }],
      speed: 1,
      onStep,
      onFrame: () => { graph.render(); refreshStatus(); lab.onFrame && lab.onFrame(sim); },
      onExplode: () => { lock(true); refreshStatus(); },
      onReset: () => lab.restart(),
    });
    lab.runner = runner;
    lab.restart();
    return lab;
  }

  RD.registerChapter({
    id: 'ch5',
    no: 5,
    title: '反応の項（草とウサギのルール）',
    desc: '草が生える・ウサギが食べて増える・ウサギが減る。式の残りの3色を1つずつ読みます。',
    goal: '式の反応の項それぞれの意味と、増えるか減るかを説明できる',
    required: 5,

    render(root, ctx) {
      root.appendChild(h('style', { text: CSS }));

      // ---- 1. 謎のつづき ----
      const eqStatic = new RD.Equation({ legend: true });
      eqStatic.el.querySelectorAll('[data-term="diff"]').forEach((s) => s.classList.add('off'));
      root.appendChild(step({
        title: '謎のつづき：もう1つの材料「反応」',
        text: [
          p('第4章で、<b>広がる（拡散）だけ</b>だと、模様はならされて消えてしまうことを見ました。'),
          note('<p>じゃあ、模様はどうやってできるの？</p>', 'mystery'),
          p('その答えのカギが、この章で学ぶ<b>反応</b>です。反応とは、草とウサギのあいだで起きることです。'),
          h('ul', null,
            h('li', { html: '<span class="t-feed">■</span> 草が生える' }),
            h('li', { html: '<span class="t-react">■</span> ウサギが草を食べて増える' }),
            h('li', { html: '<span class="t-decay">■</span> ウサギが減る' })),
          p('ゴールの式でいうと、青以外の3色の項です。'),
          eqStatic.el,
          p('この章では、<b>1か所だけの草原</b>を考えます。となりのマスがないので、草もウサギも広がりようがありません。だから、青い「広がる」の項は<b>この章ではお休み</b>です。'),
          more('「1か所だけの草原」ってどういうこと？',
            '<p>広い草原から1マスだけを取り出して、まわりから切りはなしたと考えます。</p>' +
            '<p>∇²<i>u</i> は「まわりの平均 − 自分」でしたが、まわりがないので、ずっと 0 です。広がる項がないぶん、反応の項だけをじっくり見られます。</p>'),
        ],
      }));

      // ---- 2. ルールを1つずつ足す（メインの実験） ----
      const lab = lab0D({
        F: LAB.F, k: LAB.k, terms: STEPS[0].terms,
        status: (sim, why) => {
          const u = sim.u[0], v = sim.v[0], t = sim.terms;
          const val = `（いま：草 <i class="v">u</i> = ${fmt(u, 3)}、ウサギ <i class="v">v</i> = ${fmt(v, 3)}）`;
          if (why === 'overflow') return '🐇 <b>ウサギが増えすぎて、グラフからはみ出しました！</b> 減るルールがないので、増える一方です。→ ステップ3へ';
          if (!t.feed && !t.react && !t.decay) return '項が全部オフです。何も変わりません。';
          if (t.decay && t.react && v < 0.005 && sim.steps > 0) return '🐇 ウサギは全滅しました。草だけが満タンに向かいます。' + val;
          if (sim.steps === 0) return '▶ 再生を押してみましょう。' + val;
          if (t.feed && !t.react && !t.decay) return (u > 0.99 ? '🌱 草はほぼ満タン（1）になりました。満タンに近づくほど、のび方がゆっくりになったのがわかりますか？' : '🌱 草が満タン（1）に向かってのびています。ウサギは何もしません（食べない・減らない）。') + val;
          if (t.react && !t.decay) return '🐇 ウサギが草を食べて増えています。草はどんどん減っていきます。' + val;
          if (t.feed && t.react && t.decay) return (why === 'limit' || sim.steps > 200 ? '🌱🐇 草とウサギが、ある値で落ち着きました（<b>共存</b>）。' : '🌱🐇 増えたり減ったりしながら、落ち着く先をさがしています……') + val;
          return val;
        },
      });
      const sim0 = lab.sim;
      const ledger0 = new RD.Ledger({ sim: sim0, digits: 4 });
      let stepBtns = [];
      const syncSteps = () => {
        stepBtns.forEach((b, i) => {
          const tt = STEPS[i].terms, on = ['feed', 'react', 'decay'].every((key) => !!sim0.terms[key] === tt[key]);
          b.classList.toggle('primary', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      };
      let eq0 = null;
      const setStep = (st) => {
        Object.assign(sim0.terms, st.terms, { diff: false });
        eq0.refresh();
        syncSteps();
        lab.restart();
        lab.runner.play();
      };
      stepBtns = STEPS.map((st) => RD.ui.button(st.label, () => setStep(st)));
      eq0 = new RD.Equation({
        sim: sim0, interactive: true, legend: false,
        onChange: (terms) => {
          if (terms.diff) { eq0.set('diff', false); RD.ui.toast('この章では「広がる」は考えません（1か所だけの草原です）'); return; }
          syncSteps();
          ledger0.update();
          lab.runner.draw();
        },
      });
      lab.onFrame = () => ledger0.update();
      syncSteps();
      ledger0.update();

      root.appendChild(step({
        title: 'ルールを1つずつ足してみよう',
        text: [
          p('「1か所だけの草原」のデモで、ルールを1つずつオンにしていきます。グラフは、草 <i class="v t-u">u</i> とウサギ <i class="v t-v">v</i> が時間とともにどう変わるかを表します。'),
          p('はじめは、草 <i class="v">u</i> = 0.5、ウサギ <i class="v">v</i> = 0.25 です。'),
          h('h3', { html: 'ステップ1：草が生える <span class="t-feed math"><i>F</i>(1−<i>u</i>)</span>' }),
          p('草が<b>満タン（1）</b>に向かってのびます。満タンに近づくほど、のび方がゆっくりになるところに注目です。'),
          h('h3', { html: 'ステップ2：ウサギが食べて増える <span class="t-react math"><i>uv</i>²</span>' }),
          p('ウサギが草を食べて増えます。草はどんどん減り、ウサギは……増え続けて、グラフからはみ出してしまいます。'),
          h('h3', { html: 'ステップ3：ウサギが減る <span class="t-decay math">(<i>F</i>+<i>k</i>)<i>v</i></span>' }),
          p('減るルールを入れると、増えすぎが止まります。草とウサギは、行ったり来たりしたあと、<b>ある値で落ち着きます</b>。'),
          note('<p>下の<b>家計簿</b>には、いまの1コマで、それぞれの項がいくつになっているかが出ます。「1コマ進める」で1コマずつ見ると、<b>合計 ＝ 各項の足し算</b>、<b>次の値 ＝ 今の値 ＋ 合計 × 1コマ</b>になっているのがわかります。</p>'),
          p('式の項をクリックしても、オン・オフを切り替えられます。'),
        ],
        demo: [
          card('1か所だけの草原', h('div', { class: 'ch5-steps' }, stepBtns), eq0.el,
            h('div', { class: 'ch5-offnote', html: '<span class="t-diff">青い「広がる」の項</span>は、この章ではずっとオフです。' }),
            lab.graph.el, lab.statusEl, lab.runner.el),
          card(null, ledger0.el),
        ],
      }));

      // ---- 3. 草が生える F(1−u) ----
      const cupFill = h('div', { class: 'fill' });
      const cupRest = h('div', { class: 'rest' });
      const cupCalc = h('div', { class: 'ch5-calc' });
      const drawCup = (u) => {
        cupFill.style.width = (u * 100) + '%';
        cupRest.textContent = u < 0.97 ? `残り ${fmt(1 - u, 2)}` : '';
        cupCalc.innerHTML = `満タンまでの残り　1 − <i>u</i> = <b>${fmt(1 - u, 2)}</b><br>` +
          `<span class="t-feed">生える速さ　<i>F</i>(1−<i>u</i>) = 0.04 × ${fmt(1 - u, 2)} = <b>${fmt(0.04 * (1 - u), 4)}</b></span>`;
      };
      const cupSlider = RD.ui.slider({ label: '🌱 草 <i class="v">u</i>', min: 0, max: 1, step: 0.05, value: 0.5, format: (v) => fmt(v, 2), onInput: drawCup });
      drawCup(0.5);

      root.appendChild(step({
        title: '草が生える：F(1−u)',
        text: [
          p('草は外から生えてきます。でも、どこまでも増えるわけではありません。<b>満タン（1）</b>が上限です。'),
          p('生える速さは、<b>満タンまでの残り</b> 1 − <i>u</i> に比例します。コップに水をそそぐとき、残りが多いうちはどんどん入り、満タンに近づくと少しずつになるのと同じです。'),
          mathBlock('<span class="t-feed">草が生える速さ ＝ <i>F</i> × (1 − <i>u</i>)</span>'),
          p('たとえば <i>F</i> = 0.04、<i>u</i> = 0.5 なら、残りは 0.5 なので、0.04 × 0.5 = 0.02 です。'),
          note('<p>第1章の予告問題を覚えていますか？ 「草は満タンまでの残りの1割ずつ増える」。あれが <span class="t-feed"><i>F</i>(1−<i>u</i>)</span> で、<i>F</i> = 0.1 の場合でした。</p>', 'story'),
          h('h3', { text: 'F はなぜこんなに小さいの？' }),
          p('<i>F</i> = 0.04 は「<b>1コマあたり</b>の割合」です。1コマで、満タンまでの残りの 4% だけ生えます。'),
          p('1コマでは少しでも、何十コマ、何百コマとくり返すと大きく変わります。ステップ1のグラフでは、草は 25コマで 0.5 → 約 0.82、100コマでほぼ満タンになりました。'),
        ],
        demo: [card('満タンまでの残り', cupSlider.el, h('div', { class: 'ch5-cup', role: 'img', 'aria-label': '草の量と、満タンまでの残り' }, cupFill, cupRest),
          h('div', { class: 'ch5-cuplbl' }, h('span', { text: '0' }), h('span', { text: '満タン 1' })), cupCalc,
          h('p', { class: 'muted', html: 'つまみで草の量を変えてみましょう。満タンに近いほど、生える速さは小さくなります。' }))],
      }));

      root.appendChild(ctx.quiz({
        id: 'f-small', type: 'choice',
        q: '<p><i>F</i> = 0.04 は、なぜこんなに小さい数なのでしょう？</p>',
        options: [
          { text: '草がほとんど生えない、という意味だから', why: '<p>ちがいます。ステップ1のグラフを思い出しましょう。<i>F</i> = 0.04 でも、100コマほどで草はほぼ満タンになりました。小さいのは「1回ぶん」だからです。</p>' },
          { text: '<b>1コマあたり</b>の割合だから。1コマでは少しでも、何百コマもくり返すと大きく変わる', correct: true },
          { text: '計算の誤差のような数で、なくても同じだから', why: '<p>ちがいます。<i>F</i> を 0 にすると、草は生えなくなり、ウサギのエサもなくなってしまいます。小さくても、とても大事な数です。</p>' },
        ],
        hints: ['「1コマ」でどれだけ生えるか、を考えましょう。', 'ステップ1のグラフでは、草が満タン近くになるまでに何コマかかりましたか？', '1コマで残りの 4%。それを何百回もくり返します。'],
        explain: '<p>F は「1コマあたりの割合」なので小さく見えます。でも、くり返しが積み重なると、草は満タンまでのびていきます（T22）。</p>',
      }));

      // ---- 4. uv²：ペアで食べて増える／移し替え ----
      const meetCalc = h('div', { class: 'ch5-calc' });
      const giveU = h('b'), giveV = h('b');
      let mu = 0.8, mv = 0.5;
      const drawMeet = () => {
        const r = mu * mv * mv;
        meetCalc.innerHTML = `<span class="t-react"><i>uv</i>² = <i>u</i> × <i>v</i> × <i>v</i></span><br>= ${fmt(mu, 2)} × ${fmt(mv, 2)} × ${fmt(mv, 2)} = <b class="t-react">${fmt(r, 4)}</b>`;
        giveU.textContent = '−' + fmt(r, 4);
        giveV.textContent = '+' + fmt(r, 4);
      };
      const slU = RD.ui.slider({ label: '🌱 草 <i class="v">u</i>', min: 0, max: 1, step: 0.1, value: mu, format: (v) => fmt(v, 2), onInput: (v) => { mu = v; drawMeet(); } });
      const slV = RD.ui.slider({ label: '🐇 ウサギ <i class="v">v</i>', min: 0, max: 1, step: 0.1, value: mv, format: (v) => fmt(v, 2), onInput: (v) => { mv = v; drawMeet(); } });
      drawMeet();

      root.appendChild(step({
        title: 'ウサギはペアで食べて増える：uv²',
        text: [
          p('このドリルのウサギは、<b>2匹そろって</b>草を食べると、子どもが1匹生まれる、と考えます。'),
          h('div', { class: 'ch5-reaction', html: '🌱 ＋ 🐇🐇 → 🐇🐇🐇' }),
          p('これが起きるには、草1つとウサギ2匹が<b>出会う</b>必要があります。出会いやすさは<b>掛け算</b>で表します。'),
          mathBlock('<span class="t-react">出会いやすさ ＝ <i>u</i> × <i>v</i> × <i>v</i> ＝ <i>uv</i>²</span>'),
          p('<i>v</i> が2回かかる（2乗）のは、ウサギが<b>2匹</b>必要だからです。'),
          p('掛け算なので、どれか1つでも 0 なら、答えは 0 です。草がなければ食べられないし、ウサギがいなければ増えません。'),
          more('なぜ足し算ではなく、掛け算なの？',
            '<p>草が2倍あれば、ウサギが草に出会うチャンスも2倍になります。</p>' +
            '<p>ウサギが2倍いると、「ウサギ1匹目」に出会うチャンスも2倍、「ウサギ2匹目」に出会うチャンスも2倍なので、ペアがそろうチャンスは 2 × 2 = 4 倍です。</p>' +
            '<p>このように、「AとBが出会う回数」は掛け算で考えます。うわさ話が「2人から聞くと信じる」のも同じ形です。</p>'),
        ],
        demo: [card('出会いは掛け算', slU.el, slV.el, meetCalc,
          h('div', { class: 'ch5-transfer' },
            h('div', { class: 'side' }, '🌱 草の式', h('br'), giveU),
            h('div', { class: 'arrow', html: '食べた分を<br>移し替え →' }),
            h('div', { class: 'side' }, '🐇 ウサギの式', h('br'), giveV)),
          h('p', { class: 'muted', html: 'どちらかを 0 にしてみましょう。<i>uv</i>² も 0 になります。' }))],
      }));

      root.appendChild(ctx.quiz({
        id: 'uv2', type: 'number',
        q: '<p>草 <i>u</i> = 0.5、ウサギ <i>v</i> = 0.4 のとき、<span class="t-react"><i>uv</i>²</span> はいくつ？</p>',
        answer: 0.08,
        wrong: (x) => {
          if (Math.abs(x - 0.2) < 1e-6) return '<p>それは <i>u</i> × <i>v</i> です。ウサギは<b>2匹</b>必要なので、<i>v</i> をもう1回かけます。</p>';
          if (Math.abs(x - 0.4) < 1e-6) return '<p><i>v</i>² は「<i>v</i> × 2」ではなく、「<i>v</i> × <i>v</i>」です。</p>';
          if (Math.abs(x - 0.16) < 1e-6) return '<p>それは <i>v</i> × <i>v</i> だけです。草 <i>u</i> もかけましょう。</p>';
          if (Math.abs(x - 0.1) < 1e-6) return '<p>それは <i>u</i> × <i>u</i> × <i>v</i> です。2回かけるのはウサギ <i>v</i> のほうです。</p>';
          return null;
        },
        hints: ['<i>uv</i>² ＝ <i>u</i> × <i>v</i> × <i>v</i> です。', '0.5 × 0.4 × 0.4 を計算します。', '0.4 × 0.4 = 0.16。それに 0.5 をかけると……'],
        answerText: '0.5 × 0.4 × 0.4 = <b>0.08</b>',
        explain: '<p>0.5 × 0.4 × 0.4 = 0.08。草からウサギへ、1コマあたり 0.08 の速さで移し替わります。</p>',
      }));

      root.appendChild(ctx.quiz({
        id: 'uv2-zero', type: 'number',
        q: '<p>草 <i>u</i> = 0.5 で、ウサギが1匹もいない（<i>v</i> = 0）とき、<span class="t-react"><i>uv</i>²</span> はいくつ？</p>',
        answer: 0,
        wrong: (x) => (Math.abs(x - 0.5) < 1e-6 ? '<p>草はあっても、ウサギがいなければ出会いは起きません。掛け算なので……？</p>' : null),
        hints: ['出会いは掛け算でした。', '0.5 × 0 × 0 を計算します。', '0 に何をかけても……'],
        answerText: '0.5 × 0 × 0 = <b>0</b>',
        explain: '<p>掛け算なので 0 です。ウサギが 0 の場所では、いつまでたってもウサギは生まれません。<b>模様を作るには、最初にウサギを少し放す（種をまく）必要がある</b>のはこのためです。</p>',
      }));

      root.appendChild(step({
        title: '食べた分だけ移る：− と ＋',
        text: [
          p('ゴールの式をよく見ると、<span class="t-react"><i>uv</i>²</span> は草の式では <b>−</b>、ウサギの式では <b>＋</b> になっています。'),
          mathBlock(`🌱 ${RD.ui.dudt('u')} = … <b class="t-react">−</b> <span class="t-react"><i>uv</i>²</span> …<br>🐇 ${RD.ui.dudt('v')} = … <b class="t-react">＋</b> <span class="t-react"><i>uv</i>²</span> …`),
          p('これは<b>お金のやりとり</b>と同じです。100円はらうと、自分の財布は −100円、お店のレジは ＋100円。同じ 100円が移っただけです。'),
          p('草とウサギも同じで、食べられた草の分（<i>uv</i>²）が、そのままウサギの分になります。<b>同じ量が、草から出て、ウサギに入る</b>のです。'),
          note('<p>だから、草の式とウサギの式を足すと、<span class="t-react">−<i>uv</i>²</span> と <span class="t-react">＋<i>uv</i>²</span> が打ち消し合って消えます。</p>'),
        ],
      }));

      root.appendChild(ctx.quiz({
        id: 'sign', type: 'choice',
        q: '<p><span class="t-react"><i>uv</i>²</span> が、草の式では −、ウサギの式では ＋ なのはなぜ？</p>',
        options: [
          { text: '草の式とウサギの式は別々のルールなので、たまたま符号がちがうだけ', why: '<p>たまたまではありません。2つの式の <i>uv</i>² は<b>同じ1つのできごと</b>（ウサギが草を食べる）を、草の側とウサギの側から見たものです。</p>' },
          { text: '−<i>uv</i>² は、草の量がマイナス（0より少ない）になるという意味だから', why: '<p>式の右側は「量」ではなく「<b>変化の速さ</b>」です（第1章・第2章）。−<i>uv</i>² は「草がその速さで<b>減っていく</b>」という意味で、草の量そのものがマイナスになるわけではありません。</p>' },
          { text: '食べられた草の分が、そのままウサギの分になる（移し替え）。同じ量が草から出て、ウサギに入るから', correct: true },
          { text: 'ウサギが増える量のほうが、草が減る量より多いから', why: '<p>どちらの式にも同じ <i>uv</i>² が入っています。減る量と増える量は<b>ぴったり同じ</b>です。</p>' },
        ],
        hints: ['お金のやりとりを思い出しましょう。100円はらうと、自分とお店はどうなる？', '草の式とウサギの式に入っている <i>uv</i>² は、同じ大きさでしょうか？', '「同じ量が、草から出てウサギに入る」ものを選びます。'],
        explain: '<p>uv² は草からウサギへの「移し替え」です。同じ量が、草の式では出ていく（−）、ウサギの式では入ってくる（＋）。2つを足すと消えます（T11）。</p>',
      }));

      // ---- 5. (F+k)v：ウサギが減る ----
      root.appendChild(step({
        title: 'ウサギが減る：(F+k)v',
        text: [
          p('ステップ2で見たように、減るルールがないと、ウサギは増え続けてしまいます。そこで、ウサギの式には減る項 <span class="t-decay">(<i>F</i>+<i>k</i>)<i>v</i></span> が入っています。'),
          p('かっこを外すと <span class="t-decay"><i>kv</i> ＋ <i>Fv</i></span>。減る理由が2つあります。'),
          h('ul', null,
            h('li', { html: '<span class="t-decay"><b><i>kv</i>：寿命</b></span>。<i>k</i> は「1コマのあいだに寿命で減る割合」です。ウサギが多いほど、たくさん減ります。' }),
            h('li', { html: '<span class="t-decay"><b><i>Fv</i>：草原の入れ替え</b></span>。草が生えてくるときと同じ割合 <i>F</i> で、ウサギも草原の外へ流されていきます。' })),
          note('<p><i>Fv</i>（ウサギも流される）は、草とウサギのたとえだと少し不自然です。そこで、<b>ここだけ、たとえを「水槽のかけ流し」に切り替えます</b>。下の「もっと詳しく」を読んでみてください。</p>', 'warn'),
          more('水槽のかけ流しで考える（ここだけたとえを切り替えます）',
            '<p>水槽に、新しい水を少しずつ注ぎ続けるとします。注いだ分だけ、水槽の水があふれて流れ出ます。これが「かけ流し」です。</p>' +
            '<p>新しい水には<b>エサ（草）がたっぷり</b>入っていて、ウサギは入っていません。流れ出る水には、<b>水槽の中身（草とウサギ）がそのまま</b>混ざっています。</p>' +
            '<ul><li>注ぐ割合を <i>F</i> とすると、流れ出るウサギは <span class="t-decay"><i>F</i> × <i>v</i></span>。だからウサギの式に <i>F</i> が入ります。</li>' +
            '<li>草は、入ってくる分が <i>F</i> × 1（満タン）、出ていく分が <i>F</i> × <i>u</i>。差し引き <span class="t-feed"><i>F</i> × 1 − <i>F</i> × <i>u</i> = <i>F</i>(1−<i>u</i>)</span>。草が生える項も、同じ見方で読めます。</li></ul>' +
            '<p>つまり <i>F</i> は「草原の入れ替えの速さ」で、草の式とウサギの式の両方に出てきます。たとえ話はここまでで、また草とウサギにもどります。</p>'),
        ],
      }));

      const matchQuiz = ctx.quiz({
        id: 'match', type: 'match',
        q: '<p>それぞれの項の意味を選びましょう。（使わない選択肢も1つあります）</p>',
        left: MATCH.left, right: MATCH.right, answer: MATCH.answer,
        hints: ['色を手がかりにしましょう。緑は草、オレンジはウサギが食べるところ、紫はウサギが減るところです。', '<i>k</i> は寿命、<i>F</i> は草原の入れ替え（かけ流し）の速さでした。', '「タネが風で広がる」は拡散（青い項）なので、ここでは使いません。'],
        answerText: '<i>F</i>(1−<i>u</i>)：草が生えてくる／<i>uv</i>²：ペアで食べて増える／<i>kv</i>：寿命で減る／<i>Fv</i>：入れ替えで流される',
        explain: '<p>これで、式の4色すべての意味がそろいました。</p>',
      });
      matchQuiz.classList.add('ch5-match');
      root.appendChild(matchQuiz);

      // ---- 6. 全滅か、共存か（F と k） ----
      const lab2 = lab0D({
        F: FK.start.F, k: FK.start.k, terms: STEPS[2].terms,
        status: (sim, why) => {
          const u = sim.u[0], v = sim.v[0];
          const val = `（草 <i class="v">u</i> = ${fmt(u, 3)}、ウサギ <i class="v">v</i> = ${fmt(v, 3)}）`;
          if (sim.steps === 0) return '▶ 再生を押してみましょう。' + val;
          if (v < 0.005) return '🐇 <b>ウサギは全滅しました。</b>草だけが満タンに向かいます。' + val;
          if (why === 'limit' || sim.steps > 250) return '🌱🐇 <b>草とウサギが共存しています。</b>' + val;
          return '変化しています……' + val;
        },
      });
      const slF = RD.ui.slider({ label: '<i>F</i>（入れ替え）', min: 0, max: 0.12, step: 0.005, value: FK.start.F, format: (v) => fmt(v, 3), onInput: (v) => { lab2.sim.setParams({ F: v }); lab2.restart(); lab2.runner.play(); } });
      const slK = RD.ui.slider({ label: '<i>k</i>（寿命）', min: 0.03, max: 0.07, step: 0.005, value: FK.start.k, format: (v) => fmt(v, 3), onInput: (v) => { lab2.sim.setParams({ k: v }); lab2.restart(); lab2.runner.play(); } });
      const setFK = (fk, play = true) => {
        slF.set(fk.F); slK.set(fk.k);
        lab2.sim.setParams(fk);
        lab2.restart();
        if (play) lab2.runner.play();
      };
      const presets = h('div', { class: 'ch5-presets' },
        RD.ui.button(`はじめ（F = ${FK.start.F}, k = ${FK.start.k}）`, () => setFK(FK.start), { small: true }),
        RD.ui.button(`F = ${FK.predict.F}`, () => setFK(FK.predict), { small: true }),
        RD.ui.button(`k = ${FK.shortLife.k}（寿命が短い）`, () => setFK(FK.shortLife), { small: true }),
        RD.ui.button(`F = ${FK.flush.F}（入れ替えが速い）`, () => setFK(FK.flush), { small: true }));

      root.appendChild(step({
        title: '全滅か、共存か',
        text: [
          p('ウサギが生き残れるかどうかは、<b><i>F</i>（入れ替えの速さ）</b>と<b><i>k</i>（寿命で減る割合）</b>で決まります。'),
          p(`「F と k を変える実験」の草原は、全部のルールがオンで、<i>F</i> = ${FK.start.F}、<i>k</i> = ${FK.start.k} です。「▶ 再生」を押してみましょう。`),
          p('ウサギは、はじめは草を食べて増えますが……やがて<b>全滅</b>してしまいます。'),
        ],
        demo: [card('F と k を変える実験', slF.el, slK.el, lab2.graph.el, lab2.statusEl, lab2.runner.el,
          h('div', { class: 'muted', text: 'ためしてみる：' }), presets)],
      }));

      root.appendChild(ctx.quiz({
        id: 'predict-f', type: 'predict',
        q: `<p><i>k</i> = ${FK.predict.k} のまま、<i>F</i> を ${FK.start.F} から <b>${FK.predict.F}</b> に大きくします。ウサギはどうなるでしょう？</p>`,
        options: [
          { text: '草がよく生えるようになるので、ウサギは生き残って、草と<b>共存</b>する', correct: true },
          { text: '<i>F</i> は草のルールなので、ウサギには関係ない。やっぱり全滅する', why: '<p>草が生えやすくなると、ウサギのエサが増えます。<i>F</i> は、草を通してウサギにも効いてきます。</p>' },
          { text: 'ウサギは、どこまでも増え続ける', why: '<p>減るルール (<i>F</i>+<i>k</i>)<i>v</i> があるので、ウサギが増えるほど、減る量も増えます。だから、ある値で釣り合って落ち着きます。</p>' },
          { text: '<i>Fv</i> で流される量が増えるので、もっと早く全滅する', why: '<p>流される量も少し増えますが、この範囲では「エサが増える」効果のほうが大きいのです。ただし、<i>F</i> を<b>大きくしすぎる</b>と、本当に流されて全滅します（あとで試せます）。</p>' },
        ],
        observe: () => { setFK(FK.predict); lab2.graph.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); },
        explain: `<p><i>F</i> = ${FK.predict.F} にすると、ウサギは生き残り、草とウサギはある値で落ち着きます（共存）。草がよく生えるので、ウサギのエサが足りるようになったのです。</p>`,
      }));

      root.appendChild(step({
        title: 'いろいろ試してみよう',
        text: [
          p('つまみや「ためしてみる」のボタンで、ほかの組み合わせも試してみましょう。'),
          h('ul', null,
            h('li', { html: `<b>寿命を短くする</b>（<i>k</i> = ${FK.shortLife.k}）と、<i>F</i> = ${FK.shortLife.F} でもウサギは全滅します。` }),
            h('li', { html: `<b>入れ替えを速くしすぎる</b>（<i>F</i> = ${FK.flush.F}）と、草はたっぷりあるのに、ウサギが流される分が多すぎて全滅します。` })),
          note('<p><i>F</i> と <i>k</i> のちょっとしたちがいで、ウサギが全滅するか、生き残るかが変わります。この「<i>F</i> と <i>k</i> で結果が変わる」ことが、第7章の<b>模様の地図</b>につながります。</p>', 'story'),
          p('次の章では、いよいよ「広がる」と「反応」を<b>全部合わせて</b>、広い草原で動かします。'),
        ],
      }));

      root.appendChild(teacher(
        '<p><b>扱うつまずき：</b>T10（uv² の2乗）、T11（− と ＋ の移し替え）、T12（1−u）、T13（F が v の式にも入る）、T22（F が小さい）。</p>' +
        '<p><b>Fv について：</b>草とウサギのたとえでは「ウサギが流される」が不自然なので、<b>ここだけ水槽のかけ流しに切り替える</b>と、はっきり言ってあげてください（「もっと詳しく」）。草の F(1−u) も「入る F×1、出る F×u」と読めることを見せると、F が両方の式に入る理由が腑に落ちやすいです。</p>' +
        '<p><b>問いかけの例：</b></p><ul>' +
        '<li>「ステップ2で、どうしてウサギはグラフからはみ出したの？」（減るルールがないから）</li>' +
        '<li>「草が満タンに近づくと、のび方はどうなった？ それは式のどこに書いてある？」（1−u が小さくなる）</li>' +
        '<li>「ウサギが 0 の場所に、ウサギは生まれる？」（uv² = 0 なので生まれない → 種まきが必要）</li>' +
        '<li>家計簿を指して「−0.0xx は草の量？ それとも変化の速さ？」（T01 の確認）</li></ul>' +
        '<p><b>よくある反応：</b>「v² は v×2」と計算する子が多いです。「ウサギが2匹いる」→「v と v の掛け算」と、出会いのイメージにもどしてください。</p>' +
        '<p><b>数値メモ：</b>この章の草原は 1コマ＝時間 1（Δt = 1）。ステップ実験は F = 0.04、k = 0.05（u ≈ 0.28、v ≈ 0.32 で共存）。F-k 実験の結果は、u = 0.5、v = 0.25 から始めたときのものです。</p>'));
    },
  });
})(window.RD = window.RD || {});
