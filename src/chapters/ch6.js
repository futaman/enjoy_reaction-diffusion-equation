// 第6章：全部を合わせる。T14, ★T01, T23, ★T07 / M02, M03, M04, M05、電卓
// 2次元の草原で項のオン・オフを試し（拡散だけ／反応だけ／全部）、1マスを手で1コマ進めて、家計簿と答え合わせする。
(function (RD) {
  const { h, p, step, note, more, teacher, card, mathBlock, fmt, dudt } = RD.ui;

  // ---- この章で使う数（tests/ch6.test.mjs で RD.Sim と突き合わせる） ----
  const N = 96;                       // 2次元の草原の大きさ
  const P2 = { F: 0.04, k: 0.06 };    // 手計算と同じ F, k。真ん中の種から模様が育つ（tests で確認）
  const PRESETS = [
    { id: 'diff', label: '拡散だけ', terms: { diff: true, feed: false, react: false, decay: false } },
    { id: 'react', label: '反応だけ', terms: { diff: false, feed: true, react: true, decay: true } },
    { id: 'all', label: '全部', terms: { diff: true, feed: true, react: true, decay: true } },
  ];
  const COMPARE_TIME = 2400;          // 比べるときに進める時間（コマ数 = この時間 ÷ Δt）
  const HAND = {
    u: 0.5, v: 0.5, avgU: 0.6, avgV: 0.3, Du: 1, Dv: 0.5, F: 0.04, k: 0.06, dt: 1,
    blanks: [
      ['lapU', '① <span class="t-diff">∇²<i>u</i></span>', 0.1],
      ['lapV', '② <span class="t-diff">∇²<i>v</i></span>', -0.2],
      ['react', '③ <span class="t-react"><i>uv</i>²</span>', 0.125],
      ['feed', '④ <span class="t-feed"><i>F</i>(1−<i>u</i>)</span>', 0.02],
      ['decay', '⑤ <span class="t-decay">(<i>F</i>+<i>k</i>)<i>v</i></span>', 0.05],
      ['dudt', '⑥ ∂<i>u</i>/∂<i>t</i>', -0.005],
      ['dvdt', '⑦ ∂<i>v</i>/∂<i>t</i>', -0.025],
      ['uNext', '⑧ 新しい <i>u</i>', 0.495],
      ['vNext', '⑨ 新しい <i>v</i>', 0.475],
    ],
  };
  RD.chapterData = RD.chapterData || {};
  RD.chapterData.ch6 = { N, P2, PRESETS, COMPARE_TIME, HAND };

  const CSS = `
.ch6-cmp { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 8px; }
.ch6-cmp figure { margin: 0; text-align: center; font-size: 0.85rem; }
.ch6-cmp figcaption { margin-top: 2px; line-height: 1.4; }
.ch6-cmp canvas { pointer-events: none; }
.ch6-cmp .sim-canvas-wrap { max-width: none; }
.ch6-status { font-size: 0.9rem; text-align: center; color: var(--ink-2); }
.ch6-grids { display: flex; flex-wrap: wrap; gap: 12px 20px; justify-content: center; }
.ch6-grids figure { margin: 0; text-align: center; }
.ch6-grids figcaption { font-size: 0.88rem; margin-bottom: 4px; }
.ch6-params { display: grid; grid-template-columns: repeat(auto-fill, minmax(8.5em, 1fr)); gap: 2px 12px; font-family: var(--font-math); margin-top: 10px; font-size: 1rem; }
.ch6-sheet { font-family: var(--font-math); line-height: 2; font-size: 1rem; }
.ch6-sheet .ln { white-space: normal; }
.ch6-answer { text-align: center; font-size: 1.05rem; margin: 8px 0; }
.ch6-answer b { font-family: var(--font-mono); }
.ch6-sentence { display: grid; gap: 4px; margin: 8px 0; }
.ch6-sentence div { line-height: 1.7; }
`;

  RD.registerChapter({
    id: 'ch6',
    no: 6,
    title: '全部を合わせる',
    desc: 'ゴールの式で広い草原を動かし、1マスを手で1コマ進めて答え合わせします。',
    goal: '式全体を、1マスについて手で1コマ進められる。コンピュータは同じ計算をくり返しているだけだとわかる',
    required: 3,

    render(root, ctx) {
      root.appendChild(h('style', { text: CSS }));
      ctx.useCalc();

      // ---- 1. ゴールの式を読む ----
      root.appendChild(step({
        title: 'ゴールの式が読める！',
        text: [
          p('これまでの章で、式の材料が全部そろいました。もう一度、ゴールの式を見てみましょう。'),
          p('長い式も、<b>色ごとに1つずつ</b>読めば大丈夫です。それぞれの行を、ことばにするとこうなります。'),
          h('div', { class: 'ch6-sentence' },
            h('div', { html: '🌱 <b>草の変化の速さ</b> ＝ <span class="t-diff">広がる分</span> − <span class="t-react">食べられる分</span> ＋ <span class="t-feed">生える分</span>' }),
            h('div', { html: '🐇 <b>ウサギの変化の速さ</b> ＝ <span class="t-diff">広がる分</span> ＋ <span class="t-react">食べて増える分</span> − <span class="t-decay">減る分</span>' })),
          note('<p>左側の ∂<i>u</i>/∂<i>t</i> は「量」ではなく「<b>変化の速さ</b>」でした。式は「次のコマを作るルール」です。<br>新しい値 ＝ 今の値 ＋ 速さ × Δ<i>t</i></p>'),
          more('草とウサギの「広がる」はどうちがう？',
            '<p>草のタネは風で<b>速く</b>広がり（<i>D<sub>u</sub></i> = 1）、ウサギは歩いて<b>ゆっくり</b>広がります（<i>D<sub>v</sub></i> = 0.5）。この「速さのちがい」が、じつは模様づくりの大事なカギです。くわしくは第7章で。</p>'),
        ],
        demo: [card('ゴールの式', new RD.Equation({}).el)],
      }));

      // ---- 2. 予想：模様が出るのは？ ----
      const sim = new RD.Sim({ w: N, h: N, F: P2.F, k: P2.k });
      const center = sim.idx(N >> 1, N >> 1);
      sim.seed('center');
      let view2 = null, ledger = null;
      const view = new RD.FieldView(sim, { picked: center, maxCss: '400px', onPick: (i) => { ledger.show(i); view2.picked = i; view2.render(); } });
      const statusEl = h('div', { class: 'ch6-status' });
      const presetOf = () => PRESETS.find((pr) => Object.keys(pr.terms).every((key) => !!sim.terms[key] === pr.terms[key]));
      const showStatus = () => {
        const pr = presetOf();
        statusEl.innerHTML = `いま：<b>${pr ? pr.label : '自分で選んだ項'}</b>（<i>F</i> = ${P2.F}、<i>k</i> = ${P2.k}）`;
      };
      const runner = new RD.Runner({
        sim,
        speeds: [{ label: 'ゆっくり', spf: 1 }, { label: 'ふつう', spf: 8 }, { label: 'はやい', spf: 24 }],
        speed: 1,
        onFrame: () => { view.render(); if (view2) view2.render(); if (ledger) ledger.update(); },
        onReset: () => { sim.seed('center'); },
      });
      let seg = null;
      const eq = new RD.Equation({
        sim, interactive: true,
        onChange: () => { const pr = presetOf(); seg.set(pr ? pr.id : null); showStatus(); runner.draw(); },
      });
      const usePreset = (id, play = true) => {
        const pr = PRESETS.find((x) => x.id === id);
        Object.assign(sim.terms, pr.terms);
        eq.refresh();
        seg.set(id);
        sim.seed('center');
        showStatus();
        runner.draw();
        if (play) runner.play();
      };
      seg = RD.ui.segmented(PRESETS.map((pr) => ({ value: pr.id, label: pr.label })), 'all', (id) => usePreset(id));
      showStatus();

      // 3つを並べて比べる（それぞれ別の草原で、同じ時間だけ進める）
      const cmpSteps = Math.round(COMPARE_TIME / sim.dt);
      const cmpBox = h('div', { class: 'ch6-cmp' });
      const cmpMsg = h('div', { class: 'muted', 'aria-live': 'polite' });
      let busy = false;
      const compare = () => {
        if (busy) return;
        busy = true;
        const sims = PRESETS.map((pr) => { const s = new RD.Sim({ w: N, h: N, F: P2.F, k: P2.k, terms: Object.assign({}, pr.terms) }); s.seed('center'); return s; });
        const views = sims.map((s) => new RD.FieldView(s, { readout: false, colorbar: false, maxPx: 192 }));
        const caps = PRESETS.map((pr) => h('figcaption', { html: `<b>${pr.label}</b>` }));
        cmpBox.replaceChildren(...views.map((v, i) => h('figure', null, v.el, caps[i])));
        let done = 0;
        const tick = () => {
          if (!cmpBox.isConnected) { busy = false; return; }
          const n = Math.min(150, cmpSteps - done);
          sims.forEach((s) => s.step(n));
          done += n;
          views.forEach((v) => v.render());
          cmpMsg.textContent = `${done} / ${cmpSteps} コマ`;
          if (done < cmpSteps) { setTimeout(tick, 0); return; }
          busy = false;
          sims.forEach((s, i) => { caps[i].innerHTML = `<b>${PRESETS[i].label}</b><br>${s.stats().maxV < 0.01 ? 'ウサギは消えた' : '模様ができた！'}`; });
          cmpMsg.textContent = `${cmpSteps} コマ後のようす（3つとも、同じ真ん中の種から）`;
        };
        tick();
      };
      const cmpBtn = RD.ui.button(`3つを並べて比べる（${cmpSteps} コマ）`, compare, { small: true });

      root.appendChild(step({
        title: '広い草原で、全部のルールを動かす',
        text: [
          p(`いよいよ、広い草原（${N}×${N} マス）で、ゴールの式を動かします。はじめは草が満タンで、<b>真ん中にだけウサギを少し放して</b>あります（種）。`),
          p('「拡散だけ／反応だけ／全部」のスイッチで、3通りを試せます。'),
          h('ul', null,
            h('li', { html: '<b>拡散だけ</b>：<span class="t-diff">広がる</span>項だけオン（第4章と同じ）' }),
            h('li', { html: '<b>反応だけ</b>：<span class="t-feed">生える</span>・<span class="t-react">食べて増える</span>・<span class="t-decay">減る</span>だけオン（第5章と同じ）' }),
            h('li', { html: '<b>全部</b>：ゴールの式そのもの' })),
          p('式の項を1つずつクリックして、オン・オフしてもかまいません。'),
        ],
        demo: [card(null, seg.el, h('div', { style: { height: '6px' } }), eq.el, view.el, statusEl, runner.el,
          h('div', { class: 'row', style: { marginTop: '10px' } }, cmpBtn), cmpMsg, cmpBox)],
      }));

      root.appendChild(ctx.quiz({
        id: 'predict-pattern', type: 'predict',
        q: '<p>真ん中の種から、<b>模様が広がっていく</b>のはどれでしょう？ 予想してから、3つを並べて比べてみましょう。</p>',
        options: [
          { text: '拡散だけ', why: '<p>第4章で見たとおり、広がるだけだと、ウサギはならされて薄くなり、消えてしまいます。</p>' },
          { text: '反応だけ', why: `<p>反応だけだと、マスどうしが関わりません。種を置いたマスの中だけで草とウサギがやりとりして、この <i>F</i> = ${P2.F}、<i>k</i> = ${P2.k} では、ウサギは全滅します（第5章の「1か所だけの草原」と同じです）。</p>` },
          { text: '全部（拡散 ＋ 反応）', correct: true },
          { text: 'どれでも模様ができる', why: '<p>「拡散だけ」と「反応だけ」では、ウサギは消えてしまいます。</p>' },
        ],
        observe: () => { usePreset('all'); compare(); cmpBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); },
        observeLabel: '▶ 3つを並べて比べる',
        explain: '<p><b>全部</b>のときだけ、真ん中の種から模様が広がっていきます。</p>',
      }));

      root.appendChild(note(
        '<p><b>ふしぎですね。</b>「広がる」だけでもウサギは消える。「反応」だけでもウサギは消える。なのに、2つを<b>合わせる</b>と模様が生まれます。</p>' +
        '<p>拡散は「ならして均一にする」はたらきのはずなのに、なぜ模様ができるのでしょう？ この謎は、<b>第7章</b>で解きます。</p>', 'mystery'));

      // ---- 3. 1マスの家計簿 ----
      ledger = new RD.Ledger({ sim, index: center, digits: 4 });
      view2 = new RD.FieldView(sim, { picked: center, maxCss: '320px', onPick: (i) => { ledger.show(i); view.picked = i; view.render(); } });
      const stepBtn = RD.ui.button('1コマ進める', () => { runner.pause(); runner.advance(1); }, { small: true });
      root.appendChild(step({
        title: '1マスの家計簿をのぞく',
        text: [
          p('草原のマスをクリック（タップ）すると、<b>そのマスの家計簿</b>が出ます。ここの草原は、上の草原と同じものを映しています。'),
          p('家計簿には、そのマスの<b>今の値</b>、<b>まわりの平均</b>、<b>各項の値</b>、その<b>合計（変化の速さ）</b>、そして<b>次の値</b>が並んでいます。'),
          p('「1コマ進める」を押すと、いまの「次の値」が、次のコマの「今の値」になります。'),
          note('<p>コンピュータは、この家計簿の計算を、<b>全部のマスで同時に</b>やって、1コマ進めています。それだけです。</p>'),
          more('ウサギの模様のふちのマスを見てみよう',
            '<p>ウサギの濃いところ（模様）と、草原のさかい目のマスをクリックしてみましょう。<span class="t-diff">広がる</span>の項が大きくなっていて、ウサギがとなりから流れこんでくるのがわかります。</p>'),
        ],
        demo: [card('えらんだマスの家計簿', view2.el, h('div', { class: 'row', style: { justifyContent: 'center' } }, stepBtn), ledger.el)],
      }));

      // ---- 4. 手で1コマ計算する ----
      const H = HAND;
      const gridOf = (c, a) => [[null, a, null], [a, c, a], [null, a, null]];
      const gU = RD.ui.numGrid({ values: gridOf(H.u, H.avgU), format: (v) => fmt(v, 2), highlight: (r, c) => r === 1 && c === 1 });
      const gV = RD.ui.numGrid({ values: gridOf(H.v, H.avgV), format: (v) => fmt(v, 2), highlight: (r, c) => r === 1 && c === 1 });
      root.appendChild(step({
        title: '手で1コマ計算してみよう',
        text: [
          p('「計算するマス」の真ん中（太い枠）を、<b>自分の手で1コマ</b>進めてみます。コンピュータがやっているのと、まったく同じ計算です。'),
          p('順番は、この3段です。'),
          h('ol', null,
            h('li', { html: '各項の値を出す（① 〜 ⑤）' }),
            h('li', { html: '式のとおりに足し引きして、変化の速さを出す（⑥ ⑦）' }),
            h('li', { html: '新しい値 ＝ 今の値 ＋ 速さ × Δ<i>t</i>（⑧ ⑨）' })),
          h('div', { class: 'ch6-sheet' },
            h('div', { class: 'ln', html: `⑥ = <i>D<sub>u</sub></i> × ① − ③ + ④` }),
            h('div', { class: 'ln', html: `⑦ = <i>D<sub>v</sub></i> × ② + ③ − ⑤` })),
          note('<p>小数の計算は、右下の <b>🧮 電卓</b>を使ってかまいません。大事なのは「どの項を、＋と−のどちらで足すか」です。</p>'),
        ],
        demo: [card('計算するマス',
          h('div', { class: 'ch6-grids' },
            h('figure', null, h('figcaption', { html: '🌱 草 <i class="v">u</i>' }), gU.el),
            h('figure', null, h('figcaption', { html: '🐇 ウサギ <i class="v">v</i>' }), gV.el)),
          h('div', { class: 'ch6-params' },
            h('span', { html: `<i>D<sub>u</sub></i> = ${H.Du}` }), h('span', { html: `<i>D<sub>v</sub></i> = ${H.Dv}` }),
            h('span', { html: `<i>F</i> = ${H.F}` }), h('span', { html: `<i>k</i> = ${H.k}` }), h('span', { html: `Δ<i>t</i> = ${H.dt}` })),
          h('p', { class: 'muted', html: `上下左右の平均は、草 <i>u</i> が ${H.avgU}、ウサギ <i>v</i> が ${H.avgV} です（ななめのマスは使いません）。<i>F</i> と <i>k</i> は、さっき模様ができた草原と同じ値です。` }))],
      }));

      root.appendChild(ctx.quiz({
        id: 'hand', type: 'fill',
        q: `<p>真ん中のマス（<i>u</i> = ${H.u}、<i>v</i> = ${H.v}）を1コマ進めます。① 〜 ⑨ を順に計算しましょう。マイナスの答えは「−0.2」のように入力します。</p>`,
        blanks: H.blanks.map(([, label, answer]) => ({ label, answer })),
        hints: [
          '① ∇²<i>u</i> ＝ まわりの平均 − 自分 ＝ 0.6 − 0.5。② も同じように 0.3 − 0.5。④ の 1 − <i>u</i> は「満タンまでの残り」です。',
          '③ 0.5 × 0.5 × 0.5、④ 0.04 × (1 − 0.5)、⑤ (0.04 + 0.06) × 0.5。<br>⑥ は 1 × ① − ③ + ④、⑦ は 0.5 × ② + ③ − ⑤ です（0.5 × ② ＝ 0.5 × (−0.2) ＝ −0.1）。',
          '⑥ ＝ 0.1 − 0.125 + 0.02、⑦ ＝ −0.1 + 0.125 − 0.05。<br>⑧ ＝ 0.5 + ⑥ × 1、⑨ ＝ 0.5 + ⑦ × 1。',
        ],
        answerText: '① 0.1　② −0.2　③ 0.125　④ 0.02　⑤ 0.05　⑥ −0.005　⑦ −0.025　⑧ 0.495　⑨ 0.475',
        explain: '<p>⑥ = 0.1 − 0.125 + 0.02 = −0.005 → 新しい <i>u</i> = 0.5 − 0.005 = 0.495<br>⑦ = −0.1 + 0.125 − 0.05 = −0.025 → 新しい <i>v</i> = 0.5 − 0.025 = 0.475</p><p>これで、ゴールの式を使って1マスを1コマ進められました！ 下で、コンピュータの答えと比べてみましょう。</p>',
      }));

      // ---- 5. コンピュータで答え合わせ ----
      const sim3 = new RD.Sim({ w: 3, h: 3, Du: H.Du, Dv: H.Dv, F: H.F, k: H.k, dt: H.dt });
      sim3.u.fill(H.avgU); sim3.v.fill(H.avgV);
      sim3.u[4] = H.u; sim3.v[4] = H.v;
      const ledger3 = new RD.Ledger({ sim: sim3, index: 4, digits: 4, caption: '真ん中のマスの家計簿（コンピュータの計算）' });
      const b3 = sim3.breakdown(4);
      const reveal = h('div', { hidden: true },
        ledger3.el,
        h('div', { class: 'ch6-answer', html: `コンピュータの答え：新しい <i>u</i> = <b>${fmt(b3.uNext, 4)}</b>、新しい <i>v</i> = <b>${fmt(b3.vNext, 4)}</b>` }));
      const revealBtn = RD.ui.button('🖥 コンピュータに計算させる', () => { reveal.hidden = false; revealBtn.remove(); }, { primary: true });
      const total = N * N * cmpSteps;
      root.appendChild(step({
        title: 'コンピュータで答え合わせ',
        text: [
          p('同じ 3×3 のマスを、コンピュータ（この教材のシミュレーション）にも計算させてみましょう。'),
          p('家計簿の数が、あなたの手計算と<b>ぴったり同じ</b>になっているはずです。'),
          note(`<p><b>コンピュータは、同じ計算を何万回もしているだけ</b>です。</p><p>上の広い草原は ${N} × ${N} ＝ ${(N * N).toLocaleString()} マス。模様が育つまでの ${cmpSteps.toLocaleString()} コマで、この家計簿の計算を<b>約 ${Math.round(total / 1e4).toLocaleString()} 万回</b>くり返しています。1回1回は、いまあなたが手でやった計算と同じです。</p>`, 'story'),
        ],
        demo: [card('答え合わせ', h('div', { class: 'row', style: { justifyContent: 'center' } }, revealBtn), reveal)],
      }));

      root.appendChild(ctx.quiz({
        id: 'rate-vs-value', type: 'choice',
        q: '<p>家計簿の「合計（変化の速さ ∂<i>u</i>/∂<i>t</i>）」が <b>−0.005</b> でした。これはどういう意味？</p>',
        options: [
          { text: '草の量が −0.005 になった', why: '<p>−0.005 は「量」ではなく「<b>変化の速さ</b>」です。草の量そのものは、0.5 から 0.495 になっただけです。帳簿（増減）と残高（量）を区別しましょう。</p>' },
          { text: '草の量は、もう変わらない', why: '<p>速さは 0 ではないので、草は少しずつ変わります。0 に近い小さな速さでも、何コマも重なると大きな変化になります。</p>' },
          { text: '草が 1コマあたり 0.005 の速さで<b>減っている</b>。草の量は 0.5 → 0.495 になる', correct: true },
          { text: '草が 0.005 だけ増えている', why: '<p>マイナスの速さは「減っている」という意味です。</p>' },
        ],
        hints: ['∂<i>u</i>/∂<i>t</i> は「量」でしょうか、「変化の速さ」でしょうか？', '新しい値 ＝ 今の値 ＋ 速さ × Δ<i>t</i> でした。', '0.5 + (−0.005) × 1 を計算すると……'],
        explain: '<p>式の左側 ∂<i>u</i>/∂<i>t</i> は「変化の速さ」、つまり<b>次のコマを作るためのルール</b>です。量そのものではありません（T01）。</p>',
      }));

      root.appendChild(step({
        title: 'まとめ',
        text: [
          h('ul', null,
            h('li', { html: 'ゴールの式は、色ごとに「広がる・生える・食べて増える・減る」の4つのルールを足し引きしたものです。' }),
            h('li', { html: '1マスを1コマ進める計算は、手でもできます。コンピュータは、それを全部のマスで何万回もくり返しているだけです。' }),
            h('li', { html: '「拡散だけ」でも「反応だけ」でも模様はできず、<b>合わせたときだけ</b>模様ができます。' })),
          p('次の章では、いよいよ「なぜ模様ができるのか」の謎を解き、<i>F</i> と <i>k</i> を選んで<b>狙った模様</b>を出してみます。'),
        ],
      }));

      root.appendChild(teacher(
        '<p><b>扱うつまずき：</b>T14（長い式に圧倒される）、★T01（式は値ではなく変化のルール：総まとめ）、T23（小数の計算が重い）、★T07（なぜ組み合わせると模様が？：謎を深める）。</p>' +
        '<p><b>手計算：</b>小数の計算でつまずいたら、電卓を使っていいと伝えてください。本題は「どの項を、＋と−のどちらで足すか」です。⑦ で <i>D<sub>v</sub></i> = 0.5 をかけ忘れる（−0.2 のまま足す）ミスがとても多いです。</p>' +
        '<p><b>問いかけの例：</b></p><ul>' +
        '<li>「拡散だけでも反応だけでもウサギは消えるのに、合わせると模様ができるのはなぜだと思う？」（答えは第7章。ここでは予想を言わせるだけで十分）</li>' +
        '<li>家計簿の合計を指して「これは草の量？ それとも変化の速さ？」</li>' +
        '<li>「コンピュータは何か特別なことをしている？」（同じ計算をくり返しているだけ）</li></ul>' +
        '<p><b>メモ：</b>答え合わせの 3×3 マスは Δ<i>t</i> = 1 で計算しています（手計算と同じ）。上の広い草原は、安定のために Δ<i>t</i> を少し小さくして動かしています。</p>'));
    },
  });
})(window.RD = window.RD || {});
