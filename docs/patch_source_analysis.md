# パッチノート自動取得: データソース調査と実装設計

## 1. パッチノートのデータソース候補の比較

### 候補A: Riot公式パッチノートページ（HTML解析）
- **長所**: 最も公式で情報量が多い。開発者の意図（Buff/Nerfの理由など）やメカニクス変更の文脈（Context）がリッチに含まれているため、Phase 1で実証した「間接的影響の推論」に不可欠な情報が揃う。
- **短所**: HTMLの構造（DOMツリー、クラス名）が運用時期やパッチごとに変更されるリスクが高く、継続的なパース処理のメンテナンスコストがかかる。
- **評価**: MCPサーバー単体でJSON構造化を完結させる場合、パーサーの脆さが課題になる。

### 候補B: Data Dragon のバージョン差分
- **長所**: 静的なJSONファイル同士を比較するため、プログラム的には極めて安定しており、HTMLパースのような脆さがない。
- **短所**: HPやダメージといったステータスの数値差分は取れるが、「スキルの仕様変更（QoL改善など）」「新しいメカニクスの追加」「変更の文脈・目的」といったテキスト情報が欠落する。
- **評価**: ブリーフィングにおける深い推論（なぜその変更が行われたか、誰に影響するか）に必要なコンテキストが不足するため不適格。

### 候補C: コミュニティ提供のパッチデータAPI (Wiki 等)
- **長所**: 構造化済みデータであり、テキスト的文脈も一部保たれている可能性がある。
- **短所**: 非公式かつ安定稼働の保証がない。利用規約の壁や仕様変更のリスクがある。
- **評価**: メインのシステム基盤として依存するにはリスクが高い。

### 候補D: 公式パッチノートHTML + LLMによる構造化（ハイブリッド）
- **長所**: HTML構造の変化に対する耐性が極めて高い。MCPサーバーは単純にDOMからテキストを抽出し、LLMが文脈を汲み取ってJSON化するため、メンテナンスフリーに近い。
- **短所**: MCPサーバー単体で「指定スキームのJSON」を直接返却することが難しくなる（クライアント側LLMの出力に委ねるか、追加のLLM API呼び出しがサーバー内で必要になる）。

### MVP推奨アプローチ: 「候補AとDの折衷案（MCPサーバー内でMarkdown抽出＋JSON成形）」
**推奨アプローチ**: MCPサーバーは「候補A」として公式HTMLを取得するが、HTMLタグのクラス名への過度な依存を避ける。`cheerio` 等を使用してHTML全体を軽量なMarkdownテキスト（またはプレーンテキスト）に変換した上で、MCPサーバー内部で軽量な構造化抽出（正規表現や見出しベースの分割）を実施し、指定されたJSONスキーマとして返す。これにより「公式データのフルコンテキスト利用」と「Tool出力のJSONスキーマ遵守」を両立する。

---

## 2. Riot公式パッチノートのHTML構造

パッチ14.4等の実際のHTMLデータを解析した結果、以下の傾向が確認された。
- **動的クラス名の使用**: 最新のRiotウェブサイトはSSR/SSG（React等）を採用しており、`<h3 class="style__Title-sc-...">` のように動的生成されたハッシュ付きクラス名が多用されている。そのため、特定の固定クラス名（例: `change-title`）に依存したスクレイピングは高確率で失敗する。
- **見出し（Heading）階層による構造**: 
  - 大見出しとして `h2` または `h3` が使用され、「Champions」「Items」等のセクションが分かれている。
  - 各チャンピオン名やアイテム名はさらに下位のヘッディング（`h3` または `h4`）で定義されている。
  - 変更箇所（サマリーと詳細リスト）は `<ul>` / `<li>` および `<p>` で記述されている。
- **構造の安定性**: クラス名は脆いが、「H2でセクション開始 -> H3/H4でチャンピオン名 -> 直下にul/liの変更内容」というセマンティックなHTML構造自体はパッチ間で比較的安定している。

---

## 3. 出力スキーマの定義 (patch-context MVP)

Phase 1テストで使用したJSONフォーマットに基づき、MCPサーバーがパースして返却すべきJSONスキーマを以下のように定義する。LLM側で行う推論項目（affectedPlayers, impactAssessment）は除外している。

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "parseStatus": {
      "type": "string",
      "enum": ["full", "partial", "fallback"],
      "description": "JSON解析の成功度。完全にパースできた場合はfull、一部エラーをスキップした場合はpartial、パースを諦めpatchContextにプレーンテキストを出力した場合はfallbackとする"
    },
    "patchVersion": {
      "type": "string",
      "description": "パッチバージョン (例: '14.4', '26.5')"
    },
    "patchDate": {
      "type": "string",
      "description": "パッチの公開日または適用日"
    },
    "patchContext": {
      "type": "string",
      "description": "パッチの全体的な文脈やハイライトの要約"
    },
    "championChanges": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "championName": { "type": "string" },
          "changeType": { 
            "type": "string",
            "enum": ["buff", "nerf", "adjustment", "new"],
            "description": "パース判定ルール: 矢印前後(→ / ⇒)の数値を比較し、ダメージや比率の増加ならbuff、CDやコストの増加ならnerfとする。判定が複雑または曖昧な場合はadjustmentにフォールバックする。"
          },
          "summary": { "type": "string", "description": "変更の全体的な要約" },
          "details": { "type": "string", "description": "具体的な数値変更やスキルの調整内容詳細" }
        },
        "required": ["championName", "changeType", "summary", "details"]
      }
    },
    "itemChanges": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "itemName": { "type": "string" },
          "changeType": { 
            "type": "string",
            "enum": ["buff", "nerf", "adjustment", "new"],
            "description": "パース判定ルール: 矢印前後(→ / ⇒)の数値を比較し、ダメージや比率の増加ならbuff、CDやコストの増加ならnerfとする。判定が複雑または曖昧な場合はadjustmentにフォールバックする。"
          },
          "summary": { "type": "string" },
          "details": { "type": "string" }
        },
        "required": ["itemName", "changeType", "summary", "details"]
      }
    }
  },
  "required": ["parseStatus", "patchVersion", "championChanges", "itemChanges"]
}
```
