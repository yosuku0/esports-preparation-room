# Phase 2 Step 2: patch-context MCPサーバーの実装
# 対象: Cline等の実装エージェント

## 背景と目的
Phase 2の全体目標は、対戦準備ブリーフィングレポートの生成において手動で行っていた「パッチデータの作成」を自動化することです。
Step 1の調査設計フェーズにて、Riot公式パッチノート（HTML）から変更情報を取得し、MCP内でJSONスキーマとして構造化して返すアプローチ（cheerioを用いたタグ/要素単位のスクレイピング）がMVPとして採用されました。

この設計に基づき、新たなMCPサーバー `patch-context` をTypeScriptで実装してください。

## 参照すべきドキュメント
実装前に以下のドキュメントを必ず確認し、設計意図と出力スキーマ仕様を完全に理解してください。
1. `docs/patch_source_analysis.md` （全体像と出力JSONスキーマの定義。特に `parseStatus` と `changeType` の判定ルールを確認すること）
2. `docs/implementation_plan_patch_context.md` （サーバーの実装方針、エラーハンドリング・フォールバック仕様）

## 実装要件

### 1. プロジェクトの初期設定
- 場所: `patch-context` ディレクトリをワークスペース直下（`riot-match-analyzer`の並び）に新規作成
- 依存関係: `@modelcontextprotocol/sdk`, `cheerio`, `typescript`, `tsx`（またはビルド用の `tsc` 環境）
- `package.json` を適切に設定し、`npm run build` と `npm start` で起動できるようにする

### 2. ツールの実装
以下のツールを実装してください。
- **Tool 1: `get_current_patch`**
  - 入力: `{ "version": "string" }` (任意。指定がない場合は通常URL `https://www.leagueoflegends.com/en-us/news/game-updates/` の一覧等から最新パッチのURLを推測・フェッチするか、固定の現行最新パッチを対象とする)
  - 処理:
    - 指定された（または最新の）パッチノートページをfetch
    - `cheerio` でDOMを読み込み、チャンピオンやアイテムの変更部分（h2/h3の見出しを起点としたセクション分割）を探索
    - 各チャンピオン・アイテムの要約テキスト、詳細変更リストを抽出
    - `changeType`（buff, nerf, adjustment, new）を**簡易判定ルール**（矢印前後の数値比較やテキストの意味）に従って推論・設定
  - 出力: `docs/patch_source_analysis.md` で定義されたJSONフォーマット

- **Tool 2: `get_patch_diff`**
  - 本番処理は未実装で構いません。入力を受け取り「将来実装予定」として適切なダミー応答を返すモックとしてのみ定義しておいてください。

### 3. フォールバック・エラーハンドリング（必須要件）
実装計画書に定められた通り、HTMLの構造が特殊・複雑な場合でもLLMの流れを止めないフォールバックの実装が必須です。
- 完全にパースできた場合: `parseStatus: "full"`
- 一部のチャンピオンでパースに失敗した場合: パースできたものだけをリストに入れ `parseStatus: "partial"`
- ページ構造が全く想定と異なりパース不能な場合: HTML全体をテキスト化等で要約して `patchContext` に詰め込み `parseStatus: "fallback"` として返す

## 成果物
- `patch-context` フォルダおよびその中のTypeScriptソースコード（`src/index.ts` 等）一式
- 起動に必要な `package.json` と `tsconfig.json`
- 単体でテスト実行可能な手元用の動作確認スクリプト（例: `scripts/test_get_patch.mjs`）

この実装が完了し動作確認できたら、ユーザーへ完了報告を行ってください。
