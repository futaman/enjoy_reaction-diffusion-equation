// 第8章：自由ラボ。ブラシで種を描き、F-k マップやつまみで F, k, Du, Dv をえらび、色をつけて保存する。
// URL のクエリ（#/c/ch8?F=..&k=..&Du=..&Dv=..&palette=..&seed=..）で、はじめの状態を指定できる（トップのコレクションから開く）。
(function (RD) {
  const { h, p, step, note, more, teacher, card, fmt } = RD.ui;

  const STYLE = `
.ch8-lab { display: grid; gap: 16px; grid-template-columns: minmax(0, 1fr); margin: 12px 0 24px; }
@media (min-width: 960px) {
  .ch8-lab { grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); align-items: start; }
  .ch8-main { position: sticky; top: 64px; }
}
.ch8-side { display: grid; gap: 12px; min-width: 0; }
.ch8-side .card + .card { margin-top: 0; }
.ch8-tools { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 8px 0; }
.ch8-tools .lbl { font-size: 0.85rem; color: var(--ink-2); }
.ch8-param { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; }
.ch8-param .slider { margin: 2px 0; grid-template-columns: minmax(0, 1fr); gap: 0; }
.ch8-param .slider output { display: none; }
.ch8-param + .ch8-param { margin-top: 4px; }
.ch8-param input[type=text] { width: 5.6em; padding: 4px 6px; border: 1.5px solid var(--line); border-radius: 8px; background: var(--card); font-family: var(--font-mono); font-size: 0.9rem; }
.ch8-param input.ng { border-color: var(--ng); background: var(--ng-soft); }
.ch8-presets { display: flex; flex-wrap: wrap; gap: 6px; }
.ch8-coll { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 8px; }
.ch8-coll .item { position: relative; background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 4px; font-size: 0.78rem; text-align: center; cursor: pointer; line-height: 1.3; word-break: break-all; }
.ch8-coll .item:hover { border-color: var(--accent); }
.ch8-coll .item img { width: 100%; aspect-ratio: 1; display: block; border-radius: 4px; margin-bottom: 2px; }
.ch8-coll .item.locked { opacity: 0.5; border-style: dashed; cursor: default; }
.ch8-coll .ph { width: 100%; aspect-ratio: 1; border-radius: 4px; display: flex; align-items: center; justify-content: center; background: var(--card-2); color: var(--ink-3); font-size: 1.3rem; margin-bottom: 2px; }
.ch8-coll .del { position: absolute; top: 2px; right: 2px; border: 0; background: rgba(0,0,0,.55); color: #fff; border-radius: 50%; width: 22px; height: 22px; line-height: 20px; padding: 0; cursor: pointer; font-size: 0.8rem; }
.ch8-save { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.ch8-save input { flex: 1 1 8em; min-width: 0; padding: 6px 10px; border: 1.5px solid var(--line); border-radius: 8px; background: var(--card); }
.ch8-msg { font-size: 0.88rem; min-height: 1.4em; color: var(--ink-2); }
.ch8-msg.warn { color: var(--ng); }
.ch8-fps { font-size: 0.75rem; color: var(--ink-3); text-align: right; font-family: var(--font-mono); }
.ch8-sel { padding: 4px 8px; border-radius: 8px; border: 1.5px solid var(--line); background: var(--card); max-width: 100%; }
`;

  const SEEDS = [{ value: 'center', label: 'まん中に1つ' }, { value: 'random', label: '数か所' }, { value: 'noise', label: 'あちこち少しずつ' }];

  RD.registerChapter({
    id: 'ch8',
    no: 8,
    title: '自由ラボ',
    desc: '草原にウサギを放し、F と k と色をえらんで、自分だけの模様を作ります。',
    goal: '好きな模様を作って、画像やコレクションに残す',
    required: 0,

    render(root, ctx) {
      root.appendChild(h('style', { text: STYLE }));
      const D = RD.SIM_DEFAULTS || {};
      const N = D.size || 192;
      const pats = RD.patterns || [];
      const P = (id) => pats.find((x) => x.id === id);
      const q = ctx.params || {};
      const num = (s, def) => { const v = RD.ui.parseNum(s); return isFinite(v) ? v : def; };
      const first = P('spots') || pats[0] || {};
      const dt = D.dt ?? 0.8;
      const dMax = +(Math.floor((0.98 / dt) / 0.05) * 0.05).toFixed(2); // D × dt < 1（第3章の「配りすぎ」）
      const clampD = (v) => Math.max(0.05, Math.min(dMax, v));
      const sim = new RD.Sim({
        w: N, h: N,
        F: num(q.F, first.F ?? 0.03), k: num(q.k, first.k ?? 0.06),
        Du: clampD(num(q.Du, D.Du ?? 1.0)), Dv: clampD(num(q.Dv, D.Dv ?? 0.5)),
      });
      let seedStyle = SEEDS.some((s) => s.value === q.seed) ? q.seed : 'random';
      let palette = RD.PALETTES[q.palette] ? q.palette : RD.defaultPalette();
      sim.seed(seedStyle);

      // ---- 草原 ----
      let tool = 'rabbit', radius = 4;
      const view = new RD.FieldView(sim, {
        brush: { mode: 'rabbit', radius }, palette, maxPx: N * 3, maxCss: '640px',
        title: '色 ＝ 🐇 ウサギの濃さ <i class="v">v</i>',
      });
      const msg = h('div', { class: 'ch8-msg' });
      const say = (html, warn) => { msg.innerHTML = html; msg.classList.toggle('warn', !!warn); };
      const fpsEl = h('div', { class: 'ch8-fps' });
      let fpsT = performance.now(), fpsN = 0, fpsSteps = sim.steps;
      const runner = new RD.Runner({
        sim, autoplay: true,
        speeds: [{ label: 'ゆっくり', spf: 1 }, { label: 'ふつう', spf: 6 }, { label: 'はやい', spf: 16 }, { label: 'とても速い', spf: 36 }], speed: 2,
        onFrame: () => {
          view.render();
          fpsN++;
          const now = performance.now();
          if (now - fpsT > 1000) {
            const fps = (fpsN * 1000) / (now - fpsT), sps = ((sim.steps - fpsSteps) * 1000) / (now - fpsT);
            fpsEl.textContent = `${N}×${N} マス　${fps.toFixed(0)} fps　${Math.max(0, sps).toFixed(0)} コマ/秒`;
            RD.ch8Perf = { fps, sps, N };
            fpsT = now; fpsN = 0; fpsSteps = sim.steps;
          }
        },
        onReset: () => { sim.seed(seedStyle); say(''); },
        onExplode: () => say('計算がこわれてしまいました（D × Δt が大きすぎるかも）。「↺ はじめから」でやり直しましょう。', true),
      });
      const toolSeg = RD.ui.segmented([{ value: 'rabbit', label: '🐇 ウサギを放す' }, { value: 'erase', label: '🧽 消しゴム' }, { value: 'look', label: '🔍 値を見る' }], tool, (t) => {
        tool = t;
        view.setBrush(t === 'look' ? null : { mode: t, radius });
        view.readout.textContent = t === 'look' ? 'マスをクリックすると値が見られます' : t === 'erase' ? 'なぞるとウサギを消せます' : 'なぞるとウサギを放せます';
      });
      const radS = RD.ui.slider({ label: 'ふでの太さ', min: 1, max: 14, step: 1, value: radius, format: (v) => `${v} マス`, onInput: (v) => { radius = v; if (view.brush) view.setBrush({ mode: tool, radius }); } });
      const seedSeg = RD.ui.segmented(SEEDS, seedStyle, (v) => { seedStyle = v; sim.seed(seedStyle); view.render(); });
      const mainCard = card(null,
        h('div', { class: 'ch8-tools' }, toolSeg.el),
        runner.el,
        view.el,
        h('div', { class: 'ch8-tools' }, radS.el),
        h('div', { class: 'ch8-tools' },
          RD.ui.button('全消し', () => { sim.reset(); view.render(); say('草原をまっさらにしました。ウサギを描いてみましょう。'); }, { small: true }),
          RD.ui.button('ランダムに散らす', () => { sim.seedRandom(Math.max(4, Math.round(sim.n / 2500)), Math.max(3, Math.round(N / 24))); view.render(); }, { small: true }),
          RD.ui.button('種をまき直す', () => { sim.seed(seedStyle); view.render(); }, { small: true })),
        h('div', { class: 'ch8-tools' }, h('span', { class: 'lbl', text: '種のまき方：' }), seedSeg.el),
        msg, fpsEl);
      // Runner は再生バーが見えているときだけ動くので、草原のカード全体を見張らせる
      runner.watch(mainCard);

      // ---- パラメータ ----
      const inputs = {};
      let mapObj = null;
      const mapNote = h('div', { class: 'ch8-msg' });
      function sync(except) {
        for (const key of ['F', 'k', 'Du', 'Dv']) if (key !== except) inputs[key].set(sim[key]);
        if (mapObj) mapObj.set(sim.F, sim.k);
        const off = Math.abs(sim.Du - (D.Du ?? 1)) > 1e-9 || Math.abs(sim.Dv - (D.Dv ?? 0.5)) > 1e-9;
        mapNote.innerHTML = off ? `⚠ この地図は <i>D<sub>u</sub></i> = ${fmt(D.Du ?? 1)}, <i>D<sub>v</sub></i> = ${fmt(D.Dv ?? 0.5)} のときのものです。いまは D を変えているので、国境の場所がずれます。` : '';
      }
      function setParam(key, v, from) {
        if (key === 'Du' || key === 'Dv') {
          const c = clampD(v);
          if (c !== v) say(`D × Δt が 1 をこえると計算がこわれるので、${key === 'Du' ? 'Du' : 'Dv'} は ${fmt(c, 2)} にしました。`, true);
          v = c;
        }
        sim.setParams({ [key]: v });
        sync(from === 'input' ? key : null);
      }
      function param(label, key, min, max, stepV, digits) {
        const s = RD.ui.slider({ label, min, max, step: stepV, value: sim[key], format: (v) => fmt(v, digits), onInput: (v) => { setParam(key, v, 'slider'); txt.value = fmt(sim[key], digits); } });
        const txt = h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': label.replace(/<[^>]+>/g, '') + ' の値', value: fmt(sim[key], digits) });
        const apply = () => {
          const v = RD.ui.parseNum(txt.value);
          if (!isFinite(v) || v < 0 || v > 2) { txt.classList.add('ng'); return; }
          txt.classList.remove('ng');
          setParam(key, v, 'input');
          s.set(sim[key]);
        };
        txt.addEventListener('change', apply);
        txt.addEventListener('keydown', (e) => { if (e.key === 'Enter') apply(); });
        inputs[key] = { set: (v) => { s.set(v); if (document.activeElement !== txt) txt.value = fmt(v, digits); } };
        return h('div', { class: 'ch8-param' }, s.el, txt);
      }
      let reseedOnMap = false;
      const presetBtns = pats.map((pt) => RD.ui.button(pt.name, () => {
        sim.setParams({ F: pt.F, k: pt.k, Du: D.Du ?? 1, Dv: D.Dv ?? 0.5 });
        seedStyle = pt.seed || 'random';
        seedSeg.set(seedStyle, false);
        sim.seed(seedStyle);
        sync();
        view.render();
        say(`プリセット「${pt.name}」（${pt.kind === 'live' ? '生きている模様' : '完成する模様'}）を読みこみました。`);
      }, { small: true }));
      const boxes = () => pats.filter((pt) => pt.box).map((pt) => ({ box: pt.box, label: pt.name, state: RD.collection.has(pt.id) ? 'done' : 'plain' }));
      let mapEl = null;
      if (RD.FkMap) {
        mapObj = new RD.FkMap({ F: sim.F, k: sim.k, palette, zoom: true, boxes: boxes(), onPick: (F, k) => { sim.setParams({ F, k }); if (reseedOnMap) sim.seed(seedStyle); sync(); view.render(); } });
        const m = mapObj;
        ctx.onCleanup(() => m.destroy && m.destroy());
        const modeSeg = RD.ui.segmented([{ value: 'atlas', label: '模様の見本' }, { value: 'country', label: '国の色分け' }], 'atlas', (m) => mapObj.setMode(m));
        const zoomSeg = RD.ui.segmented([{ value: 'all', label: '全体' }, { value: 'zoom', label: '拡大' }], 'zoom', (z) => mapObj.setZoom(z === 'zoom'));
        mapEl = card('F-k マップ（クリックで F, k をえらぶ）',
          h('div', { class: 'row', style: { justifyContent: 'center', marginBottom: '6px' } }, modeSeg.el, zoomSeg.el),
          mapObj.el, mapNote,
          h('div', { class: 'row', style: { marginTop: '6px' } }, RD.ui.toggle('地図でえらんだら、種をまき直す', false, (v) => { reseedOnMap = v; }).el));
      }
      const paramCard = card('数をえらぶ',
        pats.length ? h('div', null, h('div', { class: 'muted', text: 'プリセット（第7章の模様）' }), h('div', { class: 'ch8-presets', style: { margin: '4px 0 10px' } }, presetBtns)) : null,
        param('<i>F</i> 草の生えやすさ', 'F', 0.002, 0.09, 0.0005, 4),
        param('<i>k</i> ウサギの減りやすさ', 'k', 0.03, 0.075, 0.0001, 4),
        param('<i>D<sub>u</sub></i> 草の広がる速さ', 'Du', 0.05, dMax, 0.05, 2),
        param('<i>D<sub>v</sub></i> ウサギの広がる速さ', 'Dv', 0.05, dMax, 0.05, 2),
        h('div', { class: 'muted', html: `数字の欄には、細かい値（例：0.0367）を直接入力できます。D × Δt（Δt = ${fmt(dt, 2)}）が 1 をこえないように、D は ${fmt(dMax, 2)} までです。` }));

      // ---- 見た目と保存 ----
      const palSel = h('select', { class: 'ch8-sel', 'aria-label': '色のパレット' }, Object.entries(RD.PALETTES).map(([key, pl]) => h('option', { value: key, text: pl.name })));
      palSel.value = palette;
      palSel.addEventListener('change', () => { palette = palSel.value; view.setPalette(palette); if (mapObj) mapObj.setPalette(palette); });
      const fieldSeg = RD.ui.segmented([{ value: 'v', label: '🐇 ウサギ v' }, { value: 'u', label: '🌱 草 u' }], 'v', (f) => {
        view.title = f === 'v' ? '色 ＝ 🐇 ウサギの濃さ <i class="v">v</i>' : '色 ＝ 🌱 草の量 <i class="v">u</i>';
        view.setField(f, f === 'u' ? [0, 1] : [0, 0.4]);
      });
      const nameIn = h('input', { type: 'text', placeholder: '模様の名前（例：わたしの迷路）', maxlength: 24, 'aria-label': '模様の名前' });
      const collEl = h('div', { class: 'ch8-coll' });
      const stamp = () => `F${fmt(sim.F, 4)}-k${fmt(sim.k, 4)}`;
      function saveColl() {
        const name = nameIn.value.trim() || `わたしの模様 ${new Date().toLocaleDateString('ja-JP')}`;
        RD.collection.add({ id: 'lab-' + Date.now(), name, F: +fmt(sim.F, 5), k: +fmt(sim.k, 5), Du: +fmt(sim.Du, 3), Dv: +fmt(sim.Dv, 3), palette, thumb: view.thumbnail(), source: 'lab' });
        nameIn.value = '';
        renderColl();
        RD.ui.toast(`「${name}」をコレクションに保存しました`);
      }
      nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveColl(); });
      function load(item) {
        sim.setParams({ F: item.F, k: item.k, Du: clampD(item.Du ?? D.Du ?? 1), Dv: clampD(item.Dv ?? D.Dv ?? 0.5) });
        if (item.palette && RD.PALETTES[item.palette]) { palette = item.palette; palSel.value = palette; view.setPalette(palette); if (mapObj) mapObj.setPalette(palette); }
        const pt = item.source === 'challenge' ? P(item.id) : null;
        seedStyle = (pt && pt.seed) || seedStyle;
        seedSeg.set(seedStyle, false);
        sim.seed(seedStyle);
        sync(); view.render();
        say(`「${item.name}」の数（F = ${fmt(item.F, 4)}, k = ${fmt(item.k, 4)}）を読みこみました。`);
        view.el.scrollIntoView({ behavior: window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
      }
      function renderColl() {
        const list = RD.collection.list();
        // まだ再現していない第7章の模様は「？」で見せる（トップのコレクションと同じ）
        const locked = pats.filter((pt) => !list.some((c) => c.id === pt.id)).map((pt) =>
          h('div', { class: 'item locked', title: '第7章の再現チャレンジで集められます' }, h('div', { class: 'ph', text: '？' }), pt.name));
        collEl.replaceChildren(...(list.length ? list.slice().reverse().map((item) => {
          const el = h('div', { class: 'item', role: 'button', tabindex: '0', title: `F = ${item.F}, k = ${item.k}` },
            item.thumb ? h('img', { src: item.thumb, alt: '' }) : null, item.name + (item.source === 'challenge' ? ' ✓' : ''));
          el.addEventListener('click', () => load(item));
          el.addEventListener('keydown', (e) => { if (e.key === 'Enter') load(item); });
          if (item.source === 'lab') {
            const del = h('button', { type: 'button', class: 'del', text: '×', title: '消す', 'aria-label': `${item.name} を消す` });
            del.addEventListener('click', (e) => { e.stopPropagation(); if (confirm(`「${item.name}」をコレクションから消しますか？`)) { RD.collection.remove(item.id); renderColl(); } });
            el.appendChild(del);
          }
          return el;
        }) : [h('div', { class: 'muted', style: { gridColumn: '1 / -1' }, text: 'まだありません。第7章の再現チャレンジや、ここで保存した模様が並びます。' })]), ...locked);
        if (mapObj) mapObj.setBoxes(boxes());
      }
      renderColl();
      const lookCard = card('色と保存',
        h('div', { class: 'ch8-tools' }, h('span', { class: 'lbl', text: '色：' }), palSel),
        h('div', { class: 'ch8-tools' }, h('span', { class: 'lbl', text: '表示：' }), fieldSeg.el),
        h('div', { class: 'ch8-tools' }, RD.ui.button('🖼 画像（PNG）で保存', () => view.savePng(`kusa-usagi-${stamp()}.png`), { small: true })),
        h('div', { class: 'ch8-save' }, nameIn, RD.ui.button('⭐ コレクションに保存', saveColl, { small: true, primary: true })));
      const collCard = card('コレクション（クリックで読みこむ）', collEl);

      // ---- 組み立て ----
      root.appendChild(step({
        title: 'ようこそ、自由ラボへ',
        text: [
          p('ここは、好きなだけ実験できる草原です。クリアの条件はありません。'),
          h('ol', null,
            h('li', { html: '<b>数をえらぶ：</b>プリセットや F-k マップで、F と k をえらびます。' }),
            h('li', { html: '<b>ウサギを放す：</b>草原をなぞると、そこにウサギが放されます。文字や絵を描いてもかまいません。' }),
            h('li', { html: '<b>色をつけて残す：</b>好きな色をえらんで、画像に保存したり、コレクションに入れたりしましょう。' })),
        ],
      }));
      sync();
      root.appendChild(h('div', { class: 'ch8-lab' },
        h('div', { class: 'ch8-main' }, mainCard),
        h('div', { class: 'ch8-side' }, paramCard, mapEl, lookCard, collCard)));

      root.appendChild(step({
        title: 'ためしてみよう',
        text: [
          h('ul', null,
            h('li', { html: '<b>文字から育てる：</b>「全消し」してから、迷路や穴あきの数で、ウサギで自分の名前を書いてみましょう。文字の形から模様が育っていきます。' }),
            h('li', { html: '<b>速さを変える：</b><i>D<sub>u</sub></i> と <i>D<sub>v</sub></i> を両方小さくすると、模様が細かくなるはずです（第7章の実験2）。' }),
            h('li', { html: '<b>速さをそろえる：</b><i>D<sub>v</sub></i> を <i>D<sub>u</sub></i> に近づけていくと、どこで模様が消えるでしょう？' }),
            h('li', { html: '<b>波を切る：</b>うずまき・波の数で線を描き、波が走りだしたら、消しゴムで途中を切ってみましょう。何が起きるでしょう？' }),
            h('li', { html: '<b>国境を歩く：</b>F-k マップの国境の上を少しずつ動いて、模様が変わる瞬間をさがしてみましょう。' })),
          more('色のパレットについて',
            '<p>「みどり〜きいろ（見分けやすい）」と「白黒」は、色の見え方が人によってちがっても、濃い・薄いが見分けやすい色の並びです。</p>'),
        ],
      }));

      root.appendChild(teacher(
        '<p><b>ねらい：</b>第7章までの知識を使って、自分の作りたい模様に向かって数と種を選ぶこと。正解はありません。</p>' +
        '<p><b>問いかけの例：</b>「どんな模様を作りたい？ それは地図のどの国にありそう？」「種の形を変えたら、模様の種類は変わった？（T17）」「止まる模様と動く模様、どっちを作ってる？（T18）」</p>' +
        '<p><b>よくある反応：</b>D × Δt が 1 をこえるような値は入れられないようにしてあります（第3章の「配りすぎ」）。地図は Du = 1, Dv = 0.5 のときのものなので、D を変えたら地図はあくまで目安だと伝えてください。</p>'));
    },
  });
})(window.RD = window.RD || {});
