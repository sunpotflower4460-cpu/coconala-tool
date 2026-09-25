import { create } from 'zustand';
import type { KeySite, KeyStatus, SiteMarket, SiteState } from '../../lib/desktopBridge';
import { SITE_MARKETS } from '../../lib/desktopBridge';

export type RightTab = SiteMarket | 'compare' | 'history';
export type SetupStep = 'overview' | KeySite;

/** デスクトップ版の画面だけで使う一時的な状態（保存しない）。 */
type DesktopUiState = {
  rightTab: RightTab;
  siteStates: SiteState[];
  keyStatus: KeyStatus | null;
  setupOpen: boolean;
  setupStep: SetupStep;
  /** 画面の上に重なるダイアログの数。1以上のあいだ、サイトのタブ（別レイヤーの実ページ）を隠す */
  overlays: number;
  capturing: boolean;
  captureNotice: { lines: string[]; kind: 'ok' | 'warn' } | null;
  setRightTab: (tab: RightTab) => void;
  setSiteStates: (states: SiteState[]) => void;
  setKeyStatus: (status: KeyStatus) => void;
  openSetup: (step?: SetupStep) => void;
  closeSetup: () => void;
  pushOverlay: () => void;
  popOverlay: () => void;
  setCapturing: (value: boolean) => void;
  setCaptureNotice: (notice: DesktopUiState['captureNotice']) => void;
};

export const useDesktopUi = create<DesktopUiState>()((set) => ({
  rightTab: 'mercari',
  siteStates: SITE_MARKETS.map((market) => ({ market, status: 'idle' })),
  keyStatus: null,
  setupOpen: false,
  setupStep: 'overview',
  overlays: 0,
  capturing: false,
  captureNotice: null,
  setRightTab: (rightTab) => set({ rightTab }),
  setSiteStates: (siteStates) => set({ siteStates }),
  setKeyStatus: (keyStatus) => set({ keyStatus }),
  openSetup: (step = 'overview') => set({ setupOpen: true, setupStep: step }),
  closeSetup: () => set({ setupOpen: false }),
  pushOverlay: () => set((s) => ({ overlays: s.overlays + 1 })),
  popOverlay: () => set((s) => ({ overlays: Math.max(0, s.overlays - 1) })),
  setCapturing: (capturing) => set({ capturing }),
  setCaptureNotice: (captureNotice) => set({ captureNotice }),
}));
