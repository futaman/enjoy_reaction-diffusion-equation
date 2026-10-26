# 章を書くための手引き

章担当（人もエージェントも）向けの手引きです。まず [spec.md](spec.md)（自分の章）、[design.md](design.md)（雰囲気と言葉づかい）、[teaching-materials.md](teaching-materials.md)（T / A / M の材料）、[dev-plan.md](dev-plan.md) を読んでください。お手本は `src/chapters/prologue.js` です。

## 書いてよいファイル

- `src/chapters/<自分の章>.js`
- `tests/<自分の章>.test.mjs`（問題の答えの自動検算）

core（`src/core/*`、`src/styles/base.css`、`build.mjs`）は**変更しない**でください。足りない機能があるときは、まず章のファイルの中で小さく作ります。それが core にあるべきものなら、報告に書いてください（統括が取り込みます）。章専用の見た目は、章のファイルの中で `<style>` 要素を1つ作って root に入れて構いません。その場合、クラス名には章の接頭辞（`ch3-` など）を付けます。

## 章の骨組み

```js
(function (RD) {
  const { h, p, step, note, more, teacher, card, math, mathBlock, frac, dudt, fmt } = RD.ui;
  RD.registerChapter({
    id: 'ch3', no: 3, title: '拡散（1列のマス）',
    desc: 'トップに出す1行説明',
    goal: 'この章のねらい（HTML 可）',
    required: 4,                      // クリアに必要な正解数
    render(root, ctx) {
      root.appendChild(step({ title: '…', text: [p('…'), note('…')], demo: [card('デモ', …)] }));
      root.appendChild(ctx.quiz({ id: 'q1', type: 'number', q: '<p>…</p>', answer: 13.5, hints: ['…', '…', '…'], explain: '<p>…</p>' }));
      root.appendChild(teacher('<p>…</p>'));
    },
  });
})(window.RD = window.RD || {});
```

- 1ページは「ステップ（`step`）」の積み重ねです。`demo` を渡すと、PC では左に解説、右にデモの2カラムになります。スマホでは縦に並びます。
- 問題は、関係するステップの直後に置きます。問題の `id` は章の中で一意にし、**あとから変えない**でください（進み具合の記録に使うため）。
- `required` は、仕様書のクリア条件に合わせます。予想問題（predict）も、観察すれば正解として数えます。

## core の API（詳しくは各ファイルの先頭コメント）

| 用途 | API |
|---|---|
| DOM | `h(tag, props, ...children)`、`p(html)`、`note(html, kind)`（kind: `''` / `'story'` / `'warn'` / `'mystery'`）、`more(title, ...)`、`teacher(...)`、`card(title, ...)` |
| 式 | `math(html)`（インライン）、`mathBlock(html)`、`frac(上, 下)`、`dudt('u')`（∂u/∂t の分数 HTML）。項の色は `<span class="t-diff">` などで付ける |
| 操作 | `RD.ui.button(label, onClick, {primary, small})`、`slider({label, min, max, step, value, format, onInput})`、`toggle(label, checked, onChange)`、`segmented(options, value, onChange)`、`numGrid({values, editable, color, highlight, onCellClick, format})` |
| 数値 | `RD.ui.parseNum(str)`（全角や − も可）、`fmt(v, digits)` |
| エンジン | `new RD.Sim({w, h, Du, Dv, F, k, dt, terms})`。`step(n)`、`breakdown(i)`（家計簿の値）、`seed(style)`、`seedSquare`、`paint`、`reset`、`setParams`、`snapshot` / `restore`、`stats()`、`exploded` |
| 表示 | `new RD.FieldView(sim, {field, palette, range, brush, onPick, maxPx, hiLabel, readout})`（readout は true / false / `(i) => HTML`）、`new RD.BarView({get, min, max, color, labels, highlight, onPick, refLine, width})`（labels: `'wide'` で幅 560px 以上のときだけ値を表示）、`new RD.TimeGraph({series, ymin, ymax, maxPoints})` |
| 再生 | `new RD.Runner({sim, onFrame, onStep, onReset, onExplode, speeds, speed, autoplay, timeLabel})`。`.el` が再生バー、`.setEnabled(false)` でボタンを無効化、`.setSpeed(i, speeds?)`、`stopWhen(sim)` と `onStop(reason)` で条件停止。sim は `step(n)`・`steps`・`exploded` を持つ自作モデルでもよい。ページを離れると自動で止まる |
| 家計簿 | `new RD.Ledger({sim, index, show})`、`.show(i)`、`.update()` |
| 式（色分け） | `new RD.Equation({sim, interactive, show, onChange})`（項クリックで `sim.terms` を切り替え） |
| 問題 | `ctx.quiz(spec)`。種類は choice / predict / number / grid / match / fill / custom（`src/core/quiz.js` 先頭） |
| その他 | テーマ切り替え時に `window` へ `rd-theme` イベント（独自に描いた図はこれで描き直す）、`ctx.useCalc()`（電卓）、`ctx.onCleanup(fn)`、`ctx.params`、`ctx.markCleared()`、`RD.ui.toast(msg)`、`RD.patterns`、`RD.SIM_DEFAULTS`、`RD.collection` |

## エンジンの約束

- ∇²u ＝「まわりの平均 − 自分」。2次元は上下左右4マス、1次元は左右2マス、端はパックマン型。
- 安定条件は D × dt ≤ 1。ただし2次元で D × dt = 1 ちょうどだと、マス目状に振動して壊れます。既定値は `RD.SIM_DEFAULTS`（Du = 1.0、Dv = 0.5、dt は 1 未満）を使ってください。
- 拡散だけのデモ（u だけ使う）は、`terms: { feed: false, react: false, decay: false }` にします。u には好きな値（10 や 20 など）を入れて構いません。
- 1ページに2次元のシミュレーションを何個も置くと重くなります。章の中の2次元デモは 64〜128 マス四方にしてください。画面外にある Runner は自動で止まります。

## 文章のルール

- です・ます調で、中学生に話しかけるように書きます。1段落は短く。難しい言葉には、すぐ後ろで言い換えを付けます。
- メインのたとえは「草（u）とウサギ（v）」で、最後まで崩しません。Fv（ウサギも流される）だけは、水槽のかけ流しで補足します。
- 新しい記号は、その章で初めて出るものだけ導入します。先の章の記号は使いません（spec.md の章構成を参照）。
- 問題の誤答の選択肢には、teaching-materials.md の誤解（T…）を仕込み、`why` でなぜ違うのかを返します（M09）。
- ヒントは3段階です。1つ目で考え方の向き、2つ目で途中の式、3つ目でほぼ答えの手前まで出します。数値問題には `answerText` も付けます。
- 先生用メモ（`teacher`）には、扱うつまずき ID、問いかけの例、よくある反応を書きます。

## 確かめ方

```bash
# 自分の章だけを含むビルド（ほかの章の作業とぶつからないよう、出力先を分ける）
node build.mjs --out tmp/ch3/index.html --chapters ch3,ch4
node tests/smoke.mjs --file tmp/ch3/index.html --shots tmp/ch3/shots ch3 ch4
node --test tests/ch3.test.mjs
```

- smoke はコンソールエラーと、横幅 360px での横はみ出しを調べ、スクリーンショットを出力します。**スクリーンショットは必ず自分の目で見て**、崩れていないか確認してください（Read ツールで画像を見られます）。
- 問題の正解は、テストで `RD.Sim` の計算と突き合わせます（`tests/helpers.mjs` の `loadCore`）。手計算の答えとシミュレーションの答えがずれていないことが大事です。
- `dist/` と `tests/out/` には書き込まないでください（統括が使います）。
