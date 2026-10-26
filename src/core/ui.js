// UI ヘルパー。DOM を組み立てる小さな関数群。
(function (RD) {
  // h('div', {class:'x', onClick: fn, html:'<b>..</b>'}, child, [children], 'text')
  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, val] of Object.entries(props)) {
        if (val == null || val === false) continue;
        if (k === 'class') el.className = val;
        else if (k === 'style' && typeof val === 'object') Object.assign(el.style, val);
        else if (k === 'html') el.innerHTML = val;
        else if (k === 'text') el.textContent = val;
        else if (k.startsWith('on') && typeof val === 'function') el.addEventListener(k.slice(2).toLowerCase(), val);
        else if (val === true) el.setAttribute(k, '');
        else el.setAttribute(k, val);
      }
    }
    append(el, children);
    return el;
  }
  function append(el, children) {
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  // HTML 文字列を段落に。文字列なら innerHTML、ノードならそのまま。
  const p = (html) => h('p', { html });
  const html = (str) => { const t = document.createElement('template'); t.innerHTML = str.trim(); return t.content; };

  // 式。中身は HTML で書く（例: '<i>u</i> + 1'）
  const math = (str) => h('span', { class: 'math', html: str });
  const mathBlock = (str) => h('div', { class: 'math math-block', html: str });
  // 分数の HTML 文字列（math の中で使う）
  const frac = (top, bottom) => `<span class="frac"><span>${top}</span><span>${bottom}</span></span>`;
  const dudt = (f = 'u') => frac(`∂<i>${f}</i>`, '∂<i>t</i>');

  // 章の中の1ステップ。demo を渡すと PC で2カラムになる。
  function step({ title, text = [], demo = null }) {
    const el = h('section', { class: 'step' + (demo ? ' two' : '') });
    if (title) el.appendChild(h('h2', { text: title }));
    el.appendChild(h('div', { class: 'step-text' }, text));
    if (demo) el.appendChild(h('div', { class: 'step-demo' }, demo));
    return el;
  }
  const card = (title, ...children) => h('div', { class: 'card' }, title ? h('div', { class: 'card-title', text: title }) : null, children);
  // kind: '' | 'story' | 'warn' | 'mystery'
  const note = (content, kind = '') => h('div', { class: 'note ' + kind }, typeof content === 'string' ? html(content) : content);
  const more = (title, ...children) => h('details', { class: 'more' }, h('summary', { text: title || 'もっと詳しく' }), h('div', { class: 'body' }, children.map(toNode)));
  const teacher = (...children) => h('details', { class: 'teacher' }, h('summary', { text: '先生用メモ' }), h('div', { class: 'body' }, children.map(toNode)));
  const toNode = (c) => (typeof c === 'string' ? html(c) : c);

  function button(label, onClick, opts = {}) {
    return h('button', { type: 'button', class: 'btn' + (opts.primary ? ' primary' : '') + (opts.small ? ' small' : ''), html: label, onClick, title: opts.title });
  }
  const row = (...children) => h('div', { class: 'row' }, children);

  // つまみ。format で表示形式を変える。
  function slider({ label, min, max, step = 0.01, value, format = (v) => String(v), onInput }) {
    const id = 'sl' + Math.random().toString(36).slice(2, 8);
    const input = h('input', { type: 'range', id, min, max, step, value });
    const out = h('output', { for: id, text: format(+value) });
    const el = h('div', { class: 'slider' }, h('label', { for: id, html: label }), input, out);
    input.addEventListener('input', () => { out.textContent = format(+input.value); onInput && onInput(+input.value); });
    return {
      el,
      get value() { return +input.value; },
      set(v, fire = false) { input.value = v; out.textContent = format(+input.value); if (fire && onInput) onInput(+input.value); },
      input,
    };
  }

  function toggle(label, checked, onChange) {
    const input = h('input', { type: 'checkbox' });
    input.checked = !!checked;
    input.addEventListener('change', () => onChange && onChange(input.checked));
    const el = h('label', { class: 'toggle' }, input, h('span', { html: label }));
    return { el, input, get checked() { return input.checked; }, set(v) { input.checked = v; } };
  }

  // セグメント切り替え。options: [{value, label}]
  function segmented(options, value, onChange) {
    const el = h('div', { class: 'seg', role: 'group' });
    const btns = options.map((o) => {
      const b = h('button', { type: 'button', html: o.label, onClick: () => set(o.value, true) });
      el.appendChild(b);
      return b;
    });
    function set(v, fire) {
      value = v;
      options.forEach((o, i) => btns[i].classList.toggle('on', o.value === v));
      if (fire && onChange) onChange(v);
    }
    set(value, false);
    return { el, set, get value() { return value; } };
  }

  // 数字のマス。values は2次元配列（null は空欄）。editable なら入力欄になる。
  // color(v) で背景色、textColor(v) で文字色の CSS 文字列を返すと色が付く。
  function numGrid({ values, editable = false, format = (v) => String(v), color = null, textColor = null, highlight = null, onChange = null, onCellClick = null }) {
    const rows = values.length, cols = values[0].length;
    const el = h('div', { class: 'numgrid', style: { gridTemplateColumns: `repeat(${cols}, auto)` } });
    const cells = [];
    for (let r = 0; r < rows; r++) {
      cells.push([]);
      for (let c = 0; c < cols; c++) {
        const cell = h('div', { class: 'cell' });
        if (onCellClick) { cell.style.cursor = 'pointer'; cell.addEventListener('click', () => onCellClick(r, c)); }
        el.appendChild(cell);
        cells[r].push(cell);
      }
    }
    let cur = values.map((r) => r.slice());
    function render() {
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const cell = cells[r][c], v = cur[r][c];
        const isInput = editable === true || (typeof editable === 'function' && editable(r, c));
        cell.classList.remove('ok', 'ng');
        if (isInput) {
          let inp = cell.querySelector('input');
          if (!inp) {
            cell.textContent = '';
            inp = h('input', { type: 'text', inputmode: 'decimal', 'aria-label': `${r + 1}行${c + 1}列` });
            inp.addEventListener('input', () => { cur[r][c] = RD.ui.parseNum(inp.value); onChange && onChange(cur, r, c); });
            cell.appendChild(inp);
          }
          if (v != null && document.activeElement !== inp) inp.value = format(v);
        } else {
          cell.textContent = v == null ? '' : format(v);
        }
        cell.style.background = color && v != null && !isInput ? color(v) : '';
        cell.style.color = textColor && v != null && !isInput ? textColor(v) : '';
        cell.classList.toggle('hl', !!(highlight && highlight(r, c)));
      }
    }
    render();
    return {
      el,
      get values() { return cur; },
      setValues(vals) { cur = vals.map((r) => r.slice()); render(); },
      setHighlight(fn) { highlight = fn; render(); },
      mark(r, c, ok) { cells[r][c].classList.remove('ok', 'ng'); if (ok != null) cells[r][c].classList.add(ok ? 'ok' : 'ng'); },
      cell: (r, c) => cells[r][c],
      render,
    };
  }

  // 全角数字やマイナス記号も受け付ける数値パース。失敗したら NaN。
  function parseNum(s) {
    if (s == null) return NaN;
    s = String(s).trim()
      .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
      .replace(/[．。]/g, '.').replace(/[−ー―‐－]/g, '-').replace(/[＋]/g, '+').replace(/,/g, '');
    if (s === '' || !/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
    return parseFloat(s);
  }

  // 小数を見やすく（末尾の0を落とす）
  function fmt(v, digits = 4) {
    if (!isFinite(v)) return String(v);
    const s = (+v).toFixed(digits);
    return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
  }

  function toast(msg, ms = 2200) {
    const t = h('div', { class: 'toast', role: 'status', text: msg });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  // CSS 変数の値を読む（キャンバス描画で使う）
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  RD.ui = { h, append, p, html, math, mathBlock, frac, dudt, step, card, note, more, teacher, button, row, slider, toggle, segmented, numGrid, parseNum, fmt, toast, cssVar };
})(window.RD = window.RD || {});
