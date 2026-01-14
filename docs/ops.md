# Vibe Ver2.0 運用ガイド

## 日常運用

### 定期実行

Vibeは3時間ごとにジョブを実行するよう設計されています。

```bash
# cron設定例（毎時実行、内部で3時間判定）
0 * * * * cd /path/to/vibe && /usr/bin/node dist/cli.js run-due >> /var/log/vibe.log 2>&1
```

Windows Task Schedulerの場合は `docs/windows-task-scheduler.md` を参照してください。

### ステータス確認

```bash
# 配信ステータス
vibe mail status

# DB情報
vibe db info

# 設定診断
vibe doctor
```

## パイプライン概要

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Collect   │ --> │   Upsert    │ --> │   Select    │ --> │    Mail     │
│ Google Books│     │   to DB     │     │  未配信優先  │     │ DeepResearch│
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

1. **Collect**: Google Books APIでクエリに基づき書籍を収集
2. **Upsert**: ISBN-13で重複排除してDBに保存
3. **Select**: 未配信書籍を優先選択（なければフォールバック）
4. **Mail**: DeepResearchプロンプト付きメールを送信

## 配信リセット

### ユースケース

- 同じ書籍を再度配信したい
- テスト後にステータスをクリアしたい
- 特定ジョブの書籍のみ再配信したい

### コマンド

```bash
# すべての書籍を未配信にリセット
vibe mail reset --yes

# 過去7日間に配信した書籍のみリセット
vibe mail reset --since 7d --yes

# 過去30日間
vibe mail reset --since 30d --yes

# 過去1週間
vibe mail reset --since 1w --yes

# 特定ジョブで配信した書籍のみ
vibe mail reset --job ai-books --yes
```

### 確認

```bash
# リセット前後のステータス確認
vibe mail status
```

## データベース管理

### バックアップ

DBリセット時は自動的にバックアップが作成されます。

```bash
# 手動バックアップ
cp data/app.db data/app.db.manual.$(date +%Y%m%d)
```

### リセット

```bash
# 確認プロンプト付き
vibe db reset

# 確認スキップ
vibe db reset --yes
```

リセット後、バックアップファイルが `data/app.db.bak.<timestamp>` として保存されます。

### 復元

```bash
# バックアップ一覧
ls -la data/app.db.bak.*

# 復元
cp data/app.db.bak.2024-01-15T10-30-00 data/app.db
```

## ジョブ管理

### 一時停止

```bash
# ジョブを無効化
vibe job disable ai-books

# 確認
vibe job ls
```

### 再開

```bash
# ジョブを有効化
vibe job enable ai-books
```

### クエリの更新

```bash
# 既存クエリを置き換え
vibe job update ai-books -q "新しいクエリ1" -q "新しいクエリ2"

# または config/jobs.yaml を直接編集
```

## トラブルシューティング

### ログの確認

```bash
# 直接実行でログ確認
vibe run-due 2>&1 | tee vibe-debug.log
```

### よくある問題

#### 書籍が収集されない

1. クエリが適切か確認
2. Google Books APIキーが有効か確認
3. クォータ状況を確認: `vibe doctor`

#### メールが送信されない

1. SMTP設定を確認: `vibe doctor`
2. 未配信書籍があるか確認: `vibe mail status`
3. 強制送信でテスト: `vibe run-due --force`

#### 同じ書籍が何度も配信される

DBが正しく更新されていない可能性があります。

```bash
# DBの状態確認
vibe db info

# 必要に応じてDBリセット
vibe db reset --yes
```

## 監視

### 正常動作の確認

1. `vibe mail status` で定期的に配信数を確認
2. メール受信を確認
3. ログでエラーがないか確認

### アラート設定（例）

```bash
#!/bin/bash
# check-vibe.sh
UNDELIVERED=$(vibe mail status 2>/dev/null | grep "Undelivered:" | awk '{print $2}')
if [ "$UNDELIVERED" = "0" ]; then
  echo "Warning: No undelivered books"
fi
```
