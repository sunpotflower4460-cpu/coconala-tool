import { MAX_SEARCH_QUERY_LENGTH } from './limits';

export type SearchQueryIssue = 'empty' | 'too_long' | 'too_short';

export type SearchQueryCheck = { ok: true; value: string } | { ok: false; issue: SearchQueryIssue };

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
 * 楽天市場の検索語として送ってよいかを判定する。サーバー（`/api/rakuten`）とフロントで同じ規則を使う。
 * 全角スペースは半角に揃え、連続空白は1つにまとめる。
 */
export function checkRakutenSearchQuery(raw: string): SearchQueryCheck {
  const value = stripControlChars(raw).replace(/　/g, ' ').replace(/\s+/g, ' ').trim();
  if (!value) return { ok: false, issue: 'empty' };
  if (value.length > MAX_SEARCH_QUERY_LENGTH) return { ok: false, issue: 'too_long' };
  // 「Switch 2」のような語は通す（判定は楽天側に任せ、拒否されたら invalid_query で案内する）。
  // 全語が短すぎる検索（「a」「あ」など）だけを事前に止め、無駄な上流呼び出しをしない。
  if (value.split(' ').every(isTooShortToken)) return { ok: false, issue: 'too_short' };
  return { ok: true, value };
}
