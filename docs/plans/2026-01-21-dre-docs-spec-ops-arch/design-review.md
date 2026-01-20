Status: DESIGN_APPROVED

Summary:
前回指摘（repo 全体での参照確認、arch.md の責務表現の是正、参照修正対象ファイルの存在確認）をすべて取り込み済み。DRE 限定の docs 再構成としてスコープ・手順・Verify・DoD が整合しており、責務分離ルールに沿った成果物が作れる計画になっている。

Requests:
なし

Verify:
1. 責務分離（通読）
- docs/spec.md が外部仕様（What）と制約・不変条件に集中し、内部構造の詳細に踏み込んでいないこと
- docs/ops.md が運用手順・運用判断（How）に集中し、設計理由・アーキテクチャ説明が混ざっていないこと
- docs/arch.md が境界・依存方向・不変条件・失敗時方針（設計の固定）に集中し、手順書・運用コマンドが混ざっていないこと
2. 情報欠落がないこと
- setup.md の全セクションが spec/ops/arch のいずれかに統合されていること
3. 参照確認（repo 全体）
- grep -r "setup\.md" --include="*.md" . | grep -v "docs/old-plans" | grep -v "docs/plans" | grep -v "instruction.md"
- 出力が空であること（履歴ディレクトリ除外は許容）
4. ファイル存在
- ls -la docs/spec.md docs/ops.md docs/arch.md で 3 ファイルが存在すること
5. setup.md 削除
- test ! -f docs/setup.md && echo "OK: setup.md deleted" が OK になること

Rollback:
ドキュメント変更を含むコミットを git で元に戻し、変更前の docs 構成へ復帰する。
