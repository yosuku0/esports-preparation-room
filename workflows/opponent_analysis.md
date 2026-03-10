# ワークフロー: 対戦準備ブリーフィング生成

## 概要
このワークフローは、eスポーツの統計データ（LoL）から対象チームのモックデータと最新のパッチノートを読み込み、分析思考規則（ルール）に従って「対戦準備ブリーフィング」を生成するための手順である。

## 実行手順
// turbo-all
1. `rules/lol_analyst_rules.md` の内容を読み込み、分析のための思考規則をインプットする。
2. `mock_data/opponent_team.json` を読み込み、対象チーム（5名）の直近20試合の戦績データを把握する。
3. `mock_data/current_patch.json` を読み込み、最新のパッチ変更を把握する。
4. 以下の【推論ステップ】を順番に実行し、結果を【出力フォーマット】に従ってMarkdownで出力する。

## 推論ステップ（この順序を厳守）

### Step 0: 関連チャンピオン抽出と文脈剪定

#### Step 0-0: データ信頼度の評価
各プレイヤーについて、データの信頼度を以下の3軸で評価する。

**軸1: ロール一貫性 (role_consistency)**
10試合中、推定メインロールでプレイしている割合。
- 8試合以上: high
- 5〜7試合: medium
- 4試合以下: low

**軸2: チャンピオン集中度 (champion_concentration)**
最頻ピックの使用回数。
- 4試合以上: high
- 2〜3試合: medium
- すべて1試合ずつ: low

**軸3: ソロキュー＝対戦傾向の一致度 (soloq_relevance)**
- アマチュア/セミプロ: high
- プロ選手/配信者: low
- 不明: medium

総合判定: 3軸のうち最低の値を全体の信頼度とする。

信頼度がlowのプレイヤーについては：
- 強い断定を避ける
- 候補チャンピオン数をやや広げる（通常2〜3体 → 3〜4体）
- 「データの信頼度が低い。練習ピック混入の可能性あり」とブリーフィングに明記

#### Step 0-1: 段階A — 直接候補の収集
各プレイヤーのchampionPoolから候補を抽出する。

**採用ルール:**
- 使用回数2回以上 → 「コアピック」として自動採用
- 使用回数1回 + 勝率100% + KDAがプレイヤー平均以上 → 「ポケットピック候補」
- 使用回数1回（上記に該当しない）→ 候補に含めるがdanger_level: lowとして扱う

**ロール外ピックの扱い（重要：除外ではなくペナルティ）:**
- 使用回数2回以上 → ロール外でも残す（意図的な運用の可能性）
- 使用回数1回かつ勝率高い → 残すがdanger_level: lowに設定
- 使用回数1回かつ勝率低い → 候補リストからは外す。
  ただし完全無視ではなく、「ロール外ピックとして[ChampX]が1試合確認されたが、
  分析対象外とする」と注記する
- 直近2試合連続で同じロール外ピック → 仕込みの可能性があるため残す

5人合計で8〜15体を目安に収集する。

#### Step 0-2: 段階B — 戦略隣接の補完
段階Aのコアピックに対して、BAN/PICK判断に必要な隣接候補を追加する。
ただし各ロールの追加は最大2体まで。

**追加対象:**
1. コアピックの主要カウンター（あなたの既存知識から各1〜2体）
2. 同ロール・同クラスで今パッチの変更を受けたチャンピオン
   （LLMがpatch-contextのsummary/detailsを読み、
   「この変更の影響度は高い/中/低」と判定する。高のもののみ追加候補。
   注意：impactMagnitudeはpatch-contextの出力フィールドには存在しない。
   LLMが内容から判断すること）
3. 相手チームの構成で不足している役割を補う典型ピック

#### Step 0-3: 段階C — パッチ差分との照合

**チャンピオン変更の照合:**
get_current_patchの出力（championChanges）から、
段階A+Bの候補に該当する変更のみを抽出する。
それ以外のパッチ変更は無視する。

各該当チャンピオンに以下を付与する：

1. パッチ影響の方向: patch-contextのchangeTypeをそのまま使用
2. impact_magnitude: high/medium/low
   LLMがsummary/detailsから以下の基準で推定：
   - high: ゲームプレイが大きく変わるレベル
   - medium: 目に見える強さの変化
   - low: 微調整、QoL改善
3. meaning_tags: 以下から該当する1〜3個を選択
   レーン系: lane_power_up/down, waveclear_up/down, early_trade_up/down,
             all_in_up/down, roam_window_up/down, safety_up/down
   戦闘系: burst_damage_up/down, dps_up/down, survivability_up/down,
            gank_power_up/down
   マクロ系: teamfight_up/down, side_lane_up/down, objective_control_up/down,
              pick_threat_up/down, snowball_up/down
   ドラフト系: blind_pick_safety_up/down, ban_pressure_up/down
   スケーリング系: scaling_up/down, powerspike_earlier/later
   ビルド系: build_path_shift, item_dependency_up/down
