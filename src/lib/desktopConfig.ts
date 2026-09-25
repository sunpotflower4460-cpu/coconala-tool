/**
 * デスクトップアプリの固定設定（出品者が変える場所はここだけ）。
 *
 * DESKTOP_RAKUTEN_ALLOWED_ORIGIN:
 *   楽天のアプリ登録で「アプリURL」「許可されたWebサイト」に入れてもらうURL（このアプリの紹介ページ）。
 *   アプリは楽天へ問い合わせるとき、このURLを Origin / Referer として送る。
 *   設定画面の「詳しい設定」から利用者ごとに変更もできる。
 */
export const DESKTOP_RAKUTEN_ALLOWED_ORIGIN = 'https://coconala-tool.sunpotflower4460.workers.dev';

/** 各サイトの開発者登録ページ（設定の案内で「登録ページを開く」に使う）。 */
export const REGISTRATION_URLS = {
  rakuten: 'https://webservice.rakuten.co.jp/app/create',
  rakutenList: 'https://webservice.rakuten.co.jp/app/list',
  yahoo: 'https://e.developer.yahoo.co.jp/register',
  yahooList: 'https://e.developer.yahoo.co.jp/dashboard/',
  ebay: 'https://developer.ebay.com/my/keys',
} as const;
