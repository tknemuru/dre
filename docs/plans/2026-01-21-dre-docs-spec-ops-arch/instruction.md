[Purpose]
DRE リポジトリの docs 配下ドキュメントを、標準ルール（spec / ops / arch）に基づいて再構成する。
本トピックの目的は、MyGPT（バイブコーディングパートナー）および人間レビュアが、
plan / 実装レビュー時に迷わない「前提情報の固定」を行うことである。

[Scope]
対象は DRE リポジトリのみとする。
本トピックでは以下を行う。

1. docs/spec.md を正本として新設または再構成する
2. 既存 docs/setup.md の内容を spec.md に統合し、setup.md は廃止または極小化する
3. 既存 docs/ops.md を「運用（How）」責務に沿って整理する
4. 新規 docs/arch.md を追加し、設計上の境界・依存方向・不変条件・失敗時方針を明文化する
5. リポジトリ内で setup.md を参照している箇所があれば、spec.md 参照に修正する

[Non-Goals]
- DRE の機能追加・仕様変更
- コード実装の変更（ドキュメント修正のみ）
- docs 標準を他プロジェクトへ横展開する施策設計

[Document Responsibility Rules]
各ドキュメントの責務は以下に厳密に従うこと。

docs/spec.md:
- システムの外部仕様（What）を定義する
- 目的 / 非目的
- ユースケース
- 外部インターフェース（Google Books API, SMTP 等）
- 主要フローの仕様（状態・例外を含む）
- データモデルの概略（詳細設計は書かない）
- 設定項目（env, config）とデフォルト
- 不変条件（例：ISBN 一意性、未配信優先の定義）
- 制約（API レート、日次上限）
- 内部構造や実装理由の詳細説明は行わない

docs/ops.md:
- 運用手順および運用時の判断（How in production）を定義する
- 定期実行（cron / systemd）
- 監視と正常性判断基準
- トラブルシューティング（症状→確認→対処）
- バックアップ / リセット / 復旧手順
- 設計理由やアーキテクチャの説明は行わない

docs/arch.md:
- 設計上の境界・依存方向・不変条件・失敗時方針を定義する
- コンポーネント責務（Collect / Upsert / Select / Mail 等）
- データフローと依存方向
- 重要な設計判断とトレードオフ
- 失敗モード（API / SMTP / DB）と設計上の扱い
- 再実行性・idempotency・状態遷移の不変条件
- 手順書や運用コマンドは書かない（ops.md へ委譲）

[Quality Gates]
- spec / ops / arch の責務混在がないこと
- setup.md 廃止または縮退後も情報欠落がないこと
- repo 内リンク・参照が破綻していないこと
- 既存運用・仕様理解に後退がないこと

[Deliverables]
- 更新された docs/spec.md
- 更新された docs/ops.md
- 新規 docs/arch.md
- （必要に応じて）縮退した docs/setup.md または削除

[Verify]
- docs/spec.md / ops.md / arch.md を通読し、責務分離が守られていることを確認する
- setup.md 参照が repo 内に残っていないことを grep 等で確認する

[Rollback]
- ドキュメント変更前の状態に Git で戻せること
