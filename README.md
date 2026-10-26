# 草とウサギで模様をつくる ―― 反応拡散ドリル

中学数学レベルの人が、反応拡散方程式（Gray-Scott モデル）を理解して、好きな模様を作れるようになるための HTML ドリルです。

## ドキュメント

- [仕様書](docs/spec.md)：決定事項、章構成、画面、技術
- [教材の材料集](docs/teaching-materials.md)：つまずきポイント（T）、たとえ話（A）、説明の仕掛け（M）
- [デザインと雰囲気](docs/design.md)：見た目、言葉づかい、動き、ゲームっぽさの度合い
- [開発計画](docs/dev-plan.md) / [章を書くための手引き](docs/chapter-guide.md)

## 使い方

- `dist/index.html` をブラウザで開くだけで動きます（1ファイル、外部依存なし、オフライン可）。
- GitHub Pages：`main` に push すると `.github/workflows/pages.yml` がテストとビルドをして公開します。

## 開発

```bash
node build.mjs          # src/ → dist/index.html
npm test                # エンジンと各章の問題の答えを検算
npm run smoke           # ブラウザで全ページを開いてエラーと横はみ出しを確認（Playwright が必要）
```
