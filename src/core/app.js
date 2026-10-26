// アプリ本体：章の登録、ルーター（#/ と #/c/<章id>）、トップページ、章の枠、進み具合。
//
// 章の登録:
//   RD.registerChapter({
//     id: 'ch1', no: 1, title: '変化の速さ', desc: 'トップに出す1行説明', goal: 'この章のねらい',
//     required: 4,                 // クリアに必要な正解数（0 ならクリア条件なし）
//     render(root, ctx) { ... },  // root に中身を追加する
//   });
//
// ctx:
//   ctx.quiz(spec)        問題の要素を作る（番号付け・記録つき）
//   ctx.onCleanup(fn)     ページを離れるときに呼ぶ
//   ctx.useCalc()         電卓を出す
//   ctx.params            URL のクエリ（#/c/ch8?F=0.03&k=0.06 → {F:'0.03', k:'0.06'}）
//   ctx.markCleared()     required によらずクリアにする（ラボ等で使う）
//   ctx.chapter           登録した定義
(function (RD) {
  const { h } = RD.ui;
  const chapters = [];

  function registerChapter(def) {
    chapters.push(def);
    chapters.sort((a, b) => a.no - b.no);
  }
  const find = (id) => chapters.find((c) => c.id === id);

  let cleanups = [];
  function runCleanups() {
    cleanups.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
    cleanups = [];
    RD.Runner && RD.Runner.stopAll();
    RD.calc.unmount();
  }

  // ---- ヘッダー ----
  function header() {
    const themeBtn = h('button', { type: 'button', class: 'icon-btn', title: '表示の明るさを切り替え' });
    const themes = [['auto', '🌓 自動'], ['light', '☀️ 明るい'], ['dark', '🌙 暗い']];
    const applyTheme = (t) => {
      if (t === 'auto') document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', t);
      themeBtn.textContent = themes.find((x) => x[0] === t)[1];
    };
    let theme = RD.store.get('theme', 'auto');
    applyTheme(theme);
    themeBtn.addEventListener('click', () => {
      theme = themes[(themes.findIndex((x) => x[0] === theme) + 1) % themes.length][0];
      RD.store.set('theme', theme);
      applyTheme(theme);
      // グラフの色は CSS 変数から読むので描き直す
      RD.Runner.all.forEach((r) => r.draw());
    });
    return h('header', { class: 'app-header' },
      h('a', { class: 'brand', href: '#/', text: '🌱🐇 草とウサギの模様ドリル' }),
      h('span', { class: 'spacer' }),
      themeBtn);
  }

  // ---- トップページ ----
  function renderTop(root) {
    const last = RD.store.get('last', null);
    const lastCh = last && find(last);
    root.append(
      h('div', { class: 'hero' },
        h('div', { class: 'muted', text: '反応拡散方程式（Gray-Scott モデル）入門' }),
        h('h1', { text: '草とウサギで模様をつくる' }),
        h('p', { class: 'sub', html: 'シマウマのしま模様も、ヒョウの点々も、<br>2つのかんたんなルールから生まれるかもしれません。' }),
        h('div', { class: 'cast' },
          h('div', { class: 'who', html: '🌱 <b>草</b>（<i class="v t-u">u</i>）<br><span class="muted">生えてくる・風で広がる</span>' }),
          h('div', { class: 'who', html: '🐇 <b>ウサギ</b>（<i class="v t-v">v</i>）<br><span class="muted">草を食べて増える・ゆっくり歩く</span>' })),
        h('div', { class: 'row', style: { justifyContent: 'center' } },
          lastCh ? h('a', { class: 'btn primary', href: '#/c/' + lastCh.id, text: `つづきから（${lastCh.no ? '第' + lastCh.no + '章' : lastCh.title}）` }) : null,
          h('a', { class: 'btn' + (lastCh ? '' : ' primary'), href: '#/c/' + (chapters[0] ? chapters[0].id : ''), text: 'はじめから' }))),
      h('h2', { text: 'もくじ' }));

    const list = h('div', { class: 'ch-list' });
    for (const c of chapters) {
      const p = RD.progress.of(c.id);
      const mark = c.required ? (p.cleared ? '✓ クリア' : `${Math.min(p.solved.length, c.required)} / ${c.required}`) : '';
      list.appendChild(h('a', { class: 'ch-card' + (p.cleared ? ' cleared' : '') + (last === c.id ? ' last' : ''), href: '#/c/' + c.id },
        h('span', { class: 'no', text: c.no ? `第${c.no}章` : 'はじめに' }),
        h('span', { class: 'ttl', text: c.title }),
        h('span', { class: 'desc', text: c.desc || '' }),
        h('span', { class: 'mark', text: mark })));
    }
    root.appendChild(list);

    // コレクション
    root.appendChild(h('h2', { text: '模様のコレクション' }));
    root.appendChild(h('p', { class: 'muted', text: '第7章で再現した模様と、自由ラボで保存した模様がここに並びます。クリックするとラボで開きます。' }));
    const coll = h('div', { class: 'collection' });
    const saved = RD.collection.list();
    const pats = RD.patterns || [];
    for (const pt of pats) {
      const got = saved.find((s) => s.id === pt.id);
      coll.appendChild(got
        ? h('a', { class: 'coll-item', href: `#/c/ch8?F=${got.F}&k=${got.k}&seed=${pt.seed}` }, h('img', { src: got.thumb, alt: pt.name }), pt.name)
        : h('div', { class: 'coll-item locked' }, h('div', { class: 'ph', text: '？' }), pt.name));
    }
    for (const s of saved.filter((x) => x.source === 'lab')) {
      coll.appendChild(h('a', { class: 'coll-item', href: `#/c/ch8?F=${s.F}&k=${s.k}&Du=${s.Du ?? ''}&Dv=${s.Dv ?? ''}&palette=${s.palette ?? ''}` }, h('img', { src: s.thumb, alt: s.name }), s.name));
    }
    root.appendChild(coll);

    root.appendChild(h('div', { class: 'center', style: { marginTop: '48px' } },
      RD.ui.button('記録をすべて消す', () => {
        if (confirm('進み具合とコレクションをすべて消します。よろしいですか？')) { RD.progress.reset(); route(); }
      }, { small: true })));
  }

  // ---- 章ページ ----
  function renderChapter(root, c, params) {
    RD.store.set('last', c.id);
    const progEl = h('span', { class: 'ch-progress' });
    const updateProgress = () => {
      const p = RD.progress.of(c.id);
      if (c.required) {
        const n = Math.min(p.solved.length, c.required);
        if (!p.cleared && n >= c.required) { RD.progress.setCleared(c.id); RD.ui.toast('🎉 この章をクリアしました！'); }
        const cleared = RD.progress.of(c.id).cleared;
        progEl.textContent = cleared ? '✓ この章はクリア済み' : `クリアまで：${n} / ${c.required} 問`;
        progEl.classList.toggle('cleared', cleared);
      } else {
        progEl.textContent = '';
      }
    };
    let quizNo = 0;
    const ctx = {
      chapter: c,
      params,
      get number() { return quizNo; },
      isSolved: (qid) => RD.progress.isSolved(c.id, qid),
      solve: (qid) => { RD.progress.markSolved(c.id, qid); updateProgress(); },
      quiz(spec) { quizNo++; return RD.makeQuiz(ctx, spec); },
      onCleanup: (fn) => cleanups.push(fn),
      useCalc: () => RD.calc.mount(),
      markCleared: () => { if (!RD.progress.of(c.id).cleared) { RD.progress.setCleared(c.id); updateProgress(); } },
    };

    root.appendChild(h('div', { class: 'ch-head' },
      h('div', { class: 'ch-no', text: c.no ? `第${c.no}章` : 'はじめに' }),
      h('h1', { text: c.title }),
      c.goal ? h('div', { class: 'ch-goal' }, h('span', { class: 'label', text: 'この章のねらい' }), h('span', { html: c.goal }), progEl) : null));
    updateProgress();

    const body = h('div', { class: 'ch-body' });
    root.appendChild(body);
    try {
      c.render(body, ctx);
    } catch (e) {
      console.error(e);
      body.appendChild(RD.ui.note(`<p>この章の表示中にエラーが起きました：${String(e.message || e)}</p>`, 'warn'));
    }

    const i = chapters.indexOf(c);
    const prev = chapters[i - 1], next = chapters[i + 1];
    root.appendChild(h('nav', { class: 'ch-nav' },
      prev ? h('a', { class: 'btn', href: '#/c/' + prev.id, text: `← ${prev.no ? '第' + prev.no + '章' : prev.title}` }) : h('span'),
      h('a', { class: 'btn', href: '#/', text: 'もくじ' }),
      next ? h('a', { class: 'btn primary', href: '#/c/' + next.id, text: `${next.no ? '第' + next.no + '章' : next.title} →` }) : h('span')));
  }

  // ---- ルーター ----
  let app;
  function parseHash() {
    const raw = location.hash.replace(/^#/, '') || '/';
    const [path, query = ''] = raw.split('?');
    const params = {};
    for (const part of query.split('&')) {
      if (!part) continue;
      const [k, v = ''] = part.split('=');
      try { params[decodeURIComponent(k)] = decodeURIComponent(v); } catch (e) { /* noop */ }
    }
    return { parts: path.split('/').filter(Boolean), params };
  }
  function route() {
    runCleanups();
    const { parts, params } = parseHash();
    const page = h('main', { class: 'page' });
    app.replaceChildren(header(), page);
    if (parts[0] === 'c' && find(parts[1])) {
      const c = find(parts[1]);
      document.title = `${c.no ? '第' + c.no + '章 ' : ''}${c.title}｜草とウサギの模様ドリル`;
      renderChapter(page, c, params);
    } else {
      document.title = '草とウサギの模様ドリル';
      renderTop(page);
    }
    window.scrollTo(0, 0);
  }

  function start() {
    app = document.getElementById('app');
    window.addEventListener('hashchange', route);
    route();
  }

  RD.registerChapter = registerChapter;
  RD.chapters = chapters;
  RD.start = start;
  RD.route = route;
})(window.RD = window.RD || {});
