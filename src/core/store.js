// 進み具合・コレクション・設定の保存。localStorage が使えなくても動く（メモリに保持）。
(function (RD) {
  const PREFIX = 'rd-drill:';
  const mem = {};

  function get(key, def) {
    try {
      const s = localStorage.getItem(PREFIX + key);
      if (s != null) return JSON.parse(s);
    } catch (e) { /* 使えない環境 */ }
    return key in mem ? mem[key] : def;
  }
  function set(key, val) {
    mem[key] = val;
    try { localStorage.setItem(PREFIX + key, JSON.stringify(val)); } catch (e) { /* 容量超過など */ }
  }
  function remove(key) {
    delete mem[key];
    try { localStorage.removeItem(PREFIX + key); } catch (e) { /* noop */ }
  }

  // 進み具合: { [chapterId]: { solved: [quizId...], cleared: bool } }
  const progress = {
    all() { return get('progress', {}); },
    of(ch) { const p = this.all()[ch]; return p ? { solved: p.solved || [], cleared: !!p.cleared } : { solved: [], cleared: false }; },
    isSolved(ch, qid) { return this.of(ch).solved.includes(qid); },
    markSolved(ch, qid) {
      const all = this.all();
      const p = all[ch] || (all[ch] = { solved: [], cleared: false });
      if (!p.solved.includes(qid)) p.solved.push(qid);
      set('progress', all);
    },
    setCleared(ch) {
      const all = this.all();
      const p = all[ch] || (all[ch] = { solved: [], cleared: false });
      p.cleared = true;
      set('progress', all);
    },
    reset() { remove('progress'); remove('collection'); remove('last'); },
  };

  // コレクション: [{ id, name, F, k, Du, Dv, palette, thumb, source, date }]
  // source: 'challenge'（第7章で再現した模様。id は模様の id）| 'lab'（自作）
  const collection = {
    list() { return get('collection', []); },
    has(id) { return this.list().some((c) => c.id === id); },
    add(item) {
      const list = this.list().filter((c) => c.id !== item.id);
      list.push(Object.assign({ date: Date.now() }, item));
      // サムネイルが大きくなりすぎないように上限を設ける
      while (list.length > 60) list.shift();
      set('collection', list);
    },
    remove(id) { set('collection', this.list().filter((c) => c.id !== id)); },
  };

  RD.store = { get, set, remove };
  RD.progress = progress;
  RD.collection = collection;
})(window.RD = window.RD || {});
