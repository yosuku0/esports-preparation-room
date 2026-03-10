# riot-match-analyzer

Riot Games APIの生データをLLM向けに軽量化（Pruning）して返すMCPサーバーです。  
`get_player_profile` と `get_team_profile` の2ツールを提供します。

## 要件

- Node.js 18+
- Riot Developer API Key（`RIOT_API_KEY`）

## セットアップ

```bash
cd riot-match-analyzer
npm install
```

`.env` を作成してAPIキーを設定:

```env
RIOT_API_KEY=RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

> 開発者キーは24時間で失効するため、テスト前に必ず最新キーへ更新してください。

## ビルド / 起動

```bash
npm run build
npm start
```

起動時に以下を実施します:

1. `RIOT_API_KEY` の存在チェック
2. Data Dragonキャッシュ初期化（version/champion/item）
3. MCPサーバーをstdioで起動

## MCPツール

### 1) `get_player_profile`

- 入力: `gameName`, `tagLine`, `routingCluster`, `platformId?`
- 処理:
  - Riot ID→PUUID
  - 直近10試合ID取得
  - 10試合詳細を直列取得
  - 対象プレイヤー1名分のみ抽出・剪定
- 出力:
  - `recentMatches`（10件）
  - `summary`（champion pool, winrate, 平均KDA/CS/試合時間/vision）

### 2) `get_team_profile`

- 入力: `players`（5名固定）, `routingCluster`, `platformId?`
- 処理:
  - 各プレイヤープロファイルを順次取得
  - チーム集計（平均試合時間、時間帯別勝率）

## 前処理（Pruning）の主な仕様

- Match-v5の巨大JSONを対象プレイヤーの必要項目へ圧縮
- `item0~item6` からコアアイテム抽出（最大3件）
  - 除外: 空スロット、Boots/Consumable/Vision、素材（`into`あり）、`goldTotal < 2000`
- `csPerMin`、`gameDurationMin` は小数1桁で整形

## エラーハンドリング

- `RIOT_API_KEY` 未設定: 終了
- 404: `{ error: "Player not found", gameName, tagLine }`
- 429: `Retry-After` に従い自動リトライ
- ネットワークエラー: 最大3回リトライ
- Data Dragon初期化失敗: 起動中止

## 開発メモ

- マッチ詳細取得はレートリミット保護のため直列実行（`Promise.all`での全並列は不採用）
- レート制御は安全マージン付き（約16req/sec, 90req/2min）