4. danger_level: high/medium/low

**アイテム変更の照合:**
get_current_patchの出力（itemChanges）から、
段階A+Bの候補チャンピオンのcoreItems（riot-match-analyzerの出力）と
一致するアイテムの変更を抽出する。
該当する場合、そのチャンピオンにitem_dependency_up/downタグを追加する。

#### Step 0-4: パッチ信頼度の判定

以下の3要素から判定する。総合判定は3要素のうち最低値とする。

**要素1: 日数信頼度 (date_confidence)**
patchDateと今日の日付の差分。
- 2日以内: low
- 3〜7日: medium
- 8日以上: high

**要素2: 試合数信頼度 (sample_confidence)**
MVPではdate_confidenceと同値とする。
（将来match timestampを出力に追加した段階で正式対応）

**要素3: パース信頼度 (parse_confidence)**
patch-contextのparseStatusから判定。
- full: high
- partial: medium
- fallback: low

**ブリーフィングへの記載:**
- high: 「パッチ適用から十分な期間が経過。メタが安定。」
- medium: 「パッチ適用から数日経過。メタ適応は進行中。」
- low: 「パッチ適用直後、またはパース品質に制約あり。理論値に基づく推測。」

#### Step 0-5: 剪定済みコンテキストの構造化出力

以下の形式で整理する。この出力はStep 1以降の入力として使用する。
また、デバッグと再現性確認のためにこの出力をログとして残す。

```
=== Step 0 出力: 剪定済み関連チャンピオンコンテキスト ===

[メタ情報]
patch_version: (値)
patch_confidence: (総合値) (date: X, sample: X, parse: X)
analysis_date: (今日の日付)
total_candidates_before_pruning: (段階A+Bの合計数)
total_candidates_after_pruning: (最終数)

[プレイヤー信頼度]
Player1 (Role): reliability=X (role=X, concentration=X, soloq=X)
...

[コアピック（使用2回以上）]
Player1 (Role): ChampA (N試合, 勝率X%) [danger: X]
...

[ポケットピック候補]
Player2: ChampC (1試合, 勝率100%, KDA X) [danger: low]

[カウンター候補（段階Bで追加）]
ChampA → カウンター: ChampD, ChampE

[パッチ影響（該当チャンピオンのみ）]
ChampA: [changeType] impact=X, tags=[tag1, tag2]
  → 要約: "..."

[アイテム影響（該当コアアイテムのみ）]
ItemX: [changeType] → PlayerNのChampYに影響 (tag)

[ロール外ピック（分析対象外として記録）]
PlayerN: ChampZ (1試合, ロール外, 分析対象外)

[候補から除外したチャンピオン（理由付き）]
ChampW: danger_level=low, 候補数上限超過のため除外
```

**最終候補数の上限:**
- target_champions: 10〜12体（超過時はdanger_level: lowから削る）
- related_items: 4〜8個
- 各ロールから最低1体は残すこと

**Step 0完了後:** Step 1以降ではStep 0の出力に含まれるチャンピオンのみを分析対象とする。Step 0で「分析対象外」としたチャンピオンやパッチ変更には触れない。

---

### Step 1〜6: プレイヤーおよびチームの分析
1. 各選手のチャンピオンプールと勝率傾向を整理する
2. 直近10試合と過去10試合を比較し「最近の変化」を検出する
3. パッチノートと照合し、選手の主要ピックへの影響（直接的および間接的）を評価する
4. 個別選手の分析結果に基づき、チーム全体の傾向（試合時間の長短による序盤型/後半型の判定、勝ち筋や編成傾向など）を推論する
5. ルールに従い、BAN/PICK仮説、警戒ポイント、狙い目を生成する
6. 以下のフォーマットで出力する

## 出力フォーマット
```markdown
## 対戦準備ブリーフィング: vs [チーム名]
### データ概要
- 分析対象: [チーム名]（5名）
- データ範囲: 直近20試合
- 現行パッチ: [バージョン]
- 信頼度に関する注記（サンプルサイズについての言及等）

### 各ロール分析
#### Top: [サモナーネーム]
- チャンピオンプール評価
- 最近の変化（あれば）
- パッチ影響（間接的影響含む）

#### Jungle: [サモナーネーム]
...

#### Mid: [サモナーネーム]
...

#### ADC: [サモナーネーム]
...

#### Support: [サモナーネーム]
...

### チーム傾向
- 試合時間傾向・得意な時間帯
- チーム編成傾向・勝ちパターン（推論）

### パッチ影響サマリー
- 追い風を受けているポイント
- 向かい風を受けているポイント

### 推奨BAN（優先順）
1. [チャンピオン名] — 理由
2. [チャンピオン名] — 理由
3. [チャンピオン名] — 理由

### 警戒ポイント
- （試合中に特に注意すべき相手の強み・編成シナジー）

### 狙い目
- （相手の弱点・プール崩壊の隙・突きどころ）
```
