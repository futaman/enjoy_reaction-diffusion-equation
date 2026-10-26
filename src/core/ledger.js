// 1マスの家計簿（M02）。えらんだマスの各項の値と、次のコマの値を表で見せる。
(function (RD) {
  const { h, fmt } = RD.ui;

  // opts: sim, index（えらんだマス）, show: 'both' | 'u' | 'v', digits, caption
  class Ledger {
    constructor(opts) {
      this.o = Object.assign({ show: 'both', digits: 4, index: 0 }, opts);
      this.sim = opts.sim;
      this.table = h('table', { class: 'ledger' });
      this.cap = h('div', { class: 'cap' });
      this.el = h('div', { class: 'ledger-wrap' }, this.cap, this.table);
      this.update();
    }
    show(i) { this.o.index = i; this.update(); }
    update() {
      const { sim, o } = this;
      const b = sim.breakdown(o.index);
      const t = sim.terms, d = o.digits;
      const showU = o.show !== 'v', showV = o.show !== 'u';
      const n = (x) => fmt(x, d);
      const sgn = (x) => (x >= 0 ? '+' : '−') + fmt(Math.abs(x), d);
      const [x, y] = sim.xy(o.index);
      this.cap.innerHTML = o.caption || (sim.dim === 0 ? '草原の家計簿' : `えらんだマス（${x + 1}${sim.dim === 2 ? ', ' + (y + 1) : ''}）の家計簿`);
      const rows = [];
      const head = h('tr', null, h('th', { text: '' }), showU ? h('th', { html: '🌱 草 <i class="v">u</i>' }) : null, showV ? h('th', { html: '🐇 ウサギ <i class="v">v</i>' }) : null);
      rows.push(h('thead', null, head));
      const body = h('tbody');
      const tr = (label, uVal, vVal, cls = '', off = false) => {
        body.appendChild(h('tr', { class: cls + (off ? ' off' : '') },
          h('td', { html: label }),
          showU ? h('td', { class: 'num', html: uVal ?? '' }) : null,
          showV ? h('td', { class: 'num', html: vVal ?? '' }) : null));
      };
      tr('今の値', n(b.u), n(b.v));
      if (sim.dim > 0) {
        tr('まわりの平均', n(b.avgU), n(b.avgV));
        tr('∇²（まわりの平均 − 自分）', n(b.lapU), n(b.lapV));
        tr('<span class="t-diff">広がる D∇²</span>', `<span class="t-diff">${sgn(b.diffU)}</span>`, `<span class="t-diff">${sgn(b.diffV)}</span>`, '', !t.diff);
      }
      tr('<span class="t-feed">草が生える F(1−u)</span>', `<span class="t-feed">${sgn(b.feed)}</span>`, '', '', !t.feed);
      tr('<span class="t-react">食べて増える uv²</span>', `<span class="t-react">${sgn(-b.react)}</span>`, `<span class="t-react">${sgn(b.react)}</span>`, '', !t.react);
      tr('<span class="t-decay">減る (F+k)v</span>', '', `<span class="t-decay">${sgn(-b.decay)}</span>`, '', !t.decay);
      tr('合計（変化の速さ ∂/∂t）', sgn(b.dudt), sgn(b.dvdt), 'sum');
      tr(`次の値（今 + ${fmt(b.dt, 3)} × 合計）`, n(b.uNext), n(b.vNext), 'next');
      this.table.replaceChildren(rows[0], body);
    }
  }

  RD.Ledger = Ledger;
})(window.RD = window.RD || {});
