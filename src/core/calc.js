// 電卓。章で ctx.useCalc() を呼ぶと右下にボタンが出る。eval は使わず、四則演算とかっこだけを自前で計算する。
(function (RD) {
  const { h, fmt } = RD.ui;

  // 式を計算する（+ − × ÷ とかっこ、小数）。失敗したら NaN。
  function evaluate(src) {
    const s = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\s+/g, '');
    let i = 0;
    const peek = () => s[i];
    function num() {
      const m = /^\d*\.?\d+|^\d+\.?/.exec(s.slice(i));
      if (!m) throw new Error('num');
      i += m[0].length;
      return parseFloat(m[0]);
    }
    function factor() {
      if (peek() === '-') { i++; return -factor(); }
      if (peek() === '+') { i++; return factor(); }
      if (peek() === '(') { i++; const v = expr(); if (peek() === ')') i++; return v; }
      return num();
    }
    function term() {
      let v = factor();
      while (peek() === '*' || peek() === '/') { const op = s[i++]; const r = factor(); v = op === '*' ? v * r : v / r; }
      return v;
    }
    function expr() {
      let v = term();
      while (peek() === '+' || peek() === '-') { const op = s[i++]; const r = term(); v = op === '+' ? v + r : v - r; }
      return v;
    }
    try {
      const v = expr();
      return i === s.length ? v : NaN;
    } catch (e) { return NaN; }
  }

  let panel = null, fab = null;
  function mount() {
    if (fab) { fab.hidden = false; return; }
    let expr = '';
    const exprEl = h('div', { class: 'expr' });
    const valEl = h('div', { class: 'val', text: '0' });
    const show = () => {
      exprEl.textContent = expr;
      const v = evaluate(expr);
      valEl.textContent = expr === '' ? '0' : isFinite(v) ? fmt(v, 8) : '…';
    };
    const press = (k) => {
      if (k === 'C') expr = '';
      else if (k === '←') expr = expr.slice(0, -1);
      else if (k === '=') { const v = evaluate(expr); if (isFinite(v)) expr = fmt(v, 8); }
      else expr += k;
      show();
    };
    const keys = ['C', '(', ')', '←', '7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '.', '=', '+'];
    const keyEls = keys.map((k) => h('button', { type: 'button', text: k, class: /[÷×−+]/.test(k) ? 'op' : k === '=' ? 'eq' : '', onClick: () => press(k) }));
    panel = h('div', { class: 'calc-panel', role: 'dialog', 'aria-label': '電卓', hidden: true },
      h('div', { class: 'calc-display' }, exprEl, valEl),
      h('div', { class: 'calc-keys' }, keyEls));
    fab = RD.ui.button('🧮 電卓', () => { panel.hidden = !panel.hidden; }, {});
    fab.classList.add('calc-fab');
    document.body.append(panel, fab);
  }
  function unmount() { if (fab) { fab.hidden = true; panel.hidden = true; } }

  RD.calc = { evaluate, mount, unmount };
})(window.RD = window.RD || {});
