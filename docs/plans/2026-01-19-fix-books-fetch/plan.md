# Plan: Google Books 取得件数が少ない問題の切り分けと改善

## 背景調査結果

### 現在の実装状況

| 処理 | ファイル | 現状 |
|------|----------|------|
| API呼出 | `src/collectors/google-books.ts` | `startIndex` 未使用（ページネーション無し） |
| Upsert | `src/db/dao.ts` | ISBN-13重複排除、insert/update内訳ログ無し |
| Select | `src/db/dao.ts` | `selectBooksForMailByJob` で未配信書籍抽出 |
| Mail | `src/services/mailer.ts` | `mail_limit` 件数で送信 |

### 発見した問題点

1. **ページネーション未実装**
   - Google Books API は 1 回の呼び出しで最大 40 件
   - `startIndex` パラメータを使えば続きを取得可能だが、現在は未使用
   - `max_per_run=20` でクエリ数 1 なら問題ないが、`totalItems` が多い場合は取りこぼしが発生

2. **ログ不足による原因特定困難**
   - API レスポンスの `totalItems` をログ出力していない
   - Upsert 時の「新規挿入 / 既存更新」の内訳がない
   - 「どこで件数が減ったか」をログだけで判別できない

3. **設定値の影響が不透明**
   - `max_per_run` / `mail_limit` / `DAILY_BOOKS_API_LIMIT` の関係がログに現れない

---

## 実装方針

### 方針選択: 観測優先アプローチ

**改善ありきで進めない** という instruction の制約に従い、まず **観測ポイントを追加** してボトルネックを特定できる状態にする。その結果を見て、ページネーション導入の是非を判断する。

---

## 実装計画

### Phase 1: 件数観測ポイントの追加（観測強化）

#### 1.1 API レスポンスのログ追加

**対象**: `src/collectors/google-books.ts`

```
[Collect] query="Claude AI", totalItems=156, returned=40, skipped=3 (no ISBN)
```

- `totalItems`: APIが検索結果として持っている総数
- `returned`: 今回のリクエストで返された件数
- `skipped`: ISBN なしでスキップした件数

#### 1.2 Upsert 内訳のログ追加

**対象**: `src/db/dao.ts` の `upsertBook()` 戻り値変更、または `src/commands/run-due.ts` でカウント

```
[Upsert] inserted=5, updated=12, total=17
```

- `inserted`: 新規挿入された書籍数
- `updated`: 既存書籍の更新数
- `total`: 処理された総数

#### 1.3 Select 内訳のログ追加

**対象**: `src/commands/run-due.ts`

```
[Select] job=combined, total=150, delivered=120, undelivered=30, selected=5 (mail_limit)
```

- `total`: DB 内の書籍総数
- `delivered`: 既に配信済みの書籍数
- `undelivered`: 未配信の書籍数
- `selected`: 今回選択された件数（`mail_limit` で制限）

#### 1.4 サマリログの追加

**対象**: `src/commands/run-due.ts` の最後

```
=== Pipeline Summary ===
API totalItems: 156
API returned:   40
After ISBN filter: 37
Upsert result:  inserted=5, updated=32
DB undelivered: 30
Selected for mail: 5

Bottleneck: API returned (40) << totalItems (156) → pagination needed
```

---

### Phase 2: ページネーション導入（条件付き）

> **注意**: Phase 1 のログで「APIが返していない」ことが確認された場合のみ実施

#### 2.1 ページネーション設計

**新規パラメータ**: `max_pages` (デフォルト: 1)

```typescript
// config/jobs.yaml
defaults:
  max_per_run: 20
  max_pages: 3       # 新規: 最大ページ数

// 1クエリあたりの取得件数
// maxResults = Math.min(40, Math.ceil(max_per_run / queries.length))
// 複数ページ取得: startIndex = 0, 40, 80...
```

