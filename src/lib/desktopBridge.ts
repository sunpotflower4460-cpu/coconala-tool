/**
 * デスクトップアプリ（Electron）の本体と画面をつなぐ窓口の型。
 * 実装は `electron/preload.ts`（画面側に `window.desktop` として公開）と `electron/main.ts`。
 * Web 版・テストでは `window.desktop` が無いので、`getDesktop()` は undefined を返す。
 */
import type { MarketId } from '../types/market';

export type KeySite = 'rakuten' | 'yahoo' | 'ebay';

export type KeyStatus = {
  rakuten: { configured: boolean; allowedOrigin: string; expiresOn?: string };
  yahoo: { configured: boolean };
  ebay: { configured: boolean };
  /** OS の暗号化保管（Mac のキーチェーン・Windows の資格情報保護）で保存できているか */
  encrypted: boolean;
};

export type KeyInput = {
  rakuten?: { appId: string; accessKey: string; allowedOrigin?: string; expiresOn?: string };
  yahoo?: { clientId: string };
  ebay?: { clientId: string; clientSecret: string };
};

/** キーのテスト結果。`code` は /api/* のエラーコード（no_key / upstream_auth / timeout など）。 */
export type KeyTestResult = { ok: boolean; count?: number; code?: string };

/** アプリ内のタブで実際のページを表示するサイト（公式APIが無いサイト）。 */
export type SiteMarket = Extract<MarketId, 'mercari' | 'yahoo_auctions' | 'rakuma' | 'amazon'>;
export const SITE_MARKETS: SiteMarket[] = ['mercari', 'yahoo_auctions', 'rakuma', 'amazon'];

export type SiteBounds = { x: number; y: number; width: number; height: number };

/** 画面側が本体へ伝える「どのタブを、画面のどこに表示するか」。visible=false で全タブを隠す（ダイアログ表示中など）。 */
export type SiteLayout = { visible: boolean; active: SiteMarket | null; bounds: SiteBounds | null };

export type SiteState = {
  market: SiteMarket;
  status: 'idle' | 'loading' | 'ready' | 'failed';
  url?: string;
  title?: string;
  canGoBack?: boolean;
};

/** 取り込みで1商品ぶんとして読んだ文字（画像・説明文・出品者情報は含めない）。 */
export type CapturedEntry = { url: string; text: string; label: string };

export type CaptureResult = {
  market: SiteMarket;
  ok: boolean;
  entries: CapturedEntry[];
  /**
   * ok=false の理由: not_loaded（まだ開いていない）/ loading（読み込み中）/ not_search_page（商品ページ等を表示中）/
   * disabled（設定で取り込みオフ）/ error
   */
  reason?: 'not_loaded' | 'loading' | 'not_search_page' | 'disabled' | 'error';
};

export type CaptureSettings = Record<SiteMarket, boolean>;

export interface DesktopApi {
  keys: {
    status(): Promise<KeyStatus>;
    save(input: KeyInput): Promise<KeyStatus>;
    clear(site: KeySite): Promise<KeyStatus>;
    test(site: KeySite): Promise<KeyTestResult>;
  };
  sites: {
    /** 各タブを、この検索語の検索ページへ移動する（1検索につき各サイト1回） */
    search(query: string): Promise<void>;
    setLayout(layout: SiteLayout): void;
    capture(): Promise<CaptureResult[]>;
    goBack(market: SiteMarket): Promise<void>;
    reload(market: SiteMarket): Promise<void>;
    openInBrowser(market: SiteMarket): Promise<void>;
    captureSettings(): Promise<CaptureSettings>;
    setCaptureEnabled(market: SiteMarket, enabled: boolean): Promise<CaptureSettings>;
    onState(listener: (states: SiteState[]) => void): () => void;
  };
  openExternal(url: string): Promise<void>;
  appInfo(): Promise<{ version: string; platform: string }>;
}

declare global {
  interface Window {
    desktop?: DesktopApi;
  }
}

export function getDesktop(): DesktopApi | undefined {
  return typeof window !== 'undefined' ? window.desktop : undefined;
}
