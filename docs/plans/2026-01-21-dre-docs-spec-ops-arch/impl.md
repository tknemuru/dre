# Implementation Report: DRE ドキュメント再構成（spec / ops / arch）

## 変更ファイル一覧

| ファイル | 操作 | 説明 |
|----------|------|------|
| `docs/spec.md` | 新規作成 | 外部仕様書（What） |
| `docs/arch.md` | 新規作成 | アーキテクチャ（境界・依存・不変条件・失敗時方針） |
| `docs/ops.md` | 更新 | 運用ガイド（How）に再構成、セットアップ手順を統合 |
| `docs/setup.md` | 削除 | 内容を spec.md / ops.md / arch.md に統合 |
| `docs/migration-cli-rename.md` | 更新 | setup.md 参照を spec.md / arch.md に修正 |

## Verify 実行結果

### 1. ドキュメント存在確認

```bash
$ ls -la docs/spec.md docs/ops.md docs/arch.md
-rw-r--r-- 1 tk tk 5141 Jan 21 01:10 docs/arch.md
-rw-r--r-- 1 tk tk 8585 Jan 21 01:11 docs/ops.md
-rw-r--r-- 1 tk tk 3985 Jan 21 01:10 docs/spec.md
```

結果: OK（3 ファイルすべて存在）

### 2. setup.md 削除確認

```bash
$ test ! -f docs/setup.md && echo "OK: setup.md deleted"
OK: setup.md deleted
```

結果: OK

### 3. 参照確認（repo 全体）

```bash
$ grep -r "setup\.md" --include="*.md" . | grep -v "docs/old-plans" | grep -v "docs/plans" | grep -v "instruction.md"
（出力なし）
```

結果: OK（setup.md への参照なし、履歴ディレクトリ除外）

## DoD 充足根拠

| DoD 項目 | 状態 | 根拠 |
|----------|------|------|
| `docs/spec.md` が新設され、外部仕様が記載されている | Done | 目的/非目的、ユースケース、外部IF、主要フロー、データモデル、設定項目、不変条件、制約を記載 |
| `docs/arch.md` が新設され、設計判断が記載されている | Done | コンポーネント責務、データフロー、設計判断、失敗モード、再実行性、状態遷移不変条件を記載 |
| `docs/ops.md` が運用手順のみに整理されている | Done | パイプライン概要を削除、セットアップ手順を統合、運用手順・トラブルシューティングに集中 |
| `docs/setup.md` が削除されている | Done | rm コマンドで削除、Verify で確認済み |
| repo 内で setup.md への参照が残っていない（old-plans 除く） | Done | grep で確認、migration-cli-rename.md を修正済み |
| 各ドキュメントの責務が instruction.md の定義に準拠している | Done | spec: What、ops: How、arch: 境界・依存・不変条件・失敗時方針 |

## 責務分離の確認

### docs/spec.md（外部仕様 / What）

記載内容:
- 目的 / 非目的
- ユースケース
- 外部インターフェース（Google Books API, SMTP）
- 主要フロー
- データモデル概略
- 設定項目（env, config）
- 不変条件
- 制約

除外内容: 内部構造、実装理由の詳細説明

### docs/ops.md（運用手順 / How）

記載内容:
- セットアップ手順（インストール、API/SMTP 設定、環境変数）
- ジョブ管理
- 日常運用（定期実行、手動実行）
- 配信リセット
- データベース管理
- トラブルシューティング
- 監視
- systemd サービス管理
- コマンド一覧

除外内容: 設計理由、アーキテクチャ説明

### docs/arch.md（設計 / 境界・依存・不変条件・失敗時方針）

記載内容:
- コンポーネント責務（Collect / Upsert / Select / Mail）
- データフローと依存方向
- ディレクトリ構成
- 重要な設計判断とトレードオフ
- 失敗モードと設計上の扱い
- 再実行性・Idempotency
- 状態遷移の不変条件

除外内容: 手順書、運用コマンド

## 残課題・不確実点

なし
