# Live Rakuten API 接続前の判断ゲート

このドキュメントは、楽天APIの**本接続実装前**に確認する判断ゲートです。  
v0.1 では実装せず、手動承認が出るまで mock/search-link 運用を維持します。

## 実装前の前提条件（Prerequisites）

- [ ] v0.1 Demo の運用確認（検索・比較・CSV・履歴）が完了している
- [ ] `npm run lint` / `npm run build` が安定して通る
- [ ] 接続対象を「楽天商品検索API」に確定し、要件（件数上限・表示項目・エラー表示）を合意済み
- [ ] 失敗時フォールバック（mock/search-link）仕様を合意済み

## Rakuten App ID の取得先

- 楽天 Developers: https://webservice.rakuten.co.jp/
- 開発者登録後、アプリを作成して App ID を取得する

## シークレットの保管場所

- App ID はフロントエンドに置かず、Cloudflare Workers（または同等のサーバーサイド）環境変数に保存する
- 例: `RAKUTEN_APP_ID` を Worker 側の Secret として設定
- `VITE_` 変数やクライアントバンドルに機密情報を含めない

## なぜフロントエンドに置けないか

- フロントエンドの値はブラウザ配信物から参照可能で、キー漏えいリスクが高い
- 不正利用によりレート制限超過・利用停止・想定外コストのリスクがある
- そのため API 呼び出しは Worker 経由に固定する

## 推奨実装経路（Cloudflare Worker）

1. Worker に `/api/rakuten-search` エンドポイントを実装
2. Worker の Secret に `RAKUTEN_APP_ID` を設定
3. フロントエンドは Worker エンドポイントのみ呼び出す
4. 返却データを既存 `MarketCard` 形式に正規化する

## 実装開始の承認ルール

- 本接続は必ず手動承認（Issue/PR コメントなどの明示）後に開始する
- 承認前は実API呼び出しコード・キー設定を追加しない

## ロールバック / フォールバック方針

- API障害・制限超過・キー未設定時は、即時に `楽天APIモック` / `検索リンク` モードへ戻す
- UI上で「実API未接続または一時停止中」と分かる表示を維持する
- デモ継続を優先し、検索・比較・CSV・履歴の基本機能を止めない
