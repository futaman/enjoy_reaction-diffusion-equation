// プロローグ：模様は計算で作れる（T24）。章を書くときのお手本も兼ねる。
(function (RD) {
  const { h, p, step, note, more, teacher, card } = RD.ui;

  // patterns.js がまだ無いときの予備
  const FALLBACK = [
    { id: 'spots', name: '水玉', F: 0.030, k: 0.062, seed: 'random', steps: 6000 },
    { id: 'coral', name: 'サンゴ（しま）', F: 0.0545, k: 0.062, seed: 'random', steps: 6000 },
    { id: 'maze', name: '迷路', F: 0.029, k: 0.057, seed: 'random', steps: 6000 },
    { id: 'mitosis', name: '分裂する点', F: 0.0367, k: 0.0649, seed: 'random', steps: 6000 },
  ];

  RD.registerChapter({
    id: 'prologue',
    no: 0,
    title: '模様は計算で作れる',
    desc: '完成した模様を見て、草とウサギに出会います。',
    goal: 'これから何ができるようになるのかを知る',
    required: 0,

    render(root, ctx) {
      // ---- 1. つかみ：動く模様 ----
      const pats = (RD.patterns && RD.patterns.length ? RD.patterns : FALLBACK).filter((x) => ['spots', 'coral', 'maze', 'mitosis'].includes(x.id));
      const size = 128;
      const sim = new RD.Sim({ w: size, h: size });
      const view = new RD.FieldView(sim, { readout: false });
      let current = pats[0];
      const load = (pt) => {
        current = pt;
        sim.setParams({ F: pt.F, k: pt.k });
        sim.seed(pt.seed || 'random');
        // 最初から少し進めておく（白紙から始まると退屈なので）
        sim.step(Math.min(1500, Math.round((pt.steps || 4000) * 0.3)));
        view.render();
        caption.innerHTML = `いまの模様：<b>${pt.name}</b>（F = ${pt.F}, k = ${pt.k}）`;
      };
      const caption = h('div', { class: 'readout' });
      const runner = new RD.Runner({
        sim, onFrame: () => view.render(), autoplay: true, showTime: false,
        speeds: [{ label: 'ふつう', spf: 6 }, { label: 'はやい', spf: 24 }], speed: 1,
        onReset: () => load(current),
      });
      const seg = RD.ui.segmented(pats.map((pt) => ({ value: pt.id, label: pt.name })), pats[0].id, (id) => load(pats.find((x) => x.id === id)));
      load(pats[0]);

      root.appendChild(step({
        title: 'この模様、ぜんぶ同じ式から生まれています',
        text: [
          p('右の模様は、絵を描いたのではありません。コンピュータが<b>たった2行の式</b>を、何万回もくり返し計算して生まれたものです。'),
          p('ボタンで模様を切り替えてみましょう。水玉も、しまも、迷路も、<b>式の中の2つの数（F と k）</b>を変えただけです。'),
          note('<p>このドリルを終えるころには、この式を<b>自分で読めて</b>、<b>好きな模様を自分で作れる</b>ようになります。</p>'),
        ],
        demo: [card(null, seg.el, h('div', { style: { height: '10px' } }), view.el, caption, runner.el)],
      }));

      // ---- 2. 自然の中の模様 ----
      root.appendChild(step({
        title: '生き物の模様は、どうやってできる？',
        text: [
          p('シマウマのしま、ヒョウやチーターの点々、キリンのあみ目、熱帯魚のしま、貝がらの模様、そして指紋。生き物の体には、ふしぎな模様がたくさんあります。'),
          p('体の設計図（遺伝子）に「ここに点を描く」と1つずつ書いてあるのでしょうか？ それにしては、模様の数が多すぎますし、1匹ずつ少しずつちがいます。'),
          note(`<p><b>1952年、アラン・チューリング</b>（コンピュータの父と呼ばれる数学者）は、こう考えました。</p>
            <p>「2種類の物質が<b>反応</b>しながら<b>広がる</b>だけで、模様は自然に生まれるはずだ」</p>`, 'story'),
          p('この「反応」と「拡散（広がること）」を組み合わせた式を、<b>反応拡散方程式</b>といいます。'),
          more('チューリングの予言は本当だった？',
            '<p>長いあいだ、チューリングの考えは「おもしろいけど本当かな？」と思われていました。</p>' +
            '<p><b>1995年、日本の近藤滋さんたち</b>は、タテジマキンチャクダイという熱帯魚のしまを観察しました。この魚は大きくなると、しまの間に新しいしまが割りこんで、しまの数が増えていきます。その増え方が、反応拡散方程式の計算どおりだったのです。</p>' +
            '<p>いまでは、魚のしまや、指の形、毛の生え方など、いろいろな場所でこのしくみが働いていると考えられています。</p>'),
        ],
      }));

      // ---- 3. 登場人物 ----
      root.appendChild(step({
        title: '登場人物：草とウサギ',
        text: [
          p('このドリルでは、2つの物質を<b>草</b>と<b>ウサギ</b>にたとえます。広い草原を、小さなマス目に区切って考えます。'),
          h('div', { class: 'cast', style: { justifyContent: 'flex-start' } },
            h('div', { class: 'who', html: '🌱 <b>草</b>（<i class="v t-u">u</i>）<br>・外から生えてくる<br>・タネが風で<b>速く</b>広がる<br>・ウサギに食べられる' }),
            h('div', { class: 'who', html: '🐇 <b>ウサギ</b>（<i class="v t-v">v</i>）<br>・2匹で草を食べると増える<br>・<b>ゆっくり</b>歩いて広がる<br>・寿命で減っていく' })),
          p('ルールはこれだけです。でも、このルールを式に書いて計算すると、さっきの模様が生まれます。'),
          note('<p>草の量を <i class="v t-u">u</i>、ウサギの濃さを <i class="v t-v">v</i> という文字で表します。<br>どちらも「マスごとにちがう数」です。この意味は第2章でくわしく学びます。</p>'),
        ],
      }));

      // ---- 4. ゴールの式と道のり ----
      root.appendChild(step({
        title: 'ゴールの式',
        text: [
          p('最後に読めるようになる式がこれです。いまは読めなくて大丈夫。色ごとに「草とウサギのルール」が1つずつ書いてあります。'),
          new RD.Equation({}).el,
          p('この式を、次のように少しずつ組み立てていきます。'),
          h('ol', null,
            h('li', { html: '<b>変化の速さ</b>：「次の値 ＝ 今の値 ＋ 速さ × 時間」' }),
            h('li', { html: '<b>記号 ∂u/∂t</b>：場所ごとの変化の速さ' }),
            h('li', { html: '<b>拡散（1列）</b>：となりと平均に近づく' }),
            h('li', { html: '<b>記号 ∇²</b>：まわりの平均 − 自分' }),
            h('li', { html: '<b>反応</b>：草とウサギのルールを1つずつ' }),
            h('li', { html: '<b>全部を合わせる</b>：1マスを手で計算してみる' }),
            h('li', { html: '<b>模様ができる理由と模様の地図</b>：狙った模様を出す' }),
            h('li', { html: '<b>自由ラボ</b>：好きな模様を作る' })),
          h('div', { class: 'row' }, h('a', { class: 'btn primary', href: '#/c/ch1', text: '第1章へ進む →' })),
        ],
      }));

      root.appendChild(teacher(
        '<p><b>ねらい：</b>「やってみたい」と思ってもらうこと（T24）。式の中身はまだ説明しなくて大丈夫です。</p>' +
        '<p><b>問いかけの例：</b>「シマウマのしまは、だれかが1本ずつ描いたのかな？」「同じ式なのに、数を変えるだけで模様が変わるのはなぜだと思う？」（答えは第7章で）</p>' +
        '<p><b>草とウサギのたとえ</b>は最後まで使います。ここで2人のキャラクターをしっかり印象づけてください。</p>'));
    },
  });
})(window.RD = window.RD || {});
