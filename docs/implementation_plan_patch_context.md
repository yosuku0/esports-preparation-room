# Phase 2 Step 1 MCPサーバー設計プラン: patch-context

パッチノートの自動取得・解析を担当し、対戦準備ブリーフィング用の環境データ（バフ/ナーフの文脈等）を供給するMCPサーバー「patch-context」の設計プランです。
詳細なデータソースの調査結果および評価アプローチは、`docs/patch_source_analysis.md` に記載しています。

## サーバー基本情報
- **サーバー名**: `patch-context`
- **通信方式**: stdio
- **言語とランタイム**: TypeScript (Node.js)
- **主要依存ライブラリ**: 
  - `@modelcontextprotocol/sdk` (MCPコア)
  - `cheerio` (HTMLからテキストと構造を安全にパースするため)
  - `node-fetch` または組み込み `fetch`

## 公開するMCPツール (tools) の定義

### Tool 1: `get_current_patch`
- **概要**: Riot公式パッチノートページから最新（または指定）のパッチ情報を取得し、ブリーフィングレポートの推論に必要な変更内容（テキスト情報・数値・仕様変更等のコンテキスト）を抽出して構造化するツール。
- **入力パラメータ**:
  - `version` (string, optional): 指定したいパッチバージョン（例: "26.5", "14.4"）。未指定の場合は現行の最新パッチノートURLを自動推論（例: `https://www.leagueoflegends.com/en-us/news/game-updates/` 配下の最新一覧からフェッチ）。
- **処理解析の方針（MVP推奨: HTML抽出 → 正規表現/DOMベースJSON成形）**:
  1. Riot公式サイトのパッチノートのURLを構築・フェッチする。
  2. レスポンスのHTMLを `cheerio` にかけて、CSSクラス名（ハッシュ付きで脆い）に過度に依存せず、`h2`, `h3`, `h4`, `p`, `ul/li` などの**標準セマンティックタグ**を活用し、「Champions」「Items」等のセクションごとに要素リストを巡回・回収。
  3. 各チャンピオン名および変更内容（要約のpタグ、変更箇所のulタグ）を抽出し、定められたスキーマに沿ったJSON（`championChanges`, `itemChanges` 含む）としてメモリ上で組み立てる。
     - **`changeType` 判定の簡易ルール**: 変更テキストの矢印前後（例: `A ⇒ B` や `A -> B`）の数値を比較し、対象フィールドの性質（ダメージ・基本比率の増加＝buff、クールダウン・マナコストの増加＝nerf 等）に基づいて判定する。テキストが複雑で判定が難しい場合は `adjustment` にフォールバックする。
  4. 組み上がったJSONツリーを出力する。
    - **注記**: Client LLM (Antigravity/Cline) はこのJSONスキーマと対象プレイヤーデータ（`teamProfile`等）を交差させ、間接的な影響やメタ環境について事後推論を行う。
- **出力スキーマ**:
  ```json
  {
    "parseStatus": "full | partial | fallback",
    "patchVersion": "string",
    "patchDate": "string",
    "patchContext": "string",
    "championChanges": [
      {
        "championName": "string",
        "changeType": "buff | nerf | adjustment | new",
        "summary": "string",
        "details": "string"
      }
    ],
    "itemChanges": [ ... ]
  }
  ```

### Tool 2: `get_patch_diff` (実装スコープ外・将来用)
- **概要**: 2つの異なるパッチバージョン間でのチャンピオン/アイテムの変更点（差分）を抽出するツール。
- **入力パラメータ**:
  - `baseVersion` (string)
  - `targetVersion` (string)
- **出力**: `get_current_patch` と同様の形式だが、差分のみを返却。MVP構築では定義のみとし、実際の処理は `Not Implemented` 扱いとする。

## エラーハンドリング・フォールバック方針
- パッチノートのURLパターンが通常と異なる場合（大規模パッチ特設ページ等）でDOM抽出エラーが発生した場合は、生のパッチページMarkdown（`cheerio` で抽出したプレーンテキスト形式）を生成し、`parseStatus: "fallback"` として `patchContext` 等の汎用フィールドに生テキストを詰め込んでフォールバック返却する。これによりLLMの推論処理を完全にブロックさせない。
- 部分的なパースエラー（一部のチャンピオンだけ構造が特殊で取得できなかった等）が発生した場合は、取得できた要素のみを返却し、`parseStatus: "partial"` とする。
