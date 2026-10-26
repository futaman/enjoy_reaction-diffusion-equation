// 第3章：拡散（1列のマス）
// つまずき T09, T19, T06 ／ たとえ A04, A05, A15 ／ 仕掛け M07, M11, M08, M03, M01
(function (RD) {
  const { h, p, step, note, more, teacher, card, fmt } = RD.ui;

  const DIFF_ONLY = { diff: true, feed: false, react: false, decay: false };
  const N = 20;

  // 問題とデモで使う数（テストからも読む：def.data）
  const DATA = {
    // 問題1：隣が 10 と 20、自分が 12、D×Δt = 0.5
    q1: { left: 10, self: 12, right: 20, D: 0.5, dt: 1, answer: 13.5 },
    // 本文の例：隣が 4 と 8、自分が 2、D×Δt = 0.5 → 4
    example: { left: 4, self: 2, right: 8, D: 0.5, dt: 1, answer: 4 },
    // 真ん中に山（てっぺんは 11 番目のマス＝index 10）
    mountain: (() => { const a = new Array(N).fill(0); [2, 6, 14, 20, 14, 6, 2].forEach((v, j) => { a[7 + j] = v; }); return a; })(),
    top: 10,
    // 予想「D を2倍にすると？」で比べる D（Δt = 1）
    compare: [0.25, 0.5],
    // 粒の見方：1コマで左へ 1/4、右へ 1/4、その場に 1/2 → D×Δt = 0.5 と同じ
    hop: 0.25,
    particleStart: (() => { const a = new Array(N).fill(0); a[9] = 100; a[10] = 100; return a; })(),
    // わざと壊すデモ
    breakMax: 1.5,
  };

  const newSim = (D, dt = 1) => new RD.Sim({ w: N, h: 1, Du: D, dt, terms: Object.assign({}, DIFF_ONLY) });
  const sumOf = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; };
  const minMax = (a) => { let lo = Infinity, hi = -Infinity; for (let i = 0; i < a.length; i++) { if (a[i] < lo) lo = a[i]; if (a[i] > hi) hi = a[i]; } return [lo, hi]; };
  const sgn = (x, d = 2) => (x > 0 ? '+' : x < 0 ? '−' : '') + fmt(Math.abs(x), d);
  const wide = () => !!(window.matchMedia && window.matchMedia('(min-width: 560px)').matches);
  const R = (s) => `<span class="t-diff">${s}</span>`; // 拡散の色

  // ルールの式（せまい画面では「＋」の前で折り返す）
  const ruleHtml = (d = '<i>D</i>', dt = 'Δ<i>t</i>') =>
    `<span class="ch3-u">新しい値 ＝ 今の値</span> <span class="ch3-u">＋ ${R(`${d} ×（隣の平均 − 自分）`)} × ${dt}</span>`;

  const CSS = `
  .ch3-rule { text-align: center; font-size: 1.12rem; margin: 12px 0; line-height: 1.9; font-family: var(--font-math); }
  .ch3-rule i { font-style: italic; }
  .ch3-u { display: inline-block; white-space: nowrap; }
  .ch3-pair { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
  .ch3-pair .lbl { font-size: 0.88rem; color: var(--ink-2); text-align: center; margin-bottom: 4px; font-weight: 700; }
  .ch3-canvas { display: block; width: 100%; height: auto; border: 1px solid var(--line); border-radius: 6px; background: var(--card); }
  .ch3-status { font-size: 0.9rem; color: var(--ink-2); text-align: center; min-height: 1.6em; margin: 6px 0; }
  .ch3-status.bad { color: var(--ng); font-weight: 700; }
  .ch3-detail td.num { font-family: var(--font-mono); }
  .ch3-cmp { display: grid; gap: 8px; }
  .ch3-cmp .lbl { font-size: 0.88rem; font-weight: 700; color: var(--ink-2); }
  .ch3-slider-bad output { color: var(--ng); font-weight: 700; }
  .ch3-axis { display: flex; justify-content: space-between; font-size: 0.78rem; color: var(--ink-3); padding: 0 4px; }
  .ch3-tbl { border-collapse: collapse; margin: 8px auto; font-family: var(--font-mono); font-size: 0.9rem; }
  .ch3-tbl td, .ch3-tbl th { border: 1px solid var(--line); padding: 2px 8px; text-align: center; }
  .ch3-tbl th { font-family: var(--font); font-weight: 700; font-size: 0.82rem; color: var(--ink-2); background: var(--card-2); }
  `;

  RD.registerChapter({
    id: 'ch3',
    no: 3,
    title: '拡散（1列のマス）',
    desc: '「となりとの平均に近づく」ルールで、広がるようすを手で計算します。',
    goal: '「隣の平均に近づく」という拡散のルールで、手計算ができる',
    required: 4,
    data: DATA,

    render(root, ctx) {
      root.appendChild(h('style', { text: CSS }));
      ctx.useCalc();

      // ===== 1. つかみ：ミルク（A04） =====
      root.appendChild(step({
        title: 'コーヒーにミルクをたらすと',
        text: [
          p('コーヒーにミルクを1滴たらして、かき混ぜずに待ってみましょう。白いミルクは、じわじわとまわりに広がっていきます。最後は全体が同じ色になります。'),
          p('このように、<b>多いところから少ないところへ、自然に広がっていくこと</b>を<b>拡散</b>（かくさん）といいます。'),
          note('<p>🌱 草原でも同じことが起きます。草のタネは風に吹かれて、たくさんあるところから、少ないところへ広がっていきます。</p><p>この章では、草原を<b>横1列のマス</b>だけにして考えます。まずは1列で慣れて、次の章で広い草原（2次元）に進みます。</p>', 'story'),
        ],
      }));

      // ===== 2. おすそ分けルール（A05）＋ 1列20マスのデモ =====
      const demoA = buildBarDemo();
      const ex = DATA.example;
      root.appendChild(step({
        title: 'おすそ分けルール',
        text: [
          p('拡散のルールは、<b>おすそ分け</b>にたとえられます。'),
          note('<p>マスに草のタネがあります。毎ターン、どのマスも<b>両どなりと見比べて、差を少しだけならします</b>。</p><p>となりより多ければ少し分けてあげて（減る）、少なければ少し分けてもらいます（増える）。</p>', 'story'),
          p('これを式にすると、こうなります。'),
          h('div', { class: 'ch3-rule', html: ruleHtml() }),
          h('ul', null,
            h('li', { html: '<b>隣の平均 − 自分</b>：となりとの差です。プラスなら自分のほうが少ないので増え、マイナスなら自分のほうが多いので減ります。' }),
            h('li', { html: '<b><i class="v">D</i></b>：広がりやすさです。風が強いほど大きくなります。' }),
            h('li', { html: '<b>Δ<i class="v">t</i></b>：時間の刻み（1コマの長さ）です。第2章で出てきました。' })),
          p(`<b>例：</b>となりが ${ex.left} と ${ex.right}、自分が ${ex.self}、<i class="v">D</i> × Δ<i class="v">t</i> = ${ex.D * ex.dt} のとき`),
          h('div', { class: 'ch3-rule', html: `隣の平均 ＝ (${ex.left} ＋ ${ex.right}) ÷ 2 ＝ ${(ex.left + ex.right) / 2}<br>差 ＝ ${(ex.left + ex.right) / 2} − ${ex.self} ＝ ${R('+' + ((ex.left + ex.right) / 2 - ex.self))}<br>新しい値 ＝ ${ex.self} ＋ ${ex.D * ex.dt} × ${(ex.left + ex.right) / 2 - ex.self} ＝ <b>${ex.answer}</b>` }),
          p('差をぜんぶ埋めるのではなく、<b>差の一部（ここでは半分）だけ</b>近づくところがポイントです。'),
          p('デモは、20マスにこのルールを使ったものです。▶ 再生や「1コマ進める」で動かしてみましょう。<b>棒をクリック</b>すると、そのマスの計算が見られます。'),
          more('第2章の式と見比べると',
            '<p>第2章では「新しい <i>u</i> ＝ <i>u</i> ＋ ∂<i>u</i>/∂<i>t</i> × Δ<i>t</i>」を学びました。おすそ分けルールと見比べると、</p>' +
            '<p style="text-align:center"><b>変化の速さ ∂<i>u</i>/∂<i>t</i> ＝ <i>D</i> ×（隣の平均 − 自分）</b></p>' +
            '<p>になっていることがわかります。拡散も「変化の速さ × 時間」で1コマずつ進めているだけです。この「隣の平均 − 自分」には、第4章で専用の記号が付きます。</p>'),
        ],
        demo: demoA.el,
      }));

      const q = DATA.q1;
      root.appendChild(ctx.quiz({
        id: 'q-calc',
        type: 'number',
        q: `<p>となりのマスが <b>${q.left}</b> と <b>${q.right}</b>、自分が <b>${q.self}</b> です。<i class="v">D</i> × Δ<i class="v">t</i> = <b>${q.D * q.dt}</b> のとき、次のコマの自分の値はいくつ？</p>`,
        prefix: '次の値 ＝',
        answer: q.answer,
        hints: [
          `まず「隣の平均」を出しましょう。となりは ${q.left} と ${q.right} です。`,
          `隣の平均 ＝ (${q.left} ＋ ${q.right}) ÷ 2 ＝ 15。差 ＝ 15 − ${q.self} ＝ 3 です。`,
          `差 3 の ${q.D * q.dt} 倍だけ近づきます。${q.D * q.dt} × 3 ＝ 1.5。これを今の値 ${q.self} に足すと…？`,
        ],
        answerText: `${q.self} ＋ ${q.D * q.dt} × (15 − ${q.self}) ＝ ${q.self} ＋ 1.5 ＝ <b>${q.answer}</b>`,
        wrong: (v) => {
          if (Math.abs(v - 15) < 1e-6) return '<p>15 は「隣の平均」です。一気に平均まで行くのではなく、<b>差の一部だけ</b>近づきます。</p>';
          if (Math.abs(v - 1.5) < 1e-6) return '<p>1.5 は「増える分」です。今の値 12 に足すのを忘れていませんか？</p>';
          if (Math.abs(v - 3) < 1e-6) return '<p>3 は「差（隣の平均 − 自分）」です。これに <i>D</i> × Δ<i>t</i> をかけて、今の値に足しましょう。</p>';
          if (Math.abs(v - 10.5) < 1e-6) return '<p>差は 15 − 12 ＝ <b>＋3</b>（自分のほうが少ない）なので、<b>増えます</b>。</p>';
          if (Math.abs(v - 21) < 1e-6) return '<p>となりの<b>合計</b>（30）を使っていませんか？ 使うのは<b>平均</b>です。</p>';
          return null;
        },
        explain: `<p>隣の平均は 15、自分は 12 なので差は +3。その半分の 1.5 だけ近づいて <b>13.5</b> です。デモの棒をクリックすると、同じ計算をコンピュータがしているのが見られます。</p>`,
      }));

      const mt = DATA.mountain, ti = DATA.top;
      root.appendChild(ctx.quiz({
        id: 'q-top',
        type: 'choice',
        q: `<p>デモの最初の形（山）を見ましょう。てっぺんのマスは <b>${mt[ti]}</b>、両どなりは <b>${mt[ti - 1]}</b> と <b>${mt[ti + 1]}</b> です。次のコマで、てっぺんの値は？</p>`,
        options: [
          { text: '減る', correct: true },
          { text: '増える', why: '<p>てっぺんは、となりより<b>多い</b>マスです。差（隣の平均 − 自分）を計算してみましょう。マイナスになるはずです。</p>' },
          { text: '変わらない', why: '<p>差が 0 なら変わりませんが、ここでは隣の平均（14）と自分（20）がちがいます。</p>' },
          { text: 'てっぺんは変わらず、まわりだけ増える', why: '<p>まわりが増える分は、どこかから来ています。タネは勝手に増えません。てっぺんが<b>分けてあげた分</b>です。</p>' },
        ],
        hints: ['てっぺんは、両どなりより多い？少ない？', `隣の平均 ＝ (${mt[ti - 1]} ＋ ${mt[ti + 1]}) ÷ 2 ＝ 14。差 ＝ 14 − 20 は？`],
        explain: `<p>差は 14 − 20 ＝ −6。マイナスなので<b>減ります</b>（<i>D</i> × Δ<i>t</i> = 0.5 なら 20 → 17）。山は削られて、そのぶん、すそ野が増えていきます。</p>`,
      }));

      // ===== 3. D を2倍にすると？（予想→観察 M01） =====
      const cmp = buildCompare();
      root.appendChild(ctx.quiz({
        id: 'q-double',
        type: 'predict',
        q: '<p>広がりやすさ <i class="v">D</i> を <b>2倍</b> にすると、山の広がり方はどうなるでしょう？ 予想を選んでから、たしかめましょう。</p>',
        options: [
          { text: '速く平らになる。でも、最後にそろう高さは同じ', correct: true },
          { text: '最後にそろう高さが2倍になる', why: '<p>おすそ分けは、となりに<b>移す</b>だけです。タネの合計は増えも減りもしないので、最後にそろう高さ（点線）は同じです。</p>' },
          { text: '山がもっと高くなる', why: '<p>てっぺんは、となりより多いので減る一方です。<i>D</i> が大きいと、<b>もっと速く</b>削られます。</p>' },
          { text: '何も変わらない', why: '<p><i>D</i> は式の中で「差」にかかっています。<i>D</i> が2倍なら、1コマで動く量も2倍です。</p>' },
        ],
        observe: () => cmp.start(),
        observeLabel: '▶ 2つ並べて動かしてみる',
        explain: '<p><i>D</i> が2倍だと、1コマでならす量が2倍になります。だから<b>速く平らに</b>なります。でも、タネの合計は変わらないので、<b>最後にそろう高さは同じ</b>です。</p>',
      }));
      root.appendChild(cmp.el);

      // ===== 4. 粒の見方と値の見方（M11, T09） =====
      const demoB = buildParticles();
      root.appendChild(step({
        title: '粒で見ても、同じこと',
        text: [
          p('ところで、拡散は「タネの<b>粒</b>が動く」ことでしょうか？ それとも「<b>値</b>がならされる」ことでしょうか？'),
          p('デモの「<b>粒</b>」のほうでは、タネを1粒ずつの点で表しています。粒はどれも、1コマごとに<b>サイコロを振って</b>動きます。'),
          h('ul', null,
            h('li', { html: '1/4 の確率で、左のマスへ' }),
            h('li', { html: '1/4 の確率で、右のマスへ' }),
            h('li', { html: '1/2 の確率で、その場にとどまる' })),
          p('粒は自分がどちらへ行くかを気にしていません。ただ、でたらめに動くだけです。'),
          p('「<b>値</b>」のほうは、おすそ分けルール（<i class="v">D</i> × Δ<i class="v">t</i> = 0.5）で計算した棒グラフです。並べて動かしてみましょう。'),
          note('<p>でたらめに動く粒を数えると、おすそ分けルールの棒とほとんど同じ形で広がります。<b>「粒がでたらめに動く」と「値がならされる」は、同じことを別の見方で見たもの</b>です。</p>'),
          more('どうして同じになるの？',
            '<p>あるマスに粒が <i>n</i> 個あるとします。次のコマでは、</p>' +
            '<ul><li>自分の粒の 1/2 が残る</li><li>左どなりの粒の 1/4 が右へ来る</li><li>右どなりの粒の 1/4 が左へ来る</li></ul>' +
            '<p>なので、平均すると　次の <i>n</i> ＝ 1/2 × 自分 ＋ 1/4 × 左 ＋ 1/4 × 右　です。これを並べかえると</p>' +
            '<p style="text-align:center">次の <i>n</i> ＝ 自分 ＋ 0.5 ×（隣の平均 − 自分）</p>' +
            '<p>となり、<i>D</i> × Δ<i>t</i> = 0.5 のおすそ分けルールとぴったり同じ式です。</p>' +
            '<p>粒の数が少ないと、サイコロの運でガタガタします。「粒×10」にすると、粒が多いほど棒の形にぴったり近づくのがわかります。ミルクやインクの粒（分子）はとてつもなく多いので、なめらかに広がって見えるのです。</p>'),
        ],
        demo: demoB.el,
      }));

      root.appendChild(ctx.quiz({
        id: 'q-view',
        type: 'choice',
        q: '<p>「粒がでたらめに動く見方」と「おすそ分けルールで値がならされる見方」。正しいのはどれ？</p>',
        options: [
          { text: '粒の見方が本当で、おすそ分けルールはただの近似（ウソ）', why: '<p>粒がたくさんあれば、平均すると<b>ちょうど</b>おすそ分けルールの式になります（「どうして同じになるの？」を開いてみましょう）。どちらかがウソということはありません。</p>' },
          { text: 'どちらも同じことを、別の見方で見ている', correct: true },
          { text: '粒は「少ないほうへ行こう」と考えて動いている', why: '<p>粒は左右どちらにも同じ確率で動きます。行き先を考えてはいません。それでも、多いところからは出ていく粒が多いので、結果として少ないほうへ広がります。</p>' },
          { text: '粒の見方では、タネの合計が増えていく', why: '<p>粒は動くだけで、増えたり消えたりしません。合計はいつも同じです。おすそ分けルールでも同じです。</p>' },
        ],
        hints: ['デモで「重ねてくらべる」をオンにして、粒と棒を比べてみましょう。'],
        explain: '<p>どちらも同じ「拡散」です。粒1つ1つはでたらめでも、たくさん集まると「多いところから少ないところへ」ならされていきます。</p>',
      }));

      // ===== 5. わざと壊す（M08, A15, T19） =====
      const demoC = buildBreak();
      root.appendChild(step({
        title: 'わざと壊してみよう：配りすぎ',
        text: [
          p('おすそ分けルールでは、<i class="v">D</i> × Δ<i class="v">t</i> が「差のどれだけを埋めるか」を決めていました。0.5 なら差の半分です。'),
          p('では、時間の刻み Δ<i class="v">t</i> を欲ばって大きくして、<i class="v">D</i> × Δ<i class="v">t</i> が <b>1 より大きく</b>なったら？ デモの つまみで試してみましょう。'),
          note('<p><b>配りすぎ</b>：持っている差より多く配ろうとすると、平均を<b>通り越して</b>反対側まで行ってしまいます。</p>', 'warn'),
          p('たとえば、自分が 20、両どなりが 0 で、<i class="v">D</i> × Δ<i class="v">t</i> = 1.5 のとき：'),
          h('div', { class: 'ch3-rule', html: `差 ＝ 0 − 20 ＝ −20<br>新しい値 ＝ 20 ＋ 1.5 × (−20) ＝ <b style="color:var(--ng)">−10</b>` }),
          p('平らな 0 をこえて、マイナスになりました。となりは逆に 0 から大きく増えます。次のコマでは、今度は反対向きに配りすぎて……と、<b>シーソーのように揺れながら、凸凹がどんどん大きくなります</b>。これが「爆発」です。'),
          p('<i class="v">D</i> × Δ<i class="v">t</i> が <b>1 以下</b>なら、こうはなりません。シミュレーションで時間の刻みを大きくしすぎてはいけないのは、このためです。'),
          more('もう少しくわしく：0.5 と 1 の間では？',
            '<p>いちばん揺れやすい形は「高い・低い・高い・低い…」というギザギザです。ギザギザのマスでは、隣の平均と自分の差が、山の高さの2倍になります。</p>' +
            '<ul><li><i>D</i> × Δ<i>t</i> ≤ 0.5：ギザギザは揺れずに、なめらかに消えます。</li>' +
            '<li>0.5 ＜ <i>D</i> × Δ<i>t</i> ＜ 1：少し通り越して揺れますが、揺れはだんだん小さくなり、おさまります。</li>' +
            '<li><i>D</i> × Δ<i>t</i> ＝ 1：揺れが小さくならず、ずっと続きます。</li>' +
            '<li><i>D</i> × Δ<i>t</i> ＞ 1：揺れが毎コマ大きくなり、爆発します。</li></ul>' +
            '<p>「コマを細かく（Δ<i>t</i> を小さく）」するほど、計算は本物の連続な変化に近づき、安全になります。そのかわり、同じ時間を進めるのにたくさん計算が必要になります。</p>'),
        ],
        demo: demoC.el,
      }));

      root.appendChild(ctx.quiz({
        id: 'q-break',
        type: 'predict',
        q: `<p><i class="v">D</i> × Δ<i class="v">t</i> を <b>${DATA.breakMax}</b> にして、山を動かすと何が起きるでしょう？ 予想を選んでから実行しましょう。</p>`,
        options: [
          { text: 'ふつうより速く、きれいに平らになる', why: '<p>「たくさん配れば速く平らになる」と思いがちですが、<b>配りすぎ</b>ると平均を通り越してしまいます。</p>' },
          { text: 'シーソーのように揺れながら凸凹が大きくなり、爆発する', correct: true },
          { text: '山がそのまま動かなくなる', why: '<p>差がある限り、毎コマ値は変わります。むしろ大きく変わりすぎるのが問題です。</p>' },
          { text: 'ゆっくり平らになるだけで、0.5 のときと同じ', why: '<p>1 をこえると、ふるまいががらっと変わります。デモで「1コマ進める」をくり返して、値の符号を見てみましょう。</p>' },
        ],
        observe: () => demoC.run(DATA.breakMax),
        observeLabel: '▶ 1.5 にして動かしてみる',
        explain: '<p>差より多く配ってしまうので、毎コマ平均を通り越し、揺れがどんどん大きくなります。これが<b>配りすぎ</b>による爆発です。<i class="v">D</i> × Δ<i class="v">t</i> は 1 以下にしておきましょう。</p>',
      }));

      root.appendChild(note('<p>次の章では、この「隣の平均 − 自分」に<b>記号</b>を付けて、広い草原（2次元）に進みます。</p>'));

      root.appendChild(teacher(
        '<p><b>扱うつまずき：</b>T09（粒か値か）、T19（Δt を大きくすると壊れる）、T06（コマ送りは嘘？）。</p>' +
        '<p><b>問いかけの例：</b></p><ul>' +
        '<li>「となりより多いマスは、増える？減る？」（指で棒をさして答えさせる）</li>' +
        '<li>「全部のマスのタネを足した合計は、時間がたつと変わる？」（変わらない。点線の高さに全部そろう）</li>' +
        '<li>「粒はどっちに行くか考えてる？ それなのに、どうして少ないほうへ広がるの？」</li>' +
        '<li>「1.5 にすると、なぜ揺れるの？」（「配りすぎ」の言葉が出たら十分）</li></ul>' +
        '<p><b>よくある反応：</b>問題1で 15（平均そのもの）と答える。「一気に平均まで行くのではなく、差の一部だけ近づく」を棒グラフのクリックで確認させてください。<i>D</i> × Δ<i>t</i> を大きくすると速く平らになる、と予想する子は多いです。予想が外れたら、それこそ収穫です。</p>' +
        '<p><b>進む目安：</b>粒の見方と値の見方が同じことだと腑に落ちたら、2次元（第4章）へ進んで大丈夫です。</p>'));

      // ---------------------------------------------------------------
      // デモ (a)：1列20マスの棒グラフ
      function buildBarDemo() {
        const sim = newSim(0.5, 1);
        const shapes = {
          mountain: () => DATA.mountain.slice(),
          stepUp: () => Array.from({ length: N }, (_, i) => (i >= 5 && i < 15 ? 12 : 2)),
          bumpy: () => Array.from({ length: N }, () => Math.round(Math.random() * 20)),
        };
        let shape = 'mountain', picked = DATA.top;
        const bar = new RD.BarView({
          get: () => sim.u, min: 0, max: 22, color: '--t-u', labels: wide(), labelDigits: 1, height: 230, highlight: picked,
          onPick: (i) => { picked = i; showDetail(); },
        });
        const detail = h('table', { class: 'ledger ch3-detail' });
        const status = h('div', { class: 'ch3-status' });
        const load = () => {
          sim.reset(0, 0); sim.u.set(shapes[shape]());
          bar.set({ refLine: sumOf(sim.u) / N });
        };
        const showDetail = () => {
          const i = picked, b = sim.breakdown(i);
          const L = sim.u[(i + N - 1) % N], Rr = sim.u[(i + 1) % N];
          const f = (x) => fmt(x, 2);
          const rows = [
            ['左どなり・右どなり', `${f(L)} と ${f(Rr)}`],
            ['隣の平均', f(b.avgU)],
            ['自分（今の値）', f(b.u)],
            ['差（隣の平均 − 自分）', `<span class="t-diff">${sgn(b.lapU)}</span>`],
            [`増える分（${fmt(sim.Du, 2)} × 差 × ${fmt(sim.dt, 2)}）`, `<span class="t-diff">${sgn(b.diffU * b.dt)}</span>`],
          ];
          detail.replaceChildren(
            h('caption', { class: 'cap', style: { captionSide: 'top', textAlign: 'left' }, text: `${i + 1} 番目のマスの計算` }),
            h('tbody', null,
              rows.map(([k, v]) => h('tr', null, h('td', { html: k }), h('td', { class: 'num', html: v }))),
              h('tr', { class: 'next' }, h('td', { text: '次の値（今の値 ＋ 増える分）' }), h('td', { class: 'num', text: f(b.uNext) }))));
          status.innerHTML = `タネの合計：<b>${fmt(sumOf(sim.u), 2)}</b>（点線は、最後にそろう高さ ${fmt(sumOf(sim.u) / N, 2)}）`;
        };
        const draw = () => { bar.set({ labels: wide(), highlight: picked }); showDetail(); };
        const runner = new RD.Runner({
          sim, onFrame: draw,
          onReset: load,
          speeds: [{ label: 'ゆっくり', spf: 0.08 }, { label: 'ふつう', spf: 0.3 }, { label: 'はやい', spf: 1 }], speed: 0,
        });
        const dSlider = RD.ui.slider({
          label: '<i class="v">D</i>（広がりやすさ）', min: 0.05, max: 1, step: 0.05, value: 0.5,
          format: (v) => `${fmt(v, 2)}`,
          onInput: (v) => { sim.setParams({ Du: v }); showDetail(); dtNote.innerHTML = dtText(); },
        });
        const dtText = () => `Δ<i class="v">t</i> = 1 で固定 → <i class="v">D</i> × Δ<i class="v">t</i> = <b>${fmt(sim.Du * sim.dt, 2)}</b>`;
        const dtNote = h('div', { class: 'muted center', html: dtText() });
        const seg = RD.ui.segmented([{ value: 'mountain', label: '山' }, { value: 'stepUp', label: '台地' }, { value: 'bumpy', label: 'でこぼこ' }], shape, (v) => { shape = v; runner.pause(); load(); runner.draw(); });
        load();
        runner.draw();
        const el = card('1列20マスの草原（棒の高さ ＝ タネの量）',
          h('div', { class: 'row', style: { marginBottom: '8px' } }, h('span', { class: 'muted', text: '最初の形：' }), seg.el),
          bar.el,
          h('div', { class: 'ch3-axis' }, h('span', { text: '1' }), h('span', { text: 'マスの番号' }), h('span', { text: String(N) })),
          runner.el, dSlider.el, dtNote, status,
          h('div', { class: 'ledger-wrap' }, detail),
          h('p', { class: 'muted', html: '棒をクリックすると、そのマスの計算が見られます。両はしのマスは、反対のはしとつながっています。' }));
        return { el, sim, runner };
      }

      // 予想「D を2倍にすると？」の観察用（2本を同時に動かす）
      function buildCompare() {
        const [d1, d2] = DATA.compare;
        const a = newSim(d1, 1), b = newSim(d2, 1);
        const load = () => { [a, b].forEach((s) => { s.reset(0, 0); s.u.set(DATA.mountain); }); };
        load();
        const mk = (s) => new RD.BarView({ get: () => s.u, min: 0, max: 22, color: '--t-u', height: 150, refLine: sumOf(DATA.mountain) / N });
        const va = mk(a), vb = mk(b);
        const la = h('div', { class: 'lbl' }), lb = h('div', { class: 'lbl' });
        const label = () => {
          la.innerHTML = `<i class="v">D</i> = ${d1}　てっぺん：${fmt(a.u[DATA.top], 2)}`;
          lb.innerHTML = `<i class="v">D</i> = ${d2}（2倍）　てっぺん：${fmt(b.u[DATA.top], 2)}`;
        };
        const runner = new RD.Runner({
          sim: a, onStep: () => b.step(1),
          onFrame: () => { va.render(); vb.render(); label(); },
          onReset: () => { load(); },
          speeds: [{ label: 'ゆっくり', spf: 0.1 }, { label: 'ふつう', spf: 0.4 }], speed: 0,
        });
        const el = card('くらべてみよう：D を2倍にすると', h('div', { class: 'ch3-cmp' }, la, va.el, lb, vb.el), runner.el,
          h('p', { class: 'muted', text: '点線は、最後にそろう高さです。2つとも同じ点線に近づいていきます。' }));
        el.hidden = true;
        return {
          el,
          start() {
            el.hidden = false;
            runner.pause(); load(); runner.draw();
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => runner.play(), 400);
          },
        };
      }

      // デモ (b)：粒の見方 と 値の見方（M11）
      function buildParticles() {
        const H = 260, W = 320, padL = 6, padR = 6, padB = 10, padT = 10;
        const PER_ROW = 3, BASE_MAX = 140;
        const sim = newSim(2 * DATA.hop, 1);
        let scale = 1, pos = new Int16Array(0), overlay = false;
        const canvas = h('canvas', { class: 'ch3-canvas', width: W, height: H, role: 'img', 'aria-label': '粒のようす' });
        const bars = new RD.BarView({ get: () => sim.u, min: 0, max: BASE_MAX, color: '--t-u', height: H });
        bars.canvas.width = W; bars.render();
        const cap = h('div', { class: 'muted center' });
        const reset = () => {
          const start = DATA.particleStart.map((c) => c * scale);
          const total = sumOf(start);
          pos = new Int16Array(total);
          let k = 0;
          start.forEach((c, i) => { for (let j = 0; j < c; j++) pos[k++] = i; });
          sim.reset(0, 0); sim.u.set(start);
          bars.set({ max: BASE_MAX * scale });
          cap.innerHTML = scale === 1 ? `粒は全部で ${total} 個（●1つ ＝ 粒1個）` : `粒は全部で ${total} 個（●1つ ＝ 粒${scale}個）`;
        };
        const hop = () => {
          const q = DATA.hop;
          for (let j = 0; j < pos.length; j++) {
            const r = Math.random();
            if (r < q) pos[j] = (pos[j] + N - 1) % N;
            else if (r < 2 * q) pos[j] = (pos[j] + 1) % N;
          }
        };
        const draw = () => {
          const ctx2 = canvas.getContext('2d');
          ctx2.clearRect(0, 0, W, H);
          const bw = (W - padL - padR) / N;
          const unit = (H - padT - padB) / BASE_MAX; // 粒1個（表示単位）あたりの高さ
          const s = unit * PER_ROW;
          const counts = new Array(N).fill(0);
          for (let j = 0; j < pos.length; j++) counts[pos[j]]++;
          ctx2.fillStyle = RD.ui.cssVar('--t-u') || '#3a8a35';
          for (let i = 0; i < N; i++) {
            const dots = Math.round(counts[i] / scale);
            for (let k = 0; k < dots; k++) {
              const row = Math.floor(k / PER_ROW), col = k % PER_ROW;
              const x = padL + i * bw + (col + 0.5) * (bw / PER_ROW), y = H - padB - (row + 0.5) * s;
              if (y < padT) break;
              ctx2.beginPath(); ctx2.arc(x, y, Math.max(1.2, Math.min(bw / PER_ROW, s) * 0.38), 0, Math.PI * 2); ctx2.fill();
            }
          }
          ctx2.strokeStyle = RD.ui.cssVar('--ink-2') || '#555'; ctx2.lineWidth = 1;
          ctx2.beginPath(); ctx2.moveTo(padL, H - padB + 0.5); ctx2.lineTo(W - padR, H - padB + 0.5); ctx2.stroke();
          if (overlay) {
            ctx2.strokeStyle = RD.ui.cssVar('--t-diff') || '#2f68b0'; ctx2.lineWidth = 2;
            ctx2.beginPath();
            for (let i = 0; i < N; i++) {
              const y = H - padB - (sim.u[i] / scale) * unit;
              ctx2.moveTo(padL + i * bw + 1, y); ctx2.lineTo(padL + (i + 1) * bw - 1, y);
            }
            ctx2.stroke();
          }
          bars.render();
        };
        const runner = new RD.Runner({
          sim, onStep: hop, onFrame: draw, onReset: reset,
          speeds: [{ label: 'ゆっくり', spf: 0.1 }, { label: 'ふつう', spf: 0.4 }, { label: 'はやい', spf: 2 }], speed: 0,
        });
        const seg = RD.ui.segmented([{ value: 1, label: '粒×1' }, { value: 10, label: '粒×10' }], 1, (v) => { scale = v; runner.pause(); reset(); runner.draw(); });
        const tg = RD.ui.toggle('重ねてくらべる（青い線 ＝ 値の棒の高さ）', false, (v) => { overlay = v; draw(); });
        reset(); runner.draw();
        const el = card('粒の見方 と 値の見方',
          h('div', { class: 'ch3-pair' },
            h('div', null, h('div', { class: 'lbl', text: '粒：でたらめに動く' }), canvas),
            h('div', null, h('div', { class: 'lbl', text: '値：おすそ分けルール' }), bars.el)),
          cap, runner.el,
          h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '6px' } }, seg.el, tg.el));
        return { el };
      }

      // デモ (c)：わざと壊す（M08）
      function buildBreak() {
        const sim = newSim(0.5, 1);
        const LIM = 25, BLOW = 1e4;
        let blown = false, runner = null;
        const bar = new RD.BarView({ get: () => sim.u, min: -LIM, max: LIM, color: '--t-u', height: 240 });
        const status = h('div', { class: 'ch3-status' });
        const sliderBox = h('div');
        const load = () => {
          sim.reset(0, 0); sim.u.set(DATA.mountain);
          blown = false;
          if (runner) [runner.playBtn, runner.stepBtn].forEach((b) => { b.disabled = false; });
        };
        const say = () => {
          const [lo, hi] = minMax(sim.u);
          const big = (x) => (!isFinite(x) ? 'とても大きい' : (x < -1e-9 ? '−' : '') + (Math.abs(x) >= 1e4 ? fmt(Math.abs(x) / 1e4, 1) + '万' : fmt(Math.abs(x), 2)));
          if (blown) {
            status.className = 'ch3-status bad';
            status.innerHTML = `💥 爆発しました！ いちばん大きい値 ${big(hi)}、いちばん小さい値 ${big(lo)}（グラフは ±${LIM} で切っています）<br>「↺ はじめから」で戻せます。`;
          } else {
            status.className = 'ch3-status' + (Math.max(Math.abs(lo), Math.abs(hi)) > LIM ? ' bad' : '');
            status.innerHTML = `いちばん大きい値 <b>${big(hi)}</b>　いちばん小さい値 <b>${big(lo)}</b>` + (lo < -1e-9 ? '　← マイナス！' : '') + (Math.max(-lo, hi) > LIM ? '<br>（グラフからはみ出しています）' : '');
          }
        };
        const onStep = () => {
          if (blown) return;
          const [lo, hi] = minMax(sim.u);
          if (!isFinite(lo) || !isFinite(hi) || Math.max(-lo, hi) > BLOW) {
            blown = true;
            runner.pause();
            [runner.playBtn, runner.stepBtn].forEach((b) => { b.disabled = true; });
          }
        };
        runner = new RD.Runner({
          sim, onStep, onFrame: () => { bar.render(); say(); },
          onReset: load,
          onExplode: () => { blown = true; },
          speeds: [{ label: 'ゆっくり', spf: 0.08 }, { label: 'ふつう', spf: 0.3 }], speed: 0,
        });
        const sl = RD.ui.slider({
          label: '<i class="v">D</i> × Δ<i class="v">t</i>', min: 0.1, max: DATA.breakMax, step: 0.05, value: 0.5,
          format: (v) => fmt(v, 2) + (v > 1 + 1e-9 ? '（配りすぎ）' : ''),
          onInput: (v) => { sim.setParams({ Du: v }); sliderBox.classList.toggle('ch3-slider-bad', v > 1 + 1e-9); },
        });
        sliderBox.appendChild(sl.el);
        load(); runner.draw();
        const el = card('わざと壊すデモ（縦軸は −25 〜 25）',
          sliderBox, bar.el, runner.el, status,
          h('p', { class: 'muted', html: 'つまみを 1 より大きくして ▶ 再生してみましょう。「1コマ進める」で1コマずつ見ると、シーソーのように上下が入れかわるのがわかります。' }));
        return {
          el,
          run(v) {
            sl.set(v, true);
            runner.pause(); load(); runner.draw();
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => runner.play(), 400);
          },
        };
      }
    },
  });
})(window.RD = window.RD || {});
