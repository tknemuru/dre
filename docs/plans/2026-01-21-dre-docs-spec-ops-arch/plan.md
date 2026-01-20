# Plan: DRE ドキュメント再構成（spec / ops / arch）

## Summary

DRE リポジトリの docs 配下を spec / ops / arch の3責務に分離し、setup.md の内容を統合・廃止する。

## 現状分析

### 既存ドキュメント

| ファイル | 現状の内容 |
|----------|-----------|
| `docs/setup.md` | セットアップガイド（What + How 混在） |
| `docs/ops.md` | 運用ガイド（概ね How 責務だが、パイプライン概要など What 混在） |
| `docs/windows-task-scheduler.md` | Windows 固有の運用手順 |
| `docs/rollback.md` | ロールバック手順 |

### 問題点

1. `setup.md` に仕様（What）と手順（How）が混在
2. `ops.md` にパイプライン概要（What/Why）が混在
3. `arch.md` が存在せず、設計上の不変条件が明文化されていない
4. `spec.md` が存在せず、外部仕様の正本がない

## 実装計画

### Step 1: docs/spec.md の新設

instruction.md の責務定義に従い、以下を記述する。

**記載内容:**
- 目的 / 非目的
- ユースケース（日次書籍収集 → DeepResearch メール配信）
- 外部インターフェース
  - Google Books API（収集）
  - SMTP（Gmail）（配信）
- 主要フロー: Collect → Upsert → Select → Mail
- データモデル概略（books テーブル、ISBN-13 一意性）
- 設定項目（env, config/jobs.yaml）とデフォルト
- 不変条件（ISBN 一意性、未配信優先の定義）
- 制約（API レート上限 1,000/日、DAILY_BOOKS_API_LIMIT）

**情報源:**
- `docs/setup.md` の概要・設定項目セクション
- `docs/ops.md` のパイプライン概要セクション

### Step 2: docs/arch.md の新設

instruction.md の責務定義に従い、以下を記述する。

**記載内容:**
- コンポーネント責務（Collect / Upsert / Select / Mail）
- データフローと依存方向
- 重要な設計判断とトレードオフ
  - ISBN-13 での重複排除
  - 未配信優先 → フォールバック戦略
  - ジョブ単位の実行間隔管理
- 失敗モード（API / SMTP / DB）と設計上の扱い
- 再実行性・idempotency・状態遷移の不変条件

**情報源:**
- `docs/ops.md` のパイプライン概要
- `docs/setup.md` のディレクトリ構成

### Step 3: docs/ops.md の整理

運用（How）責務のみに絞り込む。

**残すべき内容:**
- 定期実行設定（cron / systemd）
- ステータス確認コマンド
- 配信リセット手順
- データベース管理（バックアップ / リセット / 復元）
- ジョブ管理
- トラブルシューティング
- 監視
- systemd サービス管理

**削除・移動する内容:**
- パイプライン概要 → `arch.md` へ移動

### Step 4: docs/setup.md の廃止

setup.md の内容はすべて spec.md / ops.md に統合済みとなるため、ファイルを削除する。

**統合先:**
- 概要 → `spec.md`
- 必要なもの → `spec.md`（外部依存セクション）
- インストール手順 → `ops.md`（新設: セットアップセクション）
- Google Books API / Gmail 設定 → `ops.md`
- 環境変数設定 → `spec.md`（設定項目）+ `ops.md`（設定手順）
- ジョブ設定 → `spec.md`（config 仕様）+ `ops.md`（操作手順）
- 手動実行 → `ops.md`
- データ管理 → `ops.md`
- ディレクトリ構成 → `arch.md`
- コマンド一覧 → `ops.md`
- トラブルシューティング → `ops.md`（既存に統合）

### Step 5: 参照修正

setup.md を参照している箇所を修正する。

**事前確認:**
- `docs/migration-cli-rename.md` の存在を確認する
- 存在しない場合はスキップ（別ファイルへの移動・削除の可能性）

**対象ファイル:**
- `docs/migration-cli-rename.md`: 存在する場合、参照を `spec.md` / `ops.md` に更新

**確認:**
- `docs/old-plans/` および `docs/plans/` 配下は履歴として保持、修正不要

## Verify

1. **責務分離の確認（通読）**
   - `docs/spec.md`: 外部仕様（What）と制約・不変条件の定義に集中し、内部構造の詳細説明を避けていること
   - `docs/ops.md`: 運用手順・運用判断（How）に集中し、設計理由・アーキテクチャ説明を避けていること
   - `docs/arch.md`: 境界・依存方向・不変条件・失敗時方針（設計の固定）に集中し、手順書・運用コマンドを避けていること

2. **情報欠落の確認**
   - setup.md の全セクションが spec.md / ops.md / arch.md のいずれかに統合されていること

3. **参照確認（repo 全体）**
   ```bash
   grep -r "setup\.md" --include="*.md" . | grep -v "docs/old-plans" | grep -v "docs/plans" | grep -v "instruction.md"
   ```
   → 空であること（履歴ディレクトリは除外）

4. **ドキュメント存在確認**
   ```bash
   ls -la docs/spec.md docs/ops.md docs/arch.md
   ```
   → 3 ファイルすべて存在すること

5. **setup.md 削除確認**
   ```bash
   test ! -f docs/setup.md && echo "OK: setup.md deleted"
   ```

## DoD (Definition of Done)

- [ ] `docs/spec.md` が新設され、外部仕様が記載されている
- [ ] `docs/arch.md` が新設され、設計判断が記載されている
- [ ] `docs/ops.md` が運用手順のみに整理されている
- [ ] `docs/setup.md` が削除されている
- [ ] repo 内で setup.md への参照が残っていない（old-plans 除く）
- [ ] 各ドキュメントの責務が instruction.md の定義に準拠している

## Risks / Notes

- windows-task-scheduler.md / rollback.md は ops.md の補足として維持（統合しない）
- README.md は存在しないため、新設不要
