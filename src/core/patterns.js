// 模様のプリセット。値は tools/verify-params.mjs で検証済み（docs/param-report.md）。
(function (RD) {
  // dt = 1.0（Du×dt = 1 ちょうど）は反応の項が加わるとマス目状（市松模様）に振動して数百コマで壊れる。
  // dt = 0.8 なら Du は 1.2 まで安定（Du×dt < 1 を守る）。
  RD.SIM_DEFAULTS = { Du: 1.0, Dv: 0.5, dt: 0.8, size: 192 };
  RD.patterns = [
    {
      id: 'mitosis', name: '分裂する点', F: 0.037, k: 0.0645,
      // 点が2つに分かれながら増えていく。ただし画面がうまると（約8000コマ）止まって水玉と同じ見た目になる。
      kind: 'still',
      seed: 'random',
      steps: 6000,
      box: { fMin: 0.035, fMax: 0.039, kMin: 0.0637, kMax: 0.0648 },
      hint: '水玉より F も k も少しだけ大きくしてみましょう（F は 0.037、k は 0.0645 くらい）。点が2つに分かれて増えます。k を上げすぎるとウサギが全滅します。',
    },
    {
      id: 'spots', name: '水玉', F: 0.030, k: 0.062,
      kind: 'still',
      seed: 'random',
      steps: 4000,
      box: { fMin: 0.028, fMax: 0.033, kMin: 0.0616, kMax: 0.0628 },
      hint: 'F は 0.03 くらい、k は 0.062 くらいです。迷路より k を少し大きくすると、線がちぎれて点になります。',
    },
    {
      id: 'maze', name: '迷路', F: 0.029, k: 0.057,
      kind: 'still',
      seed: 'random',
      steps: 2500,
      box: { fMin: 0.0275, fMax: 0.0305, kMin: 0.0563, kMax: 0.0577 },
      hint: '水玉と同じくらいの F のまま、k を少し小さくしてみましょう。点がつながって線になります。',
    },
    {
      id: 'coral', name: 'サンゴ/しま', F: 0.0545, k: 0.062,
      kind: 'still',
      seed: 'center',
      steps: 10000,
      box: { fMin: 0.051, fMax: 0.058, kMin: 0.0613, kMax: 0.0627 },
      hint: 'F を大きめ（0.055 くらい）にして、種はまん中に1つだけ置きましょう。枝分かれしながら外へ広がります。',
    },
    {
      id: 'holes', name: '穴あき', F: 0.035, k: 0.0572,
      kind: 'still',
      seed: 'random',
      steps: 2000,
      box: { fMin: 0.034, fMax: 0.036, kMin: 0.0569, kMax: 0.0576 },
      hint: '迷路より F を少し大きく、k はほぼそのままにします。ウサギが一面に広がり、草の「穴」が点になって残ります。k を下げすぎると穴が消えて一面同じ色になります。',
    },
    {
      id: 'spiral', name: 'うずまき・波', F: 0.014, k: 0.0505,
      kind: 'live',
      seed: 'random',
      steps: 2000,
      box: { fMin: 0.012, fMax: 0.016, kMin: 0.049, kMax: 0.052 },
      hint: 'F をうんと小さく（0.014 くらい）、k は 0.05 くらいにします。三日月形の波が動き回り、端がくるっと巻きます。k を 0.047 より小さくすると波がぶつかって消えやすいです。',
    },
  ];
  // 教材用の特別な点（全滅・一様）
  // extinct: 数百コマでウサギが消え、草だけの一様な状態になる。
  // uniform: ウサギが画面全体に広がり、一面同じ色（v ≈ 0.47）で止まる。
  RD.specialPoints = { extinct: { F: 0.030, k: 0.070 }, uniform: { F: 0.060, k: 0.040 } };
})(window.RD = window.RD || {});
