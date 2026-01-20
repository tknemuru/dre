# DRE 外部仕様書

## 目的

DRE（DeepResearch Email）は、書籍収集と DeepResearch 支援メール配信を行うシステムである。

- Google Books API で書籍情報を収集する
- 収集した書籍に DeepResearch 用プロンプトを付与してメール配信する
- ジョブ単位で収集クエリと配信を管理する

## 非目的

- 書籍の全文検索・閲覧機能
- 複数ユーザーへの同時配信
- リアルタイム通知

## ユースケース

1. ユーザーがジョブ（検索クエリ群）を登録する
2. 定期実行により Google Books API から書籍を収集する
3. 未配信の書籍を優先選択し、DeepResearch プロンプト付きメールを配信する
4. 配信済み書籍は再配信されない（明示的なリセット操作を除く）

## 外部インターフェース

### Google Books API

- **用途**: 書籍情報の収集
- **認証**: API キー（`GOOGLE_BOOKS_API_KEY`）
- **レート制限**: 1 日 1,000 クエリ（Google 側の無料枠）
- **アプリ内制限**: `DAILY_BOOKS_API_LIMIT` で調整可能（デフォルト: 100）

### SMTP（Gmail）

- **用途**: DeepResearch プロンプト付きメールの送信
- **認証**: Gmail アプリパスワード
- **設定項目**: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_TO`

## 主要フロー

```
Collect → Upsert → Select → Mail
```

1. **Collect**: Google Books API でクエリに基づき書籍を収集
2. **Upsert**: ISBN-13 で重複排除して DB に保存
3. **Select**: 未配信書籍を優先選択（なければフォールバック）
4. **Mail**: DeepResearch プロンプト付きメールを送信

## データモデル

### books テーブル

| カラム | 説明 |
|--------|------|
| isbn13 | ISBN-13（一意キー） |
| title | 書籍タイトル |
| authors | 著者 |
| delivered | 配信済みフラグ |
| delivered_at | 配信日時 |
| job_name | 配信元ジョブ名 |

## 設定項目

### 環境変数（.env）

| 変数名 | 必須 | デフォルト | 説明 |
|--------|------|-----------|------|
| `GOOGLE_BOOKS_API_KEY` | Yes | - | Google Books API キー |
| `SMTP_HOST` | Yes | - | SMTP サーバーホスト |
| `SMTP_PORT` | Yes | - | SMTP ポート |
| `SMTP_USER` | Yes | - | SMTP ユーザー |
| `SMTP_PASS` | Yes | - | SMTP パスワード（Gmail アプリパスワード） |
| `MAIL_TO` | Yes | - | 配信先メールアドレス |
| `APP_TZ` | No | `Asia/Tokyo` | タイムゾーン |
| `DAILY_BOOKS_API_LIMIT` | No | `100` | 日次 API クエリ上限 |

### ジョブ設定（config/jobs.yaml）

```yaml
defaults:
  interval: 3h        # 実行間隔
  mail_limit: 5       # 1回の配信上限
  max_per_run: 20     # 1回の収集上限
  fallback_limit: 3   # フォールバック配信上限

jobs:
  - name: <job-name>
    queries:
      - "<search-query>"
    enabled: true
    # ジョブ固有の設定で defaults を上書き可能
    mail_limit: 3
    max_per_run: 10
```

| 項目 | デフォルト | 説明 |
|------|-----------|------|
| `interval` | `3h` | ジョブの実行間隔 |
| `mail_limit` | `5` | 1 回の実行で配信する書籍数の上限 |
| `max_per_run` | `20` | 1 回の実行で収集する書籍数の上限 |
| `fallback_limit` | `3` | 未配信書籍がない場合のフォールバック配信数 |

## 不変条件

1. **ISBN-13 一意性**: 同一 ISBN-13 の書籍は DB に 1 レコードのみ存在する
2. **未配信優先**: Select フェーズでは未配信書籍を優先的に選択する
3. **配信済みフラグ**: 配信完了後、`delivered = true` に更新される
4. **クォータ管理**: 日次 API クエリ数は `DAILY_BOOKS_API_LIMIT` を超えない

## 制約

- Google Books API: 1 日 1,000 クエリ（Google 無料枠）
- アプリ内日次上限: `DAILY_BOOKS_API_LIMIT`（デフォルト 100）
- クォータは JST 日付変更でリセットされる
