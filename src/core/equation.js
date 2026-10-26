// 色分けした Gray-Scott の式（M05）。interactive なら項のクリックで sim.terms をオン・オフ（M04）。
(function (RD) {
  const { h, dudt } = RD.ui;

  const TERM_INFO = {
    diff: { cls: 't-diff', name: '広がる（拡散）' },
    feed: { cls: 't-feed', name: '草が生える' },
    react: { cls: 't-react', name: 'ペアで食べて増える' },
    decay: { cls: 't-decay', name: 'ウサギが減る' },
  };

  // opts: sim（interactive のとき必須）, interactive, show 'both'|'u'|'v', legend(true), onChange(terms)
  class Equation {
    constructor(opts = {}) {
      this.o = Object.assign({ interactive: false, show: 'both', legend: true }, opts);
      this.sim = opts.sim || null;
      this.terms = this.sim ? this.sim.terms : { diff: true, feed: true, react: true, decay: true };
      this.el = h('div', { class: 'equation' + (this.o.interactive ? ' interactive' : '') });
      const term = (key, html) => {
        const span = h('span', { class: `term ${TERM_INFO[key].cls}`, 'data-term': key, html, title: TERM_INFO[key].name });
        if (this.o.interactive) {
          span.setAttribute('role', 'button');
          span.setAttribute('tabindex', '0');
          const flip = () => this.set(key, !this.terms[key]);
          span.addEventListener('click', flip);
          span.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
        }
        return span;
      };
      const line = (...parts) => h('div', { class: 'eq-line' }, parts);
      const op = (s) => h('span', { html: ` ${s} ` });
      if (this.o.show !== 'v') {
        this.el.appendChild(line(h('span', { html: dudt('u') }), op('='),
          term('diff', '<i>D<sub>u</sub></i>∇²<i>u</i>'), op('−'), term('react', '<i>uv</i>²'), op('+'), term('feed', '<i>F</i>(1−<i>u</i>)')));
      }
      if (this.o.show !== 'u') {
        this.el.appendChild(line(h('span', { html: dudt('v') }), op('='),
          term('diff', '<i>D<sub>v</sub></i>∇²<i>v</i>'), op('+'), term('react', '<i>uv</i>²'), op('−'), term('decay', '(<i>F</i>+<i>k</i>)<i>v</i>')));
      }
      if (this.o.legend) {
        this.el.appendChild(h('div', { class: 'legend' }, Object.values(TERM_INFO).map((t) => h('span', { class: t.cls, text: t.name }))));
        if (this.o.interactive) this.el.appendChild(h('div', { class: 'legend muted', text: '項をクリックすると、オン・オフを切り替えられます' }));
      }
      this.refresh();
    }
    set(key, on) {
      this.terms[key] = on;
      this.refresh();
      this.o.onChange && this.o.onChange(this.terms);
    }
    refresh() {
      this.el.querySelectorAll('.term').forEach((s) => {
        const on = this.terms[s.dataset.term];
        s.classList.toggle('off', !on);
        s.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }
  }

  RD.TERM_INFO = TERM_INFO;
  RD.Equation = Equation;
})(window.RD = window.RD || {});