**`max_per_run` との整合**:
- `max_pages=1`: 現状維持（最大40件/クエリ）
- `max_pages=3`: 最大120件/クエリ（3 API呼び出し）
- 日次上限 `DAILY_BOOKS_API_LIMIT` との兼ね合いで制限

#### 2.2 クォータ管理の強化

```
[Quota] before: 50/100, pages_to_fetch=3
[Quota] would_exceed=true, reducing pages to 2
```

---

### Phase 3: ドキュメント更新

#### 3.1 setup.md 更新

- `max_pages` パラメータの説明追加
- ページネーション設定例の追加

#### 3.2 ops.md 更新

- ログの読み方セクション追加
- ボトルネック判断基準の記載

---

## Verify 方法

### Phase 1 完了条件

```bash
# 1. ビルド成功
npm run build

# 2. dry-run でログ形式を確認
dre run-due --dry-run

# 3. 実際に実行してログを確認
dre run-due --force

# 期待されるログ出力:
# [Collect] query="...", totalItems=XX, returned=XX, skipped=XX
# [Upsert] inserted=X, updated=X, total=X
# [Select] job=combined, total=X, delivered=X, undelivered=X, selected=X
# === Pipeline Summary ===
# ...
```

### Phase 2 完了条件（実施する場合）

```bash
# 1. max_pages 設定が反映されること
# config/jobs.yaml で max_pages: 2 を設定

# 2. 複数ページ取得のログ
# [Collect] query="...", page=1/2, startIndex=0, returned=40
# [Collect] query="...", page=2/2, startIndex=40, returned=35

# 3. クォータ制限が正しく機能すること
# [Quota] before: 98/100, pages_to_fetch=3
# [Quota] would_exceed=true, reducing pages to 2
```

### Phase 3 完了条件

- docs/setup.md にログの読み方が記載されている
- docs/ops.md にボトルネック判断基準が記載されている

---

## テスト方針

### ユニットテスト

| 対象 | テスト内容 |
|------|------------|
| `searchGoogleBooks` | totalItems / returned の正しい抽出 |
| `upsertBook` | 戻り値で insert/update を区別 |
| ページネーション | startIndex の正しい計算 |

**モック**: Google Books API レスポンスをモックして、外部依存なしでテスト

### 統合テスト（手動）

```bash
# 実際の API を使ったテスト（開発環境）
DAILY_BOOKS_API_LIMIT=10 dre run-due --force
```

---

## 変更ファイル一覧（予定）

| ファイル | 変更内容 |
|----------|----------|
| `src/collectors/google-books.ts` | totalItems ログ、ページネーション（Phase 2） |
| `src/db/dao.ts` | upsertBook 戻り値に insert/update フラグ追加 |
| `src/commands/run-due.ts` | 各段階のログ追加、サマリ出力 |
| `src/config/jobs.ts` | max_pages パラメータ追加（Phase 2） |
| `docs/setup.md` | ログの読み方、max_pages 説明 |
| `docs/ops.md` | ボトルネック判断基準 |

---

## リスクと対策

| リスク | 対策 |
|--------|------|
| ログが多すぎて可読性低下 | INFO レベルで最低限に抑える、サマリで要点を示す |
| ページネーションでAPI上限超過 | クォータチェックを各ページ前に実施 |
| 既存動作の破壊 | 新規ログ追加のみ、既存ロジックは変更しない（Phase 1） |

---

## DoD（Definition of Done）

- [ ] **Phase 1**: ログを見るだけで以下が判別できる
  - API が返していないのか（totalItems vs returned）
  - ページネーション不足なのか（returned < totalItems）
  - Upsert の重複排除で減っているのか（inserted vs updated）
  - Mail/Select 上限で「少なく見えている」だけなのか（selected vs undelivered）
- [ ] **Phase 2**（必要時のみ）: ページネーションが `max_per_run` / 日次上限と矛盾しない
- [ ] **Phase 3**: docs に反映されている
- [ ] 全フェーズで既存テストが通る（`npm test`）
- [ ] ビルドが通る（`npm run build`）
