# 最初の公式API接続計画

このドキュメントでは、相場カードリサーチアプリの最初の公式API接続をどのように行うか設計します。  
**現時点では実装しません。設計・準備ドキュメントです。**

---

## 推奨ファーストAPI: 楽天商品検索API

### 選定理由

| 比較項目 | 楽天 | eBay Browse API | Yahoo! Shopping API |
|----------|------|-----------------|---------------------|
| 無料枠 | 1,000リクエスト/日（開発者登録のみ） | 月5,000リクエスト（要審査） | 5,000リクエスト/日 |
| 日本語商品データ | ◎ 豊富 | △ 英語中心 | ◎ 豊富 |
| 画像URL | ◎ 取得可能 | ◎ 取得可能 | ◎ 取得可能 |
| 価格信頼性 | ◎ 公式販売価格 | ◎ 公式出品価格 | ◎ 公式販売価格 |
| 申請難度 | ◎ 比較的容易 | △ 英語申請が必要 | ○ 容易 |
| MarketCard変換 | ◎ シンプル | ○ 為替換算が必要 | ◎ シンプル |

楽天APIは日本向けツールとして最も自然なファーストステップです。無料枠内での試験運用が容易で、日本語商品データが豊富に取得できます。

---

## 必要な環境変数

以下の環境変数をサーバーサイド（Cloudflare Workers / Vercel Edge Functions）にのみ設定します。  
**フロントエンドコードには書きません。**

```
RAKUTEN_APP_ID=<楽天アプリID>
RAKUTEN_AFFILIATE_ID=<アフィリエイトID（任意）>
```

楽天 Developers から取得: https://webservice.rakuten.co.jp/

---

## サーバー/Workerエンドポイント設計

```
GET /api/rakuten-search?keyword=<商品名>&page=1&hits=10
```

### レスポンス形式

```json
{
  "cards": [
    {
      "id": "rakuten-<itemCode>",
      "title": "商品名",
      "siteName": "楽天市場",
      "sourceType": "official_api",
      "priceText": "¥12,800",
      "priceValue": 12800,
      "currency": "JPY",
      "imageUrl": "https://thumbnail.image.rakuten.co.jp/...",
      "pageUrl": "https://item.rakuten.co.jp/...",
      "shippingText": "送料無料",
      "conditionText": "新品",
      "confidence": "high",
      "note": "楽天市場 公式API取得",
      "createdAt": "<ISO8601>"
    }
  ],
  "totalCount": 42
}
```

### エラーレスポンス形式

```json
{
  "error": "API_UNAVAILABLE",
  "message": "楽天APIに接続できませんでした。",
  "fallback": "search_link"
}
```

---

## 楽天API → MarketCard マッピング表

| 楽天APIフィールド | MarketCard フィールド | 変換処理 |
|------------------|----------------------|---------|
| `itemCode` | `id` | `rakuten-${itemCode}` |
| `itemName` | `title` | そのまま（最大100文字に切り詰め） |
| `shopName` | `siteName` | `${shopName}（楽天市場）` |
| — | `sourceType` | 固定値: `'official_api'` |
| `itemPrice` | `priceValue` | `Number(itemPrice)` |
| `itemPrice` | `priceText` | `` `¥${itemPrice.toLocaleString()}` `` |
| — | `currency` | 固定値: `'JPY'` |
| `mediumImageUrls[0].imageUrl` | `imageUrl` | 配列の最初 |
| `itemUrl` | `pageUrl` | そのまま |
| `postageFlag` | `shippingText` | `0` → `'送料無料'`、`1` → `'送料別途'` |
| — | `conditionText` | 楽天は基本新品扱い：`'新品'` |
| — | `confidence` | 固定値: `'high'` |
| — | `note` | `'楽天市場 公式API取得'` |

---

## エラー時のフォールバック設計

1. **APIキー未設定**: フォールバックとして検索リンクカード（`sourceType: 'search_link'`）を表示。UI に「楽天市場で検索」リンクを表示
2. **APIエラー（5xx）**: リトライ1回後、フォールバックとして検索リンクを提示
3. **0件**: 「楽天市場での検索結果がありません」と表示し、検索リンクを案内
4. **レート制限（429）**: ユーザーに「しばらく時間をおいてから再試行してください」と表示

フォールバック後も `sourceType: 'search_link'` カードとして UI に反映されるため、ユーザーは手動で元ページを確認できます。

---

## テスト戦略（モックレスポンス使用）

実API呼び出し前に、モックレスポンスでフロントエンド実装を検証します。

### モックデータファイル

```
src/mocks/rakutenSearchMock.ts
```

```typescript
export const rakutenSearchMockResponse = {
  cards: [
    {
      id: 'rakuten-mock-1',
      title: 'テスト商品 PS5',
      siteName: 'テストショップ（楽天市場）',
      sourceType: 'official_api' as const,
      priceText: '¥72,800',
      priceValue: 72800,
      currency: 'JPY' as const,
      imageUrl: 'https://placehold.co/300x200/dc2626/ffffff?text=Rakuten',
      pageUrl: 'https://item.rakuten.co.jp/mock-shop/ps5-001/',
      shippingText: '送料無料',
      conditionText: '新品',
      confidence: 'high' as const,
      note: '楽天市場 公式API取得（モック）',
      createdAt: new Date().toISOString(),
    },
  ],
  totalCount: 1,
};
```

### テスト手順

1. モックレスポンスを使って `MarketCard[]` への変換が正しく動作することを確認
2. エラーレスポンス（`{ error: 'API_UNAVAILABLE' }`）を受け取ったとき、フォールバックカードが正しく表示されることを確認
3. 実APIキー設定後、開発環境で 1 件取得を確認
4. 日本語商品名・価格表示が文字化けしないことを確認

---

## 実装ステップ（次フェーズ用メモ）

1. 楽天 Developers に開発者登録してアプリIDを取得
2. Cloudflare Workers または Vercel Edge Function にエンドポイント実装
3. 環境変数を Worker/Function に設定
4. フロントエンドから `fetch('/api/rakuten-search?keyword=...')` を呼び出す
5. `resultCards` を楽天 API レスポンス + 既存サンプルデータの混在から API レスポンスのみに切り替え
6. デプロイして動作確認
