# Data Source Policy

## Purpose

このアプリは、ユーザーが価格候補を見やすく比較するための補助ツールです。各サイトのデータを無制限に取得するスクレイピングツールではありません。

## Source Categories

### 1. Official API

公式APIで取得できるデータ。

Examples:

- eBay Browse API
- YahooショッピングAPI
- 楽天商品検索API
- 為替API

Card label:

`公式API取得`

Confidence:

`high`

### 2. Search API

一般検索APIから得た検索結果をカード化するもの。

Examples:

- Brave Search API など

Card label:

`検索表示から推定`

Confidence:

`medium` or `low`

Notes:

- 検索結果由来の価格は保証しない。
- タイトルやスニペットから価格らしき文字列を抽出する場合、必ず推定ラベルを付ける。

### 3. Search Link

Google、メルカリ、ヤフオクなど、ユーザーが検索済みページを一発で開くためのリンク。

Card label:

`検索リンク`

Confidence:

`low`

Notes:

- この方式ではアプリ側で価格を断定しない。
- ユーザーが元ページを確認し、必要に応じて手動追加する。

### 4. Manual / URL Add

ユーザーがURL、価格、送料、状態、メモを入力して追加するもの。

Card label:

`手動追加`

Confidence:

`medium`

## Guardrails

- メルカリ・ヤフオク・Google検索結果を高頻度に自動スクレイピングしない。
- サイトのアクセス制御や利用規約を回避するコードを入れない。
- APIキーや秘密情報をクライアントにハードコードしない。
- 検索表示から抽出した価格を確定価格として扱わない。
- 常に元ページへ飛べるリンクを用意する。

## UI Rule

ユーザーには難しく見せない。ただし、信頼のために小さなソースラベルを必ず出す。

Good:

- `公式API取得`
- `検索表示から推定`
- `手動追加`

Avoid:

- `正確な最安値です`
- `全サイト完全自動取得`
- `メルカリ自動スクレイピング`
