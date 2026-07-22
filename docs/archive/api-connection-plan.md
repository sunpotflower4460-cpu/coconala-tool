# API Connection Plan (Safe Preparation)

## 現在の状態

- フロントエンドは **sample / stub** ベースで動作します。
- 価格候補比較・手動追加・利益計算・CSV出力・履歴保存を先に実用化する方針です。
- メルカリ・ヤフオクは MVP では検索リンク + 手動確認を中心に扱います。

## APIキー管理ルール

- APIキーやシークレットはフロントエンドに直書きしません。
- 本番キーは Cloudflare Workers / Supabase Edge Functions / Next.js API Routes などのサーバー側環境変数に置きます。
- クライアントはサーバー側の安全なエンドポイントのみ呼び出す構成にします。

## 実装候補

### 1) Cloudflare Workers

- 軽量で高速、無料枠が扱いやすい
- `wrangler secret put` でキー管理
- フロントから Worker endpoint を呼ぶ

### 2) Supabase Edge Functions

- Supabase利用時に統合しやすい
- Project Secrets でキー管理
- DB連携や履歴共有機能への拡張がしやすい

### 3) Next.js API Routes

- WebアプリをNext.js化する場合に自然
- Vercel Environment Variables と相性が良い
- UIとAPIを同一プロジェクトで管理しやすい

## 推奨の段階的接続順

1. eBay / Yahooショッピング / 楽天など公式APIをサーバー側経由で接続
2. 取得結果を `MarketCard` に正規化して表示
3. 検索由来の価格は `検索表示から推定` ラベルを維持
4. 取得失敗時は手動追加と検索リンク導線を維持

## 非対応（MVP方針）

- 高頻度スクレイピング
- サイトアクセス制御の回避
- 検索表示価格の断定
