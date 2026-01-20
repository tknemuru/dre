Status: DONE

Summary:
変更ファイル一覧・Verify 実行結果・DoD 充足根拠・責務分離の説明が揃っており、plan で定義した spec/ops/arch の責務分離と setup.md 廃止、参照修正が完了している。repo 全体の setup.md 参照除去も grep 結果で確認されている。

Requests:
なし

Verify:
1. docs/spec.md / docs/ops.md / docs/arch.md が存在すること（ls -la の結果が OK であること）
2. docs/setup.md が削除されていること（test の結果が OK であること）
3. repo 全体で setup.md 参照が残っていないこと（grep 出力が空であること）
4. docs/migration-cli-rename.md が setup.md 参照を含まず、spec.md / arch.md 参照に更新されていること（該当ファイルを通読）

Rollback:
ドキュメント変更を含むコミットを git で元に戻し、変更前の docs 構成へ復帰する。
