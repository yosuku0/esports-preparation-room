# Phase 1 Step 2: Riot API MCPサーバー実装指示書 (for Cline / Agent)

## 概要
Phase 1 Step 1にて設計承認された「riot-match-analyzer」MCPサーバーの実装プロンプトです。本ドキュメントを読み込み、Riot APIを利用したMCPサーバーを TypeScript で実装してください。

## プロジェクト仕様

### 1. サーバー基本設定
- **プロジェクト名**: `riot-match-analyzer`
- **フレームワーク**: TypeScript, `@modelcontextprotocol/sdk`
- **通信方式**: `stdio`

### 2. 環境変数
- `.env` ファイルに `RIOT_API_KEY` を設定して読み込む設計とすること。
- （Clineへの指示：実装後にユーザーへ発行手順を案内、もしくはテスト用にダミーを入れて実装を進めること）

### 3. Data Dragon メモリキャッシュと初期化
サーバー起動時（または初回リクエスト時）に以下のData Dragon APIからJSONを取得し、メモリ上でマッピング表を保持すること。
1. **バージョン**: `https://ddragon.leagueoflegends.com/api/versions.json` (配列の0番目が最新)
2. **チャンピオン**: `https://ddragon.leagueoflegends.com/cdn/{最新バージョン}/data/en_US/champion.json`  
   （`key` または `id` からチャンピオン名を取得できるようにする）
3. **アイテム**: `https://ddragon.leagueoflegends.com/cdn/{最新バージョン}/data/en_US/item.json`  

### 4. コアアイテム抽出ロジック（前処理）
Match-v5の `item0` 〜 `item6` に格納されているアイテムIDリストをData Dragonのデータと照らし合わせ、以下を「除外」したうえで完成アイテム名のみを配列として抽出する関数を実装すること。
- **除外条件**:
  - `tags` 配列に `Boots`, `Consumable`, `Vision` が含まれている
  - `into` フィールドが存在する（他の上位アイテムの素材である）
  - `gold.total` が一定額（例: 2000未満 等。ただしサポートアイテムの最終形態など例外を考慮すること）

### 5. 公開するMCPツール

#### Tool 1: `get_player_profile`
- **入力パラメータ**:
  - `gameName` (Riot ID 名)
  - `tagLine` (Riot ID タグ)
  - `routingCluster` (クラスターリージョン: "americas", "asia", "europe", "sea"等)
  - `platformId` (プラットフォーム: "na1", "jp1"等。将来用なので `optional` とすること)
- **処理**:
  1. `Account-v1` (`/riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}`) で `puuid` を取得。
  2. `Match-v5` (`/lol/match/v5/matches/by-puuid/{puuid}/ids?count=10`) で直近 **10試合** のIDを取得。
  3. ループ（またはレートリミットを考慮したPromise.all）で10試合の各種詳細を `Match-v5` から取得。
  4. 当該プレイヤーを `participants` の中から抽出し、以下のように剪定（Pruning）したオブジェクトを作る。
- **出力スキーマの要件（1試合あたり）**:
  - `championName` (Data Dragonで変換された名前)
  - `win` (boolean)
  - `kda` ("K/D/A" の文字列化)
  - `core_build` (前述のコアアイテム抽出ロジックを通した配列)
  - `cs_per_min` (ミニオンキル＋中立モンスター合算 / 分単位の試合時間)
  - `duration` (試合時間、分単位)
  - `visionScore`

#### Tool 2: `get_team_profile`
- **入力パラメータ**:
  - `players` (配列: `{ gameName: string, tagLine: string }` x 5名)
  - `routingCluster` (クラスターリージョン)
  - `platformId` (optional)
- **処理**:
  - 上記の 5名分のプレイヤープロファイル取得を直列または一定待機を挟みながら実行する。
  - **レートリミット制約**: 開発者キー（100 req / 2min）の上限を1発で超えないよう、PUUID(5)＋MatchList(5)＋MatchDetail(50) = 60リクエスト に収束する設計とする。
  - 5名分の戦績から、チーム全体としての「平均試合時間」「勝利時/敗北時の平均時間」を統計として付与する。
- **出力スキーマ**:
  - プレイヤー個別の情報を格納した配列と、チーム統計データを統合した JSON。

### 6. エラーハンドリング
- `429 Too Many Requests` エラー時は `Retry-After` を確認してExponential Backoffを実装。
- `404 Not Found` 時は、サモナー未発見として有益なエラーメッセージを返す。
