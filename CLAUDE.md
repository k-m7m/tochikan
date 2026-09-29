# CLAUDE.md

トチカン：東京の駅の位置と路線を、すごろくで遊びながら覚えるスマホ向けWebアプリ。

## 大事な文書

- 要件定義書：`docs/requirements.md`（仕様はここが正。決まったことはここに反映する）
- 作業の一覧：GitHub issue のロードマップ（#1）。工程ごとの親issueの下に作業がある

## 開発の約束ごと

- 文書、コメント、コミットメッセージ、issue、PRは日本語で書く。自然で短い日本語にする
- 実装はClaudeが担当し、作業ブランチからmainへPRを出す。mainに直接pushしない
- PRの本文には、対応したissueを `Closes #番号` の形で書く
- PRを出す前に、下の「チェック」をすべて通す

## コマンド

```sh
npm install          # 依存パッケージを入れる
npm run dev          # 開発用サーバーを起動する
npm run lint         # oxlint で静的解析する
npm run format       # prettier で整形する
npm run typecheck    # 型チェック
npm test             # vitest でテストする
npm run build        # 本番用にビルドする（出力先は dist）
```

## チェック（CIと同じ）

```sh
npm run lint && npm run format:check && npm run typecheck && npm test && npm run build
```

## 技術構成

- React + TypeScript + Vite
- 地図：MapLibre GL JS ＋ 国土地理院最適化ベクトルタイル（`src/map/style.ts`）。下地の地図には文字・線路・駅を出さない（答えが見えるため）
- MapLibre の worker は Vite でまとめ、`setWorkerUrl` で渡している（指定しないとビルド後に地図が出ない）
- 駅・路線データ：静的なJSON（`src/data`）。駅の並びは「隣の駅とのつながり」で持つ
- 進捗の保存：localStorage

## ディレクトリ

- `src/data`：駅・路線データと型
- `src/game`：すごろくのルールなど、画面に依存しない処理（テストを書く）
- `src/lib`：距離の計算など、汎用の処理
- `src/components`：画面の部品
- `src/map`：下地の地図のスタイル
