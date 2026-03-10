# patch-context

Riot公式パッチノート（League of Legends）を取得し、LLM向けの構造化JSONへ変換するMCPサーバーです。

## 機能

- `get_current_patch`
  - 指定バージョン（例: `26.5`）のパッチノートを取得
  - Champions / Items セクションを抽出
  - `changeType`（buff/nerf/adjustment/new）を簡易判定
  - `PatchData` JSONを返却

- `get_patch_diff`
  - 将来実装予定（現状は Not implemented を返却）

## セットアップ

```bash
cd patch-context
npm install
npm run build
```

## 起動

```bash
npm start
```

## テスト

```bash
node scripts/test_get_patch.mjs 26.5
node scripts/test_get_patch.mjs 99.99
```

## 出力フォーマット

`src/types.ts` の `PatchData` を返却します。

- `parseStatus`: `full | partial | fallback`
- `patchVersion`
- `patchDate`
- `patchContext`
- `championChanges[]`
- `itemChanges[]`

## 実装方針

- CSSクラス名には依存せず、`h2/h3/h4/p/ul/li` のセマンティック構造を使用
- パース不能時は `fallback` でプレーンテキストを返却
- `changeType` が曖昧な場合は `adjustment` にフォールバック
