# 楽天 Worker スキャフォールド（モック先行）

このドキュメントは、将来的な楽天公式API接続のための Worker 足場設計です。  
現時点では **実API呼び出しは行わず**、フロントエンドはモックデータで開発します。

## エンドポイント設計

```text
GET /api/rakuten-search?keyword=<商品名>&page=1&hits=10
```

- `keyword`: 必須。商品名・型番・JAN など
- `page`: 任意。ページ番号
- `hits`: 任意。取得件数（上限を Worker 側で制御）

## 必須シークレット

- `RAKUTEN_APP_ID`

> APIキー/シークレットは Vite フロントエンドに固定値で置かないこと。  
> `VITE_` 変数はビルド成果物に含まれるため、機密情報には使わないこと。

## レスポンス形状（クライアント向け）

```json
{
  "cards": [
    {
      "id": "rakuten-<itemCode>",
      "title": "商品名",
      "siteName": "<shopName>（楽天市場）",
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

## ローカル開発戦略（mock-first）

1. フロントエンドでは `rakuten_mock` モードで楽天API形式モックを使用
2. Mapper で `MarketCard[]` へ正規化
3. Worker 実装後に adapter の呼び先だけ差し替え
4. UI ラベル（`公式API取得` / `楽天市場 公式API取得（モック）`）は維持して差分検証

## Cloudflare Pages + Workers デプロイメモ

- フロント: Cloudflare Pages（Vite build）
- API: Cloudflare Workers（`/api/rakuten-search`）
- 秘密情報: `wrangler secret put RAKUTEN_APP_ID`
- Pages から Worker へは同一プロジェクトの Functions/Worker ルーティングで接続

## 非実行サンプル（擬似コード）

```ts
// pseudo code only (non-executable)
export async function onRequest(context) {
  const keyword = new URL(context.request.url).searchParams.get('keyword');
  const appId = context.env.RAKUTEN_APP_ID;

  if (!keyword || !appId) {
    return Response.json({ error: 'API_UNAVAILABLE', fallback: 'search_link' }, { status: 400 });
  }

  // ここで楽天APIを呼び出し、MarketCardへ変換して返却する
  // 現フェーズでは実装しない
  return Response.json({ cards: [], totalCount: 0 });
}
```
