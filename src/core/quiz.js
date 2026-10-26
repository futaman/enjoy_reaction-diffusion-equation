// 問題の部品。章からは ctx.quiz(spec) で使う（番号付けと進み具合の記録は ctx が行う）。
//
// 共通: { id, type, q（HTML）, hints:[HTML…最大3], explain（正解後の解説 HTML）, answerText（答えを見るで出す HTML）,
//        onHint(n)（n 個目のヒントを開いたとき）}
// type:
//   choice  { options:[{text, correct, why}] }              why = その選択肢を選んだときの説明（誤答の理由）
//   predict { options:[{text, correct, why}], observe(), observeLabel }  予想→観察→説明。観察したらクリア
//   number  { answer, tol, unit, prefix, wrong(val) → HTML|null }
//   grid    { prefill:[[値 or null]], answer:[[値]], tol, format, color }   null のマスが入力欄
//   match   { left:[HTML], right:[テキスト], answer:[left ごとの right の index] }
//   fill    { blanks:[{label, answer, tol, unit}] }
//   custom  { render(body, api) }  api: { solve(), feedback(html, kind) }
(function (RD) {
  const { h, parseNum, fmt } = RD.ui;

  const defaultTol = (ans) => Math.max(0.0005, Math.abs(ans) * 0.002);
  const close = (val, ans, tol) => isFinite(val) && Math.abs(val - ans) <= (tol ?? defaultTol(ans)) + 1e-12;

  function makeQuiz(ctx, spec) {
    const solvedBefore = ctx.isSolved(spec.id);
    const isPredict = spec.type === 'predict';
    const badge = h('span', { class: 'quiz-badge' + (isPredict ? ' predict' : ''), text: isPredict ? `予想 ${ctx.number}` : `問題 ${ctx.number}` });
    const state = h('span', { class: 'quiz-state', text: solvedBefore ? '✓ クリア' : '' });
    const el = h('div', { class: 'quiz' + (solvedBefore ? ' solved' : ''), id: 'q-' + spec.id },
      h('div', { class: 'quiz-head' }, badge, state));
    el.appendChild(h('div', { class: 'quiz-q' }, typeof spec.q === 'string' ? RD.ui.html(spec.q) : spec.q));
    const body = h('div', { class: 'quiz-body' });
    const fb = h('div', { class: 'feedback', 'aria-live': 'polite' });
    el.append(body, fb);

    const feedback = (html, kind) => { fb.className = 'feedback ' + (kind || ''); fb.innerHTML = html || ''; };
    const solve = () => {
      el.classList.add('solved');
      state.textContent = '✓ クリア';
      ctx.solve(spec.id);
    };
    const praise = () => ['正解です！', 'その通り！', 'よくできました！', 'ばっちりです！'][Math.floor(Math.random() * 4)];
    const okMsg = () => `<p><b>${praise()}</b></p>${spec.explain || ''}`;

    // ---- 種類ごとの中身 ----
    const types = {
      choice() {
        const box = h('div', { class: 'choices' });
        spec.options.forEach((opt) => {
          const b = h('button', { type: 'button', class: 'choice', html: opt.text });
          b.addEventListener('click', () => {
            box.querySelectorAll('.choice').forEach((x) => x.classList.remove('picked-ok', 'picked-ng'));
            if (opt.correct) { b.classList.add('picked-ok'); feedback(okMsg(), 'ok'); solve(); }
            else { b.classList.add('picked-ng'); feedback(opt.why || '<p>ちがいます。もう一度考えてみましょう。</p>', 'ng'); }
          });
          box.appendChild(b);
        });
        body.appendChild(box);
      },

      predict() {
        const box = h('div', { class: 'choices' });
        let picked = null;
        const obsBtn = RD.ui.button(spec.observeLabel || '▶ 実際に動かしてたしかめる', () => {
          if (picked == null) return;
          spec.observe && spec.observe();
          box.querySelectorAll('.choice').forEach((x, i) => { if (spec.options[i].correct) x.classList.add('reveal'); });
          const opt = spec.options[picked];
          const head = opt.correct ? '<p><b>予想どおり！</b></p>' : '<p><b>予想とちがいましたね。</b>でも、予想してから見ることが大事です。</p>';
          feedback(head + (opt.correct ? '' : (opt.why || '')) + (spec.explain || ''), opt.correct ? 'ok' : 'info');
          solve();
        }, { primary: true });
        obsBtn.disabled = true;
        spec.options.forEach((opt, i) => {
          const b = h('button', { type: 'button', class: 'choice', html: opt.text });
          b.addEventListener('click', () => {
            picked = i;
            box.querySelectorAll('.choice').forEach((x) => x.classList.remove('picked-ok', 'picked-ng', 'reveal'));
            b.classList.add('picked-ok');
            obsBtn.disabled = false;
            feedback('<p>予想を選びました。動かしてたしかめてみましょう。</p>', 'info');
          });
          box.appendChild(b);
        });
        body.append(box, h('div', { class: 'row' }, obsBtn));
      },

      number() {
        const inp = h('input', { type: 'text', inputmode: 'decimal', 'aria-label': '答え', autocomplete: 'off' });
        const check = () => {
          const val = parseNum(inp.value);
          inp.classList.remove('ok', 'ng');
          if (!isFinite(val)) { feedback('<p>数字で入力してください（例：13.5、−0.2）。</p>', 'ng'); return; }
          if (close(val, spec.answer, spec.tol)) { inp.classList.add('ok'); feedback(okMsg(), 'ok'); solve(); return; }
          inp.classList.add('ng');
          let msg = spec.wrong ? spec.wrong(val) : null;
          if (!msg && spec.answer !== 0 && close(val, -spec.answer, spec.tol)) msg = '<p>おしい！ 数の大きさは合っています。<b>＋と−（増えるか減るか）</b>をもう一度確認しましょう。</p>';
          feedback(msg || '<p>ちがうようです。ヒントを見ながら、もう一度計算してみましょう。</p>', 'ng');
        };
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') check(); });
        body.appendChild(h('div', { class: 'answer-row' }, spec.prefix ? h('span', { html: spec.prefix }) : null, inp, spec.unit ? h('span', { html: spec.unit }) : null, RD.ui.button('答え合わせ', check, { primary: true })));
      },

      grid() {
        const g = RD.ui.numGrid({ values: spec.prefill, editable: (r, c) => spec.prefill[r][c] == null, format: spec.format || ((v) => fmt(v, 3)), color: spec.color });
        const check = () => {
          let all = true, any = false;
          spec.prefill.forEach((row, r) => row.forEach((v, c) => {
            if (v != null) return;
            const ok = close(g.values[r][c], spec.answer[r][c], spec.tol);
            g.mark(r, c, ok); all = all && ok; any = true;
          }));
          if (all && any) { feedback(okMsg(), 'ok'); solve(); }
          else feedback('<p>赤いマスがちがうようです。そのマスだけ、もう一度計算してみましょう。</p>', 'ng');
        };
        body.append(h('div', { style: { overflowX: 'auto', padding: '4px 0' } }, g.el), h('div', { class: 'row', style: { marginTop: '8px' } }, RD.ui.button('答え合わせ', check, { primary: true })));
      },

      match() {
        const list = h('div', { class: 'match-list' });
        const sels = spec.left.map((l) => {
          const sel = h('select', { 'aria-label': '対応するものをえらぶ' }, h('option', { value: '', text: '― えらぶ ―' }), spec.right.map((r, j) => h('option', { value: j, text: r })));
          list.appendChild(h('div', { class: 'match-item' }, h('div', { html: l }), sel));
          return sel;
        });
        body.appendChild(list);
        const check = () => {
          let all = true;
          sels.forEach((s, i) => {
            const ok = s.value !== '' && +s.value === spec.answer[i];
            s.classList.remove('ok', 'ng'); s.classList.add(ok ? 'ok' : 'ng'); all = all && ok;
          });
          if (all) { feedback(okMsg(), 'ok'); solve(); }
          else feedback('<p>赤い枠のところがちがうようです。</p>', 'ng');
        };
        body.appendChild(h('div', { class: 'row' }, RD.ui.button('答え合わせ', check, { primary: true })));
      },

      fill() {
        const list = h('div', { class: 'fill-list' });
        const inps = spec.blanks.map((b) => {
          const inp = h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': b.label.replace(/<[^>]+>/g, '') });
          list.appendChild(h('div', { class: 'fill-item answer-row', style: { margin: 0 } }, h('span', { class: 'lbl', html: b.label }), inp, b.unit ? h('span', { html: b.unit }) : null));
          return inp;
        });
        const check = () => {
          let all = true, firstNg = -1;
          spec.blanks.forEach((b, i) => {
            const ok = close(parseNum(inps[i].value), b.answer, b.tol);
            inps[i].classList.remove('ok', 'ng'); inps[i].classList.add(ok ? 'ok' : 'ng');
            if (!ok && firstNg < 0) firstNg = i;
            all = all && ok;
          });
          if (all) { feedback(okMsg(), 'ok'); solve(); }
          else feedback(`<p>赤い欄がちがうようです。まずは「${spec.blanks[firstNg].label}」から見直しましょう。</p>`, 'ng');
        };
        body.append(list, h('div', { class: 'row' }, RD.ui.button('答え合わせ', check, { primary: true })));
      },

      custom() { spec.render(body, { solve, feedback }); },
    };
    (types[spec.type] || types.choice)();

    // ---- ヒント（3段階）と「答えを見る」 ----
    const hints = spec.hints || [];
    if (hints.length || spec.answerText) {
      const area = h('div', { class: 'hints' });
      let shown = 0;
      const ansBtn = spec.answerText ? RD.ui.button('答えを見る', () => {
        area.appendChild(h('div', { class: 'hint', html: `<b>答え</b>　${spec.answerText}` }));
        ansBtn.remove();
      }, { small: true }) : null;
      const btn = hints.length ? RD.ui.button(`💡 ヒント（0/${hints.length}）`, () => {
        area.appendChild(h('div', { class: 'hint', html: `<b>ヒント${shown + 1}</b>　${hints[shown]}` }));
        shown++;
        spec.onHint && spec.onHint(shown);
        btn.innerHTML = `💡 ヒント（${shown}/${hints.length}）`;
        if (shown >= hints.length) { btn.remove(); if (ansBtn) btns.appendChild(ansBtn); }
      }, { small: true }) : null;
      const btns = h('div', { class: 'row' }, btn, !hints.length ? ansBtn : null);
      el.append(btns, area);
    }
    return el;
  }

  RD.makeQuiz = makeQuiz;
  RD.quizClose = close;
})(window.RD = window.RD || {});
