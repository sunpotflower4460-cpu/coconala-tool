/** 検索語。サーバー側 `/api/rakuten` の契約と揃える。 */
export const MAX_SEARCH_QUERY_LENGTH = 100;

export const MAX_CARD_TITLE_LENGTH = 200;
export const MAX_CARD_SITE_NAME_LENGTH = 100;
export const MAX_CARD_NOTE_LENGTH = 500;
export const MAX_CARD_PRICE_TEXT_LENGTH = 40;
export const MAX_CARD_SHIPPING_TEXT_LENGTH = 100;
export const MAX_CARD_CONDITION_TEXT_LENGTH = 100;
export const MAX_URL_LENGTH = 2000;
export const MAX_HISTORY_NAME_LENGTH = 80;

/** 履歴に残す検索警告の1件あたり最大長。 */
export const MAX_SEARCH_WARNING_LENGTH = 500;

/** 履歴に残す検索警告の最大件数。超過分は捨て、全体は落とさない。 */
export const MAX_SEARCH_WARNINGS = 10;
