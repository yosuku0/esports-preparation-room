# Riot API 調査結果およびデータ構造分析

## 1. Riot Games Developer Portalの調査まとめ

### 開発者キー (Development API Key) とプロダクションキー (Production API Key)
- **開発者キー**:
  - 用途: プロトタイピングや初期開発用。公開プロダクトでの利用は規約違反。
  - 有効期限: 24時間で失効するため、Developer Portalで定期的な再発行が必要。
  - レートリミット:
    - 20 リクエスト / 1秒
    - 100 リクエスト / 2分
- **プロダクションキー**:
  - 用途: 公開アプリケーション用。審査に通過したプロジェクトに付与される。
  - 有効期限: なし（無期限だが利用規約違反でBlacklist化される可能性あり）。
  - レートリミット (初期枠):
    - 500 リクエスト / 10秒
    - 30,000 リクエスト / 10分

### 用途と規約上の注意
- APIから取得したデータをそのままユーザー定義の二次配布データベースとして公開することは禁止されていますが、加工された独自の統計や分析結果の提供は許可要件を満たします。

---

## 2. 必要なAPIエンドポイントの特定

Phase 0のブリーフィングレポートの生成に必要なデータをRiot APIから取得するためのエンドポイント一覧です。
※ Summoner Name (サモナー名) ベースのAPIは既に非推奨・廃止へ向かっており、現在はRiot ID (`gameName` + `tagLine`) を用いてPUUIDを取得する `Account-v1` への移行が必須です。

### ① Riot IDからPUUIDへの変換
- **API**: Account-v1
- **Endpoint**: `/riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}`
- **URL例**: `https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/SolidRock/NA1`
  - ※ Account APIはリージョン（na1やjp1等）ではなくクラスター層（americas, asia, europe 等）で取得します。
- **レスポンス主要フィールド**: `puuid`, `gameName`, `tagLine`
- **リクエスト量**: 約200 bytes

### ② 直近20試合のマッチID一覧取得
- **API**: Match-v5
- **Endpoint**: `/lol/match/v5/matches/by-puuid/{puuid}/ids`
- **パラメータ**: `count=20` (デフォルトは20)
- **URL例**: `https://asia.api.riotgames.com/lol/match/v5/matches/by-puuid/{puuid}/ids?count=20`
- **レスポンス主要フィールド**: マッチIDの文字列表配列 (例: `["KR_123456789", "KR_123456790"]`)
- **リクエスト量**: 約300 bytes

### ③ 各試合の詳細情報取得
- **API**: Match-v5
- **Endpoint**: `/lol/match/v5/matches/{matchId}`
- **URL例**: `https://asia.api.riotgames.com/lol/match/v5/matches/{matchId}`
- **レスポンス主要フィールド** (ブリーフィングに必要なもののみ抽出):
  - `info.gameDuration` (秒単位の試合時間)
  - `info.participants` 配列の内、対象PUUIDと一致するプレイヤーの要素:
    - `championName` (チャンピオン名)
    - `win` (勝敗フラグ)
    - `kills`, `deaths`, `assists` (KDA)
    - `item0` ~ `item5` (ビルド要素のアイテムID)
    - `totalMinionsKilled`, `neutralMinionsKilled` (CSの合算)
- **リクエスト量**: 1試合あたり非常に巨大（約30KB〜50KB）。これをそのままLLMに20試合分渡すとコンテキスト圧迫の原因となる。

### ④ 補足: チャンピオンマスタリー取得
- **API**: Champion-Mastery-v4
- **Endpoint**: `/lol/champion-mastery/v4/champion-masteries/by-puuid/{puuid}`
- **レスポンス主要フィールド**: `championId`, `championPoints`, `championLevel`
- **用途**: チャンピオンプールの深さを裏付ける補助指標として利用可能。

---

## 3. 実データとモックデータの差分分析

Phase 0のモックJSON (`opponent_team.json`) とRiot APIの実データレスポンスを比較した際の差分および課題は以下の通りです。

### ① モックにあったがAPIには直接存在しないフィールド
- **「コアビルド3つ」という文字列配列**:
  - *モック*: `["Kraken Slayer", "Infinity Edge"]`
  - *実データ*: `item0` から `item6` に格納された「アイテムID」（例: 3031 など）で返ってきます。アイテムIDからアイテム名への変換処理（Data Dragonからのスタティックデータ参照）が必要ですし、靴やポーション等のノイズから「コアアイテム」だけを抽出するロジックが必要です。
- **「KDAの文字列表現」と「CS/分」**:
  - *モック*: `"kda": "6/2/8"`, `"cs_per_min": 8.5`
  - *実データ*: `kills`, `deaths`, `assists`, `totalMinionsKilled` + `neutralMinionsKilled`, `gameDuration` が別々に返るため、MCP内部での文字列化とCS/分への加工（前処理）が必要です。
- **「マッチ結果 (Win/Loss)」**:
  - *モック*: `"Win"` または `"Loss"` の文字列。
  - *実データ*: `true` / `false` のブール値 (`win`)。

### ② APIには存在するがモックには存在しなかった有用なフィールド
- **ビルドの購入タイミング推移**: `Match Timeline API`（Match-v5群の一部）を使えば、時間ごとのビルド進行が取れる機能がありますが、要件外のため除外。
- **その他の詳細情報**: `visionScore`（ワード設置・破壊）, `totalDamageDealtToChampions`（ダメージ内訳）, `damageDealtToObjectives`（オブジェクトダメージ）。チャンピオンプールやKDA以外のプレイヤーの特性（視界管理の意識や火力貢献度など）をLLMに推論させる場合に有用です。

### ③ 前処理が必要な箇所のまとめ（LLMに渡す前に削る・加工するべきもの）
- **試合時間の単位変換**: APIの `gameDuration` はパッチによってミリ秒や秒で返るため、安全に「分」へ変換すること。
- **巨大JSONの剪定（最も重要）**: Match APIのレスポンスは参加者10名分の全ルーン構造やピンの回数などを含む超巨大なペイロードです。20試合分をそのままLLMに投げるとコンテキストウィンドウを即座に食い潰します。そのため、対象プレイヤー（1名分）の必要フィールド（KDA, CS, 勝敗, チャンピオン名, コアアイテム名）だけを抽出・要約した軽量JSONを生成してからLLMに返す「剪定（Pruning）処理」がMCPサーバーに必須となります。
