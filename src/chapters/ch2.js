// 第2章：記号 ∂u/∂t と「場」（★T02, T03, ★T01 復習 / A02 各地点の温度計, A01 / M02 1マスの家計簿）
// ねらい：u は場所ごとに値を持つ地図であり、∂u/∂t は「その場所での変化の速さ」だとわかる。
(function (RD) {
  const { h, p, step, note, more, teacher, card, math, mathBlock, dudt, fmt } = RD.ui;

  // ---- 計算の部品（テストからも使う） ----
  const round9 = (x) => Math.round(x * 1e9) / 1e9;
  const nextMap = (u, d, dt) => u.map((row, r) => row.map((x, c) => round9(x + d[r][c] * dt)));

  // デモの草原（5×5）。真ん中が草の多い丘。
  const DEMO = {
    dt: 0.5,
    Du: 1,
    u: [
      [0.2, 0.2, 0.4, 0.2, 0.2],
      [0.2, 0.6, 0.8, 0.6, 0.2],
      [0.4, 0.8, 1.0, 0.8, 0.4],
      [0.2, 0.6, 0.8, 0.6, 0.2],
      [0.2, 0.2, 0.4, 0.2, 0.2],
    ],
  };

  // 問題の数字（問題文もここから作る。テストで検算する）
  const DATA = {
    calc: { u: 5, dudt: -2, dt: 0.5, answer: 4 },
    grid: {
      dt: 0.5,
      u: [[0.6, 0.4, 0.8], [0.2, 0.5, 0.3], [1.0, 0.7, 0.4]],
      dudt: [[-0.2, 0.2, 0.4], [0.4, 0.1, -0.2], [-0.6, 0, 0.2]],
    },
    rate: { dudt: 0.3 },
  };
  DATA.grid.answer = nextMap(DATA.grid.u, DATA.grid.dudt, DATA.grid.dt);

  const sgn = (v, d = 3) => (v > 1e-9 ? '+' + fmt(v, d) : v < -1e-9 ? '−' + fmt(-v, d) : '0');
  // 色：草の量は緑の濃さ、速さは増える＝緑／減る＝赤みで（テーマに合わせて CSS 変数を混ぜる）
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const uColor = (v) => `color-mix(in srgb, var(--t-u) ${Math.round(clamp01(v) * 58)}%, var(--card))`;
  const dColor = (v) => {
    const a = Math.round(Math.min(1, Math.abs(v) / 0.4) * 45);
    if (Math.abs(v) < 1e-9) return 'var(--card)';
    return `color-mix(in srgb, ${v > 0 ? 'var(--t-feed)' : 'var(--ng)'} ${a}%, var(--card))`;
  };
  const DU = `<span class="ch2-du">${dudt('u')}</span>`;

  const CSS = `
  .ch2-maps { display: flex; flex-wrap: wrap; gap: 14px; justify-content: center; }
  .ch2-map { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .ch2-map .cap { font-size: 0.88rem; color: var(--ink-2); line-height: 1.5; text-align: center; }
  .ch2-maps .numgrid .cell { width: 3.7em; height: 2.4em; font-size: 0.82rem; font-weight: 700; }
  .ch2-small .numgrid .cell { width: 3.2em; height: 2.3em; }
  .ch2-qmaps.ch2-maps { gap: 10px 18px; justify-content: flex-start; }
  .ch2-qnext { font-size: 0.92rem; color: var(--ink-2); margin: 6px 0 0; }
  .ch2-du { font-size: 0.92em; }
  .ch2-led { max-width: 360px; margin: 10px auto 0; }
  .ch2-led td .math { font-size: 1.05em; }
  .ch2-msg { text-align: center; font-size: 0.9rem; color: var(--ink-2); min-height: 1.6em; margin: 6px 0; }
  .ch2-msg b { color: var(--ok); }
  .ch2-read { font-family: var(--font-math); font-size: 1.7rem; text-align: center; margin: 4px 0; }
  .ch2-qmaps { display: flex; flex-wrap: wrap; gap: 12px 18px; align-items: center; margin: 8px 0; }
  .ch2-thermo { display: grid; grid-template-columns: repeat(3, auto); gap: 6px; justify-content: center; margin: 6px 0; }
  .ch2-thermo div { background: var(--card-2); border: 1px solid var(--line); border-radius: 8px; padding: 2px 8px; font-size: 0.85rem; text-align: center; font-family: var(--font-mono); }
  `;

  // 3×3 などの読み取り専用の地図
  const mapView = (vals, color, format) => RD.ui.numGrid({ values: vals, format, color });

  RD.registerChapter({
    id: 'ch2',
    no: 2,
    title: '記号 ∂u/∂t と「場」',
    desc: '草の量は場所ごとの「地図」。∂u/∂t はその場所での変化の速さです。',
    goal: '<i>u</i> は場所ごとに値を持つ地図で、∂<i>u</i>/∂<i>t</i> は「その場所での変化の速さ」だとわかる',
    required: 5, // 全問
    data: Object.assign({ demo: DEMO }, DATA),
    lib: { nextMap },

    render(root, ctx) {
      root.appendChild(h('style', { text: CSS }));

      // ================= 1. u は「地図」（T02, A02） =================
      const sel1 = { r: 2, c: 2 };
      const read1 = h('div', { class: 'ch2-msg', 'aria-live': 'polite' });
      const g1 = RD.ui.numGrid({
        values: DEMO.u, format: (v) => fmt(v, 2), color: uColor,
        highlight: (r, c) => r === sel1.r && c === sel1.c,
        onCellClick: (r, c) => { sel1.r = r; sel1.c = c; g1.render(); show1(); },
      });
      const show1 = () => { read1.innerHTML = `${sel1.r + 1}行${sel1.c + 1}列のマス：草の量 <i class="v t-u">u</i> ＝ <b>${fmt(DEMO.u[sel1.r][sel1.c], 2)}</b>`; };
      show1();

      root.appendChild(step({
        title: '草の量は、場所ごとにちがう',
        text: [
          p('第1章では、草原の<b>1か所</b>だけを見ました。でも本当の草原は広くて、草がたくさん生えている場所も、少ない場所もあります。'),
          p('そこで、草原を小さなマス目に区切って、<b>マスごとに</b>草の量を書きこみます。「5×5 の草原」の図は 25 マスの草原です。色が濃いほど草が多いところです。'),
          note('<p>☀️ <b>天気予報の気温の地図</b>を思い出してください。「東京 18℃、札幌 9℃、那覇 25℃…」と、場所ごとに気温がちがいますね。気温は1つの数ではなく、<b>場所ごとの数の集まり</b>（地図）です。</p>', 'story'),
          p('草の量を <i class="v t-u">u</i> と書くとき、<i class="v t-u">u</i> は1つの数ではありません。<b>マスの数だけ数がある「地図」</b>です。このように、場所ごとに値を持つものを<b>場</b>（ば）といいます。'),
          p('マスをクリックすると、そのマスの <i class="v t-u">u</i> が見られます。'),
          more('「場」ということばについて',
            '<p>物理では、場所ごとに値が決まっているものを「場（field）」とよびます。気温の場、風の場、磁石のまわりの磁場など。このドリルの草の量 <i>u</i> も、ウサギの濃さ <i>v</i> も「場」です。</p>' +
            '<p>ふつうの方程式の <i>x</i> は「1つの数」を表しますが、ここでの <i>u</i> は「地図まるごと」を表しています。ここが大きなちがいです。</p>'),
        ],
        demo: [card('🌱 5×5 の草原（数字 ＝ 草の量 u）', h('div', { class: 'ch2-maps' }, g1.el), read1)],
      }));

      root.appendChild(ctx.quiz({
        id: 'map', type: 'choice',
        q: '<p>「5×5 の草原」の図で「草の量 <i class="v t-u">u</i> はいくつ？」と聞かれました。いちばんよい答えはどれですか？</p>',
        options: [
          { text: '<i>u</i> は 1 つの数。真ん中のマスの 1 が <i>u</i>', why: '<p>真ん中のマスの値は 1 ですが、それは「真ん中のマスの <i>u</i>」です。ほかのマスにはそれぞれ別の値があります。<i>u</i> は1つの数ではありません。</p>' },
          { text: '<i>u</i> は 25 マス全部の平均の 1 つの数', why: '<p>平均にすると、どこに草が多いかという情報が消えてしまいます。<i>u</i> は場所ごとの値をそのまま持っている<b>地図</b>です。</p>' },
          { text: '<i>u</i> はマスごとにちがう値を持つ「地図」。どのマスか言わないと、数は決まらない', correct: true },
          { text: '<i>u</i> はまだ計算していないので、分からない', why: '<p>計算しなくても、地図の数字として書いてあります。ただし、<b>どのマスの</b> <i>u</i> かを決めないと1つの数にはなりません。</p>' },
        ],
        hints: ['天気予報の気温の地図では、「気温はいくつ？」と聞かれたらどう答えますか？', '「どこの気温？」と聞き返したくなりますね。<i>u</i> も同じです。', '<i>u</i> は 25 個の数をまとめた「地図」です。'],
        explain: '<p><i>u</i> は場所ごとの値の地図（場）です。「<i>u</i> ＝ 0.8」のように1つの数で言うときは、<b>どのマスの話か</b>がかくれています。</p>',
      }));

      // ================= 2. 記号 ∂u/∂t（T03, A02, T01） =================
      root.appendChild(step({
        title: '記号 ∂u/∂t ：その場所での変化の速さ',
        text: [
          p('いよいよ、ゴールの式の左側に出てくる記号です。'),
          h('div', { class: 'ch2-read' }, h('span', { html: dudt('u') })),
          p('読み方は「<b>ラウンド ユー ラウンド ティー</b>」です。∂ は「ラウンド」と読みます（丸い d、という意味）。'),
          p('意味は、たった一言です。'),
          note(`<p>${DU} ＝ <b><i class="v t-u">u</i> の変化の速さ（場所はそのまま）</b></p>`),
          p('分数の形をしているのには、わけがあります。'),
          h('ul', null,
            h('li', { html: '上の ∂<i>u</i>：<i>u</i> が<b>ほんの少し変わった分</b>' }),
            h('li', { html: '下の ∂<i>t</i>：そのためにかかった<b>ほんの少しの時間</b>（<i>t</i> は time の t）' }),
            h('li', { html: '変わった分 ÷ 時間 ＝ <b>速さ</b>。「道のり ÷ 時間 ＝ 速さ」と同じ形です。' })),
          note('<p>🌡️ <b>温度計のたとえ：</b>草原のマス1つ1つに温度計が立っていると想像してください。温度計は動かず、その場所で針の動きだけを見ています。「その場所で、1秒にどれだけ上がるか下がるか」。これが ∂ の気持ちです。</p>', 'story'),
          h('div', { class: 'ch2-thermo', 'aria-hidden': 'true' }, ['🌡️ +0.1', '🌡️ 0', '🌡️ −0.2', '🌡️ 0', '🌡️ +0.3', '🌡️ +0.1'].map((t) => h('div', { text: t }))),
          p(`速さも場所ごとにちがうので、${DU} も<b>地図</b>になります。`),
          note(`<p>⚠️ ${DU} ＝ 3 は「<i>u</i> ＝ 3」ではありません。「<i>u</i> が<b>1秒あたり 3 ずつ増えている</b>」という意味です。第1章の「帳簿」と「残高」を思い出しましょう。</p>`, 'warn'),
          more('d と ∂ はどうちがうの？',
            '<p>教科書では <i>du</i>/<i>dt</i> のように、ふつうの d を使うこともあります。これは、<i>u</i> が時間 <i>t</i> だけで決まるとき（第1章の「1か所の草」のように）に使います。</p>' +
            '<p>この章の <i>u</i> は、<b>時間</b>と<b>場所</b>の両方で変わります。そこで「場所は動かさずに、時間の変化だけを見ますよ」という目印として、丸い ∂ を使います。</p>' +
            '<p>このドリルでは「∂ を見たら、<b>場所を固定して時間だけ見る</b>」とだけ覚えておけば十分です。</p>'),
        ],
      }));

      root.appendChild(ctx.quiz({
        id: 'partial', type: 'choice',
        q: `<p>${DU} の <b>∂</b>（ラウンド）が表している見方として、正しいのはどれですか？</p>`,
        options: [
          { text: '場所はそのままにして、<b>時間による変化だけ</b>を見る', correct: true },
          { text: '時間はそのままにして、<b>となりのマスとの差</b>を見る', why: '<p>となりのマスとの比べっこは、第3章・第4章で出てくる別のルールです。∂<i>u</i>/∂<i>t</i> の下には ∂<i>t</i>（時間）があるので、見ているのは<b>時間による変化</b>です。</p>' },
          { text: '場所も時間も、両方いっしょに動かして見る', why: '<p>両方いっしょに動かすと、「時間がたったから変わった」のか「別の場所に行ったから変わった」のか区別できません。∂ は<b>場所を固定</b>する目印です。</p>' },
          { text: '<i>u</i> の<b>値そのもの</b>を表している', why: '<p>∂<i>u</i>/∂<i>t</i> は値ではなく<b>変化の速さ</b>です（第1章の帳簿）。値そのものは <i>u</i> です。</p>' },
        ],
        hints: ['温度計のたとえを思い出しましょう。温度計は歩き回りますか？', '温度計はその場所に立ったまま、針の動き（時間による変化）だけを見ています。', '下の ∂<i>t</i> は「時間」。場所は固定です。'],
        explain: '<p>∂ は「場所を固定して、時間による変化だけを見る」目印です。各マスに立てた温度計の針の動き、と覚えておきましょう。</p>',
      }));

      const R = DATA.rate;
      root.appendChild(ctx.quiz({
        id: 'rate', type: 'choice',
        q: `<p>あるマスで ${DU} ＝ <b>${R.dudt}</b> だと分かりました。このマスについて、正しいのはどれですか？</p>`,
        options: [
          { text: `このマスの草の量は <i>u</i> ＝ ${R.dudt}`, why: `<p>これが ★いちばん多いまちがいです。${R.dudt} は<b>速さ</b>（帳簿）で、<b>量</b>（残高）ではありません。貯金箱の帳簿が +30 円でも、残高が 30 円とは限りませんでしたね。</p>` },
          { text: `このマスの草は 1 秒あたり ${R.dudt} ずつ増えている。いまの量 <i>u</i> は、これだけでは分からない`, correct: true },
          { text: `このマスの草は 1 秒あたり ${R.dudt} ずつ減っている`, why: `<p>${R.dudt} はプラスなので、<b>増えて</b>います。減っているなら、マイナスの数になります。</p>` },
          { text: `草原のどのマスでも、草は ${R.dudt} ずつ増えている`, why: '<p>∂<i>u</i>/∂<i>t</i> も<b>地図</b>です。マスごとに速さはちがいます。分かったのは「このマス」の速さだけです。</p>' },
        ],
        hints: ['∂<i>u</i>/∂<i>t</i> は「量」と「速さ」のどちらでしたか？', '速さが分かっても、いまの量は分かりません（帳簿を見ても、残高は分からない）。', 'プラスの速さは「増えている」。そして、このマスの話だけです。'],
        explain: `<p>${DU} ＝ ${R.dudt} は「このマスでは、草が1秒あたり ${R.dudt} ずつ増えている」という意味です。いまの量は、<i>u</i> の地図を見ないと分かりません。</p>`,
      }));

      // ================= 3. 地図ぜんぶを1コマ進める（M02 の家計簿） =================
      const sim = new RD.Sim({ w: 5, h: 5, Du: DEMO.Du, dt: DEMO.dt, terms: { feed: false, react: false, decay: false } });
      const load = () => { sim.reset(); DEMO.u.forEach((row, r) => row.forEach((x, c) => { sim.u[sim.idx(c, r)] = x; })); };
      load();
      const sel = { r: 1, c: 1 };
      const uVals = () => Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => sim.u[sim.idx(c, r)]));
      const dVals = () => Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => sim.breakdown(sim.idx(c, r)).dudt));
      const pick = (r, c) => { sel.r = r; sel.c = c; msg.innerHTML = ''; lastNext = sim.breakdown(sim.idx(c, r)).uNext; draw3(); };
      const hl = (r, c) => r === sel.r && c === sel.c;
      const gU = RD.ui.numGrid({ values: uVals(), format: (v) => fmt(v, 3), color: uColor, highlight: hl, onCellClick: pick });
      const gD = RD.ui.numGrid({ values: dVals(), format: (v) => sgn(v, 3), color: dColor, highlight: hl, onCellClick: pick });
      const ledBody = h('tbody');
      const ledCap = h('div', { class: 'cap' });
      const led = h('div', { class: 'ledger-wrap ch2-led' }, ledCap, h('table', { class: 'ledger' }, ledBody));
      const msg = h('div', { class: 'ch2-msg', 'aria-live': 'polite' });
      let lastNext = sim.breakdown(sim.idx(sel.c, sel.r)).uNext;
      const tr = (label, val, cls) => h('tr', { class: cls }, h('td', { html: label }), h('td', { class: 'num', html: val }));
      function draw3() {
        gU.setValues(uVals());
        gD.setValues(dVals());
        const b = sim.breakdown(sim.idx(sel.c, sel.r));
        ledCap.innerHTML = `📒 えらんだマス（${sel.r + 1}行${sel.c + 1}列）の家計簿`;
        ledBody.replaceChildren(
          tr('今の草の量 <i class="v t-u">u</i>', fmt(b.u, 3)),
          tr(`変化の速さ ${math(dudt('u')).outerHTML}`, sgn(b.dudt, 3)),
          tr('時間の刻み Δ<i>t</i>', fmt(b.dt, 2)),
          tr(`変わる分 ${math(dudt('u') + ' × Δ<i>t</i>').outerHTML}`, sgn(b.dudt * b.dt, 3), 'sum'),
          tr('新しい <i class="v t-u">u</i>', fmt(b.uNext, 3), 'next'));
      }
      const runner = new RD.Runner({
        sim,
        speeds: [{ label: 'ゆっくり', spf: 1 / 50 }, { label: 'ふつう', spf: 1 / 15 }], speed: 0,
        onFrame: draw3,
        onStep: () => {
          const now = sim.u[sim.idx(sel.c, sel.r)];
          msg.innerHTML = `さっきの「新しい <i>u</i>」${fmt(lastNext, 3)} が、いまの <i>u</i> ＝ ${fmt(now, 3)} になりました <b>✓</b>`;
          lastNext = sim.breakdown(sim.idx(sel.c, sel.r)).uNext;
        },
        onReset: () => { load(); msg.innerHTML = ''; lastNext = sim.breakdown(sim.idx(sel.c, sel.r)).uNext; },
        timeLabel: (s) => `${s.steps} コマ目（時刻 ${fmt(s.time, 2)}）`,
      });

      root.appendChild(step({
        title: '地図ぜんぶを、1コマ進める',
        text: [
          p('第1章のルール「新しい値 ＝ 今の値 ＋ 速さ × 時間」を、新しい記号で書くとこうなります。'),
          mathBlock(`新しい <i class="t-u">u</i> ＝ <i class="t-u">u</i> ＋ ${dudt('u')} × Δ<i>t</i>`),
          p('Δ<i>t</i> は「<b>デルタ ティー</b>」と読み、<b>時間の刻み</b>（1コマぶんの時間）のことです。第1章で「時間の刻み」とよんでいたものに、記号の名前がついただけです。'),
          p('このルールを、<b>すべてのマスで同時に</b>使います。マスごとに <i>u</i> も ∂<i>u</i>/∂<i>t</i> もちがうので、それぞれのマスが自分の「家計簿」で計算します。'),
          h('ol', null,
            h('li', { html: '<i>u</i> の地図と、∂<i>u</i>/∂<i>t</i> の地図をくらべる。同じ場所のマスどうしが組です。' }),
            h('li', { html: 'マスをクリックして、その<b>家計簿</b>を見る。「新しい <i>u</i>」を覚えておく。' }),
            h('li', { html: '「1コマ進める」を押す。覚えた数が、本当に次の <i>u</i> になった？' }),
            h('li', { html: '何コマか進めて、地図ぜんたいがどう変わるか見る。' })),
          note('<p>この ∂<i>u</i>/∂<i>t</i> の値は、第3章で学ぶ「<b>草のタネが風で広がる</b>」ルールで、コンピュータが計算しています。いまは中身は気にせず、「マスごとに速さが決まっている」とだけ思ってください。<br>草の多い丘のてっぺんは減り（−）、まわりは増えて（＋）いますね。</p>'),
          note('<p>コンピュータがしていることは、これだけです。<b>全部のマスで「今の値 ＋ 速さ × 時間」を計算して、次のコマの地図を作る。</b>それを何万回もくり返すと、模様が生まれます。</p>', 'story'),
        ],
        demo: [card('📒 草原の家計簿（Δt ＝ ' + DEMO.dt + '）',
          h('div', { class: 'ch2-maps' },
            h('div', { class: 'ch2-map' }, h('div', { class: 'cap', html: '草の量 <i class="v t-u">u</i> の地図' }), gU.el),
            h('div', { class: 'ch2-map' }, h('div', { class: 'cap', html: `変化の速さ ${math(dudt('u')).outerHTML} の地図` }), gD.el)),
          led, msg, runner.el)],
      }));

      const C = DATA.calc;
      root.appendChild(ctx.quiz({
        id: 'calc', type: 'number',
        q: `<p>あるマスの草を「束」で数えます。いま <i class="v t-u">u</i> ＝ <b>${C.u}</b> 束、${DU} ＝ <b>${sgn(C.dudt, 2)}</b>（1秒あたり2束ずつ減る）、時間の刻み Δ<i>t</i> ＝ <b>${C.dt}</b> 秒です。<br>1コマ後の <i class="v t-u">u</i> はいくつですか？</p>`,
        prefix: '新しい <i>u</i> ＝',
        unit: '束',
        answer: C.answer,
        hints: [
          `新しい <i>u</i> ＝ <i>u</i> ＋ ∂<i>u</i>/∂<i>t</i> × Δ<i>t</i> に、数を入れます。`,
          `変わる分：(−2) × 0.5 ＝ −1`,
          `${C.u} ＋ (−1) ＝ ？`,
        ],
        answerText: `${C.u} ＋ (−2) × ${C.dt} ＝ ${C.u} − 1 ＝ <b>${C.answer}</b> 束`,
        wrong: (v) => {
          if (Math.abs(v + 2) < 1e-9) return '<p>−2 は ∂<i>u</i>/∂<i>t</i>、つまり<b>速さ</b>です。聞いているのは<b>新しい草の量</b>です。</p>';
          if (Math.abs(v + 1) < 1e-9) return '<p>−1 は1コマで<b>変わる分</b>（帳簿）です。今の <i>u</i> ＝ 5 に足しましょう。</p>';
          if (Math.abs(v - 3) < 1e-9) return '<p>Δ<i>t</i> ＝ 0.5 をかけ忘れていませんか？ 1コマは 0.5 秒なので、減るのは 2 の半分です。</p>';
          if (Math.abs(v - 6) < 1e-9) return '<p>∂<i>u</i>/∂<i>t</i> はマイナスなので、草は<b>減り</b>ます。</p>';
          return null;
        },
        explain: `<p>${C.u} ＋ (−2) × ${C.dt} ＝ ${C.u} − 1 ＝ ${C.answer}。第1章とまったく同じ計算です。記号が変わっても、中身は「今の値 ＋ 速さ × 時間」です。</p>`,
      }));

      // ---- マス入力の問題 ----
      const GQ = DATA.grid;
      const fmt2 = (v) => fmt(v, 2);
      const prefill = GQ.u.map((row, r) => row.map((_, c) => (r === 0 && c === 0 ? GQ.answer[0][0] : null)));
      const qEl = h('div', null,
        p(`3×3 の草原の <i class="v t-u">u</i> の地図と、${DU} の地図があります。時間の刻みは <b>Δ<i>t</i> ＝ ${GQ.dt}</b> です。<br>1コマ後の <i class="v t-u">u</i> の地図を完成させてください（左上は例として埋めてあります）。`),
        h('div', { class: 'ch2-qmaps ch2-maps ch2-small' },
          h('div', { class: 'ch2-map' }, h('div', { class: 'cap', html: '今の <i class="v t-u">u</i>' }), mapView(GQ.u, uColor, fmt2).el),
          h('div', { class: 'ch2-map' }, h('div', { class: 'cap', html: `${math(dudt('u')).outerHTML}` }), mapView(GQ.dudt, dColor, (v) => sgn(v, 2)).el)),
        h('div', { class: 'ch2-qnext', html: '↓ 1コマ後の <i class="v t-u">u</i>（空いているマスに数を入れます）' }));
      root.appendChild(ctx.quiz({
        id: 'grid', type: 'grid',
        q: qEl,
        prefill,
        answer: GQ.answer,
        format: fmt2,
        color: uColor,
        hints: [
          '1マスずつ計算します。使うのは、そのマスの <i>u</i> と、<b>同じ場所</b>の ∂<i>u</i>/∂<i>t</i> だけです。となりのマスは関係ありません。',
          `Δ<i>t</i> ＝ 0.5 なので、「速さ × 0.5」は速さの半分です。例：真ん中は 0.5 ＋ 0.1 × 0.5 ＝ 0.55`,
          '速さが 0 のマス（下の真ん中）は、0 ではなく<b>今の値のまま</b>です。マイナスのマスは減ります。',
        ],
        answerText: GQ.answer.map((row) => row.map((v) => fmt(v, 2)).join('　')).join('<br>'),
        explain: '<p>どのマスも「今の <i>u</i> ＋ ∂<i>u</i>/∂<i>t</i> × Δ<i>t</i>」。速さ 0 のマスは変わらず、0.7 のままでしたね。コンピュータは、これを草原の何万マスで、何万回もくり返しています。</p>',
      }));

      root.appendChild(teacher(
        '<p><b>扱うつまずき：</b>★T02（<i>u</i> は場所ごとの地図）、T03（∂ と d）、★T01（値と変化の区別の復習）。</p>' +
        '<p><b>d と ∂ のちがいには深入りしなくて大丈夫です。</b>「場所ごとに温度計」の一言で十分です。本人が気にしたら「もっと詳しく」を一緒に読んでください。</p>' +
        '<p><b>問いかけの例：</b></p><ul>' +
        '<li>「天気予報で『気温はいくつ？』と聞かれたら、なんて答える？」（場所を聞き返したら、<i>u</i> も同じだと伝える）</li>' +
        '<li>「∂<i>u</i>/∂<i>t</i> ＝ 3 のマスでは、草は 3 ある？」（T01）</li>' +
        '<li>デモで「新しい <i>u</i> を覚えてから、1コマ進めてみて。合ってた？」</li></ul>' +
        '<p><b>よくある反応：</b></p><ul>' +
        '<li>読み方でつまずく：「ラウンド ユー ラウンド ティー」を一度声に出して読ませると、身構えが減ります。</li>' +
        '<li>問題3で「<i>u</i> ＝ 0.3」を選ぶ（T01）。第1章の貯金箱の表に戻ってください。</li>' +
        '<li>問題4で −1 や 3 と答える（変わる分と新しい値の混同、Δ<i>t</i> のかけ忘れ）。</li>' +
        '<li>マス入力で、となりのマスの値を使おうとする。「この章では、自分のマスと同じ場所の速さだけ」と伝えてください（となりを使うのは第3章から）。</li>' +
        '<li>速さ 0 のマスを 0 にしてしまう（T01）。</li></ul>'));
    },
  });
})(window.RD = window.RD || {});
