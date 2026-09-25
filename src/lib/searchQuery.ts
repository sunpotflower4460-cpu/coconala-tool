import { MAX_SEARCH_QUERY_LENGTH } from './limits';

export type SearchQueryIssue = 'empty' | 'too_long' | 'too_short';

export type SearchQueryCheck =
  | {
      ok: true;
      /** 整形した検索語（画面表示・見本データの検索用） */
      value: string;
      /** 楽天へ送る検索語。短すぎる語（「Switch 2」の「2」など）を直前の語につなげたもの */
      keyword: string;
    }
  | { ok: false; issue: SearchQueryIssue };

/** 制御文字（タブ・改行含む）を取り除く。 */
export function stripControlChars(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\x00-\x1F\x7F]/g, '');
}

// 楽天の検索語ルール（公式ドキュメント）: 半角の語は2文字以上、ひらがな・カタカナ・記号だけの語も2文字以上（漢字などは1文字可）。
const ASCII_ONLY = /^[\x20-\x7E]+$/;
const KANA_OR_SYMBOL_ONLY = /^[぀-ヿ　-〿！-／：-＠［-｀｛-･]+$/;

function isTooShortToken(token: string): boolean {
  if (ASCII_ONLY.test(token)) return token.length < 2;
  if (KANA_OR_SYMBOL_ONLY.test(token)) return token.length < 2;
  return false;
}

/**
 * 楽天は1文字の半角語・かな語を含む検索語を丸ごと拒否する（例:「Nintendo Switch 2」）。
 * 短い語を直前の語（先頭なら直後の語）に空白なしでつなげると、楽天は受け付け、意図した商品も見つかる
 * （本番で確認: 「Nintendo Switch2」「Switch2」で Switch 2 本体がヒット）。
 */
function joinShortTokens(tokens: string[]): string {
  const joined: string[] = [];
  let pendingPrefix = '';
  for (const token of tokens) {
    if (isTooShortToken(token)) {
      if (joined.length > 0) joined[joined.length - 1] += token;
      else pendingPrefix += token;
      continue;
    }
    joined.push(pendingPrefix + token);
    pendingPrefix = '';
  }
  return joined.join(' ');
}

/**
 * 楽天市場の検索語として送ってよいかを判定する。サーバー（`/api/rakuten`）とフロントで同じ規則を使う。
 * 全角スペースは半角に揃え、連続空白は1つにまとめる。
 */
export function checkRakutenSearchQuery(raw: string): SearchQueryCheck {
  const value = stripControlChars(raw).replace(/　/g, ' ').replace(/\s+/g, ' ').trim();
  if (!value) return { ok: false, issue: 'empty' };
  if (value.length > MAX_SEARCH_QUERY_LENGTH) return { ok: false, issue: 'too_long' };
  // 全語が短すぎる検索（「a」「あ」など）は事前に止め、無駄な上流呼び出しをしない。
  // 一部だけ短い語（「Switch 2」の「2」）は、楽天へ送るときに直前の語へつなげる。
  const tokens = value.split(' ');
  if (tokens.every(isTooShortToken)) return { ok: false, issue: 'too_short' };
  return { ok: true, value, keyword: joinShortTokens(tokens) };
}
