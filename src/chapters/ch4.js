// 第4章：記号 ∇² と2次元の拡散
// つまずき ★T04, T05, T20, T21, ★T07（伏線） ／ たとえ A05, A06, A14 ／ 仕掛け M03, M01
(function (RD) {
  const { h, p, step, note, more, teacher, card, math, mathBlock, dudt, fmt } = RD.ui;

  const DIFF_ONLY = { diff: true, feed: false, react: false, decay: false };

  // 3×3 の [上, 左, 自分, 右, 下] を、3×3 の Sim の並び（index 1, 3, 4, 5, 7）に入れる
  const toGrid = ({ up, left, self, right, down }) => [[null, up, null], [left, self, right], [null, down, null]];

  // 問題とデモで使う数（テストからも読む：def.data）
  const DATA = {
    q1: { up: 3, left: 3, self: 1, right: 3, down: 3, answer: 2 },
    q2: { up: 6, left: 2, self: 4, right: 5, down: 3, answer: 0 },
    // 問題「次のコマ」：問題1の真ん中、D = 0.5、Δt = 1
    qNext: { D: 0.5, dt: 1, answer: 2 },
    // 地形と符号（問題3）。left の順に right の index
    terrain: [
      { kind: 'valley', cells: { up: 5, left: 5, self: 2, right: 5, down: 5 }, sign: 0 },
      { kind: 'peak', cells: { up: 3, left: 3, self: 7, right: 3, down: 3 }, sign: 1 },
      { kind: 'slope', cells: { up: 4, left: 2, self: 4, right: 6, down: 4 }, sign: 2 },
      { kind: 'flat', cells: { up: 4, left: 4, self: 4, right: 4, down: 4 }, sign: 2 },
    ],
    signs: ['＋（プラス）：埋まって増える', '−（マイナス）：削られて減る', '0：そのまま変わらない'],
    // 2次元のインク
    ink: { size: 64, D: 1, dt: 0.8, radius: 5, value: 1, center: [32, 32], edge: [6, 22] },
  };

  // 砂場の地形の絵（A06）。arrows で「埋まる・削られる」の矢印も描く
  function terrainSvg(kind, arrows = false) {
    const paths = {
      valley: 'M0,14 C30,14 40,40 60,40 C80,40 90,14 120,14 L120,56 L0,56 Z',
      peak: 'M0,44 C30,44 40,10 60,10 C80,10 90,44 120,44 L120,56 L0,56 Z',
      slope: 'M0,46 L120,12 L120,56 L0,56 Z',
      flat: 'M0,28 L120,28 L120,56 L0,56 Z',
    };
    const y = { valley: 40, peak: 10, slope: 29, flat: 28 }[kind];
    let extra = `<circle cx="60" cy="${y}" r="3.5" fill="#e0303a" />`;
    if (arrows && kind === 'valley') extra += '<path d="M60,4 L60,30 M54,24 L60,31 L66,24" stroke="var(--t-diff)" stroke-width="2.5" fill="none"/>';
    if (arrows && kind === 'peak') extra += '<path d="M36,14 L18,34 M22,26 L17,35 L27,33 M84,14 L102,34 M98,26 L103,35 L93,33" stroke="var(--t-diff)" stroke-width="2.5" fill="none"/>';
    return `<svg class="ch4-terrain" viewBox="0 0 120 58" width="120" height="58" aria-hidden="true"><path d="${paths[kind]}" fill="#d9b06a" stroke="#9a5a2a" stroke-width="1.5"/>${extra}</svg>`;
  }

  const CSS = `
  .ch4-terrain { display: block; width: 120px; height: 58px; }
  .ch4-terrains { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin: 10px 0; }
  .ch4-terrains > div { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 6px 8px; text-align: center; font-size: 0.9rem; line-height: 1.5; }
  .ch4-terrains .ch4-terrain { margin: 0 auto 4px; }
  .ch4-mterrain { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .ch4-mterrain .ch4-terrain { width: 96px; height: 46px; flex: none; }
  .ch4-mterrain span { font-size: 0.9rem; }
  .ch4-lap { font-family: var(--font-math); text-align: center; line-height: 2; margin-top: 8px; font-size: 1.05rem; }
  .ch4-lap .big { font-size: 1.3rem; font-weight: 700; }
  .ch4-lap .cmt { font-family: var(--font); font-size: 0.95rem; }
  .ch4-gridwrap { display: flex; justify-content: center; }
  .ch4-gridwrap .numgrid .cell.dim { background: transparent; border-style: dashed; }
  .ch4-gridwrap .numgrid .cell.hl input { font-weight: 700; }
  .ch4-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; text-align: center; font-size: 0.85rem; }
  .ch4-stats > div { background: var(--card-2); border-radius: 6px; padding: 4px; }
  .ch4-stats b { display: block; font-family: var(--font-mono); font-size: 1rem; }
  .ch4-eq .term:not(.t-diff) { opacity: 0.3; }
  .ch4-word { display: inline-block; white-space: nowrap; }
  @media (max-width: 560px) {
    #q-q-sign .match-item { grid-template-columns: 1fr; gap: 4px; padding-bottom: 8px; border-bottom: 1px dashed var(--line); }
    #q-q-sign .match-item select { max-width: none; width: 100%; }
  }
  `;

  const sgn = (x, d = 3) => (x > 1e-12 ? '+' : x < -1e-12 ? '−' : '') + fmt(Math.abs(x), d);

  RD.registerChapter({
    id: 'ch4',
    no: 4,
    title: '記号 ∇² と2次元の拡散',
    desc: '∇²u ＝「まわりの平均 − 自分」。広い草原で拡散を見ます。',
    goal: '∇²<i>u</i> を「まわりの平均 − 自分」として計算でき、符号の意味がわかる。∂<i>u</i>/∂<i>t</i> ＝ <i>D</i>∇²<i>u</i> が読める',
    required: 4,
    data: DATA,

    render(root, ctx) {
      root.appendChild(h('style', { text: CSS }));
      ctx.useCalc();

      // ===== 1. ∇² の定義（T04） =====
      const lapDemo = buildLapDemo();
      root.appendChild(step({
        title: '新しい記号 ∇²（まわりの平均 − 自分）',
        text: [
          p('第3章では、1列のマスで「<b>隣の平均 − 自分</b>」を計算しました。広い草原（2次元）では、となりが<b>上・下・左・右の4マス</b>になります。'),
          p('この「まわりの平均 − 自分」に、記号を付けます。'),
          mathBlock('∇²<i>u</i> ＝ 上下左右4マスの平均 − 自分'),
          p('∇² は「<b>ナブラ2乗</b>」と読みます（「ラプラシアン」とも呼びます）。むずかしそうな見た目ですが、この教材では<b>「まわりの平均 − 自分」という意味だけ</b>です。ななめのマスは使いません。'),
          note('<p>∇²<i class="v">u</i> は「<b>自分は、まわりよりどれだけ低いか</b>」を表す数です。まわりより低ければプラス、高ければマイナスになります。</p>'),
          p('3×3のマスで、数字を書き換えてみましょう。真ん中の ∇²<i class="v">u</i> が、その場で計算されます。'),
        ],
        demo: lapDemo.el,
      }));

      const q1 = DATA.q1;
      root.appendChild(ctx.quiz({
        id: 'q-lap1',
        type: 'number',
        q: `<p>真ん中のマスが <b>${q1.self}</b>、上下左右の4マスがすべて <b>${q1.up}</b> です。真ん中の ∇²<i class="v">u</i> はいくつ？</p>`,
        prefix: '∇²<i class="v">u</i> ＝',
        answer: q1.answer,
        hints: [
          'まず、上下左右4マスの平均を出しましょう。',
          `平均 ＝ (${q1.up} ＋ ${q1.left} ＋ ${q1.right} ＋ ${q1.down}) ÷ 4 ＝ 3 です。`,
          `∇²<i class="v">u</i> ＝ 平均 − 自分 ＝ 3 − ${q1.self} ＝ ？`,
        ],
        answerText: `(3 ＋ 3 ＋ 3 ＋ 3) ÷ 4 − 1 ＝ 3 − 1 ＝ <b>+2</b>`,
        wrong: (v) => {
          if (Math.abs(v - 3) < 1e-6) return '<p>3 は「まわりの平均」です。そこから自分（1）を引きましょう。</p>';
          if (Math.abs(v - 11) < 1e-6) return '<p>4マスの<b>合計</b>（12）から引いていませんか？ 合計を4で割って、平均にしてから引きます。</p>';
          return null;
        },
        explain: '<p>まわりの平均 3 から自分 1 を引いて <b>+2</b>。真ん中は、まわりより低い<b>谷</b>です。プラスなので、時間がたつと<b>埋まって増えます</b>。</p>',
      }));

      const q2 = DATA.q2;
      root.appendChild(ctx.quiz({
        id: 'q-lap2',
        type: 'number',
        q: `<p>真ん中が <b>${q2.self}</b>、まわりが 上 ${q2.up}、左 ${q2.left}、右 ${q2.right}、下 ${q2.down} です。真ん中の ∇²<i class="v">u</i> はいくつ？</p>`,
        prefix: '∇²<i class="v">u</i> ＝',
        answer: q2.answer,
        hints: [
          '4つの数を全部足して、4で割りましょう。',
          `(${q2.up} ＋ ${q2.left} ＋ ${q2.right} ＋ ${q2.down}) ÷ 4 ＝ 16 ÷ 4 ＝ 4 です。`,
          `平均 4 から自分 ${q2.self} を引くと…？`,
        ],
        answerText: `16 ÷ 4 − 4 ＝ <b>0</b>`,
        wrong: (v) => {
          if (Math.abs(v - 16) < 1e-6) return '<p>16 は4マスの合計です。4で割って平均にしましょう。</p>';
          if (Math.abs(v - 12) < 1e-6) return '<p>合計 16 から自分を引いていませんか？ 先に4で割って平均にします。</p>';
          if (Math.abs(v - 4) < 1e-6) return '<p>4 は「まわりの平均」です。そこから自分（4）を引きましょう。</p>';
          return null;
        },
        explain: '<p>まわりに高いマスと低いマスがあっても、<b>平均がちょうど自分と同じ</b>なら ∇²<i class="v">u</i> ＝ 0。出入りがつり合って、このマスは変わりません。</p>',
      }));

      // ===== 2. 符号の意味：砂場（A06, T05） =====
      const T = DATA.terrain;
      const sampleLap = (c) => { const s = new RD.Sim({ w: 3, h: 3 }); s.u.set([0, c.up, 0, c.left, c.self, c.right, 0, c.down, 0]); return s.breakdown(4).lapU; };
      root.appendChild(step({
        title: '符号の意味：砂場の凸凹',
        text: [
          p('砂場の凸凹を、手でならす場面を思いうかべましょう。'),
          h('div', { class: 'ch4-terrains' },
            h('div', { html: `${terrainSvg('valley', true)}<b>谷底</b>（まわりより低い）<br>∇²<i class="v">u</i> は <b class="t-diff">＋</b><br>→ 埋まって<b>増える</b>` }),
            h('div', { html: `${terrainSvg('peak', true)}<b>山のてっぺん</b>（まわりより高い）<br>∇²<i class="v">u</i> は <b class="t-diff">−</b><br>→ 削られて<b>減る</b>` }),
            h('div', { html: `${terrainSvg('slope')}<b>まっすぐな坂の途中</b><br>∇²<i class="v">u</i> は <b class="t-diff">0</b><br>→ 入る分と出る分が同じ` })),
          note('<p>覚え方：<b>∇²<i class="v">u</i> は「低いほどプラス」</b>。谷はまわりから砂（タネ）が流れこんで埋まり、山は削られます。「まわりより低いと減る」と逆に覚えないように気をつけましょう。</p>'),
          p(`坂の途中では、高いほうから入ってくる分と、低いほうへ出ていく分がちょうど同じです。たとえば 左 ${T[2].cells.left}・自分 ${T[2].cells.self}・右 ${T[2].cells.right}（上下は ${T[2].cells.up}）なら、平均は ${fmt((T[2].cells.up + T[2].cells.left + T[2].cells.right + T[2].cells.down) / 4)} で、∇²<i class="v">u</i> ＝ ${fmt(sampleLap(T[2].cells))} です。`),
        ],
      }));

      const kindName = { valley: '谷底', peak: '山のてっぺん', slope: 'まっすぐな坂の途中', flat: 'たいらな草原' };
      const cellsText = (c) => `真ん中 ${c.self}／上 ${c.up}・左 ${c.left}・右 ${c.right}・下 ${c.down}`;
      root.appendChild(ctx.quiz({
        id: 'q-sign',
        type: 'match',
        q: '<p>それぞれの地形で、赤い点のマスの ∇²<i class="v">u</i> は ＋、−、0 のどれ？ それぞれえらびましょう。</p>',
        left: T.map((t) => `<div class="ch4-mterrain">${terrainSvg(t.kind)}<span><b>${kindName[t.kind]}</b><br><span class="muted">${cellsText(t.cells)}</span></span></div>`),
        right: DATA.signs,
        answer: T.map((t) => t.sign),
        hints: [
          '∇²<i class="v">u</i> ＝ まわりの平均 − 自分。まわりより低ければ＋です。',
          '数字が書いてあるので、平均を出して自分を引いてみましょう。たとえば谷底：(5＋5＋5＋5)÷4 − 2 ＝ ？',
          '谷は＋、山は−。坂の途中とたいらな草原は、平均と自分が同じです。',
        ],
        explain: '<p>谷底は ＋（埋まる）、山のてっぺんは −（削られる）、坂の途中とたいらなところは 0（変わらない）。<b>∇²<i class="v">u</i> は「低いほどプラス」</b>です。</p>',
      }));

      // ===== 3. ∂u/∂t = D∇²u =====
      const eq = new RD.Equation({ legend: false, show: 'u' });
      eq.el.classList.add('ch4-eq');
      root.appendChild(step({
        title: '式で書くと：∂u/∂t ＝ D∇²u',
        text: [
          p('第3章のおすそ分けルールを思い出しましょう。'),
          mathBlock(`新しい <i>u</i> ＝ <i>u</i> ＋ <span class="t-diff"><i>D</i> ×（隣の平均 − 自分）</span> × Δ<i>t</i>`),
          p('第2章の「新しい <i class="v">u</i> ＝ <i class="v">u</i> ＋ ∂<i class="v">u</i>/∂<i class="v">t</i> × Δ<i class="v">t</i>」と見比べると、<b>変化の速さ</b> ∂<i class="v">u</i>/∂<i class="v">t</i> は <i class="v">D</i> ×（まわりの平均 − 自分）です。カッコの中が ∇²<i class="v">u</i> なので、'),
          mathBlock(`${dudt('u')} ＝ <span class="t-diff"><i>D</i>∇²<i>u</i></span>`),
          p('と書けます。これが<b>拡散の式</b>です。読み方は「草の変化の速さは、<i class="v">D</i> ×（まわりの平均 − 自分）」。たったこれだけです。'),
          note('<p>ゴールの式の<b>青い項</b>が、いま読めるようになった部分です。（<i class="v">D</i><sub>u</sub> は「草の <i class="v">D</i>」という意味です）</p>'),
          eq.el,
        ],
      }));

      const qn = DATA.qNext;
      root.appendChild(ctx.quiz({
        id: 'q-next',
        type: 'number',
        q: `<p>問題1の真ん中のマス（<i class="v">u</i> ＝ ${q1.self}、∇²<i class="v">u</i> ＝ +${q1.answer}）で、<i class="v">D</i> ＝ ${qn.D}、Δ<i class="v">t</i> ＝ ${qn.dt} とします。次のコマの <i class="v">u</i> はいくつ？</p>`,
        prefix: '新しい <i class="v">u</i> ＝',
        answer: qn.answer,
        hints: [
          `まず変化の速さ ∂<i class="v">u</i>/∂<i class="v">t</i> ＝ <i class="v">D</i>∇²<i class="v">u</i> を出しましょう。`,
          `∂<i class="v">u</i>/∂<i class="v">t</i> ＝ ${qn.D} × ${q1.answer} ＝ 1 です。`,
          `新しい <i class="v">u</i> ＝ ${q1.self} ＋ 1 × ${qn.dt} ＝ ？`,
        ],
        answerText: `${q1.self} ＋ ${qn.D} × ${q1.answer} × ${qn.dt} ＝ <b>${qn.answer}</b>`,
        wrong: (v) => (Math.abs(v - 1) < 1e-6 ? '<p>1 は変化の速さ（∂<i>u</i>/∂<i>t</i>）です。今の値に足しましょう。</p>' : null),
        explain: `<p>∂<i class="v">u</i>/∂<i class="v">t</i> ＝ ${qn.D} × 2 ＝ 1。1コマで 1 増えて <b>${qn.answer}</b> です。谷が埋まりました。コンピュータも、全部のマスでこれと同じ計算をしています。</p>`,
      }));

      // ===== 4. 2次元のインク（T20, T21） =====
      const ink = buildInk();
      root.appendChild(step({
        title: '広い草原でインクを1滴',
        text: [
          p('いよいよ2次元です。デモは 64×64 マスの草原（水そう）に、<b>インクを1滴</b>落としたところです。草原なら、草のタネをひとつかみまいたのと同じです。'),
          p('どのマスも、毎コマ ∂<i class="v">u</i>/∂<i class="v">t</i> ＝ <i class="v">D</i>∇²<i class="v">u</i> で計算しています（<i class="v">D</i> ＝ 1、Δ<i class="v">t</i> ＝ 0.8）。▶ 再生してみましょう。'),
          note('<p><b>色は1つの数を表しています</b>（T21）。草原の絵についている<b>カラーバー</b>（色の見本の帯）のように、うすい色が 0、こい青が大きい値です。マスを<b>クリック</b>すると、そのマスの数が見られます。</p>'),
          p('「端の近くに1滴」も試してみましょう。左の端からはみ出したインクは、<b>右の端から出てきます</b>。'),
          note('<p>🎮 <b>パックマンの画面</b>と同じで、この草原は左右の端と上下の端がつながっています（T20）。端のマスにも、ちゃんと「上下左右のとなり」があるようにするための約束です。</p>', 'story'),
          more('「色の範囲」ってなに？',
            '<p>インクが広がってうすくなると、0〜1 の色の範囲では、ほとんど白に見えます。でも、数が 0 になったわけではありません。</p>' +
            '<p>「0〜0.1」にすると、0.1 以上はすべて一番こい色になり、そのかわり、うすいところの差がよく見えます。<b>同じ数でも、カラーバーの決め方で見え方が変わる</b>ことに注意しましょう。</p>'),
        ],
        demo: ink.el,
      }));

      root.appendChild(ctx.quiz({
        id: 'q-pattern',
        type: 'predict',
        q: '<p>拡散だけ（∂<i class="v">u</i>/∂<i class="v">t</i> ＝ <i class="v">D</i>∇²<i class="v">u</i>）の草原に、でこぼこにタネをまきました。このまま待つと、模様はできるでしょうか？</p>',
        options: [
          { text: '濃いところとうすいところが分かれて、しま模様になる', why: '<p>拡散は「低いところを埋めて、高いところを削る」だけです。濃いところとうすいところの差は、小さくなる一方です。</p>' },
          { text: '濃いかたまりがいくつかにまとまって、水玉模様になる', why: '<p>途中で、ぼんやりしたかたまりに見えることがあります。でも、それは消えていくとちゅうの姿です。最後まで待つと、かたまりもならされてしまいます。</p>' },
          { text: 'どこも同じ濃さになって、模様は消える', correct: true },
          { text: 'タネがなくなって、真っ白になる', why: '<p>おすそ分けは、となりに移すだけです。タネの<b>合計は変わりません</b>（デモの「合計」を見てみましょう）。真っ白ではなく、全体が同じ濃さになります。</p>' },
        ],
        observe: () => ink.randomRun(),
        observeLabel: '▶ でこぼこにまいて待ってみる',
        explain: '<p>拡散だけだと、山は削られ、谷は埋まり、最後は<b>どこも同じ濃さ（一様）</b>になります。「いちばん濃い」と「いちばんうすい」の差がどんどん縮んでいくのを見てみましょう。</p>',
      }));

      root.appendChild(note(
        '<h3 style="margin-top:0">🔍 じゃあ、模様はどうやってできるの？</h3>' +
        '<p>拡散は、凸凹を<b>ならして消す</b>はたらきです。待てば待つほど、草原はのっぺり一様になります。</p>' +
        '<p>ところが、プロローグで見たシマウマのしまや水玉の模様は、反応拡散方程式から<b>生まれて</b>いました。そしてその式には、この拡散の項がちゃんと入っています。</p>' +
        '<p><b>ならすはずの拡散が入っているのに、どうして模様ができるのでしょう？</b></p>' +
        '<p>カギは、次の章から登場する<b>ウサギ</b>（反応）と、草とウサギの<b>広がる速さのちがい</b>にあります。この謎は<b>第7章</b>で解きます。覚えておいてください。</p>',
        'mystery'));

      root.appendChild(more('もっと詳しく：∇² と「2回微分」',
        '<p>教科書などでは、∇²<i>u</i> は「2回微分」を使って書かれています。この教材の「まわりの平均 − 自分」との関係を、1次元で見てみましょう。</p>' +
        '<p>マスの間かくを <i>h</i> とします。坂の<b>かたむき</b>は「となりとの差 ÷ <i>h</i>」です。右側のかたむきは (<i>u</i><sub>右</sub> − <i>u</i>) ÷ <i>h</i>、左側のかたむきは (<i>u</i> − <i>u</i><sub>左</sub>) ÷ <i>h</i>。</p>' +
        '<p>「かたむきの変わり方」が2回微分です。右と左のかたむきの差を、もう一度 <i>h</i> で割ると</p>' +
        '<p style="text-align:center">(<i>u</i><sub>右</sub> − 2<i>u</i> ＋ <i>u</i><sub>左</sub>) ÷ <i>h</i>²</p>' +
        '<p>になります。これは「隣の平均 − 自分」の <b>2 ÷ <i>h</i>²</b> 倍です。谷の形（∪）はかたむきが増えていくので＋、山の形（∩）は−。符号の意味も同じです。</p>' +
        '<p>2次元では、本物の ∇² は上下左右の4マスを使って (上 ＋ 下 ＋ 左 ＋ 右 − 4 × 自分) ÷ <i>h</i>² と書きます（5点差分）。これは、この教材の ∇² の <b>4 ÷ <i>h</i>²</b> 倍です。</p>' +
        '<p>この 4 や <i>h</i>² のような決まった数は、まとめて <i>D</i> の中に入れてしまったと考えてください。<i>D</i> の値が教科書とちがって見えても、計算していることは同じです。</p>'));

      root.appendChild(teacher(
        '<p><b>扱うつまずき：</b>★T04（∇² の正体）、T05（符号の向き）、T20（端）、T21（色の意味）、★T07（拡散だけでは模様が消える → 謎として第7章へ）。</p>' +
        '<p><b>問いかけの例：</b></p><ul>' +
        '<li>「∇² の記号を見て、どう思った？」→「中身は、まわりの平均 − 自分 だけだよ」と言い切って安心させる</li>' +
        '<li>「谷のマスは増える？減る？ 砂場だったら？」（手で砂をならすしぐさをすると伝わりやすい）</li>' +
        '<li>「インクの合計は、時間がたつと変わる？」（変わらない）</li>' +
        '<li>「拡散だけで待ったら、模様はできる？」→ 予想させてから観察し、最後の謎をいっしょに読む</li></ul>' +
        '<p><b>よくある反応：</b>「まわりより低いと減る」と逆に覚える（T05）。「低いほどプラス」と声に出して確認してください。∇² を計算するとき、4で割り忘れて合計から引く子もいます。</p>' +
        '<p>「2回微分」という言葉は、本人が聞いてきたら「もっと詳しく」を一緒に読む程度でいいです。最後の謎（なぜ模様ができる？）は、答えを言わずに第7章まで引っぱってください。</p>'));

      // ---------------------------------------------------------------
      // 3×3 の ∇² デモ（計算は RD.Sim で行う＝コンピュータの答え）
      function buildLapDemo() {
        const sim = new RD.Sim({ w: 3, h: 3, terms: Object.assign({}, DIFF_ONLY) });
        const presets = {
          valley: { up: 3, left: 3, self: 1, right: 3, down: 3 },
          peak: { up: 2, left: 2, self: 6, right: 2, down: 2 },
          slope: { up: 4, left: 2, self: 4, right: 6, down: 4 },
          mixed: { up: 6, left: 2, self: 5, right: 5, down: 3 },
        };
        const out = h('div', { class: 'ch4-lap', 'aria-live': 'polite' });
        const isCell = (r, c) => (r + c) % 2 === 1 || (r === 1 && c === 1);
        const grid = RD.ui.numGrid({
          values: toGrid(presets.valley),
          editable: isCell,
          highlight: (r, c) => r === 1 && c === 1,
          format: (v) => fmt(v, 3),
          onChange: () => update(),
        });
        [[0, 0], [0, 2], [2, 0], [2, 2]].forEach(([r, c]) => { grid.cell(r, c).classList.add('dim'); grid.cell(r, c).title = 'ななめのマスは使いません'; });
        function update() {
          const g = grid.values;
          const vals = { up: g[0][1], left: g[1][0], self: g[1][1], right: g[1][2], down: g[2][1] };
          if (Object.values(vals).some((x) => x == null || !isFinite(x))) {
            out.innerHTML = '<span class="cmt muted">5つのマスに数字を入れてください</span>';
            return;
          }
          sim.u.fill(0);
          sim.u.set([0, vals.up, 0, vals.left, vals.self, vals.right, 0, vals.down, 0]);
          const b = sim.breakdown(4);
          const lap = b.lapU;
          const f = (x) => fmt(x, 3);
          const meaning = lap > 1e-9 ? '<b class="t-diff">プラス</b>：まわりより低い<b>谷</b>。埋まって増えます。'
            : lap < -1e-9 ? '<b class="t-diff">マイナス</b>：まわりより高い<b>山</b>。削られて減ります。'
              : '<b class="t-diff">0</b>：まわりの平均と同じ。変わりません。';
          out.innerHTML =
            `<div>まわりの平均 ＝ (${f(vals.up)} ＋ ${f(vals.left)} ＋ ${f(vals.right)} ＋ ${f(vals.down)}) ÷ 4 ＝ ${f(b.avgU)}</div>` +
            `<div class="big">∇²<i>u</i> ＝ ${f(b.avgU)} − ${f(vals.self)} ＝ <span class="t-diff">${sgn(lap)}</span></div>` +
            `<div class="cmt">${meaning}</div>`;
        }
        const set = (k) => { grid.setValues(toGrid(presets[k])); update(); };
        update();
        const el = card('真ん中のマスの ∇²u',
          h('div', { class: 'row', style: { marginBottom: '10px', justifyContent: 'center' } },
            RD.ui.button('谷', () => set('valley'), { small: true }),
            RD.ui.button('山', () => set('peak'), { small: true }),
            RD.ui.button('坂', () => set('slope'), { small: true }),
            RD.ui.button('まぜこぜ', () => set('mixed'), { small: true })),
          h('div', { class: 'ch4-gridwrap' }, grid.el),
          out,
          h('p', { class: 'muted', html: 'マスの数字は書き換えられます。点線のななめのマスは使いません。' }));
        return { el };
      }

      // 2次元のインク（拡散だけ）
      function buildInk() {
        const I = DATA.ink;
        const sim = new RD.Sim({ w: I.size, h: I.size, Du: I.D, dt: I.dt, terms: Object.assign({}, DIFF_ONLY) });
        let start = 'center';
        const statsEl = h('div', { class: 'ch4-stats' });
        const pickEl = h('div', { class: 'readout' });
        const view = new RD.FieldView(sim, {
          field: 'u', palette: 'ink', range: [0, 1], readout: false, maxPx: 448,
          title: '色 ＝ インク（タネ）の濃さ <i class="v">u</i>',
          picked: sim.idx(I.center[0], I.center[1]),
          onPick: () => showPick(),
        });
        const drop = (cx, cy) => {
          sim.reset(0, 0);
          const r = I.radius;
          for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
            if (dx * dx + dy * dy > r * r) continue;
            const x = (cx + dx + I.size) % I.size, y = (cy + dy + I.size) % I.size;
            sim.u[sim.idx(x, y)] = I.value;
          }
        };
        const load = () => {
          if (start === 'center') drop(I.center[0], I.center[1]);
          else if (start === 'edge') drop(I.edge[0], I.edge[1]);
          else { sim.reset(0, 0); for (let i = 0; i < sim.n; i++) sim.u[i] = Math.random(); }
        };
        const showPick = () => {
          if (view.picked == null) { pickEl.textContent = 'マスをクリック（タップ）すると値が見られます'; return; }
          const [x, y] = sim.xy(view.picked);
          pickEl.innerHTML = `えらんだマス（${x + 1}, ${y + 1}）の濃さ <i class="v">u</i> ＝ <b>${fmt(sim.u[view.picked], 4)}</b>`;
        };
        const showStats = () => {
          let lo = Infinity, hi = -Infinity, sum = 0;
          for (let i = 0; i < sim.n; i++) { const a = sim.u[i]; sum += a; if (a < lo) lo = a; if (a > hi) hi = a; }
          statsEl.replaceChildren(
            h('div', { html: `いちばん濃い<b>${fmt(hi, 4)}</b>` }),
            h('div', { html: `いちばんうすい<b>${fmt(lo, 4)}</b>` }),
            h('div', { html: `インクの合計<b>${fmt(sum, 1)}</b>` }));
        };
        const frame = () => { view.render(); showPick(); showStats(); };
        const runner = new RD.Runner({
          sim, onFrame: frame, onReset: load,
          speeds: [{ label: 'ゆっくり', spf: 1 }, { label: 'ふつう', spf: 4 }, { label: 'はやい', spf: 16 }], speed: 1,
        });
        const startWith = (s) => { start = s; runner.pause(); load(); runner.draw(); };
        const rangeSeg = RD.ui.segmented([{ value: 1, label: '0〜1' }, { value: 0.1, label: '0〜0.1' }], 1, (v) => {
          view.setField('u', [0, v]);
          if (v < 1) view.cbHi.textContent = fmt(v, 2) + ' 以上';
        });
        load(); runner.draw();
        const el = card('64×64 の草原：拡散だけ',
          h('div', { class: 'row', style: { justifyContent: 'center', marginBottom: '8px' } },
            RD.ui.button('真ん中に1滴', () => startWith('center'), { small: true }),
            RD.ui.button('端の近くに1滴', () => startWith('edge'), { small: true }),
            RD.ui.button('でこぼこにまく', () => startWith('random'), { small: true })),
          view.el, pickEl, runner.el,
          h('div', { class: 'row', style: { justifyContent: 'center', margin: '8px 0' } }, h('span', { class: 'muted', text: '色の範囲：' }), rangeSeg.el),
          statsEl);
        return {
          el,
          randomRun() {
            rangeSeg.set(1, true);
            startWith('random');
            runner.speedSeg && runner.speedSeg.set(2, true);
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => runner.play(), 400);
          },
        };
      }
    },
  });
})(window.RD = window.RD || {});
